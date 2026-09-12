/**
 * PRD 5.5 절의 주제 페이지 레이아웃을 렌더링한다.
 * 이 파일은 순수 함수만 담는다 (DB / fs 접근 없음). DB 조립은 src/compose/index.ts 쪽 책임.
 */
import { join } from 'node:path';
import type { PageData, TimelineItem } from '../types.ts';

const EMPTY = '_아직 없음_';

export interface ArchiveLink {
  year: string;
  path: string;
}

function sourcesToMd(sources: { name: string; url: string }[]): string {
  return sources.map((s) => `[${s.name}](${s.url})`).join(' ');
}

/** 줄 목록을 불릿으로 렌더링한다. 비어 있으면 "_아직 없음_" 한 줄을 넣는다 (파서/멱등성 안정용). */
function bulletsOrEmpty(lines: string[]): string {
  if (lines.length === 0) return `- ${EMPTY}`;
  return lines.map((l) => `- ${l}`).join('\n');
}

function timelineLine(item: TimelineItem): string {
  return `${item.date} / ${item.title} / ${item.one_liner} ${sourcesToMd(item.sources)}`.trimEnd();
}

export function renderPage(p: PageData, opts?: { archiveLinks?: ArchiveLink[] }): string {
  const header = `# ${p.name}`;
  const meta = `> 마지막 갱신: ${p.updatedAt} / 누적 항목 ${p.itemCount}개 / 구독 피드 ${p.feedCount}개`;

  const weekSection = [`## 이번 주 (${p.weekRange})`, bulletsOrEmpty(p.weekHighlights)].join('\n');

  const narrativeBody = p.narrative && p.narrative.trim() ? p.narrative.trim() : EMPTY;
  const narrativeSection = ['## 지금까지의 흐름', narrativeBody].join('\n');

  const timelineLines = p.timeline.map(timelineLine);
  const archiveLines = (opts?.archiveLinks ?? [])
    .slice()
    .sort((a, b) => b.year.localeCompare(a.year))
    .map((l) => `이전 항목: [${l.year}년 아카이브](${l.path})`);
  const timelineSection = [
    '## 타임라인',
    bulletsOrEmpty([...timelineLines, ...archiveLines]),
  ].join('\n');

  const relatedBody =
    p.related.length > 0 ? `- ${p.related.map((s) => `[[${s}]]`).join(' / ')}` : `- ${EMPTY}`;
  const relatedSection = ['## 관련 주제', relatedBody].join('\n');

  const sourcesSection = ['## 출처', bulletsOrEmpty(p.sources)].join('\n');

  return [
    header,
    '',
    meta,
    '',
    weekSection,
    '',
    narrativeSection,
    '',
    timelineSection,
    '',
    relatedSection,
    '',
    sourcesSection,
    '',
  ].join('\n');
}

/** 기존 파일에서 "지금까지의 흐름" 본문만 복구한다. 증분 갱신 시 narrative 보존용. */
export function parsePage(md: string): Partial<PageData> {
  const marker = '## 지금까지의 흐름';
  const idx = md.indexOf(marker);
  if (idx === -1) return {};

  const rest = md.slice(idx + marker.length);
  const nextHeadingIdx = rest.indexOf('\n## ');
  const body = (nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx)).trim();

  if (!body || body === EMPTY) return { narrative: '' };
  return { narrative: body };
}

export interface IndexPageEntry {
  slug: string;
  name: string;
  itemCount: number;
  updatedAt: string;
  highlights: string[];
}

export function renderIndex(pages: IndexPageEntry[], updatedAt: string): string {
  const sorted = pages.slice().sort((a, b) => a.slug.localeCompare(b.slug));

  const header = '# RSS 위키';
  const meta = `> 마지막 갱신: ${updatedAt}`;

  const listLines = sorted.map(
    (p) => `[${p.name}](${p.slug}.md) / 누적 ${p.itemCount}개 / 갱신 ${p.updatedAt}`,
  );
  const listSection = ['## 주제 목록', bulletsOrEmpty(listLines)].join('\n');

  const highlightBlocks =
    sorted.length > 0
      ? sorted.map((p) => [`### ${p.name}`, bulletsOrEmpty(p.highlights)].join('\n'))
      : [`- ${EMPTY}`];
  const highlightSection = ['## 이번 주 하이라이트', ...highlightBlocks].join('\n\n');

  return [header, '', meta, '', listSection, '', highlightSection, ''].join('\n');
}

export function renderArchive(
  slug: string,
  name: string,
  year: string,
  items: TimelineItem[],
): string {
  const header = `# ${name} - ${year}년 아카이브`;
  const backLink = `[${slug}.md 로 돌아가기](../${slug}.md)`;
  const timelineSection = ['## 타임라인', bulletsOrEmpty(items.map(timelineLine))].join('\n');

  return [header, '', backLink, '', timelineSection, ''].join('\n');
}

export function slugToPath(wikiDir: string, slug: string): string {
  return join(wikiDir, `${slug}.md`);
}
