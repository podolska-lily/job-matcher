import { writeFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { allScored } from './db.js';

// Сторінка рендериться на сервері: картки є в самому HTML, тож вона читається
// навіть там, де JavaScript не виконується (перегляд файлів у Telegram, Quick Look на iPhone).
// JavaScript лише додає фільтри та кнопки «Подалась / Пропустити».

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const arr = (v) => {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const safeUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');

const ul = (cls, items) => (items.length ? `<ul class="${cls}">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');

function card(j, threshold) {
  const cls = j.score >= 90 ? 'high' : j.score >= threshold ? 'mid' : 'low';
  const meta = [j.company, j.location, `додано ${String(j.seen_at || '').slice(0, 10)}`].filter(Boolean).map(esc).join(' · ');
  const reasons = arr(j.reasons);
  const gaps = arr(j.gaps);
  const flags = arr(j.red_flags);
  const url = safeUrl(j.url);
  const text = [j.title, j.company, ...reasons, ...gaps].join(' ').toLowerCase();
  return `<div class="card" data-id="${esc(j.id)}" data-score="${Number(j.score) || 0}" data-text="${esc(text)}">
<div class="head"><div class="badge ${cls}">${Number(j.score) || 0}%</div><div><p class="title">${esc(j.title)}</p><div class="meta">${meta}</div></div></div>
<div class="actions">${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Відкрити вакансію</a>` : ''}<button type="button" class="btn act" data-act="applied">Подалась</button><button type="button" class="btn act" data-act="skipped">Пропустити</button></div>
${ul('r', reasons)}${ul('g', gaps)}${ul('f', flags)}${j.why ? `<div class="why">Чому не вище: ${esc(j.why)}</div>` : ''}
</div>`;
}

const TEMPLATE = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Вакансії</title>
<style>
:root{--bg:#f6f6f4;--card:#fff;--text:#1d1d1b;--muted:#6b6b66;--line:#e3e3de;--accent:#2f5bd8;--high:#1a7f4b;--mid:#a86a00;--low:#8a8a84;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#171716;--card:#222221;--text:#ecece8;--muted:#a3a39d;--line:#34342f;--accent:#7b9cff;--high:#5fd08f;--mid:#e0a84a;--low:#8a8a84;--bad:#ff8a80}}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:8px 0 4px}
.sub{color:var(--muted);margin-bottom:16px}
.bar{display:none;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:16px}
.js .bar{display:flex}
.bar label{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:14px}
.bar input[type=search],.bar select{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.bar input[type=search]{flex:1;min-width:160px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.card.done{opacity:.55}
.head{display:flex;gap:12px;align-items:flex-start}
.badge{flex:none;min-width:56px;text-align:center;font-weight:700;font-size:18px;padding:6px 8px;border-radius:10px;border:2px solid currentColor}
.high{color:var(--high)}.mid{color:var(--mid)}.low{color:var(--low)}
.title{font-weight:600;font-size:16px;margin:0}
.meta{color:var(--muted);font-size:13px;margin-top:2px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}
.btn{font:inherit;font-size:14px;padding:7px 14px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);cursor:pointer;text-decoration:none;display:inline-block}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.on{border-color:var(--accent);color:var(--accent);font-weight:600}
.act{display:none}
.js .act{display:inline-block}
ul{margin:8px 0 0;padding:0;list-style:none;font-size:14px}
li{padding-left:18px;position:relative;margin:2px 0}
li:before{position:absolute;left:0;font-weight:700}
.r li:before{content:"+";color:var(--high)}
.g li:before{content:"\\2212";color:var(--mid)}
.f li:before{content:"!";color:var(--bad)}
.why{margin-top:8px;font-size:14px;color:var(--muted)}
.empty{text-align:center;color:var(--muted);padding:40px 0}
</style>
<script>document.documentElement.className="js";</script>
</head>
<body>
<div class="wrap">
<h1>Вакансії</h1>
<div class="sub" id="sub">Усього: __COUNT__ · оновлено __GENERATED__</div>
<div class="bar">
<label>Мін. збіг <input type="range" id="min" min="0" max="100" step="5" value="__THRESHOLD__"> <b id="minv">__THRESHOLD__</b>%</label>
<label>Статус <select id="st"><option value="all">Усі</option><option value="new">Нові</option><option value="applied">Подалась</option><option value="skipped">Пропущені</option></select></label>
<input type="search" id="q" placeholder="Пошук за словом">
</div>
<div id="list">
__CARDS__
</div>
<div class="empty" id="empty" hidden>Нічого не знайдено за цими фільтрами.</div>
</div>
<script>
(function () {
  var GENERATED = "__GENERATED__";
  var KEY = "jobmatcher-status-v1";
  var marks = {};
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (raw && typeof raw === "object") marks = raw;
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (e) {} }

  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var minEl = document.getElementById("min"), minv = document.getElementById("minv");
  var stEl = document.getElementById("st"), qEl = document.getElementById("q");
  var emptyEl = document.getElementById("empty"), subEl = document.getElementById("sub");

  function apply() {
    var min = Number(minEl.value), st = stEl.value, q = qEl.value.trim().toLowerCase(), shown = 0;
    minv.textContent = min;
    cards.forEach(function (c) {
      var id = c.getAttribute("data-id");
      var s = marks[id] || "new";
      c.classList.toggle("done", s !== "new");
      Array.prototype.forEach.call(c.querySelectorAll(".act"), function (b) {
        b.classList.toggle("on", b.getAttribute("data-act") === s);
      });
      var ok = Number(c.getAttribute("data-score")) >= min &&
        (st === "all" || s === st) &&
        (!q || c.getAttribute("data-text").indexOf(q) >= 0);
      c.hidden = !ok;
      if (ok) shown++;
    });
    emptyEl.hidden = shown > 0;
    subEl.textContent = "Показано " + shown + " з " + cards.length + " \\u00b7 оновлено " + GENERATED;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".act") : null;
    if (!b) return;
    var c = b.closest(".card");
    var id = c.getAttribute("data-id"), a = b.getAttribute("data-act");
    if (marks[id] === a) delete marks[id]; else marks[id] = a;
    save();
    apply();
  });
  minEl.addEventListener("input", apply);
  stEl.addEventListener("change", apply);
  qEl.addEventListener("input", apply);
  apply();
})();
</script>
</body>
</html>`;

export function writeReport(threshold = 75, file = 'report.html') {
  const jobs = allScored();
  const generated = new Date().toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
  const html = TEMPLATE.replaceAll('__THRESHOLD__', String(Number(threshold) || 0))
    .replaceAll('__GENERATED__', generated)
    .replaceAll('__COUNT__', String(jobs.length))
    .replace('__CARDS__', () => jobs.map((j) => card(j, threshold)).join('\n'));
  writeFileSync(file, html);
  return file;
}

// npm run report: перебудувати сторінку без нового пошуку
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = JSON.parse(readFileSync('config.json', 'utf8'));
  console.log('Збережено: ' + writeReport(cfg.threshold));
}
