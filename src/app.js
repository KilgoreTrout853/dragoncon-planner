import { dayOf, esc, fmtMins, fmtShort, minutesBetween } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { IS_IOS } from "./platform.js";
import { devMarkHTML } from "./build.js";
import { state } from "./state.js";
import {
  CON, conEnded, DAY_LABEL, effectiveNow, initTimeOverride, isSimulated, now, setOverride,
} from "./time.js";
import { hotelVar, placeHTML } from "./venues.js";
import { byId, events, meta } from "./data.js";
import {
  clearNews, picks, reconcilePicks, replaceNews, replacePicks, savePickNews, savePicks,
} from "./picks.js";
import { follows, replaceFollows, saveFollows, toggleFollow } from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { currentLocation, leaveInfo, nextPickInConDay } from "./leave.js";
import { index, stripPhrase, tokenise } from "./search.js";
import {
  chipRowsRestore, chipRowsSnapshot, cssEsc, pageScrollBy, pageScrollTo, revealChip, scroller,
} from "./scroll.js";
import { setRenderer } from "./bus.js";
import {
  clearInstallPrompt, NUDGE_SNOOZE_MS, renderNow, setInstallPrompt, takeInstallPrompt, tickNow,
} from "./now.js";
import { cancelQueuedBrowseRender, queueBrowseRender, renderBrowse } from "./browse.js";
import {
  applyExploreHash, closeExplorePage, holdSpyUntil, markActiveSection, openExplorePage, queueSpy,
  renderExplore, renderExploreSections, scrollToExploreSection, scrollToGrid, spyDone,
  spyHoldUntil, syncActiveSection,
} from "./explore.js";
import { mapDay, renderMap, tickMap } from "./map.js";
import { renderMine } from "./mine.js";
import {
  closeSheet, eventSheetHTML, hotelSheetHTML, onCrowdInput, onNoiseDefaultChange, onResetPicks,
  onSettingsClick, onSheetTouchCancel, onSheetTouchEnd, onSheetTouchMove, onSheetTouchStart,
  openSheet, panelEvent, panelHotel, sheetEl, sheetWrap,
} from "./sheet.js";
import {
  BOOT, fitHeaderLine, holdQuery, load, markScheduleChecked, onLoadRegisterWorker, onPageShow,
  onPillClick, onPillTouchEnd, onPillTouchMove, onPillTouchStart, onVisibleRecheck,
  onWorkerMessage, recheckSchedule, setReload, syncHeaderHeight, updateFresh, updatePill,
} from "./loading.js";
/* ==================================================================
   Data & constants
   ================================================================== */

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
  if (reloadWith) setReload(reloadWith);

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
      if (index || !now.trim()) queueBrowseRender(); else holdQuery();
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

  sheetEl.addEventListener("touchstart", onSheetTouchStart, {passive: true});

  sheetEl.addEventListener("touchmove", onSheetTouchMove, {passive: true});

  sheetEl.addEventListener("touchend", onSheetTouchEnd);

  sheetEl.addEventListener("touchcancel", onSheetTouchCancel);

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
  document.getElementById("settingsBtn").addEventListener("click", onSettingsClick);
  document.getElementById("closeSheet").addEventListener("click", closeSheet);
  document.getElementById("sheetBack").addEventListener("click", closeSheet);
  document.getElementById("crowd").addEventListener("input", onCrowdInput);
  document.getElementById("noiseDefault").addEventListener("change", onNoiseDefaultChange);
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
  document.getElementById("resetPicks").addEventListener("click", onResetPicks);

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

  updatePill.addEventListener("click", onPillClick);

  updatePill.addEventListener("touchstart", onPillTouchStart, {passive: true});
  updatePill.addEventListener("touchmove", onPillTouchMove, {passive: true});
  updatePill.addEventListener("touchend", onPillTouchEnd);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    window.addEventListener("load", onLoadRegisterWorker);
  }

  markScheduleChecked();                   // loading was a check

  document.addEventListener("visibilitychange", onVisibleRecheck);
  window.addEventListener("pageshow", onPageShow);

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
  edgeTouchMove, edgeTouchStart, render, renderMiniBar, renderNotice, setTimeOverride,
  togglePick, updateClock,
};
