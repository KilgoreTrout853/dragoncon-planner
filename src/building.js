/* The building's model (DECISIONS #60, #94): what the building view asks of a
   venue - its plates, a plate's rooms, the schedule by place, what a day
   lights, and how deep an event's place goes. It draws nothing: no markup,
   no DOM, no storage and no clock. The level drawings are the year's, or a
   later year's borrowed, which the build makes into virtual:drawings and
   inlines as it does the other two data modules; the levels and their
   storeys are the venues file's, through venues.js; a turned rectangle's
   corners are level.js's; the schedule is data.js's; and the reader's picks
   are handed in, so it stands below them.

   It keeps two things. What a venue is built of comes of the venues file and
   the drawings alone, both the build's, so it is made once and kept. What
   the schedule says - the lists by place, and which plates are inert - is
   made once a schedule: it remembers the events it was made from, and
   replaceSchedule() makes new ones, as foryou.js's index is kept. What it
   hands back - a building, its plates and their lists, the hull, the lists
   by place - is what it keeps, so each is frozen where it is made: a caller
   that sorts, sorts a copy. The levels and the streets among them are the
   two files' own objects, to be read and never written on.

   The words: a plate is one storey of a venue, the levels that stand side by
   side on it; a leaf is a room a drawing draws as a shape, or an open area
   with an id; a composite is a room that is a union of leaves; a floor is a
   level with no drawing. */
import DRAWINGS from "virtual:drawings";
import { corners } from "./level.js";
import { HOTEL_ORDER, hotelLevels } from "./venues.js";
import { events, happening } from "./data.js";

const HULL_PAD = 10;          // ft: how far the hull stands off every corner, on each axis
const FLAT = 1e-9;            // sq ft: a turn no sharper is a point on a side - two walls on one line, a rounding apart
const NONE = Object.freeze([]);

const put = (map, key, value) => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };

/* The drawings by hotel and then level, each with what a room id is on it:
   a leaf room and an open area with an id are themselves, and a composite
   is its leaves. An open area with no id is scenery, and no id reaches it. */
const DRAWN = new Map();
for (const drawing of DRAWINGS) {
  const leaves = new Map([...drawing.rooms.map(r => [r.id, [r.id]]), ...drawing.open.filter(a => "id" in a).map(a => [a.id, [a.id]]),
    ...drawing.composites.map(c => [c.id, c.of])]);
  if (!DRAWN.has(drawing.hotel)) DRAWN.set(drawing.hotel, new Map());
  DRAWN.get(drawing.hotel).set(drawing.level, {drawing, leaves});
}
const drawnOf = (hotel, level) => { const levels = DRAWN.get(hotel); return (levels && levels.get(level)) || null; };

/* The venues that have a building: every hotel of the venues file with
   levels, in the hotels' order. The park, a stream and an offsite venue have
   none. */
const BUILDINGS = HOTEL_ORDER.filter(hotel => hotelLevels(hotel).length);

/* Each point stood off by the pad on both axes: the corners of a square about it. */
const padded = (points, pad) => points.flatMap(([x, y]) => [[x - pad, y - pad], [x + pad, y - pad], [x + pad, y + pad], [x - pad, y + pad]]);
/* The convex outline of some points, as a ring of them: a monotone chain,
   exact, and then the ring less each point that lies on a side, to within
   FLAT. The tolerance is the ring's and never the chain's: two walls on one
   line sort a rounding apart, and a flat turn let pass in the chain there
   drops the wall's end for a point on it. */
function convex(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const ring = [...half(sorted), ...half(sorted.reverse())];
  for (let found = true; found && ring.length > 3;) {
    found = false;
    for (let i = 0; i < ring.length && ring.length > 3; i++) {
      const n = ring.length;
      if (cross(ring[(i + n - 1) % n], ring[i], ring[(i + 1) % n]) > FLAT) continue;
      ring.splice(i--, 1);
      found = true;
    }
  }
  return ring;
}

/* What a venue is built of, made once and kept: its plates, bottom to top,
   one a storey - levels that share a storey share a plate, in the file's
   order - and its hull, the convex outline of every corner of every room
   and open area on all its drawn levels, each corner padded: one shape for
   every plate, in feet in the hotel's frame, and null where the venue has
   no drawing, since a footprint is not the model's to invent. Null itself
   for a venue with no levels. */
const STACKS = new Map();
function stackOf(hotel) {
  if (STACKS.has(hotel)) return STACKS.get(hotel);
  const byStorey = new Map();
  for (const level of hotelLevels(hotel)) put(byStorey, level.storey, level);
  const plates = [...byStorey.keys()].sort((a, b) => a - b).map(storey => {
    const levels = byStorey.get(storey), drawn = levels.map(level => drawnOf(hotel, level.id)).filter(Boolean);
    const all = part => Object.freeze(drawn.flatMap(({drawing}) => drawing[part].map(item => Object.freeze({...item, level: drawing.level}))));
    return {key: levels.map(level => level.id).join("+"), storey, levels: Object.freeze(levels), name: levels.map(level => level.name).join(" + "),
      short: levels.map(level => level.short).join(" + "), drawn: drawn.length > 0, rooms: all("rooms"), open: all("open"), groups: all("groups"),
      landmarks: all("landmarks"), composites: all("composites"), streets: drawn.length ? drawn[0].drawing.streets : NONE};
  });
  const points = plates.flatMap(plate => [...plate.rooms, ...plate.open].flatMap(corners));
  const stack = plates.length ? {hotel, plates, hull: points.length ? Object.freeze(convex(padded(points, HULL_PAD)).map(Object.freeze)) : null} : null;
  STACKS.set(hotel, stack);
  return stack;
}

/* The schedule by place, made once a schedule: the events at a venue, on a
   level and in a room, in the schedule's order - start and then title, the
   order data.js keeps its events in. Its events never hold a removed one
   (#49), so none is in any list; a cancelled one is in them (#90), and is
   never lit or counted. An event booked into a composite is under each of
   the composite's leaves, each entry remembering the composite, `as`;
   booked into a room itself, `as` is "". A room the drawing lacks, or one on
   a floor, is under its own id. With the lists, the buildings made of this
   schedule. */
let index = null;
function indexed() {
  if (index && index.of === events) return index;
  const venues = new Map();
  for (const ev of events) {
    if (!ev.hotel) continue;
    let venue = venues.get(ev.hotel);
    if (!venue) venues.set(ev.hotel, venue = {list: [], levels: new Map()});
    venue.list.push(ev);
    if (!ev.level) continue;
    let level = venue.levels.get(ev.level);
    if (!level) venue.levels.set(ev.level, level = {list: [], rooms: new Map()});
    level.list.push(ev);
    const drawn = drawnOf(ev.hotel, ev.level), seen = new Set();
    for (const id of ev.rooms || []) {
      for (const leaf of (drawn && drawn.leaves.get(id)) || [id]) {
        if (seen.has(leaf)) continue;
        seen.add(leaf);
        put(level.rooms, leaf, Object.freeze({ev, as: leaf === id ? "" : id}));
      }
    }
  }
  for (const venue of venues.values()) {
    Object.freeze(venue.list);
    for (const level of venue.levels.values()) [level.list, ...level.rooms.values()].forEach(Object.freeze);
  }
  index = {of: events, venues, buildings: new Map()};
  return index;
}
const placed = (hotel, level) => { const venue = indexed().venues.get(hotel); return (venue && venue.levels.get(level)) || null; };
const venueEvents = hotel => { const venue = indexed().venues.get(hotel); return venue ? venue.list : NONE; };
const levelEvents = (hotel, level) => { const at = placed(hotel, level); return at ? at.list : NONE; };
/* A room's are entries, {ev, as}, for the composite each was booked as. */
const roomEvents = (hotel, level, room) => { const at = placed(hotel, level); return (at && at.rooms.get(room)) || NONE; };

/* A venue's building, or null for a venue with none: {hotel, plates, hull}.
   A plate is {key, storey, levels, name, short, drawn, inert, rooms, open,
   groups, landmarks, composites, streets}: its key its levels' ids, joined
   by a "+", which no level's id holds; its name and its short name both of
   theirs, each joined by " + "; drawn where any of its levels has
   a drawing; inert where none has and no event of the schedule, cancelled
   or not, is on any of them - a cancelled event is in the lists, so its
   plate has to open, and a removed one is in none. On a drawn plate, every
   room, open area, group, landmark and composite of its levels, each saying
   which level it is of, and the streets of its first drawn level. Inert is
   the schedule's to say, so a building is made once a schedule. */
function building(hotel) {
  const stack = stackOf(hotel);
  if (!stack) return null;
  const made = indexed().buildings;
  if (!made.has(hotel)) {
    const plates = stack.plates.map(plate => Object.freeze({...plate, inert: !plate.drawn && !plate.levels.some(level => levelEvents(hotel, level.id).length)}));
    made.set(hotel, Object.freeze({...stack, plates: Object.freeze(plates)}));
  }
  return made.get(hotel);
}

/* What an event's rooms are on its level's drawing: the leaves found, each
   once, in the order named, and whether every room it names was found. */
function leavesOn(drawn, rooms) {
  const found = [];
  let whole = true;
  for (const id of rooms || []) {
    const leaves = drawn.leaves.get(id);
    if (!leaves) whole = false;
    else for (const leaf of leaves) if (!found.includes(leaf)) found.push(leaf);
  }
  return {found, whole};
}

/* What a day lights at a venue, for a con day and a reader's picks - picked,
   a Set of event ids: a row a plate, bottom to top, {key, picks, lit,
   events}. picks counts those on the plate's levels that day that are
   happening (#90).
   lit is the rooms and the open areas with an id that those picks light on a
   drawing, each {level, id}, a composite as its leaves; a pick lights what
   the drawing has of its rooms, though it names one the drawing lacks.
   events is the day's count of what is happening there, on every plate,
   drawn or not: where it is said is the view's. A day is a con day's key,
   an event's _cd, so an event at 1 AM is the night before's. Null for a
   venue with no building. */
function dayLights(hotel, day, picked) {
  const made = building(hotel);
  if (!made) return null;
  return made.plates.map(plate => {
    const row = {key: plate.key, picks: 0, lit: [], events: 0};
    for (const level of plate.levels) {
      const drawn = drawnOf(hotel, level.id), lit = new Set();
      for (const ev of levelEvents(hotel, level.id)) {
        if (ev._cd !== day || !happening(ev)) continue;
        row.events++;
        if (!picked.has(ev.id)) continue;
        row.picks++;
        if (drawn) for (const leaf of leavesOn(drawn, ev.rooms).found) lit.add(leaf);
      }
      for (const id of lit) row.lit.push({level: level.id, id});
    }
    return row;
  });
}

/* How deep an event's place goes: {depth}, with {plate, level} from a floor
   down - the plate by its key - and {rooms}, as leaves, from a level down. A
   room: every room it names is on the drawing of its level. A level: its
   level is drawn, and it names no room, or one the drawing lacks - rooms is
   then the leaves the drawing does have, none where it has none. A floor:
   its level has no drawing. The venue: it has no level, or one the venues
   file lacks. Nothing: its venue has no building. It asks the level's own
   drawing, not its plate's: a floor may share a plate with a drawn level,
   so a view asks the depth, and not whether the plate is drawn. */
function depthOf(ev) {
  const stack = stackOf(ev.hotel);
  if (!stack) return {depth: "nothing"};
  const plate = ev.level ? stack.plates.find(p => p.levels.some(level => level.id === ev.level)) : null;
  if (!plate) return {depth: "venue"};
  const drawn = drawnOf(ev.hotel, ev.level);
  if (!drawn) return {depth: "floor", plate: plate.key, level: ev.level};
  const {found, whole} = leavesOn(drawn, ev.rooms);
  return {depth: whole && found.length ? "room" : "level", plate: plate.key, level: ev.level, rooms: found};
}

export { BUILDINGS, building, venueEvents, levelEvents, roomEvents, dayLights, depthOf };
