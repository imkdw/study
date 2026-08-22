#!/usr/bin/env node
/**
 * study-digest 어셈블러
 *
 *   node assemble.mjs <buildDir> <output.html>
 *
 * buildDir 구조
 *   meta.json          문서 메타 + 챕터/아이템 목차
 *   partials/*.html    챕터별 본문 조각 (article.item 들의 나열)
 *
 * 어셈블러가 하는 일
 *   1) meta.json 으로 사이드바 목차 / 표지 / 챕터 헤더를 생성
 *   2) partials 를 순서대로 이어붙임
 *   3) digest.css / digest.js 를 shell.html 에 인라인해 단일 HTML 로 출력
 *   4) meta 의 아이템 id 와 partial 의 실제 id 를 대조해 누락/불일치를 리포트
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const [, , buildDirArg, outArg] = process.argv;

if (!buildDirArg || !outArg) {
  console.error("usage: node assemble.mjs <buildDir> <output.html>");
  process.exit(1);
}

const buildDir = resolve(buildDirArg);
const outPath = resolve(outArg);
const meta = JSON.parse(readFileSync(join(buildDir, "meta.json"), "utf8"));

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------- 사이드바 */
function buildSidebar() {
  return meta.chapters
    .map((ch) => {
      const items = ch.items
        .map(
          (it) =>
            `          <li><a href="#${esc(it.id)}"` +
            ` data-chapter="${esc(ch.navTitle || ch.title)}"` +
            ` data-title="${esc(it.title)}"` +
            ` data-keywords="${esc(it.keywords || "")}">` +
            (it.idx ? `<span class="idx">${esc(it.idx)}</span>` : "") +
            `${esc(it.title)}</a></li>`
        )
        .join("\n");
      return `      <div class="nav-group">
        <button class="nav-group-title" type="button">
          <span class="nav-num">${esc(ch.short || "")}</span>
          <span>${esc(ch.navTitle || ch.title)}</span>
          <svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <ul class="nav-list">
${items}
        </ul>
      </div>`;
    })
    .join("\n");
}

/* ------------------------------------------------------------- 표지 */
function buildCover() {
  const stats = (meta.stats || [])
    .map(
      (s) =>
        `        <div class="stat"><div class="stat-val">${esc(s.val)}${
          s.unit ? `<span>${esc(s.unit)}</span>` : ""
        }</div><div class="stat-label">${esc(s.label)}</div></div>`
    )
    .join("\n");

  const cards = meta.chapters
    .map(
      (ch) =>
        `        <a class="chapter-card" href="#${esc(ch.id)}">
          <div class="cc-num">${esc(ch.short || "")}</div>
          <div class="cc-title">${esc(ch.navTitle || ch.title)}</div>
          <div class="cc-meta">${ch.items.length}개 아이템</div>
        </a>`
    )
    .join("\n");

  return `    <section class="cover">
      ${meta.eyebrow ? `<div class="cover-eyebrow">${esc(meta.eyebrow)}</div>` : ""}
      <h1>${esc(meta.title)}</h1>
      <p class="cover-lead">${meta.lead || ""}</p>
      <div class="cover-stats">
${stats}
      </div>
      ${meta.coverNote || ""}
      <div class="chapter-grid">
${cards}
      </div>
    </section>`;
}

/* ------------------------------------------------------------- 본문 */
const problems = [];

function buildBody() {
  return meta.chapters
    .map((ch) => {
      const file = join(buildDir, "partials", ch.file || `${ch.id}.html`);
      if (!existsSync(file)) {
        problems.push(`partial 없음: ${file}`);
        return "";
      }
      const html = readFileSync(file, "utf8");

      const found = [...html.matchAll(/<article class="item"[^>]*id="([^"]+)"/g)].map((m) => m[1]);
      const declared = ch.items.map((i) => i.id);
      declared.filter((id) => !found.includes(id)).forEach((id) => problems.push(`${ch.id}: meta 에만 있는 아이템 → ${id}`));
      found.filter((id) => !declared.includes(id)).forEach((id) => problems.push(`${ch.id}: partial 에만 있는 아이템 → ${id}`));
      if (found.join("|") !== declared.filter((id) => found.includes(id)).join("|")) {
        problems.push(`${ch.id}: meta 순서와 partial 순서가 다름`);
      }

      return `    <section class="chapter-head" id="${esc(ch.id)}" data-spy>
      <div class="ch-label">${esc(ch.short || "")}</div>
      <h2>${esc(ch.title)}</h2>
      ${ch.lead ? `<p class="ch-lead">${ch.lead}</p>` : ""}
    </section>

${html.trimEnd()}`;
    })
    .join("\n\n");
}

/* ------------------------------------------------------------- 출력 */
const css = readFileSync(join(HERE, "digest.css"), "utf8");
const js = readFileSync(join(HERE, "digest.js"), "utf8");
const shell = readFileSync(join(HERE, "shell.html"), "utf8");

const sidebar = buildSidebar();
const cover = buildCover();
const bodyHtml = buildBody();

const favicon = encodeURIComponent(
  meta.favicon ||
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#3182F6"/><text x="32" y="43" font-size="30" font-family="system-ui,sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${
      meta.mark || "S"
    }</text></svg>`
);

const out = shell
  .replaceAll("{{TITLE}}", esc(meta.title))
  .replaceAll("{{SUBTITLE}}", esc(meta.subtitle || ""))
  .replaceAll("{{DESCRIPTION}}", esc(meta.description || meta.subtitle || meta.title))
  .replaceAll("{{MARK}}", esc(meta.mark || "S"))
  .replaceAll("{{FAVICON}}", favicon)
  .replaceAll("{{FOOTER}}", meta.footer || "")
  .replace("{{STYLE}}", () => css)
  .replace("{{SCRIPT}}", () => js)
  .replace("{{SIDEBAR}}", () => sidebar)
  .replace("{{COVER}}", () => cover)
  .replace("{{BODY}}", () => bodyHtml);

writeFileSync(outPath, out, "utf8");

const itemCount = meta.chapters.reduce((n, c) => n + c.items.length, 0);
console.log(`✓ ${outPath}`);
console.log(`  챕터 ${meta.chapters.length} / 아이템 ${itemCount} / ${(out.length / 1024).toFixed(0)}KB`);
if (problems.length) {
  console.log("\n⚠ 점검 필요");
  problems.forEach((p) => console.log("  - " + p));
  process.exitCode = 2;
}
