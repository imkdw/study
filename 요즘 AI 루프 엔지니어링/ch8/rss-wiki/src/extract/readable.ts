/**
 * 의존성 없이 직접 구현한 Readability 계열 본문 추출기.
 * extract 스테이지와 RSS content 정리에 공용으로 쓰인다.
 */

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const BAD_ATTR_RE = /nav|footer|header|aside|comment|sidebar|menu|ad/i;

interface Block {
  tag: string;
  attrs: string;
  html: string;
}

/** script/style/noscript/svg 태그(내용 포함)와 HTML 주석을 제거한다. */
function sanitize(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}

/**
 * 스택 기반으로 HTML 태그를 훑으며 `tags` 목록에 속한 요소들의 (attrs, innerHTML) 을 모은다.
 * 완전한 파서는 아니지만 중첩 구조는 스택으로 정확히 추적한다.
 */
function extractBlocks(html: string, tags: string[]): Block[] {
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\/?>/g;
  const wanted = new Set(tags);
  const stack: { tag: string; attrs: string; contentStart: number }[] = [];
  const blocks: Block[] = [];

  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const whole = m[0];
    const tagName = m[1].toLowerCase();
    const isClosing = whole.startsWith('</');
    const isSelfClosing = whole.endsWith('/>') || VOID_TAGS.has(tagName);

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) {
          const item = stack[i];
          const inner = html.slice(item.contentStart, m.index);
          stack.length = i;
          if (wanted.has(tagName)) {
            blocks.push({ tag: tagName, attrs: item.attrs, html: inner });
          }
          break;
        }
      }
    } else if (!isSelfClosing) {
      stack.push({ tag: tagName, attrs: m[2] ?? '', contentStart: tagRe.lastIndex });
    }
  }

  return blocks;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/** 태그 제거 -> 엔티티 디코드 -> 공백/개행 정리. */
export function htmlToText(html: string): string {
  const noTags = html.replace(/<[^>]+>/g, ' ');
  const decoded = decodeEntities(noTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

function scoreBlock(b: Block): number {
  const text = htmlToText(b.html);
  const pCount = (b.html.match(/<p[\s>]/gi) ?? []).length;
  let score = text.length + pCount * 25;
  if (BAD_ATTR_RE.test(b.attrs)) score -= 1000;
  return score;
}

/**
 * HTML 에서 본문을 추출한다.
 * 1. script/style/noscript/svg, 주석 제거
 * 2. article/main/role=main 우선
 * 3. 없으면 div/section/p 를 점수화해서 최고 점수 블록 선택
 * 4. 태그 제거 -> 엔티티 디코드 -> 공백 정리
 * 5. maxChars 초과 시 절삭
 */
export function extractReadable(html: string, maxChars: number): string {
  const cleaned = sanitize(html);
  const blocks = extractBlocks(cleaned, ['article', 'main', 'div', 'section', 'p']);

  const priority =
    blocks.find((b) => b.tag === 'article' || b.tag === 'main') ??
    blocks.find((b) => /role\s*=\s*["']main["']/i.test(b.attrs));

  let chosenHtml: string;
  if (priority) {
    chosenHtml = priority.html;
  } else {
    const candidates = blocks.filter((b) => b.tag === 'div' || b.tag === 'section' || b.tag === 'p');
    if (candidates.length === 0) {
      chosenHtml = cleaned;
    } else {
      let best = candidates[0];
      let bestScore = scoreBlock(best);
      for (const c of candidates.slice(1)) {
        const s = scoreBlock(c);
        if (s > bestScore) {
          best = c;
          bestScore = s;
        }
      }
      chosenHtml = best.html;
    }
  }

  const text = htmlToText(chosenHtml);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}
