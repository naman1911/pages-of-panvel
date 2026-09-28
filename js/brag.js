/* Brag cards: Instagram Story images of your own reading, made from your shelf.

   app.js imports this on the first tap of "Make a brag card", so nobody
   downloads any of it (or its 433 KB of fonts) until they want a card.

   It only READS. It gets a copy of what app.js already has on screen, draws
   the cards on the phone, and hands the PNG to the share sheet or a download.
   It writes nothing, calls nothing in Firebase, and keeps nothing afterwards.

   Private books never appear on a card. They're "only you see them" on the
   site, and a card is made to be posted.                                   */

import { WAYS, CARDS } from './brag-cards.js';
import { renderCard, loadFonts } from './brag-render.js';

const YEAR = String(new Date().getFullYear());
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || 'A reader';
const inYear = (d) => String(d || '').startsWith(YEAR);
const newest = (k) => (a, b) => String(b[k] || '').localeCompare(String(a[k] || ''));

// The longest run of consecutive days among the ones kept (app.js keeps 60).
function bestRun(days = []) {
  const t = [...new Set(days)].sort().map((d) => Date.parse(d + 'T00:00:00Z'));
  let best = 0, run = 0;
  t.forEach((x, i) => { run = i && x - t[i - 1] === 864e5 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

// The same 14 days, in the same order, as the dots on the Mine tab.
function lastFourteen(days) {
  const set = new Set(days), out = [];
  for (let i = 13; i >= 0; i--) {
    const x = new Date(); x.setDate(x.getDate() - i);
    out.push({ ch: 'SMTWTFS'[x.getDay()], read: set.has(x.toISOString().slice(0, 10)) });
  }
  return out;
}

/* ---------- what each card says, from the reader's own shelf ---------- */

// For each card: either { choices, data(choice) } or { locked: "how to unlock" }.
function plan(ctx) {
  const { me, mine, books, uid, inkFor, streakOf, norm } = ctx;
  const name = firstName(me.name);
  const year = mine.filter((b) => inYear(b.startedAt) || inYear(b.finishedAt));
  const genres = [...new Set(year.map((b) => b.genre).filter(Boolean))];
  const days = me.days || [];
  const out = {};

  const fin = mine.filter((b) => b.status === 'finished' && inYear(b.finishedAt || b.startedAt))
    .sort(newest('finishedAt'));
  out.finished = fin.length ? {
    choices: fin,
    data: (b) => ({ count: pad(fin.length), year: YEAR, title: b.title, author: b.author, lang: b.lang,
      name, label: b === fin[0] ? 'Latest finish' : 'Also finished' }),
  } : { locked: 'Tap “I finished it” on a book to unlock' };

  out.range = genres.length >= 2 ? {
    choices: [null],
    data: () => ({ count: pad(genres.length), year: YEAR, genres }),
  } : { locked: 'Read across two genres this year to unlock' };

  const reading = mine.filter((b) => b.status === 'reading').sort(newest('startedAt'));
  out.desk = reading.length ? {
    choices: reading,
    data: (b) => ({
      title: b.title, author: b.author, lang: b.lang, spine: inkFor(b.title),
      others: new Set(books.filter((o) => o.uid !== uid && o.status === 'reading' &&
        norm(o.title) === norm(b.title)).map((o) => o.uid)).size,
    }),
  } : { locked: 'Add a book you’re reading to unlock' };

  const run = streakOf(days);
  out.streak = run ? {
    choices: [null],
    data: () => {
      const f = lastFourteen(days);
      return { count: pad(run), days: f.map((x) => x.ch), read: f.map((x) => x.read) };
    },
  } : { locked: 'Tap “I read today” to start a streak' };

  const lined = mine.filter((b) => String(b.line || '').trim()).sort(newest('startedAt'));
  out.line = lined.length ? {
    choices: lined,
    data: (b) => ({ quote: String(b.line).trim(), title: b.title, author: b.author, lang: b.lang, name }),
  } : { locked: 'Save a line you liked from a book to unlock' };

  out.wrapped = year.length ? {
    choices: [null],
    data: () => ({
      year: YEAR, books: pad(year.length), genres: pad(genres.length), streak: pad(bestRun(days)),
      langs: pad(new Set(year.map((b) => b.lang).filter(Boolean)).size || 1),
      spines: [...year].sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')))
        .map((b) => inkFor(b.title)),
    }),
  } : { locked: `Add a book this year to unlock` };

  return out;
}

/* ---------- fitting ---------- */

// Lay the card out for real, off screen, and shrink whatever overflows its
// box. Titles run to 120 characters and lines to 300, in three scripts; no
// fixed size fits all of that, and a guess that's wrong spills text over the
// footer. The stage is a shadow root so none of the site's CSS reaches in.
let stage = null;
function getStage() {
  if (stage) return stage;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all:initial;position:fixed;left:-20000px;top:0;width:1080px;height:1920px;' +
    'overflow:hidden;visibility:hidden;pointer-events:none;contain:strict';
  document.body.appendChild(host);
  return (stage = host.attachShadow({ mode: 'open' }));
}

// Does a data-fit box hold what's in it? Not scrollHeight: the design sets its
// big numbers and names at line-height under 1, and tilts its labels, so ink
// pokes a few pixels out of every box on purpose. What matters is where the
// laid-out blocks end. A one-line name (nowrap) can only run out sideways.
function overflows(el) {
  if (getComputedStyle(el).whiteSpace === 'nowrap') return el.scrollWidth > el.clientWidth + 1;
  let lo = 0, hi = 0;
  for (const k of el.children) { lo = Math.min(lo, k.offsetTop); hi = Math.max(hi, k.offsetTop + k.offsetHeight); }
  return lo < -1 || hi > el.clientHeight + 1;
}

function fit(card, t, d, i) {
  const fs = card.sizes(d), st = getStage();
  let html = '';
  for (let k = 0; k < 16; k++) {
    html = card.draw(t, d, i, fs);
    st.innerHTML = html;
    const over = [...st.querySelectorAll('[data-fit]')].filter(overflows);
    let shrunk = false;
    for (const el of over) for (const n of el.dataset.fit.split(' ')) {
      if (fs[n] > card.min[n]) { fs[n] = Math.max(card.min[n], Math.floor(fs[n] * 0.92)); shrunk = true; }
    }
    if (!shrunk) break;
  }
  st.innerHTML = '';
  return html;
}

/* ---------- the maker ---------- */

const CSS = `
.brag{position:fixed;inset:0;z-index:15;overflow-y:auto;overscroll-behavior:contain;
  background:var(--paper,#E9E0CB);color:var(--ink,#241D18);
  padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(32px + env(safe-area-inset-bottom,0px))}
.brag-in{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.brag-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.brag h2{margin:0;font-family:var(--disp,sans-serif);font-weight:800;font-size:clamp(52px,15vw,96px);
  line-height:.82;letter-spacing:-.05em;text-transform:uppercase}
.brag h2 span{display:inline-block;background:var(--red,#C0302A);color:var(--cream,#F5EFE2);padding:0 .1em;transform:rotate(-2deg)}
.brag-sub{margin:0;color:var(--dim);font-size:15px;max-width:52ch}
.brag-ways{display:flex;flex-wrap:wrap;gap:8px}
.brag-way{display:flex;align-items:center;gap:8px;border:0;cursor:pointer;min-height:44px;
  padding:6px 12px 6px 6px;background:transparent;color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink);
  font:11px var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase}
.brag-way i{width:28px;height:28px;display:block;box-shadow:inset 0 0 0 2px var(--ink)}
.brag-way[aria-pressed="true"]{background:var(--ink);color:var(--cream)}
.brag-way[aria-pressed="true"] i{box-shadow:inset 0 0 0 2px var(--cream)}
.brag-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 14px}
@media (min-width:640px){.brag-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 20px}}
.brag-card{display:flex;flex-direction:column;gap:8px;border:0;padding:0;background:none;color:inherit;
  cursor:pointer;text-align:left;font:inherit}
.brag-card:disabled{cursor:default}
.brag-frame{position:relative;aspect-ratio:9/16;background:var(--paper-2,#E2D8C1);
  box-shadow:0 0 0 2px var(--ink),5px 5px 0 var(--ink);overflow:hidden}
.brag-card.locked .brag-frame{box-shadow:inset 0 0 0 2px var(--hair);background:transparent}
.brag-frame img{display:block;width:100%;height:100%;object-fit:cover}
.brag-wait{position:absolute;inset:0;display:grid;place-content:center;padding:12px;text-align:center;
  font:10px/1.5 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.brag-label{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.brag-label b{font-family:var(--disp,sans-serif);font-weight:800;font-size:19px;line-height:1;text-transform:uppercase}
.brag-label small{font:10px var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.brag-card.locked .brag-label{opacity:.55}
.brag-note{margin:0;font:10px/1.6 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.brag-btn{min-height:46px;padding:0 18px;border:0;cursor:pointer;border-radius:2px;
  font-family:var(--disp,sans-serif);font-weight:800;font-size:17px;background:var(--cream,#F5EFE2);color:var(--ink,#241D18)}
.brag-btn.go{background:var(--mustard,#D89C24)}
.brag-btn.dark{background:var(--ink);color:var(--cream)}
.brag-card:focus-visible,.brag-way:focus-visible,.brag-btn:focus-visible,.brag-pick:focus-visible{outline:3px solid var(--red,#C0302A);outline-offset:3px}
.brag-view{position:fixed;inset:0;z-index:16;display:flex;flex-direction:column;align-items:center;gap:12px;
  background:rgba(36,29,24,.96);
  padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px))}
.brag-view img{flex:1;min-height:0;max-width:100%;object-fit:contain;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.brag-view img:not([src]){visibility:hidden}
.brag-pick{max-width:100%;min-height:44px;padding:0 12px;border:0;border-radius:2px;
  background:var(--cream,#F5EFE2);color:var(--ink);font:15px var(--body,sans-serif)}
.brag-tip{margin:0;color:var(--cream,#F5EFE2);font:11px/1.5 var(--mono,monospace);letter-spacing:.05em;text-align:center;max-width:42ch}
.brag-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
`;

let ctx, plans, way = 'A', job = 0, pick = {}, thumbs = {}, full = null, fullUrl = null, current = null;
let els = null, lastFocus = null;

const $ = (id) => document.getElementById(id);
const urls = new Set();
const keep = (blob) => { const u = URL.createObjectURL(blob); urls.add(u); return u; };
const canShare = () => !!(navigator.share && navigator.canShare);

function build() {
  if (els) return els;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.className = 'brag';
  box.id = 'brag-sheet';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'brag-h');
  box.innerHTML = `
    <div class="brag-in">
      <div class="brag-top">
        <h2 id="brag-h">Brag <span>cards</span></h2>
        <button class="brag-btn dark" id="brag-close" type="button">Close</button>
      </div>
      <p class="brag-sub">Made from your shelf. Pick a colour, tap a card, and share it to your Story.</p>
      <div class="brag-ways" id="brag-ways" role="group" aria-label="Colour"></div>
      <div class="brag-grid" id="brag-grid"></div>
      <p class="brag-note">Drawn on your phone. Nothing is uploaded or saved. Private books never appear on a card.</p>
    </div>
    <div class="brag-view" id="brag-view" hidden>
      <img id="brag-big" alt="">
      <select class="brag-pick" id="brag-pick" aria-label="Which book" hidden></select>
      <p class="brag-tip" id="brag-tip"></p>
      <div class="brag-acts">
        <button class="brag-btn go" id="brag-share" type="button" hidden>Share</button>
        <button class="brag-btn" id="brag-save" type="button" hidden>Save image</button>
        <button class="brag-btn" id="brag-back" type="button">Back</button>
      </div>
    </div>`;
  document.body.appendChild(box);

  for (const k of Object.keys(WAYS)) {
    const b = document.createElement('button');
    b.className = 'brag-way'; b.type = 'button'; b.dataset.way = k;
    b.innerHTML = `<i style="background:${WAYS[k].bg}"></i>${WAYS[k].name}`;
    b.addEventListener('click', () => { if (k !== way) { way = k; paintWays(); drawAll(); } });
    $('brag-ways').appendChild(b);
  }
  for (const c of CARDS) {
    const b = document.createElement('button');
    b.className = 'brag-card'; b.type = 'button'; b.id = 'brag-c-' + c.id;
    b.innerHTML = `<div class="brag-frame"></div>
      <div class="brag-label"><b>${c.name}</b><small>${c.note}</small></div>`;
    b.addEventListener('click', () => openView(c));
    $('brag-grid').appendChild(b);
  }

  $('brag-close').addEventListener('click', () => setDepth(0));
  $('brag-back').addEventListener('click', () => setDepth(1));
  $('brag-pick').addEventListener('change', () => {
    if (!current) return;
    pick[current.id] = Number($('brag-pick').value);
    drawFull(current);
  });
  $('brag-share').addEventListener('click', share);
  $('brag-save').addEventListener('click', save);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && depth) setDepth(depth - 1); });
  addEventListener('popstate', () => show(history.state?.brag || 0));

  return (els = box);
}

function paintWays() {
  [...$('brag-ways').children].forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.way === way)));
}

const htmlFor = (c, w) => {
  const p = plans[c.id];
  const choice = p.choices[Math.min(pick[c.id] || 0, p.choices.length - 1)];
  return fit(c, WAYS[w], p.data(choice), 'ABCD'.indexOf(w));
};

async function drawAll() {
  const mine = ++job, w = way;
  thumbs[w] ??= {};
  for (const c of CARDS) {
    const btn = $('brag-c-' + c.id), frame = btn.firstElementChild, p = plans[c.id];
    btn.classList.toggle('locked', !!p.locked);
    if (p.locked) {
      btn.disabled = true;
      frame.innerHTML = `<div class="brag-wait">${esc(p.locked)}</div>`;
      continue;
    }
    if (!thumbs[w][c.id]) {
      btn.disabled = true;
      frame.innerHTML = '<div class="brag-wait">Drawing…</div>';
      try {
        const blob = await renderCard(htmlFor(c, w), 0.4);
        if (mine !== job) return;              // colour changed, or closed, mid-draw
        thumbs[w][c.id] = keep(blob);
      } catch {
        if (mine !== job) return;
        frame.innerHTML = '<div class="brag-wait">Couldn’t draw this one on this phone</div>';
        continue;
      }
    }
    frame.innerHTML = `<img alt="${esc(c.name)} card, ${WAYS[w].name}" src="${thumbs[w][c.id]}">`;
    btn.disabled = false;
  }
}

function openView(c) {
  current = c;
  const p = plans[c.id], sel = $('brag-pick');
  sel.hidden = p.choices.length < 2;
  sel.innerHTML = p.choices.map((b, i) => `<option value="${i}">${esc(b?.title || '')}</option>`).join('');
  sel.value = String(pick[c.id] || 0);
  setDepth(2);
  drawFull(c);
}

async function drawFull(c) {
  const mine = ++job;
  $('brag-big').removeAttribute('src');
  $('brag-tip').textContent = 'Drawing at full size…';
  $('brag-share').hidden = $('brag-save').hidden = true;
  full = null;
  try {
    const blob = await renderCard(htmlFor(c, way), 1);
    if (mine !== job || current !== c) return;
    full = blob;
    if (fullUrl) { URL.revokeObjectURL(fullUrl); urls.delete(fullUrl); }
    fullUrl = keep(blob);
    $('brag-big').src = fullUrl;
    $('brag-big').alt = `${c.name} card`;
    const shareable = canShare() &&
      navigator.canShare({ files: [new File([blob], 'card.png', { type: 'image/png' })] });
    $('brag-share').hidden = !shareable;
    $('brag-save').hidden = false;
    $('brag-tip').textContent = shareable
      ? 'Share, then pick Instagram and Stories.'
      : 'Save it, then add it to your Story from your photos.';
  } catch (e) {
    if (mine === job) $('brag-tip').textContent = 'This card couldn’t be drawn on this phone. Try another colour or card.';
  }
}

const fileName = () => `pages-of-panvel-${current?.id || 'card'}.png`;

async function share() {
  if (!full) return;
  const f = new File([full], fileName(), { type: 'image/png' });
  try {
    // Files only. Adding text or a link makes some apps, Instagram among
    // them, take the text and drop the picture.
    await navigator.share({ files: [f] });
  } catch (e) {
    if (e?.name !== 'AbortError') $('brag-tip').textContent = 'Sharing didn’t go through. Use Save image instead.';
  }
}

function save() {
  if (!fullUrl) return;
  const a = document.createElement('a');
  a.href = fullUrl;
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  $('brag-tip').textContent = 'Saved. On an iPhone, if it opened instead, press and hold the card and choose Save.';
}

/* ---------- open, close, and the back button ---------- */

// 0 closed · 1 the grid · 2 one card full size. Each level is a history
// entry, so a phone's back button steps out of the card, then out of the
// maker, instead of off the site.
let depth = 0;
let scrollWas = '';

function show(d) {
  if (d === depth) return;
  const box = build();
  if (d > 0 && depth === 0) {
    lastFocus = document.activeElement;
    scrollWas = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    box.hidden = false;
    $('brag-close').focus();
  }
  $('brag-view').hidden = d < 2;
  if (d < 2 && depth === 2) { current = null; job++; }
  if (d === 1 && depth === 2) drawAll();
  if (d === 0) {
    job++;
    box.hidden = true;
    document.documentElement.style.overflow = scrollWas;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    thumbs = {}; full = null; fullUrl = null; current = null;
    $('brag-big').removeAttribute('src');
    for (const c of CARDS) $('brag-c-' + c.id).firstElementChild.innerHTML = '';
    lastFocus?.focus?.();
  }
  depth = d;
}

function setDepth(d) {
  if (d === depth) return;
  if (d < depth) {
    const steps = depth - d;
    // Only unwind entries we pushed. If they're gone (a reload, say), just
    // close without touching history.
    if ((history.state?.brag || 0) === depth) { history.go(-steps); return; }
    show(d);
    return;
  }
  for (let k = depth + 1; k <= d; k++) history.pushState({ ...(history.state || {}), brag: k }, '');
  show(d);
}

export async function openBrag(data) {
  ctx = data;
  plans = plan(ctx);
  pick = {};
  build();
  paintWays();
  for (const c of CARDS) {
    const f = $('brag-c-' + c.id).firstElementChild;
    f.innerHTML = '<div class="brag-wait">Drawing…</div>';
  }
  setDepth(1);
  try {
    await loadFonts();
  } catch {
    for (const c of CARDS) $('brag-c-' + c.id).firstElementChild.innerHTML =
      '<div class="brag-wait">Couldn’t load the card fonts. Check your connection and open this again.</div>';
    return;
  }
  if (depth) drawAll();
}
