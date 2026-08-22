#!/usr/bin/env node
/**
 * build-index.mjs — 통파일 모음(vault)의 표지 index.html 을 만든다.
 *
 *   node build-index.mjs [vaultDir]
 *
 * vault/.digest/<슬러그>/meta.json 을 전부 읽어 카드 그리드를 그린다.
 * meta.json 이 있어도 vault/<슬러그>.html 이 없으면 건너뛴다 (아직 안 만들어진 것).
 * vault/index-config.json 이 있으면 카테고리 분류를 거기서 읽는다.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const VAULT = resolve(process.argv[2] || "/Users/imkdw/study/__통파일 모음");
const DIGEST_ROOT = join(VAULT, ".digest");

if (!existsSync(DIGEST_ROOT)) {
  console.error(`빌드 디렉터리가 없다: ${DIGEST_ROOT}`);
  process.exit(1);
}

/* --- 카테고리 설정 (없으면 전부 "기타") ------------------------------- */
const CFG_PATH = join(VAULT, "index-config.json");
const cfg = existsSync(CFG_PATH) ? JSON.parse(readFileSync(CFG_PATH, "utf8")) : {};
const CAT = cfg.categories || {};          // { "<슬러그>": "DB", ... }
const ORDER = cfg.order || [];             // ["언어/설계", "DB", ...]
const TONES = cfg.tones || {};             // { "DB": "blue", ... }
const TONE_POOL = ["blue", "green", "purple", "yellow", "red"];

/* --- 수집 ------------------------------------------------------------- */
const rows = [];
for (const slug of readdirSync(DIGEST_ROOT).sort()) {
  const dir = join(DIGEST_ROOT, slug);
  if (!statSync(dir).isDirectory()) continue;
  const metaPath = join(dir, "meta.json");
  const outPath = join(VAULT, `${slug}.html`);
  if (!existsSync(metaPath)) continue;
  if (!existsSync(outPath)) {
    console.warn(`  skip ${slug} — ${slug}.html 이 아직 없다`);
    continue;
  }
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch (e) {
    console.warn(`  skip ${slug} — meta.json 파싱 실패: ${e.message}`);
    continue;
  }
  const chapters = meta.chapters || [];
  rows.push({
    slug,
    file: `${slug}.html`,
    title: meta.title || slug,
    subtitle: meta.subtitle || "",
    mark: meta.mark || slug.slice(0, 2).toUpperCase(),
    description: meta.description || "",
    chapters: chapters.map((c) => c.navTitle || c.title || ""),
    items: chapters.reduce((n, c) => n + (c.items || []).length, 0),
    size: statSync(outPath).size,
    cat: CAT[slug] || CAT[meta.title] || "기타",
  });
}

if (!rows.length) {
  console.error("표지에 실을 자료가 하나도 없다.");
  process.exit(1);
}

/* --- 정렬: 설정된 카테고리 순 → 아이템 많은 순 -------------------------- */
const catRank = (c) => {
  const i = ORDER.indexOf(c);
  return i === -1 ? 900 : i;
};
rows.sort((a, b) => catRank(a.cat) - catRank(b.cat) || b.items - a.items);

const cats = [...new Set(rows.map((r) => r.cat))];
const toneOf = (c) => TONES[c] || TONE_POOL[cats.indexOf(c) % TONE_POOL.length];

const totalItems = rows.reduce((n, r) => n + r.items, 0);
const totalCh = rows.reduce((n, r) => n + r.chapters.length, 0);
const totalMb = rows.reduce((n, r) => n + r.size, 0) / 1024 / 1024;
const today = new Date().toISOString().slice(0, 10);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const cards = rows
  .map((r) => {
    const hay = [r.title, r.subtitle, r.description, r.cat, ...r.chapters].join(" ").toLowerCase();
    const chips = r.chapters.map((c) => `<li>${esc(c)}</li>`).join("");
    return `      <a class="card t-${toneOf(r.cat)}" href="./${encodeURI(r.file)}" data-cat="${esc(r.cat)}" data-search="${esc(hay)}">
        <div class="card-top"><span class="mark">${esc(r.mark)}</span><span class="cat">${esc(r.cat)}</span></div>
        <h3 class="card-title">${esc(r.title)}</h3>
        <p class="card-sub">${esc(r.subtitle)}</p>
        <p class="card-desc">${esc(r.description)}</p>
        <ul class="chap">${chips}</ul>
        <div class="card-foot">
          <span class="metric"><b>${r.chapters.length}</b>챕터</span>
          <span class="dot"></span>
          <span class="metric"><b>${r.items}</b>아이템</span>
          <span class="grow"></span>
          <span class="go">열기<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 5l7-7 7 7"/></svg></span>
        </div>
      </a>`;
  })
  .join("\n");

const filterChips = cats
  .map((c) => `      <button class="chip" type="button" data-filter="${esc(c)}">${esc(c)}</button>`)
  .join("\n");

const doc = `<!doctype html>
<html lang="ko" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>스터디 통파일 모음</title>
<meta name="description" content="study-digest 로 만든 학습자료 ${rows.length}권 한곳에 모아보기">
<meta name="color-scheme" content="light dark">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
<style>
:root {
  --grey-50:#F9FAFB; --grey-100:#F2F4F6; --grey-200:#E5E8EB; --grey-300:#D1D6DB;
  --grey-400:#B0B8C1; --grey-500:#8B95A1; --grey-600:#6B7684; --grey-700:#4E5968;
  --grey-800:#333D4B; --grey-900:#191F28;
  --blue:#3182F6; --blue-weak:#E8F3FF; --red:#F04452; --red-weak:#FEF0F1;
  --green:#15C47E; --green-weak:#EAFBF3; --yellow:#F5A623; --yellow-weak:#FFF9E7;
  --purple:#7F5AF0; --purple-weak:#F1EDFE;
  --bg:#FFFFFF; --bg-sunken:var(--grey-50); --surface:#FFFFFF; --surface-alt:var(--grey-50);
  --border:var(--grey-200); --border-strong:var(--grey-300);
  --text:var(--grey-900); --text-sub:var(--grey-700); --text-muted:var(--grey-600); --text-faint:var(--grey-500);
  --accent:var(--blue); --accent-weak:var(--blue-weak);
  --shadow-sm:0 1px 2px rgba(0,0,0,.04),0 1px 3px rgba(0,0,0,.04);
  --shadow-lg:0 12px 32px rgba(0,0,0,.10);
  --r-md:12px; --r-lg:16px;
  --font-sans:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo",sans-serif;
  color-scheme:light;
}
[data-theme="dark"] {
  --bg:#16181D; --bg-sunken:#101215; --surface:#1C1F25; --surface-alt:#21242B;
  --border:#2C3038; --border-strong:#3A3F49;
  --text:#EDEFF2; --text-sub:#C3C8D0; --text-muted:#9AA1AC; --text-faint:#7C838F;
  --accent:#4E8FF7; --accent-weak:#16233A;
  --blue:#4E8FF7; --blue-weak:#16233A; --red:#FF6B77; --red-weak:#2E1A1D;
  --green:#2FD69A; --green-weak:#12271F; --yellow:#FFC44D; --yellow-weak:#2B2415;
  --purple:#9B7BFF; --purple-weak:#211B36;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4); --shadow-lg:0 12px 32px rgba(0,0,0,.45);
  color-scheme:dark;
}
*,*::before,*::after { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body { font-family:var(--font-sans); background:var(--bg-sunken); color:var(--text); -webkit-font-smoothing:antialiased; letter-spacing:-.01em; }
.wrap { max-width:1120px; margin:0 auto; padding:0 24px 96px; }
.topbar { position:sticky; top:0; z-index:20; backdrop-filter:saturate(180%) blur(12px); background:color-mix(in srgb, var(--bg) 82%, transparent); border-bottom:1px solid var(--border); }
.topbar-inner { max-width:1120px; margin:0 auto; padding:0 24px; height:56px; display:flex; align-items:center; gap:12px; }
.logo { display:flex; align-items:center; gap:10px; font-weight:700; font-size:15px; }
.logo .sq { width:26px; height:26px; border-radius:8px; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:14px; }
.spacer { flex:1; }
.icon-btn { width:34px; height:34px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text-sub); display:grid; place-items:center; cursor:pointer; transition:.15s; }
.icon-btn:hover { background:var(--surface-alt); color:var(--text); }
.hero { padding:64px 0 40px; }
.eyebrow { display:inline-flex; align-items:center; gap:7px; font-size:11.5px; font-weight:700; letter-spacing:.11em; color:var(--accent); background:var(--accent-weak); padding:6px 11px; border-radius:999px; margin-bottom:18px; }
h1 { margin:0 0 14px; font-size:clamp(30px,4.6vw,44px); font-weight:800; line-height:1.24; letter-spacing:-.035em; }
.lead { margin:0; font-size:17px; line-height:1.72; color:var(--text-sub); max-width:680px; }
.lead b { color:var(--text); font-weight:700; }
.stats { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
.stat { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:13px 18px; box-shadow:var(--shadow-sm); min-width:104px; }
.stat .v { font-size:23px; font-weight:800; letter-spacing:-.03em; line-height:1.1; }
.stat .v span { font-size:13px; font-weight:600; color:var(--text-muted); margin-left:2px; }
.stat .l { font-size:12px; color:var(--text-muted); margin-top:4px; font-weight:500; }
.controls { position:sticky; top:56px; z-index:15; padding:14px 0 16px; background:var(--bg-sunken); }
.search { display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:0 14px; height:44px; box-shadow:var(--shadow-sm); transition:.15s; }
.search:focus-within { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-weak); }
.search svg { color:var(--text-faint); flex:none; }
.search input { flex:1; border:0; background:none; outline:none; font:inherit; font-size:15px; color:var(--text); }
.search input::placeholder { color:var(--text-faint); }
.search kbd { font:inherit; font-size:11px; font-weight:600; color:var(--text-faint); border:1px solid var(--border); border-radius:6px; padding:2px 6px; }
.chips { display:flex; flex-wrap:wrap; gap:7px; margin-top:11px; }
.chip { font:inherit; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:6px 13px; transition:.15s; }
.chip:hover { color:var(--text); border-color:var(--border-strong); }
.chip.on { background:var(--text); border-color:var(--text); color:var(--bg); }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; margin-top:8px; }
.card { position:relative; display:flex; flex-direction:column; text-decoration:none; color:inherit; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:22px 22px 18px; box-shadow:var(--shadow-sm); transition:transform .16s cubic-bezier(.2,.8,.3,1), box-shadow .16s, border-color .16s; overflow:hidden; }
.card::before { content:""; position:absolute; inset:0 0 auto; height:3px; background:var(--tone); opacity:.9; }
.card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:var(--border-strong); }
.t-blue { --tone:var(--blue); --tone-weak:var(--blue-weak); }
.t-green { --tone:var(--green); --tone-weak:var(--green-weak); }
.t-purple { --tone:var(--purple); --tone-weak:var(--purple-weak); }
.t-yellow { --tone:var(--yellow); --tone-weak:var(--yellow-weak); }
.t-red { --tone:var(--red); --tone-weak:var(--red-weak); }
.card-top { display:flex; align-items:center; gap:9px; margin-bottom:14px; }
.mark { width:36px; height:36px; border-radius:11px; background:var(--tone-weak); color:var(--tone); display:grid; place-items:center; font-size:13px; font-weight:800; letter-spacing:-.02em; flex:none; }
.cat { font-size:11.5px; font-weight:700; color:var(--tone); letter-spacing:.02em; }
.card-title { margin:0 0 5px; font-size:18px; font-weight:800; letter-spacing:-.03em; line-height:1.35; }
.card-sub { margin:0 0 10px; font-size:13px; font-weight:600; color:var(--text-muted); }
.card-desc { margin:0 0 14px; font-size:13.5px; line-height:1.68; color:var(--text-sub); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.chap { list-style:none; margin:0 0 16px; padding:0; display:flex; flex-wrap:wrap; gap:5px; max-height:52px; overflow:hidden; }
.chap li { font-size:11.5px; font-weight:600; color:var(--text-muted); background:var(--surface-alt); border:1px solid var(--border); border-radius:6px; padding:3px 7px; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
.card-foot { margin-top:auto; display:flex; align-items:center; gap:9px; padding-top:14px; border-top:1px solid var(--border); }
.metric { font-size:12.5px; color:var(--text-muted); font-weight:500; }
.metric b { color:var(--text); font-weight:700; margin-right:3px; }
.dot { width:3px; height:3px; border-radius:50%; background:var(--border-strong); }
.grow { flex:1; }
.go { display:inline-flex; align-items:center; gap:5px; font-size:13px; font-weight:700; color:var(--tone); }
.go svg { transition:transform .16s; }
.card:hover .go svg { transform:translateX(3px); }
.empty { display:none; text-align:center; padding:64px 0; color:var(--text-muted); font-size:15px; }
.empty.on { display:block; }
.card.hide { display:none; }
footer.pagefoot { margin-top:56px; padding-top:22px; border-top:1px solid var(--border); font-size:12.5px; color:var(--text-faint); line-height:1.8; }
@media (max-width:640px) {
  .wrap { padding:0 16px 72px; } .topbar-inner { padding:0 16px; }
  .hero { padding:44px 0 28px; } .grid { grid-template-columns:1fr; }
}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <div class="logo"><span class="sq">📚</span> 통파일 모음</div>
    <div class="spacer"></div>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="테마 전환">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    </button>
  </div>
</div>

<div class="wrap">
  <header class="hero">
    <div class="eyebrow">STUDY DIGEST / ${today}</div>
    <h1>공부하려고 만든 정리본,<br>여기 다 모여 있다</h1>
    <p class="lead">노트와 스크린샷을 합쳐 만든 <b>단일 HTML 학습자료 ${rows.length}권</b>. 각 파일은 그 자체로 완결된 책이라 이 폴더만 통째로 들고 다녀도 된다. 카드를 누르면 바로 열린다.</p>
    <div class="stats">
      <div class="stat"><div class="v">${rows.length}<span>권</span></div><div class="l">학습자료</div></div>
      <div class="stat"><div class="v">${totalCh}<span>개</span></div><div class="l">챕터</div></div>
      <div class="stat"><div class="v">${totalItems}<span>개</span></div><div class="l">아이템</div></div>
      <div class="stat"><div class="v">${totalMb.toFixed(1)}<span>MB</span></div><div class="l">총 용량</div></div>
    </div>
  </header>

  <div class="controls">
    <label class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="책 제목 / 챕터 / 주제 검색" autocomplete="off" spellcheck="false">
      <kbd>/</kbd>
    </label>
    <div class="chips">
      <button class="chip on" type="button" data-filter="all">전체</button>
${filterChips}
    </div>
  </div>

  <div class="grid" id="grid">
${cards}
  </div>
  <div class="empty" id="empty">검색 결과가 없다.</div>

  <footer class="pagefoot">
    study-digest 스킬이 만든 단일 HTML 학습자료 모음. 빌드 중간물은 <code>.digest/&lt;슬러그&gt;/</code> 에 있고, 원본 노트는 각 스터디 폴더에 그대로 둔다.<br>
    이 표지는 <code>build-index.mjs</code> 가 <code>.digest/*/meta.json</code> 을 읽어 생성한다. 마지막 갱신 ${today}.
  </footer>
</div>

<script>
(function () {
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("digest-index-theme"); } catch (e) {}
  if (saved) root.setAttribute("data-theme", saved);
  else if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) root.setAttribute("data-theme", "dark");

  document.getElementById("themeBtn").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("digest-index-theme", next); } catch (e) {}
  });

  var q = document.getElementById("q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var empty = document.getElementById("empty");
  var filter = "all";

  function apply() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (filter === "all" || c.dataset.cat === filter) &&
               (!term || c.dataset.search.indexOf(term) !== -1);
      c.classList.toggle("hide", !ok);
      if (ok) shown++;
    });
    empty.classList.toggle("on", shown === 0);
  }

  q.addEventListener("input", apply);
  chips.forEach(function (ch) {
    ch.addEventListener("click", function () {
      chips.forEach(function (o) { o.classList.remove("on"); });
      ch.classList.add("on");
      filter = ch.dataset.filter;
      apply();
    });
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "/" && document.activeElement !== q) { ev.preventDefault(); q.focus(); }
    if (ev.key === "Escape" && document.activeElement === q) { q.value = ""; q.blur(); apply(); }
  });
})();
</script>
</body>
</html>
`;

writeFileSync(join(VAULT, "index.html"), doc, "utf8");
console.log(`✓ ${join(VAULT, "index.html")}`);
console.log(`  자료 ${rows.length} / 챕터 ${totalCh} / 아이템 ${totalItems} / ${(doc.length / 1024).toFixed(0)}KB`);
