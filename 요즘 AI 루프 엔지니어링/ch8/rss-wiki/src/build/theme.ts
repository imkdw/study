/** 정적 사이트 테마(CSS) + 클라이언트 스크립트(JS). */

export const CSS = `
:root {
  --bg: #ffffff;
  --bg-elevated: #f5f6f8;
  --text: #1a1d21;
  --text-muted: #5b6270;
  --border: #e3e5e9;
  --accent: #3b6ef6;
  --accent-text: #ffffff;
  --code-bg: #f0f1f4;
  --link: #3b6ef6;
  --link-missing: #d1483f;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #16181d;
    --bg-elevated: #1e2127;
    --text: #e7e9ec;
    --text-muted: #9aa1ac;
    --border: #2b2f37;
    --accent: #6d93fb;
    --accent-text: #0e1116;
    --code-bg: #22262e;
    --link: #6d93fb;
    --link-missing: #ea7268;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
}

:root[data-theme='dark'] {
  --bg: #16181d;
  --bg-elevated: #1e2127;
  --text: #e7e9ec;
  --text-muted: #9aa1ac;
  --border: #2b2f37;
  --accent: #6d93fb;
  --accent-text: #0e1116;
  --code-bg: #22262e;
  --link: #6d93fb;
  --link-missing: #ea7268;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
  line-height: 1.6;
}

a { color: var(--link); }
a.wikilink.missing { color: var(--link-missing); border-bottom: 1px dashed var(--link-missing); }

.layout {
  display: flex;
  align-items: flex-start;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  gap: 24px;
}

.sidebar {
  flex: 0 0 220px;
  position: sticky;
  top: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}

.sidebar h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 16px 0 8px;
}

.sidebar ul { list-style: none; margin: 0; padding: 0; }
.sidebar li { margin: 2px 0; }
.sidebar a {
  display: block;
  padding: 6px 8px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text);
}
.sidebar a:hover { background: var(--code-bg); }
.sidebar a.active { background: var(--accent); color: var(--accent-text); }

main {
  flex: 1 1 auto;
  min-width: 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  box-shadow: var(--shadow);
}

main img { max-width: 100%; }
main pre, main code { background: var(--code-bg); border-radius: 6px; }
main pre { padding: 12px; overflow-x: auto; }
main code { padding: 0.15em 0.35em; }
main pre code { padding: 0; }

.updated-at { color: var(--text-muted); font-size: 0.85rem; margin-top: 32px; }

#search-box { width: 100%; box-sizing: border-box; }
#search-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
}
#search-results {
  margin-top: 8px;
  max-height: 300px;
  overflow-y: auto;
}
#search-results .result {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
#search-results .result:last-child { border-bottom: none; }
#search-results .result-title { font-weight: 600; }
#search-results .result-snippet { color: var(--text-muted); font-size: 0.85rem; }

#theme-toggle,
#collect-btn {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}
#collect-btn { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
#collect-btn[disabled] { opacity: 0.6; cursor: not-allowed; }

#collect-progress { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }

#toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: var(--shadow);
  color: var(--text);
}

@media (max-width: 700px) {
  .layout { flex-direction: column; padding: 12px; gap: 12px; }
  .sidebar { position: static; flex: 1 1 auto; width: 100%; }
  main { padding: 16px; width: 100%; }
}

@media (max-width: 400px) {
  .layout { padding: 8px; }
  main { padding: 12px; }
  .sidebar { padding: 12px; }
}
`;

export const CLIENT_JS = `
(function () {
  'use strict';

  // ---------- 테마 토글 ----------
  function initTheme() {
    var root = document.documentElement;
    var btn = document.getElementById('theme-toggle');
    var saved = null;
    try { saved = localStorage.getItem('rss-wiki-theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

    if (!btn) return;
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('rss-wiki-theme', next); } catch (e) {}
    });
  }

  // ---------- 검색 ----------
  function initSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!input || !results) return;

    var indexPromise = null;
    function loadIndex() {
      if (!indexPromise) {
        var prefix = window.__RSS_WIKI_ASSET_PREFIX__ || '';
        indexPromise = fetch(prefix + 'search-index.json').then(function (r) { return r.json(); });
      }
      return indexPromise;
    }

    function render(entries, query) {
      results.innerHTML = '';
      if (!query) return;
      var q = query.toLowerCase();
      var matched = entries
        .filter(function (e) {
          return (
            (e.t && e.t.toLowerCase().indexOf(q) !== -1) ||
            (e.s && e.s.toLowerCase().indexOf(q) !== -1) ||
            (e.k && e.k.join(' ').toLowerCase().indexOf(q) !== -1) ||
            (e.e && e.e.join(' ').toLowerCase().indexOf(q) !== -1)
          );
        })
        .slice(0, 20);

      matched.forEach(function (e) {
        var div = document.createElement('div');
        div.className = 'result';
        var titleEl = document.createElement('a');
        titleEl.className = 'result-title';
        var prefix = window.__RSS_WIKI_ASSET_PREFIX__ || '';
        titleEl.href = e.c ? prefix + e.c + '.html' : e.u;
        titleEl.textContent = e.t;
        var snippet = document.createElement('div');
        snippet.className = 'result-snippet';
        snippet.textContent = (e.s || '').slice(0, 160);
        div.appendChild(titleEl);
        div.appendChild(snippet);
        results.appendChild(div);
      });

      if (matched.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'result-snippet';
        empty.textContent = '검색 결과가 없습니다.';
        results.appendChild(empty);
      }
    }

    var debounceTimer = null;
    input.addEventListener('input', function () {
      var query = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        loadIndex().then(function (entries) { render(entries, query); });
      }, 120);
    });
  }

  // ---------- 토스트 ----------
  function showToast(msg) {
    var el = document.createElement('div');
    el.id = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { location.reload(); }, 1500);
  }

  // ---------- 수집하기 (local 모드 전용) ----------
  function initCollect() {
    if (window.__RSS_WIKI_MODE__ !== 'local') return;
    var btn = document.getElementById('collect-btn');
    var progress = document.getElementById('collect-progress');
    if (!btn) return;

    var pollTimer = null;
    var currentRunId = null;

    function setProgressText(payload) {
      if (!progress) return;
      if (!payload) { progress.textContent = ''; return; }
      progress.textContent = (payload.stage || payload.status || '') + ' 진행 중...';
    }

    function finish(payload) {
      btn.disabled = false;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      var articlesNew = payload && payload.articlesNew != null ? payload.articlesNew : 0;
      var pagesUpdated = payload && payload.pagesUpdated != null ? payload.pagesUpdated : 0;
      showToast('새 글 ' + articlesNew + '개 / 갱신된 주제 ' + pagesUpdated + '개');
    }

    function pollStatus(runId) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        fetch('/api/runs/' + runId)
          .then(function (r) { return r.json(); })
          .then(function (payload) {
            setProgressText(payload);
            if (
              payload.status === 'done' ||
              payload.status === 'partial' ||
              payload.status === 'failed' ||
              payload.status === 'cancelled'
            ) {
              finish(payload);
            }
          })
          .catch(function () {});
      }, 2000);
    }

    function subscribe(runId) {
      currentRunId = runId;
      btn.disabled = true;
      if (typeof EventSource === 'undefined') { pollStatus(runId); return; }
      var es;
      try {
        es = new EventSource('/api/runs/' + runId + '/stream');
      } catch (e) {
        pollStatus(runId);
        return;
      }
      es.onmessage = function (ev) {
        try {
          var payload = JSON.parse(ev.data);
          setProgressText(payload);
          if (
            payload.status === 'done' ||
            payload.status === 'partial' ||
            payload.status === 'failed' ||
            payload.status === 'cancelled'
          ) {
            es.close();
            finish(payload);
          }
        } catch (e) {}
      };
      es.onerror = function () {
        es.close();
        pollStatus(runId);
      };
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      fetch('/api/runs', { method: 'POST' })
        .then(function (r) {
          if (r.status === 409) return r.json().then(function (body) { return body; });
          return r.json();
        })
        .then(function (body) {
          subscribe(body.runId);
        })
        .catch(function () {
          btn.disabled = false;
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initSearch();
    initCollect();
  });
})();
`;
