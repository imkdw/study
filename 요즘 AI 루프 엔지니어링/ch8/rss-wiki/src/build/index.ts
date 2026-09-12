/** 정적 사이트 빌드. docs/wiki/*.md (+ archive/*.md) -> dist/*.html */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { StageCtx } from '../stage.ts';
import { ctxNow, throwIfCancelled } from '../stage.ts';
import { extractTitle, renderMarkdown } from './markdown.ts';
import { CLIENT_JS, CSS } from './theme.ts';
import { reindexFts } from '../search/fts.ts';
import { buildSearchIndex } from '../search/index.ts';

export interface BuildOptions {
  mode?: 'static' | 'local';
}

export interface BuildResult {
  pages: number;
  indexBytes: number;
  reduced: boolean;
}

interface TopicMeta {
  slug: string;
  title: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** wikilink 앵커(class="wikilink[ missing]")의 href 에만 상대 경로 접두사를 붙인다. */
function rebaseWikilinkHrefs(html: string, prefix: string): string {
  if (!prefix) return html;
  return html.replace(
    /(<a href=")([^"]+\.html)(" class="wikilink(?: missing)?")/g,
    (_m, pre: string, href: string, post: string) => `${pre}${prefix}${href}${post}`,
  );
}

function listMdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();
}

function pageTemplate(params: {
  title: string;
  bodyHtml: string;
  topics: TopicMeta[];
  currentSlug: string | null;
  mode: 'static' | 'local';
  updatedAt: string;
  assetPrefix: string;
}): string {
  const { title, bodyHtml, topics, currentSlug, mode, updatedAt, assetPrefix } = params;

  const collectBtn =
    mode === 'local'
      ? `<button id="collect-btn" type="button">수집하기</button>\n<div id="collect-progress"></div>`
      : '';

  const topicItems = topics
    .map((t) => {
      const cls = t.slug === currentSlug ? ' class="active"' : '';
      return `<li><a href="${assetPrefix}${t.slug}.html"${cls}>${escapeHtml(t.title)}</a></li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - RSS Wiki</title>
<script>window.__RSS_WIKI_MODE__ = "${mode}"; window.__RSS_WIKI_ASSET_PREFIX__ = "${assetPrefix}";</script>
<link rel="stylesheet" href="${assetPrefix}styles.css">
</head>
<body>
<div class="layout">
<aside class="sidebar">
${collectBtn}
<button id="theme-toggle" type="button">테마 전환</button>
<div id="search-box">
<input id="search-input" type="search" placeholder="검색어를 입력하세요">
<div id="search-results"></div>
</div>
<h2>주제</h2>
<ul>
${topicItems}
</ul>
</aside>
<main>
${bodyHtml}
<div class="updated-at">마지막 갱신: ${escapeHtml(updatedAt)}</div>
</main>
</div>
<script src="${assetPrefix}app.js"></script>
</body>
</html>
`;
}

export async function build(ctx: StageCtx, opts: BuildOptions = {}): Promise<BuildResult> {
  const { db, cfg } = ctx;
  const mode: 'static' | 'local' = opts.mode ?? 'static';
  const wikiDir = cfg.compose.wiki_dir;
  const outDir = cfg.build.out_dir;
  const archiveDir = join(wikiDir, 'archive');

  mkdirSync(outDir, { recursive: true });

  const allTopLevel = listMdFiles(wikiDir);
  const hasIndexMd = allTopLevel.includes('index.md');
  const topicFiles = allTopLevel.filter((f) => f !== 'index.md');
  const archiveFiles = listMdFiles(archiveDir);

  const topicSlugs = new Set(topicFiles.map((f) => basename(f, '.md')));
  const slugExists = (slug: string): boolean => topicSlugs.has(slug);

  const updatedAt = ctxNow(ctx).toISOString();

  // 사이드바용 주제 메타(슬러그 + 제목)를 먼저 뽑아둔다.
  const topics: TopicMeta[] = topicFiles.map((file) => {
    const raw = readFileSync(join(wikiDir, file), 'utf8');
    const slug = basename(file, '.md');
    return { slug, title: extractTitle(raw) || slug };
  });
  topics.sort((a, b) => a.title.localeCompare(b.title, 'ko'));

  const total = topicFiles.length + archiveFiles.length + 1; // +1 = index.html
  let done = 0;

  // ---------- 주제 페이지 ----------
  for (const file of topicFiles) {
    throwIfCancelled(ctx);
    const raw = readFileSync(join(wikiDir, file), 'utf8');
    const slug = basename(file, '.md');
    const title = extractTitle(raw) || slug;
    const bodyHtml = renderMarkdown(raw, { slugExists });
    const html = pageTemplate({
      title,
      bodyHtml,
      topics,
      currentSlug: slug,
      mode,
      updatedAt,
      assetPrefix: '',
    });
    writeFileSync(join(outDir, `${slug}.html`), html, 'utf8');
    done++;
    ctx.onProgress?.('build', done, total);
  }

  // ---------- 아카이브 페이지 ----------
  if (archiveFiles.length > 0) {
    mkdirSync(join(outDir, 'archive'), { recursive: true });
    for (const file of archiveFiles) {
      throwIfCancelled(ctx);
      const raw = readFileSync(join(archiveDir, file), 'utf8');
      const slug = basename(file, '.md');
      const title = extractTitle(raw) || slug;
      let bodyHtml = renderMarkdown(raw, { slugExists });
      bodyHtml = rebaseWikilinkHrefs(bodyHtml, '../');
      const html = pageTemplate({
        title,
        bodyHtml,
        topics,
        currentSlug: null,
        mode,
        updatedAt,
        assetPrefix: '../',
      });
      writeFileSync(join(outDir, 'archive', `${slug}.html`), html, 'utf8');
      done++;
      ctx.onProgress?.('build', done, total);
    }
  }

  // ---------- 인덱스 페이지 ----------
  throwIfCancelled(ctx);
  let indexTitle = 'RSS Wiki';
  let indexBody: string;
  if (hasIndexMd) {
    const raw = readFileSync(join(wikiDir, 'index.md'), 'utf8');
    indexTitle = extractTitle(raw) || indexTitle;
    indexBody = renderMarkdown(raw, { slugExists });
  } else {
    const items = topics
      .map((t) => `<li><a href="${t.slug}.html">${escapeHtml(t.title)}</a></li>`)
      .join('\n');
    indexBody = `<h1>주제 목록</h1>\n<ul>\n${items}\n</ul>`;
  }
  const indexHtml = pageTemplate({
    title: indexTitle,
    bodyHtml: indexBody,
    topics,
    currentSlug: null,
    mode,
    updatedAt,
    assetPrefix: '',
  });
  writeFileSync(join(outDir, 'index.html'), indexHtml, 'utf8');
  done++;
  ctx.onProgress?.('build', done, total);

  // ---------- 정적 자산 ----------
  writeFileSync(join(outDir, 'styles.css'), CSS, 'utf8');
  writeFileSync(join(outDir, 'app.js'), CLIENT_JS, 'utf8');

  // ---------- 검색 인덱스 ----------
  reindexFts(db);
  const { json, reduced } = buildSearchIndex(db, { maxBytes: cfg.build.search_index_max_bytes });
  writeFileSync(join(outDir, 'search-index.json'), json, 'utf8');

  return { pages: total, indexBytes: Buffer.byteLength(json, 'utf8'), reduced };
}
