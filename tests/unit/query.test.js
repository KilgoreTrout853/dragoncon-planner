/* Search's pure parts. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md); 2089 onwards sat in the
   harness's real-data section but need no data. */
import { describe, expect, it } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "../../src/browse.js";
import { expandQuery, SEARCH_PLACEHOLDER, STOPWORDS, termQuality } from "../../src/search.js";

describe("the search box", () => {
  it("the debounce is in a sensible range [544]", () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(60);
    expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(300);
  });
  it("the debounce is 70 ms [1860, the constant's half]", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(70);
  });
  it("the search placeholder fits a phone [859]", () => {
    expect(SEARCH_PLACEHOLDER.length).toBeGreaterThan(0);
    expect(SEARCH_PLACEHOLDER.length).toBeLessThanOrEqual(40);
  });
});

describe("how well one typed word matched", () => {
  it("an exact match scores 1 [2089]", () => {
    expect(termQuality("trek", ["trek"], { trek: 1 })).toBe(1);
  });
  it("a prefix scores how much of the word it covers (drag/dragons = 0.57) [2090]", () => {
    expect(termQuality("drag", ["dragons"], { dragons: 1 })).toBeCloseTo(4 / 7, 2);
  });
  it("covering more of the word scores higher (dragon beats dragoncon) [2092]", () => {
    expect(termQuality("drag", ["dragon"], { dragon: 1 })).toBeGreaterThan(termQuality("drag", ["dragoncon"], { dragoncon: 1 }));
  });
  it("an unrelated term scores 0 [2094]", () => {
    expect(termQuality("zzz", ["dragons"], { dragons: 1 })).toBe(0);
  });
});

describe("shorthand people type", () => {
  it("d&d expands to the words the index holds [2119]", () => {
    expect(expandQuery("d&d")).toBe("dungeons dragons");
  });
  it("dnd expands too [2120]", () => {
    expect(expandQuery("dnd")).toBe("dungeons dragons");
  });
  it.each(["how", "can", "do", "does", "should", "will", "want", "wanna", "gonna"])('"%s" is a stopword [2266]', word => {
    expect(STOPWORDS.has(word)).toBe(true);
  });
});
