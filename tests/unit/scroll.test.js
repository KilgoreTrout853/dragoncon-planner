/* scroll.js moreHidden() (DECISIONS #76): what an area of the sheet hides
   past its top and past its bottom, from its three numbers alone - no page
   and no layout, which jsdom lacks. Importing the module looks up <main>;
   with no markup it is null, and nothing here reaches it. And moreWord()
   (#78): the word the mark carries while an area hides enough below. And
   drawInPlace() (#89), on a part of an SVG - which the Map's three layers
   are - and on a part of a page, as it was. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import { describe, expect, it } from "vitest";
import { mutationsDuring } from "../helpers/act.js";
import { drawInPlace, moreHidden, moreWord } from "../../src/scroll.js";

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

describe("the word an area's mark carries: below, while it hides enough below to scroll to", () => {
  const word = (scrollTop, clientHeight, scrollHeight) => moreWord(moreHidden(scrollTop, clientHeight, scrollHeight));

  it("under the threshold, 20 px, there is none: the fade alone speaks", () => {
    expect(moreWord({above: 0, below: 19})).toBe("");
    expect(moreWord({above: 0, below: 1})).toBe("");
    expect(word(0, 300, 319)).toBe("");
  });
  it("at the threshold it is said, and over it", () => {
    expect(moreWord({above: 0, below: 20})).toBe("below");
    expect(moreWord({above: 0, below: 21})).toBe("below");
    expect(word(0, 300, 320)).toBe("below");
  });
  it("a fraction under the threshold is under it: what is hidden is cut to whole px first", () => {
    expect(word(0.5, 300, 320)).toBe("");
    expect(word(0, 300, 320.9)).toBe("below");
  });
  it("far from an end it is said: the ceiling stands above the threshold", () => {
    expect(word(0, 300, 2000)).toBe("below");
    expect(word(900, 300, 2000)).toBe("below");
  });
  it("what is hidden above never says it: there is no arrow for more above", () => {
    expect(moreWord({above: 48, below: 0})).toBe("");
    expect(moreWord({above: 48, below: 19})).toBe("");
    expect(moreWord({above: 20, below: 0})).toBe("");
    expect(word(1700, 300, 2000)).toBe("");
  });
  it("and where everything fits there is none", () => {
    expect(word(0, 300, 300)).toBe("");
    expect(word(0, 0, 0)).toBe("");
  });
});

/* A part's markup is read in an element of the part's own kind, and a child's
   kind is its tag and its class attribute. In a div, two self-closed rects
   nest and are no SVG; and an SVG element's className is an object, never
   equal to another's - either would have every draw of a layer draw it anew. */
describe("drawInPlace(): a part drawn in place, and whether anything was written", () => {
  const SVG = "http://www.w3.org/2000/svg";
  const ring = (kind, hotel, x) => `<rect class="map-ring ${kind}" data-hotel="${hotel}" x="${x}" y="218" width="68" height="64" rx="14"/>`;
  const pill = (hotel, n) => `<g class="map-pill" data-hotel="${hotel}" data-count="${n}"><rect x="170" y="213" width="22" height="18" rx="9"/><text x="181" y="222">${n}</text></g>`;
  function layer(html) {
    document.body.innerHTML = `<svg viewBox="0 0 380 300"><g class="layer">${html}</g></svg>`;
    return document.querySelector("g.layer");
  }
  const kinds = part => [...part.children].map(el => `${el.namespaceURI === SVG ? "svg" : "html"}:${el.tagName}.${el.getAttribute("class")}@${el.getAttribute("data-hotel")}`);

  describe("on a part of an SVG", () => {
    it("the same markup: nothing is written, and it says false", () => {
      const part = layer(ring("now", "Hyatt", 116) + ring("next", "Hilton", 300));
      let wrote;
      expect(mutationsDuring(part, () => { wrote = drawInPlace(part, ring("now", "Hyatt", 116) + ring("next", "Hilton", 300)); })).toHaveLength(0);
      expect(wrote).toBe(false);
    });
    it("nothing drawn into nothing: false, and nothing written", () => {
      const part = layer("");
      let wrote;
      expect(mutationsDuring(part, () => { wrote = drawInPlace(part, ""); })).toHaveLength(0);
      expect(wrote).toBe(false);
    });
    it("alike children - the same tags and classes, the same number - are kept and written into, and it says true", () => {
      const part = layer(ring("now", "Hyatt", 116) + ring("next", "Hilton", 300));
      const [now, next] = part.children;
      const seen = mutationsDuring(part, () => { expect(drawInPlace(part, ring("now", "Hyatt", 116) + ring("next", "Westin", 44))).toBe(true); });
      expect([part.children.length, part.children[0] === now, part.children[1] === next]).toEqual([2, true, true]);
      expect([next.getAttribute("data-hotel"), next.getAttribute("x"), next.getAttribute("class")]).toEqual(["Westin", "44", "map-ring next"]);
      /* only what differs is written: two attributes of the one ring */
      expect(seen.map(record => [record.type, record.target === next, record.attributeName]).sort()).toEqual([["attributes", true, "data-hotel"], ["attributes", true, "x"]]);
    });
    it("a child that holds others is kept, and what it holds is written", () => {
      const part = layer(pill("Hyatt", 2) + pill("Marriott", 1));
      const [hyatt, marriott] = part.children;
      expect(drawInPlace(part, pill("Hyatt", 3) + pill("Marriott", 1))).toBe(true);
      expect([part.children[0] === hyatt, part.children[1] === marriott]).toEqual([true, true]);
      expect([hyatt.getAttribute("data-count"), hyatt.querySelector("text").textContent, hyatt.querySelector("text").namespaceURI]).toEqual(["3", "3", SVG]);
    });
    it("a changed number draws the part anew, as SVG and side by side, and it says true", () => {
      const part = layer(ring("now", "Hyatt", 116) + ring("next", "Hilton", 300));
      const [now, next] = part.children;
      expect(drawInPlace(part, ring("next", "Hilton", 300))).toBe(true);
      expect(kinds(part)).toEqual(["svg:rect.map-ring next@Hilton"]);
      expect([part.children[0] === now, part.children[0] === next, now.isConnected, next.isConnected]).toEqual([false, false, false, false]);
      expect(drawInPlace(part, ring("now", "Westin", 44) + ring("next", "Hilton", 300))).toBe(true);
      expect(kinds(part)).toEqual(["svg:rect.map-ring now@Westin", "svg:rect.map-ring next@Hilton"]);
      expect(part.children[0].children).toHaveLength(0);
      expect(drawInPlace(part, "")).toBe(true);
      expect(part.childNodes).toHaveLength(0);
    });
    it("a changed class draws the part anew: one ring, now the other kind, is another element", () => {
      const part = layer(ring("next", "Hilton", 300));
      const was = part.children[0];
      expect(drawInPlace(part, ring("now", "Hilton", 303))).toBe(true);
      expect([part.children[0] === was, kinds(part)]).toEqual([false, ["svg:rect.map-ring now@Hilton"]]);
    });
  });

  describe("on a part of a page, as it was", () => {
    const card = (id, words) => `<button class="next-card" id="mapNext" data-hero="${id}"><div class="nc-title">${words}</div></button>`;
    const onLine = id => `<button class="next-on" id="mapOnNow" data-hero="${id}">On now</button>`;
    function under(html) {
      document.body.innerHTML = `<div class="map-under" id="mapUnder">${html}</div>`;
      return document.getElementById("mapUnder");
    }

    it("the same markup: false, and nothing written", () => {
      const part = under(card("a", "One"));
      let wrote;
      expect(mutationsDuring(part, () => { wrote = drawInPlace(part, card("a", "One")); })).toHaveLength(0);
      expect(wrote).toBe(false);
    });
    it("alike: the card is the same node, its words new, focus still on it, and it says true", () => {
      const part = under(card("a", "One")), was = part.children[0];
      was.focus();
      expect(drawInPlace(part, card("b", "Two"))).toBe(true);
      expect([part.children[0] === was, was.dataset.hero, was.textContent, document.activeElement === was]).toEqual([true, "b", "Two", true]);
    });
    it("a changed number draws it anew, and focus is put back on the card by its place", () => {
      const part = under(card("a", "One")), was = part.children[0];
      was.focus();
      expect(drawInPlace(part, onLine("z") + card("a", "One"))).toBe(true);
      expect([...part.children].map(el => el.id)).toEqual(["mapOnNow", "mapNext"]);
      expect([part.children[1] === was, document.activeElement === part.children[1]]).toEqual([false, true]);
    });
    it("a child with no class is alike one with none, and unlike one with a class", () => {
      const part = under("<p>One</p>"), was = part.children[0];
      expect(drawInPlace(part, "<p>Two</p>")).toBe(true);
      expect([part.children[0] === was, was.textContent]).toEqual([true, "Two"]);
      expect(drawInPlace(part, '<p class="said">Two</p>')).toBe(true);
      expect(part.children[0] === was).toBe(false);
    });
  });
});
