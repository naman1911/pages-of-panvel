/* The guide's moving parts.

   The phone in "Take the tour" is a working copy of the site with Nitya
   signed in: same tabs, same labels, same rules (one check-in a day, only
   your own agenda posts can be deleted, private books stay off the shelf).
   It runs on sample data in memory. Nothing is saved, nothing talks to
   Firebase.

   The brag and circle cards further down are the real ones: drawn by the
   site's own card engine (js/brag*.js) from Nitya's pile, so changing her
   pile in the phone changes her cards. That engine and its fonts are only
   fetched when you scroll near the cards.                                  */

/* ---------- the site's own helpers, as app.js has them ---------- */

const INKS = ["#FF6B4A", "#FFA62B", "#FFE03D", "#D4E84A", "#9BE04F", "#4FD97E", "#3ED9B0",
  "#35D2D2", "#4BC4F5", "#7FA8FF", "#A87FFF", "#D97FF5", "#FF6FB5", "#FF5C7A"];
const GENRES = ["Fiction", "Poetry", "History", "Memoir", "Crime", "Sci-fi & fantasy",
  "Philosophy", "Science", "Essays", "Graphic novel", "Children's", "Other"];
const LANGS = ["English", "मराठी", "हिंदी", "Other"];
const CHEERS = ["Another day on the books.", "The streak lives.", "Panvel reads on.",
  "Look at you go.", "That's a page more than yesterday.", "Sunday will be proud."];
const ODD = { days: "day", shelves: "shelf", books: "book", readers: "reader" };
const plural = (n, w) => (n === 1 ? ODD[w] || w.replace(/s$/, "") : w);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").toLowerCase()
  .replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9ऀ-ॿ ]/g, "").trim();
function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}
const inkFor = (s) => INKS[hash(s) % INKS.length];
const heightFor = (s) => 124 + (hash(s + "h") % 72);
const iso = (d) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const d = (back) => { const x = new Date(); x.setDate(x.getDate() - back); return iso(x); };
const run = (n, skip = 0) => Array.from({ length: n }, (_, i) => d(i + skip));
function streakOf(days = []) {
  if (!days.length) return 0;
  const set = new Set(days), x = new Date();
  if (!set.has(iso(x))) x.setDate(x.getDate() - 1);
  let n = 0;
  while (set.has(iso(x))) { n++; x.setDate(x.getDate() - 1); }
  return n;
}
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); out.push(iso(x)); }
  return out;
}
function nextSunday() {
  const x = new Date();
  x.setDate(x.getDate() + ((7 - x.getDay()) % 7));
  return x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th");
const $ = (id) => document.getElementById(id);
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Nitya's circle ---------- */

const ME = "u-nitya";
const MAP = "https://maps.app.goo.gl/gA22uyNNkYt5wncP7?g_st=ac";
const INSTA = "https://www.instagram.com/pagesofpanvel?stkn=ejZuc3VsaTRxdW0=";
const GCAL = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Pages%20of%20Panvel%20%C2%B7%20Sunday%20reading%20circle&dates=20261004T083000%2F20261004T100000&ctz=Asia%2FKolkata&recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3DSU&location=The%20park%2C%20Panvel&details=Bring%20whatever%20you%27re%20reading.%0A%0ADirections%3A%20https%3A%2F%2Fmaps.app.goo.gl%2FgA22uyNNkYt5wncP7%3Fg_st%3Dac%0AThe%20shelf%3A%20https%3A%2F%2Fpagesofpanvel.in%0AInstagram%3A%20https%3A%2F%2Fwww.instagram.com%2Fpagesofpanvel%3Fstkn%3DejZuc3VsaTRxdW0%3D";
// Brand marks from Simple Icons (CC0).
const ICON = {'maps': '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z"/></svg>', 'ig': '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>', 'apple': '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>', 'gcal': '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z"/></svg>'};
let seq = 100;
const B = (uid, title, author, genre, lang, status, started, extra = {}) => ({
  id: "b" + (seq++), uid, title, author, genre, lang, status, startedAt: d(started),
  finishedAt: status === "finished" ? d(extra.done ?? Math.max(0, started - 5)) : undefined,
  line: extra.line || "", lendable: !!extra.lend,
});

const S = {
  tab: "shelf",
  members: {
    "u-nitya": { name: "Nitya", days: run(6, 1) },
    "u-vineet": { name: "Vineet", days: run(23) },
    "u-ronit": { name: "Ronit", days: run(12) },
    "u-rishikesh": { name: "Rishikesh", days: run(33) },
    "u-vaishnavi": { name: "Vaishnavi", days: run(41) },
    "u-anushka": { name: "Anushka", days: run(9) },
    "u-siddhi": { name: "Siddhi", days: run(18) },
    "u-yugandhar": { name: "Yugandhar", days: run(4, 2) },
  },
  books: [
    B(ME, "कोसला", "भालचंद्र नेमाडे", "Fiction", "मराठी", "reading", 9),
    B(ME, "Collected Poems", "Arun Kolatkar", "Poetry", "English", "reading", 2),
    B(ME, "Pachinko", "Min Jin Lee", "Fiction", "English", "finished", 44, { done: 12, line: "History has failed us, but no matter." }),
    B(ME, "बटाट्याची चाळ", "पु. ल. देशपांडे", "Essays", "मराठी", "finished", 70, { done: 40, lend: true }),
    B("u-ronit", "कोसला", "भालचंद्र नेमाडे", "Fiction", "मराठी", "reading", 5),
    B("u-ronit", "Kafka on the Shore", "Haruki Murakami", "Fiction", "English", "reading", 14),
    B("u-ronit", "The Argumentative Indian", "Amartya Sen", "Essays", "English", "finished", 60, { done: 30 }),
    B("u-vaishnavi", "गुनाहों का देवता", "धर्मवीर भारती", "Fiction", "हिंदी", "reading", 4, { lend: true }),
    B("u-vaishnavi", "Persepolis", "Marjane Satrapi", "Graphic novel", "English", "finished", 30, { done: 16 }),
    B("u-vaishnavi", "मधुशाला", "हरिवंशराय बच्चन", "Poetry", "हिंदी", "finished", 50, { done: 35 }),
    B("u-vineet", "A Fine Balance", "Rohinton Mistry", "Fiction", "English", "finished", 40, { done: 8, lend: true }),
    B("u-vineet", "Sapiens", "Yuval Noah Harari", "History", "English", "reading", 6),
    B("u-vineet", "Maus", "Art Spiegelman", "Graphic novel", "English", "finished", 70, { done: 50 }),
    B("u-siddhi", "The Enchantress of Florence", "Salman Rushdie", "Fiction", "English", "reading", 7,
      { line: "A story is a map of the places a person is afraid to go." }),
    B("u-siddhi", "Silent Spring", "Rachel Carson", "Science", "English", "finished", 28, { done: 9, lend: true }),
    B("u-rishikesh", "Collected Poems", "Arun Kolatkar", "Poetry", "English", "reading", 11, { lend: true }),
    B("u-rishikesh", "Annapurna", "Maurice Herzog", "Memoir", "English", "finished", 45, { done: 20 }),
    B("u-anushka", "Maus", "Art Spiegelman", "Graphic novel", "English", "finished", 26, { done: 3, lend: true }),
    B("u-anushka", "The Sea Around Us", "Rachel Carson", "Science", "English", "reading", 10),
    B("u-anushka", "Midnight's Children", "Salman Rushdie", "Fiction", "English", "finished", 90, { done: 55 }),
    B("u-yugandhar", "Piranesi", "Susanna Clarke", "Fiction", "English", "reading", 3),
    B("u-yugandhar", "The Tale of Genji", "Murasaki Shikibu", "Fiction", "English", "reading", 20),
  ],
  priv: [B(ME, "The Year of Magical Thinking", "Joan Didion", "Memoir", "English", "reading", 8)]
    .map((b) => ({ ...b, isPrivate: true })),
  board: [
    { id: "p1", uid: "u-ronit", text: "कोसला: is Pandurang a hero or just tired? Let's fight about it." },
    { id: "p2", uid: "u-rishikesh", text: "Reading out two Kolatkar poems. Bring chai." },
    { id: "p3", uid: "u-anushka", text: "Can't stop recommending Maus. Vineet and I will bring copies." },
  ],
  filters: { mine: false, lendable: false, genre: null, lang: null },
  showFilters: false, showAdd: false, editing: null, justFinished: null, addErr: "",
};
const me = () => S.members[ME];
const myPublic = () => S.books.filter((b) => b.uid === ME);
const allMine = () => [...myPublic(), ...S.priv];
const who = (uid) => S.members[uid]?.name || "a reader";
function titleCounts() {
  const c = {};
  S.books.forEach((b) => { c[norm(b.title)] = (c[norm(b.title)] || 0) + 1; });
  return c;
}
function myTwins() {
  return myPublic().filter((b) => b.status === "reading")
    .map((b) => ({ book: b, others: S.books.filter((o) => o.uid !== ME && norm(o.title) === norm(b.title)) }))
    .filter((t) => t.others.length);
}
let changed = () => {};            // set once the brag cards exist
function touch() { changed(); }

/* ---------- little effects ---------- */

function wiggle(el, big) {
  if (!el || RM() || !el.animate) return;
  el.animate(big
    ? [{ transform: "rotate(0)" }, { transform: "rotate(-16deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(-2deg)" }, { transform: "rotate(0)" }]
    : [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0)" }],
  { duration: big ? 650 : 380, easing: "cubic-bezier(.3,1.4,.5,1)" });
}
function confetti(el) {
  if (RM() || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 44; i++) {
    const p = document.createElement("div"), w = 6 + Math.random() * 6;
    Object.assign(p.style, { position: "fixed", left: cx + "px", top: cy + "px", width: w + "px", height: w * 1.8 + "px",
      background: INKS[i % INKS.length], border: "1.5px solid #241D18", zIndex: 9999, pointerEvents: "none" });
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 220;
    p.animate([
      { transform: "translate(-50%,-50%) rotate(0)", opacity: 1 },
      { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist - 60}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${Math.cos(a) * dist * 1.2}px,${Math.sin(a) * dist + 160}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}
let partyT;
function party(msg) {
  $("p-party-msg").textContent = msg;
  $("p-party").hidden = false;
  clearTimeout(partyT);
  partyT = setTimeout(() => { $("p-party").hidden = true; }, 2400);
}
let cheerT;
function cheer(n, line) {
  $("cheer-n").textContent = n;
  $("cheer-t").textContent = n === 1 ? "day running!" : "days straight!";
  $("cheer-l").textContent = line;
  $("cheer").hidden = false;
  clearTimeout(cheerT);
  cheerT = setTimeout(() => { $("cheer").hidden = true; }, 2200);
}
$("cheer").addEventListener("click", () => { $("cheer").hidden = true; });

/* ---------- the streak, shared by the 4-taps card and the phone ---------- */

const readToday = () => (me().days || []).includes(todayISO());
function checkIn(el, big) {
  if (readToday()) return;
  const next = streakOf(me().days) + 1;
  me().days = [...new Set([...me().days, todayISO()])].sort().slice(-60);
  confetti(el);
  wiggle(el, false);
  const line = next >= 7 ? `${next} days straight!` : CHEERS[hash(todayISO() + next) % CHEERS.length];
  if (big) setTimeout(() => cheer(next, next >= 7 ? "The streak lives." : line), RM() ? 0 : 300);
  else party(line);
  refresh();
}
// Guide-only: move the calendar on a day (or two) to show what streaks do.
function timeTravel(days) {
  me().days = me().days.map((x) => { const t = new Date(x + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - days); return iso(t); });
  refresh();
}
function paintStreakButtons() {
  const done = readToday(), n = streakOf(me().days);
  document.querySelectorAll("[data-read]").forEach((b) => {
    b.disabled = done;
    b.querySelector("[data-read-label]").textContent = done ? "Done for today" : "I read today";
    b.querySelector("[data-streak]").textContent = n;
  });
}
document.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", () => checkIn(b, true)));

/* ---------- the phone ---------- */

const body = $("p-body");

function header() {
  const people = Object.keys(S.members).length;
  const finished = S.books.filter((b) => b.status === "finished").length;
  $("p-badge").textContent = `${people} ${plural(people, "readers")} · ${finished} finished`;
  $("p-tagline").textContent = `A reading circle. Sundays, 8:30am in the park. Next one ${nextSunday()}.`;
}

function tags(b, counts) {
  const t = [`<span class="tag">${esc(b.genre)}</span>`];
  if (b.lang && b.lang !== "English") t.push(`<span class="tag y" lang="${b.lang === "हिंदी" ? "hi" : "mr"}">${esc(b.lang)}</span>`);
  if (b.status === "finished") t.push(`<span class="tag g">finished</span>`);
  if (counts && counts[norm(b.title)] === 1) t.push(`<span class="tag p">nobody else has this</span>`);
  if (b.lendable) t.push(`<span class="tag b">yours if you ask</span>`);
  if (b.isPrivate) t.push(`<span class="tag k">private</span>`);
  return t.join("");
}

function shelfTab() {
  const reading = S.books.filter((b) => b.status === "reading");
  const twins = myTwins(), twinTitles = new Set(twins.map((t) => norm(t.book.title)));
  const counts = titleCounts(), f = S.filters;
  let books = [...S.books].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  if (f.genre) books = books.filter((b) => b.genre === f.genre);
  if (f.lang) books = books.filter((b) => b.lang === f.lang);
  if (f.lendable) books = books.filter((b) => b.lendable);
  if (f.mine) books = books.filter((b) => twinTitles.has(norm(b.title)));
  const genres = [...new Set(S.books.map((b) => b.genre))], langs = [...new Set(S.books.map((b) => b.lang))].filter((l) => l !== "English");
  const fb = (key, val, label) => `<button type="button" class="${(key === "genre" || key === "lang") ? (f[key] === val ? "on" : "") : (f[key] ? "on" : "")}" data-f="${key}" data-v="${esc(val)}">${esc(label)}</button>`;
  return `
    <h3 class="p-h">The<br>shelf</h3>
    <p class="p-sub"><b>${reading.length}</b> books standing open right now. Tap a spine.</p>
    <div class="shelf p-shelf" id="p-shelf">${reading.map((b) => `
      <button type="button" class="spine" data-spine="${b.id}" title="${esc(b.title)} — ${esc(who(b.uid))}"
        style="background:${inkFor(b.title)};height:${Math.round(heightFor(b.title) * .8)}px;width:${24 + hash(b.id) % 10}px"><span>${esc(b.title)}</span></button>`).join("")}
    </div>
    <div class="p-plank"></div>
    <p class="p-more">scroll for more →</p>
    ${twins.map(({ book, others }) => `<div class="twin"><b>Someone's reading ${esc(book.title)} too</b>
      <span>${others.map((o) => esc(who(o.uid))).join(", ")} — go find each other on Sunday.</span></div>`).join("")}
    <div class="p-head"><h4>Everyone, everything</h4><button type="button" class="p-btn ghost" data-act="filters">Filter</button></div>
    <div class="p-filters" ${S.showFilters ? "" : "hidden"}>
      ${fb("mine", "1", "Only my matches")}${fb("lendable", "1", "Up for grabs")}
      ${genres.map((g) => fb("genre", g, g)).join("")}${langs.map((l) => fb("lang", l, l)).join("")}
    </div>
    <div class="p-list">${books.length ? books.map((b) => `
      <div class="entry" id="w-${b.id}">
        <div class="dot-chip" style="background:${inkFor(b.title)}"></div>
        <div><div class="e-title">${esc(b.title)}</div>
          <div class="e-meta">${b.author ? esc(b.author) + " — " : ""}${esc(who(b.uid))}${b.uid === ME ? " (you)" : ""}</div>
          <div class="tags">${tags(b, counts)}</div>
          ${b.line ? `<div class="e-line">${esc(b.line)}</div>` : ""}</div>
      </div>`).join("") : `<p class="p-sub">Nothing matches that. Loosen the filter.</p>`}</div>`;
}

function mineTab() {
  const days = me().days, n = streakOf(days), done = readToday();
  const books = allMine();
  return `
    <h3 class="p-h">My<br>books</h3>
    <p class="p-sub">the pile of <b style="font-size:13px">Nitya</b></p>
    <div class="streak-card">
      <div class="streak-num"><b>${n}</b><span class="mono" style="font-size:9px;color:var(--dim)">${n === 1 ? "day running" : "days running"}</span></div>
      <div class="dots">${lastDays(14).map((x) => `<i class="${days.includes(x) ? "on" : ""}${x === todayISO() ? " today" : ""}"></i>`).join("")}</div>
      <button type="button" class="p-big" data-act="checkin" ${done ? "disabled" : ""}>${done ? "Done for today" : "I read today"}</button>
      <button type="button" class="p-big outline" data-act="brag">Make a brag card ✦</button>
      <div class="guide-only"><small>Only in this guide</small>
        <button type="button" class="p-btn ghost" data-act="tomorrow">Pretend it's tomorrow →</button>
        <button type="button" class="p-btn ghost" data-act="skip">Skip a day</button>
      </div>
    </div>
    <div class="p-head"><h4>On your pile</h4><button type="button" class="p-btn" data-act="add-toggle">${S.showAdd ? "Never mind" : "Add a book"}</button></div>
    <div class="p-form" ${S.showAdd ? "" : "hidden"}>
      <label>title<input id="f-title" maxlength="120" placeholder="कोसला / Piranesi" autocomplete="off"></label>
      <label>author<input id="f-author" maxlength="80" autocomplete="off"></label>
      <div class="row">
        <label>genre<select id="f-genre">${GENRES.map((g) => `<option>${esc(g)}</option>`).join("")}</select></label>
        <label>language<select id="f-lang">${LANGS.map((l) => `<option>${esc(l)}</option>`).join("")}</select></label>
      </div>
      <label class="check"><input id="f-private" type="checkbox"><span>keep this one to myself</span></label>
      <p>Private books stay off the shelf and out of the standings. Only you see them.</p>
      ${S.addErr ? `<p style="color:var(--red);font-weight:600">${esc(S.addErr)}</p>` : ""}
      <button type="button" class="p-big" data-act="add-save">Put it on the shelf</button>
    </div>
    <div class="p-list">${books.length ? books.map((b) => {
      const alone = !S.books.some((o) => o.uid !== ME && norm(o.title) === norm(b.title));
      const p = b.isPrivate ? 1 : 0;
      return `<div class="entry">
        <div class="dot-chip" style="background:${inkFor(b.title)}"></div>
        <div><div class="e-title">${esc(b.title)}</div>
          <div class="e-meta">${esc(b.author || "author unknown")}</div>
          <div class="tags">${tags(b, null)}${alone && !b.isPrivate ? `<span class="tag p">first in the circle</span>` : ""}</div>
          ${b.line ? `<div class="e-line">${esc(b.line)}</div>` : ""}
          <div class="acts">
            ${b.status === "finished" && !b.isPrivate ? `<button type="button" class="p-btn ghost${b.id === S.justFinished ? " nudge" : ""}" data-act="brag-book" data-id="${b.id}">Brag about it ✦</button>` : ""}
            ${b.status === "reading" ? `<button type="button" class="p-btn ghost" data-act="finish" data-id="${b.id}" data-p="${p}">I finished it</button>` : ""}
            <button type="button" class="p-btn ghost" data-act="line" data-id="${b.id}">${b.line ? "Change the line" : "Save a line you liked"}</button>
            ${b.isPrivate ? "" : `<button type="button" class="p-btn ghost" data-act="lend" data-id="${b.id}">${b.lendable ? "Keeping it" : "Happy to lend it"}</button>`}
            <button type="button" class="p-btn ghost" data-act="remove" data-id="${b.id}" data-p="${p}">Remove</button>
          </div>
          ${S.editing === b.id ? `<div class="editor"><textarea id="ta-line" rows="2" maxlength="300" placeholder="One sentence that stuck with you">${esc(b.line)}</textarea>
            <button type="button" class="p-btn ghost" data-act="line-save" data-id="${b.id}" data-p="${p}">Save it</button></div>` : ""}
        </div></div>`;
    }).join("") : `<p class="p-sub">Nothing yet. Add whatever's open on your table — three pages in still counts.</p>`}</div>`;
}

function ranksTab() {
  const counts = titleCounts();
  const per = Object.entries(S.members).map(([id, m]) => {
    const bs = S.books.filter((b) => b.uid === id);
    return { id, name: m.name, streak: streakOf(m.days), genres: new Set(bs.map((b) => b.genre)).size,
      rare: bs.filter((b) => counts[norm(b.title)] === 1).length, done: bs.filter((b) => b.status === "finished").length };
  });
  const boards = [
    { title: "On a roll", k: "streak", unit: "days", color: "var(--green)", note: "Most days in a row without missing." },
    { title: "All over the map", k: "genres", unit: "shelves", color: "var(--ink)", note: "Readers who refuse to stay in one section." },
    { title: "Off the beaten track", k: "rare", unit: "books", color: "var(--red)", note: "Books nobody else here has touched." },
    { title: "Finished and done", k: "done", unit: "books", color: "var(--mustard)", note: "Closed, shut, back on the shelf." },
  ];
  return `
    <h3 class="p-h">Stand<br>ings</h3>
    <p class="p-sub" style="font-family:var(--body);font-size:13px">Nobody wins anything. Everybody looks anyway.</p>
    <button type="button" class="p-big outline" data-act="circle">Make the circle card ✦</button>
    ${boards.map((b) => {
      const sorted = [...per].sort((x, y) => y[b.k] - x[b.k]);
      const top = sorted.filter((p) => p[b.k] > 0).slice(0, 5);
      const myIdx = sorted.findIndex((p) => p.id === ME), mine = sorted[myIdx];
      let you = "";
      if (!top.some((p) => p.id === ME)) {
        const above = sorted[myIdx - 1], gap = above ? above[b.k] - mine[b.k] : 0;
        you = `<div class="rank you"><span class="medal" style="background:var(--ink);color:var(--cream)">${myIdx + 1}</span><span>You</span><span class="v">${mine[b.k]} ${plural(mine[b.k], b.unit)}</span></div>
          ${above ? `<p class="gap">${gap === 0 ? "Level with" : gap + " " + plural(gap, b.unit) + " off"} ${esc(above.name)} in ${myIdx}${ordinal(myIdx)}.</p>` : ""}`;
      }
      return `<div class="board" style="border-top-color:${b.color}"><h4>${b.title}</h4><p class="note">${b.note}</p>
        ${top.map((r, i) => `<div class="rank${r.id === ME ? " you" : ""}"><span class="medal" style="background:${INKS[i]}">${i + 1}</span><span>${esc(r.name)}</span><span class="v">${r[b.k]} ${plural(r[b.k], b.unit)}</span></div>`).join("")}${you}</div>`;
    }).join("")}`;
}

function sundayTab() {
  const lend = S.books.filter((b) => b.lendable);
  return `
    <h3 class="p-h">Sun<br>day</h3>
    <p class="p-sub" style="font-family:var(--body);font-size:14px">Bringing it up on ${nextSunday()}</p>
    <div class="board" style="border-top-color:var(--mustard)"><h4>Every Sunday, 8:30am</h4>
      <p class="note">In the park, Panvel. Bring whatever you're reading.</p>
      <div class="acts"><a class="p-btn" style="display:inline-flex;align-items:center;text-decoration:none" href="${MAP}" target="_blank" rel="noopener">${ICON.maps}Directions to the park</a>
        <a class="p-btn" style="display:inline-flex;align-items:center;text-decoration:none;background:var(--red);color:var(--cream)" href="${INSTA}" target="_blank" rel="noopener">${ICON.ig}@pagesofpanvel</a></div>
      <p class="note" style="margin:10px 0 0">Add Sunday to my calendar</p>
      <div class="acts"><a class="p-btn" style="display:inline-flex;align-items:center;text-decoration:none;background:var(--mustard);color:var(--ink)" href="../sunday.ics">${ICON.apple}Apple / other calendar</a>
        <a class="p-btn ghost" style="display:inline-flex;align-items:center;text-decoration:none" href="${esc(GCAL)}" target="_blank" rel="noopener">${ICON.gcal}Google Calendar</a></div>
    </div>
    <div class="p-head"><h4>Agenda — add anything</h4></div>
    <p class="p-sub" style="font-family:var(--body);font-size:12px;margin:0">A book you want to argue about, a passage to read out, something you can't stop recommending.</p>
    <div class="p-post"><textarea id="board-text" rows="2" maxlength="280" placeholder="I want to read 4 pages of बटाट्याची चाळ out loud"></textarea>
      <button type="button" class="p-big" data-act="pin">Pin it</button></div>
    <div class="p-list" style="margin-top:10px">${S.board.length ? S.board.map((p) => `
      <div class="entry"><div class="dot-chip" style="background:${inkFor(p.id)}"></div>
        <div><div style="font-size:14px">${esc(p.text)}</div>
          <div class="e-meta">${esc(who(p.uid))}${p.uid === ME ? " (you)" : ""}</div>
          ${p.uid === ME ? `<div class="acts"><button type="button" class="p-btn ghost" data-act="unpin" data-id="${p.id}">Delete</button></div>` : ""}
        </div></div>`).join("") : `<p class="p-sub">Nothing down yet. Someone has to go first.</p>`}</div>
    <div class="p-head"><h4>Copies on offer</h4></div>
    <p class="p-sub" style="font-family:var(--body);font-size:12px;margin:0 0 6px">Books people will hand over at the park. Just ask them.</p>
    ${lend.length ? lend.map((b) => `<div class="p-offer"><i style="background:${inkFor(b.title)}"></i><span><strong>${esc(b.title)}</strong> · ${b.author ? esc(b.author) + " — " : ""}from ${esc(who(b.uid))}</span></div>`).join("")
      : `<p class="p-sub">None offered yet.</p>`}`;
}

const NOTES = {
  shelf: {
    kick: "Tab 1 · Shelf", h: "A real bookshelf",
    items: [
      "Every book someone in the circle is reading <strong>right now</strong> stands as a coloured spine, title sideways. Loud on purpose. Tap one and it jumps to that book in the list.",
      "The shelf scrolls sideways: <em>scroll for more →</em>.",
      "<strong>Reading twins:</strong> if someone else has your book, a banner names them. Go find each other on Sunday.",
      "<strong>Everyone, everything:</strong> every book, newest first, with who's reading it. Tags say the language, <em>finished</em>, <em>nobody else has this</em> and <em>yours if you ask</em>. Saved lines show underneath.",
      "<strong>Filter:</strong> only my matches, up for grabs, any genre, any language.",
      "Books get their cover when Open Library has one; the rest keep their colour.",
    ],
    try: "Tap a spine. Then Filter → Only my matches.",
  },
  mine: {
    kick: "Tab 2 · Mine", h: "Your pile",
    items: [
      "<strong>The streak:</strong> days in a row, and your last 14 days. \"I read today\" works <strong>once a day</strong>, with a cheer.",
      "<strong>Add a book:</strong> title, author, genre and language (English, मराठी, हिंदी or Other). Tick <em>keep this one to myself</em> and it stays off the shelf, out of the standings and off every card.",
      "<strong>On each book:</strong> \"I finished it\", \"Save a line you liked\" (one sentence, up to 300 characters), \"Happy to lend it\" / \"Keeping it\", and \"Remove\".",
      "Finish one and <strong>\"Brag about it ✦\"</strong> lights up and pulses. It opens that book's brag card.",
      "Nobody else has logged it? It says <em>first in the circle</em>.",
    ],
    try: "Tap \"I finished it\" on कोसला, then \"Brag about it ✦\". Or \"Pretend it's tomorrow\" and check in again.",
  },
  ranks: {
    kick: "Tab 3 · Ranks", h: "Everybody looks",
    items: [
      "Four boards, top five each: <strong>On a roll</strong> (days in a row), <strong>All over the map</strong> (genres), <strong>Off the beaten track</strong> (books nobody else has), <strong>Finished and done</strong>.",
      "Not in the top five? It still shows your place, and how far off the next person you are.",
      "Private books never count.",
      "<strong>\"Make the circle card ✦\"</strong> turns the whole circle's month into one poster for @pagesofpanvel.",
    ],
    try: "Finish a book in Mine, then come back: watch Nitya move on Finished and done.",
  },
  sunday: {
    kick: "Tab 4 · Sunday", h: "The agenda",
    items: [
      "<strong>Every Sunday, 8:30am:</strong> directions to the park, the circle's Instagram, and <strong>Add Sunday to my calendar</strong>. Google Calendar or any other calendar, repeating every week, with a nudge the evening before.",
      "Anything you want to bring up on Sunday: a book to argue about, a passage to read out loud, a recommendation. Tap <strong>\"Pin it\"</strong>.",
      "You can delete your own posts. Only yours.",
      "<strong>Copies on offer:</strong> every book someone is happy to lend. Just ask them at the park.",
    ],
    try: "Pin something, then delete it. Or lend a book in Mine and watch it land here.",
  },
};

function renderNotes() {
  const n = NOTES[S.tab];
  $("notes").innerHTML = `<span class="mono kick hot">${n.kick}</span><h3 class="h3">${n.h}</h3>
    <ul>${n.items.map((x) => `<li>${x}</li>`).join("")}</ul>
    <div class="try"><b>Try this</b>${n.try}</div>`;
}

function renderPhone(keepScroll = true) {
  const top = body.scrollTop;
  header();
  body.innerHTML = S.tab === "shelf" ? shelfTab() : S.tab === "mine" ? mineTab() : S.tab === "ranks" ? ranksTab() : sundayTab();
  if (keepScroll) body.scrollTop = top;
  document.querySelectorAll(".p-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === S.tab)));
  const sh = $("p-shelf");
  if (sh) sh.nextElementSibling.nextElementSibling.hidden = sh.scrollWidth <= sh.clientWidth + 8;
}
function refresh() { renderPhone(); paintStreakButtons(); touch(); }

document.querySelector(".p-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b || b.dataset.tab === S.tab) return;
  S.tab = b.dataset.tab;
  renderPhone(false);
  body.scrollTop = 0;
  renderNotes();
});

body.addEventListener("click", (e) => {
  const spine = e.target.closest("[data-spine]");
  if (spine) {
    wiggle(spine, true);
    const el = $("w-" + spine.dataset.spine);
    if (el) {
      body.scrollTo({ top: el.offsetTop - 14, behavior: RM() ? "auto" : "smooth" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1400);
    }
    return;
  }
  const f = e.target.closest("[data-f]");
  if (f) {
    const k = f.dataset.f, v = f.dataset.v;
    if (k === "genre" || k === "lang") S.filters[k] = S.filters[k] === v ? null : v;
    else S.filters[k] = !S.filters[k];
    renderPhone();
    return;
  }
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, id } = b.dataset, isPriv = b.dataset.p === "1";
  const list = () => (isPriv ? S.priv : S.books);
  const book = () => list().find((x) => x.id === id) || S.priv.find((x) => x.id === id) || S.books.find((x) => x.id === id);
  if (act === "filters") { S.showFilters = !S.showFilters; renderPhone(); }
  if (act === "checkin") checkIn(b, false);
  if (act === "tomorrow") { timeTravel(1); party("Tomorrow. The streak waits for you."); }
  if (act === "skip") { timeTravel(2); party("A whole day missed. Back to zero."); }
  if (act === "brag") $("brag").scrollIntoView({ behavior: RM() ? "auto" : "smooth" });
  if (act === "brag-book") openMaker({ card: "finished", bookId: id });
  if (act === "circle") $("circle-card").scrollIntoView({ behavior: RM() ? "auto" : "smooth" });
  if (act === "add-toggle") { S.showAdd = !S.showAdd; S.addErr = ""; renderPhone(); if (S.showAdd) $("f-title").focus(); }
  if (act === "add-save") {
    const title = $("f-title").value.trim();
    if (!title) { S.addErr = "Give the book a title first."; renderPhone(); $("f-title").focus(); return; }
    const nb = { id: "b" + (seq++), uid: ME, title, author: $("f-author").value.trim(), genre: $("f-genre").value,
      lang: $("f-lang").value, status: "reading", startedAt: todayISO(), line: "", lendable: false };
    if ($("f-private").checked) S.priv.push({ ...nb, isPrivate: true }); else S.books.push(nb);
    S.showAdd = false; S.addErr = "";
    party("On the shelf it goes.");
    refresh();
  }
  if (act === "finish") {
    const x = book();
    if (!x) return;
    x.status = "finished"; x.finishedAt = todayISO();
    if (!isPriv) S.justFinished = id;
    party("Finished. That's one more.");
    refresh();
  }
  if (act === "line") { S.editing = S.editing === id ? null : id; renderPhone(); if (S.editing) $("ta-line").focus(); }
  if (act === "line-save") {
    const x = book();
    if (x) x.line = $("ta-line").value.trim().slice(0, 300);
    S.editing = null;
    party("Saved.");
    refresh();
  }
  if (act === "lend") { const x = book(); if (x) x.lendable = !x.lendable; refresh(); }
  if (act === "remove") {
    if (!confirm("Take this off your shelf?")) return;
    if (isPriv) S.priv = S.priv.filter((x) => x.id !== id); else S.books = S.books.filter((x) => x.id !== id);
    refresh();
  }
  if (act === "pin") {
    const text = $("board-text").value.trim();
    if (!text) { $("board-text").focus(); return; }
    S.board = [{ id: "p" + (seq++), uid: ME, text }, ...S.board].slice(0, 40);
    renderPhone();
  }
  if (act === "unpin") {
    const post = S.board.find((x) => x.id === id);
    if (!post || post.uid !== ME || !confirm("Take this off the agenda?")) return;
    S.board = S.board.filter((x) => x.id !== id);
    renderPhone();
  }
});

/* ---------- the hero shelf ---------- */

const HERO = ["कोसला", "Pachinko", "गुनाहों का देवता", "Maus", "A Fine Balance", "बटाट्याची चाळ", "Piranesi",
  "Collected Poems", "Kafka on the Shore", "मधुशाला", "The Enchantress of Florence", "Sapiens", "Persepolis", "Silent Spring"];
$("hero-shelf").innerHTML = HERO.map((t, i) => `<button type="button" class="spine" data-t="${esc(t)}" aria-label="${esc(t)}"
  style="background:${inkFor(t)};width:${38 + (i * 7) % 22}px;height:${160 + (i * 37) % 80}px"><span>${esc(t)}</span></button>`).join("");
$("hero-shelf").addEventListener("click", (e) => {
  const s = e.target.closest(".spine");
  if (!s) return;
  wiggle(s, true);
  const t = s.dataset.t, readers = [...new Set(S.books.filter((b) => norm(b.title) === norm(t)).map((b) => who(b.uid)))];
  $("hero-toast").textContent = readers.length > 1 ? `${t}: ${readers.join(" and ")} both have it. Reading twins!`
    : readers.length ? `${t}: on ${readers[0]}'s pile.` : `${t}: nobody's got it yet. Could be you.`;
});

/* ---------- stickers ---------- */

const STICKERS = [
  ["Reading twins", "Same book as someone else? The Shelf names them. Go find each other on Sunday.", "#FFE03D", -2],
  ["Tap a spine", "Every spine on the shelf jumps to its book in the list, and flashes it.", "#FF6B4A", 1.5],
  ["Saved lines", "One sentence that stuck with you, kept on the book for everyone to see. It can become a brag card.", "#FF6FB5", -1],
  ["Yours if you ask", "Tap \"Happy to lend it\" and your copy joins Copies on offer on the Sunday tab.", "#4FD97E", 2],
  ["First in the circle", "Log a book nobody else has and it says so. On the Shelf it's \"nobody else has this\".", "#FFA62B", -1.5],
  ["Covers", "Covers turn up by themselves for many books, from Open Library. Give the author: it helps find the right one.", "#4BC4F5", 1],
  ["Streak cheers", "\"Another day on the books.\" \"The streak lives.\" \"Panvel reads on.\" Seven days in, it just shouts the number.", "#D4E84A", -2.5],
  ["Brag about it ✦", "Finish a book and the button pulses. One tap and that book's card is ready.", "#D89C24", 1.5],
  ["Locked cards", "A card you haven't earned yet says exactly how to unlock it.", "#A87FFF", -1],
  ["मराठी · हिंदी", "Marathi and Hindi titles look right everywhere: the shelf, the lists, and every card.", "#D97FF5", 1],
  ["Keep it to yourself", "Private books are for you only: off the shelf, out of the standings, never on a card.", "#3ED9B0", -2],
  ["The demo", "pagesofpanvel.in/?demo runs the whole site on sample data. Poke anything; nothing is saved.", "#7FA8FF", 2],
  ["WhatsApp poster", "Paste pagesofpanvel.in into a chat and it shows the circle's own poster.", "#FF5C7A", -1.5],
];
$("stickers").innerHTML = STICKERS.map(([t, x, bg, r]) => `<button type="button" class="stick" style="--bg:${bg};--r:${r}deg"><b>${esc(t)}</b><span>${esc(x)}</span></button>`).join("");
$("stickers").addEventListener("click", (e) => { const s = e.target.closest(".stick"); if (s) wiggle(s, false); });

/* ---------- FAQ ---------- */

const FAQ = [
  ["Is it free?", "Yes.", "Completely, for everyone."],
  ["Do I need an invite?", "No.", "Any Google account works. Tap \"Continue with Google\" and you're in."],
  ["Is there an app to install?", "No.", "It's a website. Open pagesofpanvel.in in your phone's browser, or on a computer."],
  ["How long do I stay signed in?", "Until you sign out.", "On that phone and browser, it remembers you."],
  ["What counts as reading today?", "Anything.", "A chapter, a poem, three pages. Tap \"I read today\" once a day."],
  ["What if I miss a day?", "The streak starts again.", "It holds until the end of the next day, so tapping tomorrow keeps it going. Miss a whole day and it's back to zero. You can't tap for a day that's gone."],
  ["Can I keep a book private?", "Yes.", "Tick \"keep this one to myself\" when you add it. It stays off the shelf, out of the standings and off every card."],
  ["Can I edit a book?", "Not yet.", "Remove it and add it again. Your streak isn't touched."],
  ["Why doesn't my book have a cover?", "Open Library didn't have a match.", "Covers need the author's name. Marathi and Hindi books mostly aren't on Open Library, so they keep their colour."],
  ["How do I post a brag card?", "Mine → \"Make a brag card ✦\".", "Pick a colour, tap a card, tap \"Share\", then Instagram and Stories. No Share button? \"Save image\", then post it from your photos."],
  ["Can I delete an agenda post?", "Your own, yes.", "Tap \"Delete\" under it. Nobody can delete anyone else's."],
  ["Does Marathi or Hindi work?", "Yes, everywhere.", "Titles, authors, saved lines and cards, the lot."],
  ["Where exactly is the park?", "It's on the Sunday tab.", "The Sunday tab has \"Directions to the park\", and \"Add Sunday to my calendar\" puts every Sunday, 8:30am, in your calendar."],
  ["Can I look around first?", "Yes.", "pagesofpanvel.in/?demo is the whole site on sample data. Nothing you do there is saved."],
];
$("faq-list").innerHTML = FAQ.map(([q, s, a]) => `<details><summary><span>${esc(q)}</span><i aria-hidden="true">+</i></summary><p><strong>${esc(s)}</strong> ${esc(a)}</p></details>`).join("");

/* ---------- jump nav ---------- */

const navLinks = [...document.querySelectorAll(".jump a")];
const navIO = new IntersectionObserver((seen) => {
  for (const e of seen) if (e.isIntersecting) {
    navLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }
}, { rootMargin: "-40% 0px -55% 0px" });
document.querySelectorAll("main section").forEach((sec) => navIO.observe(sec));

/* ---------- the real cards ---------- */

let engine = null;                 // { WAYS, CARDS, CIRCLE, plan, fit, openBrag, renderCard }
function loadEngine() {
  engine ??= Promise.all([import("../js/brag-cards.js"), import("../js/brag-render.js"), import("../js/brag.js")])
    .then(([c, r, b]) => ({ ...c, ...r, ...b }))
    .catch((e) => { engine = null; throw e; });
  return engine;
}
const ctx = () => ({
  me: structuredClone(me()), mine: structuredClone(myPublic()), books: structuredClone(S.books),
  members: structuredClone(S.members), uid: ME, inkFor, streakOf, norm,
});
async function openMaker(open) {
  try { (await loadEngine()).openBrag(ctx(), open); }
  catch { alert("The card maker couldn't load. Check your connection and try again."); }
}

const WAY_KEYS = ["A", "B", "C", "D"];
const WAY_NAMES = { A: "Cream", B: "Red", C: "Mustard", D: "Charcoal" };
const WAY_BG = { A: "#E9E0CB", B: "#C0302A", C: "#D89C24", D: "#241D18" };
let way = "A", drawn = false, dirty = true, job = 0;
const urls = [];
$("ways").innerHTML = WAY_KEYS.map((k) => `<button type="button" class="chip-btn" data-way="${k}" aria-pressed="${k === way}"><i style="background:${WAY_BG[k]}"></i>${WAY_NAMES[k]}</button>`).join("");
$("ways").addEventListener("click", (e) => {
  const b = e.target.closest("[data-way]");
  if (!b || b.dataset.way === way) return;
  way = b.dataset.way;
  $("ways").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  dirty = true; drawCards();
});

const ROT = [-1.5, 1, -1, 1.5, -2, 1];
async function drawCards() {
  if (!drawn) return;
  const mine = ++job;
  let E;
  try { E = await loadEngine(); await E.loadFonts(); } catch {
    $("bgrid").innerHTML = `<p>The cards couldn't load here. They work on the site itself.</p>`; return;
  }
  if (mine !== job) return;
  dirty = false;
  const plans = E.plan(ctx()), grid = $("bgrid");
  if (!grid.children.length) {
    grid.innerHTML = E.CARDS.map((c, i) => `<button type="button" class="bcard" id="bc-${c.id}" data-card="${c.id}">
      <div class="bframe" style="--r:${ROT[i]}deg"><div class="bwait">Drawing…</div></div>
      <div class="blabel"><span class="no">${c.no}</span><b>${esc(c.name)}</b><small>${esc(c.note)}</small></div></button>`).join("");
  }
  for (const [i, c] of E.CARDS.entries()) {
    const btn = $("bc-" + c.id), frame = btn.firstElementChild, p = plans[c.id];
    btn.classList.toggle("locked", !!p.locked);
    btn.disabled = !!p.locked;
    if (p.locked) { frame.innerHTML = `<div class="bwait">${esc(p.locked)}</div>`; continue; }
    try {
      const blob = await E.renderCard(E.fit(c, E.WAYS[way], p.data(p.choices[0]), i), 0.34);
      if (mine !== job) return;
      const u = URL.createObjectURL(blob);
      urls.push(u);
      frame.innerHTML = `<img alt="${esc(c.name)} card, ${WAY_NAMES[way]}" src="${u}">`;
    } catch { frame.innerHTML = `<div class="bwait">Couldn't draw this one here</div>`; }
  }
  while (urls.length > 12) URL.revokeObjectURL(urls.shift());
}
$("bgrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-card]");
  if (b && !b.disabled) openMaker({ card: b.dataset.card });
});
// Nitya's pile changed in the phone: redraw once things settle, if the cards are on screen.
let redrawT, cardsVisible = false;
changed = () => { dirty = true; clearTimeout(redrawT); if (cardsVisible) redrawT = setTimeout(drawCards, 500); };

const CIRCLES = (() => {
  const now = new Date(), name = (back) => new Date(now.getFullYear(), now.getMonth() - back, 1);
  const label = (x) => x.toLocaleString("en", { month: "long" });
  return [
    { key: "this", button: "This month so far", month: label(name(0)), year: String(name(0).getFullYear()),
      finished: "38", readers: "64", genres: "11", langs: "03", streak: "41",
      top: { title: "कोसला", author: "भालचंद्र नेमाडे", lang: "मराठी", n: 5 }, onGo: 122 },
    { key: "last", button: "Last month in full", month: label(name(1)), year: String(name(1).getFullYear()),
      finished: "52", readers: "71", genres: "12", langs: "03", streak: "37",
      top: { title: "Maus", author: "Art Spiegelman", lang: "English", n: 4 }, onGo: 131 },
  ];
})();
let month = 0, cjob = 0;
$("months").innerHTML = CIRCLES.map((c, i) => `<button type="button" class="chip-btn" data-m="${i}" aria-pressed="${i === month}">${c.button}</button>`).join("");
$("months").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]");
  if (!b || +b.dataset.m === month) return;
  month = +b.dataset.m;
  $("months").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  drawCircle();
});
async function drawCircle() {
  const mine = ++cjob, c = CIRCLES[month];
  $("circle-wait").hidden = false;
  try {
    const E = await loadEngine();
    const blob = await E.renderCard(E.fit(E.CIRCLE, E.WAYS.B, c, 1), 0.5);
    if (mine !== cjob) return;
    const img = $("circle-img");
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    img.alt = `Circle card for ${c.month}: ${+c.finished} books finished by the circle, ${+c.readers} readers, ${+c.genres} genres, ${+c.langs} languages, longest streak ${+c.streak} days, most read ${c.top.title} with ${c.top.n} readers`;
    $("circle-wait").hidden = true;
  } catch { if (mine === cjob) $("circle-wait").textContent = "The card couldn't load here."; }
}

// Fetch the card engine and its fonts only when the cards come near.
new IntersectionObserver((seen) => {
  for (const e of seen) {
    cardsVisible = e.isIntersecting;
    if (e.isIntersecting && (!drawn || dirty)) { drawn = true; drawCards(); }
  }
}, { rootMargin: "600px 0px" }).observe($("brag"));
new IntersectionObserver((seen, io) => {
  if (seen.some((e) => e.isIntersecting)) { io.disconnect(); drawCircle(); }
}, { rootMargin: "600px 0px" }).observe($("circle-card"));

/* ---------- go ---------- */

renderPhone(false);
renderNotes();
paintStreakButtons();
