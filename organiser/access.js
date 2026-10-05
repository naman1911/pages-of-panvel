/* Organiser access: who else may open this desk.

   The owner adds a Google email here, and that person can then sign in and
   see everything on the desk, reader feedback included. Only the owner can
   add or remove anyone. A co-organiser sees this section too, but trying to
   share access just gets a polite no; the database rules refuse it as well,
   so it can't be done from anywhere else either.

   Each person is one document, organisers/{email in lower case}, holding
   only when they were added.                                              */

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const box = () => document.getElementById("access-body");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const when = (d) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "just now");

/* opts: { role: "owner" | "co" | "demo", me: email, F, db } */
export function startAccess(opts) {
  const { role, me } = opts;
  const root = box();
  root.replaceChildren();
  let people = [];          // [{ email, added: Date|null }], owner only
  let unsub = null;

  root.append(el("p", "sub", role === "co"
    ? "You have organiser access, shared by the circle's owner. Only the owner can give or take back access."
    : "Share this desk with a co-organiser. They sign in with that Google account and see everything here, feedback included. Only you can give or take back access: they can't share it on."));

  // the form (shown to everyone; only the owner's goes through)
  const form = el("form", "access-form");
  form.noValidate = true;
  const input = el("input", "search");
  Object.assign(input, { type: "email", placeholder: "their.name@gmail.com", autocomplete: "off", spellcheck: false });
  input.setAttribute("aria-label", "Google email to give organiser access");
  const add = el("button", "btn dark", "Give access");
  add.type = "submit";
  const msg = el("p", "access-msg");
  msg.setAttribute("aria-live", "polite");
  form.append(input, add);
  root.append(form, msg);
  const say = (text, kind) => { msg.textContent = text; msg.className = "access-msg" + (kind ? " " + kind : ""); };

  const list = el("ul", "access-list");
  if (role !== "co") root.append(list);

  function draw() {
    list.replaceChildren();
    const you = el("li", "you");
    you.append(el("span", "who", me ? `${me}` : "You"), el("span", "tag", "Owner"));
    list.append(you);
    for (const p of people) {
      const li = el("li");
      const who = el("span", "who", p.email);
      const meta = el("span", "meta", `added ${when(p.added)}`);
      const rm = el("button", "btn ghost small", "Remove");
      rm.type = "button";
      rm.onclick = () => remove(p.email, rm);
      li.append(who, meta, rm);
      list.append(li);
    }
    if (!people.length) list.append(el("li", "none", "Nobody else yet."));
  }

  async function remove(email, btn) {
    if (!confirm(`Take back organiser access from ${email}?`)) return;
    btn.disabled = true;
    try {
      if (role === "demo") { people = people.filter((p) => p.email !== email); draw(); }
      else await opts.F.deleteDoc(opts.F.doc(opts.db, "organisers", email));
      say(`${email} no longer has organiser access.`, "ok");
    } catch (e) {
      btn.disabled = false;
      say(e?.code === "permission-denied" ? "Only the circle's owner can take back access." : `Couldn't remove that just now${e?.code ? ` (${e.code})` : ""}. Try again?`, "err");
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (role === "co") { say("Only the circle's owner can share organiser access. Ask them to add this person.", "err"); return; }
    if (!EMAIL.test(email)) { say("That doesn't look like an email address.", "err"); return; }
    if (email === (me || "").toLowerCase()) { say("That's you: you're the owner already.", "err"); return; }
    if (people.some((p) => p.email === email)) { say(`${email} already has organiser access.`, "err"); return; }
    add.disabled = true;
    try {
      if (role === "demo") { people.push({ email, added: new Date() }); draw(); }
      else await opts.F.setDoc(opts.F.doc(opts.db, "organisers", email), { added: opts.F.serverTimestamp() });
      input.value = "";
      say(`Done. ${email} can now open this page (pagesofpanvel.in/organiser) by signing in with that Google account.`, "ok");
    } catch (err) {
      say(err?.code === "permission-denied"
        ? "Only the circle's owner can share organiser access. (If that's you, publish the updated database rules first.)"
        : `Couldn't add that just now${err?.code ? ` (${err.code})` : ""}. Try again?`, "err");
    } finally {
      add.disabled = false;
    }
  };

  if (role === "demo") {
    people = [{ email: "co.organiser@gmail.com", added: new Date(Date.now() - 9 * 864e5) }];
    draw();
  } else if (role === "owner") {
    draw();
    unsub = opts.F.onSnapshot(opts.F.collection(opts.db, "organisers"),
      (snap) => {
        people = snap.docs.map((d) => ({ email: d.id, added: d.data().added?.toDate?.() || null }))
          .sort((a, b) => (a.added || 0) - (b.added || 0));
        draw();
      },
      (e) => say(e?.code === "permission-denied"
        ? "To share access, publish the updated database rules first (firestore.rules, with ORGANISER_UID replaced by your account ID)."
        : `Couldn't load who has access${e?.code ? ` (${e.code})` : ""}.`, "err"));
  }
  return () => { if (unsub) unsub(); };
}
