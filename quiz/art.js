/* Art for the end of the quiz: one doodle per reader type, and a story-sized
   card (1080×1920) people can save or share. Drawn on the phone; nothing is
   uploaded. The doodles are plain shapes (no text), so they draw the same
   inside the page and on the canvas.                                      */

const INK = "#241D18", CREAM = "#F5EFE2", PAPER = "#E9E0CB", RED = "#C0302A", MUSTARD = "#D89C24", GREEN = "#1F5233";
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

function burst(cx, cy, r1, r2, n) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n - Math.PI / 2, r = i % 2 ? r2 : r1;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}
const spark = (x, y, r, fill) =>
  `<path d="M${x} ${y - r} L${x + r * .3} ${y - r * .3} L${x + r} ${y} L${x + r * .3} ${y + r * .3} L${x} ${y + r} L${x - r * .3} ${y + r * .3} L${x - r} ${y} L${x - r * .3} ${y - r * .3} Z" fill="${fill}" ${S}/>`;

const DOODLES = {
  // a cup of chai, steaming
  chai: `<ellipse cx="96" cy="160" rx="72" ry="12" fill="${CREAM}" ${S}/>
    <path d="M140 102 C172 98 172 140 136 134" fill="none" ${S}/>
    <path d="M48 92 H144 V118 C144 146 122 156 96 156 C70 156 48 146 48 118 Z" fill="${RED}" ${S}/>
    <ellipse cx="96" cy="92" rx="48" ry="9" fill="${MUSTARD}" ${S}/>
    <path d="M74 70 c-10 -12 10 -20 0 -34 M96 66 c-10 -12 10 -20 0 -34 M118 70 c-10 -12 10 -20 0 -34" fill="none" ${S}/>`,
  // the moon, an open book, one more chapter
  thriller: `<path d="M74 22 A34 34 0 1 0 100 84 A28 28 0 1 1 74 22 Z" fill="${MUSTARD}" ${S}/>
    ${spark(150, 44, 12, MUSTARD)}${spark(128, 82, 7, CREAM)}
    <path d="M100 122 C80 110 50 110 28 118 V172 C50 164 80 164 100 176 Z" fill="${CREAM}" ${S}/>
    <path d="M100 122 C120 110 150 110 172 118 V172 C150 164 120 164 100 176 Z" fill="${CREAM}" ${S}/>
    <path d="M44 132 C60 128 74 128 88 134 M44 148 C60 144 74 144 88 150 M112 134 C126 128 140 128 156 132 M112 150 C126 144 140 144 156 148" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  // a park bench, a book left on it, leaves falling
  poetry: `<ellipse cx="150" cy="30" rx="13" ry="6" transform="rotate(-30 150 30)" fill="${MUSTARD}" ${S}/>
    <ellipse cx="62" cy="36" rx="12" ry="6" transform="rotate(25 62 36)" fill="${RED}" ${S}/>
    <path d="M46 66 V120 M154 66 V120" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <rect x="30" y="62" width="140" height="12" rx="3" fill="${GREEN}" ${S}/>
    <rect x="30" y="82" width="140" height="12" rx="3" fill="${GREEN}" ${S}/>
    <rect x="86" y="106" width="46" height="12" rx="2" fill="${RED}" ${S}/>
    <path d="M90 112 H128" stroke="${CREAM}" stroke-width="3"/>
    <rect x="24" y="118" width="152" height="14" rx="3" fill="${GREEN}" ${S}/>
    <path d="M42 132 V170 M158 132 V170" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`,
  // a notebook with a highlighted line, and the pen that did it
  nonfic: `<rect x="36" y="30" width="104" height="140" rx="4" fill="${CREAM}" ${S}/>
    <rect x="54" y="86" width="64" height="12" fill="${MUSTARD}"/>
    <path d="M54 60 H122 M54 76 H122 M54 92 H118 M54 108 H122 M54 124 H104 M54 140 H122" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="36" cy="50" r="5" fill="${PAPER}" ${S}/><circle cx="36" cy="80" r="5" fill="${PAPER}" ${S}/><circle cx="36" cy="110" r="5" fill="${PAPER}" ${S}/><circle cx="36" cy="140" r="5" fill="${PAPER}" ${S}/>
    <path d="M152 38 L172 58 L102 128 L80 136 L88 114 Z" fill="${RED}" ${S}/>
    <path d="M80 136 L88 114 L102 128 Z" fill="${CREAM}" ${S}/>`,
  // a stack of books with a diya on top
  desi: `<path d="M100 22 C114 40 110 56 100 60 C90 56 86 40 100 22 Z" fill="${MUSTARD}" ${S}/>
    <path d="M64 64 H136 C132 78 118 86 100 86 C82 86 68 78 64 64 Z" fill="${RED}" ${S}/>
    <rect x="34" y="86" width="124" height="24" rx="3" fill="${MUSTARD}" ${S}/>
    <rect x="48" y="110" width="110" height="24" rx="3" fill="${GREEN}" ${S}/>
    <rect x="38" y="134" width="128" height="26" rx="3" fill="${RED}" ${S}/>
    <path d="M52 86 V110 M140 86 V110 M66 110 V134 M144 110 V134 M56 134 V160 M150 134 V160" fill="none" stroke="${INK}" stroke-width="3"/>
    <rect x="30" y="160" width="140" height="8" fill="${INK}"/>`,
  // a comic-book burst
  comics: `<polygon points="${burst(100, 98, 76, 50, 12)}" fill="${MUSTARD}" ${S}/>
    <polygon points="${burst(100, 98, 46, 32, 10)}" fill="${CREAM}" ${S}/>
    <rect x="91" y="68" width="18" height="38" rx="4" fill="${RED}" ${S}/>
    <circle cx="100" cy="122" r="8" fill="${RED}" ${S}/>`,
};
// anyone who skipped the vibe question: a little shelf
const SHELF = `<rect x="40" y="56" width="30" height="104" fill="${RED}" ${S}/><rect x="74" y="36" width="30" height="124" fill="${MUSTARD}" ${S}/>
  <rect x="108" y="66" width="30" height="94" fill="${GREEN}" ${S}/><rect x="140" y="60" width="26" height="104" transform="rotate(12 153 164)" fill="${CREAM}" ${S}/>
  <rect x="26" y="160" width="148" height="10" fill="${INK}"/>`;

export const doodle = (vibe) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">${DOODLES[vibe] || SHELF}</svg>`;

/* ---------- the story card ---------- */

const DISP = '"Anek Devanagari", system-ui, sans-serif', BODY = 'Mukta, system-ui, sans-serif', MONO = '"Martian Mono", ui-monospace, monospace';

function lines(ctx, text, max) {
  const out = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

function tag(ctx, text, x, y, bg, fg, rot) {
  ctx.save();
  ctx.font = `400 30px ${MONO}`;
  const w = ctx.measureText(text).width + 48;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, 24, 34);
  ctx.restore();
}

const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

export async function storyCard(vibe, name, line) {
  await Promise.all([
    document.fonts.load(`800 120px ${DISP}`, name), document.fonts.load(`400 44px ${BODY}`, line),
    document.fonts.load(`400 30px ${MONO}`, "PAGES OF PANVEL"),
  ]).catch(() => {});
  const W = 1080, H = 1920, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // paper, with the site's diagonal hatching
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.strokeStyle = "rgba(36,29,24,.06)"; ctx.lineWidth = 4;
  for (let i = -H; i < W + H; i += 34) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke(); }
  ctx.restore();

  tag(ctx, "PAGES OF PANVEL · MY READER TYPE", 80, 120, INK, CREAM, -0.025);

  // the doodle, in a cream frame with a hard red shadow
  const fs = 640, fx = (W - fs) / 2 - 11, fy = 240;
  ctx.fillStyle = RED; ctx.fillRect(fx + 22, fy + 22, fs, fs);
  ctx.fillStyle = CREAM; ctx.fillRect(fx, fy, fs, fs);
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeRect(fx, fy, fs, fs);
  try {
    const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(doodle(vibe)));
    ctx.drawImage(img, fx + 50, fy + 50, fs - 100, fs - 100);
  } catch { /* the frame alone still looks fine */ }

  // name, big; then the line
  ctx.fillStyle = INK; ctx.textBaseline = "alphabetic";
  let size = 150;
  ctx.font = `800 ${size}px ${DISP}`;
  let nl = lines(ctx, name.toUpperCase(), W - 160);
  while ((nl.length > 3 || nl.some((l) => ctx.measureText(l).width > W - 160)) && size > 80) {
    size -= 10; ctx.font = `800 ${size}px ${DISP}`; nl = lines(ctx, name.toUpperCase(), W - 160);
  }
  let y = fy + fs + 70 + size * 0.85;
  for (const l of nl) { ctx.fillText(l, 80, y); y += size * 0.9; }
  ctx.font = `400 46px ${BODY}`;
  y += 30;
  for (const l of lines(ctx, line, W - 160).slice(0, 3)) { ctx.fillText(l, 80, y); y += 62; }

  // the invitation
  ctx.fillStyle = RED; ctx.fillRect(0, H - 330, W, 330);
  ctx.fillStyle = CREAM; ctx.font = `800 92px ${DISP}`;
  ctx.fillText("WHAT'S YOURS?", 80, H - 200);
  ctx.font = `400 34px ${MONO}`;
  ctx.fillText("pagesofpanvel.in/quiz", 80, H - 130);
  ctx.fillText("Sundays · 8:30am · the park", 80, H - 78);

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}
