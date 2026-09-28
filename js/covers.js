/* Book covers from Open Library (openlibrary.org): free, no account, no key.

   app.js draws every book with its coloured chip, as it always has. A book
   that could have a cover also carries data-cover on its chip. This file
   looks those up, a couple at a time and only when they scroll into view,
   and swaps a chip for the cover once one is found. Answers go into app.js's
   COVERS map, so the next render draws the cover straight away.

   It fails quietly and completely: no match, a slow or broken Open Library,
   an image that won't load, all leave the chip exactly as it was. After a
   few failed lookups in a row it stops asking for the rest of the visit.

   It is careful about what it matches. A wrong cover is worse than none, so
   a cover is used only when the title agrees and the author's surname does
   too. What gets sent is a book's title and author, and only for public
   books: app.js never marks a private one.                                  */

const SEARCH = 'https://openlibrary.org/search.json';
const COVER = (id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
const PARALLEL = 2, TIMEOUT = 8000, GIVE_UP_AFTER = 4;

let cache = null, running = 0, failures = 0, stopped = false;
const queue = [], asked = new Set();

// Latin only, accents folded, a leading article dropped, punctuation gone.
const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /, '');
const surname = (s) => n(s).split(' ').pop() || '';

// "A Fine Balance" matches "A Fine Balance: A Novel" either way round, but
// a one-word title has to match exactly.
function sameTitle(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.includes(' ') && long.startsWith(short + ' ');
}

function pick(docs, title, author) {
  const t = n(title), sn = surname(author), mine = n(author);
  for (const d of docs || []) {
    if (!d.cover_i || !sameTitle(t, n(d.title))) continue;
    const names = (d.author_name || []).map(n).filter(Boolean);
    const agree = (x) => (sn.length > 1 && x.split(' ').includes(sn)) ||
      (surname(x).length > 1 && mine.split(' ').includes(surname(x)));
    if (names.some(agree)) {
      return COVER(d.cover_i);
    }
  }
  return '';
}

async function lookup(title, author) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const q = new URLSearchParams({ title, author, limit: '5', fields: 'cover_i,title,author_name' });
    const r = await fetch(`${SEARCH}?${q}`, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(String(r.status));
    return pick((await r.json()).docs, title, author);
  } finally {
    clearTimeout(timer);
  }
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
  while (!stopped && running < PARALLEL && queue.length) {
    const { key, title, author } = queue.shift();
    running++;
    lookup(title, author)
      .then((url) => { failures = 0; cache.set(key, url); })
      .catch(() => {
        cache.set(key, '');
        if (++failures >= GIVE_UP_AFTER) { stopped = true; queue.length = 0; }
      })
      .finally(() => { running--; apply(key); pump(); });
  }
}

function want(el) {
  const key = el.dataset.cover;
  if (!key) return;
  if (cache.has(key)) { apply(key); return; }
  if (stopped || asked.has(key)) return;
  asked.add(key);
  queue.push({ key, title: el.dataset.t || '', author: el.dataset.a || '' });
  pump();
}

// A cover that won't load, or comes back as Open Library's 1-pixel blank,
// goes back to being the chip, and stays that way for the visit.
function undo(img) {
  const key = img.dataset.coverKey;
  if (key) cache.set(key, '');
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.style.background = img.style.background;
  img.replaceWith(chip);
}

export function start(map) {
  if (cache) return;
  cache = map;
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
