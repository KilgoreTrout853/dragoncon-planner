import { esc, fmtMins, fmtShort, minutesBetween } from "./util.js";
import { hasBackend } from "./backend.js";
import { crewmatesByEvent } from "./crews.js";
import { state } from "./state.js";
import { CON_DAYS, conDayKey, conEnded, DAY_LABEL, DAY_LONG, FIRST_FULL_DAY, now } from "./time.js";
import { hotelShort, hotelVar, placeHTML, placeShort } from "./venues.js";
import { events } from "./data.js";
import { picks } from "./picks.js";
import { walkEstimate } from "./walk.js";
import { chipHTML } from "./ui.js";
import { chipRowsRestore, chipRowsSnapshot, drawInPlace, focusIn, giveFocusBack } from "./scroll.js";
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

/* The crew on the Map (DECISIONS #62): how many crewmates - people, not
   picks - have a pick at each hotel that day, from every crew the reader is
   in, as the pull kept their picks. Nothing on a build with no backend or
   out of a crew; a removed event, or one this schedule does not hold, is
   no one's, since only events are counted. */
function mapCrewCounts(day) {
  if (!hasBackend) return {};
  const going = crewmatesByEvent(), people = {};
  events.forEach(e => {
    const who = e._cd === day && MAP_HOTELS[e.hotel] ? going.get(e.id) : null;
    if (who) who.forEach(p => (people[e.hotel] || (people[e.hotel] = new Set())).add(p.user_id));
  });
  return Object.fromEntries(Object.entries(people).map(([h, s]) => [h, s.size]));
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
/* The card under the map: the next pick, as the hero sees it - the same
   nowModel, the same walk estimate: its start, how long until it, and the
   walk from the pick before, never when to leave (DECISIONS #40). It shows
   whichever day the map has selected, because it is about now, not about
   the day being looked at. With nothing left today it shows the first pick
   of the next con day; with no picks at all, how to get one. */
function mapCardState() {
  const at = now(), model = nowModel(at), today = conDayKey(at);
  const next = model.upcoming[0] || null;
  const later = next ? null : (events.find(e => picks.has(e.id) && e._s > at && conDayKey(e._s) > today) || null);
  return {now: at, onNow: model.onNowEv, next, later, estimate: next ? walkEstimate(next) : null};
}
function mapCardHTML(cs) {
  if (conEnded()) return "";                 // nothing is next any more
  const {now, onNow, next, later, estimate} = cs;
  const onLine = onNow ? `<button class="next-on" id="mapOnNow" data-hero="${esc(onNow.id)}">On now: <b>${esc(onNow.title)}</b> &middot; ends ${fmtShort(onNow._e)} &middot; ${esc(placeShort(onNow))}</button>` : "";
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

function mapSVG(day, st = mapNowState(day), counts = mapCounts(day), crew = mapCrewCounts(day)) {
  const street = (name, x, faint) => `<line class="map-street${faint ? " faint" : ""}" data-street="${name}" x1="${x}" y1="${MAP_VIEW.y}" x2="${x}" y2="${MAP_VIEW.y + MAP_VIEW.h}"/>
    <text class="map-street-label" transform="translate(${x - 7} 212) rotate(-90)">${name} St</text>`;
  const bridges = MAP_BRIDGES.map(([a, b]) => {
    const A = MAP_HOTELS[a], B = MAP_HOTELS[b], beside = Math.abs(A.y - B.y) < A.h;
    const [x1, y1, x2, y2] = beside ? [A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2] : [A.x + A.w / 2, A.y + A.h, B.x + B.w / 2, B.y];
    return `<line class="map-bridge" data-bridge="${esc(a)}|${esc(b)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  const blocks = Object.entries(MAP_HOTELS).map(([h, b]) => { const n = counts[h] || 0, c = crew[h] || 0, label = hotelShort(h).toUpperCase(); return `<g class="map-hotel${b.park ? " map-park" : ""}" data-hotel="${esc(h)}" role="button" tabindex="0" aria-label="${esc(h)}: ${n ? `${n} pick${n === 1 ? "" : "s"}` : "no picks"} on ${esc(DAY_LONG[day] || day)}${c ? `, ${c} of your crew` : ""}" style="--h:var(${b.park ? "--park" : hotelVar(h)})">
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.park ? 6 : 10}"/>
    <text${label.length > 8 ? ' class="long"' : ""} x="${b.x + b.w / 2}" y="${b.y + b.h / 2}">${esc(label)}</text></g>`; }).join("");
  const pills = Object.entries(MAP_HOTELS).map(([h, b]) => mapPillSVG(h, b, counts[h]) + mapCrewSVG(h, b, crew[h])).join("");
  const rings = mapRingsSVG(st);
  return `<svg class="map" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.w} ${MAP_VIEW.h}" role="group" aria-label="Schematic map of the con hotels, not to scale">
    <rect class="map-ground" x="${MAP_VIEW.x}" y="${MAP_VIEW.y}" width="${MAP_VIEW.w}" height="${MAP_VIEW.h}" rx="14"/>
    ${street("Peachtree", MAP_STREETS.Peachtree)}${street("Courtland", MAP_STREETS.Courtland, true)}
    ${bridges}${blocks}${rings}${pills}</svg>`;
}

/* The day the map shows: the one tapped, else the con day the clock is in,
   with the timeline's 5 AM boundary. Outside con week, the first full day,
   Thursday. */
function mapDay() {
  if (state.map.day) return state.map.day;
  const d = conDayKey(now());
  return CON_DAYS.includes(d) ? d : FIRST_FULL_DAY;
}

/* Drawn whole, and what had focus on the tab - a hotel, a day's chip, the
   card - has it again (#66). */
function renderMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), crew = mapCrewCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  const chips = CON_DAYS.map(d => chipHTML(DAY_LABEL[d], day === d, "map-day", d)).join("");
  const view = document.getElementById("view-map"), back = focusIn(view);
  view.innerHTML = `<div class="controls controls-sticky"><div class="chips" data-row="map-day">${chips}</div></div>
    <div class="map-wrap" data-day="${day}">${mapSVG(day, st, counts, crew)}<div class="map-under" id="mapUnder">${mapCardHTML(cs)}${offLineHTML(off)}</div></div>`;
  giveFocusBack(back);
  lastMapSig = mapSignature(day, st, counts, crew);
  lastCardSig = mapCardSignature(cs, off);
}

/* The minute tick redraws only what changed. The SVG is redrawn when a ring
   or a pill would move - the crew's among them - since a redraw restarts
   the pulse on the next ring, so a quiet minute must leave it alone. The
   card is refreshed on its own when its words change, which "in 47 min"
   does every minute. */
let lastMapSig = null, lastCardSig = null;
function mapSignature(day, st, counts, crew) {
  return JSON.stringify([day, st && st.onNow && st.onNow.id, st && st.next && st.next.id, counts, crew]);
}
function mapCardSignature(cs, off) {
  const ev = cs.next || cs.later;
  return JSON.stringify([cs.onNow && cs.onNow.id, cs.next && cs.next.id, cs.later && cs.later.id,
    ev ? minutesBetween(cs.now, ev._s) : null, cs.estimate ? cs.estimate.label : null, off]);
}
function tickMap() {
  const day = mapDay(), st = mapNowState(day), counts = mapCounts(day), off = mapOffMapCount(day), cs = mapCardState();
  if (mapSignature(day, st, counts, mapCrewCounts(day)) !== lastMapSig) {
    const rows = chipRowsSnapshot();
    renderMap();
    chipRowsRestore(rows);
    return true;
  }
  const csig = mapCardSignature(cs, off);
  if (csig === lastCardSig) return false;
  /* In place: the card that has focus keeps it, and is not read out again
     for a minute that changed nothing on it. */
  const under = document.getElementById("mapUnder");
  if (under) drawInPlace(under, mapCardHTML(cs) + offLineHTML(off));
  lastCardSig = csig;
  return true;
}

export { MAP_HOTELS, mapCardHTML, mapDay, renderMap, tickMap };
