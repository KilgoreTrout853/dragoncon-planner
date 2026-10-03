/* The schedule: where it lives, the events once they are loaded, and the
   small questions asked of one event or of all of them. Nothing here fetches
   or draws - load() in loading.js does - and nothing is read at import but the
   build's year, for the URL. The file is the year's events.v2.json (DECISIONS
   #39, #49): each event names its works by id, and the file's works block says
   what each id is called and what it belongs to; its people block holds a
   reviewed person's known-for line (#61). This module is the only one that
   walks a work's parent. */
import { YEAR } from "./season.js";
import { toDate } from "./util.js";
import { conDayKey } from "./time.js";
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
let knownLines = new Map();
let axisKeys = new Set();

/* An event's tags, or none. An event the tag stage could not answer carries
   no tags key - untagged is a state (DECISIONS #46) - and every read of an
   event's tags goes through here, so the absence is one empty set of tags,
   frozen, since every untagged event shares it. */
const NO_TAGS = Object.freeze({});
const tagsOf = e => e.tags || NO_TAGS;

/* "unknown" and untagged are not celebrities - absence of evidence isn't
   evidence, so they drop out when the toggle is on. */
const isCeleb = e => tagsOf(e).guests === "celebrity";

/* 18+ is one thing (DECISIONS #77), to the word in the box, to the filter
   sheet's Audience and to a row's flag: a mature audience, or a stated
   minimum age of 17 or more, or the listing's own Mature Audience marker.
   The last two are the parse stage's and ask no tags, so an event the tagger
   has not reached is 18+ where its listing says so. A 13+ or a 16+ is not. */
const ADULT_AGE = 17;
function isAdult(ev) {
  const f = ev.facets || {};
  return tagsOf(ev).audience === "mature" || f.min_age >= ADULT_AGE || !!f.mature;
}

/* An event's flags (W7; DECISIONS #73), in the order a row says them: Sold
   out, Extra fee, Sign-up, an age - the minimum the listing states, else 18+
   where isAdult() says so - and Kids. Each is {key, label}, for the row and
   the event's sheet to say. The filter sheet asks the facets and the
   audience themselves (#77), and 18+ of the same isAdult(), so a row and the
   filter cannot disagree about an event; the parse stage's facets and the
   audience are the only sources. */
function flagsOf(ev) {
  const f = ev.facets || {}, audience = tagsOf(ev).audience, out = [];
  if (f.sold_out) out.push({key: "sold_out", label: "Sold out"});
  if (f.cost) out.push({key: "cost", label: "Extra fee"});
  if (f.signup) out.push({key: "signup", label: "Sign-up"});
  if (f.min_age) out.push({key: "age", label: `${f.min_age}+`});
  else if (isAdult(ev)) out.push({key: "age", label: "18+"});
  if (audience === "kids") out.push({key: "kids", label: "Kids"});
  return out;
}

/* What an event's sheet says of it that a row does not (DECISIONS #74),
   after its flags and in this order: its part, "Part 2", from the parse
   stage's facets; and a game's format, from the tagger's play, with
   ", beginners welcome" where its level is beginner - but for Learn to play,
   which says so itself. Level any says nothing, and a format this table does
   not hold is not said. {key, label}, as flagsOf() is. */
const PLAY_FORMAT = {"one-shot": "One-shot game", "organized-play": "Organized play", "learn-to-play": "Learn to play",
  tournament: "Tournament", demo: "Demo", "open-play": "Open play"};
function factsOf(ev) {
  const part = (ev.facets || {}).part, play = tagsOf(ev).play || {}, format = PLAY_FORMAT[play.format], out = [];
  if (part) out.push({key: "part", label: `Part ${part}`});
  if (format) out.push({key: "play", label: `${format}${play.level === "beginner" && play.format !== "learn-to-play" ? ", beginners welcome" : ""}`});
  return out;
}

/* An event's other sessions (DECISIONS #74, #75): the events with its
   repeat key, its title and its people, by id - "Author Signing" is eight
   sessions of eight line-ups, which are not each other's - that are on the
   schedule, not cancelled, and not yet started at the moment given, in
   start order. One that has started is left out: it is no longer a session
   to go to, and one starting at that very moment has started. The event's
   own state is not asked: a cancelled or a removed event names its live
   sessions still to come. The moment is a parameter: nothing here reads the
   clock. */
const repeatKey = e => (e.facets || {}).repeat_key || "";
const lineUp = e => JSON.stringify([...new Set((e.people || []).map(p => p.id))].sort());
function sessionsOf(ev, at) {
  const key = repeatKey(ev), who = lineUp(ev);
  if (!key) return [];
  return events.filter(e => e.id !== ev.id && !e.cancelled && e._s > at && repeatKey(e) === key && e.title === ev.title && lineUp(e) === who);
}

/* A person's known-for line (W42; DECISIONS #61), from the file's people
   block, joined by id: "" for a person with none - and so for everyone in a
   file whose block is empty, or that has no block. */
const knownFor = id => knownLines.get(id) || "";

const DATA_URL = `data/${YEAR}/events.v2.json`;

const viaKind = via => String(via || "").split(":")[0];

/* The ids of the works an event names itself, by one of the vias. */
function directWorks(ev, vias = ABOUT_TRACK) {
  return (tagsOf(ev).works || []).filter(w => vias.includes(viaKind(w.via))).map(w => w.id);
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
  return (tagsOf(ev).works || []).some(w => under.has(w.id) && vias.includes(viaKind(w.via)));
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
   binding.
   An event the source dropped is kept all season with removed: true
   (DECISIONS #42). byId holds every event, the removed among them, in the
   same start order, so a pick on one still finds it; events holds the rest,
   and every list, count and index is taken from events - search, Browse,
   Explore, the feeds, Now and the map never see a removed event. Only Plans
   draws one, marked, and only if it is picked (DECISIONS #49) - the
   reader's pick, or a crewmate's in the crew's day, which carries no star
   to add it. */
function replaceSchedule(data) {
  meta = data;
  /* The block is a Map, never read in file order: Python sorted it, and
     Python's order is not localeCompare's. */
  worksById = new Map((data.works || []).map(w => [w.id, w]));
  knownLines = new Map((data.people || []).map(p => [p.id, p.known_for]));
  descendants = new Map([...worksById.keys()].map(id => [id, new Set([id])]));
  for (const id of worksById.keys()) ancestorsOf(id).forEach(a => { if (descendants.has(a)) descendants.get(a).add(id); });

  const spellings = new Map();
  const all = (data.events || []).filter(e => e.start).map(e => {
    const s = toDate(e.start), en = e.end ? toDate(e.end) : new Date(s.getTime() + 60 * 60000);
    if (!e.removed) (e.people || []).forEach(p => {
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
  all.forEach(e => {
    const names = [];
    (e.people || []).forEach(p => [p.name, personName(p.id)].forEach(n => { if (n && !names.includes(n)) names.push(n); }));
    e._people = names.join(" ");
  });
  all.sort((a, b) => a._s - b._s || a.title.localeCompare(b.title));
  byId = new Map(all.map(e => [e.id, e]));
  events = all.filter(e => !e.removed);
  tracks = [...new Set(events.map(e => e.track).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  hotels = HOTEL_ORDER.filter(h => events.some(e => e.hotel === h));
  hotelChips = [...new Set(hotels.map(hotelGroup))];

  /* One pass, not a linksTo per work per event: an event counts once for
     each work it rolls up to, which is the events linksTo says yes to. */
  workCounts = new Map();
  events.forEach(e => linkedWorks(e).forEach(id => workCounts.set(id, (workCounts.get(id) || 0) + 1)));
  axisKeys = new Set();
  events.forEach(e => {
    const tg = tagsOf(e);
    AXES.forEach(a => (tg[a] || []).forEach(v => axisKeys.add(`${a}:${v}`)));
    if (tg.audience === "kids") axisKeys.add("audience:kids");
  });
}

export {
  NOISE_TRACKS, isNoise, events, byId, tracks, hotelChips, meta, tagsOf, isCeleb, isAdult, flagsOf, factsOf, sessionsOf, knownFor, DATA_URL,
  AXES, CAST, worksById, workCounts, axisKeys,
  replaceSchedule, directWorks, linkedWorks, linksTo, personName, topWorks,
};
