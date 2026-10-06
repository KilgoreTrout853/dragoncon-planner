/* Dispatch: the handlers whose bodies reach across modules, so that no one
   module below could hold them. The five delegated listeners on main - click,
   input, keydown, change, focusout - which are about whatever view is on
   screen; the clicks inside the sheet's event, hotel and shared-day panels,
   and the clicks and changes inside its filter panel; Apply and Clear for
   the preview clock; the hash; and the minute tick. boot() registers all
   fourteen. It
   is last in the order: it imports the views, the event's panel, the sheet,
   loading and the shell, and nothing imports it but the root. It declares nothing but the
   handlers and reads nothing as it is imported. */
import { saveJSON } from "./storage.js";
import { storageKey } from "./build.js";
import { state } from "./state.js";
import { CON, now } from "./time.js";
import { byId } from "./data.js";
import { clearNews, picks, savePickNews, savePicks } from "./picks.js";
import { isMuted, toggleFollow, toggleMute } from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { dropPhrase, index } from "./search.js";
import { cssEsc, pageScrollTo, revealChip } from "./scroll.js";
import { runSync } from "./sync.js";
import { NUDGE_SNOOZE_MS, takeInstallPrompt, tickNow } from "./now.js";
import { queueBrowseRender } from "./browse.js";
import {
  applyExploreHash, closeExplorePage, holdSpyUntil, markActiveSection, openExplorePage,
  renderExploreSections, scrollToExploreSection, scrollToGrid,
} from "./explore.js";
import { showOnMap, tickMap } from "./map.js";
import { toggleInPlace } from "./inplace.js";
import { refreshEventSheet } from "./eventsheet.js";
import {
  closeSheet, closeWholeSheet, drawHotelSheet, openSheet, panelFilters, sheetWrap, showHotelCrew,
} from "./sheet.js";
import { holdQuery, updateFresh } from "./loading.js";
import { clearFilters, fillFilters, setFilter, settleWords } from "./filters.js";
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
    else if (kind === "map-day") { state.map.day = value; state.map.focus = null; }   // a day chosen ends the Map's focus (#75)
    else if (kind === "plans-day") state.plans.day = value;
    state.browse.page = 1; render();
    revealChip(document.querySelector(`.chips [data-chip="${kind}"][data-value="${cssEsc(value)}"]`));
    return;
  }
  /* A hotel on the Map, or either of its pills: its sheet - and from the
     crew's pill, its crew brought to the top (#63). */
  const mapHotel = e.target.closest(".map-hotel, .map-pill, .map-crew");
  if (mapHotel) {
    openSheet("hotel", mapHotel.dataset.hotel);
    if (mapHotel.matches(".map-crew")) showHotelCrew();
    return;
  }
  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    /* Plans' crew header opens the crew panel on a step; the segment is
       saved when tapped, and Crew starts a sync run for what the crew has
       done since (docs/sync/contract.md, section 5). */
    if (a === "crew-manage" || a === "crew-create" || a === "crew-join") { openSheet("crew", a.slice("crew-".length)); return; }
    /* My day's Share a day: its panel (W25). */
    if (a === "share-day") { openSheet("share"); return; }
    /* Search's Filters: the filter sheet (W13, #70). */
    if (a === "filters") { openSheet("filters"); return; }
    if (a === "plans-mine" || a === "plans-crew") {
      state.plansView = a === "plans-crew" ? "crew" : "mine";
      saveJSON(storageKey("plansView"), state.plansView);
      render();
      if (state.plansView === "crew") runSync();
      return;
    }
    /* Now's "+N more" of the crew: Plans' crew's day, today, as a tap on
       its Crew segment would have it - saved, and a sync run - with focus
       on that segment, since the tab it was tapped on is hidden now. */
    if (a === "crew-more") {
      state.tab = "plans";
      state.plansView = "crew";
      saveJSON(storageKey("plansView"), state.plansView);
      state.plans.day = null;
      render();
      pageScrollTo(0);
      const crew = document.getElementById("plansViewCrew");
      if (crew) crew.focus({preventScroll: true});
      runSync();
      return;
    }
    if (a === "more-now") { state.now.limit += 100; render(); }
    if (a === "more-browse") { state.browse.page++; render(); }
    if (a === "ics") exportICS();
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
    if (a === "browse-cast") { state.browse.castOpen = !state.browse.castOpen; render(); return; }
    if (a === "dismiss-news") { clearNews(); savePickNews(); render(); return; }
    /* A fold under the notice, what is on in place of a pick: opened or
       shut, its rows held as they were (#90). */
    if (a === "in-place") { toggleInPlace(Number(act.dataset.fold)); render(); return; }
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
    /* For you's Show more: the rest of the list held, in place (#87). */
    if (a === "foryou-more") { if (state.explore.forYou) state.explore.forYou.more = true; render(); return; }
    /* The big ones' Show all: the rest of the list held, in place (#88). */
    if (a === "zero-all") { if (state.explore.forYou && state.explore.forYou.zero) state.explore.forYou.zero.all = true; render(); return; }
    /* The heading folds or opens what is shown - which, never stored, For
       you decided - and from here on what is stored is what is shown (#87). */
    if (a === "fol-toggle") {
      state.following.open = act.getAttribute("aria-expanded") !== "true";
      saveJSON(storageKey("followingOpen"), state.following.open);
      render();
      return;
    }
    if (a === "unfollow") {
      const raw = act.dataset.follow || "", i = raw.indexOf(":");
      if (i > 0) { toggleFollow(raw.slice(0, i), raw.slice(i + 1)); render(); }
      return;
    }
    /* The Muted fold, and a muted chip's x, which only ever unmutes (#84). */
    if (a === "explore-muted") { state.explore.mutedOpen = !state.explore.mutedOpen; render(); return; }
    if (a === "unmute") {
      const raw = act.dataset.follow || "", i = raw.indexOf(":");
      if (i > 0 && isMuted(raw.slice(0, i), raw.slice(i + 1))) { toggleMute(raw.slice(0, i), raw.slice(i + 1)); render(); }
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
    /* A followed fandom's cast, in By interest: its fold, and its photo ops
       and signings shown, each by follow (#85). */
    if (a === "fol-cast") {
      const k = act.dataset.follow;
      state.following.showCast[k] = !state.following.showCast[k];
      render();
      return;
    }
    if (a === "fol-cast-noise") { state.following.castNoise[act.dataset.follow] = true; render(); return; }
    if (a === "explore-past") { state.explore.showPast = !state.explore.showPast; render(); return; }
    if (a === "explore-cast") { state.explore.showCast = !state.explore.showCast; render(); return; }
    if (a === "explore-cast-noise") { state.explore.castNoise = true; render(); return; }
    if (a === "toggle-follow") {
      const pg = state.explore.page;
      if (pg) { toggleFollow(pg.kind, pg.key); render(); }
      return;
    }
    /* Mute, beside Follow on a page: it mutes, and unfollows what was
       followed; on Muted, it unmutes (#84). */
    if (a === "toggle-mute") {
      const pg = state.explore.page;
      if (pg) { toggleMute(pg.kind, pg.key); render(); }
      return;
    }
    if (a === "show-hidden") { state.browse.showHidden = true; state.browse.page = 1; render(); return; }
    if (a === "unparse-today") { takeOff(act, () => { state.browse.noToday = true; }); return; }
    if (a === "unparse") {
      takeOff(act, () => { state.browse.q = dropPhrase(state.browse.q, act.dataset.src); });
      return;
    }
    if (a === "unfilter") { takeOff(act, () => { state.browse[act.dataset.dim] = "All"; }); return; }
    if (a === "view-timeline" || a === "view-list") {
      state.mineView = a === "view-timeline" ? "timeline" : "list";
      saveJSON(storageKey("mineView"), state.mineView); render();
    }
    return;
  }
  const star = e.target.closest(".star");
  if (star) { if (!star.disabled) { const li = star.closest(".row"); togglePick(li.dataset.id, li); } return; }
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

/* A chip under the box taken off: what was read from the query, or what
   the filter sheet set. Focus goes to the chip that takes its place in the
   row, else to the Filters button - never to the box, which would raise the
   keyboard. */
function takeOff(chip, change) {
  const at = [...chip.parentElement.children].indexOf(chip);
  change();
  state.browse.page = 1;
  render();
  const row = document.querySelector("#view-browse .parsed-chips");
  const next = (row && row.children[at]) || document.getElementById("filtersBtn");
  if (next) next.focus({preventScroll: true});
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
  if (e.target.id === "crewPick") { state.plans.crew = e.target.value; render(); }
  if (e.target.id === "q") settleWords();
}
/* The box left - the return key blurs it - is when a word in it replaces
   the filter sheet's value for its dimension (#71), never a keystroke:
   "photo" on the way to "photoshoot" holds Kind until the next letter.
   focusout fires on every blur; change, which fires only for a value
   changed since focus, is a second hand on the same idempotent step.
   Nothing shown changes, so nothing is drawn. */
function onMainFocusOut(e) {
  if (e.target.id === "q") settleWords();
}

/* The filter sheet (#70): a tap or a choice changes state.browse at once,
   and the panel says so in place - its count among it - while the list
   behind waits for the sheet to close, which draws it once. Show <n>
   events closes it; Clear takes the sheet's filters back off. A tap on a
   dimension a word in the box holds takes the word out first (#71). */
function onFiltersPanelClick(e) {
  if (e.target.closest("#filtersShow")) { closeSheet(); return; }
  if (e.target.closest("#filtersClear")) { clearFilters(); fillFilters(panelFilters); return; }
  const chip = e.target.closest("[data-chip]");
  if (chip) { setFilter(chip.dataset.chip, chip.dataset.value); fillFilters(panelFilters); }
}
function onFiltersPanelChange(e) {
  const t = e.target;
  if (t.id === "hideNoise") { state.browse.hideNoise = t.checked; state.browse.page = 1; }
  else if (t.dataset.filter) setFilter(t.dataset.filter, t.value);
  else return;
  fillFilters(panelFilters);
}

/* The event's panel (DECISIONS #74, #75). A person's name, or a track's or
   a work's chip: its Explore page, the whole sheet closed behind it. The
   place: the Map, focused on the event - the sheet closed first, since the
   close draws the tab underneath, which would end a focus set before it.
   Another session, or a pick the event overlaps: that event's sheet, in
   this one's place - Done, the backdrop and Escape then close to the screen
   underneath, as from any sheet. The star changes the pick and writes what
   follows from it in place - the star, the overlap line - and draws nothing
   again, so focus stays on it. */
function onEventPanelClick(e) {
  const toPage = e.target.closest("[data-explore]");
  if (toPage) {
    const raw = toPage.dataset.explore, i = raw.indexOf(":");
    closeWholeSheet();
    if (i > 0) openExplorePage(raw.slice(0, i), raw.slice(i + 1));
    return;
  }
  if (e.target.closest("#closeSheetEvent")) { closeSheet(); return; }
  const other = e.target.closest("[data-event]");
  if (other) { openSheet("event", other.dataset.event); return; }
  const ev = byId.get(state.sheetId);
  if (!ev) return;
  if (e.target.closest("#sheetPlace")) { closeWholeSheet(); showOnMap(ev.id); return; }
  if (e.target.closest("#sheetICS")) { exportEventICS(ev); return; }
  if (e.target.closest("#sheetStar")) {
    if (ev.removed && !picks.has(ev.id)) return;     // unstarred, never starred anew (#49)
    if (picks.has(ev.id)) picks.delete(ev.id); else picks.add(ev.id);
    savePicks();
    refreshEventSheet();
  }
}

/* The hotel sheet: its rows work like rows anywhere, an empty hotel offers
   the search that would fill it, and a line of the crew's opens its event's
   sheet, as a row does. A star draws the sheet again on the day it shows. */
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
    drawHotelSheet();
    return;
  }
  const line = e.target.closest("[data-hero]");
  if (line) { openSheet("event", line.dataset.hero); return; }
  const main = e.target.closest(".row-main");
  if (main) openSheet("event", main.closest(".row").dataset.id);
}

/* The shared day (W25): its rows work like rows anywhere - a star the
   reader's own, a row its event's sheet, whose close comes back here. */
function onSharedPanelClick(e) {
  if (e.target.closest("#closeSheetShared")) { closeSheet(); return; }
  const star = e.target.closest(".star");
  if (star) { if (!star.disabled) togglePick(star.closest(".row").dataset.id); return; }
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
  onMainClick, onMainInput, onMainKeydown, onMainChange, onMainFocusOut, onEventPanelClick, onHotelPanelClick, onSharedPanelClick,
  onFiltersPanelClick, onFiltersPanelChange, onApplyPreview, onClearPreview, onHashChange, onMinute,
};
