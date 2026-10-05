import { firebaseConfig, CIRCLE } from "./config.js";

// Add ?demo to the URL to run the whole site on sample data, with no Firebase
// at all. Useful for showing people what it looks like before anyone signs up.
const DEMO = new URLSearchParams(location.search).has("demo");

/* ---------- constants ---------- */

const GENRES = ["Fiction", "Poetry", "History", "Memoir", "Crime", "Sci-fi & fantasy",
  "Philosophy", "Science", "Essays", "Graphic novel", "Children's", "Other"];
const LANGS = ["English", "मराठी", "हिंदी", "Other"];
// Spine colours, ordered around the hue wheel. Loud on purpose — the shelf is
// the first thing anyone sees, and a rack of bright spines on cream paper is
// the whole point of it.
//
// Two things bound how loud they can get. The lettering printed on a spine is
// charcoal at 88%, so the real text colour is a blend of charcoal and the
// spine itself; every colour here clears 4.5:1 against that blend, not against
// pure charcoal, which is the more forgiving number. And each sits at least
// ΔE 22 from the cream page — perceptual distance, not luminance contrast,
// because a golden spine reads clearly against cream on hue alone even though
// the two are nearly equal in brightness.
//
// The brand's own red and green still cannot be spines: charcoal on them is
// 2.9:1 and 1.8:1, unreadable. They carry cream text elsewhere instead.
const INKS = ["#FF6B4A", "#FFA62B", "#FFE03D", "#D4E84A", "#9BE04F", "#4FD97E", "#3ED9B0",
  "#35D2D2", "#4BC4F5", "#7FA8FF", "#A87FFF", "#D97FF5", "#FF6FB5", "#FF5C7A"];
const OFFLINE = "Can't reach the shelf right now. It'll reconnect on its own.";
const DENIED = "Firestore turned that down. Sign out and back in with a Google account — that's all it takes to join.";
const CHEERS = ["Another day on the books.", "The streak lives.", "Panvel reads on.",
  "Look at you go.", "That's a page more than yesterday.", "Sunday will be proud."];
const DAY_CAP = 60;      // how many check-in dates we keep per member
const BOARD_CAP = 40;    // how many agenda items we keep

/* ---------- helpers ---------- */

const $ = (id) => document.getElementById(id);
// Counts of one are common here, and "1 books" reads like a bug.
const ODD = { days: "day", shelves: "shelf", books: "book", readers: "reader" };
const plural = (n, word) => (n === 1 ? ODD[word] || word.replace(/s$/, "") : word);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const norm = (s) => String(s || "").toLowerCase()
  .replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9\u0900-\u097F ]/g, "").trim();

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}
const inkFor = (s) => INKS[hash(s) % INKS.length];
const heightFor = (s) => 124 + (hash(s + "h") % 72);

// Book covers, from Open Library via covers.js. This map is its answer sheet:
// a book's key → cover URL, or "" for none. A book with no answer yet keeps
// its coloured chip, and so does anything that goes wrong along the way.
// Private books are never looked up: their titles don't leave the phone.
// Nor are books without an author (too easy to match the wrong cover), or
// in Devanagari (Open Library has almost none).
const COVERS = new Map();
function coverKey(b) {
  if (b.isPrivate || !b.author || /[\u0900-\u097F]/.test(b.title + b.author)) return null;
  return norm(b.title) + "|" + norm(b.author);
}
function chip(b) {
  const bg = inkFor(b.title), key = coverKey(b), url = key && COVERS.get(key);
  if (url) return `<img class="chip cover" src="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer" style="background:${bg}" data-cover-key="${esc(key)}">`;
  const ask = key && !COVERS.has(key)
    ? ` data-cover="${esc(key)}" data-t="${esc(b.title)}" data-a="${esc(b.author)}"` : "";
  return `<div class="chip" style="background:${bg}"${ask}></div>`;
}
// Start looking covers up once the page has settled, so it never competes
// with signing in or the first load of the shelf.
let coversStarted = false;
function startCovers() {
  if (coversStarted) return;
  coversStarted = true;
  setTimeout(() => import("./covers.js").then((m) => m.start(COVERS)).catch(() => {}), 2000);
}

function streakOf(days = []) {
  if (!days.length) return 0;
  const set = new Set(days);
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function lastDays(n) {
  const out = [], d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d); x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ---------- backend ---------- */

// Loaded only when we actually need it, so demo mode works offline.
let auth, db, PUB, fb = {};
if (!DEMO) {
  const V = "https://www.gstatic.com/firebasejs/10.12.2";
  const [A, U, F] = await Promise.all([
    import(`${V}/firebase-app.js`),
    import(`${V}/firebase-auth.js`),
    import(`${V}/firebase-firestore.js`),
  ]);
  fb = { ...U, ...F };
  const app = A.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  db = fb.getFirestore(app);
  PUB = fb.doc(db, "circle", "public");
}

const EMPTY = { members: {}, books: [], board: [] };
let state = { pub: EMPTY, priv: { books: [] }, user: null, busy: false };
let filters = { genre: null, lang: null, lendable: false, mine: false, status: null };
let tab = "shelf";
// The book just marked finished, so its "Brag about it" button can light up
// for a moment. Cleared on a timer; it only ever changes how a button looks.
let justFinished = null;
// The book whose title and author are being edited in Mine, with what has
// been typed so far, so a re-render (anyone's change arrives live) doesn't
// close the editor or lose the typing.
let editing = null;

// A transaction that never settles — the connection drops mid-write — used to
// leave state.busy stuck true, because the reset sat after the try/catch instead
// of in a finally. Every later write then returned silently at the busy guard:
// adding a book, checking in and posting to the agenda all quietly stopped
// working, with nothing on screen to say why. The finally and the timeout below
// are what make that unwedgeable.
const WRITE_TIMEOUT = 15000;

function withTimeout(promise, ms = WRITE_TIMEOUT) {
  let timer;
  const bell = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("write timed out"), { code: "timeout" })), ms);
  });
  return Promise.race([promise, bell]).finally(() => clearTimeout(timer));
}

async function mutate(fn) {
  // Never fail mute: a click that does nothing reads as a broken site.
  if (state.busy) { showError("Still saving the last change. Give it a second."); return; }
  state.busy = true;
  hideError();
  if (DEMO) {
    state.pub = fn(structuredClone(state.pub));
    state.busy = false;
    renderAll();
    return;
  }
  try {
    // The timeout only stops us waiting; if the write does land late, the
    // snapshot listener picks it up like any other change.
    await withTimeout(fb.runTransaction(db, async (tx) => {
      const snap = await tx.get(PUB);
      const cur = snap.exists() ? snap.data() : EMPTY;
      const next = fn(structuredClone({ ...EMPTY, ...cur }));
      tx.set(PUB, next);
    }));
  } catch (e) {
    showError(
      e?.code === "permission-denied"
        ? DENIED
        : e?.code === "timeout"
          ? "That took too long to save. Check your connection and try again."
          // The code is worth showing: it is the difference between a dead
          // network and a rule saying no.
          : `That didn't save${e?.code ? ` (${e.code})` : ""}. Check your connection and give it another go.`);
  } finally {
    state.busy = false;   // always, however the write ended
  }
}

async function mutatePrivate(fn) {
  const next = fn(structuredClone(state.priv));
  state.priv = next;
  if (!DEMO) {
    try { await fb.setDoc(fb.doc(db, "private", state.user.uid), next); }
    catch { showError("Couldn't save your private shelf."); }
  }
  renderMine();
}

/* ---------- boot ---------- */

$("tagline").textContent =
  `A reading circle. ${CIRCLE.when} in ${CIRCLE.where}. Next one ${nextSunday()}.`;
document.title = `${CIRCLE.name} — a reading circle`;

$("signin").addEventListener("click", async () => {
  try {
    await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
  } catch (e) {
    if (e?.code === "auth/popup-closed-by-user") return;
    // The two that actually happen say what to go and fix, because
    // "try again" sends you round the same loop forever.
    $("gate-msg").textContent =
      e?.code === "auth/unauthorized-domain"
        ? "This address isn't on the Firebase authorised-domains list yet."
        : e?.code === "auth/operation-not-supported-in-this-environment"
          ? "Sign-in needs a secure connection. Open the site over https."
          : `Sign-in didn't go through${e?.code ? ` (${e.code})` : ""}. Try again?`;
    $("gate-msg").hidden = false;
  }
});
$("signout").addEventListener("click", () => {
  if (DEMO) { location.search = ""; return; }
  fb.signOut(auth);
});

if (DEMO) queueMicrotask(bootDemo);
else fb.onAuthStateChanged(auth, async (user) => {
  $("boot").hidden = true;
  state.user = user;
  if (!user) {
    $("gate").hidden = false;
    $("app").hidden = true;
    return;
  }
  $("gate").hidden = true;
  $("app").hidden = false;
  $("who").textContent = `Signed in as ${user.displayName || user.email}`;

  try {
    const p = await fb.getDoc(fb.doc(db, "private", user.uid));
    state.priv = p.exists() ? { books: [], ...p.data() } : { books: [] };
  } catch { state.priv = { books: [] }; }

  fb.onSnapshot(PUB,
    (snap) => {
      // A snapshot means the stream is alive, so drop a stale offline banner.
      // Only that one — a write failure has to stay up until the write retries.
      const shown = $("error").textContent;
      if (shown === OFFLINE || shown === DENIED) hideError();
      state.pub = { ...EMPTY, ...(snap.exists() ? snap.data() : EMPTY) };
      ensureMember();
      renderAll();
    },
    // A denied read is not a network blip and will never "reconnect on its
    // own" — it is an auth problem. Saying otherwise sends someone off to
    // check their wifi over something a re-sign-in fixes.
    (e) => showError(e?.code === "permission-denied" ? DENIED : OFFLINE)
  );
});

async function bootDemo() {
  const { DEMO_PUBLIC, DEMO_PRIVATE, DEMO_UID } = await import("./demo-data.js");
  state.user = { uid: DEMO_UID, displayName: DEMO_PUBLIC.members[DEMO_UID].name };
  state.pub = structuredClone(DEMO_PUBLIC);
  state.priv = structuredClone(DEMO_PRIVATE);
  $("boot").hidden = true;
  $("gate").hidden = true;
  $("app").hidden = false;
  $("who").textContent = "Sample data. Nothing you do here is saved.";
  $("signout").textContent = "Leave the demo";
  renderAll();
}

async function ensureMember() {
  if (DEMO) return;
  const u = state.user;
  if (state.pub.members[u.uid]) return;
  await mutate((c) => {
    if (c.members[u.uid]) return c;
    c.members[u.uid] = {
      name: u.displayName || (u.email || "").split("@")[0],
      joined: todayISO(),
      days: [],
    };
    return c;
  });
  party(`Welcome in, ${(u.displayName || "reader").split(" ")[0]}.`);
}

/* ---------- derived data ---------- */

function myBooksPublic() {
  return state.pub.books.filter((b) => b.uid === state.user.uid);
}
function allMine() {
  return [...myBooksPublic(), ...state.priv.books.map((b) => ({ ...b, isPrivate: true }))];
}
function readerName(id) {
  return state.pub.members[id]?.name || "a reader";
}

function titleCounts() {
  const c = {};
  state.pub.books.forEach((b) => { c[norm(b.title)] = (c[norm(b.title)] || 0) + 1; });
  return c;
}

function myTwins() {
  return myBooksPublic()
    .filter((b) => b.status === "reading")
    .map((b) => ({
      book: b,
      others: state.pub.books.filter(
        (o) => o.uid !== state.user.uid && norm(o.title) === norm(b.title)),
    }))
    .filter((t) => t.others.length);
}

/* ---------- render ---------- */

function renderAll() {
  renderHero();
  renderTwins();
  renderWall();
  renderMine();
  renderStandings();
  renderSunday();
  startCovers();
}

// Plenty for any real circle; only there so a runaway shelf can't slow the page.
const SHELF_MAX = 600;
function renderHero() {
  const reading = state.pub.books.filter((b) => b.status === "reading");
  const people = Object.keys(state.pub.members).length;
  const finished = state.pub.books.filter((b) => b.status === "finished").length;
  $("open-count").textContent = reading.length;
  $("hero-badge").textContent =
    `${people} ${plural(people, "readers")} · ${finished} finished`;

  const twinTitles = new Set(myTwins().map((t) => norm(t.book.title)));
  const shelf = $("shelf");
  shelf.innerHTML = "";
  // Newest first, so a book someone just added is the first spine on the
  // shelf, not the last one at the far end of a long sideways scroll. (It
  // also used to stop at the first 120, which would have hidden every book
  // added after that.)
  reading.slice().reverse().slice(0, SHELF_MAX).forEach((b) => {
    const s = document.createElement("button");
    s.className = "spine" + (twinTitles.has(norm(b.title)) ? " match" : "");
    s.style.background = inkFor(b.title);
    s.style.height = heightFor(b.title) + "px";
    s.textContent = b.title;
    s.title = `${b.title} — ${readerName(b.uid)}`;
    s.addEventListener("click", () => jumpTo(b.id));
    shelf.appendChild(s);
    if (hash(b.id) % 4 === 0) {
      const t = document.createElement("div");
      t.className = "spine thin";
      t.style.background = inkFor(b.id);
      t.style.height = (heightFor(b.id) - 20) + "px";
      shelf.appendChild(t);
    }
  });
  $("shelf-empty").hidden = reading.length > 0;
  shelfOverflow();
}

// The shelf scrolls sideways, which is easy to miss when the spines happen to
// fill the width. Show the sign only while there is actually more that way,
// and drop it once you reach the end.
function shelfOverflow() {
  const s = $("shelf");
  const more = s.scrollWidth - s.clientWidth - s.scrollLeft > 8;
  s.parentElement.classList.toggle("more", more);
  $("shelf-more").hidden = !more;
}
$("shelf").addEventListener("scroll", shelfOverflow, { passive: true });
addEventListener("resize", shelfOverflow);
// Spine widths change when the real typeface lands, so measure again then.
if (document.fonts?.ready) document.fonts.ready.then(shelfOverflow);

function renderTwins() {
  const t = myTwins();
  $("twins").innerHTML = t.map(({ book, others }) => `
    <div class="twin">
      <h3>Someone's reading ${esc(book.title)} too</h3>
      <p class="meta">${others.map((o) => esc(readerName(o.uid))).join(", ")} — go find each other on Sunday.</p>
    </div>`).join("");
}

function bookTags(b, counts) {
  const t = [`<span class="tag">${esc(b.genre)}</span>`];
  if (b.lang && b.lang !== "English") t.push(`<span class="tag y">${esc(b.lang)}</span>`);
  if (b.status === "finished") t.push(`<span class="tag g">finished</span>`);
  if (counts && counts[norm(b.title)] === 1) t.push(`<span class="tag p">nobody else has this</span>`);
  if (b.lendable) t.push(`<span class="tag b">yours if you ask</span>`);
  if (b.isPrivate) t.push(`<span class="tag k">private</span>`);
  return t.join("");
}

function renderFilters() {
  const box = $("filters");
  const langs = [...new Set(state.pub.books.map((b) => b.lang).filter(Boolean))];
  const genres = [...new Set(state.pub.books.map((b) => b.genre).filter(Boolean))];
  const btn = (label, on, fn) => {
    const el = document.createElement("button");
    el.textContent = label;
    if (on) el.classList.add("on");
    el.addEventListener("click", () => { fn(); renderFilters(); renderWall(); });
    return el;
  };
  box.innerHTML = "";
  box.appendChild(btn("Only my matches", filters.mine, () => filters.mine = !filters.mine));
  box.appendChild(btn("Up for grabs", filters.lendable, () => filters.lendable = !filters.lendable));
  box.appendChild(btn("Reading now", filters.status === "reading", () => filters.status = filters.status === "reading" ? null : "reading"));
  box.appendChild(btn("Finished", filters.status === "finished", () => filters.status = filters.status === "finished" ? null : "finished"));
  genres.forEach((g) => box.appendChild(
    btn(g, filters.genre === g, () => filters.genre = filters.genre === g ? null : g)));
  langs.filter((l) => l !== "English").forEach((l) => box.appendChild(
    btn(l, filters.lang === l, () => filters.lang = filters.lang === l ? null : l)));
}

function renderWall() {
  const counts = titleCounts();
  const twinTitles = new Set(myTwins().map((t) => norm(t.book.title)));
  // Latest activity first: a book's moment is the day it was finished, or
  // else the day it went up. Same day, the one added later comes first.
  const latest = (b) => (b.finishedAt && b.finishedAt > (b.startedAt || "") ? b.finishedAt : b.startedAt || "");
  let books = state.pub.books.map((b, i) => ({ b, i, at: latest(b) }))
    .sort((x, y) => y.at.localeCompare(x.at) || y.i - x.i).map((x) => x.b);
  if (filters.status) books = books.filter((b) => b.status === filters.status);
  if (filters.genre) books = books.filter((b) => b.genre === filters.genre);
  if (filters.lang) books = books.filter((b) => b.lang === filters.lang);
  if (filters.lendable) books = books.filter((b) => b.lendable);
  if (filters.mine) books = books.filter((b) => twinTitles.has(norm(b.title)));

  if (!books.length) {
    $("wall").innerHTML = `<p class="quiet">${state.pub.books.length
      ? "Nothing matches that. Loosen the filter."
      : "Nothing here yet. Add whatever's open on your table — three pages in still counts."}</p>`;
    return;
  }

  $("wall").innerHTML = books.map((b) => `
    <div class="entry" id="e-${esc(b.id)}">
      ${chip(b)}
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${b.author ? `<b class="by">${esc(b.author)}</b> — ` : ""}<span class="who${b.uid === state.user.uid ? " me" : ""}">${esc(readerName(b.uid))}${b.uid === state.user.uid ? " (you)" : ""}</span></div>
        <div>${bookTags(b, counts)}</div>
        ${b.line ? `<div class="line">${esc(b.line)}</div>` : ""}
      </div>
    </div>`).join("");
}

function jumpTo(id) {
  switchTab("shelf");
  const el = $("e-" + id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.background = "var(--yellow)";
  setTimeout(() => { el.style.background = ""; }, 1400);
}

function renderMine() {
  const me = state.pub.members[state.user.uid] || { name: "", days: [] };
  const days = me.days || [];
  const streak = streakOf(days);
  $("my-name").textContent = me.name || "You";
  $("streak").textContent = streak;
  $("streak-unit").textContent = streak === 1 ? "day running" : "days running";
  $("dots").innerHTML = lastDays(14).map((d) =>
    `<span class="dot${days.includes(d) ? " on" : ""}${d === todayISO() ? " today" : ""}"></span>`).join("");
  const done = days.includes(todayISO());
  $("checkin").disabled = done;
  $("checkin").textContent = done ? "Done for today" : "I read today";

  const counts = titleCounts();
  const books = allMine();
  const box = $("my-books");
  if (!books.length) {
    box.innerHTML = `<p class="quiet">Nothing yet. Add whatever's open on your table — three pages in still counts.</p>`;
    return;
  }
  box.innerHTML = books.map((b) => {
    const alone = !state.pub.books.some((o) => o.uid !== state.user.uid && norm(o.title) === norm(b.title));
    return `
    <div class="entry">
      ${chip(b)}
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${esc(b.author || "author unknown")}</div>
        <div>${bookTags({ ...b, lendable: b.lendable }, null)}
          ${alone && !b.isPrivate ? `<span class="tag p">first in the circle</span>` : ""}</div>
        ${b.line ? `<div class="line">${esc(b.line)}</div>` : ""}
        <div class="acts">
          ${b.status === "finished" && !b.isPrivate ? `<button class="btn ghost${b.id === justFinished ? " nudge" : ""}" data-act="brag" data-id="${esc(b.id)}">Brag about it ✦</button>` : ""}
          ${b.status === "reading" ? `<button class="btn ghost" data-act="finish" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">I finished it</button>` : ""}
          <button class="btn ghost" data-act="line" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">${b.line ? "Change the line" : "Save a line you liked"}</button>
          <button class="btn ghost" data-act="details" data-id="${esc(b.id)}">Edit details</button>
          ${b.isPrivate ? "" : `<button class="btn ghost" data-act="lend" data-id="${esc(b.id)}">${b.lendable ? "Keeping it" : "Happy to lend it"}</button>`}
          <button class="btn ghost" data-act="remove" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">Remove</button>
        </div>
        ${editing?.id === b.id ? `
        <div class="editor details">
          <label class="field"><span>title</span>
            <input type="text" id="et-${esc(b.id)}" data-edit="title" maxlength="120" autocomplete="off" value="${esc(editing.title)}"></label>
          <label class="field"><span>author</span>
            <input type="text" id="ea-${esc(b.id)}" data-edit="author" maxlength="80" autocomplete="off" value="${esc(editing.author)}"></label>
          <div class="acts">
            <button class="btn" data-act="details-save" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">Save changes</button>
            <button class="btn ghost" data-act="details-cancel" data-id="${esc(b.id)}">Cancel</button>
          </div>
        </div>` : ""}
        <div class="editor" id="ed-${esc(b.id)}" hidden>
          <textarea class="field" id="ta-${esc(b.id)}" rows="2" maxlength="300"
            placeholder="One sentence that stuck with you">${esc(b.line || "")}</textarea>
          <button class="btn ghost" data-act="line-save" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">Save it</button>
        </div>
      </div>
    </div>`;
  }).join("");
  // Put the cursor back where it was if a re-render rebuilt the editor.
  if (editing) {
    const f = $((editing.focus === "author" ? "ea-" : "et-") + editing.id);
    if (f && editing.focused) { f.focus({ preventScroll: true }); f.setSelectionRange(f.value.length, f.value.length); }
    if (!books.some((x) => x.id === editing.id)) editing = null;   // removed elsewhere
  }
}

function renderStandings() {
  const counts = titleCounts();
  const per = Object.entries(state.pub.members).map(([id, m]) => {
    const bs = state.pub.books.filter((b) => b.uid === id);
    return {
      id, name: m.name, streak: streakOf(m.days),
      genres: new Set(bs.map((b) => b.genre)).size,
      rare: bs.filter((b) => counts[norm(b.title)] === 1).length,
      done: bs.filter((b) => b.status === "finished").length,
    };
  });

  const boards = [
    { title: "On a roll", k: "streak", unit: "days", color: "green", note: "Most days in a row without missing." },
    { title: "All over the map", k: "genres", unit: "shelves", color: "blue", note: "Readers who refuse to stay in one section." },
    { title: "Off the beaten track", k: "rare", unit: "books", color: "pink", note: "Books nobody else here has touched." },
    { title: "Finished and done", k: "done", unit: "books", color: "yellow", note: "Closed, shut, back on the shelf." },
  ];

  $("standings").innerHTML = boards.map((b) => {
    const sorted = [...per].sort((x, y) => y[b.k] - x[b.k]);
    const ranked = sorted.filter((p) => p[b.k] > 0);
    const top = ranked.slice(0, 5);
    const myIdx = sorted.findIndex((p) => p.id === state.user.uid);
    const me = sorted[myIdx];
    const inTop = top.some((p) => p.id === state.user.uid);

    let rows = top.map((r, i) => `
      <div class="rank${r.id === state.user.uid ? " you" : ""}">
        <span class="medal" style="background:${INKS[i % INKS.length]}">${i + 1}</span>
        <span class="nm">${esc(r.name)}</span>
        <span class="v">${r[b.k]} ${plural(r[b.k], b.unit)}</span>
      </div>`).join("");

    if (!ranked.length) rows = `<p class="quiet">Wide open. Someone could take this one easily.</p>`;

    let mine = "";
    if (me && !inTop) {
      const above = sorted[myIdx - 1];
      const gap = above ? above[b.k] - me[b.k] : 0;
      mine = `
      <div class="rank you">
        <span class="medal" style="background:var(--ink)">${myIdx + 1}</span>
        <span class="nm">You</span>
        <span class="v">${me[b.k]} ${plural(me[b.k], b.unit)}</span>
      </div>
      ${above ? `<p class="quiet">${gap === 0 ? "Level with" : gap + " " + plural(gap, b.unit) + " off"} ${esc(above.name)} in ${myIdx}${ordinal(myIdx)}.</p>` : ""}`;
    }

    return `<div class="card ${b.color}">
      <h3>${b.title}</h3><p class="quiet" style="margin-bottom:11px">${b.note}</p>${rows}${mine}</div>`;
  }).join("");
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] || "th";
}

function renderSunday() {
  $("sunday-heading").textContent = `Bringing it up on ${nextSunday()}`;
  const board = state.pub.board || [];
  $("board").innerHTML = board.length ? board.map((p) => `
    <div class="entry">
      <div class="chip" style="background:${inkFor(p.id)}"></div>
      <div class="body">
        <div>${esc(p.text)}</div>
        <div class="meta">${esc(readerName(p.uid))}${p.uid === state.user.uid ? " (you)" : ""}</div>
        ${p.uid === state.user.uid ? `<div class="acts">
          <button class="btn ghost" data-act="unpin" data-id="${esc(p.id)}">Delete</button>
        </div>` : ""}
      </div>
    </div>`).join("") : `<p class="quiet">Nothing down yet. Someone has to go first.</p>`;

  const lend = state.pub.books.filter((b) => b.lendable);
  $("lendable").innerHTML = lend.length ? lend.map((b) => `
    <div class="entry">
      ${chip(b)}
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${b.author ? esc(b.author) + " — " : ""}from ${esc(readerName(b.uid))}</div>
      </div>
    </div>`).join("") : `<p class="quiet">None offered yet. Mark one of yours if you're happy to pass it on.</p>`;
}

/* ---------- events ---------- */

function switchTab(name) {
  tab = name;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("on", t.dataset.tab === name));
  ["shelf", "mine", "standings", "sunday"].forEach((t) =>
    $("panel-" + t).hidden = t !== name);
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (b) switchTab(b.dataset.tab);
});

$("filter-toggle").addEventListener("click", () => {
  const f = $("filters");
  f.hidden = !f.hidden;
  if (!f.hidden) renderFilters();
});

GENRES.forEach((g) => $("f-genre").add(new Option(g, g)));
LANGS.forEach((l) => $("f-lang").add(new Option(l, l)));

$("add-toggle").addEventListener("click", () => {
  const f = $("add-form");
  f.hidden = !f.hidden;
  $("add-toggle").textContent = f.hidden ? "Add a book" : "Never mind";
});

$("add-save").addEventListener("click", async () => {
  const title = $("f-title").value.trim();
  if (!title) { showError("Give the book a title first."); $("f-title").focus(); return; }
  const book = {
    id: uid(), uid: state.user.uid, title,
    author: $("f-author").value.trim(), genre: $("f-genre").value,
    lang: $("f-lang").value, status: "reading", startedAt: todayISO(),
    line: "", lendable: false,
  };
  if ($("f-private").checked) {
    await mutatePrivate((p) => { p.books.push(book); return p; });
  } else {
    await mutate((c) => { c.books.push(book); return c; });
  }
  ["f-title", "f-author"].forEach((i) => $(i).value = "");
  $("f-private").checked = false;
  $("add-form").hidden = true;
  $("add-toggle").textContent = "Add a book";
  party("On the shelf it goes.");
});

$("my-books").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const { act, id } = b.dataset;
  const isPriv = b.dataset.p === "1";
  const patch = (changes) => isPriv
    ? mutatePrivate((p) => { p.books = p.books.map((x) => x.id === id ? { ...x, ...changes } : x); return p; })
    : mutate((c) => { c.books = c.books.map((x) => x.id === id ? { ...x, ...changes } : x); return c; });

  if (act === "finish") {
    // Private books never go on a card, so only public ones get the offer.
    if (!isPriv) {
      justFinished = id;
      setTimeout(() => { if (justFinished === id) justFinished = null; }, 20000);
    }
    await patch({ status: "finished", finishedAt: todayISO() });
    party("Finished. That's one more.");
  }
  if (act === "brag") openBragCards({ card: "finished", bookId: id });
  if (act === "lend") {
    const cur = state.pub.books.find((x) => x.id === id);
    await patch({ lendable: !cur?.lendable });
  }
  if (act === "line") {
    const ed = $("ed-" + id);
    ed.hidden = !ed.hidden;
    if (!ed.hidden) $("ta-" + id).focus();
  }
  if (act === "line-save") {
    await patch({ line: $("ta-" + id).value.trim().slice(0, 300) });
    party("Saved.");
  }
  if (act === "details") {
    const cur = allMine().find((x) => x.id === id);
    if (!cur) return;
    editing = editing?.id === id ? null : { id, title: cur.title || "", author: cur.author || "", focus: "title", focused: true };
    renderMine();
  }
  if (act === "details-cancel") { editing = null; renderMine(); }
  if (act === "details-save") {
    const title = String(editing?.title || "").trim().slice(0, 120);
    const author = String(editing?.author || "").trim().slice(0, 80);
    if (!title) { showError("A book needs a title."); $("et-" + id)?.focus(); return; }
    if (state.busy) { showError("Still saving the last change. Give it a second."); return; }   // keep the typing
    editing = null;
    // Only ever your own book: private ones live in your own record, and a
    // public one has to carry your account as well as this id.
    if (isPriv) await mutatePrivate((p) => { p.books = p.books.map((x) => x.id === id ? { ...x, title, author } : x); return p; });
    else await mutate((c) => { c.books = c.books.map((x) => x.id === id && x.uid === state.user.uid ? { ...x, title, author } : x); return c; });
    party("Updated.");
  }
  if (act === "remove") {
    if (!confirm("Take this off your shelf?")) return;
    if (isPriv) await mutatePrivate((p) => { p.books = p.books.filter((x) => x.id !== id); return p; });
    else await mutate((c) => { c.books = c.books.filter((x) => x.id !== id); return c; });
  }
});

// Typing in the title/author editor: keep it in `editing` as you go.
$("my-books").addEventListener("input", (e) => {
  const k = e.target.dataset?.edit;
  if (k && editing) editing[k] = e.target.value;
});
$("my-books").addEventListener("focusin", (e) => {
  const k = e.target.dataset?.edit;
  if (k && editing) { editing.focus = k; editing.focused = true; }
});
$("my-books").addEventListener("focusout", (e) => {
  if (e.target.dataset?.edit && editing) editing.focused = false;
});
$("my-books").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset?.edit) {
    e.preventDefault();
    e.target.closest(".editor")?.querySelector('[data-act="details-save"]')?.click();
  }
});

$("checkin").addEventListener("click", async () => {
  const me = state.pub.members[state.user.uid];
  const next = streakOf(me?.days || []) + 1;
  await mutate((c) => {
    const m = c.members[state.user.uid] || { name: state.user.displayName, joined: todayISO(), days: [] };
    const set = new Set(m.days || []);
    set.add(todayISO());
    m.days = [...set].sort().slice(-DAY_CAP);
    c.members[state.user.uid] = m;
    return c;
  });
  party(next >= 7 ? `${next} days straight!` : CHEERS[hash(todayISO()) % CHEERS.length]);
});

// Brag cards live in brag.js and are fetched on the first tap, so nobody
// downloads them until they want one. The Mine-tab button ships hidden and
// only this code shows it: if a cached copy of this file or of index.html is
// out of step with the other, there's no dead button, and no missing one to
// crash on. `open` can name a card and book to go straight to.
let bragOpening = false;
async function openBragCards(open = {}) {
  if (bragOpening) return;
  bragOpening = true;
  try {
    const { openBrag } = await import("./brag.js");
    // A copy, so nothing on a card can ever change what the site holds.
    const snap = structuredClone({
      me: state.pub.members[state.user.uid] || { name: state.user.displayName, days: [] },
      mine: myBooksPublic(),
      books: state.pub.books,
      members: state.pub.members,
    });
    await openBrag({ ...snap, uid: state.user.uid, inkFor, streakOf, norm }, open);
  } catch {
    showError("Couldn't open the brag cards. Check your connection and try again.");
  } finally {
    bragOpening = false;
  }
}
const bragBtn = $("brag");
if (bragBtn) {
  bragBtn.hidden = false;
  bragBtn.addEventListener("click", () => openBragCards());
}
const circleBtn = $("circle-card");
if (circleBtn) {
  circleBtn.hidden = false;
  circleBtn.addEventListener("click", () => openBragCards({ mode: "circle" }));
}

$("board").addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-act="unpin"]');
  if (!btn) return;
  const { id } = btn.dataset;
  const post = (state.pub.board || []).find((x) => x.id === id);
  if (!post || post.uid !== state.user.uid) return;
  if (!confirm("Take this off the agenda?")) return;
  await mutate((c) => {
    c.board = (c.board || []).filter((x) => x.id !== id || x.uid !== state.user.uid);
    return c;
  });
});

$("board-post").addEventListener("click", async () => {
  const text = $("board-text").value.trim();
  if (!text) { showError("Write something first."); $("board-text").focus(); return; }
  await mutate((c) => {
    c.board = [{ id: uid(), uid: state.user.uid, text, at: todayISO() },
      ...(c.board || [])].slice(0, BOARD_CAP);
    return c;
  });
  $("board-text").value = "";
});

/* ---------- bits and pieces ---------- */

function showError(msg) { $("error").textContent = msg; $("error").hidden = false; }
function hideError() { $("error").hidden = true; }

let partyTimer;
function party(msg) {
  const box = $("party");
  $("party-msg").textContent = msg;
  box.hidden = false;
  clearTimeout(partyTimer);
  partyTimer = setTimeout(() => { box.hidden = true; }, 2400);
}
