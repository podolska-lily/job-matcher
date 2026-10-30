import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { allScored } from './db.js';

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
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:8px 0 4px}
.sub{color:var(--muted);margin-bottom:16px}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:16px}
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
ul{margin:8px 0 0;padding:0;list-style:none;font-size:14px}
li{padding-left:18px;position:relative;margin:2px 0}
li:before{position:absolute;left:0;font-weight:700}
.r li:before{content:"+";color:var(--high)}
.g li:before{content:"\\2212";color:var(--mid)}
.f li:before{content:"!";color:var(--bad)}
.why{margin-top:8px;font-size:14px;color:var(--muted)}
.empty{text-align:center;color:var(--muted);padding:40px 0}
</style>
</head>
<body>
<div class="wrap">
<h1>Вакансії</h1>
<div class="sub" id="sub"></div>
<div class="bar">
<label>Мін. збіг <input type="range" id="min" min="0" max="100" step="5"> <b id="minv"></b>%</label>
<label>Статус <select id="st"><option value="all">Усі</option><option value="new">Нові</option><option value="applied">Подалась</option><option value="skipped">Пропущені</option></select></label>
<input type="search" id="q" placeholder="Пошук за словом">
</div>
<div id="list"></div>
</div>
<script>
var JOBS = __DATA__;
var THRESHOLD = __THRESHOLD__;
var GENERATED = "__GENERATED__";
var KEY = "jobmatcher-status-v1";
var status = {};
try { status = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(status)); } catch (e) {} }
function parse(v) { try { var a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function list(cls, items) {
  if (!items.length) return null;
  var ul = el("ul", cls);
  items.forEach(function (t) { ul.appendChild(el("li", "", t)); });
  return ul;
}
var minEl = document.getElementById("min"), minv = document.getElementById("minv");
var stEl = document.getElementById("st"), qEl = document.getElementById("q"), listEl = document.getElementById("list");
minEl.value = THRESHOLD; minv.textContent = THRESHOLD;

function render() {
  var min = Number(minEl.value), st = stEl.value, q = qEl.value.trim().toLowerCase();
  minv.textContent = min;
  listEl.textContent = "";
  var shown = 0;
  JOBS.forEach(function (j) {
    var s = status[j.id] || "new";
    if (j.score < min) return;
    if (st !== "all" && s !== st) return;
    if (q && (j.title + " " + (j.company || "") + " " + (j.reasons || "") + " " + (j.gaps || "")).toLowerCase().indexOf(q) < 0) return;
    shown++;
    var card = el("div", "card" + (s !== "new" ? " done" : ""));
    var head = el("div", "head");
    head.appendChild(el("div", "badge " + (j.score >= 90 ? "high" : j.score >= THRESHOLD ? "mid" : "low"), j.score + "%"));
    var box = el("div");
    box.appendChild(el("p", "title", j.title));
    var meta = [j.company, j.location, "додано " + String(j.seen_at || "").slice(0, 10)].filter(Boolean).join(" \\u00b7 ");
    box.appendChild(el("div", "meta", meta));
    head.appendChild(box);
    card.appendChild(head);

    var act = el("div", "actions");
    if (/^https?:\\/\\//.test(j.url || "")) {
      var a = el("a", "btn primary", "Відкрити вакансію");
      a.href = j.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      act.appendChild(a);
    }
    [["applied", "Подалась"], ["skipped", "Пропустити"]].forEach(function (p) {
      var b = el("button", "btn" + (s === p[0] ? " on" : ""), p[1]);
      b.onclick = function () { if (status[j.id] === p[0]) delete status[j.id]; else status[j.id] = p[0]; save(); render(); };
      act.appendChild(b);
    });
    card.appendChild(act);

    [list("r", parse(j.reasons)), list("g", parse(j.gaps)), list("f", parse(j.red_flags))].forEach(function (u) { if (u) card.appendChild(u); });
    if (j.why) card.appendChild(el("div", "why", "Чому не вище: " + j.why));
    listEl.appendChild(card);
  });
  if (!shown) listEl.appendChild(el("div", "empty", "Нічого не знайдено за цими фільтрами."));
  document.getElementById("sub").textContent = "Показано " + shown + " з " + JOBS.length + " \\u00b7 оновлено " + GENERATED;
}
minEl.oninput = render; stEl.onchange = render; qEl.oninput = render;
render();
</script>
</body>
</html>`;

export function writeReport(threshold = 75, file = 'report.html') {
  const jobs = allScored();
  const data = JSON.stringify(jobs).replace(/</g, '\\u003c');
  const generated = new Date().toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
  const html = TEMPLATE.replace('__DATA__', () => data)
    .replace('__THRESHOLD__', String(threshold))
    .replace('__GENERATED__', generated);
  writeFileSync(file, html);
  return file;
}

// npm run report: перебудувати сторінку без нового пошуку
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = JSON.parse(readFileSync('config.json', 'utf8'));
  console.log('Збережено: ' + writeReport(cfg.threshold));
}
