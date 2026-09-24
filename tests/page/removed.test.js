/* A pick on an event the source dropped, and two picks on ids merged into
   one event (DECISIONS #42, #43, #49). The situation arrives the way it does
   on a phone: the picks and their snapshots are in storage from an earlier
   visit, and the page boots against a schedule that has moved on - a copy of
   the sample in which one picked event carries removed: true and a Sunday
   event's was names two ids the reader had picked. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { YY } from "../../src/season.js";
import { bootPage } from "../helpers/page.js";

const sample = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const NOW = "2026-09-05T13:05";                                   // the helper's Saturday afternoon
const placed = e => !["Streaming", "Other", "Unknown"].includes(e.hotel);
const minutes = (iso, m) => new Date(new Date(iso).getTime() + m * 60000);

/* Three Saturday picks still to come: first; then the removed one, in
   another hotel and overlapping first; then last, in first's hotel and an
   hour after both. Counted, the removed pick would make an overlap line and
   two walk links; without it there is neither. The survivor of the merge is
   on Sunday, out of the way. */
const saturday = sample.events.filter(e => e.start > NOW && e.day === "2026-09-05" && e.end.startsWith("2026-09-05") && placed(e))
  .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const { first, removed, last } = (() => {
  for (const first of saturday) {
    const removed = saturday.find(e => e.hotel !== first.hotel && e.start > first.start && e.start < first.end && (e.tracks || []).length);
    const last = removed && saturday.find(e => e.hotel === first.hotel && new Date(e.start) >= minutes(removed.end > first.end ? removed.end : first.end, 60));
    if (last) return { first, removed, last };
  }
  return {};
})();
const survivor = sample.events.find(e => e.start >= "2026-09-06T09:00" && e.end.startsWith("2026-09-06") && placed(e));   // Sunday's con day, not Saturday night's
const data = { ...sample, events: sample.events.map(e => e.id === removed.id ? { ...e, removed: true }
  : e.id === survivor.id ? { ...e, was: ["old-a", "old-b"] } : e) };

const seed = (key, value) => window.localStorage.setItem(key, JSON.stringify(value));
const stored = key => JSON.parse(window.localStorage.getItem(key));
const snapshot = e => ({ title: e.title, start: e.start, location: e.location || "" });

describe("a schedule that dropped one pick and merged two", () => {
  let page, app, handle, state, exported;
  const news = () => [...document.querySelectorAll("#view-mine .pick-news li")].map(li => li.textContent.replace(/\s+/g, " ").trim());
  const show = (tab, patch = {}) => { state.tab = tab; Object.assign(state, patch); handle.render(); };

  beforeAll(async () => {
    seed(`dc${YY}.picks`, [first.id, removed.id, last.id, "old-a", "old-b"]);
    seed(`dc${YY}.pickInfo`, {
      [first.id]: snapshot(first), [removed.id]: snapshot(removed), [last.id]: snapshot(last),
      "old-a": { title: "Old title A", start: survivor.start, location: survivor.location },
      "old-b": { title: "Old title B", start: survivor.start, location: survivor.location },
    });
    page = await bootPage({ data });
    ({ app, handle } = page);
    state = handle.state;
    await page.until(() => app.BOOT.indexed > 0, 20000, "the index");
  }, 30000);
  afterAll(() => page.cleanup());

  it("the fixture holds what the tests need", () => {
    expect([first, removed, last, survivor].every(Boolean)).toBe(true);
    expect(new Set([first.id, removed.id, last.id, survivor.id]).size).toBe(4);
  });

  describe("the removed pick", () => {
    it("stays a pick", () => {
      expect(handle.picks.get().has(removed.id)).toBe(true);
      expect(document.getElementById("mineBadge").textContent).toBe("4");
    });
    it("is in byId, and not in the events every list is drawn from", () => {
      expect(app.byId.get(removed.id).removed).toBe(true);
      expect(handle.events.some(e => e.id === removed.id)).toBe(false);
    });
    it("is not in Browse, on its day, at its hotel", () => {
      Object.assign(state.browse, { q: "", day: removed.day, hotel: removed.hotel, showPast: true, hideNoise: false, page: 1 });
      show("browse");
      expect(document.querySelectorAll("#view-browse .row").length).toBeGreaterThan(0);
      expect(document.querySelector(`#view-browse .row[data-id="${removed.id}"]`)).toBe(null);
    });
    it("is not found by its own title", () => {
      Object.assign(state.browse, { q: removed.title, day: "All", hotel: "All" });
      expect(app.browseResults().some(e => e.id === removed.id)).toBe(false);
      Object.assign(state.browse, { q: "", showPast: false, hideNoise: true });
    });
    it("is not on Now, even while it would be on", () => {
      handle.setTimeOverride(minutes(removed.start, 1).toISOString());
      show("now");
      expect(document.querySelector(`#view-now [data-id="${removed.id}"], #view-now [data-hero="${removed.id}"]`)).toBe(null);
      expect(document.querySelector(`#view-now [data-hero="${first.id}"]`)).not.toBe(null);
      handle.setTimeOverride(NOW);
    });
    it("is in no feed: its track's events leave it out", () => {
      expect(app.eventsFor({ kind: "track", key: removed.tracks[0] }).some(e => e.id === removed.id)).toBe(false);
    });

    describe("in Mine's list", () => {
      let rows;
      beforeAll(() => {
        show("mine", { mineView: "list" });
        rows = [...document.querySelectorAll("#view-mine .list > *")].filter(el => el.matches(".row, .gap, .day-head"));
      });

      it("where its time puts it, between the other two", () => {
        const ids = rows.filter(el => el.matches(".row")).map(el => el.dataset.id);
        expect(ids.slice(0, 3)).toEqual([first.id, removed.id, last.id]);
      });
      it("struck through and saying why", () => {
        const row = document.querySelector(`#view-mine .row[data-id="${removed.id}"]`);
        expect(row.classList.contains("removed")).toBe(true);
        expect(row.querySelector(".removed-tag").textContent).toBe("Removed from the schedule");
      });
      it("with no gap line on either side: first to last is an hour in one building, which needs none", () => {
        expect(document.querySelectorAll("#view-mine .gap")).toHaveLength(0);
      });
      it("Export to calendar takes the picks still on the schedule", async () => {
        const had = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: HTMLAnchorElement.prototype.click };
        URL.createObjectURL = blob => { exported = blob.text(); return "blob:x"; };
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = function () {};
        try { document.querySelector('#view-mine [data-act="ics"]').click(); } finally { Object.assign(URL, { createObjectURL: had.create, revokeObjectURL: had.revoke }); HTMLAnchorElement.prototype.click = had.click; }
        const text = await exported;
        for (const e of [first, last, survivor]) expect(text).toContain(`UID:dc${YY}-${e.id}@dragoncon-planner`);
        expect(text).not.toContain(`UID:dc${YY}-${removed.id}@`);
      });
      it("its sheet is marked as a cancelled event's is", () => {
        document.querySelector(`#view-mine .row[data-id="${removed.id}"] .row-main`).click();
        expect(document.querySelector("#panel-event .ev-head .removed-tag").textContent).toBe("Removed from the schedule");
        handle.closeSheet();
      });
    });

    describe("in Mine's timeline", () => {
      let block;
      beforeAll(() => {
        show("mine", { mineView: "timeline" });
        block = document.querySelector(`#view-mine .tl-block[data-hero="${removed.id}"]`);
      });

      it("faded, and saying why where its room would be", () => {
        expect(block.classList.contains("removed")).toBe(true);
        expect(block.querySelector(".tb-room").textContent).toBe("Removed from the schedule");
      });
      it("with no walk link to or from it", () => {
        expect(block.closest(".tl-day").querySelectorAll(".tl-link")).toHaveLength(0);
      });
    });

    describe("the news", () => {
      it("says it was removed, and when and where it was, once", () => {
        const lines = news().filter(line => line.startsWith(removed.title));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/was removed from the schedule\. It was Sat \d{1,2}:\d\d [AP]M, .+\. It stays in Mine, marked\./);
        expect(lines[0]).toContain(removed.location);
        expect(stored(`dc${YY}.pickInfo`)[removed.id].removed).toBe(true);
      });
      it("beside a line for each merged pick, and nothing else: none is gone, none moved", () => {
        expect(news()).toContain(`Old title A is now listed as ${survivor.title}.`);
        expect(news()).toContain(`Old title B is now listed as ${survivor.title}.`);
        expect(news()).toHaveLength(3);
        expect(stored(`dc${YY}.pickNews`).map(n => n.kind).sort()).toEqual(["merged", "merged", "removed"]);
      });
      it("and a second look, or one after the news is dismissed, says nothing more", () => {
        const before = stored(`dc${YY}.pickNews`).length;
        handle.reconcilePicks();
        expect(stored(`dc${YY}.pickNews`)).toHaveLength(before);
        document.querySelector('#view-mine [data-act="dismiss-news"]').click();
        handle.reconcilePicks();
        handle.render();
        expect(document.querySelector("#view-mine .pick-news")).toBe(null);
        expect(stored(`dc${YY}.pickNews`)).toHaveLength(0);
      });
    });
  });

  describe("two picks on ids merged into one event", () => {
    it("move to the survivor, one pick for the two", () => {
      const picks = handle.picks.get();
      expect(picks.has(survivor.id)).toBe(true);
      expect(picks.has("old-a") || picks.has("old-b")).toBe(false);
      expect([...picks].sort()).toEqual([first.id, removed.id, last.id, survivor.id].sort());
    });
    it("the survivor snapshotted in their place", () => {
      const info = stored(`dc${YY}.pickInfo`);
      expect(info[survivor.id]).toEqual(snapshot(survivor));
      expect(info["old-a"]).toBeUndefined();
      expect(info["old-b"]).toBeUndefined();
    });
  });

  describe("with only the removed pick left", () => {
    it("Export to calendar is off, and Remove all is on", () => {
      handle.picks.set([removed.id]);
      show("mine", { mineView: "list" });
      expect(document.querySelector('#view-mine [data-act="ics"]').disabled).toBe(true);
      expect(document.querySelector('#view-mine [data-act="clear"]').disabled).toBe(false);
    });
  });
});

/* A merge's survivor that the source has since dropped: the picks move to
   it, and it is reported removed once, however many picks came to it. */
describe("two picks merged into an event the source has since dropped", () => {
  let page;
  beforeAll(async () => {
    seed(`dc${YY}.picks`, ["old-a", "old-b"]);
    seed(`dc${YY}.pickInfo`, {
      "old-a": { title: "Old title A", start: survivor.start, location: survivor.location },
      "old-b": { title: "Old title B", start: survivor.start, location: survivor.location },
    });
    page = await bootPage({ data: { ...data, events: data.events.map(e => e.id === survivor.id ? { ...e, removed: true } : e) } });
  }, 30000);
  afterAll(() => page.cleanup());

  it("says each moved, and that the event was removed, once", () => {
    expect(JSON.parse(window.localStorage.getItem(`dc${YY}.pickNews`)).map(n => n.kind)).toEqual(["merged", "removed", "merged"]);
    expect(JSON.parse(window.localStorage.getItem(`dc${YY}.pickInfo`))[survivor.id].removed).toBe(true);
    expect([...page.handle.picks.get()]).toEqual([survivor.id]);
  });
});

/* The merge's news, read before anything is dismissed. */
describe("the news of a merge", () => {
  let page;
  beforeAll(async () => {
    seed(`dc${YY}.picks`, ["old-a", "old-b"]);
    seed(`dc${YY}.pickInfo`, {
      "old-a": { title: "Old title A", start: survivor.start, location: survivor.location },
      "old-b": { title: "Old title B", start: survivor.start, location: survivor.location },
    });
    page = await bootPage({ data });
  }, 30000);
  afterAll(() => page.cleanup());

  it("says each merged pick is now listed under the survivor's title, and nothing else", () => {
    const lines = [...document.querySelectorAll("#view-now .pick-news li")].map(li => li.textContent.replace(/\s+/g, " ").trim());
    expect(lines).toEqual([`Old title A is now listed as ${survivor.title}.`, `Old title B is now listed as ${survivor.title}.`]);
    expect(JSON.parse(window.localStorage.getItem(`dc${YY}.pickNews`)).map(n => n.kind)).toEqual(["merged", "merged"]);
    expect([...page.handle.picks.get()]).toEqual([survivor.id]);
  });
});
