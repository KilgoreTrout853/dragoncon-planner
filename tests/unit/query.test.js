/* Search's pure parts. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md); 2089 onwards sat in the
   harness's real-data section but need no data. A test with no bracket was
   written since: what a text is indexed under, the words a query is read
   for, and tonight's hours (DECISIONS #104). */
import { describe, expect, it } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "../../src/browse.js";
import { dropPhrase, expandQuery, inTimeBand, parseQuery, SEARCH_PLACEHOLDER, STOPWORDS, synonymsIn, termQuality } from "../../src/search.js";

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
  it.each([["scifi", "sci fi"], ["SciFi", "sci fi"], ["starwars", "star wars"], ["StarWars", "star wars"], ["startrek", "star trek"], ["STARTREK", "star trek"]])(
    'a name typed as one word is the two the index holds: "%s"', (typed, read) => {
      expect(expandQuery(typed)).toBe(read);
      expect(expandQuery(`${typed} panels`)).toBe(`${read} panels`);
    });
  it("only as a whole word: scifiction is left alone", () => {
    expect(expandQuery("scifiction")).toBe("scifiction");
    expect(expandQuery("starwarsy startreks")).toBe("starwarsy startreks");
  });
  it.each(["how", "can", "do", "does", "should", "will", "want", "wanna", "gonna"])('"%s" is a stopword [2266]', word => {
    expect(STOPWORDS.has(word)).toBe(true);
  });
});

describe("what a text is indexed under: a synonym is found as whole words", () => {
  it.each([
    ["hyatt regency vi", "ya"],
    ["celebrity q&a", "brit"],
    ["an rpg system", "science"],
    ["wristbanding", "music"],
    ["pinball machines", "dance"],
    ["angela smith", "buffy"],
  ])('"%s" does not find "%s": the letters stand inside a word', (text, phrase) => {
    expect(synonymsIn(text)).not.toContain(phrase);
  });
  it.each([
    ["cosplays", "cosplay"],
    ["zombies", "horror"],
    ["city of angels", "buffy"],
    ["d&d night", "dungeon master"],
    ["18+ only", "burlesque"],
    ["a ya panel, with authors", "young adult"],
    ["georgia philharmonic orchestra", "symphony"],
  ])('"%s" finds "%s": a whole word, a plural, a phrase with a mark in it', (text, phrase) => {
    expect(synonymsIn(text)).toContain(phrase);
  });
  it("a plural is s and no more: a longer word is another word, and Los Angeles is no angel", () => {
    expect(synonymsIn("los angeles")).not.toContain("buffy");
    expect(synonymsIn("two xboxes")).not.toContain("video game");
    expect(synonymsIn("larpers")).not.toContain("larp");
    expect(synonymsIn("costumed")).not.toContain("cosplay");
    expect(synonymsIn("the balls")).toContain("dance");
  });
  it.each([
    ["concert - the gekkos", "symphony"],
    ["pathfinder society", "d&d"],
    ["tabletop", "board game"],
    ["collectible card game", "board game"],
    ["masquerade", "cosplay"],
  ])('"%s" does not find "%s": what goes together is not the same thing', (text, phrase) => {
    expect(synonymsIn(text)).not.toContain(phrase);
  });
  it("the words cut out of a group join no other, and the parts cut apart are groups of their own", () => {
    for (const word of ["concert", "tabletop", "pathfinder", "masquerade"]) expect(synonymsIn(word), word).toEqual([]);
    expect(synonymsIn("collectible card game")).toEqual(["card game", "deck-building"]);
    expect(synonymsIn("a ttrpg")).toEqual(["ttrpg", "tabletop rpg", "role-playing", "roleplaying"]);
  });
});

describe("a name that holds a filter word is kept whole", () => {
  const read = q => { const p = parseQuery(q); return { filters: p.filters, chips: p.chips.map(c => c.label), residual: p.residual }; };

  it('"young adult" is no 18+ filter: no chip, and both words to search by', () => {
    expect(read("young adult")).toEqual({ filters: {}, chips: [], residual: "young adult" });
  });
  it('"young adult saturday" is the day and the name', () => {
    expect(read("young adult saturday")).toEqual({ filters: { day: "2026-09-05" }, chips: ["Saturday"], residual: "young adult" });
  });
  it('"saturday night live saturday": the day is the second saturday, and its chip takes that one out', () => {
    expect(read("saturday night live saturday")).toEqual({ filters: { day: "2026-09-05" }, chips: ["Saturday"], residual: "saturday night live" });
    expect(dropPhrase("saturday night live saturday", "saturday")).toBe("saturday night live");
  });
  it('"addams family" is no Kids Track; "family" and "adult" alone are filters as before', () => {
    expect(read("addams family")).toEqual({ filters: {}, chips: [], residual: "addams family" });
    expect(read("family")).toEqual({ filters: { track: "Kids Track", audience: "no-adult" }, chips: ["Kids Track"], residual: "" });
    expect(read("adult")).toEqual({ filters: { audience: "adult" }, chips: ["18+"], residual: "" });
  });
  it("the other two names set nothing either", () => {
    expect(read("children who chase lost voices")).toEqual({ filters: {}, chips: [], residual: "children who chase lost voices" });
    expect(read("dc's legends of tomorrow")).toEqual({ filters: {}, chips: [], residual: "dc's legends of tomorrow" });
  });
  it("a filter word beside the name is still read, and its chip takes out that word alone", () => {
    expect(read("adult young adult")).toEqual({ filters: { audience: "adult" }, chips: ["18+"], residual: "young adult" });
    expect(dropPhrase("young adult adult", "adult")).toBe("young adult");
  });
  it("and a word that goes back to being a search word goes back beside the name, whole", () => {
    expect(read("young adult gaming adult")).toEqual({ filters: { audience: "adult" }, chips: ["18+"], residual: "young adult gaming" });
  });
});

describe("a filter word is read with a mark after it", () => {
  const read = q => { const p = parseQuery(q); return { filters: p.filters, chips: p.chips.map(c => [c.label, c.src]), residual: p.residual }; };

  it('"star trek saturday?" has the day, and "star trek" to search by', () => {
    expect(read("star trek saturday?")).toEqual({ filters: { day: "2026-09-05" }, chips: [["Saturday", "saturday"]], residual: "star trek" });
  });
  it("the chip's x takes the word out with its mark", () => {
    expect(dropPhrase("star trek saturday?", "saturday")).toBe("star trek");
  });
  it.each(["?", "!", ".", ";", ":", "?!"])('"friday%s" is the day', mark => {
    expect(read(`friday${mark}`)).toEqual({ filters: { day: "2026-09-04" }, chips: [["Friday", "friday"]], residual: "" });
  });
  it("a phrase is read with a mark after its last word, and not after its first", () => {
    expect(read("late night!")).toMatchObject({ filters: { time: "late night" }, residual: "" });
    expect(read("late. night")).toMatchObject({ filters: { time: "late" }, residual: "night" });
  });
  it('a name kept whole is found the same way: "young adult?" sets no audience', () => {
    expect(read("young adult?")).toEqual({ filters: {}, chips: [], residual: "young adult?" });
  });
  it("no other token loses a character: a name keeps its period, and a mark alone is no word", () => {
    expect(read("michael j. fox")).toEqual({ filters: {}, chips: [], residual: "michael j. fox" });
    expect(read("fridays?").residual).toBe("fridays?");
    expect(dropPhrase("what ? now", "")).toBe("what ? now");
  });
});

describe("tonight is today from 5 PM through the small hours", () => {
  const at = start => ({ _s: new Date(start) });
  const STARTS = ["2026-09-05T16:30", "2026-09-05T17:00", "2026-09-05T20:59", "2026-09-05T22:00", "2026-09-06T01:00", "2026-09-06T06:00"];

  it('"tonight" sets the time to tonight, under its one chip', () => {
    expect(parseQuery("tonight").filters.time).toBe("tonight");
    expect(parseQuery("tonight").chips.map(c => c.label)).toEqual(["Tonight"]);
  });
  it("tonight holds 5 PM, 8:59 PM, 10 PM and 1 AM the next morning; not 4:30 PM, nor 6 AM", () => {
    expect(STARTS.map(s => inTimeBand(at(s), "tonight"))).toEqual([false, true, true, true, true, false]);
  });
  it("evening and late night are as they were", () => {
    expect(STARTS.map(s => inTimeBand(at(s), "evening"))).toEqual([false, true, true, false, false, false]);
    expect(STARTS.map(s => inTimeBand(at(s), "late night"))).toEqual([false, false, false, true, true, false]);
  });
});
