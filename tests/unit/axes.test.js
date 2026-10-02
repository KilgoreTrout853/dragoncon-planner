/* The four topic axes in passesFilters() (W8; DECISIONS #70): the filter
   sheet's Medium, Genre, Craft and Subject, one value each, every one set
   holding, as the other filters do. On a schedule of its own, handed to
   data.js as load() would. New tests, not rows of tests/PORT-LEDGER.md. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { events, replaceSchedule } from "../../src/data.js";
import { state } from "../../src/state.js";
import { passesFilters } from "../../src/search.js";

const ev = (id, tags, over = {}) => ({ id, title: `Event ${id}`, start: "2026-09-05T10:00", end: "2026-09-05T11:00", type: "panel",
  hotel: "Hilton", room: "Galleria 1", location: "Hilton Galleria 1", tracks: [], ...(tags ? { tags } : {}), ...over });
const SCHEDULE = [
  ev("tv-horror", { medium: ["tv"], genre: ["horror"] }),
  ev("film-horror-all", { medium: ["film"], genre: ["horror"], craft: ["writing"], subject: ["space"] }),
  ev("tv-and-film", { medium: ["tv", "film"], craft: ["writing"] }),
  ev("film-at-the-hyatt", { medium: ["film"] }, { hotel: "Hyatt", location: "Hyatt Regency V" }),
  ev("no-axes", { kind: "panel" }),
  ev("untagged", null),
];
const AXES = { medium: "All", genre: "All", craft: "All", subject: "All" };
const passing = () => events.filter(passesFilters).map(e => e.id).sort();
const set = over => Object.assign(state.browse, { q: "", parsed: null, day: "All", hotel: "All", type: "All", track: "All", work: "All", kind: "All",
  hideNoise: false, showHidden: false }, AXES, over);

describe("the four topic axes in passesFilters()", () => {
  beforeAll(() => replaceSchedule({ works: [], events: SCHEDULE }));
  beforeEach(() => set({}));

  it("with every axis at All, every event passes, the untagged among them", () => {
    expect(passing()).toEqual(SCHEDULE.map(e => e.id).sort());
  });
  it("a medium keeps the events that carry it, and only those", () => {
    set({ medium: "tv" });
    expect(passing()).toEqual(["tv-and-film", "tv-horror"]);
  });
  it("an event with two values on one axis passes on either", () => {
    set({ medium: "film" });
    expect(passing()).toEqual(["film-at-the-hyatt", "film-horror-all", "tv-and-film"]);
  });
  it("a genre", () => {
    set({ genre: "horror" });
    expect(passing()).toEqual(["film-horror-all", "tv-horror"]);
  });
  it("a craft", () => {
    set({ craft: "writing" });
    expect(passing()).toEqual(["film-horror-all", "tv-and-film"]);
  });
  it("a subject", () => {
    set({ subject: "space" });
    expect(passing()).toEqual(["film-horror-all"]);
  });
  it("an event with no tags, or none on the axis, passes no axis that is set", () => {
    for (const [axis, value] of [["medium", "tv"], ["genre", "horror"], ["craft", "writing"], ["subject", "space"]]) {
      set({ [axis]: value });
      expect(passing()).not.toContain("untagged");
      expect(passing()).not.toContain("no-axes");
    }
  });
  it("a value no event carries keeps none", () => {
    set({ genre: "romance" });
    expect(passing()).toEqual([]);
  });
  it("two axes set: both must hold", () => {
    set({ medium: "film", genre: "horror" });
    expect(passing()).toEqual(["film-horror-all"]);
    set({ medium: "tv", craft: "writing" });
    expect(passing()).toEqual(["tv-and-film"]);
  });
  it("all four set: all four must hold", () => {
    set({ medium: "film", genre: "horror", craft: "writing", subject: "space" });
    expect(passing()).toEqual(["film-horror-all"]);
    set({ medium: "tv", genre: "horror", craft: "writing", subject: "space" });
    expect(passing()).toEqual([]);
  });
  it("and an axis holds beside the other filters: a hotel and a medium", () => {
    set({ medium: "film", hotel: "Hyatt" });
    expect(passing()).toEqual(["film-at-the-hyatt"]);
  });
});
