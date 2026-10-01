/* The shell: what is on screen whatever the tab. render(), which redraws the
   page from state and is what the bus calls - the open crew panel with it,
   an open event's who's-going line and an open hotel's crew;
   the header's clock, the notice above the views and the mini-bar; what the
   page does about a new simulated moment; togglePick(), which keeps the
   tapped row under the finger through the redraw; the iOS edge guard; and
   the handlers boot() registers for the tab bar, the mini-bar, the
   simulated-time chip and the larger-text switch. It is above the views,
   the sheet and loading and imports them; nothing below imports it, and
   what is below asks for a redraw over the bus. It reads nothing as it is
   imported. */
import { dayOf, esc, fmtMins, fmtShort, minutesBetween } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { hasBackend } from "./backend.js";
import { pendingJoin } from "./crews.js";
import { state } from "./state.js";
import { CON, conEnded, conPhase, DAY_LABEL, effectiveNow, isSimulated, now, setOverride } from "./time.js";
import { hotelVar, placeHTML } from "./venues.js";
import { events } from "./data.js";
import { picks, savePicks } from "./picks.js";
import { nextPickInConDay } from "./walk.js";
import {
  chipRowsRestore, chipRowsSnapshot, cssEsc, fitHeaderLine, pageScrollBy, pageScrollTo,
  syncHeaderHeight,
} from "./scroll.js";
import { runSync } from "./sync.js";
import { renderNow } from "./now.js";
import { cancelQueuedBrowseRender, renderBrowse } from "./browse.js";
import { renderExplore } from "./explore.js";
import { renderMap } from "./map.js";
import { renderPlans } from "./plans.js";
import { refreshCrewPanel, refreshEventSheet, refreshHotelSheet, refreshSharedDay } from "./sheet.js";
import { updateFresh } from "./loading.js";

/* ==================================================================
   Rendering
   ================================================================== */

function render() {
  cancelQueuedBrowseRender();
  updateClock();
  renderNotice();
  document.querySelectorAll(".nav button").forEach(b => b.dataset.tab === state.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  document.getElementById("brand").hidden = state.tab !== "now";
  syncHeaderHeight();          // the brand comes and goes with the tab, and the spacers follow the header
  ["now", "browse", "explore", "map", "plans"].forEach(t => document.getElementById(`view-${t}`).hidden = t !== state.tab);
  const badge = document.getElementById("plansBadge");
  badge.hidden = picks.size === 0; badge.textContent = picks.size;
  refreshCrewPanel();          // the join step can be open before the schedule is
  refreshEventSheet();         // an open event's who's-going line, in place
  refreshHotelSheet();         // an open hotel's crew, in place
  refreshSharedDay();          // the shared day's stars, in place
  if (!events.length) return;
  const rows = chipRowsSnapshot();
  if (state.tab === "now") renderNow();
  if (state.tab === "browse") renderBrowse();
  if (state.tab === "explore") renderExplore();
  if (state.tab === "map") renderMap();
  if (state.tab === "plans") renderPlans();
  chipRowsRestore(rows);
  renderMiniBar();
}

function renderMiniBar() {
  const bar = document.getElementById("minibar");
  /* Not on Now, which is about the next pick already; not on the Map, whose
     caption says the same thing; and not once the con is over. */
  const at = now();
  const next = state.tab === "now" || state.tab === "map" || !events.length || conEnded() ? null : nextPickInConDay(at);
  if (!next) {
    bar.hidden = true;
    document.body.classList.remove("has-minibar");
    return;
  }
  /* How long until it starts, and never when to leave (DECISIONS #40). */
  const when = `in ${fmtMins(minutesBetween(at, next._s))}`;
  bar.innerHTML = `<span class="mb-body">
      <span class="mb-title">${esc(next.title)}</span>
      <span class="mb-room" style="--h:var(${hotelVar(next.hotel)})">${placeHTML(next)}</span>
    </span><span class="mb-when">${esc(when)}</span>`;
  bar.setAttribute("aria-label", `Next: ${next.title}, ${when}. Go to Now.`);
  bar.hidden = false;
  document.body.classList.add("has-minibar");
}

function updateClock() {
  const at = now();
  document.getElementById("clock").textContent = `${DAY_LABEL[dayOf(at)] || at.toLocaleDateString(undefined, {weekday: "short"})} ${fmtShort(at)}`;
  document.getElementById("simChip").hidden = !isSimulated();
  fitHeaderLine();
}

/* ---- The notice above the views ------------------------------------ */
/* After the con: that it is over, on every tab, until dismissed - once,
   and remembered for that year. Before it: the preview banner. Live:
   nothing. */
const ARCHIVE_NOTICE_KEY = storageKey("archiveNoticeDismissed");
const archiveNoticeDismissed = () => loadJSON(ARCHIVE_NOTICE_KEY, null) === CON.year;
function noticeHTML() {
  if (conEnded()) {
    return archiveNoticeDismissed() ? "" : `<b>Dragon Con ${CON.year} has ended.</b> Your starred events are on the Now tab as your ${CON.year} schedule.
    <div class="btns"><button class="btn quiet" data-act="dismiss-archive">OK</button></div>`;
  }
  return effectiveNow().banner;
}
let lastNoticeHTML = null;
function renderNotice() {
  const html = noticeHTML();
  if (html === lastNoticeHTML) return;       // the tick calls this every minute
  lastNoticeHTML = html;
  const el = document.getElementById("notice");
  el.hidden = !html;
  el.className = conEnded() ? "notice archive" : "notice";
  el.innerHTML = html;
}

/* value: an ISO date-time, or null for the real clock. setOverride() in
   time.js sets it, keeps it for the session and keeps the URL in step; this
   is what the page does about a new moment. The day chips follow the clock
   again until tapped. */
function setTimeOverride(value) {
  setOverride(value);
  state.browse.day = null;
  state.map.day = null;
  state.plans.day = null;
  render();
  updateFresh();                             // "refreshed 2 h ago" is relative to the clock too
}
function onSimChipClick() { setTimeOverride(null); }

/* ==================================================================
   Events (the DOM kind)
   ================================================================== */

/* Starring changes what renders above the row you just tapped - the first
   pick inserts the whole hero card - which used to shove the list down by
   200px or more, so the next tap landed on whatever had slid into place.
   Keep the tapped row under the finger: measure it, re-render, put it back. */
function togglePick(id, anchor) {
  const wasTop = anchor ? anchor.getBoundingClientRect().top : null;
  const list = anchor ? anchor.dataset.list || "" : "";
  if (picks.has(id)) picks.delete(id); else picks.add(id);
  savePicks();
  render();
  if (wasTop === null) return;
  const sel = `.row[data-id="${cssEsc(id)}"]${list ? `[data-list="${cssEsc(list)}"]` : ""}`;
  const el = document.querySelector(sel);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - wasTop;
  if (Math.abs(delta) > 1) pageScrollBy(delta);
}

/* The tab the app opens on (DECISIONS #62): Explore before the con, when
   nothing is on yet and the schedule is there to discover, and Now from its
   start and after its end. The phase is the clock's, so ?now= decides it.
   A kept invite wins, in any phase: Plans, under its join step (#63).
   boot() calls this once the time override and the invite are read and
   before load(), where a #explore= link still wins. */
function setOpeningTab() { state.tab = hasBackend && pendingJoin() ? "plans" : conPhase() === "before" ? "explore" : "now"; }

/* What boot() registers for the tab bar, the mini-bar, the larger-text switch
   and coming back to the tab. A tap on Plans starts a sync run too, for
   what the crew has done since (docs/sync/contract.md, section 5). */
function onNavClick(e) {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  state.tab = b.dataset.tab; render(); pageScrollTo(0);
  if (state.tab === "plans") runSync();
}
function onMiniBarClick() { state.tab = "now"; render(); pageScrollTo(0); }
/* Its own key, so nothing that resets settings ever shrinks someone's text.
   The header is re-measured because its line just changed height. */
function onBigTextChange(e) {
  document.documentElement.classList.toggle("bigtext", e.target.checked);
  saveJSON(storageKey("bigtext"), e.target.checked);
  syncHeaderHeight();
  render();                    // the timeline re-measures its blocks at the new size
}
function onVisibleRender() { if (!document.hidden) render(); }

/* main scrolls and bounces on its own; the page around it never scrolls,
   yet iOS will still rubber-band it when a drag lands on the header or the
   nav. Safari ignores overscroll-behavior for the page itself, so refuse
   those drags by hand. Touches that begin inside main, in the sheet, or on
   a control are left alone, and so is anything more sideways than vertical. */
const edgeTouch = {x: 0, y: 0, ignore: false};
function edgeTouchStart(e) {
  const t = e.touches && e.touches[0];
  if (!t) return;
  edgeTouch.x = t.clientX; edgeTouch.y = t.clientY;
  edgeTouch.ignore = !!(e.target && e.target.closest && e.target.closest("main, #sheetWrap, input, select, textarea"));
}
function edgeTouchMove(e) {
  if (edgeTouch.ignore || !e.touches || e.touches.length !== 1) return;
  const t = e.touches[0], dy = t.clientY - edgeTouch.y, dx = t.clientX - edgeTouch.x;
  if (Math.abs(dx) > Math.abs(dy)) return;
  const el = document.scrollingElement || document.documentElement;
  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + window.innerHeight >= el.scrollHeight - 1;
  if ((dy > 0 && atTop) || (dy < 0 && atBottom)) e.preventDefault();
}

export {
  render, renderMiniBar, updateClock, ARCHIVE_NOTICE_KEY, renderNotice, setTimeOverride, setOpeningTab,
  onSimChipClick, togglePick, onNavClick, onMiniBarClick, onBigTextChange, onVisibleRender,
  edgeTouchStart, edgeTouchMove,
};
