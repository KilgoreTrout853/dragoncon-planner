/* What the page scrolls with, and what a redraw has to put back. main is the
   scroller, not the page; chip rows scroll sideways and every render rebuilds
   them; a selector needs its ids escaped. Every view and the shell use these,
   and nothing here imports from src/. The scroller is looked up once, as the
   module is imported, so the markup has to be there first. */

/* Everything that scrolls the page goes through here, because the page is
   not the scroller - main is (see the CSS). jsdom has no scrollTo on
   elements, so fall back to scrollTop. */
const scroller = document.querySelector("main");
const pageScrollTop = () => scroller.scrollTop || 0;
function pageScrollTo(top, smooth) {
  const y = Math.max(0, top || 0);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (typeof scroller.scrollTo === "function") scroller.scrollTo({top: y, left: 0, behavior: smooth && !reduce ? "smooth" : "auto"});
  else scroller.scrollTop = y;
}
function pageScrollBy(dy) { scroller.scrollTop = pageScrollTop() + dy; }

/* Chip rows scroll sideways, and a render rebuilds them from scratch - which
   used to snap every row back to its left edge, so the chip just tapped at
   the far end vanished. Remember where each named row was and put it back. */
function chipRowsSnapshot() {
  const m = {};
  document.querySelectorAll(".chips[data-row]").forEach(el => { if (el.scrollLeft) m[el.dataset.row] = el.scrollLeft; });
  return m;
}
function chipRowsRestore(m) {
  document.querySelectorAll(".chips[data-row]").forEach(el => { if (m[el.dataset.row]) el.scrollLeft = m[el.dataset.row]; });
}
/* Bring one chip fully into its row: the one just tapped, or on Explore the
   one that just became current. Only ever moves the row sideways, and only
   as far as it has to; the row is otherwise the reader's to scroll. */
function revealChip(chip) {
  const row = chip && chip.closest(".chips");
  if (!row) return;
  const pad = 14, r = chip.getBoundingClientRect(), R = row.getBoundingClientRect();
  let dx = 0;
  if (r.left < R.left + pad) dx = r.left - R.left - pad;
  else if (r.right > R.right - pad) dx = r.right - R.right + pad;
  if (!dx) return;
  const left = Math.max(0, row.scrollLeft + dx);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (typeof row.scrollTo === "function") row.scrollTo({left, behavior: reduce ? "auto" : "smooth"}); else row.scrollLeft = left;
}

const cssEsc = v => (window.CSS && CSS.escape) ? CSS.escape(v) : String(v);

export {
  scroller, pageScrollTop, pageScrollTo, pageScrollBy, chipRowsSnapshot, chipRowsRestore,
  revealChip, cssEsc,
};
