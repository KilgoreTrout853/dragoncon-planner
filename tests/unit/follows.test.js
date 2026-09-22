/* Stored follows and what may be followed (DECISIONS #39). A stored follow is
   kept by its shape as the module is imported, before any schedule: v1's
   follows fall away with no migration, and a follow of something with no
   events stays. What may be followed is asked of the loaded schedule, when
   the reader acts. No page. */
import { beforeAll, describe, expect, it } from "vitest";
import { replaceSchedule } from "../../src/data.js";
import { canFollow, isFollowing, toggleFollow, wellFormedFollow } from "../../src/follows.js";

describe("a stored follow is kept by its shape", () => {
  it.each([
    ["a track, by its name", { kind: "track", key: "Costuming" }],
    ["a work, by its id", { kind: "work", key: "star-trek" }],
    ["a person, by their id", { kind: "person", key: "nathan-fillion" }],
    ["an axis value", { kind: "axis", key: "genre:horror" }],
    ["the kids audience", { kind: "axis", key: "audience:kids" }],
    ["a work with no events anywhere", { kind: "work", key: "no-such-work" }],
  ])("kept: %s", (_, f) => {
    expect(wellFormedFollow(f)).toBe(true);
  });
  it.each([
    ["v1's fandom follow", { kind: "fandom", key: "Star Trek" }],
    ["v1's topic follow", { kind: "topic", key: "Space" }],
    ["v1's person follow, by name", { kind: "person", key: "Nathan Fillion" }],
    ["a work by its name", { kind: "work", key: "Star Trek" }],
    ["an axis value by its label", { kind: "axis", key: "genre:Horror" }],
    ["an axis the client does not follow", { kind: "axis", key: "play:demo" }],
    ["an axis value with no axis", { kind: "axis", key: "horror" }],
    ["a track with no name", { kind: "track", key: "" }],
    ["a follow with no key", { kind: "track" }],
    ["nothing", null],
  ])("dropped: %s", (_, f) => {
    expect(wellFormedFollow(f)).toBe(false);
  });
});

describe("what may be followed is asked of the loaded schedule", () => {
  beforeAll(() => replaceSchedule({ works: [
    { id: "firefly", name: "Firefly", aliases: [], terms: [], reviewed: true },
    { id: "not-yet-looked-at", name: "Not Yet Looked At", aliases: [], terms: [], reviewed: false },
  ], events: [{ id: "e1", title: "Firefly", start: "2026-09-05T10:00", end: "2026-09-05T11:00", tracks: ["Whedon"], speakers: [],
    people: [{ id: "gina-torres", name: "Gina Torres", role: "Speaker", src: "speakers" }], facets: {},
    tags: { kind: "qa", works: [{ id: "firefly", via: "about" }, { id: "not-yet-looked-at", via: "about" }],
      medium: ["tv"], genre: ["sci-fi"], craft: [], subject: [], audience: "kids" } }] }));

  it("a reviewed work, a person, an axis value and the kids audience the schedule carries", () => {
    expect(canFollow("work", "firefly")).toBe(true);
    expect(canFollow("person", "gina-torres")).toBe(true);
    expect(canFollow("axis", "genre:sci-fi")).toBe(true);
    expect(canFollow("axis", "audience:kids")).toBe(true);
    expect(canFollow("track", "Whedon")).toBe(true);
  });
  it("not an unreviewed work, nor an id or a value the schedule does not carry", () => {
    expect(canFollow("work", "not-yet-looked-at")).toBe(false);
    expect(canFollow("work", "no-such-work")).toBe(false);
    expect(canFollow("person", "nathan-fillion")).toBe(false);
    expect(canFollow("axis", "genre:horror")).toBe(false);
    expect(canFollow("axis", "audience:mature")).toBe(false);
    expect(canFollow("fandom", "Firefly")).toBe(false);
  });
  it("toggleFollow refuses an unreviewed work, and adds a reviewed one", () => {
    expect(toggleFollow("work", "not-yet-looked-at")).toBe(false);
    expect(isFollowing("work", "not-yet-looked-at")).toBe(false);
    expect(toggleFollow("work", "firefly")).toBe(true);
    expect(isFollowing("work", "firefly")).toBe(true);
    expect(toggleFollow("work", "firefly")).toBe(false);
    expect(isFollowing("work", "firefly")).toBe(false);
  });
});
