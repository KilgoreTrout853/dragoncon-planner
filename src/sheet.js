/* The bottom sheet: one wrapper and three panels - Settings, an event, a
   hotel - with what fills each, what opens and closes it, the swipe that
   dismisses it, and the handlers boot() registers on it and on the Settings
   controls, the email step's among them. The clicks inside the event and
   hotel panels are dispatch's: they reach further than the sheet.
   closeSheet() asks for its redraw over the bus, because render() is the
   shell's, above this module. The seven elements are looked up as the
   module is imported, so the markup has to be there first. */
import { esc, fmtShort } from "./util.js";
import { saveJSON } from "./storage.js";
import { deviceLine, storageKey } from "./build.js";
import { hasBackend } from "./backend.js";
import { codeSentTo, confirmCode, plainMessage, sendCode, signedInAs, signOut } from "./identity.js";
import { settings, state } from "./state.js";
import { DAY_LONG, localInputValue, timeOverride } from "./time.js";
import { hotelPhrase, hotelVar, placeHTML, WALK } from "./venues.js";
import { byId, directWorks, events, isCeleb, tagsOf, worksById } from "./data.js";
import { picks, replacePicks, savePicks } from "./picks.js";
import { CELEB_BADGE, rowHTML } from "./ui.js";
import { pageScrollTo, pageScrollTop } from "./scroll.js";
import { requestRender } from "./bus.js";
import { fillSyncStatus, forgetSync, runSync } from "./sync.js";
import { MAP_HOTELS, mapDay } from "./map.js";

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
  fillKeep();
}

/* Keep your plan: the email step (DECISIONS #51, #53), between Advanced and
   Done, and there only when the build has a backend - with none, the panel
   is the 2026 app's. One screen for add and recover: the address and Send
   code, then the code and Confirm; once the session has an email, who it
   is and Sign out. Under the heading, with a session alone, one line of
   sync's: synced, what is waiting, or what went wrong (sync.js). Drawn once,
   the first time it is shown, and after that only shown and hidden, so a
   half-typed address survives a redraw. */
const keepEl = document.getElementById("keep");
let keepNote = "", keepBusy = false;
const KEEP_HTML = `<h3>Keep your plan</h3>
  <p class="keep-sync" id="keepSync" role="status" hidden></p>
  <div id="keepOut">
    <p>Add your email, and a new phone gets this plan back. We send a six-digit code; there's no password.</p>
    <form id="keepEmailForm" novalidate>
      <label>Email <input type="email" id="keepEmail" autocomplete="email" autocapitalize="off" spellcheck="false"></label>
      <button class="btn" id="keepSend">Send code</button>
    </form>
    <form id="keepCodeForm" novalidate hidden>
      <label>The code sent to <b id="keepSentTo"></b> <input type="text" id="keepCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
      <button class="btn" id="keepConfirm">Confirm</button>
    </form>
  </div>
  <div id="keepIn" hidden>
    <p>Signed in as <b id="keepWho"></b>. A new phone gets this plan back with the same email.</p>
    <div class="rowbtns"><button class="btn quiet" type="button" id="keepSignOut">Sign out</button></div>
  </div>
  <p class="keep-note" id="keepNote" role="status"></p>`;

function fillKeep() {
  keepEl.hidden = !hasBackend;
  if (!hasBackend) return;
  if (!keepEl.firstElementChild) keepEl.innerHTML = KEEP_HTML;
  const who = signedInAs(), sentTo = codeSentTo();
  document.getElementById("keepOut").hidden = !!who;
  document.getElementById("keepIn").hidden = !who;
  document.getElementById("keepWho").textContent = who;
  document.getElementById("keepCodeForm").hidden = !sentTo;
  document.getElementById("keepSentTo").textContent = sentTo;
  document.getElementById("keepSend").disabled = keepBusy;
  document.getElementById("keepConfirm").disabled = keepBusy;
  document.getElementById("keepNote").textContent = keepNote;
  fillSyncStatus();
}

function eventSheetHTML(ev) {
  const mine = picks.has(ev.id);
  /* Each person as this listing spells them, with the role it gives them;
     See all opens their page by id. */
  const peopleRows = (ev.people || []).filter(p => p && p.name).map(p => ({
    id: p.id,
    label: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? `${p.name} (${p.role.toLowerCase()})` : p.name,
  }));
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...directWorks(ev).map(id => (worksById.get(id) || {}).name).filter(Boolean)];
  const mature = tagsOf(ev).audience === "mature";
  /* The calendar takes only what is on the schedule: Mine's export leaves a
     removed pick out, and so does this, the other door to the same calendar
     (DECISIONS #49). A cancelled event keeps its button, as it always had. */
  const ics = ev.removed ? "" : `<button class="btn quiet" id="sheetICS">Add this to calendar</button>`;
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${ev.removed ? `<div><span class="removed-tag">Removed from the schedule</span></div>` : ""}
      ${isCeleb(ev) ? `<div>${CELEB_BADGE}</div>` : ""}
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleRows.length ? `<div class="ev-people">With ${peopleRows.map(p =>
        `<span class="who"><span>${esc(p.label)}</span> <button class="see-all" data-explore="person:${esc(p.id)}">See all</button></span>`).join(", ")}</div>` : ""}
      ${chips.length || mature ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${mature ? `<span class="tag adult">18+</span>` : ""}</div>` : ""}
    </div>
    <div class="ev-actions">
      <button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}">${mine ? "★" : "☆"}</button>
      ${ics}
      <button class="btn" id="closeSheetEvent">Done</button>
    </div>`;
}

/* The user's picks in one hotel on one con day, in time order (events is). */
const mapPicksAt = (hotel, day) => events.filter(e => picks.has(e.id) && e.hotel === hotel && e._cd === day);
function hotelSheetHTML(hotel, day) {
  const rows = mapPicksAt(hotel, day), dayName = DAY_LONG[day] || day;
  const count = rows.length ? `${rows.length} pick${rows.length === 1 ? "" : "s"}` : "no picks";
  const body = rows.length
    ? `<div class="ev-body"><ul class="list compact">${rows.map(ev => rowHTML(ev, {list: "map"})).join("")}</ul></div>`
    : `<div class="ev-body"><p style="color:var(--muted)">No picks here on ${esc(dayName)}.</p>
        <div class="rowbtns"><button class="btn quiet" data-act="map-search" data-hotel="${esc(hotel)}" data-day="${day}">Search ${esc(hotelPhrase(hotel))} on ${esc(dayName)}</button></div></div>`;
  return `<div class="ev-head"><h2 id="sheetTitleHotel">${esc(hotel)}</h2><div class="ev-when">${esc(dayName)} &middot; ${count}</div></div>
    ${body}
    <div class="ev-actions"><button class="btn" id="closeSheetHotel">Done</button></div>`;
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
  requestRender();
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

/* What boot() registers on the sheet itself: the drag. */
function onSheetTouchStart(e) {
  if (e.target.closest(".ev-body")) return;   // let the description scroll
  dragY = e.touches[0].clientY;
  dragT = performance.now();
  dragDy = 0;
  sheetEl.classList.remove("settling");
  sheetBackEl.classList.add("dragging");
}

function onSheetTouchMove(e) {
  if (dragY === null) return;
  const dy = e.touches[0].clientY - dragY;
  setDrag(dy > 0 ? dy : dy / 4);              // slight resistance upward
}

function onSheetTouchEnd() {
  if (dragY === null) return;
  const dy = dragDy, ms = performance.now() - dragT;
  dragY = null;
  /* Below about one frame we have no reliable velocity, so don't invent one -
     fall back to distance alone rather than treating a 30px nudge as a flick. */
  const v = ms >= 16 ? dy / ms : 0;
  const flicked = dy > 40 && v > 0.6;
  settle(dy > 70 || flicked);
}

function onSheetTouchCancel() { if (dragY !== null) { dragY = null; settle(false); } }

/* And on the header's Settings button and the Settings panel's controls. */
function onSettingsClick() { openSheet("settings"); }
function onCrowdInput(e) { settings.crowd = parseFloat(e.target.value); document.getElementById("crowdLabel").textContent = `${settings.crowd.toFixed(1)}x`; saveJSON(storageKey("settings"), settings); }
function onNoiseDefaultChange(e) { settings.hideNoise = e.target.checked; state.browse.hideNoise = settings.hideNoise; saveJSON(storageKey("settings"), settings); }
function onResetPicks() { if (confirm("Remove everything from my schedule?")) { replacePicks([]); savePicks(); closeSheet(); } }

/* The email step's two forms, Send code and Confirm. A failure is said in
   plain words and changes nothing kept; a second tap while a request is out
   does nothing. Each that succeeds starts a sync run, not waited on: a code
   sent may have minted the phone's user, and a code confirmed may have
   signed it in as another, and either way the plan goes up. */
async function onKeepSubmit(e) {
  e.preventDefault();
  if (keepBusy) return;
  const form = e.target.id;
  keepBusy = true;
  keepNote = "";
  fillKeep();
  try {
    if (form === "keepEmailForm") {
      await sendCode(document.getElementById("keepEmail").value);
      document.getElementById("keepCode").value = "";
      keepNote = "Check your email for the code.";
      runSync();
    } else if (form === "keepCodeForm") {
      await confirmCode(document.getElementById("keepCode").value);
      document.getElementById("keepCode").value = "";
      runSync();
    }
  } catch (err) {
    keepNote = plainMessage(err);
  } finally {
    keepBusy = false;
    fillKeep();
  }
}
/* And Sign out, which only a user signed in with an email is shown. Sync's
   own keys go with the session, so a later sign-in, even as the same user,
   sends the whole plan again; the plan itself stays. */
function onKeepClick(e) {
  if (!e.target.closest("#keepSignOut")) return;
  signOut();
  forgetSync();
  keepNote = "Signed out. Your plan stays on this phone.";
  fillKeep();
}

export {
  sheetWrap, sheetEl, panelEvent, panelHotel, eventSheetHTML, hotelSheetHTML, openSheet,
  closeSheet, setDrag, onSheetTouchStart, onSheetTouchMove, onSheetTouchEnd, onSheetTouchCancel,
  onSettingsClick, onCrowdInput, onNoiseDefaultChange, onResetPicks, onKeepSubmit, onKeepClick,
};
