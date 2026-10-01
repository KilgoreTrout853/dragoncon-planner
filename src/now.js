/* The Now tab: the hero for the pick that is on or next, the crew's right
   now for a reader in one, what else is on and coming up, the record of the
   weekend once the con is over, and the minute tick that keeps the
   countdowns honest without rebuilding the list - and the install nudge,
   the tab's first card once the reader has a pick and until the app is on
   the home screen. render(), in shell.js, and the minute tick, in
   dispatch.js, call renderNow() and tickNow(); nothing here draws anything
   else. Whatever had focus on the tab has it again after either draws. */
import { esc, fmtShort, minutesBetween } from "./util.js";
import { loadJSON } from "./storage.js";
import { IS_IOS, isStandalone } from "./platform.js";
import { storageKey } from "./build.js";
import { hasBackend } from "./backend.js";
import { crewRightNow } from "./crews.js";
import { state } from "./state.js";
import { CON, conDayKey, conEnded, conPhase, DAY_LONG, effectiveNow, now } from "./time.js";
import { hotelMatches, hotelShort, hotelVar, placeHTML, placeShort } from "./venues.js";
import { events, hotelChips, isNoise } from "./data.js";
import { pickNews, pickNewsHTML, picks } from "./picks.js";
import { connection, gapHTML, walkEstimate } from "./walk.js";
import { chipHTML, rowHTML } from "./ui.js";
import { cssEsc, focusIn, giveFocusBack, refill } from "./scroll.js";
import { requestRender } from "./bus.js";

/* ---- Now ---------------------------------------------------------- */
const RING_R = 26, RING_C = 2 * Math.PI * RING_R;
function ringHTML(fraction, minutes) {
  const f = Math.max(0, Math.min(1, fraction));
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${Math.max(0, minutes)}`;
  return `<div class="ring"><svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
      <circle class="track-c" cx="31" cy="31" r="${RING_R}" fill="none" stroke-width="5"></circle>
      <circle class="prog" cx="31" cy="31" r="${RING_R}" fill="none" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${(RING_C * (1 - f)).toFixed(1)}"></circle>
    </svg><div class="num">${label}<small>${minutes >= 60 ? "" : "min"}</small></div></div>`;
}

/* What comes after the pick that is on: the next pick today and the
   connection between the two, the band in the gap line's words - the gap
   line under the hero is the same pair, and the app holds one opinion about
   it (#40, #64). Never when to leave: that would say where the reader is. A
   pair with no band says what is next and no more - by its building, or by
   its title for a stream, which has none. */
function thenHTML(on, next) {
  const c = connection(on, next);
  const name = esc(next.hotel === "Streaming" ? next.title : hotelShort(next.hotel));
  const at = `then <b>${name}</b> at ${fmtShort(next._s)}`;
  let then, warn = false;
  if (!c || !c.band) then = c && on.hotel !== next.hotel ? `${at}, ~${c.walk} min walk` : `then ${name} next`;
  else if (c.band === "overlap") { then = `${at}: overlaps by ${c.overlap} min`; warn = true; }
  else if (c.band === "cant") { then = `${at}: ${c.gap} min to get there, ~${c.walk} min walk`; warn = true; }
  else then = `${at}: ${c.gap} min gap, ~${c.walk} min walk. Tight but doable`;
  return `<span class="hthen${warn ? " warn" : ""}"> &middot; ${then}</span>`;
}

/* The ring counts to the end of the pick that is on, else to the start of
   the next. Its line: "ends 2:00 PM" and what comes after; or, with nothing
   on, "starts 3:00 PM", and the walk from the pick before offered as an
   estimate, not an instruction. */
function heroHTML(ev, now, onNow, thenNext) {
  let kicker, line, walkLine = "", target, windowStart;
  if (onNow) {
    kicker = "On now";
    target = ev._e;
    windowStart = ev._s;
    line = `ends ${fmtShort(ev._e)}${thenNext ? thenHTML(ev, thenNext) : ""}`;
  } else {
    kicker = "Your next";
    target = ev._s;
    windowStart = new Date(ev._s.getTime() - 60 * 60000);
    line = `starts ${fmtShort(ev._s)}`;
    const estimate = walkEstimate(ev);
    if (estimate) walkLine = `<div class="hthen hwalk">${esc(estimate.label)}</div>`;
  }
  const total = Math.max(1, minutesBetween(windowStart, target));
  const leftMin = minutesBetween(now, target);

  return `<button class="hero" id="nowHero" data-hero="${esc(ev.id)}">
    ${ringHTML(leftMin / total, leftMin)}
    <div class="hbody">
      <div class="hkicker">${kicker}</div>
      <div class="htitle">${esc(ev.title)}</div>
      <div class="hroom" style="--h:var(${hotelVar(ev.hotel)})">${placeHTML(ev)}</div>
      <div class="hwhen">${line}</div>${walkLine}
    </div>
  </button>`;
}

/* ---- The Now tab after the con ------------------------------------- */
/* The record: every starred event, by con day, in time order. Rows work
   as they do anywhere, so the list can still be tidied. */
const ARCHIVE_SIG = "archive";
function archiveHTML() {
  const mine = events.filter(e => picks.has(e.id));
  let html = pickNewsHTML() + `<div class="section-title">Your ${CON.year} schedule <span class="count">${mine.length}</span></div>`;
  if (!mine.length) return html + `<div class="empty"><b>Nothing starred.</b> Star things in Search and they'll be listed here by day.</div>`;
  html += `<ul class="list">`;
  let lastDay = "";
  mine.forEach(ev => {
    if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; }
    html += rowHTML(ev, {list: "archive"});
  });
  return html + `</ul>`;
}

/* What the Now tab would show, without building any of it.
   The plan is today's - the con day, which runs to 5am - because "your next"
   and what comes after it are about the next few hours, and a Saturday pick
   seen from Thursday was being announced as starting at 2:30 PM with no day
   on it. Anything still running past 5am counts as today too. A pick on a
   later day gets one line naming the day, so the tab never looks empty when
   the plan is not. */
function nowModel(now) {
  const horizon = new Date(now.getTime() + 60 * 60000);
  const today = conDayKey(now);
  const future = events.filter(e => picks.has(e.id) && e._e > now);
  const minePlan = future.filter(e => conDayKey(e._s) === today || e._s <= now);
  const later = minePlan.length ? null : (future.find(e => conDayKey(e._s) > today) || null);
  const onNowEv = minePlan.find(e => e._s <= now && now < e._e) || null;
  const upcoming = minePlan.filter(e => e._s > now);
  const heroEv = minePlan.length ? (onNowEv || upcoming[0]) : null;
  const rest = heroEv ? minePlan.filter(e => e !== heroEv) : [];
  const around = events.filter(e => e._e > now && e._s <= horizon
    && !(state.browse.hideNoise && isNoise(e))
    && hotelMatches(e, state.now.hotel));
  return {minePlan, later, onNowEv, upcoming, heroEv, rest, around, shown: around.slice(0, state.now.limit)};
}

const statusShown = (ev, now) => ev._s <= now || minutesBetween(now, ev._s) <= 90;

/* ---- Your crew right now (W23; DECISIONS #10, #62) ----------------- */
/* Each crewmate's pick on now, else their next today (crews.js
   crewRightNow()), from every crew the reader is in. Only on a build with a
   backend, and only while the clock - real or simulated - is inside the
   con: before it the tab previews a made-up moment, and after it the tab is
   the record. Nothing when no crewmate has anything left today. */
const CREW_SHOWN = 4;
const nowCrew = now => (hasBackend && conPhase() === "live" ? crewRightNow(events, now, conDayKey(now)) : []);
/* A line a crewmate, a button to the event's sheet: who and when - "on now"
   or the start - and "with you" when the reader picked it too; then what and
   where, the place as the Map's On now line names it. Its id is the
   crewmate's, so focus comes back to their line whatever they are on. Every
   name is someone's own text, so escaped. */
function crewLineHTML(c) {
  const ev = c.ev, withYou = picks.has(ev.id) ? ` &middot; <span class="cn-with">with you</span>` : "";
  return `<li><button class="crew-now" id="crewNow-${esc(c.user_id)}" data-hero="${esc(ev.id)}" aria-haspopup="dialog">
    <span class="cn-top"><b class="cn-who">${esc(c.display_name)}</b> &middot; ${c.on ? "on now" : fmtShort(ev._s)}${withYou}</span>
    <span class="cn-what"><span class="cn-title">${esc(ev.title)}</span><span class="cn-where" style="--h:var(${hotelVar(ev.hotel)})">&nbsp;&middot; ${esc(placeShort(ev))}</span></span>
  </button></li>`;
}
/* Four lines, then how many more, which opens Plans' crew's day on today. */
function crewHTML(crew) {
  if (!crew.length) return "";
  const more = crew.length - CREW_SHOWN;
  return `<div class="section-title">Your crew right now</div><ul class="list crew-now-list">${crew.slice(0, CREW_SHOWN).map(crewLineHTML).join("")}</ul>${more > 0
    ? `<button class="btn quiet more" id="crewMore" data-act="crew-more" aria-label="+${more} more of your crew, in Plans">+${more} more</button>` : ""}`;
}

/* Everything that decides which elements exist. The clock is deliberately
   absent: a new minute changes the words, not the structure. The crew's
   lines are in it - who, on what, on now or next - so the tick draws again
   when one moves on or ends. */
function nowSignature(m, now, banner, crew) {
  return [
    banner,
    m.heroEv ? m.heroEv.id : "-",
    m.later ? m.later.id : "-",
    pickNews.length,
    nudgeVisible() ? "nudge" : "-",
    m.onNowEv ? "on" : "next",
    m.rest.map(e => e.id + (statusShown(e, now) ? "!" : "")).join(","),
    m.around.length,
    m.shown.map(e => (e._s <= now ? "o" : "u") + e.id).join(","),
    crew.map(c => `${c.user_id}:${c.ev.id}${c.on ? "o" : "u"}${picks.has(c.ev.id) ? "w" : ""}`).join(","),
  ].join("|");
}
let lastNowSig = null;

/* The tab drawn whole; what had focus on it has it again (#66). */
function drawNow(html) {
  const view = document.getElementById("view-now"), back = focusIn(view);
  view.innerHTML = html;
  giveFocusBack(back);
}

function renderNow() {
  if (conEnded()) { lastNowSig = ARCHIVE_SIG; drawNow(archiveHTML()); return; }
  const {now, banner} = effectiveNow();
  const model = nowModel(now), crew = nowCrew(now);
  lastNowSig = nowSignature(model, now, banner, crew);
  const minePlan = model.minePlan;
  let mineHTML = nudgeHTML() + pickNewsHTML();
  /* The crew's section sits between the hero and Rest of your day; with no
     hero, after the line that says so. */
  if (minePlan.length) {
    const onNowEv = model.onNowEv, upcoming = model.upcoming, heroEv = model.heroEv;
    const thenNext = onNowEv ? upcoming[0] : null;
    mineHTML += heroHTML(heroEv, now, !!onNowEv, thenNext) + crewHTML(crew);
    const rest = model.rest;
    if (rest.length) {
      mineHTML += `<div class="section-title">Rest of your day <span class="count">${minePlan.length} today</span></div><ul class="list compact">`;
      rest.forEach((ev, i) => {
        const status = ev._s <= now ? `On now, ends ${fmtShort(ev._e)}` : `In ${minutesBetween(now, ev._s)} min`;
        mineHTML += gapHTML(i === 0 ? heroEv : rest[i - 1], ev) + rowHTML(ev, {list: "next", status: minutesBetween(now, ev._s) <= 90 || ev._s <= now ? status : ""});
      });
      mineHTML += `</ul>`;
    }
  } else if (model.later) {
    const day = DAY_LONG[conDayKey(model.later._s)] || model.later.day;
    mineHTML += `<div class="empty"><b>Nothing picked for later today.</b> Your next pick is on ${day}.</div>
      <ul class="list compact">${rowHTML(model.later, {list: "next", showDay: true})}</ul>` + crewHTML(crew);
  } else {
    mineHTML += `<div class="empty"><b>Nothing picked for later today.</b> Star things in Search and they show up here with walk times.</div>` + crewHTML(crew);
  }

  const around = model.around, shown = model.shown;
  let aroundHTML = `<div class="section-title">On now and in the next hour <span class="count">${around.length}</span></div>
    <div class="controls" style="padding-top:0"><div class="chips" data-row="now-hotel">${chipHTML("All", state.now.hotel === "All", "now-hotel")}${hotelChips.map(h => chipHTML(hotelShort(h), state.now.hotel === h, "now-hotel", h)).join("")}</div></div><ul class="list compact">`;
  let lastKey = "";
  shown.forEach(ev => {
    const key = ev._s <= now ? "on" : fmtShort(ev._s);
    if (key !== lastKey) { aroundHTML += `<li class="time-head">${key === "on" ? "On now" : "Starts " + key}</li>`; lastKey = key; }
    aroundHTML += rowHTML(ev, {list: "around"});
  });
  aroundHTML += `</ul>`;
  if (around.length > shown.length) aroundHTML += `<button class="btn quiet more" data-act="more-now">Show ${around.length - shown.length} more</button>`;
  if (!around.length) aroundHTML += `<div class="empty">Nothing on in this window${state.now.hotel !== "All" ? " at the " + hotelShort(state.now.hotel) : ""}.</div>`;
  drawNow(mineHTML + aroundHTML);
}

/* A minute changes the countdowns, not usually the list. Rebuilding the whole
   Now tab every 60s threw away and recreated every node under the reader's
   thumb; this redraws the hero and the "in N min" labels and leaves the rest
   alone, falling back to a full render the moment the structure really moves. */
function tickNow() {
  if (conEnded()) { if (lastNowSig !== ARCHIVE_SIG) renderNow(); return; }
  const {now, banner} = effectiveNow();
  const model = nowModel(now);
  const sig = nowSignature(model, now, banner, nowCrew(now));
  if (sig !== lastNowSig || !document.querySelector("#view-now .hero, #view-now .empty")) { renderNow(); return; }

  const view = document.getElementById("view-now");
  const heroEl = view.querySelector(".hero");
  if (heroEl && model.heroEv) {
    const holder = document.createElement("div");
    holder.innerHTML = heroHTML(model.heroEv, now, !!model.onNowEv, model.onNowEv ? model.upcoming[0] : null);
    const fresh = holder.firstElementChild;
    /* A countdown reading "2h" says the same thing a minute later; swapping the
       card anyway would drop a tap that happened to land on the tick. And a
       changed one is written into the card in place, so a card with focus
       keeps it and is not read out again. */
    if (fresh) refill(heroEl, fresh);
  }
  model.rest.forEach(ev => {
    const el = view.querySelector(`.row[data-list="next"][data-id="${cssEsc(ev.id)}"] .status`);
    if (!el) return;
    el.textContent = ev._s <= now ? `On now, ends ${fmtShort(ev._e)}` : `In ${minutesBetween(now, ev._s)} min`;
  });
}

/* Installing is the point for someone who arrived from a chat link: the
   app works with no signal only once it is on the home screen, and Safari
   keeps an uninstalled site's storage for only seven days without a visit.
   So once the reader has a pick - the thing the home screen keeps - the Now
   tab opens with a nudge until the app is installed, dismissible for a week
   at a time; over an empty plan it would be nagging (DECISIONS #65). No
   user-agent sniffing: one honest iOS message covers Safari and the in-app
   browsers, and Android gets the real install prompt when the browser
   offers one. */
const NUDGE_SNOOZE_MS = 7 * 24 * 3600 * 1000;
let installPrompt = null;
function nudgeVisible() {
  if (isStandalone() || !picks.size) return false;
  const until = loadJSON(storageKey("nudgeSnoozedUntil"), 0);
  return !(until && now().getTime() < until);
}
function nudgeCopy(ios, canPrompt) {
  if (ios) return {
    lead: "Add this to your home screen.",
    body: "In Safari: Share, then Add to Home Screen. If you opened this from a chat, tap the menu (the dots or the compass) and choose Open in Safari first. Once installed it works with no signal.",
    install: false,
  };
  if (canPrompt) return {lead: "Install this app.", body: "It opens like an app and works with no signal.", install: true};
  return {lead: "Add this to your home screen.", body: "From the menu (the three dots): Install app, or Add to Home screen. Once installed it works with no signal.", install: false};
}
function nudgeHTML() {
  if (!nudgeVisible()) return "";
  const c = nudgeCopy(IS_IOS, !!installPrompt);
  return `<div class="notice nudge" id="nudge"><b>${esc(c.lead)}</b> ${esc(c.body)}
    <div class="btns">${c.install ? `<button class="btn" data-act="nudge-install">Install app</button>` : ""}<button class="btn quiet" data-act="nudge-later">Not now</button></div></div>`;
}

/* What boot() registers for the install prompt: the browser offering one,
   and the app being installed. Both change what the nudge says, so both ask
   for a redraw - over the bus, because render() is the shell's. */
function onBeforeInstallPrompt(e) { e.preventDefault(); installPrompt = e; if (state.tab === "now") requestRender(); }
function onAppInstalled() { installPrompt = null; requestRender(); }
/* The reader tapping Install is heard by the delegated click handler, in
   dispatch, and a module that imports a let may not assign it.
   takeInstallPrompt() is the read and the clear in one: a prompt can be
   shown once. */
function takeInstallPrompt() { const p = installPrompt; installPrompt = null; return p; }

export {
  nowModel, renderNow, tickNow, NUDGE_SNOOZE_MS, nudgeCopy, onBeforeInstallPrompt, onAppInstalled,
  takeInstallPrompt,
};
