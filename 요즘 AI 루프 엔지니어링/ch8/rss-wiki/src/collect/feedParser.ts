/** RSS 2.0 / Atom / JSON Feed 파서. 세 포맷을 자동 판별해 ParsedFeed 로 정규화한다. */

import { XMLParser } from 'fast-xml-parser';
import type { ParsedFeed, ParsedItem } from '../types.ts';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** 값이 무엇이든 배열로 정규화한다 (단일 item 객체 대응). */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** 문자열이거나 {'#text': string} 형태인 값에서 텍스트만 뽑는다. */
function textOf(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') return obj['#text'];
    if (typeof obj['#text'] === 'number') return String(obj['#text']);
  }
  return null;
}

/** 파싱 가능한 날짜 문자열을 ISO 8601 로 변환한다. 실패하면 null. */
function toIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------- RSS 2.0 ----------

function normalizeRssItem(item: Record<string, unknown>): ParsedItem {
  const guidRaw = item.guid;
  const guid = textOf(guidRaw);

  const url = textOf(item.link) ?? '';

  const title = textOf(item.title) ?? '(무제)';

  const author = textOf(item['dc:creator']) ?? textOf(item.author) ?? null;

  const published_at = toIso(textOf(item.pubDate));

  const content = textOf(item['content:encoded']) ?? textOf(item.description) ?? null;
  const summary = textOf(item.description) ?? null;

  return { guid, url, title, author, published_at, content, summary };
}

function parseRss(doc: Record<string, unknown>): ParsedFeed {
  const rss = doc.rss as Record<string, unknown>;
  const channel = rss?.channel as Record<string, unknown>;
  if (!channel) throw new Error('rss parse 실패: channel 을 찾을 수 없음');
  const items = asArray<Record<string, unknown>>(
    channel.item as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const title = textOf(channel.title);
  return { title, items: items.map(normalizeRssItem) };
}

// ---------- Atom ----------

function pickAtomLink(linkRaw: unknown): string {
  const links = asArray<Record<string, unknown>>(
    linkRaw as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  if (links.length === 0) return '';
  // 문자열 하나만 있는 극단적인 경우 대비
  if (typeof linkRaw === 'string') return linkRaw;
  const alternate = links.find((l) => l['@_rel'] === 'alternate');
  const chosen = alternate ?? links[0];
  return typeof chosen?.['@_href'] === 'string' ? (chosen['@_href'] as string) : '';
}

function normalizeAtomItem(entry: Record<string, unknown>): ParsedItem {
  const guid = textOf(entry.id);
  const url = pickAtomLink(entry.link);
  const title = textOf(entry.title) ?? '(무제)';

  const authorObj = entry.author as Record<string, unknown> | undefined;
  const author = authorObj ? (textOf(authorObj.name) ?? null) : null;

  const published_at = toIso(textOf(entry.published) ?? textOf(entry.updated));

  const content = textOf(entry.content) ?? null;
  const summary = textOf(entry.summary) ?? null;

  return { guid, url, title, author, published_at, content, summary };
}

function parseAtom(doc: Record<string, unknown>): ParsedFeed {
  const feed = doc.feed as Record<string, unknown>;
  if (!feed) throw new Error('atom parse 실패: feed 를 찾을 수 없음');
  const entries = asArray<Record<string, unknown>>(
    feed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const title = textOf(feed.title);
  return { title, items: entries.map(normalizeAtomItem) };
}

// ---------- JSON Feed ----------

interface JsonFeedAuthor {
  name?: string;
}

interface JsonFeedItem {
  id?: string;
  url?: string;
  title?: string;
  authors?: JsonFeedAuthor[];
  author?: JsonFeedAuthor;
  date_published?: string;
  content_html?: string;
  content_text?: string;
  summary?: string;
}

interface JsonFeedDoc {
  version?: string;
  title?: string;
  items?: JsonFeedItem[];
}

function normalizeJsonFeedItem(item: JsonFeedItem): ParsedItem {
  const guid = item.id ?? null;
  const url = item.url ?? '';
  const title = item.title || '(무제)';
  const author = item.authors?.[0]?.name ?? item.author?.name ?? null;
  const published_at = toIso(item.date_published);
  const content = item.content_html ?? item.content_text ?? null;
  const summary = item.summary ?? null;
  return { guid, url, title, author, published_at, content, summary };
}

function parseJsonFeed(doc: JsonFeedDoc): ParsedFeed {
  const items = Array.isArray(doc.items) ? doc.items : [];
  return { title: doc.title ?? null, items: items.map(normalizeJsonFeedItem) };
}

// ---------- 공개 API ----------

export function parseFeed(body: string, contentType?: string): ParsedFeed {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('feed parse 실패: 빈 응답');

  const looksJson =
    trimmed.startsWith('{') || (contentType?.includes('json') ?? false);

  if (looksJson) {
    let doc: JsonFeedDoc;
    try {
      doc = JSON.parse(trimmed) as JsonFeedDoc;
    } catch (e) {
      throw new Error(`json feed parse 실패: ${(e as Error).message}`);
    }
    if (typeof doc.version === 'string' && doc.version.includes('jsonfeed.org')) {
      return parseJsonFeed(doc);
    }
    // version 표기가 없어도 items 배열이 있으면 JSON Feed 로 간주한다.
    if (Array.isArray(doc.items)) return parseJsonFeed(doc);
    throw new Error('feed parse 실패: json feed 형식이 아님');
  }

  let doc: Record<string, unknown>;
  try {
    doc = xmlParser.parse(trimmed) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`xml feed parse 실패: ${(e as Error).message}`);
  }

  if (doc.rss) return parseRss(doc);
  if (doc.feed) return parseAtom(doc);

  throw new Error('feed parse 실패: rss/atom/json feed 중 어느 것도 아님');
}
