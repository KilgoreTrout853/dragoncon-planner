/* The bottom sheet: one wrapper and seven panels - Settings, an event,
   which eventsheet.js draws, a hotel, a crew, Share a day, a day shared with
   the reader and Search's filters, which filters.js draws - with what fills
   each, what opens and closes it, the swipe and the Escape that dismiss it,
   focus into it and back (#66), and the handlers boot()
   registers on it, on the Settings controls - the email step's among them -
   in the crew panel and in the share panel, whose state is this module's,
   as the shared day is. A pull's redraw refills the open crew panel, the
   open hotel's crew and the shared day's stars, in place; the open event's
   line is eventsheet.js's.
   The clicks inside the event, hotel, shared-day and filter panels are
   dispatch's: they reach further than the sheet. closeSheet() asks for its
   redraw over the bus, because render() is the shell's, above this module.
   The eleven elements are looked up as the module is imported, so the
   markup has to be there first. */
import { esc, fmtShort } from "./util.js";
import { YEAR } from "./season.js";
import { saveJSON } from "./storage.js";
import { deviceLine, storageKey } from "./build.js";
import { hasBackend } from "./backend.js";
import { codeSentTo, confirmCode, plainMessage, sendCode, signedInAs, signOut } from "./identity.js";
import {
  createCrew, crewMessage, deleteCrew, inviteLink, isCreator, joinCrew, leaveCrew, myCrews, myMembership, newInvite,
  pendingJoin, readInvite, removeMember, setMyName, takePendingJoin,
} from "./crews.js";
import { settings, state } from "./state.js";
import { conDayKey, DAY_LABEL, DAY_LONG, localInputValue, now, timeOverride } from "./time.js";
import { hotelPhrase, WALK } from "./venues.js";
import { dayLink, dayMessage, defaultShareDay, readSharedDay, shareableDays, sharedPicks } from "./shareday.js";
import { byId, events } from "./data.js";
import { picks, replacePicks, savePicks } from "./picks.js";
import { chipHTML, crewLineHTML, rowHTML } from "./ui.js";
import { focusIn, focusKey, pageScrollTo, pageScrollTop, refill, shownMatch } from "./scroll.js";
import { eventSheetHTML } from "./eventsheet.js";
import { requestRender } from "./bus.js";
import { fillSyncStatus, forgetSync, runSync, sendBeforeSignOut, syncAfter } from "./sync.js";
import { MAP_HOTELS, mapCrewCounts, mapCrewPicks, mapDay } from "./map.js";
import { chosenCrew, crewPeople } from "./plans.js";
import { filtersChanged, filtersHTML, settleWords } from "./filters.js";

/* Bottom sheet: one wrapper, seven panels (settings, event, hotel, crew,
   share, shared, filters) */
const sheetWrap = document.getElementById("sheetWrap");
const sheetEl = document.getElementById("sheet");
const panelSettings = document.getElementById("panel-settings");
const panelEvent = document.getElementById("panel-event");
const panelHotel = document.getElementById("panel-hotel");
const panelCrew = document.getElementById("panel-crew");
const panelShare = document.getElementById("panel-share");
const panelShared = document.getElementById("panel-shared");
const panelFilters = document.getElementById("panel-filters");
let sheetScrollY = 0;
let opener = null;      // what opened the sheet, as a selector that finds it again

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
   is and Sign out. Under the heading, with a session alone, sync's lines
   (sync.js): synced, what is waiting, or what went wrong; and, while a
   refused Sign out still has changes to send, how many. Drawn once,
   the first time it is shown, and after that only shown and hidden, so a
   half-typed address survives a redraw. */
const keepEl = document.getElementById("keep");
let keepNote = "", keepBusy = false;
const KEEP_HTML = `<h3>Keep your plan</h3>
  <p class="keep-sync" id="keepSync" role="status" hidden></p>
  <p class="keep-sync" id="keepWaiting" role="status" hidden></p>
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
  document.getElementById("keepSignOut").disabled = keepBusy;
  document.getElementById("keepNote").textContent = keepNote;
  fillSyncStatus();
}

/* ---- The hotel sheet (docs/screens/contract.md, section 8) -------- */
/* The user's picks in one hotel on one con day, in time order (events is). */
const mapPicksAt = (hotel, day) => events.filter(e => picks.has(e.id) && e.hotel === hotel && e._cd === day);
/* And under them the crew's there, Your crew's picks here (DECISIONS #62,
   #68): a line a pick, from the Map's own reader (map.js mapCrewPicks()), so
   on a build with a backend and for a reader in a crew alone. Now's line
   (ui.js crewLineHTML()), but for two things: after the name, the start,
   never "on now" - the sheet does not tick, and the Map's day is often not
   today - and after the title, the room, the hotel being the sheet's, or the
   title alone where there is none. Its id is the crewmate's and the event's,
   unique on the page - Now's lines, hidden behind the Map, are crewNow- - so
   focus finds a line by its id, never by its event, which the Map's card may
   show too. With none of the crew here the sheet is as it was before them. */
const hereLineHTML = c => crewLineHTML(`crewHere-${c.user_id}-${c.ev.id}`, c.display_name, fmtShort(c.ev._s), c.ev, String(c.ev.room || "").trim());
const crewHereHTML = lines => (lines.length
  ? `<div class="hotel-crew" id="hotelCrew"><div class="section-title">Your crew's picks here</div><ul class="list">${lines.map(hereLineHTML).join("")}</ul></div>` : "");
/* The head says how many of the crew are here - the pill's number, by the
   pill's own count (map.js mapCrewCounts()), so the two never disagree -
   and nothing of the crew at none. */
const crewCountHTML = people => (people ? `<span id="hotelCrewCount"> &middot; ${people} of your crew</span>` : "");
const noPicksText = (crew, dayName) => `${crew ? "None of your own picks here" : "No picks here"} on ${dayName}.`;
function hotelSheetHTML(hotel, day) {
  const rows = mapPicksAt(hotel, day), dayName = DAY_LONG[day] || day;
  const crew = mapCrewPicks(day)[hotel] || [], people = mapCrewCounts(day)[hotel] || 0;
  const count = rows.length ? `${rows.length} pick${rows.length === 1 ? "" : "s"}` : "no picks";
  const body = rows.length
    ? `<div class="ev-body"><ul class="list compact">${rows.map(ev => rowHTML(ev, {list: "map"})).join("")}</ul>${crewHereHTML(crew)}</div>`
    : `<div class="ev-body"><p style="color:var(--muted)">${esc(noPicksText(crew.length, dayName))}</p>
        <div class="rowbtns"><button class="btn quiet" data-act="map-search" data-hotel="${esc(hotel)}" data-day="${day}">Search ${esc(hotelPhrase(hotel))} on ${esc(dayName)}</button></div>${crewHereHTML(crew)}</div>`;
  return `<div class="ev-head"><h2 id="sheetTitleHotel" tabindex="-1">${esc(hotel)}</h2><div class="ev-when">${esc(dayName)} &middot; ${count}${crewCountHTML(people)}</div></div>
    ${body}
    <div class="ev-actions"><button class="btn" id="closeSheetHotel">Done</button></div>`;
}
/* The hotel panel drawn, and the day it was drawn for kept: with no day
   tapped the Map's day moves on at 5 AM, and the sheet - its star's redraw
   and a pull's refill alike - stays on the day it shows. */
let hotelDay = null;
function drawHotelSheet(day = hotelDay) {
  hotelDay = day;
  panelHotel.innerHTML = hotelSheetHTML(state.sheetHotel, day);
}
/* The crew pill's way in (#63): with a few picks of the reader's own, Your
   crew here starts below the fold, so the pill opens the sheet with it
   brought to the top of the body. The block and the gold pill open the
   sheet at its top, and focus is on the heading whichever opened it (#66).
   A pill left on the Map from crew picks another tab has since changed may
   find no section. */
function showHotelCrew() {
  const body = panelHotel.querySelector(".ev-body"), crew = document.getElementById("hotelCrew");
  if (body && crew) body.scrollTop += crew.getBoundingClientRect().top - body.getBoundingClientRect().top;
}

/* ---- The crew panel (DECISIONS #56, #62; docs/screens/contract.md,
   section 5) ---------------------------------------------------------- */
/* Three steps. Create: the crew's name, the reader's name in it, and what
   joining shares. Join: the same for a crew the invite cannot name - a kept
   ?join=, or a pasted link - and an invite whose token is a kept crew's
   sends nothing and opens that crew instead. Manage: the members, the
   reader's own name in this crew to change, the invite link to copy, share
   or, for the creator, renew; Remove beside each member and Delete for the
   creator, Leave for everyone else; and a way to a second crew. The manage
   view stays on one crew: if a pull takes it away, it says so and offers
   Done alone.
   Drawn once, the first time it opens; after that its steps are only shown
   and hidden and its lines and lists refilled around the form, so a
   refresh from a pull never rewrites a field or moves focus. Every action
   is one request at a time, then a sync run that began after it, then the
   panel and Plans drawn from what the pull kept - nothing optimistic. A
   failure is said here, in crewMessage()'s words, and keeps and runs
   nothing. createCrew() and joinCrew() make the user they need. */
const CREW_HTML = `<h2 id="sheetTitleCrew" tabindex="-1"></h2>
  <form class="crew-form" id="crewCreateForm" novalidate hidden>
    <label>Crew name <input type="text" id="crewNewName" autocomplete="off"></label>
    <label>Your name in the crew <input type="text" id="crewCreateMe" autocomplete="nickname"></label>
    <p class="crew-consent">Everyone who joins this crew sees your name and your starred events, now and later.</p>
    <button class="btn" id="crewCreate">Create</button>
  </form>
  <form class="crew-form" id="crewJoinForm" novalidate hidden>
    <p id="crewInvited">You've been invited to join a crew.</p>
    <label id="crewPasteLabel">Invite link <input type="text" id="crewPaste" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste the link here"></label>
    <label>Your name in the crew <input type="text" id="crewJoinMe" autocomplete="nickname"></label>
    <p class="crew-consent">Joining shares your name and your starred events with everyone in this crew, now and later.</p>
    <button class="btn" id="crewJoinSubmit">Join</button>
  </form>
  <div class="crew-manage" id="crewManage" hidden>
    <ul class="crew-members" id="crewMembers" aria-label="Members"></ul>
    <form class="crew-name" id="crewNameForm" novalidate>
      <label>Your name in this crew <input type="text" id="crewMyName" autocomplete="nickname"></label>
      <button class="btn quiet" id="crewNameSave">Save</button>
    </form>
    <div class="crew-invite">
      <label id="crewLinkLabel">Invite link <input type="text" id="crewLink" readonly></label>
      <p class="crew-wait" id="crewLinkWait" hidden>The invite link comes with the next sync.</p>
      <div class="rowbtns">
        <button class="btn quiet" type="button" id="crewCopy">Copy link</button>
        <button class="btn quiet" type="button" id="crewShare">Share link</button>
        <button class="btn quiet" type="button" id="crewRenew">New link</button>
      </div>
    </div>
    <div class="rowbtns">
      <button class="btn danger" type="button" id="crewLeave">Leave crew</button>
      <button class="btn danger" type="button" id="crewDelete">Delete crew</button>
    </div>
    <div class="rowbtns">
      <button class="btn quiet" type="button" id="crewMoreCreate">Start another crew</button>
      <button class="btn quiet" type="button" id="crewMoreJoin">Join with a link</button>
    </div>
  </div>
  <p class="crew-note" id="crewNote" role="status"></p>
  <div class="rowbtns"><button class="btn" type="button" id="closeSheetCrew">Done</button></div>`;
const LANDED = "Done - it will show here once this phone reaches the server.";
const RENEWED = "New link made - the old one no longer works.";
const NAME_KEPT = "Your name didn't change - try again.";

let crewStep = null;      // create, join, manage, or left - a Leave or Delete whose pull has not yet come
let crewId = null;        // the crew the manage view is on
let crewTitle = "";       // its name as last drawn, kept once a pull takes it away
let crewSeen = false;     // whether a pull has shown that crew since the step opened
let crewInvite = "";      // the kept ?join= the join step uses, when it is this year's invite
let crewCatchUp = null;   // {done(), note}: the words once a pull shows what an action did
let crewNote = "";
let crewBusy = false;
let crewOpened = 0;       // counts the panel's openings and closings: an action landing after one leaves the panel alone
let nameCrew = null;      // the crew whose name the name field was filled from
let nameKept = "";        // that name, as the pull last kept it
const deadTokens = new Map();   // by crew, the token a New link replaced, until a pull brings the new one
const drawnMembers = new WeakMap();

const field = id => document.getElementById(id);
const keptCrew = () => (crewId && myCrews().find(c => c.id === crewId)) || null;
const keptWithToken = token => myCrews().find(c => c.invite_token === token) || null;
const shareText = crew => `Join "${crew.name}" on the Dragon Con planner: ${inviteLink(crew)}`;
function canShare(crew) {
  return typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare({text: shareText(crew)}));
}

/* A step, from its start: the forms emptied and the reader's name in the
   oldest crew that has them offered for the new one. A kept invite is read
   as the join step opens - another year's, or no invite at all, is said at
   once, with the field to paste into - and one whose token is a kept
   crew's opens that crew's manage view. */
function openCrew(step) {
  if (!panelCrew.firstElementChild) panelCrew.innerHTML = CREW_HTML;
  crewOpened++;
  crewStep = step;
  crewId = step === "manage" ? (chosenCrew() || {}).id || null : null;
  crewSeen = false;
  crewInvite = "";
  crewCatchUp = null;
  crewNote = "";
  nameCrew = null;
  if (step === "create" || step === "join") {
    const me = myCrews().map(myMembership).find(Boolean);
    for (const id of ["crewNewName", "crewPaste"]) field(id).value = "";
    for (const id of ["crewCreateMe", "crewJoinMe"]) field(id).value = me ? me.display_name : "";
  }
  if (step === "join") {
    const kept = pendingJoin(), found = kept ? readInvite(kept) : null;
    if (kept && !found) crewNote = crewMessage({code: "bad_invite"});
    else if (found && found.year !== YEAR) crewNote = crewMessage({code: "other_year"});
    else if (found && keptWithToken(found.token)) { alreadyIn(keptWithToken(found.token)); return; }
    else if (found) crewInvite = kept;
  }
  fillCrew();
}
/* A link for a crew the reader is in: no request and no form - the kept
   invite taken, that crew chosen, and its manage view. A list gone stale
   shows it until the next pull takes the crew away. */
function alreadyIn(crew) {
  takePendingJoin();
  state.plans.crew = crew.id;
  crewStep = "manage";
  crewId = crew.id;
  crewSeen = false;
  crewNote = `You're already in ${crew.name}.`;
  fillCrew();
}

/* The panel from the module's state and the kept crews. A Leave or Delete
   closes to Plans once a pull shows the crew gone: at once after its own
   run, or - its pull having failed - on its words until a later one. */
function fillCrew() {
  if (!panelCrew.firstElementChild) return;
  const crew = crewStep === "manage" ? keptCrew() : null;
  if (crewCatchUp && crewCatchUp.done()) { crewNote = crewCatchUp.note; crewCatchUp = null; }
  if (crew) {
    crewTitle = crew.name;
    crewSeen = true;
  } else if (crewStep === "manage" && crewSeen) {
    crewNote = crewMessage({code: "no_crew"});
  }
  if (crewStep === "left" && !crewBusy && !keptCrew()) queueMicrotask(closeLeft);
  field("sheetTitleCrew").textContent = {create: "Start a crew", join: "Join a crew"}[crewStep] || crewTitle;
  field("crewCreateForm").hidden = crewStep !== "create";
  field("crewJoinForm").hidden = crewStep !== "join";
  field("crewInvited").hidden = !crewInvite;
  field("crewPasteLabel").hidden = !!crewInvite;
  field("crewManage").hidden = !crew;
  if (crew) fillManage(crew);
  for (const b of panelCrew.querySelectorAll("button")) if (b.id !== "closeSheetCrew") b.disabled = crewBusy;
  if (crew) fillNameSave(crew);
  field("crewNote").textContent = crewNote;
}
function closeLeft() {
  if (!sheetWrap.hidden && !panelCrew.hidden && crewStep === "left" && !crewBusy && !keptCrew()) closeSheet();
}
/* A crew's link is withheld while the token kept is one a New link
   replaced - across a close and a reopen - and shown once a pull brings the
   new one. */
function fillManage(crew) {
  const creator = isCreator(crew), link = inviteLink(crew);
  if (deadTokens.has(crew.id) && deadTokens.get(crew.id) !== crew.invite_token) deadTokens.delete(crew.id);
  const waiting = !link || deadTokens.has(crew.id);
  fillMembers(crew, creator);
  fillName(crew);
  /* The link's field is read-only - nothing the reader typed - and must
     never show a link that no longer works: it takes a new one in place,
     focus left where it is and a whole selection kept. */
  const linkField = field("crewLink");
  if (!waiting && linkField.value !== link) {
    const whole = document.activeElement === linkField && linkField.selectionStart === 0 && linkField.selectionEnd === linkField.value.length;
    linkField.value = link;
    if (whole) linkField.select();
  }
  field("crewLinkLabel").hidden = waiting;
  field("crewLinkWait").hidden = !waiting;
  field("crewCopy").hidden = waiting;
  field("crewShare").hidden = waiting || !canShare(crew);
  field("crewRenew").hidden = !creator;
  field("crewDelete").hidden = !creator;
  field("crewLeave").hidden = creator;
}
/* The members, the reader first. A departed member's row goes first; then
   each row is redrawn only when what it says changed and moved only when
   the order did, so a pull that brings a newcomer, or takes someone listed
   above, leaves focus on the Remove it was on. */
function fillMembers(crew, creator) {
  const list = field("crewMembers"), me = myMembership(crew), people = crewPeople(crew), ids = new Set(people.map(m => m.user_id));
  for (const li of [...list.children]) if (!ids.has(li.dataset.user)) li.remove();
  const had = new Map([...list.children].map(li => [li.dataset.user, li]));
  people.forEach((m, i) => {
    const you = !!me && m.user_id === me.user_id;
    const html = `<span class="crew-member">${esc(m.display_name)}</span>${you ? ` <span class="crew-you">(you)</span>` : ""}${crew.creator === m.user_id ? ` <span class="crew-maker">made the crew</span>` : ""}${creator && !you
      ? ` <button class="btn quiet crew-remove" type="button" data-user="${esc(m.user_id)}" aria-label="Remove ${esc(m.display_name)}">Remove</button>` : ""}`;
    let li = had.get(m.user_id);
    if (!li || drawnMembers.get(li) !== html) {
      const fresh = document.createElement("li");
      fresh.dataset.user = m.user_id;
      fresh.innerHTML = html;
      drawnMembers.set(fresh, html);
      if (li) li.replaceWith(fresh);
      li = fresh;
    }
    if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
  });
}
/* The reader's name in this crew, for a reader the crew holds: filled from
   the kept row as the view opens on a crew. A pull that brings another
   name puts it in the field only while the field still says the name it
   was filled with - one the reader has changed is theirs, and stays as
   typed, caret and focus with it. */
function fillName(crew) {
  const me = myMembership(crew), box = field("crewMyName");
  field("crewNameForm").hidden = !me;
  if (!me) return;
  if (nameCrew !== crew.id) {
    nameCrew = crew.id;
    box.value = nameKept = me.display_name;
  } else if (me.display_name !== nameKept) {
    if (box.value === nameKept) box.value = me.display_name;
    nameKept = me.display_name;
  }
}
/* What Save would send: the field trimmed, when it is a name and not the
   one kept - "" while it is empty or unchanged. A name too long is sent
   to setMyName(), which says why before any request. */
function nameToSave(crew) {
  const me = crew ? myMembership(crew) : null, name = field("crewMyName").value.trim();
  return me && name && name !== me.display_name ? name : "";
}
function fillNameSave(crew) { field("crewNameSave").disabled = crewBusy || !nameToSave(crew); }
/* What boot() registers on the crew panel's typing: Save follows the field. */
function onCrewInput(e) {
  if (e.target.id === "crewMyName" && crewStep === "manage") fillNameSave(keptCrew());
}

/* shell.js render()'s: a pull's redraw reaches the open panel too. */
function refreshCrewPanel() { if (!sheetWrap.hidden && !panelCrew.hidden) fillCrew(); }
/* And the open hotel sheet: what it draws of the crew, on the day it was
   drawn for, written in place - the count in its head, the words above its
   Search button, and Your crew's picks here, put in or taken out whole, or
   its lines kept by id. The reader's own rows and count stay as drawn
   (ROADMAP, Flags). The body is never replaced, so its scroll stays; nothing
   is written when nothing changed; a line moved while it had focus has it
   again, and one taken away gives it to the sheet's heading (#66).
   `state.sheetHotel` is one only while the hotel's panel is shown. */
function refreshHotelSheet() {
  if (!state.sheetHotel) return;
  const fresh = document.createElement("div"), back = focusIn(panelHotel), part = (root, selector) => root.querySelector(selector);
  fresh.innerHTML = hotelSheetHTML(state.sheetHotel, hotelDay);
  const crew = part(panelHotel, "#hotelCrew"), crewFresh = part(fresh, "#hotelCrew"), said = part(panelHotel, ".ev-body > p");
  putPart(part(panelHotel, "#hotelCrewCount"), part(fresh, "#hotelCrewCount"), part(panelHotel, ".ev-when"));
  const words = said ? noPicksText(!!crewFresh, DAY_LONG[hotelDay] || hotelDay) : "";
  if (said && said.textContent !== words) said.textContent = words;
  if (crew && crewFresh) fillLines(crew.querySelector("ul"), crewFresh.querySelector("ul"));
  else putPart(crew, crewFresh, part(panelHotel, ".ev-body"));
  if (back && !panelHotel.contains(document.activeElement)) (shownMatch(back) || document.getElementById("sheetTitleHotel")).focus({preventScroll: true});
}
/* A part of it from its fresh copy: written into, put at the end of its
   place where it was not, taken out where it is no longer. */
function putPart(old, fresh, place) {
  if (old && fresh) refill(old, fresh);
  else if (fresh) place.append(fresh);
  else if (old) old.remove();
}
/* The crew's lines from their fresh copies, by id: a line still there keeps
   its node - its button written into only when what it says changed, so
   focus on it stays and is not read out again - and moves only when the
   order did; a new line goes in at its place, and a line gone goes. As
   fillMembers() keeps the crew panel's members, but kept by the button's
   id and written into rather than replaced. */
function fillLines(list, fresh) {
  const lines = [...fresh.children], key = li => li.firstElementChild.id, ids = new Set(lines.map(key));
  for (const li of [...list.children]) if (!ids.has(key(li))) li.remove();
  const had = new Map([...list.children].map(li => [key(li), li]));
  lines.forEach((li, i) => {
    const kept = had.get(key(li));
    if (kept) refill(kept.firstElementChild, li.firstElementChild);
    const node = kept || li;
    if (list.children[i] !== node) list.insertBefore(node, list.children[i] || null);
  });
}

/* One action: send() is its request; done(answer, here) applies what it
   changed - `here` false once the panel has been closed or opened again
   since the tap, when only Plans' own state may change, never the panel -
   and may say {landed}, the words for an action the server took whose run
   then failed, and {refused()}, the words for one whose run's pull shows
   it did not take, "" when it did. Focus stays in the panel: on the
   control that sent the action - or `back`, the field it came from - while
   it can still take it, or on the heading once the step has moved on
   (#66). A Leave or Delete closes the panel once a pull shows the crew
   gone (fillCrew()), straight after it or later. */
async function crewAct(send, done, back = null) {
  if (crewBusy) return;
  const opened = crewOpened, from = back || document.activeElement;
  crewBusy = true;
  crewNote = "";
  crewCatchUp = null;
  fillCrew();
  let answer;
  try { answer = await send(); }
  catch (e) {
    crewBusy = false;
    if (opened === crewOpened) crewNote = crewMessage(e);
    fillCrew();
    if (opened === crewOpened) focusBack(from);
    return;
  }
  const next = done(answer, opened === crewOpened) || {};
  const run = await syncAfter();
  crewBusy = false;
  const here = opened === crewOpened;
  const refused = here && !run.error && next.refused ? next.refused() : "";
  if (here && run.error) crewNote = next.landed || LANDED;
  else if (refused) crewNote = refused;
  requestRender();
  fillCrew();
  if (here) focusBack(from);
}
function focusBack(from) {
  if (sheetWrap.hidden || panelCrew.hidden) return;
  if (from && from.isConnected && panelCrew.contains(from) && !from.disabled && !from.closest("[hidden]")) {
    if (document.activeElement !== from) from.focus({preventScroll: true});
  } else focusTitle("sheetTitleCrew");
}
/* A crew made or joined: chosen, and its manage view once a pull has it. */
function madeOrJoined(crew, note, landed, here) {
  state.plans.crew = crew.id;
  if (!here) return {};
  crewStep = "manage";
  crewId = crew.id;
  crewTitle = crew.name;
  crewSeen = false;
  crewInvite = "";
  crewNote = note;
  crewCatchUp = {done: () => !!keptCrew(), note};
  return {landed};
}
/* A crew left or deleted: Plans shows the next crew, or the rung. */
function leftCrew(id, here) {
  if (state.plans.crew === id) state.plans.crew = null;
  if (here) crewStep = "left";
  return {};
}

/* Copy and Share make no request: each is called in the tap itself, since a
   browser allows them only then, and falls back to the link selected in
   its field. A share the reader cancelled says nothing. */
function linkByHand(words) {
  field("crewLink").focus();
  field("crewLink").select();
  crewNote = words;
  fillCrew();
}
function copyLink(crew) {
  crewNote = "";
  fillCrew();
  const clip = navigator.clipboard, words = "Couldn't copy - select the link above and copy it.";
  if (!clip || typeof clip.writeText !== "function") { linkByHand(words); return; }
  clip.writeText(inviteLink(crew)).then(() => { crewNote = "Link copied - send it to the people you want in this crew."; fillCrew(); }, () => linkByHand(words));
}
function shareLink(crew) {
  crewNote = "";
  fillCrew();
  let shared;
  try { shared = navigator.share({text: shareText(crew)}); } catch (e) { shared = Promise.reject(e); }
  Promise.resolve(shared).catch(e => {
    if (e && (e.name === "AbortError" || e.name === "InvalidStateError")) return;
    linkByHand("Couldn't open sharing - the link is above; copy it from there.");
  });
}

/* What boot() registers on the crew panel: its three forms, and its clicks. */
function onCrewSubmit(e) {
  e.preventDefault();
  if (e.target.id === "crewCreateForm") {
    const name = field("crewNewName").value, me = field("crewCreateMe").value;
    crewAct(() => createCrew(name, me), (crew, here) => madeOrJoined(crew, `${crew.name} is made. Share the link to bring people in.`,
      `${crew.name} is made - it will show here once this phone reaches the server.`, here));
  } else if (e.target.id === "crewJoinForm") {
    const invite = crewInvite || field("crewPaste").value, me = field("crewJoinMe").value;
    const found = readInvite(invite), mine = !crewBusy && found && found.year === YEAR ? keptWithToken(found.token) : null;
    if (mine) { alreadyIn(mine); requestRender(); return; }
    crewAct(() => joinCrew(invite, me), (crew, here) => {
      takePendingJoin();
      return madeOrJoined(crew, `You're in ${crew.name}.`, `You're in ${crew.name} - it will show here once this phone reaches the server.`, here);
    });
  } else if (e.target.id === "crewNameForm") {
    /* Enter on a name empty or unchanged sends nothing, as Save, disabled,
       would. A 204 is no proof - row-level security answers it for a row
       it turned away - so the words wait for the pull: the name sent, or
       the name as it was and Save again. */
    const crew = crewStep === "manage" ? keptCrew() : null, typed = field("crewMyName").value;
    if (!crew || !nameToSave(crew)) return;
    const name = typed.trim(), shows = () => { const c = keptCrew(), me = c ? myMembership(c) : null; return me ? me.display_name === name : null; };
    crewAct(() => setMyName(crew.id, typed), (answer, here) => {
      if (!here) return {};
      crewCatchUp = {done: () => shows() === true, note: `Your name in this crew is now ${name}.`};
      return {refused: () => (shows() === false ? NAME_KEPT : "")};
    }, field("crewMyName"));
  }
}
function onCrewClick(e) {
  const t = e.target;
  if (t.closest("#closeSheetCrew")) { closeSheet(); return; }
  if (crewBusy) return;
  if (t.closest("#crewMoreCreate, #crewMoreJoin")) {
    openCrew(t.closest("#crewMoreCreate") ? "create" : "join");
    focusTitle("sheetTitleCrew");
    return;
  }
  const crew = crewStep === "manage" ? keptCrew() : null;
  if (!crew) return;
  if (t.closest("#crewCopy")) copyLink(crew);
  else if (t.closest("#crewShare")) shareLink(crew);
  else if (t.closest("#crewRenew")) {
    const dead = crew.invite_token;
    crewAct(() => newInvite(crew.id), (token, here) => {
      deadTokens.set(crew.id, dead);
      if (!here) return {};
      crewNote = RENEWED;
      crewCatchUp = {done: () => { const c = keptCrew(); return !!c && c.invite_token !== dead; }, note: RENEWED};
      return {landed: "New link made - it will show here once this phone reaches the server."};
    });
  } else if (t.closest(".crew-remove")) {
    const who = (crew.members || []).find(m => m.user_id === t.closest(".crew-remove").dataset.user);
    if (!who || !confirm(`Remove ${who.display_name} from ${crew.name}?`)) return;
    crewAct(() => removeMember(crew.id, who.user_id), (answer, here) => {
      if (!here) return {};
      crewNote = `${who.display_name} is out. They can still join with the current link until you make a new one.`;
      crewCatchUp = {done: () => { const c = keptCrew(); return !!c && !(c.members || []).some(m => m.user_id === who.user_id); }, note: crewNote};
      return {};
    });
  } else if (t.closest("#crewLeave")) {
    crewAct(() => leaveCrew(crew.id), (answer, here) => leftCrew(crew.id, here));
  } else if (t.closest("#crewDelete")) {
    if (!confirm(`Delete ${crew.name}? Everyone in it loses the crew, and the link stops working.`)) return;
    crewAct(() => deleteCrew(crew.id), (answer, here) => leftCrew(crew.id, here));
  }
}
/* boot()'s, once the invite is read: a kept ?join= opens Plans' join step
   on arrival, in any phase (#62, #63), and sends nothing. The schedule is
   not needed for it, so it does not wait for the load. */
function openKeptJoin() { if (hasBackend && pendingJoin()) openSheet("crew", "join"); }

/* ---- Share a day (W25; DECISIONS #10, #50, #69; docs/screens/contract.md,
   section 5) ----------------------------------------------------------- */
/* The share panel, from My day's action strip: a chip for each con day that
   holds a pick of the reader's - today's, else the next one's, chosen as it
   opens - the message exactly as it will be sent, in a read-only field, and
   Share where the browser can take it, Copy always. Drawn as it opens; a
   chip after that rewrites the message and which chip is pressed, and
   nothing else, so focus stays on the chip. Share and Copy send what the
   field holds, make no request, and are called in the tap itself, as the
   invite's are. The link needs no backend. */
const yearSchedule = () => [...byId.values()];
const SHARE_ROWS = 12;
let shareDay = null;
function dayShareText() {
  const schedule = yearSchedule(), list = sharedPicks(schedule, picks, shareDay);
  return dayMessage(shareDay, list, dayLink(location.href, shareDay, list, schedule));
}
const canShareText = text => typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare({text}));
function openShare() {
  const days = shareableDays(yearSchedule(), picks);
  shareDay = defaultShareDay(days, conDayKey(now()));
  panelShare.innerHTML = `<h2 id="sheetTitleShare" tabindex="-1">Share a day</h2>
    <div class="share-days" role="group" aria-label="Day to share">${days.map(d => chipHTML(DAY_LABEL[d], d === shareDay, "share-day", d)).join("")}</div>
    <label class="share-label">Message <textarea id="shareText" readonly></textarea></label>
    <p class="share-note" id="shareNote" role="status"></p>
    <div class="rowbtns"><button class="btn" type="button" id="shareSend">Share</button><button class="btn quiet" type="button" id="shareCopy">Copy</button></div>
    <div class="rowbtns"><button class="btn quiet" type="button" id="closeSheetShare">Done</button></div>`;
  fillShare();
}
function fillShare(note = "") {
  for (const chip of panelShare.querySelectorAll("[data-chip]")) chip.setAttribute("aria-pressed", String(chip.dataset.value === shareDay));
  const text = dayShareText(), box = field("shareText");
  box.value = text;
  box.rows = Math.min(text.split("\n").length, SHARE_ROWS);
  fitShareText();
  field("shareSend").hidden = !canShareText(text);
  field("shareNote").textContent = note;
}
/* The field as tall as the message wraps to, up to the stylesheet's cap -
   measured once it is shown, so openSheet() asks again after showing it. A
   page not laid out, jsdom's, measures nothing, and the rows stand. */
function fitShareText() {
  const box = document.getElementById("shareText");
  if (!box) return;
  box.style.height = "";
  if (box.scrollHeight) box.style.height = `${box.scrollHeight + box.offsetHeight - box.clientHeight}px`;
}
const shareShown = () => !sheetWrap.hidden && !panelShare.hidden;
/* A refusal of either selects the message in its field, with words. */
function shareByHand(words) {
  if (!shareShown()) return;
  const box = field("shareText");
  box.focus();
  box.select();
  field("shareNote").textContent = words;
}
/* What boot() registers on the share panel: its chips, Share, Copy, Done. A
   share the reader cancelled says nothing. */
function onShareClick(e) {
  const t = e.target;
  if (t.closest("#closeSheetShare")) { closeSheet(); return; }
  const chip = t.closest("[data-chip]");
  if (chip) { shareDay = chip.dataset.value; fillShare(); return; }
  const text = field("shareText").value;
  if (t.closest("#shareCopy")) {
    fillShare();
    const clip = navigator.clipboard, words = "Couldn't copy - select the message above and copy it.";
    if (!clip || typeof clip.writeText !== "function") { shareByHand(words); return; }
    clip.writeText(text).then(() => { if (shareShown()) field("shareNote").textContent = "Copied - paste it into any chat."; }, () => shareByHand(words));
  } else if (t.closest("#shareSend")) {
    fillShare();
    let shared;
    try { shared = navigator.share({text}); } catch (err) { shared = Promise.reject(err); }
    Promise.resolve(shared).catch(err => {
      if (err && (err.name === "AbortError" || err.name === "InvalidStateError")) return;
      shareByHand("Couldn't open sharing - the message is above; copy it from there.");
    });
  }
}

/* The day shared with the reader: a ?day= link, read as boot() reads the
   invite and taken out of the address, ?now= and the hash left as they were.
   A join wins - an invite in the address or one the session kept - and the
   day is dropped. What it says is kept in memory alone, never in storage,
   and no request is made for it: it waits for the schedule, and opens over
   whatever tab the phase opens on, with a backend or without. A reload
   loses it; the link in the chat is the way back. */
let dayLinkKept = null;   // the address's query, until the schedule is here
let sharedDay = null;     // what readSharedDay() made of it, while its panel is up
let sharedBack = null;    // {scroll, focus}: an event opened from the shared day, which its close goes back to
function takeDayLink() {
  if (!/[?&]day=/.test(location.search)) return;
  dayLinkKept = hasBackend && pendingJoin() ? null : location.search;
  const rest = location.search.replace(/^\?/, "").split("&").filter(p => p && p !== "day" && !p.startsWith("day="));
  /* The whole address with its query replaced, as readJoinLink() does it. */
  const address = new URL(location.href);
  address.search = rest.length ? "?" + rest.join("&") : "";
  history.replaceState(null, "", address.href);
}
/* boot()'s, once the schedule has loaded: the shared day, or the words for a
   link that is not one. With no schedule there is nothing to show it from. */
function openSharedDay() {
  const text = dayLinkKept;
  dayLinkKept = null;
  if (text === null || !byId.size) return;
  sharedDay = readSharedDay(text, yearSchedule());
  openSheet("shared");
}
/* The panel: "<Day>, shared with you", its events as rows in start order -
   one not on that day carrying its day's label - each with the reader's own
   star; a line that says the list is not kept, and one that counts what
   this schedule could not find and says when the link looks cut short. A
   removed event is marked and carries no
   star (#49), a cancelled one marked, as a row is anywhere. A link that is
   not one, or another year's, says so instead. */
const SHARED_KEPT = "This list isn't saved: it goes when you close it. Star what you want to keep.";
const sharedRowHTML = ev => rowHTML(ev, {list: "shared", showDay: ev._cd !== sharedDay.day});
function sharedHTML(shared) {
  const done = `<div class="ev-actions"><button class="btn" id="closeSheetShared">Done</button></div>`;
  if (shared.error) {
    const words = shared.error === "other_year"
      ? `That link is a day from Dragon Con ${shared.year}, and this planner is ${YEAR}'s, so there's nothing of it to show.`
      : "That link doesn't hold a day of the schedule. It was probably cut short when it was copied - ask for it again, or copy all of it.";
    return `<div class="ev-head"><h2 id="sheetTitleShared" tabindex="-1">A shared day</h2><p class="shared-note">${esc(words)}</p></div>${done}`;
  }
  /* What the link lacked, in one line: what this schedule could not find,
     and - its last token short, or empty - that it was likely cut short; a
     link ending in "-" has the second alone. */
  const n = shared.skipped;
  const said = n ? `${n === 1 ? "1 event in the link isn't" : `${n} events in the link aren't`} on this copy of the schedule${shared.cut ? " - the link may have been cut short when it was copied" : ""}.`
    : shared.cut ? "The link may have been cut short when it was copied." : "";
  const skipped = said ? `<p class="shared-note" id="sharedSkipped">${said}</p>` : "";
  const body = shared.events.length ? `<ul class="list compact">${shared.events.map(sharedRowHTML).join("")}</ul>`
    : `<p class="shared-note">Nothing in the link is on this copy of the schedule.</p>`;
  return `<div class="ev-head"><h2 id="sheetTitleShared" tabindex="-1">${esc(DAY_LONG[shared.day] || shared.day)}, shared with you</h2>
      <p class="shared-note">${SHARED_KEPT}</p>${skipped}</div>
    <div class="ev-body" id="sharedBody">${body}</div>${done}`;
}
/* shell.js render()'s: the open shared day follows the picks - its own taps,
   the event's sheet, a pull - each row's class, its words and its star
   written in place, so an overlap flag comes and goes at once (#73) and the
   panel's scroll and the focus on a star stay. */
function refreshSharedDay() {
  if (sheetWrap.hidden || panelShared.hidden || !sharedDay || sharedDay.error) return;
  const holder = document.createElement("ul");
  for (const li of panelShared.querySelectorAll(".row[data-id]")) {
    const ev = byId.get(li.dataset.id);
    if (!ev) continue;
    holder.innerHTML = sharedRowHTML(ev);
    const fresh = holder.firstElementChild;
    if (li.className !== fresh.className) li.className = fresh.className;
    refill(li.querySelector(".row-main"), fresh.querySelector(".row-main"));
    refill(li.querySelector(".star"), fresh.querySelector(".star"));
  }
}
/* Back (#63): an event opened from the shared day closes to it - the panel
   shown again, not drawn again, its scroll put back and focus on the row
   that opened the event. The record is taken whenever the shared panel
   closes or another panel opens. */
function backToShared() {
  const back = sharedBack;
  sharedBack = null;
  state.sheetId = null;
  sheetEl.classList.remove("settling");
  sheetEl.style.transform = "";
  sheetBackEl.style.opacity = "";
  sheetBackEl.classList.remove("dragging");
  dragY = null;
  panelEvent.hidden = true;
  panelShared.hidden = false;
  sheetEl.setAttribute("aria-labelledby", TITLES.shared);
  requestRender();
  const body = document.getElementById("sharedBody");
  if (body) body.scrollTop = back.scroll;
  const again = (back.focus && shownMatch(back.focus)) || document.getElementById(TITLES.shared);
  if (again) again.focus({preventScroll: true});
}

const TITLES = {event: "sheetTitleEvent", hotel: "sheetTitleHotel", crew: "sheetTitleCrew", share: "sheetTitleShare", shared: "sheetTitleShared",
  filters: "sheetTitleFilters"};

/* kind: settings, event, hotel, crew, share, shared or filters; id: the
   event's, the hotel's, or the crew panel's step - create, join or manage.
   The crew panel needs a backend: with none there are no crews. Share needs
   a day to share, shared a day read from a link, and filters - Search's
   filter sheet (#70) - a schedule. Focus goes to the panel's
   heading, and closing puts it back on what opened the sheet (#66), kept
   as scroll.js focusKey() puts it, since the redraw that closing asks for
   replaces it. An event opened from the shared day keeps the way back to
   it; any other panel opening takes it. */
function openSheet(kind = "settings", id = null) {
  if (kind === "event" && !byId.get(id)) return;
  if (kind === "hotel" && !MAP_HOTELS[id]) return;
  if (kind === "crew" && !hasBackend) return;
  if (kind === "share" && !shareableDays(yearSchedule(), picks).length) return;
  if (kind === "shared" && !sharedDay) return;
  if (kind === "filters" && !events.length) return;
  const fromShared = kind === "event" && !sheetWrap.hidden && !panelShared.hidden && !!sharedDay && !sharedDay.error;
  if (fromShared) sharedBack = {scroll: (document.getElementById("sharedBody") || {}).scrollTop || 0, focus: focusKey(document.activeElement)};
  else if (kind !== "shared") dropShared();     // any other panel: the shared day and its way back go
  if (sheetWrap.hidden) opener = focusKey(document.activeElement);
  sheetScrollY = pageScrollTop();
  state.sheetId = kind === "event" ? id : null;
  state.sheetHotel = kind === "hotel" ? id : null;
  if (kind === "event") panelEvent.innerHTML = eventSheetHTML(byId.get(id));
  else if (kind === "hotel") drawHotelSheet(mapDay());
  else if (kind === "crew") openCrew(id || "manage");
  else if (kind === "share") openShare();
  else if (kind === "shared") panelShared.innerHTML = sharedHTML(sharedDay);
  else if (kind === "filters") { settleWords(); panelFilters.innerHTML = filtersHTML(); }   // the box left by the tap on Filters (#71)
  else fillSettings();
  panelSettings.hidden = kind !== "settings";
  panelEvent.hidden = kind !== "event";
  panelHotel.hidden = kind !== "hotel";
  panelCrew.hidden = kind !== "crew";
  panelShare.hidden = kind !== "share";
  panelShared.hidden = kind !== "shared";
  panelFilters.hidden = kind !== "filters";
  sheetEl.setAttribute("aria-labelledby", TITLES[kind] || "sheetTitle");
  sheetEl.style.transform = "";
  sheetWrap.hidden = false;
  if (kind === "share") fitShareText();
  focusTitle(TITLES[kind] || "sheetTitle");
}
function focusTitle(id) {
  const title = document.getElementById(id);
  if (title) title.focus({preventScroll: true});
}

/* The shared day goes with its panel: the list, its way back, its rows. */
function dropShared() {
  sharedBack = null;
  sharedDay = null;
  if (panelShared.firstChild) panelShared.innerHTML = "";
}
/* See all, from an event: the Explore page, whatever the event was opened
   from - an event opened from the shared day closes both, and the list goes. */
function closeWholeSheet() {
  sharedBack = null;
  closeSheet();
}

/* Closing the crew panel's join step unjoined takes the kept invite: the
   reader declined it, and a reload does not ask again (#62, #63). Focus
   goes back to what opened the sheet where it is on screen; a crew panel
   whose opener the redraw took away - a first crew made, the last one
   left - gives it to what Plans' header now holds. The filter sheet closed
   with anything changed brings the list back to its top: the old place in
   it is no place in the new one. */
function closeSheet() {
  if (sharedBack && !sheetWrap.hidden && !panelEvent.hidden) { backToShared(); return; }
  dropShared();
  if (!sheetWrap.hidden && !panelFilters.hidden && filtersChanged()) sheetScrollY = 0;
  const crewShown = !sheetWrap.hidden && !panelCrew.hidden;
  if (crewShown) {
    if (crewStep === "join") takePendingJoin();
    crewOpened++;
  }
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
  const back = (opener && shownMatch(opener)) || (crewShown ? shownMatch("#crewPick, #crewManageBtn, #crewStartBtn") : null);
  opener = null;
  if (back) back.focus({preventScroll: true});
}
/* Escape closes the sheet, whatever it shows (#66); a key an input method
   is still composing with is left to it - WebKit sends the key that ends a
   composition after it, as keyCode 229. */
function onSheetKeydown(e) {
  if (e.key !== "Escape" || e.isComposing || e.keyCode === 229 || sheetWrap.hidden) return;
  e.preventDefault();
  closeSheet();
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
  if (e.target.closest(".ev-body, textarea, .filters-body")) return;   // let the description scroll, the message to share, and the filters
  const crew = e.target.closest("#panel-crew");
  if (crew && crew.scrollHeight > crew.clientHeight) return;   // and the crew panel, when it is taller than the screen
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
/* And Sign out, which only a user signed in with an email is shown. What
   waits to be sent goes first: if anything still waits after the try, the
   sign-out is refused, and sync's line under the status says how much,
   while the session and sync's keys stay as they are. Only with the outbox
   empty does it go, sync's own keys with the session, so a later sign-in,
   even as the same user, sends the whole plan again; the plan itself stays.
   A session lost on the way leaves nothing to sign out of, and says so. A
   second tap meanwhile does nothing. */
async function onKeepClick(e) {
  if (!e.target.closest("#keepSignOut") || keepBusy) return;
  keepBusy = true;
  keepNote = "";
  fillKeep();
  try {
    const waiting = await sendBeforeSignOut();
    if (!signedInAs()) {
      forgetSync();
      keepNote = plainMessage({code: "session_lost"});
    } else if (!waiting) {
      signOut();
      forgetSync();
      keepNote = "Signed out. Your plan stays on this phone.";
    }
  } finally {
    keepBusy = false;
    fillKeep();
  }
}

export {
  sheetWrap, sheetEl, panelEvent, panelHotel, panelCrew, panelShare, panelShared, panelFilters, hotelSheetHTML, drawHotelSheet, showHotelCrew,
  openSheet, closeSheet, closeWholeSheet, onSheetKeydown, onShareClick, takeDayLink, openSharedDay, refreshSharedDay, setDrag, onSheetTouchStart, onSheetTouchMove, onSheetTouchEnd, onSheetTouchCancel,
  onSettingsClick, onCrowdInput, onNoiseDefaultChange, onResetPicks, onKeepSubmit, onKeepClick,
  refreshCrewPanel, refreshHotelSheet, onCrewSubmit, onCrewClick, onCrewInput, openKeptJoin,
};
