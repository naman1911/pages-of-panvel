/* Book covers from Open Library (openlibrary.org), and from Google Books
   when Open Library has nothing for a book. Both are free.

   app.js draws every book with its coloured chip, as it always has. A book
   that could have a cover also carries data-cover on its chip. This file
   looks those up, a couple at a time and only when they scroll into view,
   and swaps a chip for the cover once one is found. Answers go into app.js's
   COVERS map, so the next render draws the cover straight away.

   It fails quietly and completely: no match, a slow or broken service, an
   image that won't load, all leave the chip exactly as it was. After a few
   failed lookups in a row it stops asking that service for the rest of the
   visit. Answers are remembered on the phone (a found cover for 60 days, a
   miss for 14), so the shelf doesn't ask again on every visit.

   It is careful about what it matches. A wrong cover is worse than none, so
   a cover is used only when the title's words agree and the author's
   surname does too, give or take a small typo in either. A typo can also
   hide a book from the search itself, so a book that isn't found by title
   and author is looked for by title alone, then by author alone.

   What gets sent is a book's title and author, and only for public books:
   app.js never marks a private one.                                        */

import { firebaseConfig } from './config.js';

const SEARCH = 'https://openlibrary.org/search.json';
const COVER = (id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const PARALLEL = 2, TIMEOUT = 8000, GIVE_UP_AFTER = 4;

let cache = null, running = 0;
const queue = [], asked = new Set();

// Latin only, accents folded, a leading article dropped, punctuation gone.
const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /, '');
const surname = (s) => n(s).split(' ').pop() || '';

// Small typos are forgiven, word by word: none in a word of 3 letters or
// fewer, one in 4 to 7 letters, two in 8 or more. A swapped pair counts as
// one ("Tolkein" is "Tolkien", "Slaugtherhouse" is "Slaughterhouse").
const slack = (len) => (len <= 3 ? 0 : len <= 7 ? 1 : 2);
function typos(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let p2 = null, p1 = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(p1[j] + 1, row[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, p2[j - 2] + 1);
      row.push(d);
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    p2 = p1; p1 = row;
  }
  return p1[b.length];
}
const near = (a, b) => a === b || typos(a, b, slack(Math.min(a.length, b.length))) <= slack(Math.min(a.length, b.length));

// Little words don't have to match: "lord of flies" is "Lord of the Flies".
const SMALL = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'with', 'at', 'by', 'from']);
const words = (s) => { const all = s.split(' ').filter(Boolean), big = all.filter((w) => !SMALL.has(w)); return big.length ? big : all; };

// Titles get typed from memory, so they match on words, not letters.
// "lord of flies" finds "Lord of the Flies", and "you should talk to someone"
// finds "Maybe You Should Talk to Someone": every word typed has to be in
// the real title (or the other way round, for a typed subtitle), give or
// take a typo. A one-word title is too loose for that, so the real title
// has to be that one word too, before any subtitle: "hobbit" finds "The
// Hobbit, or There and Back Again", but not "The Annotated Hobbit", and
// "dune" isn't "Dune Messiah". Spaces don't matter either: "slaughter house
// five" is "Slaughterhouse-Five". The author's surname is checked as well,
// in pick(). a is what was typed, b the real title.
function sameTitle(a, b) {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // Spaces typed differently, so the words don't line up: compare without
  // them, allowing a single typo at most.
  if (short.length !== long.length && typos(short.join(''), long.join(''), 1) <= 1) return true;
  if (x.length === 1) return y.length === 1 && near(x[0], y[0]);
  if (short.length === 1) return near(short[0], long[0]);
  return short.every((w) => long.some((v) => near(w, v)));
}

// Candidates from either service come in as { titles, authors, url }.
// Exported only so the matching can be tested on its own.
export function pick(found, title, author) {
  const t = n(title), sn = surname(author), mine = n(author).split(' ');
  // The typed surname is in their name, or their surname is in what was
  // typed: either way give or take a typo, and never on a single letter.
  const agree = (x) => {
    const theirs = x.split(' '), last = theirs[theirs.length - 1];
    return (sn.length > 1 && theirs.some((w) => w.length > 1 && near(sn, w)))
      || (last.length > 1 && mine.some((w) => w.length > 1 && near(last, w)));
  };
  for (const c of found) {
    // Each real title as given, and its main part before a subtitle.
    const titles = c.titles.flatMap((x) => [x, String(x).split(/\s*[:(,;]/)[0]]).map(n);
    if (!c.url || !titles.some((x) => sameTitle(t, x))) continue;
    if (c.authors.map(n).filter(Boolean).some(agree)) return c.url;
  }
  return '';
}

async function get(url, ownReferrer = false) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: ownReferrer ? 'origin' : 'no-referrer' });
  } finally {
    clearTimeout(timer);
  }
}

// Three ways to ask, tried in turn until one finds the book:
//   both    title and the author's surname (only the surname: a misspelt
//           first name, "Mich Albom", or initials, "J.R.R.", otherwise make
//           it come back empty)
//   title   the title alone, for when the author's name has a typo
//   author  the surname alone, for when the title has a typo
// Whatever comes back is still checked word by word in pick().
const WAYS = ['both', 'title', 'author'];

async function openLibrary(title, author, way) {
  const sn = surname(author);
  const q = new URLSearchParams(way === 'both' ? { title, author: sn, limit: '10' }
    : way === 'title' ? { title, limit: '20' } : { author: sn, limit: '100' });
  q.set('fields', 'cover_i,title,author_name');
  const r = await get(`${SEARCH}?${q}`);
  if (!r.ok) throw new Error(String(r.status));
  return pick(((await r.json()).docs || []).map((d) => ({
    titles: [d.title], authors: d.author_name || [], url: d.cover_i ? COVER(d.cover_i) : '',
  })), title, author);
}

// Google Books answers far more reliably with a key: it uses the project's
// own (the Firebase web key, public like the rest of config.js) once the
// Books API is switched on for it. Until then, or if it's refused, it asks
// without one. The key is checked against the site's address, so the origin
// goes with keyed requests; nothing else does.
let googleKey = firebaseConfig?.apiKey || '';
async function googleBooks(title, author, way) {
  const sn = surname(author) || n(author);
  const q = new URLSearchParams({
    q: way === 'both' ? `${title} inauthor:${sn}` : way === 'title' ? title : `inauthor:${sn}`,
    printType: 'books', maxResults: way === 'both' ? '10' : '40',
    fields: 'items(volumeInfo(title,subtitle,authors,imageLinks/thumbnail))',
  });
  let r = googleKey ? await get(`${GOOGLE}?${q}&key=${encodeURIComponent(googleKey)}`, true) : null;
  if (!r || r.status === 400 || r.status === 403) { googleKey = ''; r = await get(`${GOOGLE}?${q}`); }
  if (!r.ok) throw new Error(String(r.status));
  return pick(((await r.json()).items || []).map(({ volumeInfo: v = {} }) => ({
    titles: [v.title, v.subtitle ? `${v.title} ${v.subtitle}` : ''].filter(Boolean),
    authors: v.authors || [],
    // Google hands out http:// links with a page-curl drawn on; ask for neither.
    url: (v.imageLinks?.thumbnail || '').replace(/^http:/, 'https:').replace(/&edge=curl/, ''),
  })), title, author);
}

// Open Library first; Google Books only when Open Library found nothing.
const SOURCES = [{ find: openLibrary, fails: 0, off: false }, { find: googleBooks, fails: 0, off: false }];
// A surname of a letter or two finds far too many books to trust.
const usable = (way, title, author) => way !== 'author' || surname(author).length > 2;
const stopped = () => SOURCES.every((s) => s.off);

// { url, sure }: sure means every service answered, so a miss is a real miss
// and worth remembering; one that errored or gave up means try another day.
async function lookup(title, author) {
  let sure = true;
  for (const way of WAYS) {
    if (!usable(way, title, author)) continue;
    for (const s of SOURCES) {
      if (s.off) { sure = false; continue; }
      try {
        const url = await s.find(title, author, way);
        s.fails = 0;
        if (url) return { url, sure: true };
      } catch {
        sure = false;
        if (++s.fails >= GIVE_UP_AFTER) s.off = true;
      }
    }
  }
  return { url: '', sure };
}

/* ---------- remembered answers, on this phone only ---------- */

// v2: typo-forgiving matching, so misses remembered by v1 get another go.
const STORE = 'pop.covers.v2', DAY = 864e5, HIT_DAYS = 60, MISS_DAYS = 14, KEEP = 1500;
let saved = {}, saveT = 0;
function loadSaved() {
  try { localStorage.removeItem('pop.covers.v1'); } catch { /* blocked: fine */ }
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { saved = {}; }
  const now = Date.now();
  for (const [k, v] of Object.entries(saved)) if (!Array.isArray(v) || !(v[1] > now)) delete saved[k];
}
function remember(key, url) {
  saved[key] = [url, Date.now() + (url ? HIT_DAYS : MISS_DAYS) * DAY];
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const keys = Object.keys(saved);
    if (keys.length > KEEP) keys.sort((a, b) => saved[a][1] - saved[b][1]).slice(0, keys.length - KEEP).forEach((k) => delete saved[k]);
    try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* full or blocked: just don't remember */ }
  }, 1000);
}

function coverImg(url, bg, key) {
  const img = document.createElement('img');
  img.className = 'chip cover';
  img.alt = '';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.style.background = bg;
  img.dataset.coverKey = key;
  img.src = url;
  return img;
}

// Put the answer on every chip for that book currently on screen: the same
// book can be on the wall, in Mine and in Copies on offer at once.
function apply(key) {
  const url = cache.get(key);
  document.querySelectorAll(`[data-cover="${CSS.escape(key)}"]`).forEach((el) => {
    if (url) el.replaceWith(coverImg(url, el.style.background, key));
    else { delete el.dataset.cover; delete el.dataset.t; delete el.dataset.a; }
  });
}

function pump() {
  if (stopped()) { queue.length = 0; return; }
  while (running < PARALLEL && queue.length) {
    const { key, title, author } = queue.shift();
    running++;
    lookup(title, author)
      .then(({ url, sure }) => { cache.set(key, url); if (sure) remember(key, url); })
      .catch(() => cache.set(key, ''))
      .finally(() => { running--; apply(key); pump(); });
  }
}

function want(el) {
  const key = el.dataset.cover;
  if (!key) return;
  if (cache.has(key)) { apply(key); return; }
  if (stopped() || asked.has(key)) return;
  asked.add(key);
  queue.push({ key, title: el.dataset.t || '', author: el.dataset.a || '' });
  pump();
}

// A cover that won't load, or comes back as a blank (Open Library's is 1
// pixel), goes back to being the chip, and is looked at again another day.
function undo(img) {
  const key = img.dataset.coverKey;
  if (key) { cache.set(key, ''); remember(key, ''); }
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.style.background = img.style.background;
  img.replaceWith(chip);
}

export function start(map) {
  if (cache) return;
  cache = map;
  loadSaved();
  for (const [k, v] of Object.entries(saved)) if (!cache.has(k)) cache.set(k, v[0]);
  const app = document.getElementById('app');
  if (!app || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((seen) => {
    for (const e of seen) if (e.isIntersecting) { io.unobserve(e.target); want(e.target); }
  }, { rootMargin: '300px 0px' });
  const scan = (root) => root.querySelectorAll('[data-cover]').forEach((el) => io.observe(el));

  // app.js re-renders its lists often (every change anyone makes), so watch
  // for new chips rather than asking it to tell us.
  new MutationObserver((changes) => {
    for (const c of changes) for (const node of c.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches('[data-cover]')) io.observe(node);
      scan(node);
    }
  }).observe(app, { childList: true, subtree: true });
  scan(app);

  app.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.classList.contains('cover')) undo(e.target);
  }, true);
  app.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.classList.contains('cover') && img.naturalWidth < 8) undo(img);
  }, true);
}
