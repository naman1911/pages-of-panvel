# Pages of Panvel

A reading circle noticeboard. Members sign in with Google, log what they're
reading, and find out who else is on the same book.

Static files only. No build step, no server to keep alive, no billing plan.

---

## What it costs

Nothing, at your size. Firebase's free tier ("Spark") allows 50,000 document
reads and 20,000 writes a day. Because the whole shared state lives in a single
document, one page load is one read.

With 100 members and 50 active, expect roughly 250 reads and 150 writes a day.
You have a lot of room.

No Cloud Functions are used anywhere, so you never need to add a card to the
project or move to the pay-as-you-go plan.

---

## Seeing it before you set anything up

Open `index.html?demo` in a browser — or just click the link on the sign-in
screen. That runs the whole site on a sample circle of eight readers with no
Firebase involved at all, so you can click around, add books, filter the shelf
and generate a WhatsApp round-up without signing up for anything.

Nothing in demo mode is saved. Reload and it's back to the sample data.

Useful for showing people what they're being asked to join. The sample lives in
`js/demo-data.js` if you want to change the names.

Note that opening plain `index.html` with no config filled in sits on the boot
screen — the page is just a shell, and everything on it is drawn after Firebase
answers. That's expected, not a broken file.

---

## Setting it up

**1. Make the Firebase project**

Go to console.firebase.google.com and create a project. Turn off Google
Analytics — you don't need it.

**2. Turn on Google sign-in**

Authentication → Get started → Google → Enable. Set a support email. Save.

**3. Create the database**

Firestore Database → Create database → production mode. Pick the
`asia-south1` (Mumbai) region so it's physically close to your members.

**4. Put in the rules**

Firestore → Rules tab. Paste the contents of `firestore.rules`. Publish.

**5. Add your members**

Firestore → Data → Start collection → collection ID `allowlist`.

For each member, add a document whose ID is their Gmail address in lowercase.
The document can be completely empty; only its existence matters. Add a field
like `name` if you want it readable at a glance.

Nobody outside this list can read anything, even with the link.

**6. Register the web app and copy the config**

Project settings → General → Your apps → Web (`</>`). Register it. Copy the
`firebaseConfig` object into `js/config.js`.

Those values are meant to be public — they identify the project, they don't
grant access. The rules are what protect the data.

**7. Authorise your domain**

Authentication → Settings → Authorized domains → Add domain. Add wherever
you're hosting it, e.g. `nitya.github.io`. Sign-in silently fails without this,
which is the single most common thing to get stuck on.

**8. Put the files online**

Push this folder to a GitHub repo, then Settings → Pages → deploy from the
`main` branch, root folder. A minute later it's live.

Firebase Hosting works too if you'd rather (`firebase init hosting`, then
`firebase deploy`), but GitHub Pages is fewer moving parts.

---

## Adding and removing members

One document in `allowlist`, named after their email in lowercase. Removing the
document cuts off access immediately.

Their books stay on the shelf after removal. To clear those out, edit the
`books` array in `circle/public` directly in the console.

---

## The data, briefly

    circle/public        one document, everything shared
      members            { uid: { name, joined, days[] } }
      books              [ { id, uid, title, author, genre, lang,
                             status, startedAt, finishedAt, line, lendable } ]
      board              [ { id, uid, text, at } ]

    private/{uid}        one per member, readable only by them
      books              same shape, never shown to anyone else

    allowlist/{email}    existence = permission

Check-in dates are capped at the last 60 per member and the agenda at 40 items,
so the shared document stays comfortably under Firestore's 1MB limit. At a
rough estimate you'd need several thousand books before size became a question.

Writes go through a Firestore transaction, so two people adding a book at the
same moment won't overwrite each other.

## The look, and what not to break

Dark, loud, mobile-first. Three typefaces, all of which carry Devanagari, so
English, Marathi and Hindi titles sit on the same line without falling back:
Anek Devanagari (display), Mukta (body), Martian Mono (small caps labels).

`index.html` and `css/style.css` are yours to rewrite. `js/app.js` is not —
it finds elements by ID and writes its own HTML, so a redesign has to keep the
contract below or the site breaks quietly, with no error.

**IDs that must exist in `index.html`** — you can wrap, nest and reorder them,
but they have to be there when the page loads, because `app.js` binds to all of
them on the first pass:

    boot  gate  gate-msg  signin  signout  app  who  tagline
    open-count  hero-badge  shelf  shelf-empty  twins
    tabs  error  filters  filter-toggle  wall
    my-name  streak  streak-unit  dots  checkin
    add-toggle  add-form  add-save
    f-title  f-author  f-genre  f-lang  f-private
    my-books  standings
    sunday-heading  board  board-text  board-post  lendable
    wa-share  wa-copy  wa-preview  party  party-msg
    panel-shelf  panel-mine  panel-standings  panel-sunday

**Class names `app.js` writes, which the CSS styles:** `entry` `chip` `body`
`title` `meta` `line` `tag` (+ variants `g p b y k`) `acts` `editor` `twin`
`rank` (+ `you`) `medal` `nm` `v` `btn` (+ `ghost`) `spine` (+ `thin` `match`)
`dot` (+ `on` `today`) `quiet` `field`, and `card` with `green|blue|pink|yellow`
for the four leaderboards.

Tab buttons need `class="tab"` and `data-tab="shelf|mine|standings|sunday"`.
`app.js` toggles the class `on` to mark the active one.

Four things that have bitten this project, and the rules that stop them:

1. **`[hidden]{display:none !important}` stays in the CSS.** `app.js` shows and
   hides with `el.hidden`, and any author `display` rule silently beats the
   `hidden` attribute. Without this the panels, filters, add form and the party
   toast are all permanently visible. This shipped as a bug once.
2. **`f-genre` and `f-lang` must be `<select>`.** `app.js` fills them with
   `.add(new Option(…))` at load. An `<input>` there throws before anything
   renders and the whole page stays on the boot screen.
3. **`add-form` must not be a `<form>`, and `add-save` must be
   `type="button"`.** `app.js` binds click and never calls `preventDefault`, so
   a real form reloads the page and loses the book.
4. **No `localStorage` or `sessionStorage`,** anywhere.

Inline styles `app.js` sets, which the CSS must not fight: `.spine` gets
`background` and `height`, `.chip` and `.medal` get `background`. The spine
palette is the `INKS` array at the top of `app.js` — seven colours, all light,
because the titles on them are near-black.

`--yellow` in the CSS is the colour `app.js` flashes an entry with when you tap
a spine. On a dark page it has to stay translucent or the text disappears for a
second and a half.

## Changing the details

`js/config.js` holds the circle's name, where you meet and when. Those feed the
header and the WhatsApp round-up.

## If something breaks

**Sign-in popup opens then closes with nothing happening** — the domain isn't
in Authentication → Settings → Authorized domains.

**"You're not on the member list"** — that Gmail address isn't in `allowlist`,
or it's there with a capital letter. Document IDs must be lowercase.

**Shelf stays empty after adding a book** — check the browser console. Usually
the rules haven't been published yet.
