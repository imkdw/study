import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db/index.ts';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { createLogger } from '../src/util/log.ts';
import type { AppConfig } from '../src/types.ts';
import type { StageCtx } from '../src/stage.ts';
import { build } from '../src/build/index.ts';
import { CSS } from '../src/build/theme.ts';

function makeCfg(dir: string): AppConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  cfg.compose.wiki_dir = join(dir, 'wiki');
  cfg.build.out_dir = join(dir, 'dist');
  return cfg;
}

function ctxFor(cfg: AppConfig): StageCtx {
  const db = openDb(':memory:');
  return { db, cfg, runId: null, log: createLogger('빌드테스트') };
}

function workDir(): string {
  return mkdtempSync(join(tmpdir(), 'rss-wiki-build-'));
}

test('위키 md 2개로 dist 산출물(html/css/js/search-index)이 모두 생긴다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(
    join(cfg.compose.wiki_dir, 'llm.md'),
    '# LLM\n\nLLM 관련 글 모음이다.',
    'utf8',
  );
  writeFileSync(
    join(cfg.compose.wiki_dir, 'infra.md'),
    '# 인프라\n\n인프라 관련 글 모음이다. [[llm]] 참고.',
    'utf8',
  );

  const ctx = ctxFor(cfg);
  const result = await build(ctx);

  assert.ok(existsSync(join(cfg.build.out_dir, 'llm.html')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'infra.html')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'index.html')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'styles.css')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'app.js')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'search-index.json')));
  assert.ok(result.pages >= 3);
});

test('[[slug]] 위키링크가 <a href="slug.html"> 로 변환된다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(join(cfg.compose.wiki_dir, 'llm.md'), '# LLM\n\nLLM 글.', 'utf8');
  writeFileSync(
    join(cfg.compose.wiki_dir, 'infra.md'),
    '# 인프라\n\n[[llm]] 문서를 참고하라.',
    'utf8',
  );

  const ctx = ctxFor(cfg);
  await build(ctx);

  const html = readFileSync(join(cfg.build.out_dir, 'infra.html'), 'utf8');
  assert.match(html, /<a href="llm\.html" class="wikilink">llm<\/a>/);
});

test('mode: static 이면 수집 버튼이 없고, mode: local 이면 있다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(join(cfg.compose.wiki_dir, 'llm.md'), '# LLM\n\n본문.', 'utf8');

  const staticCtx = ctxFor(cfg);
  await build(staticCtx, { mode: 'static' });
  const staticHtml = readFileSync(join(cfg.build.out_dir, 'llm.html'), 'utf8');
  assert.doesNotMatch(staticHtml, /id="collect-btn"/);

  const localCtx = ctxFor(cfg);
  await build(localCtx, { mode: 'local' });
  const localHtml = readFileSync(join(cfg.build.out_dir, 'llm.html'), 'utf8');
  assert.match(localHtml, /id="collect-btn"/);
});

test('window.__RSS_WIKI_MODE__ 가 주입된다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(join(cfg.compose.wiki_dir, 'llm.md'), '# LLM\n\n본문.', 'utf8');

  const ctx = ctxFor(cfg);
  await build(ctx, { mode: 'local' });
  const html = readFileSync(join(cfg.build.out_dir, 'llm.html'), 'utf8');
  assert.match(html, /window\.__RSS_WIKI_MODE__\s*=\s*"local"/);
});

test('마크다운의 <script> 태그가 제거된다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(
    join(cfg.compose.wiki_dir, 'llm.md'),
    '# LLM\n\n본문입니다.\n\n<script>alert(1)</script>\n\n끝.',
    'utf8',
  );

  const ctx = ctxFor(cfg);
  await build(ctx);
  const html = readFileSync(join(cfg.build.out_dir, 'llm.html'), 'utf8');
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('index.md 가 없으면 주제 목록만으로 index.html 을 생성한다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  mkdirSync(cfg.compose.wiki_dir, { recursive: true });
  writeFileSync(join(cfg.compose.wiki_dir, 'llm.md'), '# LLM\n\n본문.', 'utf8');
  writeFileSync(join(cfg.compose.wiki_dir, 'infra.md'), '# 인프라\n\n본문.', 'utf8');

  const ctx = ctxFor(cfg);
  await build(ctx);
  const html = readFileSync(join(cfg.build.out_dir, 'index.html'), 'utf8');
  assert.match(html, /href="llm\.html"/);
  assert.match(html, /href="infra\.html"/);
});

test('위키 md 가 하나도 없으면 빈 사이트를 만든다', async () => {
  const dir = workDir();
  const cfg = makeCfg(dir);
  // wiki_dir 자체를 만들지 않는다

  const ctx = ctxFor(cfg);
  const result = await build(ctx);
  assert.ok(existsSync(join(cfg.build.out_dir, 'index.html')));
  assert.ok(existsSync(join(cfg.build.out_dir, 'search-index.json')));
  assert.equal(result.pages, 1);
});

test('CSS 에 다크모드와 400px 반응형 미디어 쿼리가 있다', () => {
  assert.match(CSS, /prefers-color-scheme:\s*dark/);
  assert.match(CSS, /max-width:\s*400px/);
  assert.match(CSS, /\[data-theme=['"]dark['"]\]/);
});
