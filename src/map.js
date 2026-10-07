import { esc, fmtMins, fmtRange, fmtShort, minutesBetween } from "./util.js";
import { hasBackend } from "./backend.js";
import { crewmatesByEvent } from "./crews.js";
import { state } from "./state.js";
import { blockOutline, PUSH, SKEW, SQUASH, stackLayout } from "./stack.js";
import { CON_DAYS, conDayKey, conEnded, DAY_LABEL, DAY_LONG, FIRST_FULL_DAY, now } from "./time.js";
import { hotelShort, hotelVar, levelShort, placeHTML, placeShort, roomWords } from "./venues.js";
import { byId, events, happening } from "./data.js";
import { building, dayLights, depthOf, levelEvents } from "./building.js";
import { picks } from "./picks.js";
import { walkEstimate } from "./walk.js";
import { chipHTML } from "./ui.js";
import { cssEsc, drawInPlace, focusIn, giveFocusBack, pageScrollTo } from "./scroll.js";
import { requestRender } from "./bus.js";
import { nowModel } from "./now.js";

/* ---- Map ---------------------------------------------------------- */
/* The venues' real positions at one scale - about 0.54 px per metre, the
   Hyatt's centre at (150, 250) - so the distances mean something: the
   Hyatt and the Marriott nearly touch, the Hilton is a real walk, the
   Westin sits south-east of the Mart just west of Peachtree, and the
   Marriott-Hilton bridge crosses Courtland St, as it does in life. The
   Mart is its two buildings, two venues (DECISIONS #91): Building 3 level
   with the Hyatt across Peachtree, Building 2 south of it, each 50 tall -
   45 px on a 375 px screen - and 16 apart, so that Building 3's crew pill
   and Building 2's gold one, each 7 past its block's edge, stay clear.
   Keys are the walk table's names, so counts, rings and routes join up by
   hotel. Streams and offsite venues have no place here. */
const MAP_W = 380;
/* The frame: the viewBox is cropped to the drawing, with the same inset
   around it that the card below uses as padding (about 14 px at phone
   width). Block coordinates stay as they are; only the frame, the streets
   and their labels are placed against it. */
const MAP_VIEW = {x: -3, y: 111, w: 385, h: 305};
const MAP_CLIP = "mapClip";      // the frame as a clip path, by its id: the city's, while a stack is open
const MAP_STREETS = {Peachtree: 110, Courtland: 296};
const MAP_HOTELS = {
  "AmericasMart Building 3": {x: 12, y: 204, w: 72, h: 50},
  "AmericasMart Building 2": {x: 12, y: 270, w: 72, h: 50},
  "Westin":          {x: 48,  y: 332, w: 60, h: 56},
  "Hyatt":           {x: 120, y: 222, w: 60, h: 56},
  "Marriott":        {x: 190, y: 222, w: 60, h: 56},
  "Hilton":          {x: 307, y: 222, w: 60, h: 56},
  "Courtland Grand": {x: 300, y: 347, w: 60, h: 56},
  "Hardy Ivy Park":  {x: 117, y: 124, w: 60, h: 24, park: true},
};
/* Each pair is left-to-right or top-to-bottom. None crosses Peachtree. The
   Mart's two are the way between its buildings, on their 2nd floors, and
   Building 2's bridge to the Westin. */
const MAP_BRIDGES = [["AmericasMart Building 3", "AmericasMart Building 2"], ["AmericasMart Building 2", "Westin"],
  ["Hyatt", "Marriott"], ["Marriott", "Hilton"]];

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
   no page reaches today, since a new schedule comes by a reload. And at any
   tap that changes what the Map shows (#95): a venue's block or gold pill,
   which opens its stack, a plate, and the way back. A sheet opened and
   closed over the Map - an event's, the park's, the crew's pill's - and a
   star, leave it. The ring is the city map's: an event with a floor lands in
   its venue's stack, where the card alone says what is focused. */
/* Whether an event can be shown on the Map: it is at one of the eight
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
   and screen-reader focus on the card that shows it (#66). It sets the
   focus, the tab and how deep the Map opens, and does nothing for an event
   the Map cannot show. As deep as the event's place goes (#95;
   building.js depthOf()): a room, a level or a floor is its venue's stack
   with its plate selected; the venue alone, and the park, is the city map,
   the focus's ring on its block. A caller with a sheet open closes it
   first: the close's own redraw is of the tab underneath, and would end a
   focus set before it. */
function showOnMap(id) {
  const ev = byId.get(id);
  if (!onTheMap(ev)) return;
  const plate = depthOf(ev).plate || null;
  state.map.focus = ev.id;
  state.map.stack = plate ? ev.hotel : null;
  state.map.plate = plate;
  state.tab = "map";
  requestRender();
  pageScrollTo(0);
  const card = document.getElementById("mapNext");
  if (card) card.focus({preventScroll: true});
}

/* The reader's picks at each hotel that day: those that are happening
   (DECISIONS #90). */
function mapCounts(day) {
  const counts = {};
  events.forEach(e => { if (picks.has(e.id) && happening(e) && e._cd === day && MAP_HOTELS[e.hotel]) counts[e.hotel] = (counts[e.hotel] || 0) + 1; });
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
   schedule does not hold, is no one's, since only events are walked, and a
   cancelled one is no one's either: it is not happening (#90). The hotel
   sheet lists them (sheet.js). */
function mapCrewPicks(day) {
  if (!hasBackend) return {};
  const going = crewmatesByEvent(), at = {};
  events.forEach(e => {
    const who = e._cd === day && MAP_HOTELS[e.hotel] && happening(e) ? going.get(e.id) : null;
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
   the frame for all eight: 1 to spare above the park and under the
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
  const later = next ? null : (events.find(e => picks.has(e.id) && happening(e) && e._s > at && conDayKey(e._s) > today) || null);
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
const mapOffMapCount = day => events.filter(e => picks.has(e.id) && happening(e) && e._cd === day && !MAP_HOTELS[e.hotel]).length;

/* What a hotel's block says of itself: its picks on the Map's day and, where
   there are any, how many of the crew. */
function mapLabel(hotel, day, counts, crew) {
  const n = counts[hotel] || 0, c = crew[hotel] || 0;
  return `${hotel}: ${n ? `${n} pick${n === 1 ? "" : "s"}` : "no picks"} on ${DAY_LONG[day] || day}${c ? `, ${c} of your crew` : ""}`;
}
/* The pills' layer: each hotel's gold pill, then its crew's. */
const mapPillsSVG = (counts, crew) => Object.entries(MAP_HOTELS).map(([h, b]) => mapPillSVG(h, b, counts[h]) + mapCrewSVG(h, b, crew[h])).join("");

/* The drawing that is built once (DECISIONS #89): the ground; then the city,
   one group - the two streets with their labels and the four bridges in a
   group of their own, the eight blocks, and three empty groups, in the
   order they are painted, which every draw writes into: the gold rings, the
   focus's ring, the pills; and last an empty group for the stacks, where a
   venue's is built at its first open (#95). The city is two groups, one
   inside the other: `map-city`, which is clipped to the frame while a stack
   is open, and `map-cam` in it, which that stack pushes in - a clip on the
   group that moves would move with it. A block's label is the one thing on
   it that changes: it is built as `label` says it, and a later draw writes
   it where it differs. */
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
  const frame = `x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.w}" height="${MAP_VIEW.h}" rx="14"`;
  return `<svg class="map" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.w} ${MAP_VIEW.h}" role="group" aria-label="Schematic map of the con hotels, not to scale">
    <defs><clipPath id="${MAP_CLIP}"><rect ${frame}/></clipPath></defs>
    <rect class="map-ground" ${frame}/>
    <g class="map-city"><g class="map-cam"><g class="map-streets">${street("Peachtree", MAP_STREETS.Peachtree)}${street("Courtland", MAP_STREETS.Courtland, true)}
    ${bridges}</g>${blocks}<g class="map-layer-rings"></g><g class="map-layer-focus"></g><g class="map-layer-pills"></g></g></g><g class="map-stacks"></g></svg>`;
}

/* ---- The stack (DECISIONS #95) ------------------------------------- */
/* A venue with a building, lifted into its floors in the Map's own frame:
   one plate a storey, bottom to top, each the venue's outline, tilted, with
   the city map pushed in behind them. Its state is two keys of `state.map`,
   in memory alone: `stack`, the venue whose stack is open, and `plate`, the
   plate selected in it, each null for none. A reload shows the city map;
   leaving the Map tab keeps both, though the focus ends there (#75), and so
   does a new moment on the clock. There is no motion here: a view is its end
   state, and the pull request that animates moves between them.

   Three kinds of plate (building.js): drawn - its rooms, its open areas and
   its ballrooms' outlines on it; a floor, which has no drawing - dashed and
   empty, its day's count on its label; and inert - no drawing and no event
   on it all weekend - a dotted outline and a dim name, with no fill, taking
   no pointer and no key: the plate under it shows through and takes the
   touch. A plate that is not inert is a button, and a tap selects it. */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const places = (v, n) => String(Math.round(v * 10 ** n) / 10 ** n);
const kindOf = plate => (plate.drawn ? "drawn" : plate.inert ? "inert" : "floor");
/* The venue whose stack is open, or null. */
const stackOpen = () => (state.map.stack && building(state.map.stack) ? state.map.stack : null);
/* The plate selected in it, or null - and the selection cleared where the
   schedule no longer has it as a plate that takes a tap. */
function stackPlate(hotel) {
  if (!hotel || !state.map.plate) return null;
  const plate = building(hotel).plates.find(p => p.key === state.map.plate && !p.inert) || null;
  if (!plate) state.map.plate = null;
  return plate;
}
/* A venue's stack as stack.js lays it out in the Map's frame, made once a
   venue: both are the build's, so no schedule changes it. Its outline is its
   hull, or with no drawing its block's own rectangle. */
const LAID = new Map();
function laidOut(hotel) {
  if (!LAID.has(hotel)) {
    const made = building(hotel), points = made.hull || blockOutline(MAP_HOTELS[hotel]);
    LAID.set(hotel, {points, ...stackLayout(points, made.plates.length, MAP_VIEW)});
  }
  return LAID.get(hotel);
}
/* A venue's group, built once and found afterwards (#89): the camera, which
   stands the outline's own units - feet, or a block's - in the frame; in it
   a group a plate, lifted, and in that the tilt, which holds the outline -
   twice, the first the selection's - and on a drawn plate its open areas,
   its rooms and its ballrooms' outlines, each room and each open area with
   an id saying its level and its id, to be lit by. Then the labels, in the
   frame's own units, one a plate, under its near corner. What a day changes
   - what is lit, the counts, the labels' words, the gold edge, the selection
   - is the draw's. `data-kinds` says the plates' kinds as built, so a draw
   under a schedule that changed which are inert builds it again. */
function stackSVG(hotel) {
  const made = building(hotel), at = laidOut(hotel), [cx, cy] = at.centre, block = MAP_HOTELS[hotel];
  const tilt = `translate(${places(cx, 3)} ${places(cy, 3)}) skewX(${-SKEW}) scale(1 ${SQUASH}) translate(${places(-cx, 3)} ${places(-cy, 3)})`;
  const outline = cls => (made.hull ? `<polygon class="${cls}" points="${at.points.map(p => `${places(p[0], 1)},${places(p[1], 1)}`).join(" ")}"/>`
    : `<rect class="${cls}" x="0" y="0" width="${block.w}" height="${block.h}" rx="10"/>`);
  const shape = (r, cls, more = "") => `<rect class="${cls}" x="${places(r.cx - r.w / 2, 1)}" y="${places(r.cy - r.h / 2, 1)}" width="${r.w}" height="${r.h}"${r.rot ? ` transform="rotate(${r.rot} ${r.cx} ${r.cy})"` : ""}${more}/>`;
  const lights = r => ` data-level="${esc(r.level)}" data-room="${esc(r.id)}"`;
  const plates = made.plates.map((p, j) => {
    const body = (p.inert ? "" : outline("plate-sel")) + outline("plate-hull")
      + p.open.map(o => ("id" in o ? shape(o, "plate-open place", lights(o)) : shape(o, "plate-open"))).join("")
      + p.rooms.map(r => shape(r, "plate-room", lights(r))).join("")
      + p.groups.filter(g => g.kind === "ballroom").map(g => shape(g.outline, "plate-group")).join("");
    return `<g class="plate ${kindOf(p)}" data-plate="${esc(p.key)}"${p.inert ? "" : ' role="button" tabindex="0"'}${j ? ` transform="translate(0 ${places(-j * at.gap, 3)})"` : ""}><g class="plate-tilt" transform="${tilt}">${body}</g></g>`;
  }).join("");
  /* A plate's own label says what its button says, so a screen reader is
     spared the second; an inert plate is no button, and its name is all it
     has. */
  const labels = made.plates.map((p, j) => `<text class="plate-label${p.inert ? " inert" : ""}" data-plate="${esc(p.key)}" x="${places(at.plates[j].x0 + 7, 1)}" y="${places(at.plates[j].y1 - 5, 1)}"${p.inert ? "" : ' aria-hidden="true"'}></text>`).join("");
  return `<g class="map-stack" data-hotel="${esc(hotel)}" data-kinds="${made.plates.map(kindOf).join(" ")}" style="--h:var(${hotelVar(hotel)})"><g class="stack-cam" transform="translate(${places(at.tx, 3)} ${places(at.ty, 3)}) scale(${places(at.scale, 5)})">${plates}</g><g class="stack-labels">${labels}</g></g>`;
}
/* Where the city map stands behind a venue's stack: pushed in toward the
   venue, its block's centre where the ground plate's centre stands. */
function pushedIn(hotel) {
  const at = laidOut(hotel), block = MAP_HOTELS[hotel];
  return `translate(${places(at.ground[0], 3)} ${places(at.ground[1], 3)}) scale(${PUSH}) translate(${-(block.x + block.w / 2)} ${-(block.y + block.h / 2)})`;
}
/* The stack drawn in place (#89): the open venue's group built where the
   page has none, or has one built under another schedule; and then only
   what differs written - which group is shown, what is lit, each plate's
   gold edge, selection and label, the city pushed in, clipped and taken out
   of the tab order behind it, and the way back. It says whether it wrote. */
function drawStack(view, open, selected, day) {
  const svg = view.querySelector("svg.map"), stacks = svg.querySelector(".map-stacks");
  let wrote = false;
  const set = (el, name, value) => {
    if (value === null ? !el.hasAttribute(name) : el.getAttribute(name) === value) return;
    if (value === null) el.removeAttribute(name); else el.setAttribute(name, value);
    wrote = true;
  };
  let group = null;
  if (open) {
    const made = building(open), dayName = DAY_LONG[day] || day;
    group = [...stacks.children].find(g => g.dataset.hotel === open) || null;
    if (group && group.dataset.kinds !== made.plates.map(kindOf).join(" ")) { group.remove(); group = null; }
    if (!group) {
      const holder = document.createElementNS(svg.namespaceURI, "g");
      holder.innerHTML = stackSVG(open);
      group = stacks.appendChild(holder.firstElementChild);
      wrote = true;
    }
    const lights = dayLights(open, day, picks), lit = new Map();
    for (const row of lights) for (const {level, id} of row.lit) lit.set(level, (lit.get(level) || new Set()).add(id));
    for (const shape of group.querySelectorAll("[data-room]")) {
      const on = !!lit.get(shape.dataset.level) && lit.get(shape.dataset.level).has(shape.dataset.room);
      if (shape.classList.contains("lit") !== on) { shape.classList.toggle("lit", on); wrote = true; }
    }
    const plates = group.querySelectorAll(".plate"), labels = group.querySelectorAll(".plate-label");
    made.plates.forEach((p, j) => {
      const row = lights[j], held = !!selected && selected.key === p.key;
      const events = row.events ? plural(row.events, "event") : "no events", mine = row.picks ? plural(row.picks, "pick") : "no picks";
      const said = esc(p.short) + (p.drawn || p.inert ? "" : `<tspan class="pl-count"> · ${events}</tspan>`) + (row.picks ? `<tspan class="pl-picks"> ★ ${row.picks}</tspan>` : "");
      if (drawInPlace(labels[j], said)) wrote = true;
      set(plates[j], "class", `plate ${kindOf(p)}${row.picks ? " mine" : ""}${held ? " selected" : ""}`);
      if (p.inert) return;
      set(plates[j], "aria-label", `${p.name}: ${p.drawn ? "" : `${events}, `}${mine} on ${dayName}`);
      set(plates[j], "aria-pressed", String(held));
    });
  }
  for (const g of stacks.children) set(g, "hidden", g === group ? null : "");
  set(svg, "data-stack", open);
  set(view.querySelector(".map-wrap"), "data-stack", open);
  const city = svg.querySelector(".map-city");
  set(city, "clip-path", open ? `url(#${MAP_CLIP})` : null);
  set(city, "aria-hidden", open ? "true" : null);
  set(city.querySelector(".map-cam"), "transform", open ? pushedIn(open) : null);
  for (const block of city.querySelectorAll(".map-hotel")) {
    set(block, "tabindex", open ? "-1" : "0");
    if (block.classList.contains("lifted") !== (block.dataset.hotel === open)) { block.classList.toggle("lifted"); wrote = true; }
  }
  set(view.querySelector("#mapBack"), "hidden", open ? null : "");
  return wrote;
}

/* The card under the map while a stack is open: about what is selected on
   the map. The focused card while the Map's focus is held (#75), as built;
   else the selected plate's; else the venue's line. The next pick's card,
   the On now line and the off-map line are the city map's, and are not
   shown.
   A plate's card: the venue's short name, small; the plate's name - a
   shared plate's by its levels' short names, as its label on the stack
   says them, since their full names do not fit a line; a star before it
   where a pick is on it that day (the stylesheet's, on `mine`); the day,
   what is happening and the reader's picks; then at most two rows of what
   is happening, each a button to its event's sheet.
   On the clock's own con day: what is on now - a pick of the reader's
   first, else the schedule's first - and how many more are; then what is
   next, one row after an On now row and two with none, the second "Then";
   "Nothing more here today." with none left. On another day its first two.
   With nothing that day, so, and how many are on other days. A cancelled
   event is in no row and no count (#90). A row says its room where that is
   more than the floor (venues.js roomWords()), and an end names its day
   only where it is on a later con day: 2 AM is still its own night's. */
const inSchedule = (a, b) => a._s - b._s || a.title.localeCompare(b.title);
const laterDay = (ev, day) => { const ends = conDayKey(new Date(ev._e.getTime() - 1)); return ends > day ? `${DAY_LABEL[ends] || ends} ` : ""; };
const endSaid = (ev, day) => laterDay(ev, day) + fmtShort(ev._e);
const rangeSaid = (ev, day) => (laterDay(ev, day) ? `${fmtShort(ev._s)}–${endSaid(ev, day)}` : fmtRange(ev._s, ev._e));
function plateRowHTML(ev, lead) {
  const room = roomWords(ev);
  return `<li><button type="button" class="pc-row${picks.has(ev.id) ? " mine" : ""}" data-hero="${esc(ev.id)}"><span class="pc-title">${esc(ev.title)}</span><span class="pc-when">${lead}${room ? ` · ${esc(room)}` : ""}</span></button></li>`;
}
function plateRowsHTML(all, day, at) {
  const here = all.filter(happening), list = here.filter(e => e._cd === day), dayName = DAY_LONG[day] || day;
  if (!list.length) {
    const other = here.length;
    return `<p class="pc-none">Nothing here on ${esc(dayName)}.${other ? ` ${plural(other, "event")} on other days.` : ""}</p>`;
  }
  if (day !== conDayKey(at)) return `<ul class="pc-rows">${list.slice(0, 2).map(e => plateRowHTML(e, rangeSaid(e, day))).join("")}</ul>`;
  const on = list.filter(e => e._s <= at && at < e._e).sort((a, b) => (picks.has(b.id) - picks.has(a.id)) || inSchedule(a, b)), next = list.filter(e => e._s > at);
  const rows = (on.length ? plateRowHTML(on[0], `<b>On now</b> · ends ${endSaid(on[0], day)}${on.length > 1 ? ` · ${on.length - 1} more on now` : ""}`) : "")
    + next.slice(0, on.length ? 1 : 2).map((e, i) => plateRowHTML(e, `<b>${i ? "Then" : "Next"}</b> · ${rangeSaid(e, day)}`)).join("");
  return rows ? `<ul class="pc-rows">${rows}</ul>` : `<p class="pc-none">Nothing more here today.</p>`;
}
function plateCardHTML(hotel, plate, day, at) {
  const row = dayLights(hotel, day, picks).find(r => r.key === plate.key), dayName = DAY_LONG[day] || day;
  const all = plate.levels.length === 1 ? levelEvents(hotel, plate.levels[0].id) : plate.levels.flatMap(level => levelEvents(hotel, level.id)).sort(inSchedule);
  return `<div class="next-card plate-card${row.picks ? " mine" : ""}" id="mapPlate" data-plate="${esc(plate.key)}" style="--h:var(${hotelVar(hotel)})"><div class="nc-label">${esc(hotelShort(hotel))}</div><div class="nc-title">${esc(plate.levels.length > 1 ? plate.short : plate.name)}</div><div class="nc-when">${esc(dayName)} · ${row.events ? plural(row.events, "event") : "no events"}${row.picks ? ` · ${plural(row.picks, "pick")}` : ""}</div>${plateRowsHTML(all, day, at)}</div>`;
}
/* The venue's line, one button: the venue by its key, as its hotel sheet is
   headed; the day and the reader's picks at the venue - every one, the
   pill's number, so it may be more than the plates' stars add up to, since
   an event known only to its venue is on no plate; how many of the crew,
   where there are any - the crew is here and nowhere on the plates, gold
   staying the reader's own; and a chevron. Its tap opens the hotel sheet
   (dispatch.js). Under it, in the room the slot holds, one quiet line that
   is no control, and stands with the venue's line alone. */
function venueLineHTML(hotel, day, counts, crew) {
  const n = counts[hotel] || 0, c = crew[hotel] || 0;
  return `<button type="button" class="next-card venue-line" id="mapVenue" data-venue="${esc(hotel)}" style="--h:var(${hotelVar(hotel)})"><span class="vl-words"><span class="nc-title">${esc(hotel)}</span><span class="nc-when">${esc(DAY_LONG[day] || day)} · ${n ? plural(n, "pick") : "no picks"}${c ? ` · ${c} of your crew` : ""}</span></span><span class="vl-chevron" aria-hidden="true">›</span></button><p class="map-hint">Tap a floor for what is on there.</p>`;
}
function stackCardHTML(hotel, selected, day, cs, counts, crew) {
  if (cs.focus) return focusCardHTML(cs.focus);
  return selected ? plateCardHTML(hotel, selected, day, cs.now) : venueLineHTML(hotel, day, counts, crew);
}

/* The three taps (dispatch.js calls them). Each changes what the Map shows,
   so each ends the Map's focus (#75).
   openStack(): a venue's block, or its gold pill, tapped - its stack, with
   nothing selected, and keyboard focus on the way back, since the block
   that had it is no longer shown. It says whether it opened one: a venue
   with no building - the park - has none, and keeps its hotel sheet. */
function openStack(hotel) {
  if (!building(hotel)) return false;
  Object.assign(state.map, {stack: hotel, plate: null, focus: null});
  requestRender();
  const back = document.getElementById("mapBack");
  if (back) back.focus({preventScroll: true});
  return true;
}
/* closeStack(): the way back - the control, a tap in the frame on anything
   but a plate, or Escape - to the city map, with keyboard focus on the
   venue's block. */
function closeStack() {
  const hotel = state.map.stack;
  if (!hotel) return;
  Object.assign(state.map, {stack: null, plate: null, focus: null});
  requestRender();
  const block = document.querySelector(`#view-map .map-hotel[data-hotel="${cssEsc(hotel)}"]`);
  if (block) block.focus({preventScroll: true});
}
/* tapPlate(): a plate that is not inert, tapped - selected, one at most,
   and the selected one tapped again, cleared. While the focus is held a tap
   on any plate ends the focus and leaves that plate selected, the selected
   one too: the reader asked for the plate, not for less. */
function tapPlate(key) {
  const held = !!state.map.focus;
  state.map.focus = null;
  state.map.plate = !held && state.map.plate === key ? null : key;
  requestRender();
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
   a quiet minute writes nothing. It says whether it wrote.
   While a stack is open (#95) the card is the stack's - the focused event,
   the selected plate or the venue's line - and the stack is drawn in place
   after the five parts, drawStack(); with none open that same call puts the
   city map back as it was. A plate's card is written into in place too, so
   a row of it that had keyboard focus is found again by its event. The way
   back, an HTML button so that it is 44 px whatever the drawing's scale,
   stands before the drawing and is built with it. */
function drawMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), crew = mapCrewCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  const view = document.getElementById("view-map"), label = hotel => mapLabel(hotel, day, counts, crew);
  const open = stackOpen(), selected = stackPlate(open);
  let wrote = false;
  if (!document.getElementById("mapUnder")) {
    view.innerHTML = `<div class="controls controls-sticky"><div class="chips" data-row="map-day"></div></div>
    <div class="map-wrap" data-day="${day}"><button type="button" class="map-back" id="mapBack" aria-label="Back to the map" hidden>← Map</button>${mapBaseSVG(label)}<div class="map-under" id="mapUnder"></div></div>`;
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
    [".map-layer-focus", open ? "" : mapFocusSVG(cs.focus)],        // the focus's ring is the city map's: under a stack the card alone says what is focused
    [".map-layer-pills", mapPillsSVG(counts, crew)],
    ["#mapUnder", open ? stackCardHTML(open, selected, day, cs, counts, crew) : mapCardHTML(cs) + offLineHTML(off)],
  ];
  const under = view.querySelector("#mapUnder"), held = open ? focusIn(under) : null;
  for (const [selector, html] of parts) if (drawInPlace(view.querySelector(selector), html)) wrote = true;
  giveFocusBack(held);
  if (drawStack(view, open, selected, day)) wrote = true;
  return wrote;
}
function renderMap() { drawMap(); }

/* The minute's tick is that draw, and says whether it wrote anything. There
   is no signature to ask first: the draw compares what it would write with
   what stands, so a minute that changes no word writes none - "in 47 min"
   changes every minute, and a focused card, which says nothing of the
   minute, does not. */
function tickMap() { return drawMap(); }

export { MAP_HOTELS, closeStack, mapCardHTML, mapCrewCounts, mapCrewPicks, mapDay, onTheMap, openStack, renderMap, showOnMap, tapPlate, tickMap };
