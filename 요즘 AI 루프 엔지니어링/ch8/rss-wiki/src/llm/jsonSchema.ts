/** LLM 응답 텍스트에서 JSON 블록을 추출하고 EnrichResult 스키마를 검증한다. */
import type { EnrichResult } from '../types.ts';

/** 문자열 s 안에서 첫 `{` 부터 시작하는 균형 잡힌 객체 리터럴을 찾는다. */
function findBalancedObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * ```json 펜스, 일반 ``` 펜스, 앞뒤 잡설을 건너뛰고 첫 번째 균형 잡힌 `{...}` 를 파싱한다.
 * 실패하면 throw 한다.
 */
export function extractJsonBlock(text: string): unknown {
  const jsonFence = text.match(/```json\s*([\s\S]*?)```/i);
  const plainFence = text.match(/```\s*([\s\S]*?)```/);
  const candidates = [jsonFence?.[1], plainFence?.[1], text].filter(
    (v): v is string => typeof v === 'string',
  );

  for (const candidate of candidates) {
    const block = findBalancedObject(candidate);
    if (block === null) continue;
    return JSON.parse(block);
  }

  throw new Error('응답에서 JSON 블록을 찾을 수 없습니다');
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map(String);
  if (v === undefined || v === null) return [];
  return [String(v)];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** EnrichResult 필드 검증 + 보정. 필수 필드가 비어 있으면 throw. */
export function validateEnrichResult(v: unknown, seeds: string[]): EnrichResult {
  if (typeof v !== 'object' || v === null) {
    throw new Error('EnrichResult 형식이 아닙니다 (object 아님)');
  }
  const obj = v as Record<string, unknown>;

  const summary_ko = typeof obj.summary_ko === 'string' ? obj.summary_ko.trim() : '';
  if (!summary_ko) throw new Error('summary_ko 가 비어 있습니다');

  let one_liner_ko = typeof obj.one_liner_ko === 'string' ? obj.one_liner_ko.trim() : '';
  if (!one_liner_ko) throw new Error('one_liner_ko 가 비어 있습니다');
  if (one_liner_ko.length > 80) one_liner_ko = one_liner_ko.slice(0, 80);

  const rawConfidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? obj.confidence : 0;
  const confidence = clamp01(rawConfidence);

  const key_points = toStringArray(obj.key_points).slice(0, 3);
  const entities = toStringArray(obj.entities);

  const category = typeof obj.category === 'string' ? obj.category.trim().toLowerCase() : '';

  const normalizedSeeds = seeds.map((s) => s.trim().toLowerCase());
  let is_new_category = Boolean(obj.is_new_category);
  if (!normalizedSeeds.includes(category)) is_new_category = true;

  return { summary_ko, one_liner_ko, category, is_new_category, confidence, key_points, entities };
}

/** 페이지 재작성 응답 */
export interface RewriteResult {
  narrative: string;
  related: string[];
  week_highlights: string[];
}

/** RewriteResult 필드 검증 + 보정. narrative 가 비어 있으면 throw (빈 페이지 덮어쓰기 방지). */
export function validateRewriteResult(v: unknown): RewriteResult {
  if (typeof v !== 'object' || v === null) {
    throw new Error('RewriteResult 형식이 아닙니다 (object 아님)');
  }
  const obj = v as Record<string, unknown>;

  const narrative = typeof obj.narrative === 'string' ? obj.narrative.trim() : '';
  if (!narrative) throw new Error('narrative 가 비어 있습니다');

  const related = toStringArray(obj.related)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const week_highlights = toStringArray(obj.week_highlights)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  return { narrative, related, week_highlights };
}

export interface RetryOptions {
  retries: number;
  onRetry?: (attempt: number, err: unknown) => void;
}

/** 실패 시 최대 opts.retries 회 재시도하는 범용 헬퍼. */
export async function callWithRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      opts.onRetry?.(attempt + 1, err);
    }
  }
  throw lastErr;
}
