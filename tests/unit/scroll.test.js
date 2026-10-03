/* scroll.js moreHidden() (DECISIONS #76): what an area of the sheet hides
   past its top and past its bottom, from its three numbers alone - no page
   and no layout, which jsdom lacks. Importing the module looks up <main>;
   with no markup it is null, and nothing here reaches it. New tests, not
   rows of tests/PORT-LEDGER.md, so their titles carry no harness line. */
import { describe, expect, it } from "vitest";
import { moreHidden } from "../../src/scroll.js";

describe("what a scrolling area hides past each edge", () => {
  it("nothing, where everything fits", () => {
    expect(moreHidden(0, 300, 300)).toEqual({above: 0, below: 0});
    expect(moreHidden(0, 300, 120)).toEqual({above: 0, below: 0});
  });
  it("nothing, where there is no layout: jsdom's three zeros", () => {
    expect(moreHidden(0, 0, 0)).toEqual({above: 0, below: 0});
  });
  it("at its top, what is under the fold and nothing above", () => {
    expect(moreHidden(0, 300, 320)).toEqual({above: 0, below: 20});
  });
  it("in the middle, both", () => {
    expect(moreHidden(12, 300, 340)).toEqual({above: 12, below: 28});
  });
  it("at its end, what is above and nothing below", () => {
    expect(moreHidden(20, 300, 320)).toEqual({above: 20, below: 0});
  });
  it("under one px hidden is none, and one px is one", () => {
    expect(moreHidden(0.9, 300, 320)).toEqual({above: 0, below: 19});
    expect(moreHidden(1, 300, 320)).toEqual({above: 1, below: 19});
    expect(moreHidden(19.1, 300, 320)).toEqual({above: 19, below: 0});
    expect(moreHidden(19, 300, 320)).toEqual({above: 19, below: 1});
  });
  it("a fraction is cut to whole px: scrollTop is one where the other two are rounded", () => {
    expect(moreHidden(7.5, 300, 340)).toEqual({above: 7, below: 32});
    /* An area at its end, a fraction past what its rounded heights allow -
       as Chromium measured one: 188.67 against 449 less 261. */
    expect(moreHidden(188.6666717529297, 261, 449)).toEqual({above: 48, below: 0});
    /* And a fraction short of it. */
    expect(moreHidden(187.4, 261, 449)).toEqual({above: 48, below: 0});
  });
  it("past either end is that end: a bounce cannot go under 0", () => {
    expect(moreHidden(-40, 300, 320)).toEqual({above: 0, below: 48});
    expect(moreHidden(60, 300, 320)).toEqual({above: 48, below: 0});
    expect(moreHidden(-3, 300, 310)).toEqual({above: 0, below: 13});
    expect(moreHidden(13, 300, 310)).toEqual({above: 13, below: 0});
    expect(moreHidden(25, 300, 310)).toEqual({above: 25, below: 0});
  });
  it("the ceiling is 48: far from an end the number stands still, so nothing is written there", () => {
    expect(moreHidden(48, 300, 2000)).toEqual({above: 48, below: 48});
    expect(moreHidden(49, 300, 2000)).toEqual({above: 48, below: 48});
    expect(moreHidden(900, 300, 2000)).toEqual({above: 48, below: 48});
    expect(moreHidden(1651, 300, 2000)).toEqual({above: 48, below: 48});
    expect(moreHidden(1653, 300, 2000)).toEqual({above: 48, below: 47});
    expect(moreHidden(47, 300, 2000)).toEqual({above: 47, below: 48});
  });
});
