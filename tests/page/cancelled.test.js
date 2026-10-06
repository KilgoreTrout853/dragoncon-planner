/* A cancelled pick is not happening (DECISIONS #90): whatever says what is
   next, where to walk, or how many picks are at a place passes over it, as
   it passes over a removed pick - and where the plan is listed it stays,
   marked, and counts as before. The crew's side of the same rule is
   crew-everywhere.test.js's. The situation arrives as it does on a phone:
   the picks and their snapshots are in storage, and the page boots against
   a copy of the sample in which three of the picked events are cancelled,
   their titles as the source writes them. The snapshots say cancelled
   already, so nothing here is news. New tests: no harness line.

   The reader's Saturday, at 1:05 PM, and one pick of Sunday's:
     s0243 Westin 1:00-2:00 PM, on now
     s0321 Courtland Grand 2:30-4:00 PM - cancelled
     s0221 Streaming 2:30-3:30 PM - cancelled
     s0349 Westin 4:00-6:00 PM
     s0439 the Mart's Building 3, Sunday 10:00 AM - cancelled
   Counted, s0321 stands between the two Westin picks with a walk band on
   either side of it; passed over, the two are in one building, two hours
   apart, and nothing is said between them. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { YY } from "../../src/season.js";
import { bootPage } from "../helpers/page.js";

const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const ON = "s0243", OFF = "s0321", STREAM = "s0221", LATER = "s0349", SUNDAY = "s0439";
const CANCELLED = [OFF, STREAM, SUNDAY];
const data = { ...sample, events: sample.events.map(e => (CANCELLED.includes(e.id) ? { ...e, cancelled: true, title: `CANCELLED: ${e.title}` } : e)) };
const of = id => data.events.find(e => e.id === id);
const snapshot = e => ({ title: e.title, start: e.start, location: e.location || "", end: e.end, hotel: e.hotel, ...(e.cancelled ? { cancelled: true } : {}) });
const seed = (key, value) => window.localStorage.setItem(`dc${YY}.${key}`, JSON.stringify(value));
const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : null);
const ALL = [ON, OFF, STREAM, LATER, SUNDAY];
const SATURDAY = "2026-09-05T13:05";

describe("a cancelled pick is passed over by what says what is next, where to walk and how many picks are at a place", () => {
  let page, app, handle, state;
  const view = name => document.getElementById(`view-${name}`);
  const show = (tab, patch = {}) => { state.tab = tab; Object.assign(state, patch); handle.render(); };
  const at = iso => handle.setTimeOverride(iso);
  const hero = () => document.getElementById("nowHero");
  const restRows = () => [...view("now").querySelectorAll('.row[data-list="next"]')].map(r => r.dataset.id);
  const pill = hotel => words(view("map").querySelector(`.map-pill[data-hotel="${hotel}"]`));
  const label = hotel => view("map").querySelector(`.map-hotel[data-hotel="${hotel}"]`).getAttribute("aria-label");

  beforeAll(async () => {
    seed("picks", ALL);
    seed("pickInfo", Object.fromEntries(ALL.map(id => [id, snapshot(of(id))])));
    page = await bootPage({ data, now: SATURDAY });
    ({ app, handle } = page);
    state = handle.state;
  }, 30000);
  afterAll(() => page.cleanup());

  it("the fixture: the cancelled pick has a walk band on either side of it, and a pick saved while already cancelled is no news", () => {
    const [x, c, y] = [ON, OFF, LATER].map(id => app.byId.get(id));
    expect([app.connection(x, c).band, app.connection(c, y).band]).toEqual(["tight", "cant"]);
    expect(app.connection(x, y)).toEqual(expect.objectContaining({ band: null }));
    expect(document.querySelector(".pick-news")).toBe(null);
    expect([...handle.picks.get()].sort()).toEqual([...ALL].sort());
  });

  describe("Now", () => {
    it("the hero's then line names the next pick that is happening, not the cancelled one at 2:30 PM", () => {
      expect(hero().dataset.hero).toBe(ON);
      expect(words(hero().querySelector(".hwhen"))).toBe("ends 2:00 PM · then Westin next");
    });
    it("Rest of your day holds the picks that are happening, and counts them", () => {
      expect(restRows()).toEqual([LATER]);
      expect(words(view("now").querySelector(".section-title .count"))).toBe("2 today");
      expect(view("now").querySelector(".gap")).toBe(null);
    });
    it("a cancelled pick is never the hero: while it would be on, the hero is the next pick that is happening", () => {
      at("2026-09-05T14:40");
      expect(words(hero().querySelector(".hkicker"))).toBe("Your next");
      expect(hero().dataset.hero).toBe(LATER);
      expect(words(hero().querySelector(".hwhen"))).toBe("starts 4:00 PM");
    });
    it("nobody walks from a cancelled pick: the walk estimate is from the pick before that is happening, or there is none", () => {
      expect(hero().querySelector(".hwalk")).toBe(null);            // from the Westin's 1:00 PM pick: one building
      handle.picks.set([OFF, LATER]);
      handle.render();
      expect(hero().dataset.hero).toBe(LATER);
      expect(hero().querySelector(".hwalk")).toBe(null);            // the Courtland Grand's is cancelled: no pick before
      handle.picks.set(ALL);
      handle.render();
    });
    it("nothing left today and only a cancelled pick on a later day: no later pick is named", () => {
      at("2026-09-05T18:30");
      expect(hero()).toBe(null);
      expect(words(view("now").querySelector(".empty"))).toBe("Nothing picked for later today. Star things in Search and they show up here with walk times.");
      expect(view("now").querySelector('.row[data-list="next"]')).toBe(null);
    });
    it("what is on and coming up is the schedule's, not the plan's: its row is there as any cancelled event's, struck, tagged and starred", () => {
      at("2026-09-05T14:00");
      const row = view("now").querySelector(`.row[data-list="around"][data-id="${OFF}"]`);
      expect(row.classList.contains("cancelled")).toBe(true);
      expect(row.querySelector(".cancelled-tag")).not.toBe(null);
      expect(row.querySelector(".star").getAttribute("aria-pressed")).toBe("true");
      at(SATURDAY);
    });
  });

  describe("the mini-bar", () => {
    const bar = () => document.getElementById("minibar");
    it("names the next pick that is happening", () => {
      show("browse");
      expect(bar().hidden).toBe(false);
      expect(words(bar().querySelector(".mb-title"))).toBe(of(LATER).title);
      expect(words(bar().querySelector(".mb-when"))).toBe("in 2 h 55 min");
    });
    it("and is not there with only cancelled picks left today", () => {
      handle.picks.set(CANCELLED);
      handle.render();
      expect(bar().hidden).toBe(true);
      handle.picks.set(ALL);
      handle.render();
    });
  });

  describe("the Map", () => {
    it("the gold pill and a block's label count the picks that are happening", () => {
      show("map");
      expect([pill("Westin"), pill("Courtland Grand")]).toEqual(["2", null]);
      expect(label("Courtland Grand")).toBe("Courtland Grand: no picks on Saturday");
      expect(label("Westin")).toBe("Westin: 2 picks on Saturday");
    });
    it("a cancelled stream is no pick streaming or offsite", () => {
      expect(view("map").querySelector(".map-offmap")).toBe(null);
    });
    it("no ring, no On now line and no card for it while it would be on: the card is the next pick that is happening", () => {
      at("2026-09-05T14:40");
      expect(view("map").querySelector(".map-ring.now")).toBe(null);
      expect(document.getElementById("mapOnNow")).toBe(null);
      expect(view("map").querySelector(".map-ring.next").dataset.hotel).toBe("Westin");
      expect(document.getElementById("mapNext").dataset.hero).toBe(LATER);
      expect(view("map").querySelector(".nc-walk")).toBe(null);
    });
    it("nothing left today and only a cancelled pick on a later day: the card has no later pick", () => {
      at("2026-09-05T18:30");
      expect(document.getElementById("mapNext")).toBe(null);
      expect(words(view("map").querySelector(".next-card"))).toBe("Star things in Search and your next pick shows here.");
      at(SATURDAY);
    });
    it("another day: Sunday's only pick is cancelled, and the Mart has none", () => {
      view("map").querySelector('[data-chip="map-day"][data-value="2026-09-06"]').click();
      expect(pill("AmericasMart Building 3")).toBe(null);
      expect(label("AmericasMart Building 3")).toBe("AmericasMart Building 3: no picks on Sunday");
      view("map").querySelector('[data-chip="map-day"][data-value="2026-09-05"]').click();
    });
    it("the hotel sheet lists and counts the picks that are happening: none at the Courtland Grand, and the search is offered", () => {
      handle.openSheet("hotel", "Courtland Grand");
      const panel = document.getElementById("panel-hotel");
      expect(words(panel.querySelector(".ev-when"))).toBe("Saturday · no picks");
      expect(panel.querySelector(".row")).toBe(null);
      expect(words(panel.querySelector(".ev-body p"))).toBe("No picks here on Saturday.");
      expect(panel.querySelector('[data-act="map-search"]')).not.toBe(null);
      handle.closeSheet();
      handle.openSheet("hotel", "Westin");
      expect(words(panel.querySelector(".ev-when"))).toBe("Saturday · 2 picks");
      expect([...panel.querySelectorAll(".row")].map(r => r.dataset.id)).toEqual([ON, LATER]);
      handle.closeSheet();
    });
  });

  describe("My day", () => {
    const row = id => view("plans").querySelector(`.row[data-list="mine"][data-id="${id}"]`);
    const block = id => view("plans").querySelector(`.tl-block[data-hero="${id}"]`);

    it("the list keeps it, marked and starred, and the day's head counts it", () => {
      show("plans", { mineView: "list" });
      for (const id of CANCELLED) {
        expect(row(id).classList.contains("cancelled"), id).toBe(true);
        expect(row(id).querySelector(".cancelled-tag"), id).not.toBe(null);
        expect(row(id).querySelector(".star").getAttribute("aria-pressed"), id).toBe("true");
      }
      expect([...view("plans").querySelectorAll(".day-head")].map(words)).toEqual(["Saturday 4", "Sunday 1"]);
    });
    it("no gap line on either side of it: the next pick's is measured from the pick before, and those two are two hours apart in one building", () => {
      expect(view("plans").querySelector(".gap")).toBe(null);
      expect(row(OFF).previousElementSibling.matches(".row")).toBe(true);
      expect(row(OFF).nextElementSibling.matches(".row")).toBe(true);
    });
    it("the timeline keeps its block where its time puts it, drawn as a removed block is and saying Cancelled where its room would be", () => {
      show("plans", { mineView: "timeline" });
      for (const id of CANCELLED) {
        expect(block(id).classList.contains("cancelled"), id).toBe(true);
        expect(words(block(id).querySelector(".tb-room")), id).toBe("Cancelled");
      }
      expect(block(ON).classList.contains("cancelled")).toBe(false);
      expect(words(block(ON).querySelector(".tb-room"))).toBe(of(ON).room);
      expect([...view("plans").querySelectorAll(".tl-day .day-head")].map(words)).toEqual(["Saturday 4", "Sunday 1"]);
    });
    it("and no walk runs to it or from it", () => {
      expect(view("plans").querySelector(".tl-link")).toBe(null);
    });
    it("Export to calendar takes the picks that are happening", async () => {
      let exported;
      const had = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: HTMLAnchorElement.prototype.click };
      URL.createObjectURL = blob => { exported = blob.text(); return "blob:x"; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = () => {};
      try { view("plans").querySelector('[data-act="ics"]').click(); } finally { Object.assign(URL, { createObjectURL: had.create, revokeObjectURL: had.revoke }); HTMLAnchorElement.prototype.click = had.click; }
      const ids = [...(await exported).matchAll(/UID:dc\d\d-([^@]+)@/g)].map(m => m[1]);
      expect(ids).toEqual([ON, LATER]);
    });
    it("with only cancelled picks left, Export is off and Remove all is on", () => {
      handle.picks.set(CANCELLED);
      show("plans", { mineView: "list" });
      expect(view("plans").querySelector('[data-act="ics"]').disabled).toBe(true);
      expect(view("plans").querySelector('[data-act="share-day"]').disabled).toBe(true);
      expect(view("plans").querySelector('[data-act="clear"]').disabled).toBe(false);
      handle.picks.set([...CANCELLED, ON]);
      handle.render();
      expect(view("plans").querySelector('[data-act="ics"]').disabled).toBe(false);
    });
  });

  describe("where the plan is counted, it counts as before", () => {
    it("the Plans badge, the install nudge's gate and Because you starred, with one pick and that one cancelled", () => {
      handle.picks.set([OFF]);
      show("now");
      expect(document.getElementById("plansBadge").textContent).toBe("1");
      expect(document.getElementById("nudge")).not.toBe(null);
      show("explore");
      expect(words(document.querySelector("#suggested .count"))).toBe("1 thing");
      handle.picks.set(ALL);
      show("now");
    });
    it("the record after the con lists it, marked, and counts it", () => {
      at("2026-09-08T10:00");
      expect(words(view("now").querySelector(".section-title .count"))).toBe("5");
      const rows = [...view("now").querySelectorAll('.row[data-list="archive"]')];
      expect(rows.map(r => r.dataset.id).sort()).toEqual([...ALL].sort());
      expect(rows.filter(r => r.classList.contains("cancelled")).map(r => r.dataset.id).sort()).toEqual([...CANCELLED].sort());
      at(SATURDAY);
    });
  });
});
