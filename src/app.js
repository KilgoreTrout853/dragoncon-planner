import { loadJSON, saveJSON } from "./storage.js";
import { IS_IOS } from "./platform.js";
import { devMarkHTML } from "./build.js";
import { state } from "./state.js";
import { CON, initTimeOverride, now } from "./time.js";
import { byId, events, meta } from "./data.js";
import {
  clearNews, picks, reconcilePicks, replaceNews, replacePicks, savePickNews, savePicks,
} from "./picks.js";
import { follows, replaceFollows, saveFollows, toggleFollow } from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { index, stripPhrase, tokenise } from "./search.js";
import { cssEsc, pageScrollTo, revealChip, scroller } from "./scroll.js";
import { setRenderer } from "./bus.js";
import { NUDGE_SNOOZE_MS, onAppInstalled, onBeforeInstallPrompt, takeInstallPrompt, tickNow } from "./now.js";
import { queueBrowseRender } from "./browse.js";
import {
  applyExploreHash, closeExplorePage, holdSpyUntil, markActiveSection, onScrollSpy,
  openExplorePage, renderExploreSections, scrollToExploreSection, scrollToGrid,
} from "./explore.js";
import { mapDay, tickMap } from "./map.js";
import {
  closeSheet, eventSheetHTML, hotelSheetHTML, onCrowdInput, onNoiseDefaultChange, onResetPicks,
  onSettingsClick, onSheetTouchCancel, onSheetTouchEnd, onSheetTouchMove, onSheetTouchStart,
  openSheet, panelEvent, panelHotel, sheetEl, sheetWrap,
} from "./sheet.js";
import {
  BOOT, holdQuery, load, markScheduleChecked, onLoadRegisterWorker, onPageShow, onPillClick,
  onPillTouchEnd, onPillTouchMove, onPillTouchStart, onVisibleRecheck, onWorkerMessage,
  recheckSchedule, setReload, syncHeaderHeight, updateFresh, updatePill,
} from "./loading.js";
import {
  ARCHIVE_NOTICE_KEY, edgeTouchMove, edgeTouchStart, onBigTextChange, onMiniBarClick, onNavClick,
  onSimChipClick, onVisibleRender, render, renderMiniBar, renderNotice, setTimeOverride,
  togglePick, updateClock,
} from "./shell.js";

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

  scroller.addEventListener("scroll", onScrollSpy, {passive: true});

  document.querySelector(".nav").addEventListener("click", onNavClick);

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

  document.getElementById("minibar").addEventListener("click", onMiniBarClick);
  document.getElementById("settingsBtn").addEventListener("click", onSettingsClick);
  document.getElementById("closeSheet").addEventListener("click", closeSheet);
  document.getElementById("sheetBack").addEventListener("click", closeSheet);
  document.getElementById("crowd").addEventListener("input", onCrowdInput);
  document.getElementById("noiseDefault").addEventListener("change", onNoiseDefaultChange);
  document.getElementById("bigText").addEventListener("change", onBigTextChange);
  document.getElementById("applyPreview").addEventListener("click", () => { const v = document.getElementById("previewTime").value; closeSheet(); if (v) setTimeOverride(v); });
  document.getElementById("clearPreview").addEventListener("click", () => { closeSheet(); setTimeOverride(null); });
  document.getElementById("simChip").addEventListener("click", onSimChipClick);
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
  document.addEventListener("visibilitychange", onVisibleRender);

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

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

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

};
