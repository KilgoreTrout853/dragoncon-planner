import { esc, fmtMins, fmtRange, fmtShort, minutesBetween } from "./util.js";
import { hasBackend } from "./backend.js";
import { crewmatesByEvent } from "./crews.js";
import { state } from "./state.js";
import { CON_DAYS, conDayKey, conEnded, DAY_LABEL, DAY_LONG, FIRST_FULL_DAY, now } from "./time.js";
import { hotelShort, hotelVar, levelShort, placeHTML, placeShort } from "./venues.js";
import { byId, events } from "./data.js";
import { picks } from "./picks.js";
import { walkEstimate } from "./walk.js";
import { chipHTML } from "./ui.js";
import { drawInPlace, pageScrollTo } from "./scroll.js";
import { requestRender } from "./bus.js";
import { nowModel } from "./now.js";

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

/* The Map's focus (DECISIONS #63, #75): one event, by id, in `state.map.focus`
   and in memory alone - the event whose sheet's place line sent the reader
   here. While it is set the Map shows that event's con day, a third ring
   stands on its hotel, and the card under the map shows it in the next
   pick's place. The focus carries its own day: `state.map.day` is not
   written, so when the focus ends the Map is on the day it had.
   It ends when the Map tab is left by any road (shell.js render(), the one
   place a tab becomes the screen), at a day chip's tap (dispatch.js), when
   the clock is changed (shell.js setTimeOverride()), and here, when the
   schedule no longer holds the event - it is gone, or kept as removed - which
   no page reaches today, since a new schedule comes by a reload. A sheet
   opened and closed over the Map, and a star, leave it. */
/* Whether an event can be shown on the Map: it is at one of the seven
   places the Map draws, and is neither cancelled nor removed. An event's
   sheet makes its place a tap exactly where this holds. */
const onTheMap = ev => !!ev && !!MAP_HOTELS[ev.hotel] && !ev.cancelled && !ev.removed;
/* The focused event, or null - and the focus cleared where the schedule no
   longer holds it. */
function mapFocus() {
  if (!state.map.focus) return null;
  const ev = byId.get(state.map.focus);
  if (ev && !ev.removed) return ev;
  state.map.focus = null;
  return null;
}
/* The entry point: the Map, focused on the event, at its top, with keyboard
   and screen-reader focus on the card that shows it (#66). It sets the focus
   and the tab and nothing else, and does nothing for an event the Map cannot
   show. A caller with a sheet open closes it first: the close's own redraw
   is of the tab underneath, and would end a focus set before it. */
function showOnMap(id) {
  const ev = byId.get(id);
  if (!onTheMap(ev)) return;
  state.map.focus = ev.id;
  state.tab = "map";
  requestRender();
  pageScrollTo(0);
  const card = document.getElementById("mapNext");
  if (card) card.focus({preventScroll: true});
}

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

/* The crew on the Map (DECISIONS #62): by hotel, a line for each crewmate's
   pick there that day - {user_id, display_name, ev} - from every crew the
   reader is in, a person once, by the oldest crew's name (crews.js
   crewmatesByEvent()), as the pull kept their picks. In the schedule's
   order, start then title, and by name within one event, so one event's
   lines stay together; a crewmate with two picks there has two. Nothing on
   a build with no backend or out of a crew; a removed event, or one this
   schedule does not hold, is no one's, since only events are walked. The
   hotel sheet lists them (sheet.js). */
function mapCrewPicks(day) {
  if (!hasBackend) return {};
  const going = crewmatesByEvent(), at = {};
  events.forEach(e => {
    const who = e._cd === day && MAP_HOTELS[e.hotel] ? going.get(e.id) : null;
    if (who) who.forEach(p => (at[e.hotel] || (at[e.hotel] = [])).push({...p, ev: e}));
  });
  return at;
}
/* How many of the crew have a pick at each hotel that day: people, not
   picks, of the lines above - the pill's number, and the hotel sheet's. */
function mapCrewCounts(day) {
  return Object.fromEntries(Object.entries(mapCrewPicks(day)).map(([h, lines]) => [h, new Set(lines.map(l => l.user_id)).size]));
}
/* Its pill, on the block's bottom-right corner, under the gold one: an
   outline with a person before the number, not gold - gold is the reader's
   own. None at zero. Wider than the gold one, it ends where a one-digit
   gold pill ends, 9 past the corner, so it stays off the next block - the
   Marriott is 10 from the Hyatt - and inside the frame: the Hilton's ends at
   376, the frame at 382. A block too short for two pills and its name
   between them - the park, 24 tall - has it hanging under the corner
   instead, its top 2 over the edge, clear of the name. Hidden from screen
   readers: the hotel's own label says how many of the crew, and a bare
   number beside it would say nothing. */
const CREW_PILL_ROOM = 48;
function mapCrewSVG(hotel, b, n) {
  if (!n) return "";
  const w = n > 9 ? 40 : 32, h = 18, x = b.x + b.w + 9 - w;
  const cy = b.h < CREW_PILL_ROOM ? b.y + b.h - 2 + h / 2 : b.y + b.h - 2;
  return `<g class="map-crew" data-hotel="${esc(hotel)}" data-count="${n}" aria-hidden="true"><rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/><circle cx="${x + 9}" cy="${cy - 3}" r="2.6"/><path d="M${x + 4.5} ${cy + 5}a4.5 4 0 0 1 9 0z"/><text x="${x + w / 2 + 6}" y="${cy}">${n}</text></g>`;
}

/* What today's overlay is made of, computed once per render: the on-now and
   next picks. Null on any day but the one the clock is in. */
function mapNowState(day) {
  const at = now();
  if (day !== conDayKey(at)) return null;
  const model = nowModel(at);
  return {now: at, onNow: model.onNowEv, next: model.upcoming[0] || null};
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
/* The focus's ring (#75), on the focused event's hotel whatever the day: a
   third ring, outside the other two so that all three can stand on one
   hotel - the next ring's pulse reaches 9 from the block at its widest, and
   this one's stroke runs from 10 to 12 - and the largest that stays inside
   the frame for all seven: 1 to spare above the park and under the
   Courtland. A class of its own, not a gold ring: gold is the reader's own
   picks. It does not pulse. Decorative, as the other rings are: the card
   says what is focused. */
const FOCUS_PAD = 11;
function mapFocusSVG(ev) {
  const b = ev ? MAP_HOTELS[ev.hotel] : null;
  if (!b) return "";
  return `<rect class="map-focus" data-hotel="${esc(ev.hotel)}" x="${b.x - FOCUS_PAD}" y="${b.y - FOCUS_PAD}" width="${b.w + 2 * FOCUS_PAD}" height="${b.h + 2 * FOCUS_PAD}" rx="${(b.park ? 6 : 10) + FOCUS_PAD}"/>`;
}
/* The card under the map: the next pick, as the hero sees it - the same
   nowModel, the same walk estimate: its start, how long until it, and the
   walk from the pick before, never when to leave (DECISIONS #40). It shows
   whichever day the map has selected, because it is about now, not about
   the day being looked at. With nothing left today it shows the first pick
   of the next con day; with no picks at all, how to get one.
   With a focus (#75) it shows the focused event in the next pick's place,
   the same button in the same place, `#mapNext`, so whatever keeps focus on
   the card keeps it: a small label, "You were looking at"; the title; the
   place and the level as a row says them, wrapping where they must; the con
   day's name and the time as a range. No "in 47 min" and no walk: it is not
   a pick. It shows whatever the clock says - before the con, and after it,
   where with no focus there is no card. The On now line above it stays. */
function mapCardState() {
  const at = now(), model = nowModel(at), today = conDayKey(at);
  const next = model.upcoming[0] || null;
  const later = next ? null : (events.find(e => picks.has(e.id) && e._s > at && conDayKey(e._s) > today) || null);
  return {now: at, onNow: model.onNowEv, next, later, estimate: next ? walkEstimate(next) : null, focus: mapFocus()};
}
function focusCardHTML(ev) {
  const level = levelShort(ev);
  return `<button class="next-card" id="mapNext" data-hero="${esc(ev.id)}" style="--h:var(${hotelVar(ev.hotel)})"><div class="nc-label">You were looking at</div><div class="nc-title">${esc(ev.title)}</div><div class="nc-where">${placeHTML(ev)}${level ? ` · ${esc(level)}` : ""}</div><div class="nc-when">${esc(DAY_LONG[ev._cd] || ev._cd)} ${fmtRange(ev._s, ev._e)}</div></button>`;
}
function mapCardHTML(cs) {
  const {now, onNow, next, later, estimate, focus} = cs;
  if (conEnded() && !focus) return "";       // nothing is next any more
  const onLine = onNow ? `<button class="next-on" id="mapOnNow" data-hero="${esc(onNow.id)}">On now: <b>${esc(onNow.title)}</b> &middot; ends ${fmtShort(onNow._e)} &middot; ${esc(placeShort(onNow))}</button>` : "";
  if (focus) return onLine + focusCardHTML(focus);
  const ev = next || later;
  if (!ev) return onLine + `<div class="next-card empty">Star things in Search and your next pick shows here.</div>`;
  let label = "", when;
  if (!next) {
    const dayKey = conDayKey(ev._s), tomorrow = conDayKey(new Date(now.getTime() + 24 * 3600000));
    label = `<div class="nc-label">${dayKey === tomorrow ? "Tomorrow" : esc(DAY_LONG[dayKey] || dayKey)}</div>`;
    when = fmtShort(ev._s);
  } else {
    when = `${fmtShort(ev._s)} &middot; in ${fmtMins(minutesBetween(now, ev._s))}`;
  }
  const walk = estimate ? `<div class="nc-walk">${esc(estimate.label)}</div>` : "";
  return onLine + `<button class="next-card" id="mapNext" data-hero="${esc(ev.id)}" style="--h:var(${hotelVar(ev.hotel)})">${label}<div class="nc-title">${esc(ev.title)}</div><div class="nc-where">${placeHTML(ev)}</div><div class="nc-when">${when}</div>${walk}</button>`;
}
const offLineHTML = off => off ? `<div class="map-offmap">${off} pick${off === 1 ? "" : "s"} streaming or offsite</div>` : "";
/* Picks that day at venues the map does not draw: streams and offsite. */
const mapOffMapCount = day => events.filter(e => picks.has(e.id) && e._cd === day && !MAP_HOTELS[e.hotel]).length;

/* What a hotel's block says of itself: its picks on the Map's day and, where
   there are any, how many of the crew. */
function mapLabel(hotel, day, counts, crew) {
  const n = counts[hotel] || 0, c = crew[hotel] || 0;
  return `${hotel}: ${n ? `${n} pick${n === 1 ? "" : "s"}` : "no picks"} on ${DAY_LONG[day] || day}${c ? `, ${c} of your crew` : ""}`;
}
/* The pills' layer: each hotel's gold pill, then its crew's. */
const mapPillsSVG = (counts, crew) => Object.entries(MAP_HOTELS).map(([h, b]) => mapPillSVG(h, b, counts[h]) + mapCrewSVG(h, b, crew[h])).join("");

/* The drawing that is built once (DECISIONS #89): the ground, the two
   streets and their labels, the three bridges and the seven blocks; then
   three empty groups, in the order they are painted, which every draw
   writes into - the gold rings, the focus's ring, the pills. A block's
   label is the one thing on it that changes: it is built as `label` says
   it, and a later draw writes it where it differs. */
function mapBaseSVG(label) {
  const street = (name, x, faint) => `<line class="map-street${faint ? " faint" : ""}" data-street="${name}" x1="${x}" y1="${MAP_VIEW.y}" x2="${x}" y2="${MAP_VIEW.y + MAP_VIEW.h}"/>
    <text class="map-street-label" transform="translate(${x - 7} 212) rotate(-90)">${name} St</text>`;
  const bridges = MAP_BRIDGES.map(([a, b]) => {
    const A = MAP_HOTELS[a], B = MAP_HOTELS[b], beside = Math.abs(A.y - B.y) < A.h;
    const [x1, y1, x2, y2] = beside ? [A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2] : [A.x + A.w / 2, A.y + A.h, B.x + B.w / 2, B.y];
    return `<line class="map-bridge" data-bridge="${esc(a)}|${esc(b)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const blocks = Object.entries(MAP_HOTELS).map(([h, b]) => { const name = hotelShort(h).toUpperCase(); return `<g class="map-hotel${b.park ? " map-park" : ""}" data-hotel="${esc(h)}" role="button" tabindex="0" aria-label="${esc(label(h))}" style="--h:var(${b.park ? "--park" : hotelVar(h)})">
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.park ? 6 : 10}"/>
    <text${name.length > 8 ? ' class="long"' : ""} x="${b.x + b.w / 2}" y="${b.y + b.h / 2}">${esc(name)}</text></g>`; }).join("");
  return `<svg class="map" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.w} ${MAP_VIEW.h}" role="group" aria-label="Schematic map of the con hotels, not to scale">
    <rect class="map-ground" x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.w}" height="${MAP_VIEW.h}" rx="14"/>
    ${street("Peachtree", MAP_STREETS.Peachtree)}${street("Courtland", MAP_STREETS.Courtland, true)}
    ${bridges}${blocks}<g class="map-layer-rings"></g><g class="map-layer-focus"></g><g class="map-layer-pills"></g></svg>`;
}

/* The day the map shows: the focused event's con day while there is a
   focus (#75); else the one tapped; else the con day the clock is in, with
   the timeline's 5 AM boundary. Outside con week, the first full day,
   Thursday. */
function mapDay() {
  const focus = mapFocus();
  if (focus) return focus._cd;
  if (state.map.day) return state.map.day;
  const d = conDayKey(now());
  return CON_DAYS.includes(d) ? d : FIRST_FULL_DAY;
}

/* The view is built once and drawn in place (DECISIONS #89). The first draw
   builds it - the sticky strip and its empty chip row, the wrap, the
   drawing above and the empty band under it - and what says it is built is
   the page, not a flag here: a draw that finds no `#mapUnder` builds, so a
   fresh page is a fresh view. Then every draw, render()'s or the minute's,
   writes only what changed: the day on the wrap and each hotel's label,
   where they differ; and five parts through scroll.js drawInPlace() - the
   day chips, the gold rings, the focus's ring, the pills, and the card with
   the off-map line. Each part's markup has no space between its elements,
   or drawInPlace() would never find old and new alike.
   So nothing a draw leaves alone is touched. A hotel, a day's chip and the
   card keep their nodes, and their focus with them (#66); where the card's
   part must be drawn anew, drawInPlace() puts focus back. A ring that moves
   to another hotel is the same element, still in its pulse: the pulse
   starts again only when the rings are drawn anew - one comes or goes. And
   a quiet minute writes nothing. It says whether it wrote. */
function drawMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), crew = mapCrewCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  const view = document.getElementById("view-map"), label = hotel => mapLabel(hotel, day, counts, crew);
  let wrote = false;
  if (!document.getElementById("mapUnder")) {
    view.innerHTML = `<div class="controls controls-sticky"><div class="chips" data-row="map-day"></div></div>
    <div class="map-wrap" data-day="${day}">${mapBaseSVG(label)}<div class="map-under" id="mapUnder"></div></div>`;
    wrote = true;
  }
  const wrap = view.querySelector(".map-wrap");
  if (wrap.dataset.day !== day) { wrap.dataset.day = day; wrote = true; }
  for (const block of view.querySelectorAll(".map-hotel")) {
    const said = label(block.dataset.hotel);
    if (block.getAttribute("aria-label") !== said) { block.setAttribute("aria-label", said); wrote = true; }
  }
  const parts = [
    [".chips", CON_DAYS.map(d => chipHTML(DAY_LABEL[d], day === d, "map-day", d)).join("")],
    [".map-layer-rings", mapRingsSVG(st)],
    [".map-layer-focus", mapFocusSVG(cs.focus)],
    [".map-layer-pills", mapPillsSVG(counts, crew)],
    ["#mapUnder", mapCardHTML(cs) + offLineHTML(off)],
  ];
  for (const [selector, html] of parts) if (drawInPlace(view.querySelector(selector), html)) wrote = true;
  return wrote;
}
function renderMap() { drawMap(); }

/* The minute's tick is that draw, and says whether it wrote anything. There
   is no signature to ask first: the draw compares what it would write with
   what stands, so a minute that changes no word writes none - "in 47 min"
   changes every minute, and a focused card, which says nothing of the
   minute, does not. */
function tickMap() { return drawMap(); }

export { MAP_HOTELS, mapCardHTML, mapCrewCounts, mapCrewPicks, mapDay, onTheMap, renderMap, showOnMap, tickMap };
