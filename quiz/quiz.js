/* The quiz: one question a screen, most of them a single tap.

   Answers stay in memory until the very end, then go to Firestore as ONE
   anonymous document in the `feedback` collection: no sign-in, no name, no
   account ID. It never touches circle/public or anything else the site
   uses. The rules (firestore.rules, generated from questions.js) accept a
   response only if every answer is one of the quiz's own options.

   ?demo runs the whole thing without sending anything.                    */

import { QUESTIONS, PATHS, PERSONAS, VERSION, TEXT_MAX } from "./questions.js";
import { firebaseConfig } from "../js/config.js";

const DEMO = new URLSearchParams(location.search).has("demo");
const V = "https://www.gstatic.com/firebasejs/10.12.2";   // same SDK as the site
const INSTA = "https://www.instagram.com/pagesofpanvel?stkn=ejZuc3VsaTRxdW0=";
const INKS = ["#FF6B4A", "#FFA62B", "#FFE03D", "#D4E84A", "#9BE04F", "#4FD97E", "#3ED9B0",
  "#35D2D2", "#4BC4F5", "#7FA8FF", "#A87FFF", "#D97FF5", "#FF6FB5", "#FF5C7A"];
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const answers = {};
let path = null, at = -1, sending = false, sent = false;

// The questions this person will see, in order. The first answer decides.
const flow = () => QUESTIONS.filter((q) => q.id === "path" || (path && q.paths.includes(path)));

/* ---------- Firebase, fetched quietly while they answer ---------- */

let fb = null;
function warm() {
  if (DEMO) return;
  fb ??= Promise.all([import(`${V}/firebase-app.js`), import(`${V}/firebase-firestore.js`)])
    .then(([A, F]) => ({ F, db: F.getFirestore(A.initializeApp(firebaseConfig, "quiz")) }))
    .catch((e) => { fb = null; throw e; });
  return fb;
}

/* ---------- the progress shelf ---------- */

function paintTop() {
  const list = flow(), shown = at >= 0 && !sent;
  $("top").hidden = !shown;
  if (!shown) return;
  const shelf = $("shelf");
  const want = Math.min(at, list.length);
  while (shelf.children.length > want) shelf.lastChild.remove();
  while (shelf.children.length < want) {
    const k = shelf.children.length, i = el("i");
    i.style.background = INKS[(k * 5) % INKS.length];
    i.style.height = 22 + ((k * 37) % 19) + "px";
    shelf.append(i);
  }
  $("count").textContent = `${Math.min(at + 1, list.length)} / ${path ? list.length : "…"}`;
  $("back").disabled = at <= 0;
}

/* ---------- screens ---------- */

function screen(cls, dirBack) {
  const s = el("section", "screen " + cls + (dirBack ? " back-in" : ""));
  $("stage").replaceChildren(s);
  window.scrollTo(0, 0);
  return s;
}

let advanceT = 0;
function next() { clearTimeout(advanceT); go(at + 1); }
function soon() { clearTimeout(advanceT); advanceT = setTimeout(next, RM() ? 60 : 280); }

function go(i, dirBack = false, fromHistory = false) {
  const list = flow();
  if (i >= list.length) { if (!fromHistory) submit(); return; }
  at = i;
  if (!fromHistory) history.pushState({ q: i }, "");
  ask(list[i], dirBack);
  paintTop();
}

const introNode = $("intro");
function intro() {
  clearTimeout(advanceT);
  $("stage").replaceChildren(introNode);
}

function ask(q, dirBack) {
  const s = screen("ask", dirBack);
  const last = flow().indexOf(q) === flow().length - 1 && q.id !== "path";
  const label = (filled) => (last ? "Send it ✦" : filled ? "Next →" : "Skip →");
  s.append(el("p", "kick", q.kicker || "Pages of Panvel"), el("h2", "q", q.q));
  const nav = el("div", "nav");
  const nextBtn = el("button", "go", label(true));
  nextBtn.type = "button";
  nextBtn.onclick = next;
  const skip = el("button", "skip", "Skip");
  skip.type = "button";
  skip.onclick = () => { delete answers[q.id]; delete answers[q.id + "Other"]; next(); };

  if (q.type === "single") {
    let otherBox = null;
    const opts = el("div", "opts");
    q.options.forEach(([v, text], n) => {
      const b = el("button", "opt");
      b.type = "button";
      b.setAttribute("aria-pressed", String(answers[q.id] === v));
      b.append(el("span", "k", n + 1), document.createTextNode(text));
      b.onclick = () => {
        answers[q.id] = v;
        if (q.id === "path") path = v;
        opts.querySelectorAll(".opt").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        nextBtn.disabled = false;
        paintTop();
        if (otherBox) {
          otherBox.hidden = v !== "other";
          if (v === "other") { otherBox.querySelector("input").focus(); return; }
        }
        soon();
      };
      opts.append(b);
    });
    s.append(opts);
    if (q.other) { otherBox = otherField(q, answers[q.id] !== "other"); s.append(otherBox); }
    // A tap moves on by itself; Next is there for "something else", and for
    // anyone who came back to change an answer.
    nextBtn.disabled = !(q.id in answers);
    if (q.other || q.id in answers) nav.append(nextBtn);
    if (!q.required) nav.append(skip);
  }

  if (q.type === "multi") {
    s.append(el("p", "hint", q.max < q.options.length ? `Pick up to ${q.max}.` : "Pick as many as you like."));
    const picked = new Set(answers[q.id] || []);
    const opts = el("div", "opts chips");
    const sync = () => {
      opts.querySelectorAll(".opt").forEach((x) => {
        const on = picked.has(x.dataset.v);
        x.setAttribute("aria-checked", String(on));
        x.classList.toggle("full", !on && picked.size >= q.max);
      });
      if (picked.size) answers[q.id] = [...picked]; else delete answers[q.id];
      nextBtn.textContent = label(picked.size > 0 || !!answers[q.id + "Other"]);
    };
    q.options.forEach(([v, text], n) => {
      const b = el("button", "opt");
      b.type = "button";
      b.setAttribute("role", "checkbox");
      b.dataset.v = v;
      b.append(el("span", "k", n + 1), document.createTextNode(text));
      b.onclick = () => {
        if (picked.has(v)) picked.delete(v);
        else if (picked.size < q.max) picked.add(v);
        else if (!RM() && b.animate) b.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], 220);
        sync();
      };
      opts.append(b);
    });
    s.append(opts);
    if (q.other) s.append(otherField(q, false, sync));
    sync();
    nav.append(nextBtn);
  }

  if (q.type === "scale" || q.type === "nps") {
    const lo = q.type === "nps" ? 0 : 1, hi = q.type === "nps" ? 10 : q.max;
    const wrap = el("div", "scale");
    const row = el("div", "row");
    row.style.gridTemplateColumns = `repeat(${q.type === "nps" ? 6 : hi}, minmax(0,1fr))`;
    for (let v = lo; v <= hi; v++) {
      const b = el("button", null, v);
      b.type = "button";
      b.setAttribute("aria-pressed", String(answers[q.id] === v));
      b.setAttribute("aria-label", `${v}${v === lo ? ", " + q.low : v === hi ? ", " + q.high : ""}`);
      b.onclick = () => {
        answers[q.id] = v;
        row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        soon();
      };
      row.append(b);
    }
    const ends = el("div", "ends");
    ends.append(el("span", null, `${lo} · ${q.low}`), el("span", null, `${q.high} · ${hi}`));
    wrap.append(row, ends);
    s.append(wrap);
    if (q.id in answers) nav.append(nextBtn);
  }

  if (q.type === "text") {
    const t = el("textarea", "field");
    t.maxLength = TEXT_MAX;
    t.placeholder = q.placeholder || "";
    t.value = answers[q.id] || "";
    t.setAttribute("aria-label", q.q);
    const left = el("p", "left");
    const sync = () => {
      if (t.value.trim()) answers[q.id] = t.value; else delete answers[q.id];
      left.textContent = `${TEXT_MAX - t.value.length} left`;
      nextBtn.textContent = label(!!t.value.trim());
    };
    t.oninput = sync;
    s.append(t, left);
    sync();
    nav.append(nextBtn);
    setTimeout(() => t.focus({ preventScroll: true }), 50);
  }

  s.append(nav);
}

function otherField(q, hidden, onChange) {
  const box = el("div", "other");
  box.hidden = hidden;
  const inp = el("input", "field");
  inp.type = "text";
  inp.maxLength = TEXT_MAX;
  inp.placeholder = "Something else…";
  inp.setAttribute("aria-label", "Something else");
  inp.value = answers[q.id + "Other"] || "";
  inp.oninput = () => { if (inp.value.trim()) answers[q.id + "Other"] = inp.value; else delete answers[q.id + "Other"]; onChange?.(); };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } };
  box.append(inp);
  return box;
}

/* ---------- sending ---------- */

function payload() {
  const a = {};
  for (const q of flow()) {
    if (q.id === "path") continue;
    const v = answers[q.id];
    if (q.type === "text") { if (v && v.trim()) a[q.id] = v.trim().slice(0, TEXT_MAX); }
    else if (q.type === "multi") { if (v && v.length) a[q.id] = v.slice(0, q.max); }
    else if (v !== undefined) a[q.id] = v;
    const o = (answers[q.id + "Other"] || "").trim();
    if (q.other && o && (q.type === "multi" || v === "other")) a[q.id + "Other"] = o.slice(0, TEXT_MAX);
  }
  return a;
}

async function submit() {
  if (sending || sent) return;
  sending = true;
  at = flow().length;
  paintTop();
  const s = screen("sending");
  s.append(el("p", "kick", "Almost there"), el("h2", "q", "Putting your answers on the shelf…"));
  try {
    if (!DEMO) {
      const { F, db } = await warm();
      const write = F.addDoc(F.collection(db, "feedback"), { v: VERSION, path, a: payload(), at: F.serverTimestamp() });
      await Promise.race([write, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 15000))]);
    }
    sent = true;
    history.replaceState({ done: true }, "");
    done();
  } catch (e) {
    sending = false;
    const err = el("p", "err", e?.code === "permission-denied"
      ? "The circle isn't taking answers just yet. Please try again a bit later."
      : "That didn't go through. Check your connection and try again; your answers are still here.");
    const retry = el("button", "go", "Try again →");
    retry.type = "button";
    retry.onclick = submit;
    const nav = el("div", "nav"); nav.append(retry);
    s.append(err, nav);
  }
}

function done() {
  paintTop();
  const [name, line] = PERSONAS[answers.vibe] || ["A True Reader", "Every kind of book, every kind of Sunday."];
  const s = screen("done");
  s.append(el("p", "kick", DEMO ? "Test mode · nothing was sent" : "Sent · thank you"));
  const card = el("div", "persona");
  card.append(el("small", null, "Your reader type"), el("h2", null, name), el("p", null, line));
  s.append(card);
  const tail = { regular: "See you Sunday, 8:30am in the park.", sometimes: "Come say hi again soon. Sunday, 8:30am, the park.",
    never: "Your first Sunday is waiting: 8:30am, the park. Bring any book." }[path];
  s.append(el("p", "thanks", `Thank you. Every answer gets read, and it shapes what Pages of Panvel does next. ${tail}`));
  const links = el("div", "links");
  const a1 = el("a", "red", "Open the shelf →"); a1.href = "../";
  const a2 = el("a", null, "@pagesofpanvel"); a2.href = INSTA; a2.target = "_blank"; a2.rel = "noopener";
  links.append(a1, a2);
  s.append(links);
  const mail = el("p", "mail", "Want to talk it through, collaborate, or just say hello? ");
  const m = el("a", null, "pagesofpanvel1@gmail.com"); m.href = "mailto:pagesofpanvel1@gmail.com";
  mail.append(m);
  s.append(mail);
  if (!RM()) confetti(card);
}

function confetti(from) {
  const r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + 20;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div"), w = 6 + Math.random() * 6;
    Object.assign(p.style, { position: "fixed", left: cx + "px", top: cy + "px", width: w + "px", height: w * 1.8 + "px",
      background: INKS[i % INKS.length], border: "1.5px solid #241D18", zIndex: 50, pointerEvents: "none" });
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 200;
    p.animate([{ transform: "translate(-50%,-50%)", opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 60}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${Math.cos(a) * d * 1.2}px,${Math.sin(a) * d + 180}px) rotate(${Math.random() * 900}deg)`, opacity: 0 }],
    { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

/* ---------- wiring ---------- */

$("start").onclick = () => { warm()?.catch(() => {}); go(0); };
$("back").onclick = () => history.back();
// The phone's back button steps back a question, and never undoes a send.
addEventListener("popstate", (e) => {
  if (sent) { history.pushState({ done: true }, ""); return; }
  if (sending) return;
  const i = e.state?.q;
  if (typeof i !== "number" || i < 0) { at = -1; intro(); paintTop(); return; }
  go(i, true, true);
});
// Number keys pick, Enter moves on.
addEventListener("keydown", (e) => {
  if (at < 0 || sent || e.target.matches("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = parseInt(e.key, 10);
  if (!isNaN(n)) {
    const btns = $("stage").querySelectorAll(".opt, .scale button");
    const b = $("stage").querySelector(".scale") ? [...btns].find((x) => x.textContent === String(n)) : btns[n - 1];
    if (b) { e.preventDefault(); b.click(); }
  } else if (e.key === "Enter") {
    const g = $("stage").querySelector(".nav .go:not(:disabled)");
    if (g) { e.preventDefault(); g.click(); }
  }
});
history.replaceState({ q: -1 }, "");
