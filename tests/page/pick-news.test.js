/* A pick that vanishes or moves in a refresh is reported, not swallowed. The
   number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md).

   The harness wrote pickInfo by hand and called reconcilePicks(). Here the
   situation arrives the way it does on a phone: the picks and their snapshots
   are already in storage from an earlier visit, and the page boots against a
   schedule that has moved on. load() reconciles by itself. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const upcoming = fixture.events.filter(e => e.start > "2026-09-05T13:05" && e.hotel !== "Streaming")
  .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const snapshot = e => ({ title: e.title, start: e.start, location: e.location || "" });
const seed = (key, value) => window.localStorage.setItem(key, JSON.stringify(value));
const stored = key => JSON.parse(window.localStorage.getItem(key));

describe("a boot after a refresh that removed one pick and moved another", () => {
  const [moved, keep] = upcoming;
  let page, handle;
  const notice = view => ((document.querySelector(`#view-${view} .pick-news`) || {}).textContent || "").replace(/\s+/g, " ");

  beforeAll(async () => {
    seed("dc26.picks", [moved.id, keep.id, "ghost-1"]);
    seed("dc26.pickInfo", {
      "ghost-1": { title: "Hazbin Hotel Cast", start: "2026-09-06T16:00", location: "Hilton Salon" },
      [moved.id]: { title: moved.title, start: "2026-09-05T10:00", location: "Westin Peachtree Ballroom" },
      [keep.id]: snapshot(keep),
    });
    page = await bootPage();
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("a pick whose event is gone leaves the plan [736]", () => {
    expect([...handle.picks.get()].sort()).toEqual([moved.id, keep.id].sort());
  });
  it("and both the vanished and the moved pick make the news [737]", () => {
    expect(document.querySelectorAll("#view-now .pick-news li")).toHaveLength(2);
  });
  it("Now names the vanished event and when it was [738]", () => {
    expect(notice("now")).toMatch(/Hazbin Hotel Cast/);
    expect(notice("now")).toMatch(/removed/);
    expect(notice("now")).toMatch(/Sun 4:00 PM, Hilton Salon/);
  });
  it("and says where the moved one used to be [740]", () => {
    expect(notice("now")).toMatch(/moved to/);
    expect(notice("now")).toMatch(/Westin Peachtree Ballroom/);
  });
  it("Plans shows the same notice [741]", () => {
    handle.state.tab = "plans"; handle.render();
    expect(notice("plans")).toMatch(/Hazbin Hotel Cast/);
  });
  it("the news is stored, so it survives a reload [742]", () => {
    expect(stored("dc26.pickNews")).toHaveLength(2);
  });
  it("the moved pick's snapshot now matches the new time [743]", () => {
    expect(stored("dc26.pickInfo")[moved.id].start).toBe(moved.start);
  });
  it("and the vanished one's snapshot is gone [744]", () => {
    expect(stored("dc26.pickInfo")["ghost-1"]).toBeUndefined();
  });
  it("OK dismisses it for good [745]", () => {
    document.querySelector('#view-plans [data-act="dismiss-news"]').click();
    expect(document.querySelector("#view-plans .pick-news")).toBe(null);
    expect(stored("dc26.pickNews")).toHaveLength(0);
  });
  it("and a second look finds nothing new to report [746]", () => {
    handle.reconcilePicks();
    handle.render();
    expect(document.querySelector("#view-plans .pick-news")).toBe(null);
    expect(stored("dc26.pickNews")).toHaveLength(0);
  });
});

describe("a boot after a refresh that only respelled a room", () => {
  const [ev] = upcoming;
  let page;

  beforeAll(async () => {
    seed("dc26.picks", [ev.id]);
    seed("dc26.pickInfo", { [ev.id]: { ...snapshot(ev), location: ev.location.replace(/ /g, "-").toUpperCase() } });
    page = await bootPage();
  }, 30000);
  afterAll(() => page.cleanup());

  it("a refresh that only respells the room makes no news [871]", () => {
    expect(ev.location).toMatch(/ /);                                // the respelling is a real difference in the text
    expect(document.querySelector("#view-now .pick-news")).toBe(null);
    expect(stored("dc26.pickNews") || []).toHaveLength(0);
    expect([...page.handle.picks.get()]).toEqual([ev.id]);
  });
});

/* New tests from here on (DECISIONS #90), so their titles carry no harness
   line: a cancellation and a return are news, one line an event a refresh,
   and an entry records the time its change vacated. The sample's Saturday
   at 4:00 PM, all an hour long but the last, which runs to 5:30 PM:
     s0254 Hilton, Q&A: Sandman Panel;  s0263 Hyatt, Deep Dive: Dune Roundtable;
     s0253 Marriott, Fan Panel: Discworld;  s0347 Hyatt, Q&A: Pathfinder Roundtable;
     s0320 Marriott, The Boroughs: Heroes Have No Age;  s0241 Westin, Fan Panel: Foundation Uncut */
const byIdIn = (data, id) => data.events.find(e => e.id === id);
const full = e => ({ ...snapshot(e), end: e.end, hotel: e.hotel });
const changed = edits => ({ ...fixture, events: fixture.events.map(e => (edits[e.id] ? { ...e, ...edits[e.id](e) } : e)) });
const cancel = e => ({ cancelled: true, title: `CANCELLED: ${e.title}` });
const lines = view => [...document.querySelectorAll(`#view-${view} .pick-news li`)].map(li => li.textContent.replace(/\s+/g, " ").trim());

describe("a boot after a refresh that cancelled picks and brought others back", () => {
  /* s0320 is cancelled and removed at once: a removed listing keeps its fields as they last stood. */
  const data = changed({ s0254: cancel, s0347: cancel, s0320: e => ({ ...cancel(e), removed: true }), s0241: cancel });
  const was = id => byIdIn(fixture, id);
  let page, handle;

  beforeAll(async () => {
    seed("dc26.picks", ["s0254", "s0263", "s0253", "s0347", "s0320", "s0241"]);
    seed("dc26.pickInfo", {
      s0254: full(was("s0254")),                                                                   // cancelled by this refresh
      s0263: { ...full(was("s0263")), title: "CANCELLED: Deep Dive: Dune Roundtable", cancelled: true },   // was cancelled, and is back
      s0253: { ...full(was("s0253")), start: "2026-09-05T10:00", end: "2026-09-05T11:00", removed: true }, // was removed, and is back at another time
      s0347: { ...full(was("s0347")), title: "CANCELLED: Q&A: Pathfinder Roundtable", start: "2026-09-05T19:00", end: "2026-09-05T20:00", cancelled: true },   // still cancelled, and moved
      s0320: { ...full(was("s0320")), title: "CANCELLED: The Boroughs: Heroes Have No Age", cancelled: true },   // was cancelled, now removed
      s0241: { ...full(was("s0241")), start: "2026-09-05T19:00", end: "2026-09-05T20:30" },        // cancelled and moved at once
    });
    page = await bootPage({ data });
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("a cancellation is news, under the title the pick had before the refresh - the source's says CANCELLED", () => {
    expect(byIdIn(data, "s0254").title).toBe("CANCELLED: Q&A: Sandman Panel");
    expect(lines("now")[0]).toBe("Q&A: Sandman Panel was cancelled. It was Sat 4:00 PM, Hilton 313-314. It stays in Plans, marked.");
  });
  it("a pick that is back is news, a cancelled one and a removed one alike, with the time and the place it has now", () => {
    expect(lines("now")[1]).toBe("Deep Dive: Dune Roundtable is back on the schedule: Sat 4:00 PM, Hyatt Grand Hall C.");
    expect(lines("now")[2]).toBe("Fan Panel: Discworld is back on the schedule: Sat 4:00 PM, Marriott A601-A602.");
  });
  it("one line an event a refresh, the first of removed, cancelled, back and moved - and none for a pick still cancelled whose time changed", () => {
    expect(lines("now").slice(3)).toEqual([
      "CANCELLED: The Boroughs: Heroes Have No Age was removed from the schedule. It was Sat 4:00 PM, Marriott M301. It stays in Plans, marked.",
      "Fan Panel: Foundation Uncut was cancelled. It was Sat 7:00 PM, Westin Chastain F. It stays in Plans, marked.",
    ]);
    expect(lines("now")).toHaveLength(5);
    expect(lines("now").join(" ")).not.toMatch(/Pathfinder/);
  });
  it("every one of them stays a pick, and each snapshot remembers what the news said", () => {
    expect([...handle.picks.get()].sort()).toEqual(["s0241", "s0253", "s0254", "s0263", "s0320", "s0347"]);
    const info = stored("dc26.pickInfo");
    expect([info.s0254.cancelled, info.s0254.title]).toEqual([true, "CANCELLED: Q&A: Sandman Panel"]);
    expect([info.s0263.cancelled, info.s0263.title, info.s0253.removed, info.s0253.start]).toEqual([undefined, "Deep Dive: Dune Roundtable", undefined, "2026-09-05T16:00"]);
    expect([info.s0320.removed, info.s0241.cancelled, info.s0241.start]).toEqual([true, true, "2026-09-05T16:00"]);
  });
  it("said once: a second look finds nothing new", () => {
    handle.reconcilePicks();
    handle.render();
    expect(lines("now")).toHaveLength(5);
    expect(stored("dc26.pickNews")).toHaveLength(5);
  });
  it("the entry of a pick that was happening records the time it vacated - its old start, end and building - and one that was not, none", () => {
    const news = stored("dc26.pickNews");
    expect(news.map(n => n.kind)).toEqual(["cancelled", "back", "back", "removed", "cancelled"]);
    expect(news[0].vacated).toEqual({ start: "2026-09-05T16:00", end: "2026-09-05T17:00", hotel: "Hilton" });
    expect(news[4].vacated).toEqual({ start: "2026-09-05T19:00", end: "2026-09-05T20:30", hotel: "Westin" });
    expect([news[1], news[2], news[3]].map(n => "vacated" in n)).toEqual([false, false, false]);     // back twice; removed while already cancelled
  });
});

describe("the time a change vacated, and what a snapshot from before this reads as", () => {
  const data = changed({ s0254: e => ({ ...cancel(e) }), s0263: () => ({ removed: true }), s0241: cancel });
  const was = id => byIdIn(fixture, id);
  let page;
  const entry = title => stored("dc26.pickNews").find(n => n.title === title);

  beforeAll(async () => {
    seed("dc26.picks", ["s0254", "s0263", "s0253", "s0347", "s0320", "s0241", "ghost-1", "ghost-2"]);
    seed("dc26.pickInfo", {
      s0254: snapshot(was("s0254")),                                                    // an old snapshot: no end, no building
      s0263: { ...snapshot(was("s0263")), start: "2026-09-05T10:00" },                  // an old one, removed
      s0253: { ...full(was("s0253")), start: "2026-09-06T13:00", end: "2026-09-06T14:30", hotel: "Hilton" },   // moved to a new start, and building
      s0347: { ...full(was("s0347")), location: "Hyatt Somewhere Else" },               // a room alone
      s0320: { ...snapshot(was("s0320")), start: "2026-09-06T09:00" },                  // an old one, moved to a new start
      "ghost-1": { title: "Hazbin Hotel Cast", start: "2026-09-06T16:00", location: "Hilton Salon", end: "2026-09-06T17:15", hotel: "Hilton" },
      "ghost-2": { title: "An old ghost", start: "2026-09-06T16:00", location: "Hilton Salon" },
      /* s0241 has no snapshot at all: a pick from before there were any */
    });
    page = await bootPage({ data });
  }, 30000);
  afterAll(() => page.cleanup());

  it("a move to a new start vacates the old time, in the old building; a room alone vacates none", () => {
    expect(entry("Fan Panel: Discworld")).toEqual({ kind: "moved", title: "Fan Panel: Discworld", was: "Sun 1:00 PM, Marriott A601-A602", now: "Sat 4:00 PM, Marriott A601-A602",
      vacated: { start: "2026-09-06T13:00", end: "2026-09-06T14:30", hotel: "Hilton" } });
    expect(entry("Q&A: Pathfinder Roundtable")).toEqual({ kind: "moved", title: "Q&A: Pathfinder Roundtable", was: "Sat 4:00 PM, Hyatt Somewhere Else", now: "Sat 4:00 PM, Hyatt Centennial I" });
  });
  it("a pick that is gone vacates what its snapshot says", () => {
    expect(entry("Hazbin Hotel Cast")).toEqual({ kind: "gone", title: "Hazbin Hotel Cast", was: "Sun 4:00 PM, Hilton Salon", vacated: { start: "2026-09-06T16:00", end: "2026-09-06T17:15", hotel: "Hilton" } });
  });
  it("a snapshot with no end takes the event's own length, and with no building the event's - cancelled, removed and moved alike", () => {
    expect(entry("Q&A: Sandman Panel").vacated).toEqual({ start: "2026-09-05T16:00", end: "2026-09-05T17:00", hotel: "Hilton" });
    expect(entry("Deep Dive: Dune Roundtable").vacated).toEqual({ start: "2026-09-05T10:00", end: "2026-09-05T11:00", hotel: "Hyatt" });
    expect(entry("The Boroughs: Heroes Have No Age").vacated).toEqual({ start: "2026-09-06T09:00", end: "2026-09-06T10:00", hotel: "Marriott" });
  });
  it("and where the event is gone too, its start's minute alone, and no building", () => {
    expect(entry("An old ghost").vacated).toEqual({ start: "2026-09-06T16:00", end: "2026-09-06T16:01", hotel: "" });
  });
  it("a pick with no snapshot is read as its event stands: a cancelled one is news by the title it has, and vacates the event's own time", () => {
    expect(entry("CANCELLED: Fan Panel: Foundation Uncut")).toEqual({ kind: "cancelled", title: "CANCELLED: Fan Panel: Foundation Uncut", was: "Sat 4:00 PM, Westin Chastain F",
      vacated: { start: "2026-09-05T16:00", end: "2026-09-05T17:30", hotel: "Westin" } });
  });
  it("a snapshot as it is saved now: the event's title, start, place, end and building", () => {
    expect(stored("dc26.pickInfo").s0253).toEqual(full(was("s0253")));
  });
});
