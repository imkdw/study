/** 위키 마크다운 -> HTML 렌더. 위키링크 [[slug]] 를 지원하고 LLM 산출물 방어를 위해 script 를 제거한다. */
import { marked } from 'marked';

export interface RenderMarkdownOptions {
  /** 주어진 슬러그의 페이지가 실제로 존재하는지. 없으면 wikilink 에 missing 클래스가 붙는다. */
  slugExists?: (slug: string) => boolean;
}

const WIKILINK_RE = /\[\[([^[\]|]+)\]\]/g;
const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** [[slug]] 위키링크를 <a href="slug.html" class="wikilink[ missing]"> 앵커로 사전 치환한다. */
function replaceWikilinks(md: string, slugExists?: (slug: string) => boolean): string {
  return md.replace(WIKILINK_RE, (_match, rawSlug: string) => {
    const slug = rawSlug.trim();
    const exists = slugExists ? slugExists(slug) : true;
    const cls = exists ? 'wikilink' : 'wikilink missing';
    return `<a href="${escapeHtml(slug)}.html" class="${cls}">${escapeHtml(slug)}</a>`;
  });
}

export function renderMarkdown(md: string, opts: RenderMarkdownOptions = {}): string {
  const withLinks = replaceWikilinks(md, opts.slugExists);
  const html = marked.parse(withLinks, { async: false });
  // LLM 이 만든 마크다운에 스크립트가 섞여 나올 수 있으므로 방어적으로 제거한다.
  return html.replace(SCRIPT_TAG_RE, '');
}

/** 첫 '# ' 헤딩을 제목으로 추출한다. 없으면 빈 문자열. */
export function extractTitle(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}
