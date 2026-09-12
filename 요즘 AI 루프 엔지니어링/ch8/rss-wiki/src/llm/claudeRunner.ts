/** `claude -p` 서브프로세스 러너. 프롬프트는 stdin으로 전달한다. */
import { spawn } from 'node:child_process';
import type { ClaudeResponse, ClaudeRunOptions, ClaudeUsage, SpawnImpl } from '../types.ts';
import { LlmTimeoutError, RateLimitError, UsageLimitError } from '../types.ts';

const KILL_GRACE_MS = 5000;

/** 실제 `claude` 프로세스를 띄우는 기본 구현. 테스트에서는 스텁으로 교체한다. */
export const defaultSpawn: SpawnImpl = (bin, args, stdin, timeoutMs, signal) => {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;
    let killHandle: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killHandle) clearTimeout(killHandle);
      signal?.removeEventListener('abort', onAbort);
    };

    const killChild = () => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* 이미 종료됨 */
      }
      killHandle = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* 이미 종료됨 */
        }
      }, KILL_GRACE_MS);
    };

    const onAbort = () => killChild();

    if (signal) {
      if (signal.aborted) killChild();
      else signal.addEventListener('abort', onAbort);
    }

    timeoutHandle = setTimeout(killChild, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code: code ?? -1, stdout, stderr });
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
};

/** `claude -p` 호출 인자. 프롬프트는 argv가 아니라 stdin으로 넘긴다. */
export function buildArgs(model: string): string[] {
  return ['-p', '--model', model, '--output-format', 'json', '--allowed-tools', '', '--max-turns', '1'];
}

interface RawClaudeOutput {
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    /** 프롬프트 캐시에 새로 기록된 입력 토큰 */
    cache_creation_input_tokens?: number;
    /** 프롬프트 캐시에서 재사용한 입력 토큰 */
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
}

/**
 * claude -p 는 프롬프트 대부분을 캐시로 넘기기 때문에 usage.input_tokens 에는
 * 캐시에 올라가지 않은 잔여분(보통 10 안팎)만 들어온다. 실제 입력량을 기록하려면
 * cache_creation / cache_read 를 함께 더해야 한다.
 */
function totalInputTokens(usage: RawClaudeOutput['usage']): number {
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}

function parseStdout(stdout: string): { text: string; isError: boolean; usage: ClaudeUsage } {
  try {
    const parsed = JSON.parse(stdout) as RawClaudeOutput;
    return {
      text: typeof parsed.result === 'string' ? parsed.result : stdout,
      isError: Boolean(parsed.is_error),
      usage: {
        input_tokens: totalInputTokens(parsed.usage),
        output_tokens: parsed.usage?.output_tokens ?? 0,
        cost_usd: parsed.total_cost_usd ?? 0,
      },
    };
  } catch {
    // JSON 파싱 실패 시 stdout 전체를 결과 텍스트로 본다.
    return { text: stdout, isError: false, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  }
}

function classifyError(haystack: string): 'rate_limit' | 'usage_limit' | 'timeout' | null {
  if (haystack.includes('429') || haystack.includes('rate limit') || haystack.includes('rate_limit')) {
    return 'rate_limit';
  }
  if (haystack.includes('usage limit') || haystack.includes('quota') || haystack.includes('limit reached')) {
    return 'usage_limit';
  }
  if (haystack.includes('timeout') || haystack.includes('timed out')) {
    return 'timeout';
  }
  return null;
}

export async function runClaude(prompt: string, opts: ClaudeRunOptions): Promise<ClaudeResponse> {
  const spawnImpl = opts.spawnImpl ?? defaultSpawn;
  const args = buildArgs(opts.model);

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LlmTimeoutError('claude 호출이 타임아웃되었습니다')), opts.timeoutMs);
  });

  const callPromise = spawnImpl(opts.bin, args, prompt, opts.timeoutMs, opts.signal);
  // timeoutPromise 가 먼저 이기는 경우에도 unhandled rejection 이 나지 않게 흡수해둔다.
  callPromise.catch(() => {});

  let result: { code: number; stdout: string; stderr: string };
  try {
    result = await Promise.race([callPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  const { text, isError, usage } = parseStdout(result.stdout);

  if (result.code !== 0 || isError) {
    const haystack = `${result.stderr}\n${text}`.toLowerCase();
    const kind = classifyError(haystack);
    const message = text || result.stderr || `claude 가 종료 코드 ${result.code} 로 실패했습니다`;
    if (kind === 'rate_limit') throw new RateLimitError(message);
    if (kind === 'usage_limit') throw new UsageLimitError(message);
    if (kind === 'timeout') throw new LlmTimeoutError(message);
    throw new Error(message);
  }

  return { text, usage };
}
