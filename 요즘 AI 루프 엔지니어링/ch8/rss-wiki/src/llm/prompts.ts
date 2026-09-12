/** LLM 프롬프트 빌더. 고정 프리픽스(시드 카테고리 + 스키마 + 스타일 가이드)를 앞에 두어 캐시가 걸리게 한다. */

/** 프리픽스 내용이 바뀌면 올려서 캐시를 무효화한다. */
export const SEED_PREFIX_VERSION = 1;

function summarizePrefix(seeds: string[]): string {
  return [
    `<!-- summarize-prefix-v${SEED_PREFIX_VERSION} -->`,
    '너는 RSS 글을 한국어로 요약하고 분류하는 어시스턴트다.',
    '',
    `시드 카테고리 목록: ${seeds.join(', ')}`,
    '',
    '규칙:',
    '- summary_ko 는 반드시 한국어 3~5문장으로 작성한다.',
    '- one_liner_ko 는 타임라인에 쓸 한국어 한 줄 요약이며 80자 이내여야 한다.',
    '- 글의 원문 제목과 링크는 번역하지 말고 원문 그대로 유지한다.',
    '- category 는 위 시드 카테고리 중 하나를 우선 사용한다. 어디에도 맞지 않으면 새 카테고리 이름을 제안하고 is_new_category 를 true 로 한다.',
    '- confidence 는 0에서 1 사이의 숫자로 분류 확신도를 나타낸다.',
    '- key_points 는 핵심 포인트 3개 이내, entities 는 등장하는 제품/기업/기술 이름 배열이다.',
    '',
    '반드시 아래 JSON 스키마와 같은 형식의 JSON 객체 하나만 출력하라. 설명, 인사말, 코드 펜스 밖의 텍스트를 절대 추가하지 마라.',
    '```json',
    JSON.stringify(
      {
        summary_ko: 'string',
        one_liner_ko: 'string',
        category: 'string',
        is_new_category: false,
        confidence: 0.0,
        key_points: ['string'],
        entities: ['string'],
      },
      null,
      2,
    ),
    '```',
  ].join('\n');
}

export function summarizePrompt(input: {
  title: string;
  url: string;
  feedName: string;
  content: string;
  seeds: string[];
  language: string;
}): string {
  const prefix = summarizePrefix(input.seeds);
  const body = [
    '## 처리할 글',
    `제목: ${input.title}`,
    `출처: ${input.feedName}`,
    `링크: ${input.url}`,
    '',
    '본문:',
    input.content,
  ].join('\n');
  return `${prefix}\n\n${body}`;
}

function rewritePrefix(seeds: string[]): string {
  return [
    `<!-- rewrite-prefix-v${SEED_PREFIX_VERSION} -->`,
    '너는 누적 위키 주제 페이지의 "지금까지의 흐름"을 다시 쓰는 어시스턴트다.',
    '',
    `관련 카테고리 후보: ${seeds.join(', ')}`,
    '',
    '규칙:',
    '- 한국어 서술형 문장으로 작성하고, 기존 흐름과 최근 타임라인 내용을 중복 없이 하나로 병합한다.',
    '- 관련 있는 다른 주제의 슬러그를 related 배열로 제안한다.',
    '- 이번 주 눈에 띄는 항목을 week_highlights 배열로 뽑는다.',
    '',
    '반드시 아래 JSON 스키마와 같은 형식의 JSON 객체 하나만 출력하라. 설명, 인사말, 코드 펜스 밖의 텍스트를 절대 추가하지 마라.',
    '```json',
    JSON.stringify({ narrative: 'string', related: ['string'], week_highlights: ['string'] }, null, 2),
    '```',
  ].join('\n');
}

export function rewritePagePrompt(input: {
  name: string;
  slug: string;
  narrative: string;
  timelineMarkdown: string;
  seeds: string[];
}): string {
  const prefix = rewritePrefix(input.seeds);
  const body = [
    `## 주제: ${input.name} (${input.slug})`,
    '',
    '### 기존 "지금까지의 흐름"',
    input.narrative || '(아직 없음)',
    '',
    '### 최근 타임라인',
    input.timelineMarkdown,
  ].join('\n');
  return `${prefix}\n\n${body}`;
}
