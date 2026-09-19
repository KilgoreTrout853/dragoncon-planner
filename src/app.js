import { dayOf, esc, fmtMins, fmtShort, minutesBetween, toDate } from "./util.js";
import { loadJSON, saveJSON } from "./storage.js";
import { IS_IOS } from "./platform.js";
import { deviceLine, devMarkHTML } from "./build.js";
import { settings, state } from "./state.js";
import {
  CON, CON_DAYS, conDayKey, conEnded, DAY_LABEL, DAY_LONG, initTimeOverride, isPast, isSimulated,
  localInputValue, now, setOverride, timeOverride,
} from "./time.js";
import { hotelPhrase, hotelShort, hotelVar, placeHTML, WALK, walkMin } from "./venues.js";
import { byId, DATA_URL, events, isCeleb, meta, NOISE_TRACKS, replaceSchedule } from "./data.js";
import {
  clearNews, pickNewsHTML, picks, reconcilePicks, replaceNews, replacePicks, savePickNews,
  savePicks,
} from "./picks.js";
import {
  eventsFor, FOLLOW_KINDS, followId, follows, isFollowing, replaceFollows, saveFollows,
  toggleFollow,
} from "./follows.js";
import { exportEventICS, exportICS } from "./ics.js";
import { currentLocation, gapHTML, leaveInfo, nextPickInConDay } from "./leave.js";
import { buildIndex, buildSuggestIndex, index, SEARCH_PLACEHOLDER, stripPhrase, tokenise } from "./search.js";
import { CELEB_BADGE, chipHTML, rowHTML } from "./ui.js";
import {
  chipRowsRestore, chipRowsSnapshot, cssEsc, pageScrollBy, pageScrollTo, pageScrollTop,
  revealChip, scroller,
} from "./scroll.js";
import { setRenderer } from "./bus.js";
import {
  clearInstallPrompt, effectiveNow, nowModel, NUDGE_SNOOZE_MS, renderNow, setInstallPrompt,
  takeInstallPrompt, tickNow,
} from "./now.js";
import { cancelQueuedBrowseRender, queueBrowseRender, renderBrowse } from "./browse.js";
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


/* ---- Map ---------------------------------------------------------- */
/* The venues' real positions at one scale - about 0.54 px per metre, the
   Hyatt's centre at (150, 250) - so the distances mean something: the
   Hyatt and the Marriott nearly touch, the Hilton is a real walk, the
   Westin sits south-east of the Mart just west of Peachtree, and the
   Marriott-Hilton bridge crosses Courtland St, as it does in life. Keys
   are the walk table's names, so counts, rings and routes join up by
   hotel. Streams and offsite venues have no place here. */
const MAP_W = 380;
/* The frame: the viewBox is cropped to the drawing, with the same inset
   around it that the card below uses as padding (about 14 px at phone
   width). Block coordinates stay as they are; only the frame, the streets
   and their labels are placed against it. */
const MAP_VIEW = {x: -3, y: 111, w: 385, h: 305};
const MAP_STREETS = {Peachtree: 110, Courtland: 296};
const MAP_HOTELS = {
  "AmericasMart":    {x: 12,  y: 216, w: 72, h: 64},
  "Westin":          {x: 48,  y: 332, w: 60, h: 56},
  "Hyatt":           {x: 120, y: 222, w: 60, h: 56},
  "Marriott":        {x: 190, y: 222, w: 60, h: 56},
  "Hilton":          {x: 307, y: 222, w: 60, h: 56},
  "Courtland Grand": {x: 300, y: 347, w: 60, h: 56},
  "Hardy Ivy Park":  {x: 117, y: 124, w: 60, h: 24, park: true},
};
/* Each pair is left-to-right or top-to-bottom. None crosses Peachtree. */
const MAP_BRIDGES = [["AmericasMart", "Westin"], ["Hyatt", "Marriott"], ["Marriott", "Hilton"]];

/* The user's picks in one hotel on one con day, in time order (events is). */
const mapPicksAt = (hotel, day) => events.filter(e => picks.has(e.id) && e.hotel === hotel && e._cd === day);
function mapCounts(day) {
  const counts = {};
  events.forEach(e => { if (picks.has(e.id) && e._cd === day && MAP_HOTELS[e.hotel]) counts[e.hotel] = (counts[e.hotel] || 0) + 1; });
  return counts;
}
/* A gold pill on the block's top-right corner; none at all when zero. A
   wide pill on a block at the right edge is pulled in to stay on the map. */
function mapPillSVG(hotel, b, n) {
  if (!n) return "";
  const w = n > 9 ? 30 : 22, h = 18, cx = Math.min(b.x + b.w - 2, MAP_W - 2 - w / 2), cy = b.y + 2;
  return `<g class="map-pill" data-hotel="${esc(hotel)}" data-count="${n}"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/><text x="${cx}" y="${cy}">${n}</text></g>`;
}
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

/* What today's overlay is made of, computed once per render: the on-now and
   next picks, where the reader is, and the hero's leave-by. Null on any day
   but the one the clock is in. */
function mapNowState(day) {
  const at = now();
  if (day !== conDayKey(at)) return null;
  const model = nowModel(at), next = model.upcoming[0] || null, from = currentLocation(at);
  return {now: at, onNow: model.onNowEv, next, from, info: leaveInfo(from, next, at)};
}
/* A solid gold ring on the hotel of the pick that is on now, a pulsing one on
   the hotel of the next pick. A next pick off the map gets no ring. */
function mapRingsSVG(st) {
  if (!st) return "";
  const ring = (h, cls) => {
    const b = MAP_HOTELS[h];
    if (!b) return "";
    const pad = cls === "next" ? 7 : 4;
    return `<rect class="map-ring ${cls}" data-hotel="${esc(h)}" x="${b.x - pad}" y="${b.y - pad}" width="${b.w + 2 * pad}" height="${b.h + 2 * pad}" rx="${(b.park ? 6 : 10) + pad}"/>`;
  };
  return (st.onNow ? ring(st.onNow.hotel, "now") : "") + (st.next ? ring(st.next.hotel, "next") : "");
}
/* The card under the map: the next pick, as the hero sees it - the same
   nowModel, the same leaveInfo. It shows whichever day the map has selected,
   because it is about now, not about the day being looked at. With nothing
   left today it shows the first pick of the next con day; with no picks at
   all, how to get one. */
function mapCardState() {
  const at = now(), model = nowModel(at), today = conDayKey(at);
  const next = model.upcoming[0] || null;
  const later = next ? null : (events.find(e => picks.has(e.id) && e._s > at && conDayKey(e._s) > today) || null);
  const from = currentLocation(at);
  return {now: at, onNow: model.onNowEv, next, later, from, info: next ? leaveInfo(from, next, at) : null};
}
function mapCardHTML(cs) {
  if (conEnded()) return "";                 // nothing is next any more
  const {now, onNow, next, later, info} = cs;
  const onLine = onNow ? `<button class="next-on" data-hero="${esc(onNow.id)}">On now: <b>${esc(onNow.title)}</b> &middot; ends ${fmtShort(onNow._e)} &middot; ${esc(onNow.hotel === "Other" ? (onNow.room || "offsite") : hotelShort(onNow.hotel))}</button>` : "";
  const ev = next || later;
  if (!ev) return onLine + `<div class="next-card empty">Star things in Search and your next pick shows here.</div>`;
  let label = "", when, cls = "";
  if (!next) {
    const dayKey = conDayKey(ev._s), tomorrow = conDayKey(new Date(now.getTime() + 24 * 3600000));
    label = `<div class="nc-label">${dayKey === tomorrow ? "Tomorrow" : esc(DAY_LONG[dayKey] || dayKey)}</div>`;
    when = fmtShort(ev._s);
  } else if (info && info.leaveBy && info.walk > 0) {
    /* A leave-by only for a walk that exists: a stream has nowhere to go. */
    const here = onNow && onNow.hotel === "Other" ? esc(onNow.room || "here") : esc(hotelPhrase(info.from));
    cls = info.late ? " leave late" : " leave";
    when = info.late ? `leave ${here} now` : `leave ${here} by ${fmtShort(info.leaveBy)}`;
  } else {
    when = `${fmtShort(ev._s)} &middot; in ${fmtMins(minutesBetween(now, ev._s))}`;
  }
  const walk = next && info && info.estimate ? `<div class="nc-walk">${esc(info.estimate.label)}</div>` : "";
  return onLine + `<button class="next-card" data-hero="${esc(ev.id)}" style="--h:var(${hotelVar(ev.hotel)})">${label}<div class="nc-title">${esc(ev.title)}</div><div class="nc-where">${placeHTML(ev)}</div><div class="nc-when${cls}">${when}</div>${walk}</button>`;
}
const offLineHTML = off => off ? `<div class="map-offmap">${off} pick${off === 1 ? "" : "s"} streaming or offsite</div>` : "";
/* Picks that day at venues the map does not draw: streams and offsite. */
const mapOffMapCount = day => events.filter(e => picks.has(e.id) && e._cd === day && !MAP_HOTELS[e.hotel]).length;

function mapSVG(day, st = mapNowState(day), counts = mapCounts(day)) {
  const street = (name, x, faint) => `<line class="map-street${faint ? " faint" : ""}" data-street="${name}" x1="${x}" y1="${MAP_VIEW.y}" x2="${x}" y2="${MAP_VIEW.y + MAP_VIEW.h}"/>
    <text class="map-street-label" transform="translate(${x - 7} 212) rotate(-90)">${name} St</text>`;
  const bridges = MAP_BRIDGES.map(([a, b]) => {
    const A = MAP_HOTELS[a], B = MAP_HOTELS[b], beside = Math.abs(A.y - B.y) < A.h;
    const [x1, y1, x2, y2] = beside ? [A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2] : [A.x + A.w / 2, A.y + A.h, B.x + B.w / 2, B.y];
    return `<line class="map-bridge" data-bridge="${esc(a)}|${esc(b)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const blocks = Object.entries(MAP_HOTELS).map(([h, b]) => { const n = counts[h] || 0, label = hotelShort(h).toUpperCase(); return `<g class="map-hotel${b.park ? " map-park" : ""}" data-hotel="${esc(h)}" role="button" tabindex="0" aria-label="${esc(h)}: ${n ? `${n} pick${n === 1 ? "" : "s"}` : "no picks"} on ${esc(DAY_LONG[day] || day)}" style="--h:var(${b.park ? "--park" : hotelVar(h)})">
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.park ? 6 : 10}"/>
    <text${label.length > 8 ? ' class="long"' : ""} x="${b.x + b.w / 2}" y="${b.y + b.h / 2}">${esc(label)}</text></g>`; }).join("");
  const pills = Object.entries(MAP_HOTELS).map(([h, b]) => mapPillSVG(h, b, counts[h])).join("");
  const rings = mapRingsSVG(st);
  return `<svg class="map" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.w} ${MAP_VIEW.h}" role="group" aria-label="Schematic map of the con hotels, not to scale">
    <rect class="map-ground" x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.w}" height="${MAP_VIEW.h}" rx="14"/>
    ${street("Peachtree", MAP_STREETS.Peachtree)}${street("Courtland", MAP_STREETS.Courtland, true)}
    ${bridges}${blocks}${rings}${pills}</svg>`;
}

/* The day the map shows: the one tapped, else the con day the clock is in,
   with the timeline's 5 AM boundary. Outside con week, Thursday. */
function mapDay() {
  if (state.map.day) return state.map.day;
  const d = conDayKey(now());
  return CON_DAYS.includes(d) ? d : "2026-09-03";
}

function renderMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  const chips = CON_DAYS.map(d => chipHTML(DAY_LABEL[d], day === d, "map-day", d)).join("");
  document.getElementById("view-map").innerHTML = `<div class="controls controls-sticky"><div class="chips" data-row="map-day">${chips}</div></div>
    <div class="map-wrap" data-day="${day}">${mapSVG(day, st, counts)}<div class="map-under" id="mapUnder">${mapCardHTML(cs)}${offLineHTML(off)}</div></div>`;
  lastMapSig = mapSignature(day, st, counts);
  lastCardSig = mapCardSignature(cs, off);
}

/* The minute tick redraws only what changed. The SVG is redrawn when a ring
   or a pill would move - a redraw restarts the pulse on the next ring, so a
   quiet minute must leave it alone. The card is refreshed on its own when
   its words change, which "in 47 min" does every minute. */
let lastMapSig = null, lastCardSig = null;
function mapSignature(day, st, counts) {
  return JSON.stringify([day, st && st.onNow && st.onNow.id, st && st.next && st.next.id, counts]);
}
function mapCardSignature(cs, off) {
  const ev = cs.next || cs.later;
  return JSON.stringify([cs.onNow && cs.onNow.id, cs.next && cs.next.id, cs.later && cs.later.id, cs.from,
    cs.info && cs.info.leaveBy ? [String(cs.info.leaveBy), cs.info.late] : ev ? minutesBetween(cs.now, ev._s) : null,
    cs.info && cs.info.estimate ? cs.info.estimate.label : null, off]);
}
function tickMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  if (mapSignature(day, st, counts) !== lastMapSig) {
    const rows = chipRowsSnapshot();
    renderMap();
    chipRowsRestore(rows);
    return true;
  }
  const csig = mapCardSignature(cs, off);
  if (csig === lastCardSig) return false;
  const under = document.getElementById("mapUnder");
  if (under) under.innerHTML = mapCardHTML(cs) + offLineHTML(off);
  lastCardSig = csig;
  return true;
}


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

/* ---- Explore ------------------------------------------------------- */

const KIND_NOUN = {track: "Track", fandom: "Fandom", topic: "Topic", person: "Person"};

/* Built once from the loaded schedule: everything you could follow, with how
   many events each carries. Fandoms need 3+ to be worth a tile; people need
   to be a celebrity guest or busy enough to be worth following. */
let catalogue = null;
function buildCatalogue() {
  const tally = (get) => {
    const m = new Map();
    events.forEach(e => (get(e) || []).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return m;
  };
  const rank = m => [...m].map(([key, count]) => ({key, count}))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const people = new Map(), celebs = new Set();
  events.forEach(e => {
    (e.speakers || []).forEach(p => {
      const n = (p && p.name || "").trim();
      if (!n) return;
      people.set(n, (people.get(n) || 0) + 1);
      if (isCeleb(e)) celebs.add(n);
    });
  });

  /* Tracks are looked up by name, so they go A to Z, with the two noise
     tracks last: sorted by count the page opened with Epic Photos, which
     Search hides by default. Fandoms and topics keep count order - there the
     number is the point. People split in two: guests by how busy they are,
     panelists A to Z, because "6 events" says nothing about a name you don't
     know. Both are still one kind of follow. */
  const byName = (a, b) => a.key.localeCompare(b.key);
  const person = rank(people).filter(t => celebs.has(t.key) || t.count >= 5);
  catalogue = {
    track: [...tally(e => e.tracks)].map(([key, count]) => ({key, count}))
      .sort((a, b) => (NOISE_TRACKS.has(a.key) - NOISE_TRACKS.has(b.key)) || byName(a, b)),
    fandom: rank(tally(e => (e.tags || {}).fandoms)).filter(t => t.count >= 3),
    topic: rank(tally(e => (e.tags || {}).topics)),
    person,
    guest: person.filter(t => celebs.has(t.key)),
    panelist: person.filter(t => !celebs.has(t.key)).sort(byName),
  };
  return catalogue;
}
const getCatalogue = () => catalogue || buildCatalogue();

/* What the grid shows, in order. id names the list; kind is the follow. */
const EXPLORE_SECTIONS = [
  {id: "track", kind: "track", label: "Tracks"},
  {id: "fandom", kind: "fandom", label: "Fandoms"},
  {id: "topic", kind: "topic", label: "Topics"},
  {id: "guest", kind: "person", label: "Guests"},
  {id: "panelist", kind: "person", label: "Panelists"},
];
/* 657 tiles is thirty phone screens. Each section opens with its head and
   a Show all; the filter box is the way to reach the tail by name. */
const EXPLORE_HEAD = 12;

/* Only the explore part of the hash is ours to rewrite; anything else in
   it is left exactly as it was. */
function setExploreHash(value) {
  const rest = location.hash.replace(/^#/, "").split("&").filter(x => x && !x.startsWith("explore="));
  const parts = value ? rest.concat("explore=" + encodeURIComponent(value)) : rest;
  const h = parts.join("&");
  history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
}
function readExploreHash() {
  const m = location.hash.match(/explore=([^&]+)/);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  const i = raw.indexOf(":");
  if (i <= 0) return null;
  const kind = raw.slice(0, i), key = raw.slice(i + 1);
  return FOLLOW_KINDS.includes(kind) && key ? {kind, key} : null;
}
function openExplorePage(kind, key, keepScroll) {
  if (!keepScroll) state.explore.scroll = pageScrollTop();
  state.explore.page = {kind, key};
  state.explore.showPast = false;
  state.tab = "explore";
  setExploreHash(`${kind}:${key}`);
  render();
  pageScrollTo(0);
}
function closeExplorePage() {
  state.explore.page = null;
  setExploreHash(null);
  render();
  pageScrollTo(state.explore.scroll || 0);
}

function tileHTML(kind, item) {
  const on = isFollowing(kind, item.key);
  return `<button class="tile${on ? " on" : ""}" data-explore="${esc(kind + ":" + item.key)}">
    <span class="tile-name">${esc(item.key)}</span>
    <span class="tile-meta">${on ? `<span class="tile-mark" aria-label="Following">&#9679;</span>` : ""}${item.count}</span>
  </button>`;
}

function exploreSectionsHTML() {
  const cat = getCatalogue();
  const q = state.explore.q.trim().toLowerCase();
  const match = list => q ? list.filter(t => t.key.toLowerCase().includes(q)) : list;
  let html = "", any = false;
  for (const sec of EXPLORE_SECTIONS) {
    const items = match(cat[sec.id] || []);
    if (!items.length) continue;
    /* A filter shows every match; otherwise the head, until Show all. */
    const open = !!q || !!state.explore.expanded[sec.id];
    const shown = open ? items : items.slice(0, EXPLORE_HEAD);
    html += `<div class="section-title" id="explore-${sec.id}">${sec.label} <span class="count">${items.length}</span></div>`;
    /* Nothing followed yet, so no Following section to point at: say where it will appear. */
    if (!any && !follows.length) html += `<div class="hint">Follow a track, fandom or person and it'll show up here.</div>`;
    any = true;
    html += `<div class="tiles">${shown.map(i => tileHTML(sec.kind, i)).join("")}</div>`;
    if (shown.length < items.length) {
      html += `<button class="btn quiet more" data-act="explore-all" data-section="${sec.id}">Show all ${items.length}</button>`;
    }
  }
  if (!any) html += `<div class="empty"><b>Nothing matches.</b> Try fewer letters.</div>`;
  return html;
}

function exploreJumpHTML() {
  const cat = getCatalogue();
  return `<div class="chips explore-jump" data-row="explore-jump" aria-label="Jump to a section">${EXPLORE_SECTIONS.map(sec => {
    const n = (cat[sec.id] || []).length;
    return n ? `<button class="chip" data-act="explore-jump" data-section="${sec.id}" aria-pressed="${state.explore.active === sec.id}">${sec.label} <span class="n">${n}</span></button>` : "";
  }).join("")}</div>`;
}

/* Tracks, fandoms and guests behind the reader's own picks that they do not
   follow yet, derived on every render. A starred photo session says
   something about the guest, not the track, so the noise tracks stay out;
   only things with a tile of their own are offered, so each has a page. */
const SUGGEST_MAX = 6;
function suggestedFollows() {
  if (!picks.size) return [];
  const cat = getCatalogue();
  const lists = {track: cat.track, fandom: cat.fandom, person: cat.guest};
  const tally = new Map();
  const bump = (kind, key) => {
    if (!key || isFollowing(kind, key)) return;
    const item = lists[kind].find(t => t.key === key);
    if (!item) return;
    const id = `${kind}:${key}`;
    const rec = tally.get(id) || {kind, key, count: item.count, picks: 0};
    rec.picks++;
    tally.set(id, rec);
  };
  picks.forEach(id => {
    const e = byId.get(id);
    if (!e) return;
    (e.tracks || []).forEach(t => { if (!NOISE_TRACKS.has(t)) bump("track", t); });
    ((e.tags || {}).fandoms || []).forEach(f => bump("fandom", f));
    (e.speakers || []).forEach(p => bump("person", (p && p.name || "").trim()));
  });
  return [...tally.values()]
    .sort((a, b) => b.picks - a.picks || b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, SUGGEST_MAX);
}
function suggestedHTML() {
  const items = suggestedFollows();
  if (!items.length) return "";
  const n = picks.size;
  return `<section class="suggested" id="suggested">
    <div class="section-title">Because you starred <span class="count">${n} thing${n === 1 ? "" : "s"}</span></div>
    <div class="hint">Tracks, fandoms and guests behind your picks that you don't follow yet.</div>
    <div class="tiles">${items.map(r => tileHTML(r.kind, r)).join("")}</div>
  </section>`;
}

function renderExploreGrid() {
  document.getElementById("view-explore").innerHTML = `${followingHTML()}${suggestedHTML()}
    <div class="controls controls-sticky">
      <input class="search" type="search" id="exploreQ" placeholder="Filter tracks, fandoms, topics, people"
        value="${esc(state.explore.q)}" autocomplete="off" aria-label="Filter what you can follow">
      ${exploreJumpHTML()}
    </div>
    <div id="exploreGrid">${exploreSectionsHTML()}</div>`;
  syncActiveSection();
}

/* The chip for the section on screen reads as pressed, like a day chip in
   Search. The section on screen is the last one whose header has passed
   the sticky block; above the first header nothing is pressed. */
function pickActiveSection(headers, line, atEnd) {
  /* The last section is usually too short to carry its header up to the
     line before the page runs out of scroll, so at the end it is current. */
  if (atEnd && headers.length) return headers[headers.length - 1].id;
  let active = null;
  for (const h of headers) if (h.top <= line) active = h.id;
  return active;
}
function activeExploreSection() {
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!box) return null;
  const line = box.getBoundingClientRect().bottom + 1;
  const headers = EXPLORE_SECTIONS.map(sec => {
    const el = document.getElementById(`explore-${sec.id}`);
    return el ? {id: sec.id, top: el.getBoundingClientRect().top} : null;
  }).filter(Boolean);
  const atEnd = scroller.scrollHeight > scroller.clientHeight
    && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  return pickActiveSection(headers, line, atEnd);
}
function markActiveSection(id) {
  const changed = state.explore.active !== id;
  state.explore.active = id;
  document.querySelectorAll('#view-explore [data-act="explore-jump"]')
    .forEach(b => b.setAttribute("aria-pressed", String(b.dataset.section === id)));
  if (changed && id) revealChip(document.querySelector(`#view-explore [data-act="explore-jump"][data-section="${id}"]`));
}
function syncActiveSection() {
  if (state.tab !== "explore" || state.explore.page) return;
  markActiveSection(activeExploreSection());
}
/* A tap marks its chip at once and holds it while the smooth scroll runs,
   so the chips passed on the way do not flicker through. The hold is a
   stopwatch, not a clock: a simulated time must not freeze it. */
let spyQueued = false, spyHoldUntil = 0;

/* Typing in the filter box redraws the tiles and nothing else. Rebuilding the
   whole view would replace the input mid-word, and take the keyboard with it. */
function renderExploreSections() {
  const grid = document.getElementById("exploreGrid");
  if (grid && !state.explore.page) grid.innerHTML = exploreSectionsHTML(); else renderExplore();
}

function smoothScrollTo(top) { pageScrollTo(top, true); }
/* "+ Follow more" used to switch tabs; the tiles are now on the same page,
   just below. Land the filter box where its sticky position would hold it. */
function scrollToGrid() {
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!box) return;
  const hdr = parseFloat(document.documentElement.style.getPropertyValue("--hdr-h")) || 0;
  smoothScrollTo(box.getBoundingClientRect().top + pageScrollTop() - hdr);
}
/* A section header lands just under the sticky filter block. */
function scrollToExploreSection(id) {
  const el = document.getElementById(`explore-${id}`);
  const box = document.querySelector("#view-explore .controls-sticky");
  if (!el) return;
  const hdr = parseFloat(document.documentElement.style.getPropertyValue("--hdr-h")) || 0;
  const stickyH = box ? box.getBoundingClientRect().height : 0;
  smoothScrollTo(el.getBoundingClientRect().top + pageScrollTop() - hdr - stickyH);
}

function renderExplorePage() {
  const {kind, key} = state.explore.page;
  const all = eventsFor({kind, key});
  const at = now();
  const upcoming = all.filter(e => !isPast(e, at)), past = all.filter(e => isPast(e, at));
  const on = isFollowing(kind, key);

  let html = `<div class="explore-head">
    <button class="back" data-act="explore-back" aria-label="Back to Explore">&#8592; Explore</button>
    <div class="eh-kind">${KIND_NOUN[kind] || kind}</div>
    <h2 class="eh-name">${esc(key)}</h2>
    <div class="eh-count">${all.length} event${all.length === 1 ? "" : "s"}${past.length ? ` &middot; ${upcoming.length} still to come` : ""}</div>
    <button class="btn follow-btn${on ? " on" : ""}" data-act="toggle-follow" aria-pressed="${on}">${on ? "Following" : "Follow"}</button>
  </div>`;

  const dayGroups = list => {
    let out = "", lastDay = "";
    list.forEach(ev => {
      if (ev._cd !== lastDay) { out += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd}</li>`; lastDay = ev._cd; }
      out += rowHTML(ev, {list: "explore"});
    });
    return out;
  };

  if (!all.length) {
    html += `<div class="empty"><b>No events.</b> Nothing in the schedule matches this any more.</div>`;
  } else {
    if (upcoming.length) html += `<ul class="list">${dayGroups(upcoming)}</ul>`;
    else html += `<div class="empty">Everything here has already happened.</div>`;
    if (past.length) {
      html += `<div class="divider fold"><button data-act="explore-past" aria-expanded="${state.explore.showPast}">Already happened (${past.length}) <span aria-hidden="true">${state.explore.showPast ? "▾" : "▸"}</span></button></div>`;
      if (state.explore.showPast) html += `<ul class="list">${dayGroups(past)}</ul>`;
    }
  }
  document.getElementById("view-explore").innerHTML = html;
}

function renderExplore() {
  if (state.explore.page) renderExplorePage(); else renderExploreGrid();
}

/* ---- Following (the top of Explore) --------------------------------- */
const FOLLOWING_PAGE = 8;

function followChipsHTML() {
  const chips = follows.map(f => `<span class="follow-chip">
      <button class="fc-name" data-explore="${esc(followId(f))}">${esc(f.key)}</button>
      <button class="fc-x" data-act="unfollow" data-follow="${esc(followId(f))}" aria-label="Unfollow ${esc(f.key)}">&times;</button>
    </span>`).join("");
  return `<div class="controls"><div class="chips follow-chips" data-row="follows">${chips}
    <button class="chip fc-add" data-act="fol-add">+ Follow more</button>
  </div></div>`;
}

function followingByInterest(now) {
  let html = "";
  follows.forEach(f => {
    const id = followId(f);
    const all = eventsFor(f);
    const upcoming = all.filter(e => !isPast(e, now)), past = all.filter(e => isPast(e, now));
    const expanded = !!state.following.expanded[id];
    const shown = expanded ? upcoming : upcoming.slice(0, FOLLOWING_PAGE);
    html += `<div class="section-title">${esc(f.key)} <span class="count">${KIND_NOUN[f.kind] || f.kind} &middot; ${upcoming.length} ${conEnded() ? "events" : "to come"}</span></div>`;
    if (!upcoming.length) {
      html += `<div class="empty">Nothing left today or later.</div>`;
    } else {
      html += `<ul class="list">${shown.map(ev => rowHTML(ev, {list: `fol:${id}`, showDay: true})).join("")}</ul>`;
      if (upcoming.length > shown.length) {
        html += `<button class="btn quiet more" data-act="fol-more" data-follow="${esc(id)}">Show ${upcoming.length - shown.length} more</button>`;
      }
    }
    if (past.length) {
      const open = !!state.following.showPast[id];
      html += `<div class="divider fold"><button data-act="fol-past" data-follow="${esc(id)}" aria-expanded="${open}">Already happened (${past.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
      if (open) html += `<ul class="list">${past.map(ev => rowHTML(ev, {list: `folp:${id}`, showDay: true})).join("")}</ul>`;
    }
  });
  return html;
}

function followingByTime(now) {
  /* One row per event, however many follows brought it here - the labels say
     which, so a panel matched by two interests is not listed twice. */
  const seen = new Map();
  follows.forEach(f => eventsFor(f).forEach(e => {
    if (!seen.has(e.id)) seen.set(e.id, {ev: e, labels: []});
    const rec = seen.get(e.id);
    if (!rec.labels.includes(f.key)) rec.labels.push(f.key);
  }));
  const rows = [...seen.values()].sort((a, b) => a.ev._s - b.ev._s);
  const upcoming = rows.filter(r => !isPast(r.ev, now)), past = rows.filter(r => isPast(r.ev, now));

  const group = list => {
    let out = "", lastDay = "", lastTime = "";
    list.forEach(({ev, labels}) => {
      const dk = conDayKey(ev._s);
      if (dk !== lastDay) { out += `<li class="day-head">${DAY_LONG[dk] || dk}</li>`; lastDay = dk; lastTime = ""; }
      const t = fmtShort(ev._s);
      if (t !== lastTime) { out += `<li class="time-head">${t}</li>`; lastTime = t; }
      out += rowHTML(ev, {list: "foltime", labels});
    });
    return out;
  };

  let html = "";
  if (!upcoming.length) html += `<div class="empty">Nothing left today or later from what you follow.</div>`;
  else html += `<ul class="list">${group(upcoming)}</ul>`;
  if (past.length) {
    const open = !!state.following.showPast.__time;
    html += `<div class="divider fold"><button data-act="fol-past" data-follow="__time" aria-expanded="${open}">Already happened (${past.length}) <span aria-hidden="true">${open ? "▾" : "▸"}</span></button></div>`;
    if (open) html += `<ul class="list">${group(past)}</ul>`;
  }
  return html;
}

/* Only there when there is something to show; with no follows the grid
   carries a one-line hint instead. Closed, the feed is not built at all. */
function followingHTML() {
  if (!follows.length) return "";
  const open = state.following.open !== false;
  let body = "";
  if (open) {
    const l = state.following.layout;
    body = followChipsHTML() + `<div class="view-toggle" role="group" aria-label="Layout">
      <button data-act="fol-interest" aria-pressed="${l === "interest"}">By interest</button>
      <button data-act="fol-time" aria-pressed="${l === "time"}">By time</button>
    </div>` + (l === "time" ? followingByTime(now()) : followingByInterest(now()));
  }
  return `<section class="following" id="following">
    <button class="fol-head" data-act="fol-toggle" aria-expanded="${open}" aria-controls="folBody">
      Following <span class="count">(${follows.length})</span><span class="caret" aria-hidden="true">${open ? "▾" : "▸"}</span>
    </button>
    <div id="folBody"${open ? "" : " hidden"}>${body}</div>
  </section>`;
}

/* ---- Mine --------------------------------------------------------- */
/* Side-by-side columns for anything that overlaps in time. Events are
   grouped into clusters that genuinely collide, and each cluster is
   given only as many columns as it actually needs. */
const HOUR_PX = 60;
function layoutColumns(list) {
  const sorted = [...list].sort((a, b) => a._s - b._s || a._e - b._e);
  const out = [];
  let cluster = [], clusterEnd = null;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(it => {
      let c = colEnds.findIndex(end => end <= it.ev._s.getTime());
      if (c === -1) { c = colEnds.length; colEnds.push(0); }
      colEnds[c] = it.ev._e.getTime();
      it.col = c;
    });
    cluster.forEach(it => it.cols = colEnds.length);
    out.push(...cluster);
    cluster = []; clusterEnd = null;
  };
  sorted.forEach(ev => {
    if (clusterEnd !== null && ev._s.getTime() >= clusterEnd) flush();
    cluster.push({ev, col: 0, cols: 1});
    clusterEnd = clusterEnd === null ? ev._e.getTime() : Math.max(clusterEnd, ev._e.getTime());
  });
  flush();
  return out;
}

function timelineDayHTML(dayKey, list, now) {
  const items = layoutColumns(list);
  const sorted = items.map(i => i.ev).sort((a, b) => a._s - b._s);
  const startMs = Math.min(...sorted.map(e => e._s.getTime()));
  const endMs = Math.max(...sorted.map(e => e._e.getTime()));
  const origin = new Date(startMs); origin.setMinutes(0, 0, 0);
  const last = new Date(endMs);
  if (last.getMinutes() || last.getSeconds()) { last.setMinutes(0, 0, 0); last.setHours(last.getHours() + 1); }
  const spanH = Math.max(1, Math.round((last - origin) / 3600000));
  const top = t => ((t - origin) / 60000) * (HOUR_PX / 60);

  let hours = "";
  for (let h = 0; h <= spanH; h++) {
    const at = new Date(origin.getTime() + h * 3600000);
    hours += `<div class="tl-hour" style="top:${h * HOUR_PX}px"><span>${fmtShort(at)}</span></div>`;
  }

  const blocks = items.map(({ev, col, cols}) => {
    const h = Math.max(24, top(ev._e.getTime()) - top(ev._s.getTime()) - 2);
    const w = 100 / cols;
    const long = h >= 150;
    return `<button class="tl-block${long ? " long" : ""}" data-hero="${esc(ev.id)}" style="top:${top(ev._s.getTime()).toFixed(1)}px;height:${h.toFixed(1)}px;left:${(col * w).toFixed(2)}%;width:calc(${w.toFixed(2)}% - 3px);--h:var(${hotelVar(ev.hotel)})">
      <span class="tb-title">${esc(ev.title)}</span>
      <span class="tb-room">${esc(ev.room || ev.location || "")}</span>
      ${long ? `<span class="tb-runs">runs to ${fmtShort(ev._e)}</span>` : ""}
    </button>`;
  }).join("");

  let links = "";
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], next = sorted[i];
    if (prev.hotel === next.hotel) continue;
    const walk = walkMin(prev.hotel, next.hotel);
    const gap = minutesBetween(prev._e, next._s);
    const y1 = top(prev._e.getTime()), y2 = top(next._s.getTime());
    const height = Math.max(18, y2 - y1);
    links += `<div class="tl-link${gap < walk ? " tight" : ""}" style="top:${Math.min(y1, y2).toFixed(1)}px;height:${height.toFixed(1)}px">
      <span>${walk} min</span></div>`;
  }

  const nowLine = conDayKey(now) === dayKey && now >= origin && now <= last
    ? `<div class="tl-now" style="top:${top(now.getTime()).toFixed(1)}px"></div>` : "";

  return `<div class="tl-day">
    <div class="day-head" style="padding-left:0">${DAY_LONG[dayKey] || dayKey} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${list.length}</span></div>
    <div class="tl-grid" style="height:${spanH * HOUR_PX + 12}px">${hours}${links}${blocks}${nowLine}</div>
  </div>`;
}

function renderMineTimeline(mine, now) {
  const days = new Map();
  mine.forEach(ev => {
    const k = conDayKey(ev._s);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(ev);
  });
  return [...days.keys()].sort().map(k => timelineDayHTML(k, days.get(k), now)).join("");
}

function renderMine() {
  const mine = events.filter(e => picks.has(e.id));
  let html = pickNewsHTML() + `<div class="mine-actions">
    <button class="btn" data-act="ics" ${mine.length ? "" : "disabled"}>Export to calendar</button>
    <button class="btn quiet" data-act="clear" ${mine.length ? "" : "disabled"}>Remove all</button>
  </div>`;
  if (mine.length) html += `<div class="view-toggle" role="group" aria-label="View">
    <button data-act="view-timeline" aria-pressed="${state.mineView === "timeline"}">Timeline</button>
    <button data-act="view-list" aria-pressed="${state.mineView === "list"}">List</button>
  </div>`;
  if (!mine.length) {
    html += `<div class="empty"><b>Nothing picked yet.</b> Star things in Search. They'll line up here by day with warnings when two picks overlap or the walk between hotels is too tight.</div>`;
  } else if (state.mineView === "timeline") {
    html += renderMineTimeline(mine, now());
  } else {
    html += `<ul class="list">`;
    let lastDay = "", prev = null;
    mine.forEach(ev => {
      if (ev._cd !== lastDay) { html += `<li class="day-head">${DAY_LONG[ev._cd] || ev._cd} <span class="count" style="font-size:.875rem;color:var(--dim);font-weight:400">${mine.filter(x => x._cd === ev._cd).length}</span></li>`; lastDay = ev._cd; prev = null; }
      html += gapHTML(prev, ev) + rowHTML(ev, {list: "mine"});
      prev = ev;
    });
    html += `</ul>`;
  }
  document.getElementById("view-mine").innerHTML = html;
  fitTimelineBlocks();
}

/* Measured, so it only acts where it has to; jsdom reports no heights and
   leaves every block alone. */
function fitTimelineBlocks() {
  document.querySelectorAll("#view-mine .tl-block").forEach(b => {
    b.classList.remove("tight", "tighter");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tight");
    if (b.scrollHeight > b.clientHeight + 1) b.classList.add("tighter");
  });
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

function applyExploreHash() {
  const target = readExploreHash();
  if (target) { state.tab = "explore"; state.explore.page = target; state.explore.showPast = false; }
  else if (state.explore.page) state.explore.page = null;
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
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(() => {
      spyQueued = false;
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
        spyHoldUntil = performance.now() + 700;
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
  closeSheet, edgeTouchMove, edgeTouchStart, hideUpdatePill, indexReady, layoutColumns,
  mapCardHTML, mapDay, markActiveSection, openExplorePage, openSheet, pickActiveSection,
  readExploreHash, recheckSchedule, render, renderExplore, renderMap, renderMiniBar,
  renderNotice, setDrag, setExploreHash, setTimeOverride, showUpdatePill, tickMap, togglePick,
  updateClock, updateFresh,

  BOOT, EXPLORE_HEAD, getCatalogue, HOUR_PX, MAP_HOTELS,
};
