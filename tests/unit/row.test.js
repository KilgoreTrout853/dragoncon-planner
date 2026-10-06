/* The row's four helpers (DECISIONS #73), with no page: the time as a range
   (util.js fmtRange()), the level a row says (venues.js levelShort(), against
   the year's venues file, 2026's), an event's flags (data.js flagsOf()) and
   every pick a pick overlaps (walk.js overlapsOf(), on a made plan); and the
   2026 counts the design was settled on, from the committed schedule. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { fmtRange } from "../../src/util.js";
import { levelShort } from "../../src/venues.js";
import { byId, flagsOf, replaceSchedule } from "../../src/data.js";
import { replacePicks } from "../../src/picks.js";
import { overlapsOf } from "../../src/walk.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const at = hhmm => new Date(`2026-09-05T${hhmm}`);

describe("the time as a range", () => {
  it("names the meridiem once where both ends share it", () => {
    expect(fmtRange(at("14:30"), at("15:30"))).toBe("2:30–3:30 PM");
    expect(fmtRange(at("09:00"), at("10:30"))).toBe("9:00–10:30 AM");
    expect(fmtRange(at("12:00"), at("13:00"))).toBe("12:00–1:00 PM");
  });
  it("and at each end where they differ, across noon and across midnight", () => {
    expect(fmtRange(at("11:30"), at("12:30"))).toBe("11:30 AM–12:30 PM");
    expect(fmtRange(at("23:00"), new Date("2026-09-06T01:00"))).toBe("11:00 PM–1:00 AM");
  });
  it("with an en dash between the two, and no other dash", () => {
    expect(fmtRange(at("14:30"), at("15:30"))).toMatch(/^[^-–]+–[^-–]+$/);
  });
});

describe("the level a row says", () => {
  const level = (hotel, lv, room) => levelShort({hotel, level: lv, room});
  it("is the level's short name, where the room does not say it", () => {
    expect(level("Marriott", "marquis", "Imperial Ballroom")).toBe("Marquis Level");
    expect(level("Hilton", "l2", "204-207")).toBe("2nd Floor");
    expect(level("Marriott", "atrium", "A706")).toBe("Atrium Level");
    expect(level("Hyatt", "tower-ll1", "International North")).toBe("Intl Tower LL1");
    expect(level("AmericasMart Building 2", "f3", "Mart2 203E BERNINA - booth 3300")).toBe("Floor 3");
    expect(level("AmericasMart Building 2", "f4", "Mart2 204J")).toBe("Floor 4");
  });
  it("is left off where the room, case-folded, holds it less a trailing Level or Floor", () => {
    expect(level("Marriott", "atrium", "Atrium Ballroom")).toBe("");
    expect(level("Marriott", "atrium", "ATRIUM BALLROOM")).toBe("");
    expect(level("Hilton", "galleria", "Galleria 5")).toBe("");
    expect(level("Hyatt", "acc", "Atlanta Conference Center Inman")).toBe("");    // a short name with no Level to drop
    expect(level("Westin", "f14", "14th Floor")).toBe("");
    expect(level("Westin", "f14", "14th Fl. Ansley 1")).toBe("");               // the short name less its Floor
    expect(level("AmericasMart Building 3", "f1", "Mart Building 3, Floor 1")).toBe("");
    expect(level("AmericasMart Building 2", "f2", "Mart2 Vendor Hall Floor 2 Scorched Design - booth 2105")).toBe("");
  });
  it("is nothing where the event has no level, or one the file does not hold", () => {
    expect(level("Hilton", null, "Steps B")).toBe("");
    expect(level("Hilton", "l9", "901")).toBe("");
    expect(level("Streaming", null, "")).toBe("");
    expect(level("Nowhere", "l1", "1")).toBe("");
  });
});

describe("an event's flags", () => {
  const flags = (facets, audience) => flagsOf({facets, ...(audience ? {tags: {audience}} : {})}).map(f => f.label);
  it("are said in one order: Sold out, Extra fee, Sign-up, an age, Kids", () => {
    expect(flags({sold_out: true, cost: "extra", signup: true, min_age: 13}, "kids"))
      .toEqual(["Sold out", "Extra fee", "Sign-up", "13+", "Kids"]);
  });
  it("say the age the listing states, else 18+ for a mature audience, and never both", () => {
    expect(flags({min_age: 21, mature: true}, "mature")).toEqual(["21+"]);
    expect(flags({}, "mature")).toEqual(["18+"]);
    expect(flags({min_age: 17}, "all")).toEqual(["17+"]);
  });
  it("are none for an event the facets and the audience say nothing of, untagged among them", () => {
    expect(flags({}, "all")).toEqual([]);
    expect(flags({repeat_key: "x", part: 2})).toEqual([]);
    expect(flagsOf({})).toEqual([]);
  });
  it("carry a key each, for the row and the event's sheet to read", () => {
    expect(flagsOf({facets: {sold_out: true, cost: "extra", signup: true}, tags: {audience: "mature"}}).map(f => f.key))
      .toEqual(["sold_out", "cost", "signup", "age"]);
    expect(flagsOf({tags: {audience: "kids"}}).map(f => f.key)).toEqual(["kids"]);
  });
});

/* A made Saturday: a four-hour pick with three short ones inside it, a pair
   that only touch, a stream, a cancelled pick and a removed one. */
const ev = (id, start, end, more = {}) => ({id, title: id, type: "panel", day: "2026-09-05", start: `2026-09-05T${start}`,
  end: `2026-09-05T${end}`, hotel: "Hilton", room: "201", tracks: [], speakers: [], people: [], facets: {}, ...more});
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
];
const ids = list => list.map(e => e.id);

describe("every pick a pick overlaps", () => {
  beforeAll(() => {
    replaceSchedule({generated_at: "x", works: [], events: PLAN});
    replacePicks(["long", "in-a", "in-b", "in-c", "touch-a", "touch-b", "stream", "cancelled", "removed", "elsewhere"]);
  });
  const of = id => ids(overlapsOf(byId.get(id)));

  it("is every other pick, not only the one before: a long pick overlaps all three inside it, and each says so", () => {
    expect(of("long")).toEqual(["in-a", "in-b", "in-c"]);
    expect([of("in-a"), of("in-b"), of("in-c")]).toEqual([["long"], ["long"], ["long"]]);
  });
  it("starting together, either way round", () => {
    expect(of("in-a")).toContain("long");
    expect(of("long")).toContain("in-a");
  });
  it("is nothing for two picks that only touch", () => {
    expect(of("touch-a")).toEqual([]);
  });
  it("takes a stream as any pick: an overlap is time, not walking", () => {
    expect(of("touch-b")).toEqual(["stream"]);
    expect(of("stream")).toEqual(["touch-b"]);
  });
  it("leaves a cancelled or a removed pick out, both ways: it is not happening", () => {
    expect(of("cancelled")).toEqual([]);
    expect(of("removed")).toEqual([]);
    expect(of("touch-a")).not.toContain("cancelled");
    expect(of("touch-a")).not.toContain("removed");
  });
  it("is nothing for an event that is not a pick, and skips a pick the schedule does not hold", () => {
    expect(of("unpicked")).toEqual([]);
    expect(of("long")).not.toContain("elsewhere");
  });
});

describe("on 2026's schedule", () => {
  let all;
  beforeAll(() => {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2026", "events.v2.json"), "utf8"));
    replaceSchedule(doc);
    all = [...byId.values()];
  });
  it("1,634 rows show a level, 1,542 leave theirs off, and 283 have none", () => {
    const n = {shown: 0, off: 0, none: 0};
    for (const e of all) n[!e.level ? "none" : levelShort(e) ? "shown" : "off"]++;
    expect(n).toEqual({shown: 1634, off: 1542, none: 283});
  });
  it("460 events carry a flag: 387 one, 66 two, 7 three, none more", () => {
    const by = {};
    for (const e of all) { const k = flagsOf(e).length; if (k) by[k] = (by[k] || 0) + 1; }
    expect(by).toEqual({1: 387, 2: 66, 3: 7});
  });
});
