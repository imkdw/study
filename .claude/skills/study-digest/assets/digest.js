/* ==========================================================================
   study-digest 런타임
   - 테마 토글 / 사이드바 / 검색 / 스크롤 스파이 / 진행바 / 코드 복사 / mermaid
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var STORE_KEY = "study-digest:theme";

  /* ---------------------------------------------------- 테마 */
  function applyTheme(t) {
    doc.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(STORE_KEY, t); } catch (e) {}
    var btn = doc.getElementById("themeBtn");
    if (btn) btn.setAttribute("aria-label", t === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
    renderMermaid(t);
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    var t = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    doc.documentElement.setAttribute("data-theme", t);
    var btn = doc.getElementById("themeBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        applyTheme(doc.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    }
  }

  /* ---------------------------------------------------- 사이드바 (모바일) */
  function initNavDrawer() {
    var menuBtn = doc.getElementById("menuBtn");
    var scrim = doc.getElementById("scrim");
    function close() { body.classList.remove("nav-open"); }
    if (menuBtn) menuBtn.addEventListener("click", function () { body.classList.toggle("nav-open"); });
    if (scrim) scrim.addEventListener("click", close);
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    Array.prototype.forEach.call(doc.querySelectorAll(".nav-list a"), function (a) {
      a.addEventListener("click", function () { if (window.innerWidth <= 860) close(); });
    });
  }

  /* ---------------------------------------------------- 챕터 접기 */
  function initNavGroups() {
    Array.prototype.forEach.call(doc.querySelectorAll(".nav-group-title"), function (btn) {
      btn.addEventListener("click", function () {
        btn.parentNode.classList.toggle("collapsed");
      });
    });
  }

  /* ---------------------------------------------------- 검색 */
  function initSearch() {
    var input = doc.getElementById("searchInput");
    if (!input) return;
    var links = Array.prototype.slice.call(doc.querySelectorAll(".nav-list a"));
    var groups = Array.prototype.slice.call(doc.querySelectorAll(".nav-group"));

    // 검색 인덱스: 링크 텍스트 + data-keywords
    var index = links.map(function (a) {
      return {
        el: a,
        text: ((a.textContent || "") + " " + (a.getAttribute("data-keywords") || "")).toLowerCase()
      };
    });

    function run(q) {
      q = q.trim().toLowerCase();
      if (!q) {
        index.forEach(function (r) { r.el.classList.remove("nav-hidden"); });
        groups.forEach(function (g) { g.classList.remove("nav-hidden"); });
        return;
      }
      var terms = q.split(/\s+/);
      index.forEach(function (r) {
        var hit = terms.every(function (t) { return r.text.indexOf(t) !== -1; });
        r.el.classList.toggle("nav-hidden", !hit);
      });
      groups.forEach(function (g) {
        g.classList.remove("collapsed");
        var any = g.querySelectorAll(".nav-list a:not(.nav-hidden)").length > 0;
        g.classList.toggle("nav-hidden", !any);
      });
    }

    input.addEventListener("input", function () { run(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; run(""); input.blur(); }
      if (e.key === "Enter") {
        var first = doc.querySelector(".nav-list a:not(.nav-hidden)");
        if (first) first.click();
      }
    });
    doc.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); input.focus(); input.select(); }
      if (e.key === "/" && doc.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test(doc.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  /* ---------------------------------------------------- 스크롤 스파이 + 진행바 */
  function initScrollSpy() {
    var targets = Array.prototype.slice.call(doc.querySelectorAll("[data-spy]"));
    var links = {};
    Array.prototype.forEach.call(doc.querySelectorAll(".nav-list a"), function (a) {
      var id = a.getAttribute("href");
      if (id && id.charAt(0) === "#") links[id.slice(1)] = a;
    });
    var crumb = doc.getElementById("crumb");
    var bar = doc.getElementById("progressBar");
    var toTop = doc.getElementById("toTop");
    var current = null;

    function setActive(id) {
      if (id === current) return;
      current = id;
      Object.keys(links).forEach(function (k) { links[k].classList.toggle("active", k === id); });
      var a = links[id];
      if (a) {
        if (crumb) {
          var ch = a.getAttribute("data-chapter") || "";
          crumb.innerHTML = ch ? ch + " <span style='opacity:.4'>›</span> <b></b>" : "<b></b>";
          crumb.querySelector("b").textContent = a.getAttribute("data-title") || a.textContent.trim();
        }
        // 활성 항목이 사이드바 밖이면 스크롤
        var side = doc.querySelector(".sidebar");
        if (side) {
          var r = a.getBoundingClientRect(), sr = side.getBoundingClientRect();
          if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) {
            side.scrollTop += r.top - sr.top - sr.height / 2;
          }
        }
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY || window.pageYOffset;
        var h = doc.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
        if (toTop) toTop.classList.toggle("show", y > 700);

        var probe = y + 120;
        var found = null;
        for (var i = 0; i < targets.length; i++) {
          if (targets[i].offsetTop <= probe) found = targets[i].id;
          else break;
        }
        if (found) setActive(found);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  /* ---------------------------------------------------- 코드 복사 */
  function initCopy() {
    Array.prototype.forEach.call(doc.querySelectorAll(".code"), function (block) {
      var head = block.querySelector(".code-head");
      var pre = block.querySelector("pre");
      if (!head || !pre || head.querySelector(".copy-btn")) return;
      var btn = doc.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.textContent = "복사";
      btn.addEventListener("click", function () {
        var text = pre.innerText;
        var done = function () {
          btn.textContent = "복사됨";
          btn.classList.add("done");
          setTimeout(function () { btn.textContent = "복사"; btn.classList.remove("done"); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var ta = doc.createElement("textarea");
          ta.value = text; doc.body.appendChild(ta); ta.select();
          try { doc.execCommand("copy"); done(); } catch (e) {}
          doc.body.removeChild(ta);
        }
      });
      head.appendChild(btn);
    });
  }

  /* ---------------------------------------------------- 문법 강조 */
  function initHighlight() {
    if (!window.hljs) return;
    Array.prototype.forEach.call(doc.querySelectorAll(".code pre > code"), function (el) {
      if (el.dataset.hl) return;
      try { window.hljs.highlightElement(el); } catch (e) {}
      el.dataset.hl = "1";
    });
  }

  /* ---------------------------------------------------- mermaid */
  var mermaidSources = null;
  function renderMermaid(theme) {
    if (!window.mermaid) return;
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(".mermaid"));
    if (!nodes.length) return;
    if (!mermaidSources) {
      mermaidSources = nodes.map(function (n) { return n.textContent; });
    }
    var dark = (theme || doc.documentElement.getAttribute("data-theme")) === "dark";
    nodes.forEach(function (n, i) {
      n.removeAttribute("data-processed");
      n.innerHTML = mermaidSources[i];
    });
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
        theme: dark ? "dark" : "base",
        themeVariables: dark
          ? {
              primaryColor: "#1F2937", primaryTextColor: "#EDEFF2", primaryBorderColor: "#4E8FF7",
              lineColor: "#7C838F", secondaryColor: "#21242B", tertiaryColor: "#1C1F25",
              fontSize: "14px", background: "#16181D",
              mainBkg: "#1F2937", nodeBorder: "#4E8FF7", clusterBkg: "#191C22",
              clusterBorder: "#3A3F49", edgeLabelBackground: "#16181D", titleColor: "#EDEFF2"
            }
          : {
              primaryColor: "#E8F3FF", primaryTextColor: "#191F28", primaryBorderColor: "#3182F6",
              lineColor: "#8B95A1", secondaryColor: "#F2F4F6", tertiaryColor: "#F9FAFB",
              fontSize: "14px", background: "#FFFFFF",
              mainBkg: "#E8F3FF", nodeBorder: "#3182F6", clusterBkg: "#F9FAFB",
              clusterBorder: "#E5E8EB", edgeLabelBackground: "#FFFFFF", titleColor: "#191F28"
            },
        flowchart: { curve: "basis", padding: 14, useMaxWidth: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true }
      });
      window.mermaid.run({ nodes: nodes });
    } catch (e) { /* mermaid 미로딩 시 원문 유지 */ }
  }

  /* ---------------------------------------------------- 부팅 */
  function boot() {
    initTheme();
    initNavDrawer();
    initNavGroups();
    initSearch();
    initScrollSpy();
    initCopy();
    initHighlight();
    renderMermaid();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  // CDN 로딩이 늦는 경우 대비
  window.addEventListener("load", function () {
    initHighlight();
    renderMermaid();
  });
})();
