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
  it("Mine shows the same notice [741]", () => {
    handle.state.tab = "mine"; handle.render();
    expect(notice("mine")).toMatch(/Hazbin Hotel Cast/);
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
    document.querySelector('#view-mine [data-act="dismiss-news"]').click();
    expect(document.querySelector("#view-mine .pick-news")).toBe(null);
    expect(stored("dc26.pickNews")).toHaveLength(0);
  });
  it("and a second look finds nothing new to report [746]", () => {
    handle.reconcilePicks();
    handle.render();
    expect(document.querySelector("#view-mine .pick-news")).toBe(null);
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
