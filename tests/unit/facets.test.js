/* Getting in (W7; DECISIONS #77): cost, sign-up, audience and sold out in
   passesFilters(), each All or one value; the one rule for 18+, isAdult();
   what a filter does with an event that says nothing; and the words in the
   box that hold the audience. On a schedule of its own, handed to data.js as
   load() would. New tests, not rows of tests/PORT-LEDGER.md. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { events, flagsOf, isAdult, replaceSchedule } from "../../src/data.js";
import { state } from "../../src/state.js";
import { activeFilters, GETTING_IN, parseQuery, passesFilters, passesGettingIn } from "../../src/search.js";

const ev = (id, facets, tags, over = {}) => ({ id, title: `Event ${id}`, start: "2026-09-05T10:00", end: "2026-09-05T11:00", type: "panel",
  hotel: "Hilton", room: "Galleria 1", location: "Hilton Galleria 1", tracks: [], ...(facets ? { facets } : {}), ...(tags ? { tags } : {}), ...over });
const SCHEDULE = [
  ev("plain", {}, { audience: "all" }),
  ev("fee", { cost: "extra" }, { audience: "all" }),
  ev("signup", { signup: true }, { audience: "all" }),
  ev("fee-and-signup", { cost: "extra", signup: true }, { audience: "all" }),
  ev("sold-out-fee", { cost: "extra", sold_out: true }, { audience: "all" }),
  ev("kids", {}, { audience: "kids" }),
  ev("kids-13", { min_age: 13 }, { audience: "kids" }, { tracks: ["Kids Track"], track: "Kids Track" }),
  ev("all-16", { min_age: 16 }, { audience: "all" }),
  ev("mature", {}, { audience: "mature" }),
  ev("mature-16", { min_age: 16 }, { audience: "mature" }),
  ev("stated-17", { min_age: 17 }, { audience: "all" }),
  ev("kids-track-18", { min_age: 18, mature: true }, { audience: "mature" }, { tracks: ["Kids Track"], track: "Kids Track" }),
  ev("untagged-stated-18", { min_age: 18 }, null),
  ev("untagged-marked", { mature: true }, null),
  ev("untagged", {}, null),
  ev("nothing", null, null),
];
const ids = SCHEDULE.map(e => e.id).sort();
const less = (...out) => ids.filter(id => !out.includes(id));
const ALL = { cost: "All", signup: "All", audience: "All", soldOut: "All" };
const set = over => Object.assign(state.browse, { q: "", parsed: null, day: "All", hotel: "All", type: "All", track: "All", work: "All", kind: "All",
  medium: "All", genre: "All", craft: "All", subject: "All", hideNoise: false, showHidden: false }, ALL, over);
const typed = (q, over = {}) => { set({ q, ...over }); state.browse.parsed = parseQuery(q); };
const passing = () => events.filter(passesFilters).map(e => e.id).sort();
const ADULT = ["kids-track-18", "mature", "mature-16", "stated-17", "untagged-marked", "untagged-stated-18"];

beforeAll(() => replaceSchedule({ works: [], events: SCHEDULE }));

describe("Getting in's four in state.browse", () => {
  it("each starts at All, as every other filter does", () => {
    expect(GETTING_IN.map(d => [d, state.browse[d]])).toEqual([["cost", "All"], ["signup", "All"], ["audience", "All"], ["soldOut", "All"]]);
  });
});

describe("18+ is one thing: isAdult()", () => {
  const adult = (facets, audience) => isAdult({ ...(facets ? { facets } : {}), ...(audience ? { tags: { audience } } : {}) });

  it("a mature audience", () => {
    expect(adult({}, "mature")).toBe(true);
    expect(adult(null, "mature")).toBe(true);
  });
  it("or a stated minimum age of 17 or more, whatever the audience", () => {
    expect([17, 18, 21].map(n => adult({ min_age: n }, "all"))).toEqual([true, true, true]);
  });
  it("a 13+ or a 16+ is not 18+", () => {
    expect([13, 16].map(n => adult({ min_age: n }, "all"))).toEqual([false, false]);
    expect(adult({ min_age: 13 }, "kids")).toBe(false);
  });
  it("but a mature audience is, whatever lower age its listing states", () => {
    expect(adult({ min_age: 16 }, "mature")).toBe(true);
  });
  it("or the listing's own Mature Audience marker", () => {
    expect(adult({ mature: true }, "all")).toBe(true);
  });
  it("the stated age and the marker ask no tags: an event the tagger has not reached is 18+ by either", () => {
    expect(adult({ min_age: 18 })).toBe(true);
    expect(adult({ min_age: 17 })).toBe(true);
    expect(adult({ mature: true })).toBe(true);
  });
  it("an event with no tags, no such age and no marker is not known to be 18+", () => {
    expect(adult({})).toBe(false);
    expect(adult(null)).toBe(false);
    expect(adult({ min_age: 16 })).toBe(false);
    expect(adult({ mature: false })).toBe(false);
  });
  it("nor is an all-ages or a kids audience", () => {
    expect(adult({}, "all")).toBe(false);
    expect(adult({}, "kids")).toBe(false);
  });
  it("the schedule's own", () => {
    expect(events.filter(isAdult).map(e => e.id).sort()).toEqual(ADULT);
  });
  it("a row's 18+ asks the same rule, so a marked event the tagger has not reached is flagged; a stated minimum still wins the label", () => {
    const ages = e => flagsOf(e).filter(f => f.key === "age").map(f => f.label);
    expect(ages({ facets: { mature: true } })).toEqual(["18+"]);
    expect(ages({ facets: { mature: true }, tags: { audience: "all" } })).toEqual(["18+"]);
    expect(ages({ facets: { min_age: 16 }, tags: { audience: "mature" } })).toEqual(["16+"]);
    expect(ages({ facets: { min_age: 21, mature: true } })).toEqual(["21+"]);
    expect(ages({ facets: { min_age: 16 } })).toEqual(["16+"]);
    expect(ages({ facets: {} })).toEqual([]);
  });
});

describe("Getting in, in passesFilters()", () => {
  beforeEach(() => set({}));

  it("the four, in the sheet's order", () => {
    expect(GETTING_IN).toEqual(["cost", "signup", "audience", "soldOut"]);
  });
  it("with every one at All, every event passes, those that say nothing among them", () => {
    expect(passing()).toEqual(ids);
  });
  it("Extra fee keeps the events with a fee, and only those", () => {
    set({ cost: "yes" });
    expect(passing()).toEqual(["fee", "fee-and-signup", "sold-out-fee"]);
  });
  it("No extra fee keeps the rest: the two are each other's complement", () => {
    set({ cost: "no" });
    expect(passing()).toEqual(less("fee", "fee-and-signup", "sold-out-fee"));
  });
  it("Sign-up keeps the events that need one", () => {
    set({ signup: "yes" });
    expect(passing()).toEqual(["fee-and-signup", "signup"]);
  });
  it("No sign-up keeps the rest", () => {
    set({ signup: "no" });
    expect(passing()).toEqual(less("fee-and-signup", "signup"));
  });
  it("Not sold out leaves out what is sold out, and nothing else", () => {
    set({ soldOut: "no" });
    expect(passing()).toEqual(less("sold-out-fee"));
  });
  it("Kids is the audience, not the Kids Track: a mature event in the track is out, a kids event outside it is in", () => {
    set({ audience: "kids" });
    expect(passing()).toEqual(["kids", "kids-13"]);
  });
  it("18+ is isAdult()'s: a 13+ and a 16+ are not, a mature 16+ is", () => {
    set({ audience: "adult" });
    expect(passing()).toEqual(ADULT);
  });
  it("No 18+ keeps the rest", () => {
    set({ audience: "no-adult" });
    expect(passing()).toEqual(less(...ADULT));
  });
  it("an event with no facets has no fee, no sign-up and is not sold out", () => {
    for (const [over, passes] of [[{ cost: "no" }, true], [{ cost: "yes" }, false], [{ signup: "no" }, true], [{ signup: "yes" }, false], [{ soldOut: "no" }, true]]) {
      set(over);
      expect(passing().includes("nothing"), JSON.stringify(over)).toBe(passes);
      expect(passing().includes("untagged"), JSON.stringify(over)).toBe(passes);
    }
  });
  it("an event with no tags, no such age and no marker passes No 18+ and fails Kids and 18+", () => {
    for (const [value, passes] of [["no-adult", true], ["kids", false], ["adult", false]]) {
      set({ audience: value });
      expect(passing().includes("untagged"), value).toBe(passes);
      expect(passing().includes("nothing"), value).toBe(passes);
    }
  });
  it("an untagged event that states 18 or carries the marker is 18+: it fails No 18+ and passes 18+", () => {
    set({ audience: "no-adult" });
    expect(passing()).not.toContain("untagged-stated-18");
    expect(passing()).not.toContain("untagged-marked");
    set({ audience: "adult" });
    expect(passing()).toEqual(expect.arrayContaining(["untagged-stated-18", "untagged-marked"]));
  });
  it("two together: both must hold", () => {
    set({ cost: "yes", signup: "yes" });
    expect(passing()).toEqual(["fee-and-signup"]);
    set({ cost: "yes", soldOut: "no" });
    expect(passing()).toEqual(["fee", "fee-and-signup"]);
  });
  it("three together, and all four", () => {
    set({ cost: "yes", signup: "no", soldOut: "no" });
    expect(passing()).toEqual(["fee"]);
    set({ cost: "no", signup: "no", audience: "kids", soldOut: "no" });
    expect(passing()).toEqual(["kids", "kids-13"]);
    set({ cost: "yes", signup: "yes", audience: "adult", soldOut: "no" });
    expect(passing()).toEqual([]);
  });
  it("and one holds beside the other filters: a track and an audience", () => {
    set({ track: "Kids Track", audience: "adult" });
    expect(passing()).toEqual(["kids-track-18"]);
    set({ track: "Kids Track", audience: "no-adult" });
    expect(passing()).toEqual(["kids-13"]);
  });
  it("one answer for the filter and for an option's count: passesGettingIn()", () => {
    const by = id => events.find(e => e.id === id);
    expect(GETTING_IN.map(d => passesGettingIn(by("sold-out-fee"), d, "All"))).toEqual([true, true, true, true]);
    expect([passesGettingIn(by("fee"), "cost", "yes"), passesGettingIn(by("fee"), "cost", "no")]).toEqual([true, false]);
    expect([passesGettingIn(by("signup"), "signup", "yes"), passesGettingIn(by("signup"), "signup", "no")]).toEqual([true, false]);
    expect([passesGettingIn(by("sold-out-fee"), "soldOut", "no"), passesGettingIn(by("fee"), "soldOut", "no")]).toEqual([false, true]);
    expect(["kids", "no-adult", "adult"].map(v => passesGettingIn(by("kids-13"), "audience", v))).toEqual([true, true, false]);
    expect(["kids", "no-adult", "adult"].map(v => passesGettingIn(by("mature-16"), "audience", v))).toEqual([false, false, true]);
  });
});

describe("the words in the box that hold the audience", () => {
  const read = q => { const p = parseQuery(q); return { filters: p.filters, chips: p.chips.map(c => [c.dim, c.label, c.src, c.dims]), residual: p.residual }; };

  it.each(["18+", "adult"])("'%s' holds the Audience at 18+, with one chip, 18+", word => {
    expect(read(word)).toEqual({ filters: { audience: "adult" }, chips: [["audience", "18+", word, ["audience"]]], residual: "" });
  });
  it.each(["kids", "kid", "family", "children"])("'%s' holds two dimensions - the track at Kids Track, the Audience at No 18+ - with one chip, the track's, that names both", word => {
    expect(read(word)).toEqual({ filters: { track: "Kids Track", audience: "no-adult" }, chips: [["track", "Kids Track", word, ["track", "audience"]]], residual: "" });
  });
  it("no query word sets the old adult flag any more", () => {
    for (const q of ["18+", "adult", "kids", "kids 18+"]) expect("adult" in parseQuery(q).filters, q).toBe(false);
  });
  it.each(["kids 18+", "18+ kids", "kids adult", "adult kids", "family 18+", "adult children"])("'%s': the explicit word wins, in either order - the Kids Track at 18+", q => {
    expect(parseQuery(q).filters).toEqual({ track: "Kids Track", audience: "adult" });
    expect(parseQuery(q).chips.map(c => c.label).sort()).toEqual(["18+", "Kids Track"]);
  });
  it("and both orders give the Kids Track's 18+ events", () => {
    for (const q of ["kids 18+", "18+ kids", "adult kids", "kids adult"]) {
      typed(q);
      expect(passing(), q).toEqual(["kids-track-18"]);
    }
  });
  it("'18+' in the box finds the 18+ events, over whatever the sheet's Audience is", () => {
    typed("18+", { audience: "kids" });
    expect(activeFilters().audience).toBe("adult");
    expect(passing()).toEqual(ADULT);
  });
  it("'kids' in the box finds the Kids Track less its 18+ events", () => {
    typed("kids");
    expect(activeFilters()).toMatchObject({ track: "Kids Track", audience: "no-adult" });
    expect(passing()).toEqual(["kids-13"]);
  });
  it("with no word, the sheet's Audience is the one in effect", () => {
    typed("", { audience: "kids" });
    expect(activeFilters().audience).toBe("kids");
    typed("saturday", { audience: "adult" });
    expect(activeFilters().audience).toBe("adult");
  });
  it("cost, sign-up and sold out have no words: the sheet's value is read as it stands", () => {
    typed("free sold out sign-up", { cost: "yes", signup: "no", soldOut: "no" });
    expect(parseQuery("free sold out sign-up").filters).toEqual({});
    expect(activeFilters()).toMatchObject({ cost: "yes", signup: "no", soldOut: "no" });
  });
  it("every chip names the dimensions its word holds: a hotel's one, tonight's two", () => {
    expect(parseQuery("hilton contest").chips.map(c => [c.dim, c.dims]).sort()).toEqual([["hotel", ["hotel"]], ["kind", ["kind"]]]);
    expect(parseQuery("tonight").chips.map(c => [c.dim, c.dims])).toEqual([["day", ["day", "time"]]]);
    expect(parseQuery("today").chips.map(c => [c.dim, c.dims])).toEqual([["day", ["day"]]]);
  });
});
