/* Loading, freshness and offline: what fetches the schedule and reaches the
   first draw, what builds the search indexes in idle time afterwards, what
   the header says about how fresh the copy is, and what offers a newer one -
   the update pill, the recheck on coming back, the worker's messages. It is
   below the shell, so it asks for the first draw over the bus, as a view
   does; and it holds the two functions that measure the header, because the
   freshness line is what changes the header's height, and the shell imports
   them from here. #updatePill is looked up as the module is imported, so the
   markup has to be there first. */
import { dayOf, fmtShort, minutesBetween, toDate } from "./util.js";
import { state } from "./state.js";
import { conEnded, DAY_LABEL, now } from "./time.js";
import { DATA_URL, events, meta, replaceSchedule } from "./data.js";
import { reconcilePicks } from "./picks.js";
import { buildIndex, buildSuggestIndex, index, SEARCH_PLACEHOLDER } from "./search.js";
import { requestRender } from "./bus.js";
import { queueBrowseRender } from "./browse.js";
import { applyExploreHash, buildCatalogue } from "./explore.js";

/* Set while a query is typed before the index exists; run when it does. */
let pendingQuery = false;
/* Boot timings, ms since navigation, for the times "is it faster" needs a
   number: data parsed, first screen drawn, index built, suggestions built. */
const BOOT = {parsed: 0, rendered: 0, indexed: 0, suggested: 0, indexAtRender: null};

let fromNetwork = null, servedOffline = false;

/* ==================================================================
   Loading
   ================================================================== */
async function load(data) {
  if (!data) {
    try {
      const r = await fetch(DATA_URL, {cache: "no-cache"});
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      fromNetwork = true;
    } catch (e) {
      /* Only reached with no worker at all: with one installed, a cached
         response resolves normally and the worker reports offline by message
         instead. This is the plain-browser, no-signal path. */
      try {
        const cached = await caches.match(DATA_URL, {ignoreSearch: true});
        if (cached) { data = await cached.json(); fromNetwork = false; }
      } catch (e2) { /* no Cache API: fall through to the empty state */ }
      if (!data) {
      document.getElementById("view-now").innerHTML =
        `<div class="empty"><b>No schedule data yet.</b><br>${DATA_URL} is missing or unreadable. Run <code>python scraper.py</code> in this folder, then reload.</div>`;
      return;
      }
    }
  }
  replaceSchedule(data);       // data.js: meta, events in start order, byId, tracks, hotelChips
  servedOffline = fromNetwork === false;
  BOOT.parsed = performance.now();
  buildCatalogue();
  applyExploreHash();          // a pasted #explore= link lands on its page
  reconcilePicks();            // picks that vanished or moved since they were starred
  updateFresh();
  requestRender();             // the first screen, before any index exists
  BOOT.rendered = performance.now();
  BOOT.indexAtRender = !!index;
  scheduleIndexBuild();
}

/* The search index is the slowest step of boot - about two seconds for
   3,500 events on a laptop, longer on a phone - and the first screen does
   not need it. So the tab on screen draws first and the index follows in
   idle time; the suggestion index (people and fandoms, for the chips under
   the search box) after that. A query typed before the index exists is
   held, and runs the moment it can. */
const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 2000}) : setTimeout(fn, 0));
function scheduleIndexBuild() {
  idle(() => {
    buildIndex();
    BOOT.indexed = performance.now();
    indexReady();
    idle(() => {
      buildSuggestIndex();
      BOOT.suggested = performance.now();
      if (state.tab === "browse" && state.browse.q.trim()) queueBrowseRender();   // the suggestion chips can show now
    });
  });
}
function indexReady() {
  const box = document.getElementById("q");
  if (box) { box.placeholder = SEARCH_PLACEHOLDER; box.classList.remove("indexing"); }
  if (pendingQuery) { pendingQuery = false; if (state.tab === "browse") queueBrowseRender(); }
}

function updateFresh() {
  const el = document.getElementById("fresh");
  if (!meta.generated_at) { el.textContent = ""; return; }
  /* After the con the copy is final; how long ago it was refreshed stops
     being the question. Under a simulated clock the copy can postdate the
     moment shown - "-1020 min ago" - so then it is named by when, not how
     long. */
  let fresh;
  if (conEnded()) fresh = `final<span class="word"> schedule</span>`;
  else {
    const at = toDate(meta.generated_at), ago = minutesBetween(at, now());
    const f = m => m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
    fresh = ago < 0 ? `<span class="word">refreshed </span>${DAY_LABEL[dayOf(at)] || ""} ${fmtShort(at)}`
                    : `<span class="word">refreshed </span>${f(ago)} ago`;
  }
  el.innerHTML = ` &middot; ${events.length.toLocaleString("en-US")} events &middot; ${fresh}`
    + (servedOffline ? " &middot; offline copy" : "");
  syncHeaderHeight();          // this line is what changes the header's height
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

/* ==================================================================
   Offline. The service worker keeps the app openable with no signal;
   this end only has to handle being told the schedule moved on.
   ================================================================== */

const updatePill = document.getElementById("updatePill");

function showUpdatePill() {
  /* Never re-render underneath someone mid-scroll: a schedule refresh that
     reshuffles rows while a thumb is moving costs them their place. Offer
     the reload, let them take it. */
  updatePill.classList.remove("settling");
  updatePill.style.transform = "";
  updatePill.style.opacity = "";
  updatePill.hidden = false;
}
function hideUpdatePill() {
  updatePill.hidden = true;
  updatePill.classList.remove("settling");
  updatePill.style.transform = "";
  updatePill.style.opacity = "";
}
/* Named so the smoke test can observe the intent; jsdom won't let
   location.reload be replaced. boot() takes a reload option for the same
   reason, and this is the one place it is called. */
let reload = () => location.reload();
function reloadNow() { reload(); }

/* Swipe it away if you'd rather keep reading. */
let pillY = null, pillDx = 0, pillDragged = false;

function onPillClick() { if (!pillDragged) reloadNow(); }
function onPillTouchStart(e) {
  pillY = e.touches[0].clientX; pillDx = 0; pillDragged = false;
  updatePill.classList.remove("settling");
}
function onPillTouchMove(e) {
  if (pillY === null) return;
  pillDx = e.touches[0].clientX - pillY;
  if (Math.abs(pillDx) > 6) pillDragged = true;
  updatePill.style.transform = `translateX(calc(-50% + ${pillDx}px))`;
  updatePill.style.opacity = String(Math.max(0, 1 - Math.abs(pillDx) / 160));
}
function onPillTouchEnd() {
  if (pillY === null) return;
  const dx = pillDx; pillY = null;
  updatePill.classList.add("settling");
  if (Math.abs(dx) > 60) { updatePill.style.opacity = "0"; setTimeout(hideUpdatePill, 200); }
  else { updatePill.style.transform = "translateX(-50%)"; updatePill.style.opacity = "1"; }
}

/* Coming back to the app after a while: check the schedule once, quietly.
   The service worker does the checking when there is one - a fetch of
   the schedule is served from cache and revalidated behind it, and the
   worker says if generated_at moved, which shows the pill above. Without
   a worker the fetch is real and we compare ourselves. Nothing re-renders
   under the reader either way; the pill offers the reload. Timers stop in
   the background too, so the freshness text is brought up to date first. */
const RECHECK_MS = 15 * 60000;
let lastScheduleCheck = 0;                   // boot() sets it: loading was a check
async function recheckSchedule() {
  updateFresh();
  if (now().getTime() - lastScheduleCheck < RECHECK_MS) return false;
  lastScheduleCheck = now().getTime();
  try {
    const r = await fetch(DATA_URL, {cache: "no-cache"});
    const viaWorker = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if (!viaWorker && r && r.ok) {
      const data = await r.json();
      if (data.generated_at && data.generated_at !== meta.generated_at) {
        meta.generated_at = data.generated_at;
        updateFresh();
        showUpdatePill();
      }
    }
  } catch (e) { /* no signal: nothing to say, the copy on screen stands */ }
  return true;
}

/* What boot() registers for the worker, when there is one, and for coming
   back to the app. */
function onWorkerMessage(e) {
  const t = e.data && e.data.type;
  if (t === "schedule-updated") {
    /* The worker hands over the new generated_at; the header can say how
       fresh the waiting copy is while the pill offers it. */
    if (e.data.generated_at) { meta.generated_at = e.data.generated_at; updateFresh(); }
    showUpdatePill();
  }
  /* The worker serves the cached schedule and then checks the network. Its
     verdict arrives after the page has already rendered, so the freshness
     line is corrected in place rather than guessed at load. */
  if (t === "schedule-offline") { servedOffline = true; updateFresh(); }
  if (t === "schedule-online") { servedOffline = false; updateFresh(); }
}
function onLoadRegisterWorker() {
  /* Don't swallow this. A worker that silently fails to register looks
     exactly like one that works until you turn the signal off. */
  navigator.serviceWorker.register("./sw.js").catch(err => {
    console.warn("Offline support unavailable:", err && err.message || err);
  });
}
function onVisibleRecheck() { if (document.visibilityState === "visible") recheckSchedule(); }
function onPageShow() { recheckSchedule(); }

/* A module that imports a let may not assign it, and three of these are
   assigned from outside: boot() takes the reload option and says that loading
   was a check, and the search box's input handler holds a query typed before
   the index exists. These are those three assignments. */
function setReload(fn) { reload = fn; }
function holdQuery() { pendingQuery = true; }
function markScheduleChecked() { lastScheduleCheck = now().getTime(); }

export {
  BOOT, load, updateFresh, fitHeaderLine, syncHeaderHeight, updatePill, hideUpdatePill,
  onPillClick, onPillTouchStart, onPillTouchMove, onPillTouchEnd, recheckSchedule,
  onWorkerMessage, onLoadRegisterWorker, onVisibleRecheck, onPageShow, setReload, holdQuery,
  markScheduleChecked,
};
