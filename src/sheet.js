/* The bottom sheet: one wrapper and four panels - Settings, an event, a
   hotel, a crew - with what fills each, what opens and closes it, the
   swipe and the Escape that dismiss it, focus into it and back (#66), and
   the handlers boot() registers on it, on the Settings controls - the email
   step's among them - and in the crew panel, whose state is this module's.
   A pull's redraw refills the open crew panel, the open event's who's-going
   line and the open hotel's crew, in place.
   The clicks inside the event and hotel panels are dispatch's: they reach
   further than the sheet. closeSheet() asks for its redraw over the bus,
   because render() is the shell's, above this module. The eight elements
   are looked up as the module is imported, so the markup has to be there
   first. */
import { esc, fmtShort } from "./util.js";
import { YEAR } from "./season.js";
import { saveJSON } from "./storage.js";
import { deviceLine, storageKey } from "./build.js";
import { hasBackend } from "./backend.js";
import { codeSentTo, confirmCode, plainMessage, sendCode, signedInAs, signOut } from "./identity.js";
import {
  createCrew, crewMessage, deleteCrew, goingTo, inviteLink, isCreator, joinCrew, leaveCrew, myCrews, myMembership, newInvite,
  pendingJoin, readInvite, removeMember, setMyName, takePendingJoin,
} from "./crews.js";
import { settings, state } from "./state.js";
import { DAY_LONG, localInputValue, timeOverride } from "./time.js";
import { hotelPhrase, hotelVar, placeHTML, WALK } from "./venues.js";
import { byId, directWorks, events, isCeleb, tagsOf, worksById } from "./data.js";
import { picks, replacePicks, savePicks } from "./picks.js";
import { CELEB_BADGE, crewLineHTML, rowHTML } from "./ui.js";
import { focusIn, focusKey, pageScrollTo, pageScrollTop, refill, shownMatch } from "./scroll.js";
import { requestRender } from "./bus.js";
import { fillSyncStatus, forgetSync, runSync, sendBeforeSignOut, syncAfter } from "./sync.js";
import { MAP_HOTELS, mapCrewCounts, mapCrewPicks, mapDay } from "./map.js";
import { chosenCrew, crewPeople } from "./plans.js";

/* Bottom sheet: one wrapper, four panels (settings, event, hotel, crew) */
const sheetWrap = document.getElementById("sheetWrap");
const sheetEl = document.getElementById("sheet");
const panelSettings = document.getElementById("panel-settings");
const panelEvent = document.getElementById("panel-event");
const panelHotel = document.getElementById("panel-hotel");
const panelCrew = document.getElementById("panel-crew");
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

/* Who's going (W22; DECISIONS #62, #64): the crewmates whose picks hold the
   event, by name, three of them and then how many more - from what the pull
   kept (crews.js goingTo()), so on a build with a backend alone, and never
   for a removed event, which is not happening. "" for no one. Every name is
   someone's own text, escaped where it is drawn. In 2027 it taps nowhere.
   The screen says what they starred, "Starred by", never that they are
   going: a star is a pick (#68). The code's names - goingText(),
   #sheetGoing, .ev-going - keep "going". */
const GOING_NAMED = 3;
function goingText(ev) {
  const going = hasBackend && !ev.removed ? goingTo(ev.id) : [];
  if (!going.length) return "";
  const more = going.length - GOING_NAMED;
  return `Starred by ${going.slice(0, GOING_NAMED).map(p => p.display_name).join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

function eventSheetHTML(ev) {
  const mine = picks.has(ev.id), going = goingText(ev);
  /* Each person as this listing spells them, with the role it gives them;
     See all opens their page by id. */
  const peopleRows = (ev.people || []).filter(p => p && p.name).map(p => ({
    id: p.id,
    label: p.role && p.role !== "Speaker" && p.role !== "Panelist" ? `${p.name} (${p.role.toLowerCase()})` : p.name,
  }));
  const dur = ev.duration_min ? (ev.duration_min >= 60 ? `${Math.floor(ev.duration_min / 60)} h${ev.duration_min % 60 ? ` ${ev.duration_min % 60} min` : ""}` : `${ev.duration_min} min`) : "";
  const chips = [...(ev.tracks || []), ...directWorks(ev).map(id => (worksById.get(id) || {}).name).filter(Boolean)];
  const mature = tagsOf(ev).audience === "mature";
  /* The calendar takes only what is on the schedule: Plans' export leaves a
     removed pick out, and so does this, the other door to the same calendar
     (DECISIONS #49). A cancelled event keeps its button, as it always had. */
  const ics = ev.removed ? "" : `<button class="btn quiet" id="sheetICS">Add this to calendar</button>`;
  return `<div class="ev-head">
      <h2 id="sheetTitleEvent" tabindex="-1">${esc(ev.title)}</h2>
      <div class="ev-when">${DAY_LONG[ev.day] || ev.day}, ${fmtShort(ev._s)} to ${fmtShort(ev._e)}${dur ? ` &middot; ${dur}` : ""}${ev._cd !== ev.day ? ` &middot; ${DAY_LONG[ev._cd] || ev._cd} night` : ""}</div>
      <div class="ev-room" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      ${ev.cancelled ? `<div><span class="cancelled-tag">Cancelled</span></div>` : ""}
      ${ev.removed ? `<div><span class="removed-tag">Removed from the schedule</span></div>` : ""}
      ${isCeleb(ev) ? `<div>${CELEB_BADGE}</div>` : ""}
      <p class="ev-going" id="sheetGoing"${going ? "" : " hidden"}>${esc(going)}</p>
    </div>
    <div class="ev-body">
      ${ev.description ? `<p>${esc(ev.description)}</p>` : `<p style="color:var(--muted)">No description.</p>`}
      ${peopleRows.length ? `<div class="ev-people">With ${peopleRows.map(p =>
        `<span class="who"><span>${esc(p.label)}</span> <button class="see-all" data-explore="person:${esc(p.id)}">See all</button></span>`).join(", ")}</div>` : ""}
      ${chips.length || mature ? `<div class="tagline">${chips.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${mature ? `<span class="tag adult">18+</span>` : ""}</div>` : ""}
    </div>
    <div class="ev-actions">
      <button class="ev-star" id="sheetStar" aria-pressed="${mine}" aria-label="${mine ? "Remove from my schedule" : "Add to my schedule"}"${ev.removed && !mine ? " disabled" : ""}>${mine ? "★" : "☆"}</button>
      ${ics}
      <button class="btn" id="closeSheetEvent">Done</button>
    </div>`;
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
/* And the open event - `state.sheetId` is one only while its panel is
   shown: its who's-going line alone, its words and whether it shows, in
   place - the panel is never drawn again for it, so focus and everything
   else in the sheet stay as they are (#66). */
function refreshEventSheet() {
  const ev = state.sheetId ? byId.get(state.sheetId) : null, line = document.getElementById("sheetGoing");
  if (!ev || !line) return;
  const going = goingText(ev);
  if (line.textContent !== going) line.textContent = going;
  line.hidden = !going;
}
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

const TITLES = {event: "sheetTitleEvent", hotel: "sheetTitleHotel", crew: "sheetTitleCrew"};

/* kind: settings, event, hotel or crew; id: the event's, the hotel's, or
   the crew panel's step - create, join or manage. The crew panel needs a
   backend: with none there are no crews. Focus goes to the panel's
   heading, and closing puts it back on what opened the sheet (#66), kept
   as scroll.js focusKey() puts it, since the redraw that closing asks for
   replaces it. */
function openSheet(kind = "settings", id = null) {
  if (kind === "event" && !byId.get(id)) return;
  if (kind === "hotel" && !MAP_HOTELS[id]) return;
  if (kind === "crew" && !hasBackend) return;
  if (sheetWrap.hidden) opener = focusKey(document.activeElement);
  sheetScrollY = pageScrollTop();
  state.sheetId = kind === "event" ? id : null;
  state.sheetHotel = kind === "hotel" ? id : null;
  if (kind === "event") panelEvent.innerHTML = eventSheetHTML(byId.get(id));
  else if (kind === "hotel") drawHotelSheet(mapDay());
  else if (kind === "crew") openCrew(id || "manage");
  else fillSettings();
  panelSettings.hidden = kind !== "settings";
  panelEvent.hidden = kind !== "event";
  panelHotel.hidden = kind !== "hotel";
  panelCrew.hidden = kind !== "crew";
  sheetEl.setAttribute("aria-labelledby", TITLES[kind] || "sheetTitle");
  sheetEl.style.transform = "";
  sheetWrap.hidden = false;
  focusTitle(TITLES[kind] || "sheetTitle");
}
function focusTitle(id) {
  const title = document.getElementById(id);
  if (title) title.focus({preventScroll: true});
}

/* Closing the crew panel's join step unjoined takes the kept invite: the
   reader declined it, and a reload does not ask again (#62, #63). Focus
   goes back to what opened the sheet where it is on screen; a crew panel
   whose opener the redraw took away - a first crew made, the last one
   left - gives it to what Plans' header now holds. */
function closeSheet() {
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
  if (e.target.closest(".ev-body")) return;   // let the description scroll
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
  sheetWrap, sheetEl, panelEvent, panelHotel, panelCrew, eventSheetHTML, hotelSheetHTML, drawHotelSheet, showHotelCrew,
  openSheet, closeSheet, onSheetKeydown, setDrag, onSheetTouchStart, onSheetTouchMove, onSheetTouchEnd, onSheetTouchCancel,
  onSettingsClick, onCrowdInput, onNoiseDefaultChange, onResetPicks, onKeepSubmit, onKeepClick,
  refreshCrewPanel, refreshEventSheet, refreshHotelSheet, onCrewSubmit, onCrewClick, onCrewInput, openKeptJoin,
};
