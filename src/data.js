/* The schedule: where it lives, the events once they are loaded, and the
   small questions asked of one event or of all of them. Nothing here fetches
   or draws - load() in loading.js does - and nothing is read at import but the
   con's year, for the URL. The file is events.v2.json (DECISIONS #39): each
   event names its works by id, and the file's works block says what each id
   is called and what it belongs to. This module is the only one that walks a
   work's parent. */
import { toDate } from "./util.js";
import { CON, conDayKey } from "./time.js";
import { cleanRoom, HOTEL_ORDER, hotelGroup } from "./venues.js";

const NOISE_TRACKS = new Set(["Epic Photos","Video Room"]);
const isNoise = ev => NOISE_TRACKS.has(ev.track) || /^photo session/i.test(ev.title);

/* The four closed axes of tags v2. audience is a fifth field, not an axis;
   only its kids value is ever a topic of its own. */
const AXES = ["medium", "genre", "craft", "subject"];
/* A link's via is about, track, or credit:<person>; a set of vias names the
   part before the colon. About and track are what an event is about; a
   credit is the cast, and reaches only a work's "With the cast" group. */
const ABOUT_TRACK = ["about", "track"];
const CAST = ["credit"];
const WORK_MIN = 3;           // a work needs this many events for a tile or a place in the Fandom select

let events = [], byId = new Map(), tracks = [], hotels = [], hotelChips = [];
let meta = {};
let worksById = new Map(), descendants = new Map(), workCounts = new Map(), personNames = new Map();
let axisKeys = new Set();

/* "unknown" and untagged are not celebrities - absence of evidence isn't
   evidence, so they drop out when the toggle is on. */
const isCeleb = e => !!(e.tags && e.tags.guests === "celebrity");

const DATA_URL = `data/${CON.year}/events.v2.json`;

const viaKind = via => String(via || "").split(":")[0];

/* The ids of the works an event names itself, by one of the vias. */
function directWorks(ev, vias = ABOUT_TRACK) {
  return ((ev.tags || {}).works || []).filter(w => vias.includes(viaKind(w.via))).map(w => w.id);
}

/* A work's ancestors, nearest first. The block holds every ancestor of every
   work it lists, and a cycle is refused by the registry, but the walk stops at
   a repeat all the same. */
function ancestorsOf(id) {
  const out = [];
  for (let at = (worksById.get(id) || {}).parent; at && !out.includes(at); at = (worksById.get(at) || {}).parent) out.push(at);
  return out;
}

/* What an event rolls up to: the works it names by those vias and every
   ancestor of each, once. An event about Andor is about Star Wars too. */
function linkedWorks(ev, vias = ABOUT_TRACK) {
  const out = new Set();
  for (const id of directWorks(ev, vias)) { out.add(id); ancestorsOf(id).forEach(a => out.add(a)); }
  return out;
}

/* True when the event names the work, or anything under it, by one of the
   vias. Every count, filter, tile and follow of a work asks this. */
function linksTo(ev, workId, vias = ABOUT_TRACK) {
  const under = descendants.get(workId);
  if (!under) return false;
  return ((ev.tags || {}).works || []).some(w => under.has(w.id) && vias.includes(viaKind(w.via)));
}

/* A person's name as the app shows it: the spelling the schedule uses most
   under the id, ties to the shortest, then to the first in code-unit order. */
function personName(id) { return personNames.get(id) || ""; }

/* The reviewed works with enough events for a tile or the Fandom select, in
   count order and then by name: {id, name, count}. */
function topWorks() {
  return [...workCounts].filter(([id, n]) => n >= WORK_MIN && (worksById.get(id) || {}).reviewed === true)
    .map(([id, count]) => ({id, name: worksById.get(id).name, count}))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* The schedule as the app holds it, made from the file as it was fetched:
   the events in start order, each with its Dates, its con day and its cleaned
   room, and the lookups the views read. load() in loading.js fetches and then
   calls this; what it assigns is read everywhere else through the live
   binding. */
function replaceSchedule(data) {
  meta = data;
  /* The block is a Map, never read in file order: Python sorted it, and
     Python's order is not localeCompare's. */
  worksById = new Map((data.works || []).map(w => [w.id, w]));
  descendants = new Map([...worksById.keys()].map(id => [id, new Set([id])]));
  for (const id of worksById.keys()) ancestorsOf(id).forEach(a => { if (descendants.has(a)) descendants.get(a).add(id); });

  const spellings = new Map();
  events = (data.events || []).filter(e => e.start).map(e => {
    const s = toDate(e.start), en = e.end ? toDate(e.end) : new Date(s.getTime() + 60 * 60000);
    (e.people || []).forEach(p => {
      const m = spellings.get(p.id) || new Map();
      m.set(p.name, (m.get(p.name) || 0) + 1);
      spellings.set(p.id, m);
    });
    const room = cleanRoom(e.hotel, e.room);
    /* _cd is the con day: it runs to 5am, so a 1am panel belongs to the night
       before. Every list, chip and header uses it; only the sheet and the
       calendar export state the calendar date. */
    return {...e, room, _s: s, _e: en, _cd: conDayKey(s)};
  });
  personNames = new Map([...spellings].map(([id, m]) => [id, [...m].sort((a, b) =>
    b[1] - a[1] || a[0].length - b[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0][0]]));
  /* The index's speakers field: every spelling the event uses, and the name
     the app shows for each person on it, so a tapped chip finds them all. */
  events.forEach(e => {
    const names = [];
    (e.people || []).forEach(p => [p.name, personName(p.id)].forEach(n => { if (n && !names.includes(n)) names.push(n); }));
    e._people = names.join(" ");
  });
  events.sort((a, b) => a._s - b._s || a.title.localeCompare(b.title));
  byId = new Map(events.map(e => [e.id, e]));
  tracks = [...new Set(events.map(e => e.track).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  hotels = HOTEL_ORDER.filter(h => events.some(e => e.hotel === h));
  hotelChips = [...new Set(hotels.map(hotelGroup))];

  /* One pass, not a linksTo per work per event: an event counts once for
     each work it rolls up to, which is the events linksTo says yes to. */
  workCounts = new Map();
  events.forEach(e => linkedWorks(e).forEach(id => workCounts.set(id, (workCounts.get(id) || 0) + 1)));
  axisKeys = new Set();
  events.forEach(e => {
    const tg = e.tags || {};
    AXES.forEach(a => (tg[a] || []).forEach(v => axisKeys.add(`${a}:${v}`)));
    if (tg.audience === "kids") axisKeys.add("audience:kids");
  });
}

export {
  NOISE_TRACKS, isNoise, events, byId, tracks, hotelChips, meta, isCeleb, DATA_URL,
  AXES, CAST, worksById, workCounts, axisKeys,
  replaceSchedule, directWorks, linkedWorks, linksTo, personName, topWorks,
};
