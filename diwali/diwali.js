/* The Diwali party page: a marigold toran, phuljhadi sparks, and a
   ten-second RSVP.

   An RSVP is one document in the `rsvp` collection: { e, name, phone,
   at }, one per person. No account is needed; the database rules check every field
   and only the organisers can read them back (they appear first on the
   organiser's desk). ?demo sends nothing.                                 */

import { firebaseConfig } from "../js/config.js";

const EVENT = "diwali-2026";
const V = "https://www.gstatic.com/firebasejs/10.12.2";   // same SDK as the site
const DEMO = new URLSearchParams(location.search).has("demo");
const CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const KEY = "pop.rsvp." + EVENT;
const $ = (id) => document.getElementById(id);

/* ---------- the toran ---------- */

function toran() {
  const box = $("toran"), W = Math.max(320, box.clientWidth), H = 74;
  const swag = W < 600 ? 110 : 150, n = Math.max(2, Math.round(W / swag)), w = W / n;
  let flowers = "", leaves = "", path = "";
  for (let i = 0; i < n; i++) {
    const x0 = i * w, x1 = x0 + w, cx = x0 + w / 2, sag = 30;
    path += `M${x0} 6 Q${cx} ${6 + sag * 2} ${x1} 6 `;
    // marigolds along the curve, gold and orange in turn
    const steps = Math.round(w / 15);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) ** 2 * 6 + 2 * (1 - t) * t * (6 + sag * 2) + t * t * 6;
      const c = (i + k) % 2 ? "#FF8A1F" : "#FFB627";
      flowers += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" fill="${c}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${c === "#FFB627" ? "#E07A12" : "#C9530F"}"/>`;
    }
    // three mango leaves hanging from the low point
    const ly = 6 + sag;
    for (const [dx, rot] of [[-12, 18], [0, 0], [12, -18]]) {
      leaves += `<path d="M0 0 C7 8 7 22 0 32 C-7 22 -7 8 0 0Z" fill="#3F7A31" stroke="#24461C" stroke-width="1.5" transform="translate(${(cx + dx).toFixed(1)} ${ly + 4}) rotate(${rot})"/>`;
    }
  }
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#7A4A1A" stroke-width="2"/>${leaves}${flowers}</svg>`;
}
toran();
let tT = 0;
addEventListener("resize", () => { clearTimeout(tT); tT = setTimeout(toran, 150); });

/* ---------- phuljhadi sparks ---------- */

const cv = $("sparks"), ctx = cv.getContext("2d");
const COLORS = ["#FFB627", "#FF8A1F", "#FFF6C8", "#FF5C9A", "#F5EFE2"];
let parts = [], running = false;
function fit() { const r = devicePixelRatio || 1; cv.width = innerWidth * r; cv.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); }
fit();
addEventListener("resize", fit);

function burst(x, y, n = 28, power = 1) {
  if (CALM) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 4.5) * power;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, c: COLORS[i % COLORS.length], r: 1.2 + Math.random() * 2 });
  }
  if (!running) { running = true; requestAnimationFrame(tick); }
}
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.985; p.life -= 0.016;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  parts = parts.filter((p) => p.life > 0);
  if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
// A tap on the night sky (not on the card, a button or a field) throws a spark.
addEventListener("pointerdown", (e) => {
  if (e.target.closest(".rsvp-card, a, button, input")) return;
  burst(e.clientX, e.clientY, 22, 0.8);
});
function fireworks(times = 4) {
  for (let i = 0; i < times; i++) {
    setTimeout(() => burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.35), 40, 1.2), i * 260);
  }
}
// A small welcome over the title.
setTimeout(() => fireworks(3), 500);

/* ---------- the RSVP button: a quick ride down the page ---------- */
// An unhurried glide, so there's a glimpse of what's on the way.
// Gentle at the ends, a little quicker in the middle.
$("cta").addEventListener("click", (e) => {
  const target = $("rsvp");
  if (!target || CALM) return;   // the link's own jump does the job
  e.preventDefault();
  const from = scrollY, to = from + target.getBoundingClientRect().top - 12;
  const dur = 2000, t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    scrollTo({ top: from + (to - from) * ease(t), behavior: "instant" });
    if (t < 1) requestAnimationFrame(step);
    else {
      history.replaceState(null, "", "#rsvp");
      burst(innerWidth / 2, Math.min(innerHeight * 0.35, 260), 34, 1.1);
    }
  };
  requestAnimationFrame(step);
});

/* ---------- the RSVP ---------- */

let sending = false, fb = null;
const form = $("form"), err = $("err"), send = $("send");

// Any way people type an Indian mobile, or a number with its country code,
// becomes +<digits>. Returns "" if it can't be a WhatsApp number.
function normalPhone(raw) {
  const s = String(raw || "").trim(), plusSign = s.startsWith("+") || s.startsWith("00");
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00")) d = d.slice(2);
  if (plusSign) return d.length >= 8 && d.length <= 15 ? "+" + d : "";
  if (d.length === 11 && d[0] === "0") d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d.length === 10 && /^[6-9]/.test(d) ? "+91" + d : "";
}

function say(text, field) {
  err.textContent = text;
  err.hidden = !text;
  for (const f of [$("name"), $("phone")]) f.setAttribute("aria-invalid", String(f === field));
  if (field) field.focus();
}

function warm() {
  if (DEMO) return null;
  fb ??= Promise.all([import(`${V}/firebase-app.js`), import(`${V}/firebase-firestore.js`)])
    .then(([A, F]) => ({ F, db: F.getFirestore(A.initializeApp(firebaseConfig, "diwali")) }))
    .catch((e) => { fb = null; throw e; });
  return fb;
}
// Fetch Firebase as soon as someone starts typing, so sending is instant.
form.addEventListener("focusin", () => { warm()?.catch(() => {}); }, { once: true });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sending) return;
  const name = $("name").value.replace(/\s+/g, " ").trim().slice(0, 60);
  const phone = normalPhone($("phone").value);
  if (!name) return say("We need a name for the guest list. A nickname works too.", $("name"));
  if (!phone) return say("That doesn't look like a WhatsApp number. Try 10 digits, like 98765 43210.", $("phone"));
  say("");
  sending = true;
  send.disabled = true;
  send.firstChild.textContent = "Saving your spot… ";
  try {
    if (!DEMO) {
      const { F, db } = await warm();
      const write = F.addDoc(F.collection(db, "rsvp"), { e: EVENT, name, phone, at: F.serverTimestamp() });
      await Promise.race([write, new Promise((_, no) => setTimeout(() => no(Object.assign(new Error("timeout"), { code: "timeout" })), 15000))]);
    }
    try { localStorage.setItem(KEY, JSON.stringify({ name })); } catch { /* private mode: fine */ }
    showDone(name, false);
    fireworks(6);
  } catch (e2) {
    say(e2?.code === "permission-denied"
      ? "RSVPs aren't open just yet. Try again in a little while, or message the organisers on WhatsApp."
      : "That didn't go through. Check your connection and tap again; what you typed is still here.");
  } finally {
    sending = false;
    send.disabled = false;
    send.firstChild.textContent = "Count me in ";
  }
});

function showDone(name, before) {
  const first = name.split(" ")[0];
  $("done-h").textContent = before ? `You're already in, ${first}!` : `You're on the list, ${first}!`;
  $("done-p").textContent = "See you at My Baagaan on Sunday at 2 pm. Start planning the outfit." + (DEMO ? " (Demo: nothing was sent.)" : "");
  form.hidden = true;
  $("done").hidden = false;
}

$("again").addEventListener("click", () => {
  form.reset();
  $("done").hidden = true;
  form.hidden = false;
  $("name").focus();
});

$("share").href = "https://wa.me/?text=" + encodeURIComponent(
  "I'm going to the Pages of Panvel Diwali party on Sunday, 1 November, 2 pm at My Baagaan 🪔✨ Come along! RSVP in ten seconds: https://pagesofpanvel.in/diwali/");

// Back on the page after RSVPing: say so, with a way to add someone else.
try {
  const prev = JSON.parse(localStorage.getItem(KEY) || "null");
  if (prev?.name && !DEMO) showDone(prev.name, true);
} catch { /* nothing remembered */ }
