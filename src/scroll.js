/* What the page scrolls with, and what a redraw has to put back. main is the
   scroller, not the page; chip rows scroll sideways and every render rebuilds
   them; a selector needs its ids escaped; and focus, found again on the
   control that had it. Every view, the sheet and the shell use these,
   and nothing here imports from src/. The scroller is looked up once, as the
   module is imported, so the markup has to be there first. The header is
   measured here too: what scrolls parks under it (--hdr-h), and loading, the
   shell and boot() all need the measurement from a module below them. So is
   the nav: what sits on it or clears it is laid out from its height
   (--nav-h). And what an area of the sheet hides past an edge, which the
   stylesheet fades (DECISIONS #76), with an arrow under an area that hides
   enough below (#78). */

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

/* A control, as a selector that finds it again once a redraw has replaced
   it (#66): its id - the hero's and the Map's card are their places, kept
   whatever event they show, and a crew line is its crewmate's - or the row,
   the timeline block, the map's hotel, the chip or the action it is part
   of; null for anything else, and for the body, where a browser that does
   not focus a tapped button leaves focus. The sheet keeps what opened it
   this way, and Now and the Map what had focus as they draw again. */
function focusKey(el) {
  if (!el || !el.closest || el === document.body) return null;
  if (el.id) return `#${cssEsc(el.id)}`;
  const row = el.closest(".row[data-id]");
  if (row) return `.row[data-id="${cssEsc(row.dataset.id)}"][data-list="${cssEsc(row.dataset.list || "")}"] ${el.closest(".star") ? ".star" : ".row-main"}`;
  const block = el.closest("[data-hero], .map-hotel[data-hotel]");
  if (block) return block.dataset.hero ? `[data-hero="${cssEsc(block.dataset.hero)}"]` : `.map-hotel[data-hotel="${cssEsc(block.dataset.hotel)}"]`;
  const chip = el.closest("[data-chip]");
  if (chip) return `[data-chip="${cssEsc(chip.dataset.chip)}"][data-value="${cssEsc(chip.dataset.value || "")}"]`;
  const act = el.closest("[data-act]");
  return act ? `[data-act="${cssEsc(act.dataset.act)}"]` : null;
}
/* The first match on screen: a view the tab bar has left keeps its old
   markup, hidden, and may hold the same row or block. */
const shownMatch = selector => [...document.querySelectorAll(selector)].find(el => !el.closest("[hidden]")) || null;
/* A view about to draw again: what has focus inside it, as focusKey() puts
   it. And once it has drawn: focus back on that control while it is on
   screen, put there, not scrolled to. */
function focusIn(view) {
  const active = document.activeElement;
  return view && active && view.contains(active) ? focusKey(active) : null;
}
function giveFocusBack(key) {
  const again = key ? shownMatch(key) : null;
  if (again && document.activeElement !== again) again.focus({preventScroll: true});
}
/* What the minute tick redraws, redrawn in place: an element written into
   from its fresh copy - its attributes and what it holds - keeps its node,
   and with it any focus on it, so focus never moves and a screen reader is
   not made to read it again. And a part of a view, the same way, each of its
   elements into the one of the same kind; where the kinds differ, or their
   number, the part is drawn anew and focus put back. Nothing at all when
   the words have not changed. */
function refill(el, fresh) {
  if (el.outerHTML === fresh.outerHTML) return;
  for (const a of [...el.attributes]) if (!fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
  for (const a of [...fresh.attributes]) if (el.getAttribute(a.name) !== a.value) el.setAttribute(a.name, a.value);
  if (el.innerHTML !== fresh.innerHTML) el.innerHTML = fresh.innerHTML;
}
function drawInPlace(part, html) {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  if (holder.innerHTML === part.innerHTML) return;
  const was = [...part.children], fresh = [...holder.children];
  const alike = part.childNodes.length === was.length && holder.childNodes.length === fresh.length && was.length === fresh.length
    && was.every((el, i) => el.tagName === fresh[i].tagName && el.className === fresh[i].className);
  if (alike) { was.forEach((el, i) => refill(el, fresh[i])); return; }
  const back = focusIn(part);
  part.innerHTML = html;
  giveFocusBack(back);
}

/* The header line must not clip: if it would, hide the word "refreshed"
   and measure again. jsdom reports no widths, so this is a no-op there. */
function fitHeaderLine() {
  const line = document.querySelector(".hdr-line");
  if (!line) return;
  line.classList.remove("tight", "tighter");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tight");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tighter");
}

/* The sticky filters park directly under the header, whose height changes
   with the clock and the freshness line - measure it rather than guess. */
function syncHeaderHeight() {
  const h = document.querySelector(".hdr");
  if (h) document.documentElement.style.setProperty("--hdr-h", `${Math.round(h.getBoundingClientRect().height)}px`);
  fitHeaderLine();
}

/* The nav's height, the safe-area inset under it included: the mini-bar sits
   on it, and the end spacer, the update pill, the dev-build mark and the Map
   clear it, from this one number rather than a guess at it. A 0 - jsdom, or a
   page not laid out yet - is not a height, and the root's default stands. */
function syncNavHeight() {
  const nav = document.querySelector(".nav");
  const h = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
  if (h) document.documentElement.style.setProperty("--nav-h", `${h}px`);
}

/* More past an edge (DECISIONS #76). An area of the sheet that scrolls on its
   own says what it hides past its top and past its bottom, and the
   stylesheet fades each edge as deep as what is hidden there, up to its cap.
   What is hidden, from the element's three numbers and nothing else: whole
   px, and under one is none - scrollTop is a fraction where the other two
   are rounded, so an area at its end can be a fraction short of it; never
   under 0, so a bounce past an end is the end; and never over the ceiling,
   which stands safely above the deepest band the stylesheet draws - 1.75rem,
   32.2px with Larger text - so far from an end the number stands still. */
const MORE_CEILING = 48;
function moreHidden(scrollTop, clientHeight, scrollHeight) {
  const px = n => Math.max(0, Math.min(MORE_CEILING, Math.floor(n)));
  return {above: px(scrollTop), below: px(scrollHeight - clientHeight - scrollTop)};
}
/* The word the mark carries (DECISIONS #78): "below" while an area hides
   enough below to be worth a scroll - about a line of text - and none under
   that, where the fade alone speaks: a few px of space under a last chip
   are not more to read. The stylesheet hangs the arrow on the word. The
   threshold stands under the ceiling, or the word would never be said. */
const MORE_ARROW = 20;
const moreWord = hidden => (hidden.below >= MORE_ARROW ? "below" : "");
/* The six areas, by four selectors: an event's body, the hotel's list and
   the shared day's are each an .ev-body. Not the share panel's message,
   which is a field; not an event's panel scrolling as one, whose body has
   the cue and whose foot is pinned; and not main. The stylesheet gives the
   same four their scroll padding. */
const MORE_AREAS = ".ev-body, .filters-body, .advanced-body, #panel-crew";
/* An area's mark, from its own three numbers, written only where it
   changed: the two properties, each gone at 0, and data-more, the hook the
   stylesheet's mask hangs on, there while either is above 0 - so an area
   whose content fits carries no mask, and nothing of ours: the style
   attribute the last property leaves empty goes too. The hook's value is
   moreWord()'s: "below" or nothing. An area in a hidden panel measures 0,
   and loses its mark the same way. */
function markMore(area) {
  const hidden = moreHidden(area.scrollTop, area.clientHeight, area.scrollHeight);
  for (const edge of ["above", "below"]) {
    const name = `--more-${edge}`, px = hidden[edge] ? `${hidden[edge]}px` : "";
    if (area.style.getPropertyValue(name) === px) continue;
    if (px) area.style.setProperty(name, px); else area.style.removeProperty(name);
  }
  const more = hidden.above > 0 || hidden.below > 0, word = more ? moreWord(hidden) : null;
  if (area.getAttribute("data-more") !== word) {
    if (more) area.setAttribute("data-more", word); else area.removeAttribute("data-more");
  }
  if (!more && area.getAttribute("style") === "") area.removeAttribute("style");
}
/* What boot() registers on the sheet, three things, and no draw calls any
   of this. A scroll, heard in the capture phase since a scroll does not
   bubble: the area scrolled says again what it hides - far from an end
   nothing is written, and within the ceiling of one, a write a px. */
function onMoreScroll(e) {
  const area = e.target;
  if (area.matches && area.matches(MORE_AREAS)) markMore(area);
}
/* And its two observers' callback: every area marked, and each one and each
   child of it handed, once, to the ResizeObserver. A MutationObserver on the
   sheet's child lists - never its attributes, so the mark's own write cannot
   wake it - finds an area a draw has just replaced, and a child put into one
   at its cap, which changes no box. The ResizeObserver hears the rest: a
   panel shown, Larger text, Advanced opened, the window resized or turned,
   and content that grows inside an area whose own box stays as it was. No
   node is ever unobserved: one a draw replaced goes with its panel. */
let moreSizes = null;
const moreWatched = new WeakSet();
function syncMore() {
  for (const area of document.querySelectorAll(MORE_AREAS)) {
    for (const node of moreSizes ? [area, ...area.children] : []) {
      if (moreWatched.has(node)) continue;
      moreWatched.add(node);
      moreSizes.observe(node);
    }
    markMore(area);
  }
}
/* boot()'s, where the browser has a ResizeObserver - jsdom has none: the one
   syncMore() hands the areas to, and the areas already in the page. */
function setMoreObserver(observer) {
  moreSizes = observer;
  syncMore();
}
/* The deepest a band on an area can be, for what a script scrolls into one
   and must land clear of it. The cap is the area's scroll padding too, so it
   is read from there - the px and the share of the area's height its min()
   names - and the numbers stay the stylesheet's alone: Larger text moves
   this with them. 0 where no padding is said: jsdom computes none. */
function moreCap(area) {
  const said = getComputedStyle(area).scrollPaddingTop || "";
  const px = /([\d.]+)px/.exec(said), share = /([\d.]+)%/.exec(said);
  if (!px && !share) return 0;
  return Math.min(px ? Number(px[1]) : Infinity, share ? area.clientHeight * Number(share[1]) / 100 : Infinity);
}

export {
  scroller, pageScrollTop, pageScrollTo, pageScrollBy, chipRowsSnapshot, chipRowsRestore,
  revealChip, cssEsc, focusKey, shownMatch, focusIn, giveFocusBack, refill, drawInPlace, fitHeaderLine, syncHeaderHeight,
  syncNavHeight, moreHidden, moreWord, onMoreScroll, syncMore, setMoreObserver, moreCap,
};
