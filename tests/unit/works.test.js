/* The schedule's works, on inline data: the descendants map the works block
   gives, linksTo by each via, the roll-up count, and a person's display name
   (DECISIONS #39). No page; the block is built by hand, in an order that is
   not its ids' order, because nothing may depend on the block's order. */
import { beforeAll, describe, expect, it } from "vitest";
import { linkedWorks, linksTo, personName, replaceSchedule, topWorks, workCounts } from "../../src/data.js";

const WORKS = [
  { id: "marvel", name: "Marvel", aliases: ["MCU"], terms: [], reviewed: true },
  { id: "avengers-endgame", name: "Avengers: Endgame", aliases: [], terms: [], reviewed: true, parent: "avengers" },
  { id: "avengers", name: "Avengers", aliases: [], terms: [], reviewed: true, parent: "marvel" },
  { id: "avengers-infinity-war", name: "Avengers: Infinity War", aliases: [], terms: [], reviewed: true, parent: "avengers" },
  { id: "loki", name: "Loki", aliases: [], terms: [], reviewed: false, parent: "marvel" },
];
const ev = (id, works = [], people = []) => ({ id, title: id, start: "2026-09-05T10:00", end: "2026-09-05T11:00",
  tracks: [], speakers: [], people, facets: {}, tags: { kind: "panel", works, medium: [], genre: [], craft: [], subject: [], audience: "all" } });
const EVENTS = [
  ev("endgame-q-and-a", [{ id: "avengers-endgame", via: "about" }]),
  ev("endgame-track", [{ id: "avengers-endgame", via: "track" }]),
  ev("infinity-war-cast", [{ id: "avengers-infinity-war", via: "credit:tom-hiddleston" }]),
  ev("marvel-news", [{ id: "marvel", via: "about" }, { id: "loki", via: "about" }]),
  ev("untagged", []),
];

describe("the works block and linksTo", () => {
  beforeAll(() => replaceSchedule({ generated_at: "x", works: WORKS, events: EVENTS }));
  const linked = (work, vias) => EVENTS.filter(e => linksTo(e, work, vias)).map(e => e.id);

  it("an event links the work it names, by about or by track", () => {
    expect(linked("avengers-endgame")).toEqual(["endgame-q-and-a", "endgame-track"]);
  });
  it("and every work above it, two levels up", () => {
    expect(linked("avengers")).toEqual(["endgame-q-and-a", "endgame-track"]);
    expect(linked("marvel")).toEqual(["endgame-q-and-a", "endgame-track", "marvel-news"]);
  });
  it("but never a sibling, nor a work below the one named", () => {
    expect(linked("avengers-infinity-war")).toEqual([]);
    expect(EVENTS.filter(e => linksTo(e, "avengers-endgame")).map(e => e.id)).not.toContain("marvel-news");
  });
  it("a credit reaches a work only when the credit via is asked for", () => {
    expect(linked("avengers-infinity-war", ["credit"])).toEqual(["infinity-war-cast"]);
    expect(linked("marvel", ["credit"])).toEqual(["infinity-war-cast"]);
    expect(linked("marvel", ["about"])).toEqual(["endgame-q-and-a", "marvel-news"]);
    expect(linked("marvel", ["track"])).toEqual(["endgame-track"]);
  });
  it("a work the block does not hold links nothing, and an untagged event links nothing", () => {
    expect(linked("no-such-work")).toEqual([]);
    expect(linksTo({ id: "bare" }, "marvel")).toBe(false);
  });
  it("what an event rolls up to is the works it names and all above them, once", () => {
    expect([...linkedWorks(EVENTS[0])].sort()).toEqual(["avengers", "avengers-endgame", "marvel"]);
    expect([...linkedWorks(EVENTS[3])].sort()).toEqual(["loki", "marvel"]);
  });
  it("the count per work is the events linksTo finds", () => {
    for (const w of WORKS) expect(workCounts.get(w.id) || 0, w.id).toBe(linked(w.id).length);
  });
  it("tiles take reviewed works with 3+ events only", () => {
    expect(topWorks()).toEqual([{ id: "marvel", name: "Marvel", count: 3 }]);
  });
});

describe("a person's display name", () => {
  const p = (id, name) => ({ id, name, role: "Speaker", src: "speakers" });
  beforeAll(() => replaceSchedule({ works: [], events: [
    ev("a", [], [p("calvin-watts", "Calvin Watts III"), p("pat-henry", "Pat Henry - President of Dragon Con"), p("toni", "Toni B")]),
    ev("b", [], [p("calvin-watts", "Calvin Watts III"), p("pat-henry", "Pat Henry"), p("toni", "Toni A")]),
    ev("c", [], [p("calvin-watts", "Calvin Watts")]),
  ] }));

  it("is the spelling used most under the id", () => {
    expect(personName("calvin-watts")).toBe("Calvin Watts III");
  });
  it("ties go to the shortest", () => {
    expect(personName("pat-henry")).toBe("Pat Henry");
  });
  it("and then to the first in code-unit order", () => {
    expect(personName("toni")).toBe("Toni A");
  });
  it("an id nobody carries has no name", () => {
    expect(personName("nobody")).toBe("");
  });
});
