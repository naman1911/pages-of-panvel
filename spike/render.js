/* Rasterise a card: fetch the pinned fonts once, inline them as base64 into an
   SVG <foreignObject>, draw that to a canvas, export PNG.

   Two traps, both found by the spike:
     · fonts already loaded by the page are IGNORED inside foreignObject, so
       they must be embedded — there is no way round the payload
     · the SVG must go in as a data: URI; a blob: URL taints the canvas and
       the PNG export throws SecurityError                                    */

const FACES = [
  // family, weight, stretch, files (latin first, then devanagari)
  ['Anek Devanagari', 800, '75%',   ['anek-l-800-750.woff2','anek-d-800-750.woff2']],
  ['Anek Devanagari', 700, '75%',   ['anek-l-700-750.woff2','anek-d-700-750.woff2']],
  ['Anek Devanagari', 600, '87.5%', ['anek-l-600-875.woff2','anek-d-600-875.woff2']],
  ['Mukta',           600, 'normal',['mukta-l-600.woff2','mukta-d-600.woff2']],
  ['Martian Mono',    400, 'normal',['martian-l-400.woff2']],
];

let css = null, bytes = 0, ms = 0;
export const fontStats = () => ({ bytes, ms });

const b64 = buf => { let s=''; const u=new Uint8Array(buf);
  for (let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
  return btoa(s); };

export async function loadFonts(){
  if (css) return css;
  const t0 = performance.now(), rules = [];
  for (const [fam,w,st,files] of FACES) for (const f of files){
    const buf = await (await fetch('../fonts/'+f)).arrayBuffer(); bytes += buf.byteLength;
    rules.push(`@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-stretch:${st};src:url(data:font/woff2;base64,${b64(buf)}) format('woff2')}`);
  }
  ms = Math.round(performance.now()-t0);
  return (css = rules.join(''));
}

const svgFor = (html,w,h,fonts) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`+
  `<defs><style type="text/css"><![CDATA[${fonts}]]></style></defs>`+
  `<foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;

const loadImg = src => new Promise((ok,bad)=>{ const i=new Image();
  i.onload=()=>ok(i); i.onerror=()=>bad(new Error('the card failed to draw')); i.src=src; });

export async function renderCard(html, scale=1){
  const fonts = await loadFonts();
  const img = await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFor(html,1080,1920,fonts)));
  // Safari sometimes reports load before the embedded fonts have painted; one
  // frame of grace avoids a fallback-font first render.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const c = document.createElement('canvas');
  c.width = Math.round(1080*scale); c.height = Math.round(1920*scale);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return new Promise((ok,bad)=>c.toBlob(b=>b?ok(b):bad(new Error('export failed')),'image/png'));
}

/* Is the Devanagari drawn in the embedded face, or a system fallback?
   Renders the same word both ways and compares the width of the ink. */
export async function checkDevanagari(){
  const fonts = await loadFonts();
  const width = async fam => {
    const html = `<div style="width:700px;height:180px;background:#fff;color:#000;font-family:${fam};font-weight:800;font-stretch:75%;font-size:110px">कोसला</div>`;
    const img = await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFor(html,700,180,fonts)));
    const c=document.createElement('canvas'); c.width=700; c.height=180;
    const x=c.getContext('2d'); x.drawImage(img,0,0);
    const d=x.getImageData(0,0,700,180).data; let lo=700,hi=0;
    for (let p=0;p<d.length;p+=4) if (d[p]<160){const px=(p/4)%700; if(px<lo)lo=px; if(px>hi)hi=px;}
    return Math.max(0,hi-lo);
  };
  const real = await width("'Anek Devanagari',serif"), fall = await width('serif');
  return { real, fall, ok: real>0 && Math.abs(real-fall)>4 };
}
