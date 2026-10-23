/* Party RSVPs on the organiser's desk: everyone who said yes on /diwali.

   Reads the `rsvp` collection, which only organisers may read (it holds
   phone numbers). Read-only, like the rest of the desk. The same number
   sent twice counts once, with the latest name and headcount.          */

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const box = () => document.getElementById("rsvp-body");
const EVENT = "diwali-2026";
const when = (d) => (d ? d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "just now");
const pretty = (p) => (p.startsWith("+91") && p.length === 13 ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p);
let rows = [], roleForSetup = "owner";

// One row per number, newest answer wins; `times` says how often it came in.
function people() {
  const by = new Map();
  for (const r of [...rows].sort((a, b) => (a.at || 0) - (b.at || 0))) {
    const prev = by.get(r.phone);
    by.set(r.phone, { ...r, times: (prev?.times || 0) + 1 });
  }
  return [...by.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
}

function kpi(label, value, note, hero) {
  const k = el("div", "kpi" + (hero ? " hero" : ""));
  k.append(el("span", "l", label), el("span", "v", value), el("span", "d", note));
  return k;
}

function render() {
  const root = box();
  if (!root) return;
  root.replaceChildren();
  const list = people();
  if (!list.length) {
    root.append(el("div", "empty-note", "No RSVPs yet. Share pagesofpanvel.in/diwali on WhatsApp and Instagram, and names appear here, live."));
    return;
  }
  const heads = list.reduce((s, p) => s + 1 + (p.plus || 0), 0);
  const today = list.filter((p) => p.at && Date.now() - p.at < 864e5).length;
  const k = el("div", "kpis");
  k.append(
    kpi("People coming", heads, "everyone, friends included", true),
    kpi("RSVPs", list.length, "one per WhatsApp number"),
    kpi("Bringing friends", list.filter((p) => p.plus).length, `${heads - list.length} extra in all`),
    kpi("Last 24 hours", today, today === 1 ? "new RSVP" : "new RSVPs"));
  root.append(k);

  const tools = el("div", "fb-tools");
  const csv = el("button", "btn ghost", "Download list (CSV)");
  csv.type = "button";
  csv.onclick = () => download(list);
  const copy = el("button", "btn ghost", "Copy numbers");
  copy.type = "button";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(list.map((p) => p.phone).join("\n")); copy.textContent = "Copied ✓"; }
    catch { copy.textContent = "Couldn't copy"; }
    setTimeout(() => { copy.textContent = "Copy numbers"; }, 2000);
  };
  tools.append(csv, copy);
  root.append(tools);

  const wrap = el("div", "table-wrap"), t = el("table", "table rsvp-table");
  const hr = el("tr");
  for (const h of ["Name", "WhatsApp", "Coming", "When"]) hr.append(el("th", h === "Coming" ? "num" : null, h));
  const thead = el("thead"); thead.append(hr);
  const tb = el("tbody");
  for (const p of list) {
    const tr = el("tr");
    const wa = el("a", null, pretty(p.phone));
    wa.href = "https://wa.me/" + p.phone.replace(/\D/g, "");
    wa.target = "_blank"; wa.rel = "noopener";
    const num = el("td"); num.append(wa);
    const name = el("td", null, p.name);
    if (p.times > 1) name.append(el("small", "dup", ` sent ${p.times}×`));
    tr.append(name, num, el("td", "num", p.plus ? `1 + ${p.plus}` : "1"), el("td", null, when(p.at)));
    tb.append(tr);
  }
  t.append(thead, tb);
  wrap.append(t);
  root.append(wrap);
}

function download(list) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Name", "WhatsApp", "Friends", "Total", "RSVP'd at", "Times sent"].map(q).join(",")]
    .concat(list.map((p) => [p.name, p.phone, p.plus || 0, 1 + (p.plus || 0), p.at ? p.at.toISOString() : "", p.times].map(q).join(",")));
  // The BOM keeps Marathi and Hindi names intact when Excel opens it.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a"); a.href = URL.createObjectURL(blob);
  a.download = `pages-of-panvel-diwali-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function setup(code) {
  box()?.replaceChildren(el("div", "setup", code !== "permission-denied"
    ? "The RSVPs couldn't be read just now. Try again in a bit."
    : roleForSetup === "co"
      ? "RSVPs aren't open to co-organisers yet. The circle's owner needs to publish the updated database rules; then they appear here by themselves."
      : "One step left: publish the updated database rules (firestore.rules from the site, with ORGANISER_UID replaced by your account ID, exactly as before). Until then, the Diwali page can't save RSVPs either."));
}

// Live mode: called once an organiser is signed in.
export function watchRsvp(F, db, role = "owner") {
  roleForSetup = role;
  return F.onSnapshot(F.query(F.collection(db, "rsvp"), F.where("e", "==", EVENT)),
    (snap) => {
      rows = snap.docs.map((d) => { const x = d.data(); return { id: d.id, name: x.name || "", phone: x.phone || "", plus: x.plus || 0, at: x.at?.toDate ? x.at.toDate() : null }; });
      render();
    },
    (e) => setup(e?.code));
}

// ?demo: made-up RSVPs, so the section can be seen before anyone replies.
export function demoRsvp() {
  const names = ["Nitya", "Vineet", "Ronit", "Rishikesh", "Vaishnavi", "Anushka", "Siddhi", "Yugandhar", "Vineet"];
  rows = names.map((name, i) => {
    const at = new Date(); at.setHours(at.getHours() - i * 9);
    return { id: "d" + i, name, phone: "+9198765" + String(43210 + (name === "Vineet" ? 1 : i * 7)).padStart(5, "0"), plus: [0, 1, 0, 2, 0, 0, 1, 0, 1][i], at };
  });
  render();
}
