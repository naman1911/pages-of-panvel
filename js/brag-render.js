/* Turn a card's HTML into a PNG, entirely on the phone.

   The card goes into an SVG <foreignObject>, the SVG into an <img>, the <img>
   onto a canvas, and the canvas out as a PNG. Canvas text can't do this
   design: it ignores font-stretch, and the condensed Anek is the look.

   What the /spike test page found, and why this file looks the way it does:
     · fonts the page has loaded are IGNORED inside foreignObject, so they are
       fetched here and embedded in every SVG as base64
     · the SVG must go in as a data: URI. A blob: URL taints the canvas and
       the PNG export throws SecurityError
     · the variable Anek is 1 MB; these files are pinned to the two widths
       the design uses, 433 KB for the whole set

   The same font files are also registered with the page under private names,
   so brag.js can measure a card in the real layout engine before drawing it.
   Nothing the site itself shows uses those names.                          */

const FACES = [
  // family, weight, stretch, files (latin first, then devanagari)
  ['PoP Anek',  800, '75%',    ['anek-l-800-750.woff2', 'anek-d-800-750.woff2']],
  ['PoP Anek',  700, '75%',    ['anek-l-700-750.woff2', 'anek-d-700-750.woff2']],
  ['PoP Anek',  600, '87.5%',  ['anek-l-600-875.woff2', 'anek-d-600-875.woff2']],
  ['PoP Mukta', 600, 'normal', ['mukta-l-600.woff2', 'mukta-d-600.woff2']],
  ['PoP Mono',  400, 'normal', ['martian-l-400.woff2']],
];

const b64 = (buf) => {
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};

// One download per visit, shared by every card. A failure is not cached, so
// the next tap tries again.
let pending = null;
export function loadFonts() {
  pending ??= (async () => {
    const list = FACES.flatMap(([fam, w, st, files]) => files.map((f) => ({ fam, w, st, f })));
    const bufs = await Promise.all(list.map(async ({ f }) => {
      const r = await fetch(new URL(`../fonts/${f}`, import.meta.url));
      if (!r.ok) throw new Error(`font ${f}: ${r.status}`);
      return r.arrayBuffer();
    }));
    const faces = list.map(({ fam, w, st }, i) =>
      new FontFace(fam, bufs[i], { weight: String(w), stretch: st, style: 'normal' }));
    await Promise.all(faces.map((f) => f.load()));
    faces.forEach((f) => document.fonts.add(f));
    return list.map(({ fam, w, st }, i) =>
      `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-stretch:${st};` +
      `src:url(data:font/woff2;base64,${b64(bufs[i])}) format('woff2')}`).join('');
  })().catch((e) => { pending = null; throw e; });
  return pending;
}

const svgFor = (html, fonts) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">` +
  `<defs><style type="text/css"><![CDATA[${fonts}]]></style></defs>` +
  `<foreignObject x="0" y="0" width="1080" height="1920"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;

const loadImg = (src) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => bad(new Error('the card failed to draw'));
  i.src = src;
});

export async function renderCard(html, scale = 1) {
  const fonts = await loadFonts();
  const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFor(html, fonts)));
  // Safari can report load before the embedded fonts have painted; a frame of
  // grace avoids a fallback-font first render.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = document.createElement('canvas');
  c.width = Math.round(1080 * scale);
  c.height = Math.round(1920 * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('export failed'))), 'image/png'));
}
