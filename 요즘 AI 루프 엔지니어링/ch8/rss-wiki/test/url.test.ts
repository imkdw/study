import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, urlHash } from '../src/util/url.ts';
import { normalizeTitle, similarity, clusterTitles } from '../src/util/similarity.ts';

const STRIP = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ref'];

test('utm/fbclid/ref 쿼리를 제거한다', () => {
  const out = normalizeUrl(
    'https://Example.com/post?utm_source=x&fbclid=y&ref=z&id=1',
    STRIP,
  );
  assert.equal(out, 'https://example.com/post?id=1');
});

test('프래그먼트를 제거한다', () => {
  const out = normalizeUrl('https://example.com/post#section-2', STRIP);
  assert.equal(out, 'https://example.com/post');
});

test('트레일링 슬래시를 제거한다 (루트 경로는 빈 경로로)', () => {
  assert.equal(normalizeUrl('https://example.com/post/', STRIP), 'https://example.com/post');
  assert.equal(normalizeUrl('https://example.com/', STRIP), 'https://example.com');
});

test('스킴/호스트를 소문자화한다', () => {
  const out = normalizeUrl('HTTPS://EXAMPLE.COM/Post', STRIP);
  assert.equal(out, 'https://example.com/Post');
});

test('www 는 그대로 유지한다', () => {
  const out = normalizeUrl('https://www.example.com/post', STRIP);
  assert.equal(out, 'https://www.example.com/post');
});

test('남은 쿼리는 키 기준으로 정렬한다', () => {
  const out = normalizeUrl('https://example.com/post?b=2&a=1&c=3', STRIP);
  assert.equal(out, 'https://example.com/post?a=1&b=2&c=3');
});

test('기본 포트(80/443)를 제거한다', () => {
  assert.equal(normalizeUrl('https://example.com:443/post', STRIP), 'https://example.com/post');
  assert.equal(normalizeUrl('http://example.com:80/post', STRIP), 'http://example.com/post');
  assert.equal(
    normalizeUrl('https://example.com:8443/post', STRIP),
    'https://example.com:8443/post',
  );
});

test('파싱 실패 시 입력을 trim 해서 그대로 반환한다', () => {
  assert.equal(normalizeUrl('   not a url   ', STRIP), 'not a url');
});

test('urlHash 는 sha256 hex 를 반환하고 동일 입력에 동일 값이다', () => {
  const h1 = urlHash('https://example.com/post');
  const h2 = urlHash('https://example.com/post');
  const h3 = urlHash('https://example.com/other');
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('normalizeTitle: 소문자화 + 기호/문장부호 제거 + 공백 정리', () => {
  assert.equal(normalizeTitle('  Hello,  World!!  '), 'hello world');
  assert.equal(normalizeTitle('GPT-5 출시!'), 'gpt5 출시');
});

test('similarity: 동일 제목이면 1', () => {
  assert.equal(similarity('vLLM 0.9 출시', 'vLLM 0.9 출시'), 1);
});

test('similarity: 완전히 다른 제목이면 0.3 미만', () => {
  const s = similarity('오늘의 날씨는 맑음', 'GPU 가격이 폭등했다');
  assert.ok(s < 0.3, `expected < 0.3, got ${s}`);
});

test('similarity: 미세한 차이는 0.85 초과', () => {
  const s = similarity('vLLM 0.9.1 릴리스 안내', 'vLLM 0.9.1 릴리스 안내!!');
  assert.ok(s > 0.85, `expected > 0.85, got ${s}`);
});

test('clusterTitles: 유사한 제목끼리 묶고 다른 제목은 분리한다', () => {
  const items = [
    { title: 'vLLM 0.9 출시' },
    { title: 'vLLM 0.9 출시!' },
    { title: '오늘의 날씨는 맑음' },
    { title: 'vLLM 0.9  출시' },
  ];
  const clusters = clusterTitles(items, (x) => x.title, 0.85);
  assert.equal(clusters.length, 2);
  const sizes = clusters.map((c) => c.length).sort((a, b) => a - b);
  assert.deepEqual(sizes, [1, 3]);
});
