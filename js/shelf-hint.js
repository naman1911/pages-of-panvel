/* The price tag under the shelf: "+34 more books →".

   It only looks at the shelf that's already on the page. It counts the spines
   still off to the right, swings a little while you scroll, and slides the
   shelf one screen when tapped. It never touches the spines, the data or
   Firebase, and app.js doesn't know it exists: app.js keeps showing and
   hiding #shelf-more exactly as it did the old "scroll for more" line.

   From the Claude Design "Shelf Hint", option A.                           */

const shelf = document.getElementById("shelf");
const hint = document.querySelector(".shelf-hint");
const more = document.getElementById("shelf-more");

if (shelf && hint && more) {
  const back = hint.querySelector(".hint-back");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0, moveT = 0, lastKey = "";

  function update() {
    raf = 0;
    const sl = shelf.scrollLeft, edge = sl + shelf.clientWidth;
    // Real books only: the thin unlabelled spines between them don't count.
    const books = shelf.querySelectorAll(".spine:not(.thin)");
    let left = 0;
    for (const b of books) if (b.offsetLeft + b.offsetWidth / 2 > edge) left++;
    if (shelf.scrollWidth - shelf.clientWidth - sl <= 8) left = 0;
    hint.classList.toggle("scrolled", sl > 8);
    const key = left + "/" + books.length;
    if (key === lastKey) return;
    lastKey = key;
    hint.querySelectorAll('[data-hint="left"]').forEach((el) => { el.textContent = left; });
    more.setAttribute("aria-label",
      `${left} more ${left === 1 ? "book" : "books"} on the shelf. Show the next ones.`);
  }
  const soon = () => { if (!raf) raf = requestAnimationFrame(update); };
  const fresh = () => { lastKey = ""; soon(); };

  shelf.addEventListener("scroll", () => {
    soon();
    hint.classList.add("moving");
    clearTimeout(moveT);
    moveT = setTimeout(() => hint.classList.remove("moving"), 180);
  }, { passive: true });
  addEventListener("resize", fresh);
  // When a book is added from another tab, the shelf is rebuilt while it's
  // hidden, with no width to measure, so the tag would stay hidden when you
  // come back. Re-check the moment the shelf is on screen again, with the
  // same test app.js uses. Only the tag is touched.
  new ResizeObserver(() => {
    if (!shelf.clientWidth) return;
    more.hidden = !(shelf.scrollWidth - shelf.clientWidth - shelf.scrollLeft > 8);
    fresh();
  }).observe(shelf);
  // app.js rebuilds the spines whenever anyone adds or finishes a book.
  new MutationObserver(fresh).observe(shelf, { childList: true });
  // Spine widths change when the real typeface arrives.
  if (document.fonts?.ready) document.fonts.ready.then(fresh);

  more.addEventListener("click", () => {
    shelf.scrollBy({ left: Math.max(120, shelf.clientWidth - 60), behavior: reduce ? "auto" : "smooth" });
  });
  back?.addEventListener("click", () => {
    shelf.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
  });

  update();
}
