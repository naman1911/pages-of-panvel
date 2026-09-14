import { firebaseConfig, CIRCLE } from "./config.js";

// Add ?demo to the URL to run the whole site on sample data, with no Firebase
// at all. Useful for showing people what it looks like before anyone signs up.
const DEMO = new URLSearchParams(location.search).has("demo");

/* ---------- constants ---------- */

const GENRES = ["Fiction", "Poetry", "History", "Memoir", "Crime", "Sci-fi & fantasy",
  "Philosophy", "Science", "Essays", "Graphic novel", "Children's", "Other"];
const LANGS = ["English", "मराठी", "हिंदी", "Other"];
// Spine colours. Bright on purpose — they sit on a dark page and carry
// near-black text, so every one of these has to stay light.
const INKS = ["#CBFF41", "#FF6A2B", "#49E8FF", "#B69CFF", "#FF4D9D", "#FFD23F", "#5CE68A"];
const OFFLINE = "Can't reach the shelf right now. It'll reconnect on its own.";
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
const heightFor = (s) => 96 + (hash(s + "h") % 58);

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
let filters = { genre: null, lang: null, lendable: false, mine: false };
let tab = "shelf";

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
        ? "You're not on the member list for this circle. Ask whoever runs the group to add you."
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
    if (e?.code !== "auth/popup-closed-by-user") {
      $("gate-msg").textContent = "Sign-in didn't go through. Try again?";
      $("gate-msg").hidden = false;
    }
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
      if ($("error").textContent === OFFLINE) hideError();
      state.pub = { ...EMPTY, ...(snap.exists() ? snap.data() : EMPTY) };
      ensureMember();
      renderAll();
    },
    () => showError(OFFLINE)
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
}

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
  reading.slice(0, 120).forEach((b) => {
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
}

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
  genres.forEach((g) => box.appendChild(
    btn(g, filters.genre === g, () => filters.genre = filters.genre === g ? null : g)));
  langs.filter((l) => l !== "English").forEach((l) => box.appendChild(
    btn(l, filters.lang === l, () => filters.lang = filters.lang === l ? null : l)));
}

function renderWall() {
  const counts = titleCounts();
  const twinTitles = new Set(myTwins().map((t) => norm(t.book.title)));
  let books = [...state.pub.books].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
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
      <div class="chip" style="background:${inkFor(b.title)}"></div>
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${b.author ? esc(b.author) + " — " : ""}${esc(readerName(b.uid))}${b.uid === state.user.uid ? " (you)" : ""}</div>
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
      <div class="chip" style="background:${inkFor(b.title)}"></div>
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${esc(b.author || "author unknown")}</div>
        <div>${bookTags({ ...b, lendable: b.lendable }, null)}
          ${alone && !b.isPrivate ? `<span class="tag p">first in the circle</span>` : ""}</div>
        ${b.line ? `<div class="line">${esc(b.line)}</div>` : ""}
        <div class="acts">
          ${b.status === "reading" ? `<button class="btn ghost" data-act="finish" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">I finished it</button>` : ""}
          <button class="btn ghost" data-act="line" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">${b.line ? "Change the line" : "Save a line you liked"}</button>
          ${b.isPrivate ? "" : `<button class="btn ghost" data-act="lend" data-id="${esc(b.id)}">${b.lendable ? "Keeping it" : "Happy to lend it"}</button>`}
          <button class="btn ghost" data-act="remove" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">Remove</button>
        </div>
        <div class="editor" id="ed-${esc(b.id)}" hidden>
          <textarea class="field" id="ta-${esc(b.id)}" rows="2" maxlength="300"
            placeholder="One sentence that stuck with you">${esc(b.line || "")}</textarea>
          <button class="btn ghost" data-act="line-save" data-id="${esc(b.id)}" data-p="${b.isPrivate ? 1 : 0}">Save it</button>
        </div>
      </div>
    </div>`;
  }).join("");
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
        <div class="meta">${esc(readerName(p.uid))}</div>
      </div>
    </div>`).join("") : `<p class="quiet">Nothing down yet. Someone has to go first.</p>`;

  const lend = state.pub.books.filter((b) => b.lendable);
  $("lendable").innerHTML = lend.length ? lend.map((b) => `
    <div class="entry">
      <div class="chip" style="background:${inkFor(b.title)}"></div>
      <div class="body">
        <div class="title">${esc(b.title)}</div>
        <div class="meta">${b.author ? esc(b.author) + " — " : ""}from ${esc(readerName(b.uid))}</div>
      </div>
    </div>`).join("") : `<p class="quiet">None offered yet. Mark one of yours if you're happy to pass it on.</p>`;
}

/* ---------- round-up for WhatsApp ---------- */

function roundUp() {
  const L = [];
  L.push(`*${CIRCLE.name}* — ${nextSunday()}, ${CIRCLE.when} in ${CIRCLE.where}`);
  const reading = state.pub.books.filter((b) => b.status === "reading").length;
  L.push(`${reading} books open across ${Object.keys(state.pub.members).length} of us.`);

  const board = (state.pub.board || []).slice(0, 6);
  if (board.length) {
    L.push("", "*On the agenda*");
    board.forEach((p) => L.push(`• ${p.text} — ${readerName(p.uid)}`));
  }

  const lend = state.pub.books.filter((b) => b.lendable).slice(0, 8);
  if (lend.length) {
    L.push("", "*Books going spare*");
    lend.forEach((b) => L.push(`• ${b.title}${b.author ? ", " + b.author : ""} — ask ${readerName(b.uid)}`));
  }

  const streaks = Object.entries(state.pub.members)
    .map(([id, m]) => ({ name: m.name, s: streakOf(m.days) }))
    .filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 5);
  if (streaks.length) {
    L.push("", "*On a roll*");
    L.push(streaks.map((x) => `${x.name} (${x.s}d)`).join(", "));
  }

  L.push("", location.origin + location.pathname);
  return L.join("\n");
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
    await patch({ status: "finished", finishedAt: todayISO() });
    party("Finished. That's one more.");
  }
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
  if (act === "remove") {
    if (!confirm("Take this off your shelf?")) return;
    if (isPriv) await mutatePrivate((p) => { p.books = p.books.filter((x) => x.id !== id); return p; });
    else await mutate((c) => { c.books = c.books.filter((x) => x.id !== id); return c; });
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

$("wa-share").addEventListener("click", () => {
  window.open("https://wa.me/?text=" + encodeURIComponent(roundUp()), "_blank", "noopener");
});
$("wa-copy").addEventListener("click", async () => {
  const text = roundUp();
  $("wa-preview").textContent = text;
  $("wa-preview").hidden = false;
  try { await navigator.clipboard.writeText(text); party("Copied. Paste it in the group."); }
  catch { party("Select the text below and copy it."); }
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
