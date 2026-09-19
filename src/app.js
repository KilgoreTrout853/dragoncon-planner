import { dayOf, esc, fmtMins, fmtShort, minutesBetween, toDate } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { IS_IOS } from "./platform.js";
import { deviceLine, devMarkHTML } from "./build.js";
import { settings, state } from "./state.js";
import {
  CON, conEnded, DAY_LABEL, DAY_LONG, effectiveNow, initTimeOverride, isSimulated,
  localInputValue, now, setOverride, timeOverride,
} from "./time.js";
import { hotelVar, placeHTML, WALK } from "./venues.js";
import { byId, DATA_URL, events, isCeleb, meta, replaceSchedule } from "./data.js";
import {
  clearNews, picks, reconcilePicks, replaceNews, replacePicks, savePickNews, savePicks,
} from "./picks.js";
import { follows, replaceFollows, saveFollows, toggleFollow } from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { currentLocation, leaveInfo, nextPickInConDay } from "./leave.js";
import { buildIndex, buildSuggestIndex, index, SEARCH_PLACEHOLDER, stripPhrase, tokenise } from "./search.js";
import { CELEB_BADGE } from "./ui.js";
import {
  chipRowsRestore, chipRowsSnapshot, cssEsc, pageScrollBy, pageScrollTo, pageScrollTop,
  revealChip, scroller,
} from "./scroll.js";
import { setRenderer } from "./bus.js";
import {
  clearInstallPrompt, NUDGE_SNOOZE_MS, renderNow, setInstallPrompt, takeInstallPrompt, tickNow,
} from "./now.js";
import { cancelQueuedBrowseRender, queueBrowseRender, renderBrowse } from "./browse.js";
import {
  applyExploreHash, buildCatalogue, closeExplorePage, holdSpyUntil, markActiveSection,
  openExplorePage, queueSpy, renderExplore, renderExploreSections, scrollToExploreSection,
  scrollToGrid, spyDone, spyHoldUntil, syncActiveSection,
} from "./explore.js";
import { hotelSheetHTML, MAP_HOTELS, mapDay, renderMap, tickMap } from "./map.js";
import { renderMine } from "./mine.js";
/* ==================================================================
   Data & constants
   ================================================================== */

/* Set while a query is typed before the index exists; run when it does. */
let pendingQuery = false;
/* Boot timings, ms since navigation, for the times "is it faster" needs a
   number: data parsed, first screen drawn, index built, suggestions built. */
const BOOT = {parsed: 0, rendered: 0, indexed: 0, suggested: 0, indexAtRender: null};

let fromNetwork = null, servedOffline = false;

/* value: an ISO date-time, or null for the real clock. setOverride() in
   time.js sets it, keeps it for the session and keeps the URL in step; this
   is what the page does about a new moment. The day chips follow the clock
   again until tapped. */
function setTimeOverride(value) {
  setOverride(value);
  state.browse.day = null;
  state.map.day = null;
  render();
  updateFresh();                             // "refreshed 2 h ago" is relative to the clock too
}

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
  render();                    // the first screen, before any index exists
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
  ["now", "browse", "explore", "map", "mine"].forEach(t => document.getElementById(`view-${t}`).hidden = t !== state.tab);
  const badge = document.getElementById("mineBadge");
  badge.hidden = picks.size === 0; badge.textContent = picks.size;
  if (!events.length) return;
  const rows = chipRowsSnapshot();
  if (state.tab === "now") renderNow();
  if (state.tab === "browse") renderBrowse();
  if (state.tab === "explore") renderExplore();
  if (state.tab === "map") renderMap();
  if (state.tab === "mine") renderMine();
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
  const info = leaveInfo(currentLocation(at), next, at);
  const when = info && info.leaveBy
    ? (info.late ? "leave now" : `leave by ${fmtShort(info.leaveBy)}`)
    : `in ${fmtMins(minutesBetween(at, next._s))}`;
  bar.classList.toggle("late", !!(info && info.late));
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

/* The header line must not clip: if it would, hide the word "refreshed"
   and measure again. jsdom reports no widths, so this is a no-op there. */
function fitHeaderLine() {
  const line = document.querySelector(".hdr-line");
  if (!line) return;
  line.classList.remove("tight", "tighter");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tight");
  if (line.scrollWidth > line.clientWidth) line.classList.add("tighter");
}

/* ---- The notice above the views ------------------------------------ */
/* After the con: that it is over, on every tab, until dismissed - once,
   and remembered for that year. Before it: the preview banner. Live:
   nothing. */
const ARCHIVE_NOTICE_KEY = "dc26.archiveNoticeDismissed";
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

/* Bottom sheet: one wrapper, three panels (settings, event, hotel) */
const sheetWrap = document.getElementById("sheetWrap");
const sheetEl = document.getElementById("sheet");
const panelSettings = document.getElementById("panel-settings");
const panelEvent = document.getElementById("panel-event");
const panelHotel = document.getElementById("panel-hotel");
let sheetScrollY = 0;

function fillSettings() {
  document.getElementById("crowd").value = settings.crowd;
  document.getElementById("crowdLabel").textContent = `${settings.crowd.toFixed(1)}x`;
  document.getElementById("noiseDefault").checked = settings.hideNoise;
  document.getElementById("bigText").checked = document.documentElement.classList.contains("bigtext");
  document.getElementById("previewTime").value = timeOverride ? localInputValue(timeOverride) : "";
  document.getElementById("walkTable").innerHTML = Object.entries(WALK).map(([k, v]) => `<tr><td>${esc(k.replace("|", " to "))}</td><td>${v}</td></tr>`).join("");
  document.getElementById("deviceLine").textContent = deviceLine();
}

function eventSheetHTML(ev) {
  const mine = picks.has(ev.id);
  const peopleRows = (ev.speakers || []).filter(p => p && p.name).map(p => ({
    name: p.name,
    label: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? `${p.name} (${p.role.toLowerCase()})` : p.name,
  }));
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...((ev.tags && ev.tags.fandoms) || [])];
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${isCeleb(ev) ? `<div>${CELEB_BADGE}</div>` : ""}
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleRows.length ? `<div class="ev-people">With ${peopleRows.map(p =>
        `<span class="who"><span>${esc(p.label)}</span> <button class="see-all" data-explore="person:${esc(p.name)}">See all</button></span>`).join(", ")}</div>` : ""}
      ${chips.length || (ev.tags && ev.tags.adult) ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${ev.tags && ev.tags.adult ? `<span class="tag adult">18+</span>` : ""}</div>` : ""}
    </div>
    <div class="ev-actions">
      <button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}">${mine ? "★" : "☆"}</button>
      <button class="btn quiet" id="sheetICS">Add this to calendar</button>
      <button class="btn" id="closeSheetEvent">Done</button>
    </div>`;
}

function openSheet(kind = "settings", id = null) {
  if (kind === "event" && !byId.get(id)) return;
  if (kind === "hotel" && !MAP_HOTELS[id]) return;
  sheetScrollY = pageScrollTop();
  state.sheetId = kind === "event" ? id : null;
  state.sheetHotel = kind === "hotel" ? id : null;
  if (kind === "event") panelEvent.innerHTML = eventSheetHTML(byId.get(id));
  else if (kind === "hotel") panelHotel.innerHTML = hotelSheetHTML(id, mapDay());
  else fillSettings();
  panelSettings.hidden = kind !== "settings";
  panelEvent.hidden = kind !== "event";
  panelHotel.hidden = kind !== "hotel";
  sheetEl.setAttribute("aria-labelledby", {event: "sheetTitleEvent", hotel: "sheetTitleHotel"}[kind] || "sheetTitle");
  sheetEl.style.transform = "";
  sheetWrap.hidden = false;
}

function closeSheet() {
  sheetWrap.hidden = true;
  state.sheetId = null;
  state.sheetHotel = null;
  sheetEl.classList.remove("settling");
  sheetEl.style.transform = "";
  sheetBackEl.style.opacity = "";
  sheetBackEl.classList.remove("dragging");
  dragY = null;
  render();
  pageScrollTo(sheetScrollY);
}

/* Swipe down to dismiss.
   The sheet claims the gesture via touch-action, so the page behind it stays
   put; the backdrop fades with the drag so the sheet feels attached to it. */
const sheetBackEl = document.getElementById("sheetBack");
let dragY = null, dragT = 0, dragDy = 0;

function setDrag(dy) {
  dragDy = dy;
  sheetEl.style.transform = dy ? `translateY(${dy}px)` : "";
  const h = sheetEl.offsetHeight || 1;
  sheetBackEl.style.opacity = String(Math.max(0, 1 - (dy / h) * 0.9));
}
function settle(toClosed) {
  sheetEl.classList.add("settling");
  sheetBackEl.classList.remove("dragging");
  if (toClosed) {
    sheetEl.style.transform = `translateY(${sheetEl.offsetHeight}px)`;
    sheetBackEl.style.opacity = "0";
    const done = () => { sheetEl.removeEventListener("transitionend", done); closeSheet(); };
    sheetEl.addEventListener("transitionend", done);
    setTimeout(done, 320);            // belt and braces if the transition never fires
  } else {
    setDrag(0);
    setTimeout(() => sheetEl.classList.remove("settling"), 240);
  }
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

/* ==================================================================
   Boot. Everything above is declarations, and the consts that read storage
   and the DOM as the module is imported. Nothing else happens until boot()
   is called - once, by src/main.js - and then it happens in the order it
   always did: listeners on one element fire in the order they were added,
   so the statements below keep the file order they had when they ran as
   the script parsed.

   events: the schedule, already parsed. load() uses it instead of fetching,
   and still reaches the first render() with no await on the way.
   reload: what reloadNow() calls, for a caller that cannot replace
   location.reload. The option names are the contract; the locals are
   renamed because events and reload are the module's own names too.

   The handle is state and operations, never internals. ready is load()'s
   promise.
   ================================================================== */
export function boot({events: data, reload: reloadWith} = {}) {
  setRenderer(render);         // first: a view asks for a redraw over the bus, and it throws until this has run
  if (reloadWith) reload = reloadWith;

  document.documentElement.classList.toggle("bigtext", !!loadJSON("dc26.bigtext", false));
  document.body.insertAdjacentHTML("beforeend", devMarkHTML());
  initTimeOverride();

  scroller.addEventListener("scroll", () => {
    if (!queueSpy()) return;
    requestAnimationFrame(() => {
      spyDone();
      if (performance.now() < spyHoldUntil) return;
      syncActiveSection();
    });
  }, {passive: true});

  document.querySelector(".nav").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    state.tab = b.dataset.tab; render(); pageScrollTo(0);
  });

  document.querySelector("main").addEventListener("click", e => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const {chip: kind, value} = chip.dataset;
      if (kind === "now-hotel") { state.now.hotel = value; state.now.limit = 80; }
      else if (kind === "day") state.browse.day = value;
      else if (kind === "hotel") state.browse.hotel = state.browse.hotel === value ? "All" : value;
      else if (kind === "type") state.browse.type = value;
      else if (kind === "kind") state.browse.kind = value;
      else if (kind === "map-day") state.map.day = value;
      state.browse.page = 1; render();
      revealChip(document.querySelector(`.chips [data-chip="${kind}"][data-value="${cssEsc(value)}"]`));
      return;
    }
    const mapHotel = e.target.closest(".map-hotel, .map-pill");
    if (mapHotel) { openSheet("hotel", mapHotel.dataset.hotel); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "more-now") { state.now.limit += 100; render(); }
      if (a === "more-browse") { state.browse.page++; render(); }
      if (a === "ics") exportICS();
      if (a === "clear" && confirm("Remove everything from my schedule?")) { replacePicks([]); savePicks(); render(); }
      if (a === "suggest") {
        state.browse.q = `"${act.dataset.name}"`;
        state.browse.page = 1;
        if (state.browse.day !== "All") { state.browse.prevDay = state.browse.day; state.browse.day = "All"; }
        render();
        return;
      }
      if (a === "unsuggest") {
        state.browse.q = "";
        if (state.browse.prevDay) { state.browse.day = state.browse.prevDay; state.browse.prevDay = null; }
        state.browse.page = 1;
        render();
        return;
      }
      if (a === "toggle-past") { state.browse.showPast = !state.browse.showPast; render(); return; }
      if (a === "dismiss-news") { clearNews(); savePickNews(); render(); return; }
      if (a === "dismiss-archive") { saveJSON(ARCHIVE_NOTICE_KEY, CON.year); render(); return; }
      if (a === "nudge-later") { saveJSON("dc26.nudgeSnoozedUntil", now().getTime() + NUDGE_SNOOZE_MS); render(); return; }
      if (a === "nudge-install") {
        const p = takeInstallPrompt(); if (p) p.prompt();
        return;
      }
      if (a === "explore-back") { closeExplorePage(); return; }
      if (a === "fol-add") { scrollToGrid(); return; }
      if (a === "explore-jump") {
        markActiveSection(act.dataset.section);
        holdSpyUntil(performance.now() + 700);
        scrollToExploreSection(act.dataset.section);
        return;
      }
      if (a === "explore-all") { state.explore.expanded[act.dataset.section] = true; renderExploreSections(); return; }
      if (a === "fol-toggle") {
        state.following.open = state.following.open === false;
        saveJSON("dc26.followingOpen", state.following.open);
        render();
        return;
      }
      if (a === "unfollow") {
        const raw = act.dataset.follow || "", i = raw.indexOf(":");
        if (i > 0) { toggleFollow(raw.slice(0, i), raw.slice(i + 1)); render(); }
        return;
      }
      if (a === "fol-interest" || a === "fol-time") {
        state.following.layout = a === "fol-time" ? "time" : "interest";
        saveJSON("dc26.followingLayout", state.following.layout);
        render();
        return;
      }
      if (a === "fol-more") { state.following.expanded[act.dataset.follow] = true; render(); return; }
      if (a === "fol-past") {
        const k = act.dataset.follow;
        state.following.showPast[k] = !state.following.showPast[k];
        render();
        return;
      }
      if (a === "explore-past") { state.explore.showPast = !state.explore.showPast; render(); return; }
      if (a === "toggle-follow") {
        const pg = state.explore.page;
        if (pg) { toggleFollow(pg.kind, pg.key); render(); }
        return;
      }
      if (a === "show-hidden") { state.browse.showHidden = true; state.browse.page = 1; render(); return; }
      if (a === "unparse-today") { state.browse.noToday = true; state.browse.page = 1; render(); return; }
      if (a === "unparse") {
        const stripped = stripPhrase(tokenise(state.browse.q), act.dataset.src || "");
        state.browse.q = (stripped || tokenise(state.browse.q)).join(" ");
        state.browse.page = 1;
        render();
        return;
      }
      if (a === "view-timeline" || a === "view-list") {
        state.mineView = a === "view-timeline" ? "timeline" : "list";
        saveJSON("dc26.mineView", state.mineView); render();
      }
      return;
    }
    const star = e.target.closest(".star");
    if (star) { const li = star.closest(".row"); togglePick(li.dataset.id, li); return; }
    const tile = e.target.closest("[data-explore]");
    if (tile) {
      const raw = tile.dataset.explore, i = raw.indexOf(":");
      if (i > 0) openExplorePage(raw.slice(0, i), raw.slice(i + 1));
      return;
    }
    const hero = e.target.closest("[data-hero]");
    if (hero) { openSheet("event", hero.dataset.hero); return; }
    const main = e.target.closest(".row-main");
    if (main) openSheet("event", main.closest(".row").dataset.id);
  });

  document.querySelector("main").addEventListener("input", e => {
    if (e.target.id === "exploreQ") { state.explore.q = e.target.value; renderExploreSections(); return; }
    if (e.target.id === "q") {
      const was = state.browse.q.trim(), now = e.target.value;
      state.browse.q = now;
      /* Both are answers to the last question, not standing preferences. */
      state.browse.showHidden = false;
      state.browse.showPast = false;
      state.browse.noToday = false;
      if (!was && now.trim()) { state.browse.prevDay = state.browse.day; state.browse.day = "All"; }
      else if (was && !now.trim() && state.browse.prevDay) { state.browse.day = state.browse.prevDay; state.browse.prevDay = null; }
      state.browse.page = 1;
      /* Rebuilding Browse costs ~120KB of HTML and 2,000 nodes. Doing that on
         every keystroke makes typing lag on a phone; the query itself is already
         recorded, so only the drawing waits. Before the index exists a query
         cannot run at all: hold it, and indexReady() queues it. */
      if (index || !now.trim()) queueBrowseRender(); else pendingQuery = true;
    }
  });
  /* The keyboard's return key reads Search and puts the keyboard away. */
  document.querySelector("main").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target && e.target.id === "q") { e.preventDefault(); e.target.blur(); }
    const block = (e.key === "Enter" || e.key === " ") && e.target && e.target.closest && e.target.closest(".map-hotel");
    if (block) { e.preventDefault(); openSheet("hotel", block.dataset.hotel); }
  });
  document.querySelector("main").addEventListener("change", e => {
    if (e.target.id === "track") { state.browse.track = e.target.value; state.browse.page = 1; render(); }
    if (e.target.id === "fandom") { state.browse.fandom = e.target.value; state.browse.page = 1; render(); }
    if (e.target.id === "hideNoise") { state.browse.hideNoise = e.target.checked; state.browse.page = 1; render(); }
  });

  sheetEl.addEventListener("touchstart", e => {
    if (e.target.closest(".ev-body")) return;   // let the description scroll
    dragY = e.touches[0].clientY;
    dragT = performance.now();
    dragDy = 0;
    sheetEl.classList.remove("settling");
    sheetBackEl.classList.add("dragging");
  }, {passive: true});

  sheetEl.addEventListener("touchmove", e => {
    if (dragY === null) return;
    const dy = e.touches[0].clientY - dragY;
    setDrag(dy > 0 ? dy : dy / 4);              // slight resistance upward
  }, {passive: true});

  sheetEl.addEventListener("touchend", () => {
    if (dragY === null) return;
    const dy = dragDy, ms = performance.now() - dragT;
    dragY = null;
    /* Below about one frame we have no reliable velocity, so don't invent one -
       fall back to distance alone rather than treating a 30px nudge as a flick. */
    const v = ms >= 16 ? dy / ms : 0;
    const flicked = dy > 40 && v > 0.6;
    settle(dy > 70 || flicked);
  });

  sheetEl.addEventListener("touchcancel", () => { if (dragY !== null) { dragY = null; settle(false); } });

  panelEvent.addEventListener("click", e => {
    const seeAll = e.target.closest("[data-explore]");
    if (seeAll) {
      const raw = seeAll.dataset.explore, i = raw.indexOf(":");
      closeSheet();
      if (i > 0) openExplorePage(raw.slice(0, i), raw.slice(i + 1));
      return;
    }
    if (e.target.closest("#closeSheetEvent")) { closeSheet(); return; }
    const ev = byId.get(state.sheetId);
    if (!ev) return;
    if (e.target.closest("#sheetICS")) { exportEventICS(ev); return; }
    if (e.target.closest("#sheetStar")) {
      if (picks.has(ev.id)) picks.delete(ev.id); else picks.add(ev.id);
      savePicks();
      panelEvent.innerHTML = eventSheetHTML(ev);
    }
  });

  /* The hotel sheet: its rows work like rows anywhere, and an empty hotel
     offers the search that would fill it. */
  panelHotel.addEventListener("click", e => {
    const search = e.target.closest('[data-act="map-search"]');
    if (search) {
      const {hotel, day} = search.dataset;
      Object.assign(state.browse, {q: "", day, prevDay: null, hotel, page: 1, showHidden: false, showPast: false, noToday: false});
      state.tab = "browse";
      closeSheet();
      pageScrollTo(0);
      return;
    }
    if (e.target.closest("#closeSheetHotel")) { closeSheet(); return; }
    if (!state.sheetHotel) return;
    const star = e.target.closest(".star");
    if (star) {
      togglePick(star.closest(".row").dataset.id);
      panelHotel.innerHTML = hotelSheetHTML(state.sheetHotel, mapDay());
      return;
    }
    const main = e.target.closest(".row-main");
    if (main) openSheet("event", main.closest(".row").dataset.id);
  });

  document.getElementById("minibar").addEventListener("click", () => { state.tab = "now"; render(); pageScrollTo(0); });
  document.getElementById("settingsBtn").addEventListener("click", () => openSheet("settings"));
  document.getElementById("closeSheet").addEventListener("click", closeSheet);
  document.getElementById("sheetBack").addEventListener("click", closeSheet);
  document.getElementById("crowd").addEventListener("input", e => { settings.crowd = parseFloat(e.target.value); document.getElementById("crowdLabel").textContent = `${settings.crowd.toFixed(1)}x`; saveJSON("dc26.settings", settings); });
  document.getElementById("noiseDefault").addEventListener("change", e => { settings.hideNoise = e.target.checked; state.browse.hideNoise = settings.hideNoise; saveJSON("dc26.settings", settings); });
  /* Its own key, so nothing that resets settings ever shrinks someone's text.
     The header is re-measured because its line just changed height. */
  document.getElementById("bigText").addEventListener("change", e => {
    document.documentElement.classList.toggle("bigtext", e.target.checked);
    saveJSON("dc26.bigtext", e.target.checked);
    syncHeaderHeight();
    render();                    // the timeline re-measures its blocks at the new size
  });
  document.getElementById("applyPreview").addEventListener("click", () => { const v = document.getElementById("previewTime").value; closeSheet(); if (v) setTimeOverride(v); });
  document.getElementById("clearPreview").addEventListener("click", () => { closeSheet(); setTimeOverride(null); });
  document.getElementById("simChip").addEventListener("click", () => setTimeOverride(null));
  document.getElementById("resetPicks").addEventListener("click", () => { if (confirm("Remove everything from my schedule?")) { replacePicks([]); savePicks(); closeSheet(); } });

  window.addEventListener("hashchange", () => { applyExploreHash(); render(); });

  setInterval(() => {
    updateClock();
    renderNotice();              // the con can end on a tick
    if (state.tab === "now" && sheetWrap.hidden) tickNow();
    else if (state.tab === "map" && sheetWrap.hidden) { tickMap(); renderMiniBar(); }
    else renderMiniBar();
    updateFresh();
  }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

  /* Measure at the moments the header is known to change, not only through an
     observer: ResizeObserver is delivered on the rendering lifecycle, so a page
     that isn't painting - a background tab, a hidden view - never hears about
     it. The first measurement also lands before the freshness line has any
     text, which is 17px short. */
  requestAnimationFrame(syncHeaderHeight);
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("orientationchange", syncHeaderHeight);
  window.addEventListener("load", syncHeaderHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight).catch(() => {});
  if (window.ResizeObserver) {
    const hdr = document.querySelector(".hdr");
    if (hdr) new ResizeObserver(syncHeaderHeight).observe(hdr);
  }

  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); setInstallPrompt(e); if (state.tab === "now") render(); });
  window.addEventListener("appinstalled", () => { clearInstallPrompt(); render(); });

  if (IS_IOS) {
    document.addEventListener("touchstart", edgeTouchStart, {passive: true});
    document.addEventListener("touchmove", edgeTouchMove, {passive: false});
    /* iOS 26 hands a home-screen web app a bottom inset of about 90px, nearly
       three times the home indicator, and draws nothing in the difference. Take
       the indicator's height and no more; Android's insets are real and stay. */
    document.documentElement.style.setProperty("--safe-bottom", "min(env(safe-area-inset-bottom, 0px), 34px)");
  }

  updatePill.addEventListener("click", () => { if (!pillDragged) reloadNow(); });

  updatePill.addEventListener("touchstart", e => {
    pillY = e.touches[0].clientX; pillDx = 0; pillDragged = false;
    updatePill.classList.remove("settling");
  }, {passive: true});
  updatePill.addEventListener("touchmove", e => {
    if (pillY === null) return;
    pillDx = e.touches[0].clientX - pillY;
    if (Math.abs(pillDx) > 6) pillDragged = true;
    updatePill.style.transform = `translateX(calc(-50% + ${pillDx}px))`;
    updatePill.style.opacity = String(Math.max(0, 1 - Math.abs(pillDx) / 160));
  }, {passive: true});
  updatePill.addEventListener("touchend", () => {
    if (pillY === null) return;
    const dx = pillDx; pillY = null;
    updatePill.classList.add("settling");
    if (Math.abs(dx) > 60) { updatePill.style.opacity = "0"; setTimeout(hideUpdatePill, 200); }
    else { updatePill.style.transform = "translateX(-50%)"; updatePill.style.opacity = "1"; }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => {
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
    });
    window.addEventListener("load", () => {
      /* Don't swallow this. A worker that silently fails to register looks
         exactly like one that works until you turn the signal off. */
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.warn("Offline support unavailable:", err && err.message || err);
      });
    });
  }

  lastScheduleCheck = now().getTime();     // loading was a check

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheckSchedule(); });
  window.addEventListener("pageshow", () => { recheckSchedule(); });

  const ready = load(data);
  return {
    state, render, now, setTimeOverride,
    picks: {get: () => picks, set: ids => { replacePicks(ids); savePicks(); }},
    follows: {get: () => follows, set: list => { replaceFollows(list); saveFollows(); }},
    news: {set: list => { replaceNews(list); savePickNews(); }, clear: () => { clearNews(); savePickNews(); }},
    get meta() { return meta; },
    get events() { return events; },
    BOOT, reconcilePicks, recheckSchedule, openSheet, closeSheet, ready,
  };
}

/* What is left of the test surface: the functions and consts still in this
   file that a test reaches by name - through the merged namespace the page
   helper builds (tests/helpers/page.js), or a unit test's import. A name
   leaves this list in the commit that moves it to a module of its own, which
   exports it from there. The lets are not here - a test reaches those
   through boot()'s handle - and nor is reloadNow, which the reload option
   replaces. */
export {
  closeSheet, edgeTouchMove, edgeTouchStart, hideUpdatePill, indexReady, openSheet,
  recheckSchedule, render, renderMiniBar, renderNotice, setDrag, setTimeOverride, showUpdatePill,
  togglePick, updateClock, updateFresh,

  BOOT,
};
