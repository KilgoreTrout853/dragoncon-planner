/* What the event's sheet reads (DECISIONS #74), with no page: the facts a
   sheet says and a row does not (data.js factsOf()), an event's other
   sessions (sessionsOf()), a person's known-for line from the file's people
   block (knownFor(), #61), the level in full (venues.js levelName(), against
   the year's venues file, 2026's) and every pick an event overlaps, or would
   as a pick (walk.js clashesOf()); and the 2026 counts the design was
   settled on, from the committed schedule. Each test makes its own events
   and its own people block: the sample fixture has neither a part, a play
   nor a block. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { levelName, levelShort } from "../../src/venues.js";
import { byId, factsOf, knownFor, replaceSchedule, sessionsOf } from "../../src/data.js";
import { replacePicks } from "../../src/picks.js";
import { clashesOf, overlapsOf } from "../../src/walk.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ev = (id, start, end, more = {}) => ({id, title: id, type: "panel", day: "2026-09-05", start: `2026-09-05T${start}`,
  end: `2026-09-05T${end}`, hotel: "Hilton", room: "201", tracks: [], speakers: [], people: [], facets: {}, ...more});
const ids = list => list.map(e => e.id);

describe("the facts a sheet says and a row does not", () => {
  const facts = (facets, play) => factsOf({facets, ...(play ? {tags: {play}} : {})}).map(f => f.label);
  it("the part, as the listing numbers it", () => {
    expect(facts({part: 2})).toEqual(["Part 2"]);
    expect(facts({part: 1, repeat_key: "x"})).toEqual(["Part 1"]);
  });
  it("a game's format, in the sheet's words, each of the six", () => {
    const said = format => facts({}, {format, level: "any"});
    expect(["one-shot", "organized-play", "learn-to-play", "tournament", "demo", "open-play"].map(said))
      .toEqual([["One-shot game"], ["Organized play"], ["Learn to play"], ["Tournament"], ["Demo"], ["Open play"]]);
  });
  it("with beginners welcome after it where the level is beginner, and nothing for level any", () => {
    expect(facts({}, {format: "one-shot", level: "beginner"})).toEqual(["One-shot game, beginners welcome"]);
    expect(facts({}, {format: "demo", level: "beginner"})).toEqual(["Demo, beginners welcome"]);
    expect(facts({}, {format: "tournament", level: "any"})).toEqual(["Tournament"]);
  });
  it("but Learn to play says so itself, and takes no tail", () => {
    expect(facts({}, {format: "learn-to-play", level: "beginner"})).toEqual(["Learn to play"]);
  });
  it("the part before the format, each with its key", () => {
    expect(factsOf({facets: {part: 2}, tags: {play: {format: "tournament", level: "beginner"}}}))
      .toEqual([{key: "part", label: "Part 2"}, {key: "play", label: "Tournament, beginners welcome"}]);
  });
  it("nothing for an event with neither, for a format it does not know, and for an untagged event", () => {
    expect(facts({cost: "extra", sold_out: true})).toEqual([]);
    expect(facts({}, {format: "campaign", level: "beginner"})).toEqual([]);
    expect(factsOf({})).toEqual([]);
    expect(factsOf({tags: {audience: "mature"}})).toEqual([]);
  });
});

/* A made weekend. "Demo" runs four times with no one named, one of them
   cancelled and one removed; "Signing" is one repeat key and one title with
   two line-ups; "Talk" shares a key with "Talk, again" and not a title. */
const who = (...names) => names.map(id => ({id, name: id, role: "Speaker", src: "speakers"}));
const repeat = key => ({facets: {repeat_key: key}});
const on = (day, hhmm) => ({day: `2026-09-0${day}`, start: `2026-09-0${day}T${hhmm}`, end: `2026-09-0${day}T23:59`});
const SESSIONS = [
  ev("demo-fri", "", "", {title: "Demo", ...repeat("demo"), ...on(4, "10:00")}),
  ev("demo-sat", "", "", {title: "Demo", ...repeat("demo"), ...on(5, "10:00")}),
  ev("demo-sat-late", "", "", {title: "Demo", ...repeat("demo"), ...on(5, "16:00"), hotel: "Hyatt", room: "Inman"}),
  ev("demo-sun", "", "", {title: "Demo", ...repeat("demo"), ...on(6, "10:00")}),
  ev("demo-cancelled", "", "", {title: "Demo", ...repeat("demo"), ...on(6, "12:00"), cancelled: true}),
  ev("demo-removed", "", "", {title: "Demo", ...repeat("demo"), ...on(6, "14:00"), removed: true}),
  ev("sign-ab", "", "", {title: "Signing", ...repeat("signing"), ...on(4, "11:00"), people: who("a", "b")}),
  ev("sign-ba", "", "", {title: "Signing", ...repeat("signing"), ...on(5, "11:00"), people: who("b", "a", "a")}),
  ev("sign-ac", "", "", {title: "Signing", ...repeat("signing"), ...on(5, "13:00"), people: who("a", "c")}),
  ev("sign-a", "", "", {title: "Signing", ...repeat("signing"), ...on(6, "11:00"), people: who("a")}),
  ev("talk", "", "", {title: "Talk", ...repeat("talk"), ...on(4, "12:00")}),
  ev("talk-again", "", "", {title: "Talk, again", ...repeat("talk"), ...on(5, "12:00")}),
  ev("alone", "", "", {title: "Demo", ...on(5, "09:00")}),
];

describe("an event's other sessions", () => {
  beforeAll(() => replaceSchedule({generated_at: "x", works: [], events: SESSIONS}));
  /* Which events are an event's sessions is asked before the con, when none
     has started; what the moment leaves out, at Saturday noon and after. */
  const BEFORE = new Date("2026-09-03T08:00"), SAT_NOON = new Date("2026-09-05T12:00"), AFTER = new Date("2026-09-08T08:00");
  const of = (id, at = BEFORE) => ids(sessionsOf(byId.get(id), at));

  it("are the events with its repeat key, its title and its people, never itself", () => {
    expect(of("demo-fri")).toEqual(["demo-sat", "demo-sat-late", "demo-sun"]);
    expect(of("demo-sat")).not.toContain("demo-sat");
  });
  it("only those not yet started, in start order: the rest are left out", () => {
    expect(of("demo-sat")).toEqual(["demo-fri", "demo-sat-late", "demo-sun"]);
    expect(of("demo-sat", SAT_NOON)).toEqual(["demo-sat-late", "demo-sun"]);
    expect(of("demo-fri", SAT_NOON)).toEqual(["demo-sat-late", "demo-sun"]);
    expect(of("demo-sat", new Date("2026-09-06T09:59"))).toEqual(["demo-sun"]);
  });
  it("with none left there are none: after the con, every list is empty", () => {
    for (const e of SESSIONS) expect(of(e.id, AFTER), e.id).toEqual([]);
  });
  it("a session starting at the moment asked has started", () => {
    expect(of("demo-fri", new Date("2026-09-05T16:00"))).toEqual(["demo-sun"]);
    expect(of("demo-fri", new Date("2026-09-05T15:59"))).toEqual(["demo-sat-late", "demo-sun"]);
  });
  it("the same people, by id, whatever their order and however often the listing names one", () => {
    expect(of("sign-ab")).toEqual(["sign-ba"]);
    expect(of("sign-ba")).toEqual(["sign-ab"]);
  });
  it("another line-up under the same key and title is not its session", () => {
    expect(of("sign-ac")).toEqual([]);
    expect(of("sign-a")).toEqual([]);
  });
  it("nor is another title under the same key", () => {
    expect(of("talk")).toEqual([]);
    expect(of("talk-again")).toEqual([]);
  });
  it("a cancelled or a removed session is in no other's list", () => {
    expect(of("demo-sun")).not.toContain("demo-cancelled");
    expect(of("demo-sun")).not.toContain("demo-removed");
    expect(of("demo-sun")).toEqual(["demo-fri", "demo-sat", "demo-sat-late"]);
  });
  it("but a cancelled or a removed event names its live sessions still to come", () => {
    expect(of("demo-cancelled")).toEqual(["demo-fri", "demo-sat", "demo-sat-late", "demo-sun"]);
    expect(of("demo-removed")).toEqual(["demo-fri", "demo-sat", "demo-sat-late", "demo-sun"]);
    expect(of("demo-cancelled", SAT_NOON)).toEqual(["demo-sat-late", "demo-sun"]);
    expect(of("demo-removed", SAT_NOON)).toEqual(["demo-sat-late", "demo-sun"]);
  });
  it("none for an event with no repeat key, though another has its title", () => {
    expect(of("alone")).toEqual([]);
    expect(of("demo-fri")).not.toContain("alone");
  });
});

describe("a person's known-for line", () => {
  const load = people => replaceSchedule({generated_at: "x", works: [], ...(people ? {people} : {}), events: [ev("e", "10:00", "11:00", {people: who("erin-gray", "bo")})]});
  it("is the file's people block's, joined by id", () => {
    load([{id: "erin-gray", name: "Erin Gray", known_for: "Colonel Wilma Deering on Buck Rogers in the 25th Century"}]);
    expect(knownFor("erin-gray")).toBe("Colonel Wilma Deering on Buck Rogers in the 25th Century");
  });
  it("is nothing for a person the block does not hold", () => {
    expect(knownFor("bo")).toBe("");
    expect(knownFor(undefined)).toBe("");
  });
  it("is nothing for anyone where the block is empty, or the file has none", () => {
    load([]);
    expect(knownFor("erin-gray")).toBe("");
    load([{id: "erin-gray", name: "Erin Gray", known_for: "x"}]);
    expect(knownFor("erin-gray")).toBe("x");
    load(null);
    expect(knownFor("erin-gray")).toBe("");
  });
});

describe("the level a sheet says", () => {
  const level = (hotel, lv, room) => levelName({hotel, level: lv, room});
  it("is the level's full name, where the row's short name stops short of it", () => {
    expect(level("Hyatt", "acc", "Kennesaw")).toBe("Atlanta Conference Center (LL3)");
    expect(level("Hyatt", "exhibit", "Hanover AB")).toBe("Exhibit Level (LL2)");
    expect(level("Hyatt", "tower-ll1", "International North")).toBe("International Tower · LL1");
    expect(level("AmericasMart Building 2", "f3", "Mart2 203E BERNINA - booth 3300")).toBe("3rd Floor");
  });
  it("and the same name where the two are one", () => {
    expect(level("Hilton", "l4", "404-405")).toBe("4th Floor");
    expect(level("Westin", "f8", "Peachtree Ballroom")).toBe("8th Floor");
    expect(level("Marriott", "marquis", "Imperial Ballroom")).toBe("Marquis Level");
  });
  it("is left off exactly where a row leaves it off: the room says it", () => {
    expect(level("Marriott", "atrium", "Atrium Ballroom")).toBe("");
    expect(level("Hyatt", "acc", "Atlanta Conference Center Inman")).toBe("");
    expect(level("AmericasMart Building 3", "f1", "Mart Building 3, Floor 1")).toBe("");
    expect(level("Westin", "f14", "14th Fl. Ansley 1")).toBe("");
  });
  it("is nothing where the event has no level, or one the file does not hold", () => {
    expect(level("Hilton", null, "Steps B")).toBe("");
    expect(level("Hilton", "l9", "901")).toBe("");
    expect(level("Streaming", null, "")).toBe("");
    expect(level("Nowhere", "l1", "1")).toBe("");
  });
});

/* The row's made Saturday (tests/unit/row.test.js): a four-hour pick with
   three short ones inside it, a pair that only touch, a stream, a cancelled
   pick and a removed one - and three events that are not picks. */
const PLAN = [
  ev("long", "10:00", "14:00"),
  ev("in-a", "10:00", "11:00", {hotel: "Hyatt", room: "Inman"}),
  ev("in-b", "11:30", "12:30", {hotel: "Marriott", room: "A706"}),
  ev("in-c", "13:00", "14:00"),
  ev("touch-a", "15:00", "16:00"),
  ev("touch-b", "16:00", "17:00", {hotel: "Westin", room: "Chastain 1"}),
  ev("stream", "16:30", "17:30", {hotel: "Streaming", room: ""}),
  ev("cancelled", "15:30", "16:30", {cancelled: true}),
  ev("removed", "15:15", "15:45", {removed: true}),
  ev("unpicked", "10:30", "11:30"),
  ev("unpicked-late", "15:45", "16:45"),
  ev("unpicked-clear", "18:00", "19:00"),
  ev("unpicked-cancelled", "10:30", "11:30", {cancelled: true}),
  ev("unpicked-removed", "10:30", "11:30", {removed: true}),
];

describe("every pick an event overlaps, or would as a pick", () => {
  beforeAll(() => {
    replaceSchedule({generated_at: "x", works: [], events: PLAN});
    replacePicks(["long", "in-a", "in-b", "in-c", "touch-a", "touch-b", "stream", "cancelled", "removed", "elsewhere"]);
  });
  const would = id => ids(clashesOf(byId.get(id)));

  it("an event that is not a pick: every pick it would overlap, in start order", () => {
    expect(would("unpicked")).toEqual(["in-a", "long"]);
    expect(would("unpicked-late")).toEqual(["touch-a", "touch-b", "stream"]);
  });
  it("where a row's flag asks the same of it and has nothing: it is not a pick", () => {
    expect(ids(overlapsOf(byId.get("unpicked")))).toEqual([]);
    expect(ids(overlapsOf(byId.get("unpicked-late")))).toEqual([]);
  });
  it("nothing where it would overlap none", () => {
    expect(would("unpicked-clear")).toEqual([]);
  });
  it("a pick: exactly what its row's flag says, for every pick of the plan", () => {
    for (const id of ["long", "in-a", "in-b", "in-c", "touch-a", "touch-b", "stream"]) expect(would(id), id).toEqual(ids(overlapsOf(byId.get(id))));
    expect(would("long")).toEqual(["in-a", "in-b", "in-c"]);
  });
  it("a cancelled or a removed event would overlap nothing, picked or not, and counts in no other's", () => {
    expect([would("cancelled"), would("removed"), would("unpicked-cancelled"), would("unpicked-removed")]).toEqual([[], [], [], []]);
    expect(would("unpicked-late")).not.toContain("cancelled");
    expect(would("unpicked-late")).not.toContain("removed");
  });
  it("never itself, and never a pick the schedule does not hold", () => {
    expect(would("long")).not.toContain("long");
    expect(would("unpicked")).not.toContain("elsewhere");
  });
});

describe("on 2026's schedule", () => {
  let all;
  beforeAll(() => {
    replaceSchedule(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2026", "events.v2.json"), "utf8")));
    all = [...byId.values()];
  });
  const count = labels => labels.reduce((by, l) => ({...by, [l]: (by[l] || 0) + 1}), {});

  it("16 events say a part: six Part 1, ten Part 2", () => {
    expect(count(all.flatMap(e => factsOf(e).filter(f => f.key === "part").map(f => f.label)))).toEqual({"Part 1": 6, "Part 2": 10});
  });
  it("868 say a format, and 172 of them beginners welcome - the 305 beginners' games less the 133 that are Learn to play", () => {
    const said = all.flatMap(e => factsOf(e).filter(f => f.key === "play").map(f => f.label));
    expect(count(said.map(l => l.replace(", beginners welcome", "")))).toEqual({"One-shot game": 383, "Organized play": 188,
      "Learn to play": 133, Tournament: 73, Demo: 56, "Open play": 35});
    expect(said.filter(l => l.endsWith(", beginners welcome"))).toHaveLength(172);
    expect(said).not.toContain("Learn to play, beginners welcome");
  });
  /* Counted before the con, when no session has started: a moment later
     than a session leaves it out (#75). */
  it("before the con, 1,173 events have another session, in 347 groups, the largest of 44; 46 groups have more than three others", () => {
    const BEFORE = new Date("2026-09-01T00:00"), groups = new Map();
    let withOthers = 0;
    for (const e of all) {
      const others = sessionsOf(e, BEFORE);
      if (!others.length) continue;
      withOthers++;
      groups.set([e.id, ...ids(others)].sort()[0], others.length + 1);
    }
    const sizes = [...groups.values()];
    expect([withOthers, sizes.length, Math.max(...sizes), sizes.filter(n => n - 1 > 3).length]).toEqual([1173, 347, 44, 46]);
  });
  it("the sheets with an Also runs line, and those of them with more than three: 1,173 and 351 before the con, 987 and 151 at Saturday 1:05 PM, none after it", () => {
    const at = iso => { const lists = all.map(e => sessionsOf(e, new Date(iso)).length); return [lists.filter(n => n).length, lists.filter(n => n > 3).length]; };
    expect(at("2026-09-01T00:00")).toEqual([1173, 351]);
    expect(at("2026-09-05T13:05")).toEqual([987, 151]);
    expect(at("2026-09-08T00:00")).toEqual([0, 0]);
  });
  it("neither of the two cancelled events has another session: no cancelled event's sheet has the line", () => {
    const cancelled = all.filter(e => e.cancelled);
    expect(cancelled).toHaveLength(2);
    for (const e of cancelled) expect(sessionsOf(e, new Date("2026-09-01T00:00"))).toEqual([]);
  });
  it("the eight Author Signings are not each other's sessions", () => {
    const signings = all.filter(e => e.title === "Author Signing");
    expect(signings).toHaveLength(8);
    for (const e of signings) expect(sessionsOf(e, new Date("2026-09-01T00:00"))).toEqual([]);
  });
  it("1,634 sheets say a level, as the rows do, and 565 of them say more than the row's short name", () => {
    const shown = all.filter(e => levelName(e));
    expect(shown).toHaveLength(1634);
    expect(shown.every(e => levelShort(e))).toBe(true);
    expect(all.filter(e => !levelName(e) && levelShort(e))).toEqual([]);
    expect(shown.filter(e => levelName(e) !== levelShort(e))).toHaveLength(565);
  });
});
