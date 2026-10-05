/* Reader feedback on the organiser's desk: the /quiz answers, summarised.

   Reads the `feedback` collection, which the rules only let the organiser
   read (by account ID, see firestore.rules). Read-only like the rest of
   the desk. If the rules haven't been published yet, it says exactly what
   to paste, with the organiser's own account ID filled in.              */

import { QUESTIONS, PATHS, KEYS } from "../quiz/questions.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const box = () => document.getElementById("fb");
const SHORT = { regular: "Comes often", sometimes: "Comes sometimes", never: "Not yet" };
const view = { path: "all" };
let rows = [], uidForSetup = "", roleForSetup = "owner";

function hbars(target, list) {
  const max = Math.max(1, ...list.map((r) => r.n));
  for (const r of list) {
    const row = el("div", "hrow"), tr = el("div", "track"), f = el("div", "fill");
    f.style.width = (r.n / max) * 100 + "%";
    tr.append(f);
    row.append(el("span", "n", r.label), tr, el("span", "c", r.n));
    row.title = `${r.label}: ${r.n}`;
    target.append(row);
  }
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");

function kpi(label, value, note, hero) {
  const k = el("div", "kpi" + (hero ? " hero" : ""));
  k.append(el("span", "l", label), el("span", "v", value), el("span", "d", note));
  return k;
}

function render() {
  const root = box();
  root.replaceChildren();
  if (!rows.length) {
    const p = el("div", "empty-note", "No answers yet. Share pagesofpanvel.in/quiz on WhatsApp and Instagram, and they'll start appearing here, live.");
    root.append(p);
    return;
  }
  const mine = view.path === "all" ? rows : rows.filter((r) => r.path === view.path);

  // filters + downloads
  const tools = el("div", "fb-tools"), chips = el("div", "chips");
  for (const k of ["all", ...Object.keys(PATHS)]) {
    const n = k === "all" ? rows.length : rows.filter((r) => r.path === k).length;
    const b = el("button", "chip", k === "all" ? "Everyone" : SHORT[k]);
    b.type = "button";
    b.setAttribute("aria-pressed", String(view.path === k));
    b.append(el("i", null, n));
    b.onclick = () => { view.path = k; render(); };
    chips.append(b);
  }
  const csv = el("button", "btn ghost", "Download answers (CSV)");
  csv.type = "button";
  csv.onclick = () => download(mine);
  tools.append(chips, csv);
  root.append(tools);

  // headline numbers
  const came = mine.filter((r) => r.path !== "never"), never = mine.filter((r) => r.path === "never");
  const ratings = came.map((r) => r.a.rating).filter((x) => typeof x === "number");
  const nps = came.map((r) => r.a.nps).filter((x) => typeof x === "number");
  const npsScore = nps.length ? Math.round(((nps.filter((x) => x >= 9).length - nps.filter((x) => x <= 6).length) / nps.length) * 100) : null;
  const welcome = came.filter((r) => r.a.welcome);
  const likely = never.filter((r) => r.a.likely);
  const k = el("div", "kpis");
  k.append(
    kpi("Answers", mine.length, `${rows.filter((r) => r.path === "regular").length} often · ${rows.filter((r) => r.path === "sometimes").length} sometimes · ${rows.filter((r) => r.path === "never").length} not yet`, true),
    kpi("Overall rating", ratings.length ? (ratings.reduce((s, x) => s + x, 0) / ratings.length).toFixed(1) + " / 5" : "—", `from ${ratings.length} who've come`),
    kpi("Recommend score", npsScore == null ? "—" : (npsScore > 0 ? "+" : "") + npsScore, nps.length ? `NPS, from ${nps.length}: % 9–10 minus % 0–6` : "no answers yet"),
    kpi("Feel welcome", pct(welcome.filter((r) => r.a.welcome === "yes").length, welcome.length), `"yes, definitely", of ${welcome.length}`),
    kpi("Likely to come", pct(likely.filter((r) => ["likely", "yes"].includes(r.a.likely)).length, likely.length), `of ${likely.length} who haven't come yet`),
  );
  root.append(k);

  // one card per question
  const grid = el("div", "fb-grid");
  grid.style.marginTop = "12px";
  for (const q of QUESTIONS) {
    if (q.id === "path" || q.type === "text") continue;
    const ans = mine.filter((r) => r.a[q.id] !== undefined);
    if (!ans.length) continue;
    const card = el("div", "card");
    card.append(el("p", "fb-q", q.q));
    let who = q.paths.length === 3 ? "everyone" : q.paths.map((p) => SHORT[p].toLowerCase()).join(" & ");
    if (q.also) who += ", and anyone the time doesn't suit";
    card.append(el("p", "fb-n", `${ans.length} answered · asked of ${who}${q.type === "multi" ? " · could pick several" : ""}`));
    const bars = el("div", q.type === "scale" || q.type === "nps" ? "hbars" : "hbars long");
    if (q.type === "scale" || q.type === "nps") {
      const lo = q.type === "nps" ? 0 : 1, hi = q.type === "nps" ? 10 : q.max;
      const vals = ans.map((r) => r.a[q.id]);
      card.append(el("p", "fb-avg", `${(vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(1)} average`));
      hbars(bars, Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: String(hi - i), n: vals.filter((v) => v === hi - i).length })));
    } else {
      const list = q.options.map(([v, label]) => ({ label, n: ans.filter((r) => (Array.isArray(r.a[q.id]) ? r.a[q.id].includes(v) : r.a[q.id] === v)).length }));
      hbars(bars, list.sort((a, b) => b.n - a.n));
    }
    card.append(bars);
    const others = mine.filter((r) => (r.a[q.id + "Other"] || "").trim());
    if (others.length) {
      card.append(el("p", "fb-n", `Something else (${others.length}):`));
      card.append(notesList(others.map((r) => ({ text: r.a[q.id + "Other"], r }))));
    }
    grid.append(card);
  }
  root.append(grid);

  // what people wrote
  for (const q of QUESTIONS.filter((x) => x.type === "text")) {
    const said = mine.filter((r) => (r.a[q.id] || "").trim());
    const card = el("div", "card");
    card.style.marginTop = "12px";
    card.append(el("p", "fb-q", q.q), el("p", "fb-n", said.length ? `${said.length} wrote something, newest first` : "Nothing written yet."));
    if (said.length) card.append(notesList(said.map((r) => ({ text: r.a[q.id], r }))));
    root.append(card);
  }
}

// Newest few first; the rest behind a button, so long lists don't bury the page.
function notesList(items, shown = 6) {
  const wrap = el("div"), ul = el("ul", "notes");
  for (const { text, r } of items) {
    const li = el("li", null, text);
    li.append(el("span", "meta", `${SHORT[r.path]} · ${r.at ? r.at.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "just now"}`));
    li.hidden = ul.children.length >= shown;
    ul.append(li);
  }
  wrap.append(ul);
  if (items.length > shown) {
    const more = el("button", "btn ghost small", `Show all ${items.length}`);
    more.type = "button";
    more.onclick = () => { for (const li of ul.children) li.hidden = false; more.remove(); };
    wrap.append(more);
  }
  return wrap;
}

function download(list) {
  const head = ["When", "Has come", ...KEYS];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(",")].concat(list.map((r) => [
    r.at ? r.at.toISOString() : "", PATHS[r.path] || r.path,
    ...KEYS.map((k) => (Array.isArray(r.a[k]) ? r.a[k].join("; ") : r.a[k])),
  ].map(q).join(",")));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a"); a.href = URL.createObjectURL(blob);
  a.download = `pages-of-panvel-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function setup(code) {
  const root = box();
  if (roleForSetup === "co") {
    root.replaceChildren(el("div", "setup", code === "permission-denied"
      ? "Reader feedback isn't open to co-organisers yet. The circle's owner needs to publish the updated database rules; then it appears here by itself."
      : "The answers couldn't be read just now. Try again in a bit."));
    return;
  }
  const s = el("div", "setup");
  s.append(el("b", null, "One step left before answers show here."));
  s.append(el("p", null, code === "permission-denied"
    ? "The quiz's rules aren't published yet, or they don't know your account. Open the Firebase console → Firestore → Rules, paste in firestore.rules from the site, and replace ORGANISER_UID with your account ID:"
    : "The answers couldn't be read just now. If this keeps happening, check the Firestore rules include the feedback block, with ORGANISER_UID replaced by your account ID:"));
  const c = el("code", null, uidForSetup || "(sign in to see it)");
  const copy = el("button", "btn ghost small", "Copy my account ID");
  copy.type = "button";
  copy.onclick = async () => { try { await navigator.clipboard.writeText(uidForSetup); copy.textContent = "Copied ✓"; } catch { copy.textContent = "Couldn't copy"; } };
  s.append(c, copy, el("p", "fb-n", "Then publish. The quiz itself starts accepting answers at the same moment."));
  root.replaceChildren(s);
}

// Live mode: called once the organiser is signed in and verified.
export function watchFeedback(F, db, uid, role = "owner") {
  uidForSetup = uid;
  roleForSetup = role;
  return F.onSnapshot(F.collection(db, "feedback"),
    (snap) => {
      rows = snap.docs.map((d) => { const x = d.data(); return { id: d.id, path: x.path, a: x.a || {}, at: x.at?.toDate ? x.at.toDate() : null }; })
        .sort((p, q) => (q.at || 0) - (p.at || 0));
      render();
    },
    (e) => setup(e?.code));
}

// ?demo: made-up answers, so the section can be seen before anyone replies.
export function demoFeedback() {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const any = (opts) => opts[Math.floor(rnd() * opts.length)][0];
  const some = (opts, max) => [...new Set(Array.from({ length: 1 + Math.floor(rnd() * max) }, () => any(opts)))];
  const lines = ["More silent reading, less chit-chat at the start", "A shaded spot when it gets hot", "Book swaps every month!",
    "Introduce new people to a few regulars", "A Marathi books Sunday", "Start at 9 instead", "Honestly it's perfect"];
  rows = Array.from({ length: 46 }, (_, i) => {
    const path = ["regular", "regular", "sometimes", "sometimes", "never"][i % 5];
    const a = {};
    for (const q of QUESTIONS) {
      const asked = q.paths.includes(path) || (q.also && Object.entries(q.also).every(([k, v]) => v.includes(a[k])));
      if (q.id === "path" || !asked || (!q.required && rnd() < 0.25)) continue;
      if (q.type === "single") a[q.id] = any(q.options);
      if (q.type === "multi") a[q.id] = some(q.options, q.max);
      if (q.type === "scale") a[q.id] = 3 + Math.floor(rnd() * 3);
      if (q.type === "nps") a[q.id] = 6 + Math.floor(rnd() * 5);
      if (q.type === "text" && rnd() < 0.4) a[q.id] = lines[Math.floor(rnd() * lines.length)];
    }
    const at = new Date(); at.setHours(at.getHours() - i * 7);
    return { id: "d" + i, path, a, at };
  });
  render();
}
