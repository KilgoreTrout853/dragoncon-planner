/* The schedule: where it lives, the events once they are loaded, and the
   small questions asked of one event or of all of them. Nothing here fetches
   or draws - load() in app.js does - and nothing is read at import but the
   con's year, for the URL. */
import { toDate } from "./util.js";
import { CON, conDayKey } from "./time.js";
import { cleanRoom, HOTEL_ORDER, hotelGroup } from "./venues.js";

const NOISE_TRACKS = new Set(["Epic Photos","Video Room"]);
const isNoise = ev => NOISE_TRACKS.has(ev.track) || /^photo session/i.test(ev.title);

let events = [], byId = new Map(), tracks = [], hotels = [], hotelChips = [];
let meta = {};

/* "unknown" and untagged are not celebrities - absence of evidence isn't
   evidence, so they drop out when the toggle is on. */
const isCeleb = e => !!(e.tags && e.tags.guests === "celebrity");

const DATA_URL = `data/${CON.year}/events.json`;

/* The schedule as the app holds it, made from the file as it was fetched:
   the events in start order, each with its Dates, its con day and its cleaned
   room, and the lookups the views read. load() in app.js fetches and then
   calls this; what it assigns is read everywhere else through the live
   binding. */
function replaceSchedule(data) {
  meta = data;
  events = (data.events || []).filter(e => e.start).map(e => {
    const s = toDate(e.start), en = e.end ? toDate(e.end) : new Date(s.getTime() + 60 * 60000);
    const people = (e.speakers || []).map(p => p.name).join(" ");
    const room = cleanRoom(e.hotel, e.room);
    /* _cd is the con day: it runs to 5am, so a 1am panel belongs to the night
       before. Every list, chip and header uses it; only the sheet and the
       calendar export state the calendar date. */
    return {...e, room, _s: s, _e: en, _cd: conDayKey(s), _people: people};
  });
  events.sort((a, b) => a._s - b._s || a.title.localeCompare(b.title));
  byId = new Map(events.map(e => [e.id, e]));
  tracks = [...new Set(events.map(e => e.track).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  hotels = HOTEL_ORDER.filter(h => events.some(e => e.hotel === h));
  hotelChips = [...new Set(hotels.map(hotelGroup))];
}

function fandomCounts() {
  const m = new Map();
  events.forEach(e => (e.tags && e.tags.fandoms || []).forEach(f => m.set(f, (m.get(f) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export {
  NOISE_TRACKS, isNoise, events, byId, tracks, hotelChips, meta, isCeleb, DATA_URL,
  replaceSchedule, fandomCounts,
};
