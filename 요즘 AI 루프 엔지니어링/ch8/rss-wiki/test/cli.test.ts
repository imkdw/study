import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../src/cli.ts';

async function captureLogsAsync<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = orig;
  }
}

test("main(['help']) 는 0 을 반환하고 서브커맨드 목록을 출력한다", async () => {
  const { result, lines } = await captureLogsAsync(() => main(['help']));
  assert.equal(result, 0);
  const text = lines.join('\n');
  for (const sub of ['collect', 'extract', 'dedupe', 'enrich', 'compose', 'build', 'run', 'serve', 'search', 'feeds', 'doctor']) {
    assert.ok(text.includes(sub), `help 에 ${sub} 가 있어야 한다`);
  }
});

test('main([]) 도 도움말을 보여준다', async () => {
  const { result, lines } = await captureLogsAsync(() => main([]));
  assert.equal(result, 0);
  assert.ok(lines.join('\n').includes('collect'));
});

test('알 수 없는 명령은 0 이 아닌 값을 반환한다', async () => {
  const origErr = console.error;
  console.error = () => {};
  try {
    const code = await main(['flibbertigibbet']);
    assert.notEqual(code, 0);
  } finally {
    console.error = origErr;
  }
});

test("main(['doctor','--db',':memory:']) 가 예외 없이 끝난다", async () => {
  process.env.RSS_WIKI_SKIP_CLAUDE_CHECK = '1';
  const { result } = await captureLogsAsync(() => main(['doctor', '--db', ':memory:']));
  assert.equal(typeof result, 'number');
  delete process.env.RSS_WIKI_SKIP_CLAUDE_CHECK;
});

test("main(['feeds','list','--feeds', tmp]) 가 피드 수를 출력한다", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-cli-test-'));
  const feedsPath = join(dir, 'feeds.yaml');
  writeFileSync(
    feedsPath,
    `feeds:\n  - url: https://a.example.com/rss\n    name: A\n  - url: https://b.example.com/rss\n    name: B\n`,
    'utf8',
  );
  try {
    const { result, lines } = await captureLogsAsync(() =>
      main(['feeds', 'list', '--feeds', feedsPath]),
    );
    assert.equal(result, 0);
    const text = lines.join('\n');
    assert.ok(text.includes('2'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('feeds 서브커맨드는 --config 를 피드 목록 경로로 쓰지 않는다', async () => {
  // --config 는 파이프라인 설정 경로다. 피드 목록은 --feeds 로만 지정한다.
  const dir = mkdtempSync(join(tmpdir(), 'rss-wiki-cli-test-'));
  const configPath = join(dir, 'rss-wiki.yaml');
  writeFileSync(configPath, `collect:\n  backfill_limit: 5\n`, 'utf8');
  try {
    const { result, lines } = await captureLogsAsync(() =>
      main(['feeds', 'list', '--config', configPath, '--feeds', join(dir, 'none.yaml')]),
    );
    assert.equal(result, 0);
    assert.ok(lines.join('\n').includes('0'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
