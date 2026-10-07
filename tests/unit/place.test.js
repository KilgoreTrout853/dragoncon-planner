/* A place of the Map's as a filter of Search's (src/search.js, src/filters.js;
   DECISIONS #98): which events are at a place, what a place is called, what
   the head of its card says of the way to Search and which day it goes to,
   and the place among the other filters - with a day, a word typed, another
   filter - with the one rule that holds it to the hotel. On a venues file,
   drawings and a schedule made here, each small enough to work out by hand,
   stood in as tests/unit/building.test.js stands them in; the clock is a
   Saturday of the con. No page: tests/page/place.test.js asks the same of
   the card's head and its tap, and tests/real-data.test.js of every place
   2026's Map can select. New tests, not rows of tests/PORT-LEDGER.md. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { settings, state } from "../../src/state.js";
import { setOverride } from "../../src/time.js";
import { events, replaceSchedule } from "../../src/data.js";
import { activeFilters, atPlace, browseResults, buildIndex, placeInEffect, placeLink, placeTitle, placeWords } from "../../src/search.js";
import { clearFilters, inEffect, setFilter, setPlace, settleWords, takeOffFilter } from "../../src/filters.js";

/* The Grand has four levels on three storeys: the hall, drawn - rooms A and
   B, which together are the composite AB, rooms C, D and X, and the Foyer,
   an open area with an id - beside the east tower, which has no drawing, on
   one storey; an attic, a floor with no drawing; and a roof with nothing on
   it. The Annex has one level, drawn. "Hilton" is a hotel a word in the box
   names. */
const { VENUES, DRAWINGS } = vi.hoisted(() => {
  const level = (id, name, short, order, storey, rooms) => ({ id, name, short, order, storey, rooms, aliases: {}, notes: [] });
  const hotel = (name, order, levels, short = name) => ({ hotel: name, name, keys: [name], short, group: name, var: name, order, placeless: false, display: "rest", levels, unplaced: {} });
  const rect = (cx, cy, w, h) => ({ cx, cy, w, h, rot: 0 });
  return {
    VENUES: { walk: {}, same_venue_min: 5, unknown_pair_min: 12, slack_min: 10, hotels: [
      hotel("The Grand Hotel", 0, [level("hall", "Hall Level", "Hall", 0, 0, ["A", "B", "AB", "C", "D", "X", "Foyer"]), level("east", "East Tower", "East", 1, 0, ["E1"]),
        level("attic", "Attic", "Attic", 2, 1, ["Loft"]), level("roof", "Roof", "Roof", 3, 2, [])], "Grand"),
      hotel("Annex", 1, [level("g", "Ground Floor", "Ground", 0, 0, ["G1"])]),
      hotel("Hilton", 2, [level("h", "Lobby", "Lobby", 0, 0, [])]),
    ] },
    DRAWINGS: [
      { hotel: "The Grand Hotel", level: "hall", extent: { w: 300, h: 200 }, rooms: [{ id: "A", ...rect(60, 60, 40, 20) }, { id: "B", ...rect(100, 60, 40, 20) }, { id: "C", ...rect(160, 60, 40, 20) },
        { id: "D", ...rect(220, 60, 40, 20) }, { id: "X", ...rect(220, 120, 40, 20) }], composites: [{ id: "AB", of: ["A", "B"] }], groups: [],
        open: [{ name: "Foyer", id: "Foyer", ...rect(80, 90, 80, 20) }], landmarks: [], streets: [] },
      { hotel: "Annex", level: "g", extent: { w: 100, h: 100 }, rooms: [{ id: "G1", ...rect(50, 50, 20, 20) }], composites: [], groups: [], open: [], landmarks: [], streets: [] },
    ],
  };
});
vi.mock("virtual:venues", () => ({ default: VENUES }));
vi.mock("virtual:drawings", () => ({ default: DRAWINGS }));

const GRAND = "The Grand Hotel", FRI = "2026-09-04", SAT = "2026-09-05", SUN = "2026-09-06";
/* An event is its id, fifty minutes from its start, at a hotel, on a level, in rooms. */
const ev = (id, start, hotel, level, rooms, over = {}) => ({ id, title: id, type: "panel", start, end: start.replace(/:\d\d$/, ":50"), hotel, level, rooms, room: rooms.join("-"), location: `${hotel} ${rooms.join("-")}`, ...over });
const SCHEDULE = { events: [
  ev("alpha", `${SAT}T10:00`, GRAND, "hall", ["A"], { title: "Alpha talk", type: "gaming" }),
  ev("show", `${SAT}T11:00`, GRAND, "hall", ["AB"]),                          // booked into the composite
  ev("off", `${SAT}T12:00`, GRAND, "hall", ["B"], { cancelled: true }),
  ev("foyer", `${SAT}T13:00`, GRAND, "hall", ["Foyer"]),                      // an open area with an id
  ev("bare", `${SAT}T14:00`, GRAND, "hall", []),                              // the level, and no room
  ev("east", `${SAT}T15:00`, GRAND, "east", ["E1"]),                          // the shared plate's second level
  ev("loft", `${SAT}T16:00`, GRAND, "attic", ["Loft"]),
  ev("photo", `${SAT}T17:00`, GRAND, "hall", ["A"], { title: "Photo Session: Somebody" }),
  ev("gone", `${SAT}T18:00`, GRAND, "hall", ["A"], { removed: true }),        // in no list
  ev("lobby", `${SAT}T19:00`, GRAND, null, []),                               // the venue, and no level
  ev("annex", `${SAT}T20:00`, "Annex", "g", ["G1"]),
  ev("x-off", `${SAT}T21:00`, GRAND, "hall", ["X"], { cancelled: true }),     // X has a cancelled event and no other
  ev("sunday", `${SUN}T10:00`, GRAND, "hall", ["C"]),                         // C has one event, on Sunday
  ev("loft-2", `${SUN}T11:00`, GRAND, "attic", ["Loft"]),
  ev("late-a", `${SUN}T12:00`, GRAND, "hall", ["A"], { title: "Alpha again" }),
] };
const room = (...rooms) => ({ hotel: GRAND, levels: ["hall"], rooms });
const ATTIC = { hotel: GRAND, levels: ["attic"], rooms: null }, PLATE = { hotel: GRAND, levels: ["hall", "east"], rooms: null }, ANNEX = { hotel: "Annex", levels: ["g"], rooms: null };
const ids = list => [...list].map(e => e.id).sort();
const listed = () => browseResults().map(e => e.id).sort();
const FILTERS = ["hotel", "work", "track", "medium", "genre", "craft", "subject", "type", "kind", "cost", "signup", "audience", "soldOut"];

beforeAll(() => { setOverride(`${SAT}T09:00`); });
beforeEach(() => {
  replaceSchedule(JSON.parse(JSON.stringify(SCHEDULE)));
  clearFilters();
  Object.assign(state.browse, { q: "", day: SAT, prevDay: null, place: null, showHidden: false, showPast: false, noToday: false, hideNoise: settings.hideNoise, page: 1 });
  browseResults();
});

describe("which events are at a place", () => {
  it("a room's are building.js's own list for it: booked into the room, and into a composite it is a leaf of - a cancelled one with them, a removed one never", () => {
    expect(ids(atPlace(room("A")))).toEqual(["alpha", "late-a", "photo", "show"]);
    expect(ids(atPlace(room("B")))).toEqual(["off", "show"]);
  });
  it("rooms selected together hold each event once", () => {
    expect(ids(atPlace(room("A", "B")))).toEqual(["alpha", "late-a", "off", "photo", "show"]);
  });
  it("an identified open area's, and a floor's with no drawing", () => {
    expect([ids(atPlace(room("Foyer"))), ids(atPlace(ATTIC))]).toEqual([["foyer"], ["loft", "loft-2"]]);
  });
  it("a plate's are every event on its levels, a shared plate's second level's with them - the level's own with no room too - and none known only to the venue or at another", () => {
    expect(ids(atPlace(PLATE))).toEqual(["alpha", "bare", "east", "foyer", "late-a", "off", "photo", "show", "sunday", "x-off"]);
    expect(ids(atPlace({ hotel: GRAND, levels: ["east"], rooms: null }))).toEqual(["east"]);
  });
  it("and none at a room nothing is booked into, a level nothing is on, or a venue the schedule lacks", () => {
    expect([atPlace(room("D")).size, atPlace({ hotel: GRAND, levels: ["roof"], rooms: null }).size, atPlace({ hotel: "Nowhere", levels: ["x"], rooms: ["Y"] }).size]).toEqual([0, 0, 0]);
  });
  it("made once a place and a schedule: the same Set while both stand, and a new one for a new schedule", () => {
    const place = room("A"), first = atPlace(place);
    expect(atPlace(place)).toBe(first);
    replaceSchedule({ events: SCHEDULE.events.filter(e => e.id !== "alpha").map(e => ({ ...e })) });
    expect([atPlace(place) === first, ids(atPlace(place))]).toEqual([false, ["late-a", "photo", "show"]]);
  });
});

describe("what a place is called", () => {
  it("a room by its name, after the venue's short name and a middle dot", () => {
    expect([placeTitle(room("A")), placeWords(room("A"))]).toEqual(["A", "Grand · A"]);
  });
  it("rooms that are exactly a composite's leaves by the composite's name, and any other set one by one", () => {
    expect([placeWords(room("A", "B")), placeWords(room("B", "A")), placeWords(room("A", "C"))]).toEqual(["Grand · AB", "Grand · AB", "Grand · A + C"]);
  });
  it("a plate of one level by its full name, a floor with no drawing too; a shared plate by its levels' short names", () => {
    expect([placeWords(ATTIC), placeWords(ANNEX), placeWords(PLATE), placeWords({ hotel: GRAND, levels: ["east"], rooms: null })]).toEqual(["Grand · Attic", "Annex · Ground Floor", "Grand · Hall + East", "Grand · Hall + East"]);
  });
});

describe("where a card's head goes, and its name", () => {
  it("several events on the day: that day, and all of them by their number", () => {
    expect(placeLink(room("A"), SAT)).toEqual({ day: SAT, name: "All 3 events in A on Saturday, in Search" });
  });
  it("one event is said as one, never as All 1 events", () => {
    expect(placeLink(room("C"), SUN)).toEqual({ day: SUN, name: "The 1 event in C on Sunday, in Search" });
    expect(placeLink(room("Foyer"), SAT).name).toBe("The 1 event in Foyer on Saturday, in Search");
  });
  it("a cancelled event that day is in no count and is said apart, since the list holds it", () => {
    expect(placeLink(room("A", "B"), SAT)).toEqual({ day: SAT, name: "All 3 events in AB on Saturday, and 1 cancelled, in Search" });
    expect(placeLink(room("B"), SAT).name).toBe("The 1 event in B on Saturday, and 1 cancelled, in Search");
    expect(placeLink(PLATE, SAT).name).toBe("All 6 events in Hall + East on Saturday, and 2 cancelled, in Search");
  });
  it("nothing on the day and something on others: every day, by what is happening on all of them, with every cancelled one said", () => {
    expect(placeLink(room("C"), SAT)).toEqual({ day: "All", name: "The 1 event in C, on every day, in Search" });
    expect(placeLink(ATTIC, FRI)).toEqual({ day: "All", name: "All 2 events in Attic, on every day, in Search" });
    expect(placeLink(room("B"), SUN)).toEqual({ day: "All", name: "The 1 event in B, on every day, and 1 cancelled, in Search" });
  });
  it("a cancelled event on another day is not said of the day asked", () => {
    expect(placeLink(room("A", "B"), SUN).name).toBe("The 1 event in AB on Sunday, in Search");
  });
  it("no link where the place has nothing at all, or nothing but what is cancelled", () => {
    expect([placeLink(room("D"), SAT), placeLink(room("X"), SAT), placeLink({ hotel: GRAND, levels: ["roof"], rooms: null }, SAT)]).toEqual([null, null, null]);
  });
});

describe("a place among Search's filters", () => {
  it("setPlace() sets the place, its venue as the hotel, the day, no query and no other filter, and puts the last question's answers back - the toggle left as it stands", () => {
    FILTERS.forEach(d => { state.browse[d] = "x"; });
    Object.assign(state.browse, { q: "trek", day: SUN, prevDay: FRI, showHidden: true, showPast: true, noToday: true, hideNoise: false, page: 4 });
    const place = room("A");
    setPlace(place, SAT);
    const b = state.browse;
    expect([b.place, b.hotel, b.day, b.q, b.prevDay, b.showHidden, b.showPast, b.noToday, b.page, b.hideNoise]).toEqual([place, GRAND, SAT, "", null, false, false, false, 1, false]);
    expect(FILTERS.filter(d => d !== "hotel").map(d => b[d])).toEqual(Array(12).fill("All"));
  });
  it("the list is the place's on the day, a cancelled event with it - and a photo session too, whatever the setting that hides them", () => {
    setPlace(room("A"), SAT);
    expect([state.browse.hideNoise, activeFilters().hideNoise, listed()]).toEqual([true, false, ["alpha", "photo", "show"]]);
    setPlace(room("B"), SAT);
    expect(listed()).toEqual(["off", "show"]);
    setPlace(PLATE, SAT);
    expect(listed()).toEqual(["alpha", "bare", "east", "foyer", "off", "photo", "show", "x-off"]);
  });
  it("with no place a photo session is hidden as it was", () => {
    Object.assign(state.browse, { hotel: GRAND });
    expect([activeFilters().hideNoise, listed().includes("photo")]).toEqual([true, false]);
  });
  it("a day narrows it, and All days lists every day's", () => {
    setPlace(room("A"), SAT);
    state.browse.day = SUN;
    expect([listed(), !!state.browse.place]).toEqual([["late-a"], true]);
    state.browse.day = "All";
    expect(listed()).toEqual(["alpha", "late-a", "photo", "show"]);
  });
  it("another filter narrows it, and leaves it set", () => {
    setPlace(room("A"), SAT);
    setFilter("type", "gaming");
    expect([listed(), state.browse.place.rooms, inEffect().map(f => f.dim)]).toEqual([["alpha"], ["A"], ["place", "type"]]);
  });
  it("a word typed ranks within it", () => {
    buildIndex();
    setPlace(room("A"), SAT);
    Object.assign(state.browse, { q: "alpha", day: "All" });
    expect([listed(), !!placeInEffect({})]).toEqual([["alpha", "late-a"], true]);
  });
});

describe("the one rule that holds a place to the hotel", () => {
  it("in effect while the hotel is its venue; gone, where it is read, once the hotel is another by any road", () => {
    const place = room("A");
    setPlace(place, SAT);
    expect(placeInEffect({})).toBe(place);
    state.browse.hotel = "Annex";
    expect([placeInEffect({}), state.browse.place, state.browse.hotel]).toEqual([null, null, "Annex"]);
    setPlace(place, SAT);
    clearFilters();
    expect([activeFilters().place, state.browse.place, state.browse.hotel]).toEqual([null, null, "All"]);
  });
  it("a hotel word typed and not yet settled wins: the place is not in effect, and is kept for the word's leaving; settled, the word takes the hotel and the place with it", () => {
    const place = room("A");
    setPlace(place, SAT);
    state.browse.q = "hilton";
    expect([listed(), activeFilters().place, state.browse.place, inEffect()]).toEqual([[], null, place, []]);
    state.browse.q = "";
    expect([listed(), activeFilters().place]).toEqual([["alpha", "photo", "show"], place]);
    state.browse.q = "hilton";
    settleWords();
    expect([state.browse.hotel, activeFilters().place, state.browse.place]).toEqual(["All", null, null]);
  });
  it("a new schedule with no event at the place: the place goes, with no error, and the hotel stays", () => {
    setPlace(room("A"), SAT);
    replaceSchedule({ events: SCHEDULE.events.filter(e => !(e.rooms.includes("A") || e.rooms.includes("AB"))).map(e => ({ ...e })) });
    expect([activeFilters().place, state.browse.place, state.browse.hotel]).toEqual([null, null, GRAND]);
    expect(listed()).toEqual(["bare", "east", "foyer", "lobby", "loft", "off", "x-off"]);
  });
  it("one that still has an event there keeps it", () => {
    const place = room("A");
    setPlace(place, SAT);
    replaceSchedule({ events: SCHEDULE.events.filter(e => e.id !== "alpha").map(e => ({ ...e })) });
    expect([activeFilters().place, listed()]).toEqual([place, ["photo", "show"]]);
  });
});

describe("the chip's, and the sheet's taps", () => {
  it("one filter in effect, the place's, by its words - and the venue is no second one", () => {
    setPlace(room("A", "B"), SAT);
    expect(inEffect()).toEqual([{ dim: "place", label: "Grand · AB" }]);
  });
  it("with no place the hotel is the filter in effect, as built", () => {
    state.browse.hotel = GRAND;
    expect(inEffect()).toEqual([{ dim: "hotel", label: "Grand" }]);
  });
  it("the place's chip taken off takes the place and the hotel it holds, both; any other chip its own filter alone", () => {
    setPlace(room("A"), SAT);
    setFilter("type", "gaming");
    takeOffFilter("type");
    expect([state.browse.type, !!state.browse.place, state.browse.hotel]).toEqual(["All", true, GRAND]);
    takeOffFilter("place");
    expect([state.browse.place, state.browse.hotel]).toEqual([null, "All"]);
  });
  it("a tap in the sheet on the place's own venue, which is pressed, takes the place off and leaves the hotel, one step wider; a second tap is All", () => {
    setPlace(room("A"), SAT);
    setFilter("hotel", GRAND);
    expect([state.browse.place, state.browse.hotel, inEffect()]).toEqual([null, GRAND, [{ dim: "hotel", label: "Grand" }]]);
    expect(events.filter(e => e.hotel === GRAND && e._cd === SAT && !/^Photo/.test(e.title)).length).toBe(listed().length);
    setFilter("hotel", GRAND);
    expect(state.browse.hotel).toBe("All");
  });
  it("any other hotel's chip sets that hotel, and the place goes with the one it held", () => {
    setPlace(room("A"), SAT);
    setFilter("hotel", "Annex");
    expect([state.browse.hotel, inEffect(), state.browse.place, listed()]).toEqual(["Annex", [{ dim: "hotel", label: "Annex" }], null, ["annex"]]);
  });
});
