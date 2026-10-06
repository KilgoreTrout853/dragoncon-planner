/* The building's model (src/building.js; DECISIONS #94), on a venues file,
   drawings and schedules made here, each small enough to work out by hand.
   The two data modules it reads through stand in as
   tests/unit/year-files.test.js stands them in - virtual:venues, and
   virtual:drawings, which the build makes of a year's drawings - and the
   schedule is handed to replaceSchedule(), as a refresh hands it. No page:
   the reader's picks are a Set handed in, and a day is a con day's key.
   tests/real-data.test.js asks the same of 2027's drawings and 2026's
   schedule. New tests, not rows of tests/PORT-LEDGER.md. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { byId, events, replaceSchedule } from "../../src/data.js";
import { BUILDINGS, building, dayLights, depthOf, levelEvents, roomEvents, venueEvents } from "../../src/building.js";

/* The Grand has five levels on four storeys, written out of their order: a
   basement, drawn; the tower and the hall side by side on one storey, the
   hall drawn and the tower not, the tower first in the file's order; an
   attic and a roof, neither drawn. The Annex has one level and no drawing;
   the Tilt one level and one room, turned; the Park and the stream have no
   levels. The hotels are written out of their order too. */
const { VENUES, DRAWINGS } = vi.hoisted(() => {
  const level = (id, name, short, order, storey, rooms) => ({ id, name, short, order, storey, rooms, aliases: {}, notes: [] });
  const hotel = (name, order, levels, placeless = false) => ({ hotel: name, name, keys: [name], short: name, group: name, var: name, order, placeless, display: "rest", levels, unplaced: {} });
  const rect = (cx, cy, w, h, rot = 0) => ({ cx, cy, w, h, rot });
  return {
    VENUES: { walk: {}, same_venue_min: 5, unknown_pair_min: 12, slack_min: 10, hotels: [
      hotel("Annex", 1, [level("g", "Ground", "Ground", 0, 0, ["G1"])]),
      hotel("Streaming", 4, [], true),
      hotel("Grand", 0, [level("roof", "Roof", "Roof", 4, 3, []), level("hall", "Hall Level", "Hall", 2, 1, ["A", "B", "AB", "Foyer", "C"]),
        level("attic", "Attic", "Attic", 3, 2, ["Loft"]), level("tower", "Tower · 1", "Tower 1", 1, 1, ["T1", "T2"]), level("base", "Basement", "Basement", 0, 0, ["Z"])]),
      hotel("Park", 3, []),
      hotel("Tilt", 2, [level("t", "Terrace Level", "Terrace", 0, 0, ["R"])]),
    ] },
    DRAWINGS: [
      { hotel: "Grand", level: "hall", extent: { w: 300, h: 200 }, rooms: [{ id: "A", ...rect(60, 60, 40, 20) }, { id: "B", ...rect(100, 60, 40, 20) }],
        composites: [{ id: "AB", of: ["A", "B"] }], groups: [{ name: "A–B", kind: "ballroom", rooms: ["A", "B"], outline: rect(80, 60, 80, 20) }],
        open: [{ name: "Foyer", id: "Foyer", ...rect(80, 90, 80, 20) }, { name: "Terrace", ...rect(150, 20, 40, 10) }],
        landmarks: [{ kind: "elevator", name: "Lifts", x: 20, y: 60 }], streets: [{ name: "Main St", side: "N" }] },
      { hotel: "Tilt", level: "t", extent: { w: 200, h: 200 }, rooms: [{ id: "R", ...rect(100, 100, 40, 20, 30) }], composites: [], groups: [], open: [], landmarks: [], streets: [] },
      { hotel: "Grand", level: "base", extent: { w: 300, h: 200 }, rooms: [{ id: "Z", ...rect(200, 100, 40, 20, 90) }], composites: [], groups: [], open: [],
        landmarks: [], streets: [{ name: "Low St", side: "S" }] },
    ],
  };
});
vi.mock("virtual:venues", () => ({ default: VENUES }));
vi.mock("virtual:drawings", () => ({ default: DRAWINGS }));

const SAT = "2026-09-05", SUN = "2026-09-06";
/* An event is its id, fifty minutes from its start, at a hotel, on a level, in rooms. */
const ev = (id, start, hotel, level, rooms, over = {}) => ({ id, title: id, start, end: start.replace(/:\d\d$/, ":50"), hotel, level, rooms, room: rooms.join("-"), ...over });
const SCHEDULE = { events: [
  ev("stream", `${SAT}T08:00`, "Streaming", null, []),
  ev("tilt", `${SAT}T09:00`, "Tilt", "t", ["R"]),
  ev("early", `${SAT}T10:00`, "Grand", "hall", ["AB"]),                        // booked into the composite
  ev("foyer", `${SAT}T11:00`, "Grand", "hall", ["Foyer"]),                     // an open area with an id
  ev("lost", `${SAT}T12:00`, "Grand", "hall", ["A", "C"]),                     // C is a room the drawing lacks
  ev("bare", `${SAT}T13:00`, "Grand", "hall", []),                             // the level, and no room
  ev("tower", `${SAT}T14:00`, "Grand", "tower", ["T1"]),                       // a floor, on a drawn plate
  ev("late", `${SAT}T15:00`, "Grand", "hall", ["A"]),
  ev("off", `${SAT}T16:00`, "Grand", "hall", ["B"], { cancelled: true }),
  ev("gone", `${SAT}T17:00`, "Grand", "hall", ["B"], { removed: true }),
  ev("lobby", `${SAT}T18:00`, "Grand", null, []),                              // the venue, and no level
  ev("annex", `${SAT}T19:00`, "Annex", "g", ["G1"]),
  ev("park", `${SAT}T20:00`, "Park", null, []),
  ev("drift", `${SAT}T21:00`, "Grand", "mezz", ["M"]),                         // a level the venues file lacks
  ev("scenery", `${SAT}T22:00`, "Grand", "hall", ["Terrace"]),                 // an open area with no id, by its name
  ev("attic-off", `${SAT}T23:00`, "Grand", "attic", ["Loft"], { cancelled: true }),
  ev("roof-gone", `${SAT}T23:30`, "Grand", "roof", [], { removed: true }),
  ev("night", `${SUN}T01:00`, "Grand", "base", ["Z"]),                         // Saturday night's
  ev("sunday", `${SUN}T10:00`, "Grand", "hall", ["B"]),
  ev("sunday-off", `${SUN}T11:00`, "Grand", "hall", ["A"], { cancelled: true }),
  ev("nowhere", `${SUN}T12:00`, "Nowhere", "x", ["Y"]),                        // a hotel the venues file lacks
] };
const ids = list => list.map(e => e.id);
const plate = (hotel, key) => building(hotel).plates.find(p => p.key === key);
const round = n => Math.round(n * 100) / 100;
const ring = hull => hull.map(([x, y]) => [round(x), round(y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

beforeEach(() => replaceSchedule(SCHEDULE));

describe("which venues have a building", () => {
  it("every hotel of the venues file with levels, in the hotels' order", () => {
    expect(BUILDINGS).toEqual(["Grand", "Annex", "Tilt"]);
  });
  it("the park and a stream have none, nor a hotel the file lacks", () => {
    expect([building("Park"), building("Streaming"), building("Nowhere"), building(undefined)]).toEqual([null, null, null, null]);
  });
});

describe("a venue's plates", () => {
  it("one a storey, bottom to top", () => {
    expect(building("Grand").plates.map(p => [p.key, p.storey])).toEqual([["base", 0], ["tower+hall", 1], ["attic", 2], ["roof", 3]]);
    expect(building("Grand").hotel).toBe("Grand");
  });
  it("two levels on one storey are one plate, in the file's order, its key their ids and its two names both of theirs", () => {
    const shared = plate("Grand", "tower+hall");
    expect(ids(shared.levels)).toEqual(["tower", "hall"]);
    expect([shared.name, shared.short]).toEqual(["Tower · 1 + Hall Level", "Tower 1 + Hall"]);
    expect(shared.levels[1]).toBe(VENUES.hotels.find(h => h.hotel === "Grand").levels[1]);
  });
  it("drawn where any of its levels has a drawing", () => {
    expect(building("Grand").plates.map(p => p.drawn)).toEqual([true, true, false, false]);
    expect(building("Annex").plates.map(p => p.drawn)).toEqual([false]);
  });
  it("inert where none has and no event is on any of them: a cancelled event keeps its plate open, a removed one does not", () => {
    expect(building("Grand").plates.map(p => [p.key, p.inert])).toEqual([["base", false], ["tower+hall", false], ["attic", false], ["roof", true]]);
    expect(ids(levelEvents("Grand", "attic"))).toEqual(["attic-off"]);
    expect(byId.get("roof-gone").removed).toBe(true);
    expect(building("Annex").plates.map(p => p.inert)).toEqual([false]);
  });
  it("a drawn plate holds every room, open area, group, landmark and composite of its levels, each saying its level", () => {
    const shared = plate("Grand", "tower+hall");
    expect(shared.rooms).toEqual([{ id: "A", cx: 60, cy: 60, w: 40, h: 20, rot: 0, level: "hall" }, { id: "B", cx: 100, cy: 60, w: 40, h: 20, rot: 0, level: "hall" }]);
    expect(shared.open.map(a => [a.name, a.id, a.level])).toEqual([["Foyer", "Foyer", "hall"], ["Terrace", undefined, "hall"]]);
    expect(shared.groups.map(g => [g.name, g.rooms, g.level])).toEqual([["A–B", ["A", "B"], "hall"]]);
    expect(shared.landmarks).toEqual([{ kind: "elevator", name: "Lifts", x: 20, y: 60, level: "hall" }]);
    expect(shared.composites).toEqual([{ id: "AB", of: ["A", "B"], level: "hall" }]);
    expect(DRAWINGS[0].rooms[0]).toEqual({ id: "A", cx: 60, cy: 60, w: 40, h: 20, rot: 0 });      // the drawing's own is not written on
  });
  it("and the streets of its first drawn level, which need not be its first level", () => {
    expect(plate("Grand", "tower+hall").streets).toEqual([{ name: "Main St", side: "N" }]);
    expect(plate("Grand", "base").streets).toEqual([{ name: "Low St", side: "S" }]);
  });
  it("a plate with no drawing holds none of them", () => {
    const attic = plate("Grand", "attic");
    expect([attic.rooms, attic.open, attic.groups, attic.landmarks, attic.composites, attic.streets]).toEqual([[], [], [], [], [], []]);
  });
});

describe("the hull", () => {
  it("a turned room's corners are its true ones, each padded 10 ft on both axes", () => {
    /* 40 x 20 about (100, 100), turned 30 degrees clockwise with y running
       south: its east end dips. Corners (87.68, 81.34), (122.32, 101.34),
       (112.32, 118.66) and (77.68, 98.66); a 20 ft square about each, and
       the outline of the four squares is these eight points. */
    expect(ring(building("Tilt").hull)).toEqual([[67.68, 88.66], [67.68, 108.66], [77.68, 71.34], [97.68, 71.34], [102.32, 128.66], [122.32, 128.66], [132.32, 91.34], [132.32, 111.34]]);
  });
  it("is one shape for the venue: every room and every open area, with an id or none, on all its drawn levels", () => {
    const xs = building("Grand").hull.map(p => p[0]), ys = building("Grand").hull.map(p => p[1]);
    /* West to A on the hall level, 40 less the pad; east to Z in the basement,
       a quarter turned, 210 and the pad; north to the Terrace, an open area
       with no id, 15 less the pad; south to Z, 120 and the pad. */
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(round)).toEqual([30, 220, 5, 130]);
  });
  it("is convex, and keeps no point twice", () => {
    const hull = building("Grand").hull, n = hull.length;
    const turn = i => { const [o, a, b] = [hull[i], hull[(i + 1) % n], hull[(i + 2) % n]]; return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    expect(hull.map((_, i) => Math.sign(turn(i)))).toEqual(hull.map(() => Math.sign(turn(0))));
    expect(new Set(hull.map(p => p.join())).size).toBe(n);
  });
  it("none for a venue with no drawing", () => {
    expect(building("Annex").hull).toBe(null);
  });
});

describe("the schedule by place", () => {
  it("the events at a venue, on a level and in a room, in the schedule's order", () => {
    expect(ids(venueEvents("Grand"))).toEqual(["early", "foyer", "lost", "bare", "tower", "late", "off", "lobby", "drift", "scenery", "attic-off", "night", "sunday", "sunday-off"]);
    expect(ids(levelEvents("Grand", "hall"))).toEqual(["early", "foyer", "lost", "bare", "late", "off", "scenery", "sunday", "sunday-off"]);
    expect(roomEvents("Grand", "hall", "Foyer").map(x => x.ev.id)).toEqual(["foyer"]);
    expect(roomEvents("Grand", "hall", "Foyer")[0].ev).toBe(byId.get("foyer"));
    expect(ids(venueEvents("Park"))).toEqual(["park"]);
  });
  it("a composite's events are under each of its leaves, each remembering what it was booked as, and under no id of its own", () => {
    expect(roomEvents("Grand", "hall", "A").map(x => [x.ev.id, x.as])).toEqual([["early", "AB"], ["lost", ""], ["late", ""], ["sunday-off", ""]]);
    expect(roomEvents("Grand", "hall", "B").map(x => [x.ev.id, x.as])).toEqual([["early", "AB"], ["off", ""], ["sunday", ""]]);
    expect(roomEvents("Grand", "hall", "AB")).toEqual([]);
  });
  it("a removed event is in none, and a cancelled one is in all three", () => {
    expect(ids(events)).not.toContain("gone");
    for (const list of [venueEvents("Grand"), levelEvents("Grand", "hall"), roomEvents("Grand", "hall", "B").map(x => x.ev)]) {
      expect(ids(list)).not.toContain("gone");
      expect(ids(list)).toContain("off");
    }
    expect(ids(levelEvents("Grand", "roof"))).toEqual([]);
  });
  it("a room the drawing lacks, and a room on a floor, are under their own ids", () => {
    expect(roomEvents("Grand", "hall", "C").map(x => [x.ev.id, x.as])).toEqual([["lost", ""]]);
    expect(roomEvents("Grand", "tower", "T1").map(x => [x.ev.id, x.as])).toEqual([["tower", ""]]);
  });
  it("a room named twice over, as itself and in its composite, holds the event once", () => {
    replaceSchedule({ events: [ev("both", `${SAT}T10:00`, "Grand", "hall", ["AB", "A"])] });
    expect(roomEvents("Grand", "hall", "A").map(x => [x.ev.id, x.as])).toEqual([["both", "AB"]]);
    expect(depthOf(byId.get("both")).rooms).toEqual(["A", "B"]);
  });
  it("nothing for a place the schedule does not name", () => {
    expect([venueEvents("Tilted"), levelEvents("Grand", "cellar"), levelEvents("Tilted", "t"), roomEvents("Grand", "hall", "Q"), roomEvents("Grand", "cellar", "A"), roomEvents("Tilted", "t", "R")])
      .toEqual([[], [], [], [], [], []]);
  });
});

describe("what a day lights", () => {
  const picked = new Set(["early", "foyer", "lost", "tower", "off", "gone", "scenery", "attic-off", "night", "roof-gone", "no-such-event"]);
  it("a row a plate, bottom to top: its picks that are happening, what they light, and the day's count of what is happening", () => {
    expect(dayLights("Grand", SAT, picked)).toEqual([
      { key: "base", picks: 1, lit: [{ level: "base", id: "Z" }], events: 1 },
      { key: "tower+hall", picks: 5, lit: [{ level: "hall", id: "A" }, { level: "hall", id: "B" }, { level: "hall", id: "Foyer" }], events: 7 },
      { key: "attic", picks: 0, lit: [], events: 0 },
      { key: "roof", picks: 0, lit: [], events: 0 },
    ]);
  });
  it("a composite lights its leaves, and never itself", () => {
    expect(dayLights("Grand", SAT, new Set(["early"]))[1]).toEqual({ key: "tower+hall", picks: 1, lit: [{ level: "hall", id: "A" }, { level: "hall", id: "B" }], events: 7 });
  });
  it("an open area with an id lights as a room does; one with none is lit by nothing, its own name least of all", () => {
    expect(dayLights("Grand", SAT, new Set(["foyer"]))[1].lit).toEqual([{ level: "hall", id: "Foyer" }]);
    expect(dayLights("Grand", SAT, new Set(["scenery"]))[1]).toEqual({ key: "tower+hall", picks: 1, lit: [], events: 7 });
  });
  it("a pick that names a room the drawing lacks lights the room it has", () => {
    expect(dayLights("Grand", SAT, new Set(["lost"]))[1]).toEqual({ key: "tower+hall", picks: 1, lit: [{ level: "hall", id: "A" }], events: 7 });
  });
  it("a pick on a floor is counted on its plate and lights nothing, and a pick with no room the same", () => {
    expect(dayLights("Grand", SAT, new Set(["tower", "bare"]))[1]).toEqual({ key: "tower+hall", picks: 2, lit: [], events: 7 });
  });
  it("a cancelled pick is neither lit nor counted, and a cancelled event is in no count", () => {
    expect(dayLights("Grand", SUN, new Set(["sunday", "sunday-off"]))[1]).toEqual({ key: "tower+hall", picks: 1, lit: [{ level: "hall", id: "B" }], events: 1 });
    expect(dayLights("Grand", SUN, new Set(["sunday-off"]))[1]).toEqual({ key: "tower+hall", picks: 0, lit: [], events: 1 });
    expect(dayLights("Grand", SAT, new Set(["off", "attic-off"])).map(row => [row.picks, row.lit])).toEqual([[0, []], [0, []], [0, []], [0, []]]);
  });
  it("a removed pick, and one the schedule does not hold, are neither", () => {
    expect(dayLights("Grand", SAT, new Set(["gone", "roof-gone", "no-such-event"])).map(row => [row.picks, row.lit])).toEqual([[0, []], [0, []], [0, []], [0, []]]);
  });
  it("an event at 1 AM is the night before's", () => {
    expect(dayLights("Grand", SAT, new Set(["night"]))[0]).toEqual({ key: "base", picks: 1, lit: [{ level: "base", id: "Z" }], events: 1 });
    expect(dayLights("Grand", SUN, new Set(["night"]))[0]).toEqual({ key: "base", picks: 0, lit: [], events: 0 });
  });
  it("every plate carries the day's count, drawn or not", () => {
    expect(dayLights("Annex", SAT, new Set())).toEqual([{ key: "g", picks: 0, lit: [], events: 1 }]);
    expect(dayLights("Annex", SUN, new Set(["annex"]))).toEqual([{ key: "g", picks: 0, lit: [], events: 0 }]);
    expect(dayLights("Annex", SAT, new Set(["annex"]))).toEqual([{ key: "g", picks: 1, lit: [], events: 1 }]);
  });
  it("null for a venue with no building", () => {
    expect([dayLights("Park", SAT, picked), dayLights("Nowhere", SUN, picked)]).toEqual([null, null]);
  });
});

describe("how deep an event's place goes", () => {
  const depth = id => depthOf(byId.get(id));
  it("a room: every room it names is on the drawing of its level, a composite as its leaves and an open area with an id as itself", () => {
    expect(depth("early")).toEqual({ depth: "room", plate: "tower+hall", level: "hall", rooms: ["A", "B"] });
    expect(depth("foyer")).toEqual({ depth: "room", plate: "tower+hall", level: "hall", rooms: ["Foyer"] });
    expect(depth("night")).toEqual({ depth: "room", plate: "base", level: "base", rooms: ["Z"] });
  });
  it("a level: its level is drawn and it names no room, or one the drawing lacks - and the rooms the drawing has are still told", () => {
    expect(depth("bare")).toEqual({ depth: "level", plate: "tower+hall", level: "hall", rooms: [] });
    expect(depth("lost")).toEqual({ depth: "level", plate: "tower+hall", level: "hall", rooms: ["A"] });
    expect(depth("scenery")).toEqual({ depth: "level", plate: "tower+hall", level: "hall", rooms: [] });
  });
  it("a floor: its level has no drawing, though the level beside it on its plate has", () => {
    expect(depth("tower")).toEqual({ depth: "floor", plate: "tower+hall", level: "tower" });
    expect(depth("annex")).toEqual({ depth: "floor", plate: "g", level: "g" });
    expect(depth("attic-off")).toEqual({ depth: "floor", plate: "attic", level: "attic" });
  });
  it("the venue: it has no level, or one the venues file lacks", () => {
    expect(depth("lobby")).toEqual({ depth: "venue" });
    expect(depth("drift")).toEqual({ depth: "venue" });
  });
  it("nothing: its venue has no building", () => {
    expect([depth("park"), depth("stream"), depth("nowhere")]).toEqual([{ depth: "nothing" }, { depth: "nothing" }, { depth: "nothing" }]);
    expect(depthOf({ id: "bare-event" })).toEqual({ depth: "nothing" });
  });
  it("a cancelled event's place, and a removed one's, go as deep as any other's", () => {
    expect(depth("off")).toEqual({ depth: "room", plate: "tower+hall", level: "hall", rooms: ["B"] });
    expect(depth("gone")).toEqual({ depth: "room", plate: "tower+hall", level: "hall", rooms: ["B"] });
  });
});

/* A year with no drawing to read or to borrow is given an empty list, and
   the app is the app without a drawn level: the modules are loaded again
   over one. */
describe("with no drawing at all", () => {
  it("every plate is a floor, no venue has a hull, and nothing is lit", async () => {
    vi.resetModules();
    vi.doMock("virtual:drawings", () => ({ default: [] }));
    try {
      const data = await import("../../src/data.js"), bare = await import("../../src/building.js");
      data.replaceSchedule(SCHEDULE);
      expect(bare.BUILDINGS).toEqual(["Grand", "Annex", "Tilt"]);
      expect(bare.building("Grand").plates.map(p => [p.key, p.drawn, p.inert, p.rooms.length])).toEqual([["base", false, false, 0], ["tower+hall", false, false, 0], ["attic", false, false, 0], ["roof", false, true, 0]]);
      expect(bare.BUILDINGS.map(hotel => bare.building(hotel).hull)).toEqual([null, null, null]);
      expect(bare.dayLights("Grand", SAT, new Set(["early", "foyer"]))[1]).toEqual({ key: "tower+hall", picks: 2, lit: [], events: 7 });
      expect(bare.depthOf(data.byId.get("early"))).toEqual({ depth: "floor", plate: "tower+hall", level: "hall" });
      expect(bare.roomEvents("Grand", "hall", "AB").map(x => [x.ev.id, x.as])).toEqual([["early", ""]]);
    } finally {
      vi.doUnmock("virtual:drawings");
      vi.resetModules();
    }
  });
});

/* What the model keeps of a schedule is cleared by the identity of data.js's
   events, which replaceSchedule() makes anew at a refresh. */
describe("after a new schedule", () => {
  const LATER = { events: [
    ev("roof-party", `${SAT}T20:00`, "Grand", "roof", []),
    ev("moved", `${SAT}T10:00`, "Grand", "hall", ["B"]),
    ev("annex-off", `${SAT}T19:00`, "Annex", "g", ["G1"], { cancelled: true }),
  ] };
  it("the inert plates, the three lists, the day's lights and an event's depth all answer from it", () => {
    const before = building("Grand");
    expect([before.plates[2].inert, before.plates[3].inert, ids(levelEvents("Grand", "hall")).length]).toEqual([false, true, 9]);
    expect(dayLights("Grand", SAT, new Set(["early", "moved"]))[1].lit).toEqual([{ level: "hall", id: "A" }, { level: "hall", id: "B" }]);

    replaceSchedule(LATER);
    const after = building("Grand");
    expect(after).not.toBe(before);
    expect(after.plates.map(p => [p.key, p.inert])).toEqual([["base", false], ["tower+hall", false], ["attic", true], ["roof", false]]);
    expect(after.hull).toBe(before.hull);                                           // what a venue is built of is kept
    expect([ids(venueEvents("Grand")), ids(levelEvents("Grand", "hall")), roomEvents("Grand", "hall", "B").map(x => x.ev.id), roomEvents("Grand", "hall", "A")])
      .toEqual([["moved", "roof-party"], ["moved"], ["moved"], []]);
    expect(venueEvents("Grand")[0]).toBe(byId.get("moved"));
    expect(dayLights("Grand", SAT, new Set(["early", "moved"]))).toEqual([
      { key: "base", picks: 0, lit: [], events: 0 }, { key: "tower+hall", picks: 1, lit: [{ level: "hall", id: "B" }], events: 1 },
      { key: "attic", picks: 0, lit: [], events: 0 }, { key: "roof", picks: 0, lit: [], events: 1 }]);
    expect(depthOf(byId.get("moved"))).toEqual({ depth: "room", plate: "tower+hall", level: "hall", rooms: ["B"] });
    expect(depthOf(byId.get("roof-party"))).toEqual({ depth: "floor", plate: "roof", level: "roof" });
    expect(building("Annex").plates.map(p => p.inert)).toEqual([false]);          // its one event is cancelled, and is in the lists
    expect(dayLights("Annex", SAT, new Set(["annex-off"]))).toEqual([{ key: "g", picks: 0, lit: [], events: 0 }]);
  });
  it("and a building asked for twice of one schedule is made once", () => {
    expect(building("Grand")).toBe(building("Grand"));
    expect(levelEvents("Grand", "hall")).toBe(levelEvents("Grand", "hall"));
  });
});
