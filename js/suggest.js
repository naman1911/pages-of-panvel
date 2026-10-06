/* Title suggestions in "Add a book": as you type an English title, up to five
   books drop down under the box. Tap one and the title (spelled properly),
   the author, and the genre when it's clear, fill themselves in. Nothing is
   saved until you press the usual button, and everything stays editable.

   Where suggestions come from, in order:
     1. books already on the circle's shelf: instant, no network, and it
        keeps everyone's spelling of the same book the same;
     2. Open Library, then Google Books if Open Library has nothing.
   Online lookups wait for a short pause in typing, need 3+ letters, never
   happen for Devanagari or while "keep this one to myself" is ticked, and
   fail silently (no list, the form works as before).

   It never chooses for you: ignore the list and it's the form it always was.
   Loaded by app.js the first time the add form opens.                      */

import { normal, near } from './covers.js';
import { firebaseConfig } from './config.js';

const OL = 'https://openlibrary.org/search.json';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const MAX = 5, WAIT = 350, TIMEOUT = 6000;

// Book subjects → the shelf's genres, only when it's clear. A novel set in
// a war is still a novel: anything marked as fiction only ever gets a
// fiction genre ("World War, 1939-1945 -- Fiction" is Fiction, not History).
const FICTION_KINDS = [
  ['Graphic novel', /comic|graphic novel|manga/],
  ["Children's", /juvenile|children/],
  ['Sci-fi & fantasy', /science fiction|fantasy|dystopia/],
  ['Crime', /crime|detective|mystery|thriller/],
];
const OTHER_KINDS = [
  ['Graphic novel', /comic|graphic novel|manga/],
  ['Poetry', /poetry|poems/],
  ["Children's", /juvenile|children/],
  ['Memoir', /memoir|autobiograph|biograph/],
  ['Philosophy', /philosoph/],
  ['Essays', /essays/],
  ['History', /^history$|^history,|history$/],
  ['Science', /^science|physics|biology|evolution|astronomy/],
];
function genreFrom(subjects) {
  const s = (subjects || []).slice(0, 40).map((x) => String(x).toLowerCase());
  const has = (re) => s.some((x) => re.test(x));
  if (has(/fiction|novel/)) {
    for (const [g, re] of FICTION_KINDS) if (has(re)) return g;
    return 'Fiction';
  }
  for (const [g, re] of OTHER_KINDS) if (has(re)) return g;
  return '';
}

const DEVANAGARI = /[ऀ-ॿ]/;

// Does what's typed fit this title? Every finished word must be (nearly) in
// it, and the word still being typed must start one of its words.
function fits(typed, title) {
  const t = normal(typed).split(' ').filter(Boolean), words = normal(title).split(' ').filter(Boolean);
  if (!t.length || !words.length) return false;
  const last = t.pop(), done = typed.endsWith(' ');
  const ok = (w) => words.some((v) => v === w || (w.length > 3 && near(w, v)));
  if (!t.every(ok)) return false;
  return done ? ok(last) : words.some((v) => v.startsWith(last) || (last.length > 4 && near(last, v.slice(0, last.length))));
}

async function get(url, ctl, ownReferrer = false) {
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try { return await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: ownReferrer ? 'origin' : 'no-referrer' }); }
  finally { clearTimeout(timer); }
}

// The word still being typed is asked for as a beginning ("slaughterh*");
// if that finds nothing, the finished words alone are asked for, and the
// half-typed one is matched here instead (fits()).
function olQueries(typed) {
  const words = typed.trim().split(/\s+/), done = typed.endsWith(' ');
  if (done) return [words.join(' ')];
  const part = words.pop(), out = [];
  if (part.length >= 3) out.push([...words, `${part}*`].join(' '));
  out.push(words.length ? words.join(' ') : part);
  return out;
}
async function openLibrary(q, ctl) {
  const p = new URLSearchParams({ q, limit: '12', fields: 'title,author_name,first_publish_year,cover_i,subject,language' });
  const r = await get(`${OL}?${p}`, ctl);
  if (!r.ok) throw new Error(String(r.status));
  return ((await r.json()).docs || []).map((d) => ({
    title: d.title, author: (d.author_name || [])[0] || '', year: d.first_publish_year || '',
    thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg` : '',
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    genre: genreFrom(d.subject), english: !d.language || d.language.includes('eng'),
  }));
}

let googleKey = firebaseConfig?.apiKey || '';
async function googleBooks(typed, ctl) {
  const p = new URLSearchParams({ q: `intitle:${typed.trim()}`, printType: 'books', maxResults: '12',
    fields: 'items(volumeInfo(title,authors,publishedDate,imageLinks/thumbnail,categories,language))' });
  let r = googleKey ? await get(`${GB}?${p}&key=${encodeURIComponent(googleKey)}`, ctl, true) : null;
  if (!r || r.status === 400 || r.status === 403) { googleKey = ''; r = await get(`${GB}?${p}`, ctl); }
  if (!r.ok) throw new Error(String(r.status));
  return ((await r.json()).items || []).map(({ volumeInfo: v = {} }) => {
    const img = (v.imageLinks?.thumbnail || '').replace(/^http:/, 'https:').replace(/&edge=curl/, '');
    return { title: v.title, author: (v.authors || [])[0] || '', year: String(v.publishedDate || '').slice(0, 4),
      thumb: img, cover: img, genre: genreFrom(v.categories), english: !v.language || v.language === 'en' };
  });
}

/* opts: { title, author, genre, lang, priv: elements;
           shelf(): the circle's public books; coverOf(book): known cover URL;
           genres: the genre options }                                       */
export function attach(opts) {
  const { title: input, author, genre, lang, priv } = opts;

  // the list, right under the title box
  const wrap = document.createElement('div');
  wrap.className = 'suggest-wrap';
  const label = input.closest('label');
  label.replaceWith(wrap);
  wrap.append(label);
  const list = document.createElement('div');
  list.className = 'suggest';
  list.id = 'f-suggest';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suggested books');
  list.hidden = true;
  wrap.append(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'f-suggest');
  input.setAttribute('aria-expanded', 'false');

  let items = [], active = -1, timer = 0, ctl = null, chosen = null;
  const cache = new Map();

  function close() {
    list.hidden = true; items = []; active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  // Bold the parts of the title that match what was typed.
  function marked(text, typed) {
    const words = typed.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const frag = document.createDocumentFragment();
    if (!words.length) { frag.append(text); return frag; }
    // split() with a capture group puts the matches at the odd places
    String(text).split(new RegExp(`(${words.join('|')})`, 'gi')).forEach((part, i) => {
      if (!part) return;
      if (i % 2) { const b = document.createElement('b'); b.textContent = part; frag.append(b); } else frag.append(part);
    });
    return frag;
  }

  function draw(typed) {
    list.replaceChildren();
    if (!items.length) { close(); return; }
    items.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'sg' + (i === active ? ' on' : '');
      row.id = `sg-${i}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === active));
      const pic = document.createElement('span');
      pic.className = 'sg-pic';
      if (s.thumb) {
        const img = document.createElement('img');
        img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
        img.src = s.thumb;
        img.onerror = () => img.remove();
        pic.append(img);
      }
      const text = document.createElement('span');
      text.className = 'sg-text';
      const t = document.createElement('span');
      t.className = 'sg-title';
      t.append(marked(s.title, typed));
      const sub = document.createElement('span');
      sub.className = 'sg-sub';
      sub.textContent = [s.author, s.local ? 'on the shelf' : s.year].filter(Boolean).join(' · ');
      text.append(t, sub);
      row.append(pic, text);
      row.addEventListener('pointerdown', (e) => e.preventDefault());   // keep the keyboard up
      row.addEventListener('click', () => choose(i));
      list.append(row);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `sg-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  // One book once: same title and same author surname.
  const keyOf = (s) => `${normal(s.title)}|${normal(s.author).split(' ').pop()}`;
  function merge(typed, local, online) {
    const seen = new Set(), out = [];
    for (const s of [...local, ...online]) {
      if (!s.title || !s.author || !fits(typed, s.title)) continue;
      const k = keyOf(s);
      if (seen.has(k)) continue;
      seen.add(k); out.push(s);
      if (out.length >= MAX) break;
    }
    return out;
  }

  function fromShelf(typed) {
    const seen = new Set(), out = [];
    for (const b of opts.shelf().slice().reverse()) {
      if (!b.title || !b.author || DEVANAGARI.test(b.title) || !fits(typed, b.title)) continue;
      const s = { title: b.title, author: b.author, year: '', local: true, genre: opts.genres.includes(b.genre) ? b.genre : '',
        cover: opts.coverOf(b) || '', english: !b.lang || b.lang === 'English' };
      s.thumb = s.cover;
      const k = keyOf(s);
      if (seen.has(k)) continue;
      seen.add(k); out.push(s);
      if (out.length >= 3) break;
    }
    return out;
  }

  async function online(typed) {
    const q = normal(typed);
    if (cache.has(q)) return cache.get(q);
    ctl?.abort();
    const mine = ctl = new AbortController();
    let found = [];
    for (const q of olQueries(typed)) {
      try { found = found.concat(await openLibrary(q, mine)); } catch { /* next */ }
      if (mine.signal.aborted) return null;
      if (found.some((s) => s.author && fits(typed, s.title))) break;
    }
    if (!found.some((s) => s.author && fits(typed, s.title))) {
      try { found = found.concat(await googleBooks(typed, mine)); } catch { /* nothing more */ }
    }
    if (mine.signal.aborted) return null;
    found = found.filter((s) => s.english);
    // Books with a cover first: more likely to be the edition people mean.
    found.sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0));
    cache.set(q, found);
    return found;
  }

  function onType() {
    clearTimeout(timer);
    const typed = input.value;
    if (chosen && typed !== chosen.title) chosen = { ...chosen, edited: true };
    if (DEVANAGARI.test(typed) || typed.trim().length < 3) { ctl?.abort(); close(); return; }
    const local = fromShelf(typed);
    items = merge(typed, local, []); active = -1;
    draw(typed);
    if (priv.checked || navigator.onLine === false) return;
    timer = setTimeout(async () => {
      const found = await online(typed);
      if (found === null || input.value !== typed || document.activeElement !== input) return;
      items = merge(typed, fromShelf(typed), found); active = Math.min(active, items.length - 1);
      draw(typed);
    }, WAIT);
  }

  function flash(el) {
    el.classList.remove('filled');
    void el.offsetWidth;
    el.classList.add('filled');
    setTimeout(() => el.classList.remove('filled'), 1200);
  }

  function choose(i) {
    const s = items[i];
    if (!s) return;
    input.value = s.title; flash(input);
    author.value = s.author; flash(author);
    if (s.genre && opts.genres.includes(s.genre)) { genre.value = s.genre; flash(genre); }
    if ([...lang.options].some((o) => o.value === 'English')) lang.value = 'English';
    chosen = { title: s.title, author: s.author, cover: s.cover };
    close();
    input.blur();   // tuck the keyboard away so the rest of the form shows
  }

  input.addEventListener('input', onType);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length + 1) % (items.length + 1);
      if (active === items.length) active = -1;
      draw(input.value);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault(); choose(active);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => { if (input.value.trim().length >= 3 && !chosen) onType(); });
  priv.addEventListener('change', () => { if (priv.checked) { ctl?.abort(); clearTimeout(timer); } });

  return {
    // The cover of the book picked, if what's being saved is still that book.
    coverFor(title, auth) {
      if (!chosen?.cover) return '';
      return normal(title) === normal(chosen.title) && normal(auth) === normal(chosen.author) ? chosen.cover : '';
    },
    reset() { chosen = null; ctl?.abort(); clearTimeout(timer); close(); },
  };
}
