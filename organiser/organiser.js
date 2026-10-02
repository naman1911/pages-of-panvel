/* Organiser's desk: the whole circle at a glance, for the organiser only.

   READ-ONLY. It signs in with the same Google sign-in as the site and opens
   one live read of circle/public, the record every member's phone already
   reads to draw the shelf. It never writes, never creates a member entry,
   and never signs anyone out. Private books stay private: the database
   rules don't let anyone else read them, this page included.

   Who gets in: the page compares a SHA-256 fingerprint of the signed-in,
   verified Google email with OWNER below, so the address itself isn't
   published in the site's code. Anyone else sees a polite "not for you"
   and the page reads nothing.

   ?demo runs the desk on the site's sample data, with no sign-in.          */

import { firebaseConfig } from "../js/config.js";
import { watchFeedback, demoFeedback } from "./feedback.js";

const OWNER = "9cb6340ac3ed2a170ef3fc0bb87d8c393567efa3220a7ef781c9991bac7dc0c5";
const DEMO = new URLSearchParams(location.search).has("demo");
const V = "https://www.gstatic.com/firebasejs/10.12.2";   // same SDK as js/app.js

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => { const e = document.createElementNS(SVG, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

/* ---------- dates, the way app.js writes them (UTC calendar days) ---------- */

const iso = (d) => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());
const back = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return iso(x); };
const ago = (s) => (s ? Math.round((Date.parse(TODAY) - Date.parse(s)) / 864e5) : Infinity);
const within = (s, a, b) => { const n = ago(s); return n >= a && n <= b; };
const fmt = (s, opt = { day: "numeric", month: "short" }) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", { ...opt, timeZone: "UTC" }) : "—");
const rel = (n) => (n === Infinity ? "never" : n <= 0 ? "today" : n === 1 ? "yesterday" : n < 7 ? `${n} days ago` : n < 60 ? `${Math.round(n / 7)} wk ago` : `${Math.round(n / 30)} mo ago`);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const norm = (s) => String(s || "").toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9ऀ-ॿ ]/g, "").trim();

function streakOf(days = []) {
  if (!days.length) return 0;
  const set = new Set(days), d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestRun(days = []) {
  const t = [...new Set(days)].sort().map((x) => Date.parse(x));
  let best = 0, run = 0;
  t.forEach((x, i) => { run = i && x - t[i - 1] === 864e5 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

/* ---------- how big the shared record is, by Firestore's own rules ---------- */
// string = UTF-8 bytes + 1 · number 8 · boolean/null 1 · array = its values ·
// map = its field names + values · document = name + fields + 32.
const enc = new TextEncoder();
function sizeOf(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === "string") return enc.encode(v).length + 1;
  if (typeof v === "number") return 8;
  if (typeof v === "boolean") return 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + sizeOf(x), 0);
  if (typeof v === "object") return Object.entries(v).reduce((s, [k, x]) => s + enc.encode(k).length + 1 + sizeOf(x), 0);
  return 8;
}
const DOC_NAME = ("circle".length + 1) + ("public".length + 1) + 16;
const docSize = (data) => DOC_NAME + sizeOf(data) + 32;
const LIMIT = 1048576, BOOK_CAP = 3000, BOARD_CAP = 40;

/* ---------- reading the circle ---------- */

function analyse(pub) {
  const members = pub.members || {}, books = pub.books || [], board = pub.board || [];
  const people = Object.entries(members).map(([uid, m]) => {
    const mine = books.filter((b) => b.uid === uid);
    const posts = board.filter((p) => p.uid === uid);
    const days = m.days || [];
    const events = [...days, ...mine.map((b) => b.startedAt), ...mine.map((b) => b.finishedAt), ...posts.map((p) => p.at)].filter(Boolean).sort();
    const last = events[events.length - 1] || null;
    const idle = ago(last), nothing = !mine.length && !days.length && !posts.length;
    const status = ago(m.joined) <= 7 ? "new" : nothing ? "never" : idle <= 7 ? "active" : idle <= 20 ? "cooling" : "quiet";
    return {
      uid, name: m.name || "Unnamed", joined: m.joined || null, last, idle, status, events,
      streak: streakOf(days), best: bestRun(days), checkins30: days.filter((x) => within(x, 0, 29)).length,
      reading: mine.filter((b) => b.status === "reading").length,
      finished: mine.filter((b) => b.status === "finished").length,
      lines: mine.filter((b) => (b.line || "").trim()).length, posts: posts.length, days,
    };
  });
  return { members, books, board, people, size: docSize(pub) };
}

const STATUS = {
  new: ["New", "joined in the last 7 days"],
  active: ["Active", "did something in the last 7 days"],
  cooling: ["Cooling", "last active 1 to 3 weeks ago"],
  quiet: ["Quiet", "nothing for 3 weeks or more"],
  never: ["Never started", "no book, check-in or post yet"],
};

/* ---------- tooltip ---------- */

const tip = $("tip");
let tipT = 0;
function showTip(target, html, x, y) {
  tip.replaceChildren(...html);
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const px = x ?? r.left + r.width / 2, py = y ?? r.top;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, px - w / 2)) + "px";
  tip.style.top = Math.max(8, py - h - 12) + "px";
  clearTimeout(tipT);
  tipT = setTimeout(hideTip, 3000);
}
function hideTip() { tip.hidden = true; }
function tipBody(value, label) { const b = el("b", null, value); return [b, document.createTextNode(label)]; }
addEventListener("scroll", hideTip, { passive: true });

/* ---------- charts (hand-drawn SVG; one hue, thin marks, quiet axes) ---------- */

const niceMax = (m) => { if (m <= 4) return Math.max(1, m); const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p * 2) / 2 * p; };

function columns(box, items) {
  box.replaceChildren();
  const W = box.clientWidth, H = box.clientHeight, L = 26, B = 18, T = 8;
  if (!items.some((i) => i.value > 0)) { box.append(el("p", "empty", "Nothing yet in this stretch.")); return; }
  const max = niceMax(Math.max(...items.map((i) => i.value)));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": box.dataset.label || "" });
  const y = (v) => T + (H - T - B) * (1 - v / max);
  for (const t of [0, max / 2, max]) {
    s.append(svg("line", { class: "grid", x1: L, x2: W, y1: y(t), y2: y(t) }));
    const tx = svg("text", { class: "axis", x: L - 5, y: y(t) + 3, "text-anchor": "end" });
    tx.textContent = Number.isInteger(t) ? t : t.toFixed(1);
    s.append(tx);
  }
  const band = (W - L) / items.length, bw = Math.max(2, Math.min(24, band * 0.7));
  items.forEach((it, i) => {
    const cx = L + band * i + band / 2, top = y(it.value), h = H - B - top;
    const hit = svg("rect", { class: "hit", x: L + band * i, y: T, width: band, height: H - T - B, tabindex: "0", "aria-label": `${it.tip}: ${it.value}` });
    const r = Math.min(4, bw / 2, h);
    const bar = svg("path", {
      class: "bar" + (it.accent ? " today" : ""),
      d: h <= 0 ? "" : `M${cx - bw / 2},${H - B}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${H - B}Z`,
    });
    const on = (e) => showTip(hit, tipBody(it.value, it.tip), e?.clientX, e?.clientY ?? hit.getBoundingClientRect().top);
    hit.addEventListener("pointerenter", on); hit.addEventListener("pointerdown", on);
    hit.addEventListener("focus", () => on()); hit.addEventListener("pointerleave", hideTip); hit.addEventListener("blur", hideTip);
    s.append(hit, bar);
  });
  const lbl = (i, anchor) => { const t = svg("text", { class: "axis", x: L + band * i + band / 2, y: H - 4, "text-anchor": anchor }); t.textContent = items[i].label; s.append(t); };
  lbl(0, "start"); lbl(Math.floor(items.length / 2), "middle"); lbl(items.length - 1, "end");
  box.append(s);
}

function growth(box, points) {
  box.replaceChildren();
  if (points.length < 2) { box.append(el("p", "empty", "Not enough history yet.")); return; }
  const W = box.clientWidth, H = box.clientHeight, L = 30, B = 18, T = 14, R = 34;
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date) || t0 + 1;
  const max = niceMax(points[points.length - 1].n);
  const x = (d) => L + (W - L - R) * ((Date.parse(d) - t0) / Math.max(1, t1 - t0));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Members over time, now ${points[points.length - 1].n}` });
  for (const t of [0, max / 2, max]) {
    s.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(t), y2: y(t) }));
    const tx = svg("text", { class: "axis", x: L - 5, y: y(t) + 3, "text-anchor": "end" }); tx.textContent = Math.round(t); s.append(tx);
  }
  // a step line: the count only changes on the day someone joins
  let d = `M${x(points[0].date)},${y(points[0].n)}`;
  for (let i = 1; i < points.length; i++) d += `H${x(points[i].date)}V${y(points[i].n)}`;
  s.append(svg("path", { class: "area", d: d + `V${y(0)}H${x(points[0].date)}Z` }), svg("path", { class: "line", d }));
  const last = points[points.length - 1];
  s.append(svg("circle", { class: "dot", cx: x(last.date), cy: y(last.n), r: 5 }));
  const lab = svg("text", { class: "lab", x: x(last.date) + 8, y: y(last.n) + 4 }); lab.textContent = last.n; s.append(lab);
  for (const [i, anchor] of [[0, "start"], [points.length - 1, "end"]]) {
    const t = svg("text", { class: "axis", x: x(points[i].date), y: H - 4, "text-anchor": anchor }); t.textContent = fmt(points[i].date, { month: "short", year: "numeric" }); s.append(t);
  }
  const hair = svg("line", { class: "xhair", y1: T, y2: H - B, visibility: "hidden" });
  const pin = svg("circle", { class: "dot", r: 4, visibility: "hidden" });
  const hit = svg("rect", { class: "hit", x: L, y: T, width: W - L - R, height: H - T - B, tabindex: "0", "aria-label": `Members over time. Now ${last.n}.` });
  const at = (px) => { let best = points[0]; for (const p of points) if (x(p.date) <= px) best = p; return best; };
  const move = (e) => {
    const r = s.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), p = at(px);
    hair.setAttribute("x1", px); hair.setAttribute("x2", px); hair.setAttribute("visibility", "visible");
    pin.setAttribute("cx", x(p.date)); pin.setAttribute("cy", y(p.n)); pin.setAttribute("visibility", "visible");
    showTip(hit, tipBody(p.n, ` members by ${fmt(p.date, { day: "numeric", month: "short", year: "numeric" })}`), e.clientX, r.top + (y(p.n) / H) * r.height);
  };
  const leave = () => { hair.setAttribute("visibility", "hidden"); pin.setAttribute("visibility", "hidden"); hideTip(); };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move); hit.addEventListener("pointerleave", leave);
  hit.addEventListener("focus", () => showTip(hit, tipBody(last.n, " members today"))); hit.addEventListener("blur", leave);
  s.append(hair, pin, hit);
  box.append(s);
}

function hbars(box, rows) {
  box.replaceChildren();
  if (!rows.length) { box.append(el("p", "empty", "No books yet.")); return; }
  const max = Math.max(...rows.map((r) => r.n));
  for (const r of rows) {
    const row = el("div", "hrow");
    const tr = el("div", "track"), f = el("div", "fill");
    f.style.width = (r.n / max) * 100 + "%";
    tr.append(f);
    row.append(el("span", "n", r.label), tr, el("span", "c", r.n));
    row.title = `${r.label}: ${r.n}`;
    box.append(row);
  }
}

/* ---------- the sections ---------- */

let data = null;
let raw = null;   // the record exactly as read, for backups
const view = { status: "all", q: "", sort: "last", dir: -1 };

function kpis(a) {
  const { people, books, board } = a;
  const count = (fn) => [fn(0, 6), fn(7, 13)];
  const active = count((x, y) => people.filter((p) => p.events.some((e) => within(e, x, y))).length);
  const joined = count((x, y) => people.filter((p) => within(p.joined, x, y)).length);
  const added = count((x, y) => books.filter((b) => within(b.startedAt, x, y)).length);
  const done = count((x, y) => books.filter((b) => within(b.finishedAt, x, y)).length);
  const checks = count((x, y) => people.reduce((s, p) => s + p.days.filter((d) => within(d, x, y)).length, 0));
  const posts = count((x, y) => board.filter((p) => within(p.at, x, y)).length);
  const quiet = people.filter((p) => p.status === "quiet").length;
  const tiles = [
    { l: "Members", v: people.length, d: joined[0] ? `+${joined[0]} joined this week` : "no one new this week", hero: true },
    { l: "Active this week", v: active[0], cmp: active },
    { l: "New this week", v: joined[0], cmp: joined },
    { l: "Check-ins", v: checks[0], cmp: checks },
    { l: "Books added", v: added[0], cmp: added },
    { l: "Books finished", v: done[0], cmp: done },
    { l: "On the shelf now", v: books.filter((b) => b.status === "reading").length, d: "being read right now" },
    { l: "Gone quiet", v: quiet, d: quiet ? "see Worth a nudge" : "nobody, nice" },
  ];
  if (posts[0] || posts[1]) tiles.splice(6, 0, { l: "Agenda posts", v: posts[0], cmp: posts });
  $("kpis").replaceChildren(...tiles.map((t) => {
    const k = el("div", "kpi" + (t.hero ? " hero" : ""));
    k.append(el("span", "l", t.l), el("span", "v", t.v.toLocaleString("en-IN")));
    const d = el("span", "d");
    if (t.cmp) {
      const diff = t.cmp[0] - t.cmp[1];
      const b = el("b", diff > 0 ? "up" : diff < 0 ? "down" : null, diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : "same");
      d.append(b, document.createTextNode(` vs last week (${t.cmp[1]})`));
    } else d.textContent = t.d;
    k.append(d);
    return k;
  }));
}

function trend(a) {
  const days = Array.from({ length: 30 }, (_, i) => back(29 - i));
  const per = (fn) => days.map((d, i) => ({ value: fn(d), label: i === 29 ? "today" : fmt(d), tip: ` on ${fmt(d, { weekday: "short", day: "numeric", month: "short" })}`, accent: i === 29 }));
  columns($("c-checkins"), per((d) => a.people.filter((p) => p.days.includes(d)).length));
  columns($("c-added"), per((d) => a.books.filter((b) => b.startedAt === d).length));
  columns($("c-finished"), per((d) => a.books.filter((b) => b.finishedAt === d).length));
  const joins = a.people.map((p) => p.joined).filter(Boolean).sort();
  const pts = [];
  joins.forEach((d, i) => { if (pts.length && pts[pts.length - 1].date === d) pts[pts.length - 1].n = i + 1; else pts.push({ date: d, n: i + 1 }); });
  if (pts.length && pts[pts.length - 1].date !== TODAY) pts.push({ date: TODAY, n: joins.length });
  growth($("c-growth"), pts);
  const weeks = Array.from({ length: 12 }, (_, i) => 11 - i).map((w) => ({
    value: a.books.filter((b) => within(b.startedAt, w * 7, w * 7 + 6)).length,
    label: w === 0 ? "this wk" : fmt(back(w * 7 + 6)),
    tip: w === 0 ? " added this week" : ` added in the week of ${fmt(back(w * 7 + 6))}`, accent: w === 0,
  }));
  columns($("c-weeks"), weeks);
}

const COLS = [
  ["name", "Name"], ["status", "Status"], ["joined", "Joined"], ["last", "Last active"],
  ["streak", "Streak", 1], ["best", "Best", 1], ["checkins30", "Check-ins 30d", 1],
  ["reading", "Reading", 1], ["finished", "Finished", 1], ["lines", "Lines", 1], ["posts", "Posts", 1],
];
const ORDER = { new: 0, active: 1, cooling: 2, quiet: 3, never: 4 };

function people(a) {
  const counts = { all: a.people.length };
  for (const p of a.people) counts[p.status] = (counts[p.status] || 0) + 1;
  $("chips").replaceChildren(...["all", "new", "active", "cooling", "quiet", "never"].map((k) => {
    const b = el("button", "chip", k === "all" ? "Everyone" : STATUS[k][0]);
    b.type = "button";
    b.title = k === "all" ? "" : STATUS[k][1];
    b.setAttribute("aria-pressed", String(view.status === k));
    b.append(el("i", null, counts[k] || 0));
    b.onclick = () => { view.status = k; people(a); };
    return b;
  }));
  const q = view.q.trim().toLowerCase();
  let rows = a.people.filter((p) => (view.status === "all" || p.status === view.status) && (!q || p.name.toLowerCase().includes(q)));
  const key = (p) => view.sort === "status" ? ORDER[p.status] : view.sort === "name" ? p.name.toLowerCase() : view.sort === "last" ? -p.idle : view.sort === "joined" ? (p.joined || "") : p[view.sort];
  rows.sort((x, y) => { const a1 = key(x), b1 = key(y); return (a1 > b1 ? 1 : a1 < b1 ? -1 : 0) * view.dir || x.name.localeCompare(y.name); });
  const head = el("tr");
  for (const [k, label, num] of COLS) {
    const th = el("th", num ? "num" : null);
    const b = el("button", null, label + (view.sort === k ? (view.dir > 0 ? " ▲" : " ▼") : ""));
    b.type = "button";
    th.setAttribute("aria-sort", view.sort === k ? (view.dir > 0 ? "ascending" : "descending") : "none");
    b.onclick = () => { if (view.sort === k) view.dir = -view.dir; else { view.sort = k; view.dir = num || k === "last" ? -1 : 1; } people(a); };
    th.append(b); head.append(th);
  }
  const thead = el("thead"); thead.append(head);
  const tbody = el("tbody");
  for (const p of rows) {
    const tr = el("tr");
    const cell = (v, cls) => { const td = el("td", cls); if (v instanceof Node) td.append(v); else td.textContent = v; tr.append(td); };
    cell(p.name);
    const pill = el("span", "pill s-" + p.status, STATUS[p.status][0]); pill.title = STATUS[p.status][1]; cell(pill);
    cell(p.joined ? fmt(p.joined, { day: "numeric", month: "short", year: "numeric" }) : "—");
    const last = el("span", null, p.last ? fmt(p.last) : "—");
    if (p.last) last.append(el("span", "rel", " · " + rel(p.idle)));
    cell(last);
    for (const k of ["streak", "best", "checkins30", "reading", "finished", "lines", "posts"]) cell(p[k], "num");
    tbody.append(tr);
  }
  $("members").replaceChildren(thead, tbody);
  $("members-empty").hidden = rows.length > 0;
}
$("search").addEventListener("input", (e) => { view.q = e.target.value; if (data) people(data); });

function nudge(a) {
  const fill = (id, list, note) => {
    $(id).replaceChildren(...(list.length ? list.map((p) => { const li = el("li", null, p.name + " "); li.append(el("small", null, note(p))); return li; })
      : [el("li", null, "Nobody. Lovely.")]));
    $(id).dataset.names = list.map((p) => p.name).join(", ");
  };
  fill("n-quiet", a.people.filter((p) => p.status === "quiet").sort((x, y) => y.idle - x.idle), (p) => `· last active ${rel(p.idle)}`);
  fill("n-never", a.people.filter((p) => p.status === "never").sort((x, y) => (x.joined || "").localeCompare(y.joined || "")), (p) => `· joined ${fmt(p.joined)}`);
}
document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
  const names = $(b.dataset.copy).dataset.names || "";
  if (!names) return;
  try { await navigator.clipboard.writeText(names); b.textContent = "Copied ✓"; }
  catch { b.textContent = "Couldn't copy"; }
  setTimeout(() => { b.textContent = "Copy names"; }, 1800);
}));

function booksSection(a) {
  const tally = (key, top) => {
    const m = new Map();
    for (const b of a.books) { const k = b[key] || "Not set"; m.set(k, (m.get(k) || 0) + 1); }
    let rows = [...m].map(([label, n]) => ({ label, n })).sort((x, y) => y.n - x.n);
    if (top && rows.length > top) { const rest = rows.slice(top - 1); rows = [...rows.slice(0, top - 1), { label: `Other (${rest.length})`, n: rest.reduce((s, r) => s + r.n, 0) }]; }
    return rows;
  };
  hbars($("c-genres"), tally("genre"));
  hbars($("c-langs"), tally("lang"));
  const by = new Map();
  for (const b of a.books) {
    const k = norm(b.title);
    if (!by.has(k)) by.set(k, { title: b.title, author: b.author, who: new Set(), reading: 0, done: 0 });
    const t = by.get(k); t.who.add(b.uid); b.status === "finished" ? t.done++ : t.reading++;
  }
  const top = [...by.values()].sort((x, y) => y.who.size - x.who.size || y.reading - x.reading).slice(0, 8);
  $("top-titles").replaceChildren(...(top.length ? top.map((t) => {
    const li = el("li", null, t.title + " ");
    li.append(el("small", null, `${t.author ? "· " + t.author + " " : ""}· ${plural(t.who.size, "reader")}${t.done ? `, ${t.done} finished` : ""}`));
    return li;
  }) : [el("li", null, "No books yet.")]));
  const twins = [...by.values()].filter((t) => t.who.size > 1).length;
  const longest = a.people.reduce((m, p) => (p.streak > (m?.streak || 0) ? p : m), null);
  const mon = TODAY.slice(0, 7);
  const facts = [
    ["Public books, all time", a.books.length],
    ["Being read right now", a.books.filter((b) => b.status === "reading").length],
    ["Finished, all time", a.books.filter((b) => b.status === "finished").length],
    ["Finished this month", a.books.filter((b) => (b.finishedAt || "").startsWith(mon)).length],
    ["Titles with 2+ readers", twins],
    ["Copies on offer", a.books.filter((b) => b.lendable).length],
    ["Saved lines", a.books.filter((b) => (b.line || "").trim()).length],
    ["Books per member", a.people.length ? (a.books.length / a.people.length).toFixed(1) : "0"],
    ["On a 7+ day streak", a.people.filter((p) => p.streak >= 7).length],
    ["Longest streak now", longest ? `${longest.streak} · ${longest.name}` : "—"],
  ];
  $("misc").replaceChildren(...facts.flatMap(([k, v]) => [el("dt", null, k), el("dd", null, String(v))]));
}

function health(a) {
  const meter = (title, used, cap, unit, note, rollsOff) => {
    const pct = cap ? used / cap : 0;
    const state = rollsOff ? "ok" : pct >= 0.85 ? "bad" : pct >= 0.6 ? "warn" : "ok";
    const m = el("div", "meter" + (state === "ok" ? "" : " " + state));
    const row = el("div", "row"), left = el("div");
    left.append(el("b", null, title + " "), el("span", "state " + (state === "bad" ? "down" : state === "warn" ? "s-cooling" : "up"),
      state === "bad" ? "Act soon" : state === "warn" ? "Keep an eye" : "Fine"));
    row.append(left, el("span", "val", `${unit(used)} of ${unit(cap)} · ${(pct * 100).toFixed(pct < 0.01 ? 2 : 1)}%`));
    const tr = el("div", "track"), f = el("div", "fill");
    f.style.width = Math.max(0.5, Math.min(100, pct * 100)) + "%";
    tr.append(f);
    tr.setAttribute("role", "meter"); tr.setAttribute("aria-valuemin", "0"); tr.setAttribute("aria-valuemax", String(cap)); tr.setAttribute("aria-valuenow", String(used));
    tr.setAttribute("aria-label", title);
    m.append(row, tr, el("p", null, note));
    return m;
  };
  const kb = (n) => n >= 1024 ? `${(n / 1024).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KB` : `${n} B`;
  const num = (n) => n.toLocaleString("en-IN");
  $("meters").replaceChildren(
    meter("Shared record size", a.size, LIMIT, kb,
      "Everything public (members, books, lines, the agenda) is one record, and the database won't store one bigger than 1 MB. Past about 85%, it's time to move books into their own records."),
    meter("Books", a.books.length, BOOK_CAP, num,
      "The database rules refuse a 3,000th public book, as a guard against runaway writes. Removed books free up room."),
    meter("Agenda", a.board.length, BOARD_CAP, num,
      "The agenda keeps the newest 40 posts; older ones drop off by themselves, so a full agenda is normal.", true),
  );
  // Forecast from the last four weeks' pace.
  const perBook = a.books.length ? sizeOf(a.books) / a.books.length : 220;
  const perMember = a.people.length ? sizeOf(a.members) / a.people.length : 300;
  const booksWk = a.books.filter((b) => within(b.startedAt, 0, 27)).length / 4;
  const joinsWk = a.people.filter((p) => within(p.joined, 0, 27)).length / 4;
  const growthWk = booksWk * perBook + joinsWk * perMember;
  const toFull = LIMIT * 0.85 - a.size, toCap = (BOOK_CAP - a.books.length) / Math.max(booksWk, 1e-9);
  let text;
  if (growthWk < 1) text = "Nothing was added in the last four weeks, so the record isn't growing.";
  else {
    const weeks = Math.min(toFull / growthWk, toCap);
    const when = new Date(); when.setDate(when.getDate() + weeks * 7);
    const what = toFull / growthWk <= toCap ? "reach 85% of its size limit" : "hit the 3,000-book rule";
    text = weeks <= 0 ? `The record has already passed 85% of its limit. Time to move books into their own records.`
      : `At the last four weeks' pace (about ${booksWk.toFixed(1)} books and ${joinsWk.toFixed(1)} new members a week, ~${kb(Math.round(growthWk))} a week), the record will ${what} in about ${weeks > 104 ? Math.round(weeks / 52) + " years" : weeks > 8 ? Math.round(weeks / 4.35) + " months" : Math.round(weeks) + " weeks"}, around ${when.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.`;
  }
  $("forecast").textContent = `${text} Each book takes about ${Math.round(perBook)} bytes, each member about ${Math.round(perMember)}.`;
}

/* ---------- backup: the whole shared record, as one file ---------- */
// Exactly what the page read, untouched, plus when and how much. The
// fingerprint lets a later restore check the file wasn't altered.
async function downloadBackup() {
  if (!raw) return;
  const note = $("backup-note");
  const body = JSON.stringify(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const file = {
    kind: "pages-of-panvel-backup", version: 1,
    takenAt: now.toISOString(),
    source: "Firestore circle/public",
    sample: DEMO || undefined,
    counts: { members: Object.keys(raw.members || {}).length, books: (raw.books || []).length, agenda: (raw.board || []).length },
    bytes: docSize(raw), sha256,
    note: "Everything shared on pagesofpanvel.in. Private books are kept in each member's own record and are not included.",
    data: raw,
  };
  const stamp = now.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16).replace(" ", "-").replace(":", "");
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pages-of-panvel-backup-${stamp}${DEMO ? "-sample" : ""}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  note.textContent = `Saved · ${file.counts.members} members, ${file.counts.books} books, ${file.counts.agenda} posts`;
}
document.querySelectorAll("#backup, [data-backup]").forEach((b) => b.addEventListener("click", downloadBackup));

function render() {
  if (!data) return;
  kpis(data); trend(data); people(data); nudge(data); booksSection(data); health(data);
}
let rT = 0;
new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(() => data && trend(data), 120); }).observe($("trend"));

$("csv").addEventListener("click", () => {
  if (!data) return;
  const head = ["Name", "Status", "Joined", "Last active", "Days since active", "Streak", "Best streak", "Check-ins (30 days)", "Reading", "Finished", "Saved lines", "Agenda posts"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(",")].concat(data.people.map((p) => [p.name, STATUS[p.status][0], p.joined || "", p.last || "",
    p.idle === Infinity ? "" : p.idle, p.streak, p.best, p.checkins30, p.reading, p.finished, p.lines, p.posts].map(q).join(",")));
  // The BOM keeps Marathi and Hindi names intact when Excel opens it.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a"); a.href = URL.createObjectURL(blob); a.download = `pages-of-panvel-members-${TODAY}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ---------- getting in ---------- */

function show(which) {
  $("loading").hidden = true;
  $("gate").hidden = which !== "gate";
  $("desk").hidden = which !== "desk";
}
function live(text) { $("live").textContent = text; }
const stamp = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

async function fingerprint(email) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(email).trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

if (DEMO) {
  const { DEMO_PUBLIC } = await import("../js/demo-data.js");
  raw = structuredClone(DEMO_PUBLIC);
  data = analyse(DEMO_PUBLIC);
  show("desk");
  $("demo-note").hidden = false;
  live("Sample data");
  render();
  demoFeedback();
} else {
  const [A, U, F] = await Promise.all([import(`${V}/firebase-app.js`), import(`${V}/firebase-auth.js`), import(`${V}/firebase-firestore.js`)]);
  const app = A.initializeApp(firebaseConfig);
  const auth = U.getAuth(app), db = F.getFirestore(app);
  let unsub = null, unsubFb = null;
  $("signin").addEventListener("click", async () => {
    try { await U.signInWithPopup(auth, new U.GoogleAuthProvider()); }
    catch (e) { if (e?.code !== "auth/popup-closed-by-user") $("gate-msg").textContent = `Sign-in didn't go through${e?.code ? ` (${e.code})` : ""}. Try again?`; }
  });
  U.onAuthStateChanged(auth, async (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (unsubFb) { unsubFb(); unsubFb = null; }
    data = null; raw = null;
    if (!user) {
      $("gate-msg").textContent = "Sign in with the organiser's Google account.";
      $("signin").hidden = false;
      show("gate");
      return;
    }
    const ok = user.emailVerified && (await fingerprint(user.email)) === OWNER;
    if (!ok) {
      $("gate-msg").textContent = "This page is only for the circle's organiser. Nothing here for you, but the shelf is always open.";
      $("signin").hidden = true;
      show("gate");
      return;
    }
    show("desk");
    live("Connecting…");
    unsub = F.onSnapshot(F.doc(db, "circle", "public"),
      (snap) => { raw = snap.exists() ? snap.data() : {}; data = analyse(raw); render(); live(`Live · updated ${stamp()}`); },
      (e) => live(`Couldn't read the circle${e?.code ? ` (${e.code})` : ""}`));
    unsubFb = watchFeedback(F, db, user.uid);
  });
}
