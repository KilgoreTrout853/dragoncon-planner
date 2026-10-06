/* Share a day's link and message (src/shareday.js; DECISIONS #69): encode
   and decode against schedules of the tests' own, and every id of each
   year's schedule held to what a link can carry. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { YEAR } from "../../src/season.js";
import { conDayKey } from "../../src/time.js";
import {
  dayLink, dayMessage, defaultShareDay, linkSafe, parseDayLink, readSharedDay, shareableDays, sharedPicks,
} from "../../src/shareday.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "https://example.test/planner/?now=2026-09-05T13:05#explore=work:x";
const SAT = "2026-09-05", SUN = "2026-09-06", FRI = "2026-09-04";
const hex = n => n.toString(16).padStart(32, "0");
function ev(id, start, over = {}) {
  const s = new Date(start);
  return { id, title: `Event ${id.slice(-4)}`, hotel: "Hilton", room: "201", _s: s, _e: new Date(s.getTime() + 3600000), _cd: conDayKey(s), ...over };
}
/* A day's worth of a schedule: ids near-sequential, as 2026's are. */
function schedule(n = 40, day = SAT, from = 0x239ca972) {
  return Array.from({ length: n }, (_, i) => ev(`6ecc75745a676d39f2300556${hex(from + i).slice(-8)}`, `${day}T${String(9 + (i % 12)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`))
    .sort((a, b) => a._s - b._s);
}
const queryOf = link => new URL(link).search;

describe("the link", () => {
  it("a round trip: the day's picks, in start order, nothing skipped", () => {
    const all = schedule(), list = [all[3], all[10], all[20]];
    const back = readSharedDay(dayLink(BASE, SAT, list, all), all);
    expect(back).toEqual({ day: SAT, events: list, skipped: 0, cut: false });
  });
  it("carries the year, the day and the tokens, and nothing else: no ?now=, no hash, on the sharer's own address", () => {
    const all = schedule(), list = [all[0], all[1]];
    const link = dayLink(BASE, SAT, list, all);
    expect(link).toBe(`https://example.test/planner/?day=${YEAR}.sat.${all[0].id.slice(-8)}-${all[1].id.slice(-8)}`);
  });
  it("an id whose last eight are another's too goes whole, and comes back", () => {
    const all = schedule(), twin = ev(`ffffffffffffffffffffffff${all[5].id.slice(-8)}`, `${SAT}T15:00`);
    const with2 = [...all, twin].sort((a, b) => a._s - b._s);
    const link = dayLink(BASE, SAT, [all[5], twin], with2);
    expect(queryOf(link)).toBe(`?day=${YEAR}.sat.${all[5].id}-${twin.id}`);
    expect(readSharedDay(link, with2).events.map(e => e.id).sort()).toEqual([all[5].id, twin.id].sort());
  });
  it("a tail that matches two events is skipped and counted", () => {
    const all = schedule(), twin = ev(`ffffffffffffffffffffffff${all[5].id.slice(-8)}`, `${SAT}T15:00`);
    const back = readSharedDay(`?day=${YEAR}.sat.${all[5].id.slice(-8)}-${all[6].id.slice(-8)}`, [...all, twin]);
    expect(back.events).toEqual([all[6]]);
    expect(back.skipped).toBe(1);
  });
  it("a tail that matches nothing is skipped and counted", () => {
    const all = schedule();
    const back = readSharedDay(`?day=${YEAR}.sat.${all[2].id.slice(-8)}-deadbeef-0badf00d`, all);
    expect(back).toEqual({ day: SAT, events: [all[2]], skipped: 2, cut: false });
  });
  it("a tail cut short - fewer than eight characters - is skipped, never read as another event's ending, and said to be cut", () => {
    const all = schedule(), cut = all[7].id.slice(-8, -2);
    expect(all.filter(e => e.id.endsWith(cut)).length).toBeLessThanOrEqual(1);
    const back = readSharedDay(`?day=${YEAR}.sat.${all[2].id.slice(-8)}-${cut}`, all);
    expect(back).toEqual({ day: SAT, events: [all[2]], skipped: 1, cut: true });
  });
  it("duplicates are shown once and not counted", () => {
    const all = schedule(), t = all[4].id.slice(-8);
    expect(readSharedDay(`?day=${YEAR}.sat.${t}-${t}-${all[4].id}`, all)).toEqual({ day: SAT, events: [all[4]], skipped: 0, cut: false });
  });
  it('an id holding a "." travels and comes back, beside the id it was split from', () => {
    const all = schedule(), split = ev(`${all[8].id}.1`, `${SAT}T16:00`), with2 = [...all, split].sort((a, b) => a._s - b._s);
    const link = dayLink(BASE, SAT, [all[8], split], with2);
    expect(queryOf(link)).toBe(`?day=${YEAR}.sat.${all[8].id.slice(-8)}-${split.id.slice(-8)}`);
    expect(parseDayLink(link)).toEqual({ year: YEAR, day: "sat", tokens: [all[8].id.slice(-8), split.id.slice(-8)], cut: false });
    expect(readSharedDay(link, with2).events).toEqual([all[8], split].sort((a, b) => a._s - b._s));
  });
  it('#43\'s leaver, <source_id>.1, sent whole: the "." in a token is not read as one of the two dots that part the fields', () => {
    /* Two leavers whose sources end alike, so their eight-character tails
       - the last six of the source, then ".1" - are one, and both go whole. */
    const all = schedule(), a = ev(`${"a".repeat(26)}c0ffee.1`, `${SAT}T15:00`), b = ev(`${"b".repeat(26)}c0ffee.1`, `${SAT}T16:00`);
    const with2 = [...all, a, b].sort((x, y) => x._s - y._s);
    const link = dayLink(BASE, SAT, [a, b], with2);
    expect(queryOf(link)).toBe(`?day=${YEAR}.sat.${a.id}-${b.id}`);
    expect(parseDayLink(link)).toEqual({ year: YEAR, day: "sat", tokens: [a.id, b.id], cut: false });
    expect(readSharedDay(link, with2)).toEqual({ day: SAT, events: [a, b], skipped: 0, cut: false });
  });
  it('a link ending in "-" still parses: what resolved, nothing skipped, and said to be cut short', () => {
    const all = schedule(), t = all[3].id.slice(-8);
    expect(parseDayLink(`?day=${YEAR}.sat.${t}-`)).toEqual({ year: YEAR, day: "sat", tokens: [t], cut: true });
    expect(readSharedDay(`?day=${YEAR}.sat.${t}-`, all)).toEqual({ day: SAT, events: [all[3]], skipped: 0, cut: true });
  });
  it("is resolved across the year: an event moved to another day is still found, in start order", () => {
    const sat = schedule(10, SAT), sun = schedule(10, SUN, 0x47630000);
    const all = [...sat, ...sun].sort((a, b) => a._s - b._s);
    const back = readSharedDay(`?day=${YEAR}.sat.${sun[2].id.slice(-8)}-${sat[1].id.slice(-8)}`, all);
    expect(back.events).toEqual([sat[1], sun[2]]);
    expect(back.skipped).toBe(0);
  });
  it("another year's link is refused, whatever it holds", () => {
    const all = schedule();
    expect(readSharedDay(`https://example.test/?day=${YEAR - 1}.sat.${all[0].id.slice(-8)}`, all)).toEqual({ error: "other_year", year: YEAR - 1 });
    expect(readSharedDay(`?day=${YEAR + 1}.tue.whatever`, all)).toEqual({ error: "other_year", year: YEAR + 1 });
  });
  it("a day the con does not have, or no tokens, does not parse", () => {
    const all = schedule();
    for (const bad of [`?day=${YEAR}.tue.${all[0].id.slice(-8)}`, `?day=${YEAR}.sat.`, `?day=${YEAR}.sat.---`, `?day=${YEAR}.sat`, `?day=${YEAR}`, "?day=", "?join=2026.abc"]) {
      expect(readSharedDay(bad, all), bad).toEqual({ error: "bad" });
    }
  });
  it("junk, of any type, does not parse and throws nothing", () => {
    const all = schedule();
    const junk = [undefined, null, "", " ", 42, {}, [], "day=", "?day=%E0%A4%A", "?day=2026%2Esat%2E", "\u0000￿", "?day=२०२६.sat.abcdefgh", "https://example.test/?day=2026.sat.abc&day=", "?day=2026.sät.abcdefgh"];
    for (const value of junk) {
      expect(() => readSharedDay(value, all)).not.toThrow();
      expect(() => parseDayLink(value)).not.toThrow();
    }
    for (let i = 0; i < 500; i++) {
      const value = Array.from({ length: 1 + (i % 60) }, (_, j) => String.fromCharCode(((i * 7919 + j * 104729) % 0x2fff) + 1)).join("");
      expect(() => readSharedDay(`?day=${value}`, all)).not.toThrow();
    }
    expect(readSharedDay("?day=%E0%A4%A", all)).toEqual({ error: "bad" });
  });
  it("reads the last day= in what is pasted: the whole message, or text around the link", () => {
    const all = schedule(), list = [all[1], all[2]], link = dayLink(BASE, SAT, list, all);
    expect(readSharedDay(dayMessage(SAT, list, link), all).events).toEqual(list);
    expect(readSharedDay(`see ?day=${YEAR}.sun.${all[9].id.slice(-8)} and then ${link} - enjoy`, all).events).toEqual(list);
  });
  it("reads the bare value too, and its three letters in any case", () => {
    const all = schedule();
    expect(readSharedDay(`${YEAR}.SAT.${all[0].id.slice(-8)}`, all)).toEqual({ day: SAT, events: [all[0]], skipped: 0, cut: false });
  });
  it("a very long link: a thousand picks come back; past the cap it is not read", () => {
    const all = schedule(1000), link = dayLink("https://example.test/", SAT, all, all);
    expect(link.length).toBeGreaterThan(9000);
    expect(readSharedDay(link, all)).toEqual({ day: SAT, events: all, skipped: 0, cut: false });
    expect(readSharedDay(`?day=${YEAR}.sat.${"abcdefgh-".repeat(2000)}`, all)).toEqual({ error: "bad" });
  });
  it("an id shorter than eight characters cannot travel: its token is skipped, never read as an ending", () => {
    const all = [...schedule(), ev("s0002", `${SAT}T12:00`)], short = all.at(-1);
    const link = dayLink(BASE, SAT, [short], all);
    expect(queryOf(link)).toBe(`?day=${YEAR}.sat.s0002`);
    expect(readSharedDay(link, all)).toEqual({ day: SAT, events: [], skipped: 1, cut: true });
  });
  it("leaves out an id a link cannot carry", () => {
    const all = schedule(), odd = ev("abc-def-ghi-jklmnop", `${SAT}T12:00`), with2 = [...all, odd];
    expect(queryOf(dayLink(BASE, SAT, [all[0], odd], with2))).toBe(`?day=${YEAR}.sat.${all[0].id.slice(-8)}`);
  });
});

describe("what a day shares", () => {
  const all = [
    ev(hex(1), `${FRI}T10:00`), ev(hex(2), `${SAT}T09:00`), ev(hex(3), `${SAT}T11:00`, { cancelled: true }),
    ev(hex(4), `${SAT}T13:00`, { removed: true }), ev(hex(5), `${SAT}T14:00`), ev(hex(6), `${SUN}T01:30`), ev(hex(7), `${SUN}T10:00`, { cancelled: true }),
  ];
  it("the day's picks in start order, removed and cancelled left out; 1:30 AM Sunday is Saturday's", () => {
    const picked = new Set(all.map(e => e.id));
    expect(sharedPicks(all, picked, SAT).map(e => e.id)).toEqual([hex(2), hex(5), hex(6)]);
  });
  it("the days that hold one, in order: a day of only cancelled picks is none", () => {
    expect(shareableDays(all, new Set(all.map(e => e.id)))).toEqual([FRI, SAT]);
    expect(shareableDays(all, new Set([hex(7)]))).toEqual([]);
  });
  it("opens on today if it holds a pick, else the next day that does, else the first", () => {
    expect(defaultShareDay([FRI, SAT], SAT)).toBe(SAT);
    expect(defaultShareDay([FRI, SUN], SAT)).toBe(SUN);
    expect(defaultShareDay([FRI, SAT], "2026-08-01")).toBe(FRI);
    expect(defaultShareDay([FRI, SAT], "2026-12-01")).toBe(FRI);
    expect(defaultShareDay([], SAT)).toBe(null);
  });
});

describe("the message", () => {
  const link = `https://example.test/?day=${YEAR}.sat.abcdefgh`;
  it("plain text that stands on its own, then the link", () => {
    const list = [
      ev(hex(1), `${SAT}T13:00`, { title: "Artemis: Bridge Crew Open Play", hotel: "Westin" }),
      ev(hex(2), `${SAT}T14:30`, { title: "Writing Villains  Readers\nLove to Hate", hotel: "Hyatt" }),
      ev(hex(3), `${SAT}T16:00`, { title: "A stream", hotel: "Streaming", room: "" }),
      ev(hex(4), `${SAT}T17:00`, { title: "Offsite", hotel: "Other", room: "Joystick Gamebar" }),
      ev(hex(5), `${SUN}T01:00`, { title: "Late", hotel: "AmericasMart Building 3" }),
    ];
    expect(dayMessage(SAT, list, link)).toBe([
      "My Saturday at Dragon Con:",
      "1:00 PM  Artemis: Bridge Crew Open Play (Westin)",
      "2:30 PM  Writing Villains Readers Love to Hate (Hyatt)",
      "4:00 PM  A stream (Streaming)",
      "5:00 PM  Offsite (Joystick Gamebar)",
      "1:00 AM  Late (Mart 3)",
      link,
    ].join("\n"));
  });
  it("at most 1,800 characters: lines go from the end, one says how many, and the link stays whole", () => {
    const list = Array.from({ length: 40 }, (_, i) => ev(hex(i + 1), `${SAT}T${String(9 + (i % 12)).padStart(2, "0")}:00`, { title: `A rather long panel title, number ${i + 1}, about many things` }));
    const long = `https://example.test/?day=${YEAR}.sat.${list.map(e => e.id.slice(-8)).join("-")}`;
    const text = dayMessage(SAT, list, long), lines = text.split("\n");
    expect(text.length).toBeLessThanOrEqual(1800);
    expect(lines.at(-1)).toBe(long);
    const shown = lines.length - 3;
    expect(lines.at(-2)).toBe(`+${40 - shown} more in the link`);
    expect(lines.slice(1, -2)).toEqual(dayMessage(SAT, list.slice(0, shown), "x").split("\n").slice(1, -1));
    const oneMore = dayMessage(SAT, [list[shown]], "x").split("\n")[1];
    expect([...lines.slice(0, -2), oneMore, `+${40 - shown - 1} more in the link`, long].join("\n").length).toBeGreaterThan(1800);
  });
  it("under the cap, nothing is dropped and nothing says so", () => {
    const list = [ev(hex(1), `${SAT}T13:00`)];
    expect(dayMessage(SAT, list, link)).not.toMatch(/more in the link/);
  });
});

/* Every id a year's schedule holds can travel in a link as it is: nothing a
   query encodes, no "-", eight characters or more. A year whose source
   mints ids of another shape fails here, in CI, before a link breaks. */
describe("every id of every year's schedule is link-safe", () => {
  const years = fs.readdirSync(path.join(ROOT, "data")).filter(y => /^\d{4}$/.test(y) && fs.existsSync(path.join(ROOT, "data", y, "events.v2.json")));
  it("there is a year to check", () => expect(years.length).toBeGreaterThan(0));
  it("the rule allows #43's leaver shape, <source_id>.1, and refuses a \"-\" or anything a query encodes", () => {
    const leaver = `${"6ecc75745a676d39f2300556239ca972"}.1`;
    expect([linkSafe(leaver), encodeURIComponent(leaver) === leaver]).toEqual([true, true]);
    expect(["abc-defgh", "abcdefg h", "abcdefgh&", "abcdéfgh"].map(linkSafe)).toEqual([false, false, false, false]);
  });
  for (const year of years) {
    it(`${year}`, () => {
      const ids = JSON.parse(fs.readFileSync(path.join(ROOT, "data", year, "events.v2.json"), "utf8")).events.map(e => e.id);
      expect(ids.filter(id => !linkSafe(id) || encodeURIComponent(id) !== id || id.includes("-") || id.length < 8)).toEqual([]);
    });
  }
});
