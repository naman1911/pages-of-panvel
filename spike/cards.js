/* Brag cards — a faithful port of the Claude Design "Pages of Panvel Stories"
   file. Markup, tokens and sample data are the design's own; only the
   template syntax changed ({{ }} became ${}).

   foreignObject content is parsed as strict XML, not HTML:
     · every tag must close — <br> is fatal, <br/> is fine
     · only the five XML entities exist — &ldquo; &nbsp; etc. are fatal;
       use the literal character instead                                    */

const CH='#241D18', CR='#F5EFE2', CM='#E9E0CB', RED='#C0302A', MU='#D89C24', DR='#AA251F', GR='#1F5233';
const tex = rgb => `repeating-linear-gradient(135deg,rgba(${rgb},.08) 0 2px,transparent 2px 15px)`;

export const WAYS = {
  A:{key:'A',name:'Cream',   bg:CM, ink:CH, acc:RED,accInk:CR,accSh:CH, alt:CH,altInk:CR,altSh:RED, grSh:CH, sh:CH,  kickBg:CH,kickInk:CR, footBg:CH,footInk:CR,footSh:RED, tex:tex('36,29,24')},
  B:{key:'B',name:'Red',     bg:RED,ink:CR, acc:MU, accInk:CH,accSh:CH, alt:CH,altInk:CR,altSh:MU,  grSh:CH, sh:CH,  kickBg:CH,kickInk:CR, footBg:MU,footInk:CH,footSh:CH,  tex:tex('245,239,226')},
  C:{key:'C',name:'Mustard', bg:MU, ink:CH, acc:RED,accInk:CR,accSh:CH, alt:CH,altInk:CR,altSh:RED, grSh:CH, sh:CH,  kickBg:CH,kickInk:CR, footBg:CH,footInk:CR,footSh:RED, tex:tex('36,29,24')},
  D:{key:'D',name:'Charcoal',bg:CH, ink:CR, acc:MU, accInk:CH,accSh:DR, alt:CM,altInk:CH,altSh:RED, grSh:MU, sh:RED, kickBg:MU,kickInk:CH, footBg:CM,footInk:CH,footSh:RED, tex:tex('245,239,226')},
};

const STAR = 'polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)';
const BURST = (()=>{const p=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=i%2?39:50;
  p.push(`${(50+r*Math.cos(a)).toFixed(1)}% ${(50+r*Math.sin(a)).toFixed(1)}%`);}return `polygon(${p.join(',')})`;})();

const A75  = w => `font-family:'Anek Devanagari',sans-serif;font-stretch:75%;font-weight:${w}`;
const A875 = w => `font-family:'Anek Devanagari',sans-serif;font-stretch:87.5%;font-weight:${w}`;
const MONO = `font-family:'Martian Mono',monospace`;
const MUKTA= `font-family:'Mukta',sans-serif;font-weight:600`;
const esc  = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const root = (t,inner)=>`<div style="position:relative;width:1080px;height:1920px;overflow:hidden;background-color:${t.bg};background-image:${t.tex};color:${t.ink};font-family:'Mukta',sans-serif">${inner}</div>`;
const kicker = (t,label)=>`<div style="position:absolute;left:80px;right:80px;top:268px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 26px 16px;background:${t.kickBg};color:${t.kickInk};${MONO};font-size:24px;letter-spacing:.06em;text-transform:uppercase;transform:rotate(-1deg)"><span>Pages of Panvel · Vol. 01</span><span>${label}</span></div>`;
const footer = t=>`<div style="position:absolute;left:80px;right:80px;top:1400px;padding:22px 32px 20px;background:${t.footBg};color:${t.footInk};box-shadow:12px 12px 0 ${t.footSh};transform:rotate(1deg);display:flex;justify-content:space-between;align-items:center;gap:20px"><div style="display:flex;flex-direction:column;gap:6px"><div style="${A75(800)};font-size:86px;line-height:.9;letter-spacing:-.01em">@PAGESOFPANVEL</div><div style="${MONO};font-size:26px;letter-spacing:.04em">pagesofpanvel.in</div></div><div style="width:76px;height:76px;flex:none;background:${t.footSh};clip-path:${STAR}"></div></div>`;
const star = (css,bg)=>`<div style="position:absolute;${css};background:${bg};clip-path:${STAR}"></div>`;

/* ── 01 Finished ── */
const tSize = s => s.length>40?80 : s.length>24?96 : 116;
function finished(t,d){ return root(t, kicker(t,'№ 01 · Finished') +
`<div style="position:absolute;left:80px;right:80px;top:372px;height:1000px;display:flex;flex-direction:column">
  <div style="${A75(800)};font-size:600px;line-height:.74;letter-spacing:-.07em;margin-left:-24px;margin-top:80px;text-shadow:18px 18px 0 ${t.acc}">${esc(d.count)}</div>
  <div style="display:flex;flex-wrap:wrap;gap:18px;margin-top:44px;align-items:center">
    <div style="padding:12px 22px 4px;background:${t.acc};color:${t.accInk};${A75(800)};font-size:76px;line-height:1;text-transform:uppercase;transform:rotate(-2deg);box-shadow:10px 10px 0 ${t.accSh}">Books finished</div>
    <div style="padding:10px 20px 2px;border:5px dashed ${t.ink};${A75(700)};font-size:76px;line-height:1;transform:rotate(1.5deg)">· ${esc(d.year)}</div>
  </div>
  <div style="flex:1"></div>
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;${MONO};font-size:24px;letter-spacing:.08em;text-transform:uppercase"><span style="width:48px;height:6px;background:${t.ink}"></span>Latest finish</div>
  <div style="${A75(700)};font-size:${tSize(d.title)}px;line-height:.92;letter-spacing:-.02em;text-wrap:balance;overflow-wrap:anywhere">${esc(d.title)}</div>
  <div style="margin-top:16px;${MUKTA};font-size:44px;line-height:1.1">— ${esc(d.author)}</div>
</div>
<div style="position:absolute;right:64px;top:430px;width:290px;height:290px;background:${GR};color:${CR};clip-path:${BURST};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transform:rotate(10deg);text-align:center">
  <div style="${MONO};font-size:20px;letter-spacing:.08em">READ BY</div>
  <div style="${A75(800)};font-size:50px;line-height:.9;text-transform:uppercase">${esc(d.name)}</div>
</div>` + star('right:120px;top:800px;width:96px;height:96px',t.ink) + footer(t)); }

/* ── 02 Range ── */
const KINDS=['alt','outline','acc','dashed','green','italic','acc','dashed','alt'];
const ROTS=[-2.5,1.5,-1,2.5,-2,1,3,-1.5,2];
const tagStyle=(k,t)=>({
  alt:{bg:t.alt,fg:t.altInk,bd:`5px solid ${t.alt}`,sh:`10px 10px 0 ${t.altSh}`,fs:'normal'},
  acc:{bg:t.acc,fg:t.accInk,bd:`5px solid ${t.acc}`,sh:`10px 10px 0 ${t.accSh}`,fs:'normal'},
  green:{bg:GR,fg:CR,bd:`5px solid ${GR}`,sh:`10px 10px 0 ${t.grSh}`,fs:'normal'},
  outline:{bg:t.bg,fg:t.ink,bd:`5px solid ${t.ink}`,sh:'none',fs:'normal'},
  dashed:{bg:t.bg,fg:t.ink,bd:`5px dashed ${t.ink}`,sh:'none',fs:'normal'},
  italic:{bg:t.bg,fg:t.ink,bd:`5px solid ${t.ink}`,sh:'none',fs:'italic'},
})[k];
function range(t,d,i){ const tags=d.genres.map((g,j)=>{const s=tagStyle(KINDS[(j+i*2)%9],t);
  return `<div style="padding:12px 24px 2px;background:${s.bg};color:${s.fg};border:${s.bd};box-shadow:${s.sh};transform:rotate(${ROTS[(j+i)%9]}deg);font-style:${s.fs};white-space:nowrap;${A75(700)};font-size:60px;line-height:1;text-transform:uppercase">${esc(g)}</div>`;}).join('');
return root(t, kicker(t,'№ 02 · Range') +
`<div style="position:absolute;left:80px;right:80px;top:372px;height:1000px;display:flex;flex-direction:column">
  <div style="display:flex;align-items:flex-start;gap:24px">
    <div style="${A75(800)};font-size:480px;line-height:.74;letter-spacing:-.07em;margin-left:-20px;margin-top:80px;text-shadow:18px 18px 0 ${t.acc}">${esc(d.count)}</div>
    <div style="display:flex;flex-direction:column;align-items:flex-start;gap:24px;margin-top:70px">
      <div style="padding:10px 20px 0;background:${t.acc};color:${t.accInk};${A75(800)};font-size:122px;line-height:1;text-transform:uppercase;transform:rotate(-3deg);box-shadow:10px 10px 0 ${t.accSh}">Genres</div>
      <div style="padding:8px 18px 0;border:5px dashed ${t.ink};${A75(700)};font-size:70px;line-height:1;text-transform:uppercase;transform:rotate(2deg)">touched</div>
      <div style="${MONO};font-size:22px;letter-spacing:.08em;text-transform:uppercase">in ${esc(d.year)} so far</div>
    </div>
  </div>
  <div style="margin-top:auto;display:flex;flex-wrap:wrap;gap:24px 18px;align-items:center">${tags}</div>
</div>` + star('right:90px;top:400px;width:110px;height:110px',t.acc) + footer(t)); }

/* ── 03 On my desk ── */
const sSize = s => s.length<=6?210 : s.length<=12?150 : 118;
function desk(t,d){ return root(t, kicker(t,'№ 03 · On my desk') +
`<div style="position:absolute;left:90px;top:396px;width:360px;height:950px;background:${d.spine};color:${CH};transform:rotate(-2.5deg);box-shadow:20px 20px 0 ${t.sh}">
  <div style="position:absolute;left:0;right:0;top:44px;height:14px;background:${CH}"></div>
  <div style="position:absolute;left:0;right:0;top:70px;height:5px;background:${CH}"></div>
  <div style="position:absolute;left:0;right:0;bottom:70px;height:5px;background:${CH}"></div>
  <div style="position:absolute;left:0;right:0;bottom:44px;height:14px;background:${CH}"></div>
  <div style="position:absolute;left:0;right:0;bottom:92px;text-align:center;${MONO};font-size:22px;letter-spacing:.1em">P·O·P</div>
  <div style="position:absolute;left:50%;top:50%;width:700px;height:330px;transform:translate(-50%,-50%) rotate(-90deg);display:flex;flex-direction:column;justify-content:center;gap:8px">
    <div lang="mr" style="${A875(700)};font-size:${sSize(d.title)}px;line-height:1.02;letter-spacing:-.01em;overflow-wrap:anywhere">${esc(d.title)}</div>
    <div lang="mr" style="${MUKTA};font-size:44px;line-height:1.1">${esc(d.author)}</div>
  </div>
</div>
<div style="position:absolute;left:510px;right:70px;top:384px;display:flex;flex-direction:column;align-items:flex-start;gap:20px">
  <div style="${A75(800)};font-size:150px;line-height:.88;text-transform:uppercase;color:transparent;-webkit-text-stroke:4px ${t.ink}">Now</div>
  <div style="padding:12px 20px 0;background:${t.acc};color:${t.accInk};${A75(800)};font-size:132px;line-height:1;text-transform:uppercase;transform:rotate(-2deg);box-shadow:10px 10px 0 ${t.accSh}">Reading</div>
  <div style="${A75(800)};font-style:italic;font-size:120px;line-height:.9;text-transform:uppercase">this.</div>
  <div style="width:100%;height:6px;background:${t.ink};margin-top:16px"></div>
  <div lang="mr" style="${A875(600)};font-size:60px;line-height:1.15">${esc(d.author)}</div>
  <div style="${A75(800)};font-size:280px;line-height:.76;letter-spacing:-.06em;margin-top:26px;text-shadow:14px 14px 0 ${t.acc}">+${d.others}</div>
  <div style="${MUKTA};font-size:40px;line-height:1.2;text-wrap:pretty">and ${d.others} others in the circle are reading it too</div>
</div>` + star('left:400px;top:340px;width:100px;height:100px',t.acc) + footer(t)); }

/* ── 04 Streak ── */
function streak(t,d){ const dots=d.days.map((ch,i)=>{const today=i===13;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div style="width:100%;aspect-ratio:1;box-sizing:border-box;border-radius:50%;background:${today?'transparent':(d.read[i]?t.ink:'transparent')};border:${today?`6px dashed ${t.acc}`:`6px solid ${t.ink}`}"></div><div style="${MONO};font-size:20px">${ch}</div></div>`;}).join('');
return root(t, kicker(t,'№ 04 · Streak') +
`<div style="position:absolute;left:44px;top:470px;${A75(800)};font-size:780px;line-height:.76;letter-spacing:-.04em;text-shadow:22px 22px 0 ${t.acc}">${esc(d.count)}</div>` +
star('right:84px;top:1030px;width:120px;height:120px',t.ink) +
`<div style="position:absolute;left:80px;right:80px;top:1066px;display:flex;flex-wrap:wrap;gap:18px;align-items:center">
  <div style="padding:12px 22px 2px;background:${t.acc};color:${t.accInk};${A75(800)};font-size:92px;line-height:1;text-transform:uppercase;transform:rotate(-2.5deg);box-shadow:10px 10px 0 ${t.accSh}">Days</div>
  <div style="padding:10px 20px 0;border:5px dashed ${t.ink};${A75(700)};font-size:92px;line-height:1;text-transform:uppercase;transform:rotate(1.5deg)">in a</div>
  <div style="padding:12px 22px 2px;background:${t.alt};color:${t.altInk};${A75(800)};font-style:italic;font-size:92px;line-height:1;text-transform:uppercase;transform:rotate(-1deg);box-shadow:10px 10px 0 ${t.altSh}">row</div>
</div>
<div style="position:absolute;left:80px;right:80px;top:1218px;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;justify-content:space-between;${MONO};font-size:22px;letter-spacing:.08em;text-transform:uppercase"><span>Last 14 days</span><span>Today ↓</span></div>
  <div style="display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:12px">${dots}</div>
</div>` + footer(t)); }

/* ── 05 A line ── */
function line(t,d){ const q=d.quote
  .replace('[[', `<span style="display:inline-block;padding:0 14px;border:5px dashed ${t.ink};line-height:.95;transform:rotate(-2deg)">`).replace(']]','</span>')
  .replace('((', `<span style="background:${t.acc};color:${t.accInk};padding:0 14px;box-decoration-break:clone;-webkit-box-decoration-break:clone;font-style:italic">`).replace('))','</span>');
return root(t, kicker(t,'№ 05 · A line') +
`<div style="position:absolute;left:80px;right:80px;top:372px;height:1000px;display:flex;flex-direction:column">
  <div style="height:230px;${A75(800)};font-size:480px;line-height:.9;margin-left:-16px;color:${t.acc};text-shadow:12px 12px 0 ${t.sh}">“</div>
  <div style="${A875(600)};font-size:100px;line-height:1.02;letter-spacing:-.025em;text-wrap:pretty">${q}</div>
  <div style="flex:1"></div>
  <div style="height:6px;background:${t.ink};margin-bottom:24px"></div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
    <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
      <div style="${MONO};font-size:22px;letter-spacing:.08em;text-transform:uppercase">From</div>
      <div style="${A75(700)};font-size:72px;line-height:.95;text-transform:uppercase;text-wrap:balance">${esc(d.title)}</div>
      <div style="${MUKTA};font-size:42px;line-height:1.1">${esc(d.author)}</div>
    </div>
    <div style="flex:none;padding:16px 24px 8px;background:${t.alt};color:${t.altInk};transform:rotate(4deg);box-shadow:10px 10px 0 ${t.altSh};display:flex;flex-direction:column;gap:4px">
      <div style="${MONO};font-size:20px;letter-spacing:.08em">SAVED BY</div>
      <div style="${A75(800)};font-size:84px;line-height:.95;text-transform:uppercase">${esc(d.name)}</div>
    </div>
  </div>
</div>` + star('right:100px;top:420px;width:130px;height:130px',GR) + star('right:230px;top:540px;width:60px;height:60px',t.ink) + footer(t)); }

/* ── 06 Wrapped ── */
const PAL=['#FF6B4A','#FFA62B','#FFE03D','#D4E84A','#9BE04F','#4FD97E','#3ED9B0','#35D2D2','#4BC4F5','#7FA8FF','#A87FFF','#D97FF5','#FF6FB5','#FF5C7A'];
function wrapped(t,d){
  const st=[
    {n:d.books,l:'Books',     bg:t.acc,fg:t.accInk,bd:`5px solid ${t.acc}`,sh:`12px 12px 0 ${t.accSh}`,r:-2},
    {n:d.genres,l:'Genres',   bg:t.alt,fg:t.altInk,bd:`5px solid ${t.alt}`,sh:`12px 12px 0 ${t.altSh}`,r:1.5},
    {n:d.streak,l:'Day streak',bg:t.bg,fg:t.ink,bd:`6px dashed ${t.ink}`,sh:'none',r:1},
    {n:d.langs,l:'Languages', bg:GR,fg:CR,bd:`5px solid ${GR}`,sh:`12px 12px 0 ${t.grSh}`,r:-1.5}];
  const tiles=st.map(s=>`<div style="box-sizing:border-box;height:250px;padding:26px 28px 20px;background:${s.bg};color:${s.fg};border:${s.bd};box-shadow:${s.sh};transform:rotate(${s.r}deg);display:flex;flex-direction:column;justify-content:space-between"><div style="${A75(800)};font-size:200px;line-height:.74;letter-spacing:-.06em;padding-top:14px">${esc(s.n)}</div><div style="${A75(700)};font-size:50px;line-height:1;text-transform:uppercase">${s.l}</div></div>`).join('');
  const n=Number(d.books)||23;
  const shelf=Array.from({length:n},(_,i)=>`<div style="position:relative;flex:none;width:${30+(i*13)%14}px;height:${100+(i*37)%50}px;background:${PAL[(i*5)%14]};transform:rotate(${i===n-1?5:0}deg);transform-origin:bottom left"><div style="position:absolute;left:0;right:0;top:14px;height:8px;background:${CH}"></div><div style="position:absolute;left:0;right:0;bottom:16px;height:3px;background:${CH}"></div></div>`).join('');
  return root(t, kicker(t,'№ 06 · Wrapped') +
`<div style="position:absolute;left:80px;right:80px;top:372px;height:1000px;display:flex;flex-direction:column;gap:30px">
  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px">
    <div style="${A75(800)};font-size:190px;line-height:.8;letter-spacing:-.04em;text-transform:uppercase;padding-top:24px">My year</div>
    <div style="padding:10px 20px 0;border:5px dashed ${t.ink};${A75(700)};font-size:72px;line-height:1;transform:rotate(3deg)">${esc(d.year)}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px">${tiles}</div>
  <div style="margin-top:auto;display:flex;flex-direction:column">
    <div style="display:flex;align-items:flex-end;gap:3px;height:150px">${shelf}</div>
    <div style="height:12px;background:${t.ink}"></div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;${MONO};font-size:20px;letter-spacing:.08em;text-transform:uppercase"><span>The ${esc(d.year)} shelf</span><span>${n} spines</span></div>
  </div>
</div>` + star('right:420px;top:356px;width:90px;height:90px',t.acc) + footer(t)); }

export const CARDS = [
  {id:'finished', no:'01', name:'Finished it', note:'the flex',        draw:finished},
  {id:'range',    no:'02', name:'Range',       note:'genres touched',  draw:range},
  {id:'desk',     no:'03', name:'On my desk',  note:'reading this',    draw:desk},
  {id:'streak',   no:'04', name:'Streak',      note:'the number',      draw:streak},
  {id:'line',     no:'05', name:'A line',      note:'the quote card',  draw:line},
  {id:'wrapped',  no:'06', name:'My year',     note:'wrapped',         draw:wrapped},
];

export const SAMPLE = {
  finished:{count:'07', year:'2026', title:'A Fine Balance', author:'Rohinton Mistry', name:'Vaishnavi'},
  range:{count:'09', year:'2026', genres:['Fiction','Poetry','History','Memoir','Crime','Sci-fi','Philosophy','Essays','Graphic novel']},
  desk:{title:'कोसला', author:'भालचंद्र नेमाडे', spine:'#FFE03D', others:3},
  streak:{count:'42', days:'TWTFSSMTWTFSSM'.split(''), read:[1,1,1,1,1,1,1,1,1,1,1,1,1,0]},
  line:{quote:'A story is a [[map]] of the places a person is ((afraid to go.))', title:'The Enchantress of Florence', author:'Salman Rushdie', name:'Nitya'},
  wrapped:{year:'2026', books:'23', genres:'09', streak:'42', langs:'3'},
};
