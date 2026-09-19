import { loadJSON } from "./storage.js";
import { IS_IOS } from "./platform.js";
import { devMarkHTML } from "./build.js";
import { state } from "./state.js";
import { initTimeOverride, now } from "./time.js";
import { events, meta } from "./data.js";
import {
  clearNews, picks, reconcilePicks, replaceNews, replacePicks, savePickNews, savePicks,
} from "./picks.js";
import { follows, replaceFollows, saveFollows } from "./follows.js";
import { scroller } from "./scroll.js";
import { setRenderer } from "./bus.js";
import { onAppInstalled, onBeforeInstallPrompt } from "./now.js";
import { onScrollSpy } from "./explore.js";
import {
  closeSheet, onCrowdInput, onNoiseDefaultChange, onResetPicks, onSettingsClick,
  onSheetTouchCancel, onSheetTouchEnd, onSheetTouchMove, onSheetTouchStart, openSheet,
  panelEvent, panelHotel, sheetEl,
} from "./sheet.js";
import {
  BOOT, load, markScheduleChecked, onLoadRegisterWorker, onPageShow, onPillClick, onPillTouchEnd,
  onPillTouchMove, onPillTouchStart, onVisibleRecheck, onWorkerMessage, recheckSchedule,
  setReload, syncHeaderHeight, updatePill,
} from "./loading.js";
import {
  edgeTouchMove, edgeTouchStart, onBigTextChange, onMiniBarClick, onNavClick, onSimChipClick,
  onVisibleRender, render, setTimeOverride,
} from "./shell.js";
import {
  onApplyPreview, onClearPreview, onEventPanelClick, onHashChange, onHotelPanelClick,
  onMainChange, onMainClick, onMainInput, onMainKeydown, onMinute,
} from "./dispatch.js";

/* ==================================================================
   Boot. Everything above is imports, and importing this module evaluates
   every other one first: that is when the consts that read storage, the DOM
   and navigator are read. Nothing else happens until boot() is called -
   once, by src/main.js - and then it happens in the order it always did:
   listeners on one element fire in the order they were added, so the
   registrations below keep the order they had when they ran as the script
   parsed. The handlers are not here. Each lives in the module that owns the
   state it writes, or in dispatch.js when it spans modules, and is
   registered by name.

   events: the schedule, already parsed. load() uses it instead of fetching,
   and still reaches the first render() with no await on the way.
   reload: what reloadNow() calls, for a caller that cannot replace
   location.reload. The option names are the contract; the locals are
   renamed because events is one of the module's own names too, and reload
   was until loading.js took it.

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

  document.querySelector("main").addEventListener("click", onMainClick);
  document.querySelector("main").addEventListener("input", onMainInput);
  document.querySelector("main").addEventListener("keydown", onMainKeydown);
  document.querySelector("main").addEventListener("change", onMainChange);

  sheetEl.addEventListener("touchstart", onSheetTouchStart, {passive: true});
  sheetEl.addEventListener("touchmove", onSheetTouchMove, {passive: true});
  sheetEl.addEventListener("touchend", onSheetTouchEnd);
  sheetEl.addEventListener("touchcancel", onSheetTouchCancel);

  panelEvent.addEventListener("click", onEventPanelClick);
  panelHotel.addEventListener("click", onHotelPanelClick);

  document.getElementById("minibar").addEventListener("click", onMiniBarClick);
  document.getElementById("settingsBtn").addEventListener("click", onSettingsClick);
  document.getElementById("closeSheet").addEventListener("click", closeSheet);
  document.getElementById("sheetBack").addEventListener("click", closeSheet);
  document.getElementById("crowd").addEventListener("input", onCrowdInput);
  document.getElementById("noiseDefault").addEventListener("change", onNoiseDefaultChange);
  document.getElementById("bigText").addEventListener("change", onBigTextChange);
  document.getElementById("applyPreview").addEventListener("click", onApplyPreview);
  document.getElementById("clearPreview").addEventListener("click", onClearPreview);
  document.getElementById("simChip").addEventListener("click", onSimChipClick);
  document.getElementById("resetPicks").addEventListener("click", onResetPicks);

  window.addEventListener("hashchange", onHashChange);

  setInterval(onMinute, 60000);
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
