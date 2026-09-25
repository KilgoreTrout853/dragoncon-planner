/* Dispatch: the handlers whose bodies reach across modules, so that no one
   module below could hold them. The four delegated listeners on main - click,
   input, keydown, change - which are about whatever view is on screen; the
   clicks inside the sheet's event and hotel panels; Apply and Clear for the
   preview clock; the hash; and the minute tick. boot() registers all ten. It
   is last in the order: it imports the views, the sheet, loading and the
   shell, and nothing imports it but the root. It declares nothing but the
   handlers and reads nothing as it is imported. */
import { saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { state } from "./state.js";
import { CON, now } from "./time.js";
import { byId } from "./data.js";
import { clearNews, picks, replacePicks, savePickNews, savePicks } from "./picks.js";
import { toggleFollow } from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { index, stripPhrase, tokenise } from "./search.js";
import { cssEsc, pageScrollTo, revealChip } from "./scroll.js";
import { NUDGE_SNOOZE_MS, takeInstallPrompt, tickNow } from "./now.js";
import { queueBrowseRender } from "./browse.js";
import {
  applyExploreHash, closeExplorePage, holdSpyUntil, markActiveSection, openExplorePage,
  renderExploreSections, scrollToExploreSection, scrollToGrid,
} from "./explore.js";
import { mapDay, tickMap } from "./map.js";
import {
  closeSheet, eventSheetHTML, hotelSheetHTML, openSheet, panelEvent, panelHotel, sheetWrap,
} from "./sheet.js";
import { holdQuery, updateFresh } from "./loading.js";
import {
  ARCHIVE_NOTICE_KEY, render, renderMiniBar, renderNotice, setTimeOverride, togglePick,
  updateClock,
} from "./shell.js";

function onMainClick(e) {
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
    if (a === "nudge-later") { saveJSON(storageKey("nudgeSnoozedUntil"), now().getTime() + NUDGE_SNOOZE_MS); render(); return; }
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
      saveJSON(storageKey("followingOpen"), state.following.open);
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
      saveJSON(storageKey("followingLayout"), state.following.layout);
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
    if (a === "explore-cast") { state.explore.showCast = !state.explore.showCast; render(); return; }
    if (a === "explore-cast-noise") { state.explore.castNoise = true; render(); return; }
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
      saveJSON(storageKey("mineView"), state.mineView); render();
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
}

function onMainInput(e) {
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
}
/* The keyboard's return key reads Search and puts the keyboard away. */
function onMainKeydown(e) {
  if (e.key === "Enter" && e.target && e.target.id === "q") { e.preventDefault(); e.target.blur(); }
  const block = (e.key === "Enter" || e.key === " ") && e.target && e.target.closest && e.target.closest(".map-hotel");
  if (block) { e.preventDefault(); openSheet("hotel", block.dataset.hotel); }
}
function onMainChange(e) {
  if (e.target.id === "track") { state.browse.track = e.target.value; state.browse.page = 1; render(); }
  if (e.target.id === "fandom") { state.browse.work = e.target.value; state.browse.page = 1; render(); }
  if (e.target.id === "hideNoise") { state.browse.hideNoise = e.target.checked; state.browse.page = 1; render(); }
}

function onEventPanelClick(e) {
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
}

/* The hotel sheet: its rows work like rows anywhere, and an empty hotel
   offers the search that would fill it. */
function onHotelPanelClick(e) {
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
}

function onApplyPreview() { const v = document.getElementById("previewTime").value; closeSheet(); if (v) setTimeOverride(v); }
function onClearPreview() { closeSheet(); setTimeOverride(null); }

function onHashChange() { applyExploreHash(); render(); }

function onMinute() {
  updateClock();
  renderNotice();              // the con can end on a tick
  if (state.tab === "now" && sheetWrap.hidden) tickNow();
  else if (state.tab === "map" && sheetWrap.hidden) { tickMap(); renderMiniBar(); }
  else renderMiniBar();
  updateFresh();
}

export {
  onMainClick, onMainInput, onMainKeydown, onMainChange, onEventPanelClick, onHotelPanelClick,
  onApplyPreview, onClearPreview, onHashChange, onMinute,
};
