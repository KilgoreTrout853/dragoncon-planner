/* The client takes its year from its two data files and holds none of it
   itself (DECISIONS #49). Here the two modules the build resolves stand in
   for other files: 2027's season file, and a venues file whose order, names,
   walk, minutes and slack all differ from the committed one's. The days, the
   bounds, the preview, the day words, the hotels, the walk and the tight
   band follow them. tests/page/year.test.js holds the year under test's own
   files. New tests, not rows of tests/PORT-LEDGER.md. */
import { describe, expect, it, vi } from "vitest";
import { CON, CON_DAYS, conPhase, DAY_LABEL, DAY_LONG, effectiveNow, FIRST_FULL_DAY, setOverride } from "../../src/time.js";
import { parseQuery } from "../../src/search.js";
import { HOTEL_ORDER, hotelGroup, hotelShort, hotelVar, LEAVE_BUFFER_MIN, walkMin, WALK } from "../../src/venues.js";
import { gapHTML } from "../../src/leave.js";
import { settings } from "../../src/state.js";

/* Hoisted with the mocks, which run before anything else in this file. */
const { committed } = vi.hoisted(() => ({
  committed: async name => {
    const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath } = await import("node:url");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    return JSON.parse(fs.readFileSync(path.join(root, "data", "2027", name), "utf8"));
  },
}));
vi.mock("virtual:season", async () => ({ default: await committed("season.json") }));
vi.mock("virtual:venues", async () => {
  const v = await committed("venues.json");
  v.hotels = v.hotels.map(h => h.hotel === "Hyatt" ? { ...h, order: 0, short: "Regency", group: "Towers", var: "Blue" }
    : h.hotel === "Marriott" ? { ...h, order: 1 } : h);
  v.walk = { ...v.walk, "Marriott|Hyatt": 30 };
  Object.assign(v, { same_venue_min: 7, unknown_pair_min: 20, slack_min: 25 });
  return { default: v };
});

describe("another year's season file", () => {
  it("gives the con its days, Wednesday 1 to Monday 6 September 2027, each by its name", () => {
    expect(CON_DAYS).toEqual(["2027-09-01", "2027-09-02", "2027-09-03", "2027-09-04", "2027-09-05", "2027-09-06"]);
    expect(Object.values(DAY_LONG)).toEqual(["Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"]);
    expect(Object.values(DAY_LABEL)).toEqual(["Wed", "Thu", "Fri", "Sat", "Sun", "Mon"]);
  });
  it("bounds it from 18:00 on its first day to 19:00 on its last", () => {
    expect(CON.start.getTime()).toBe(new Date("2027-09-01T18:00").getTime());
    expect(CON.end.getTime()).toBe(new Date("2027-09-06T19:00").getTime());
    expect(conPhase(new Date("2027-09-01T17:59"))).toBe("before");
    expect(conPhase(new Date("2027-09-06T19:01"))).toBe("ended");
  });
  it("previews its Thursday, the second day, before the con", () => {
    expect(FIRST_FULL_DAY).toBe("2027-09-02");
    setOverride("2027-08-01T12:00");
    const preview = effectiveNow();
    setOverride(null);
    expect(preview.now.getTime()).toBe(new Date("2027-09-02T10:00").getTime());
    expect(preview.banner).toMatch(/Con starts Thursday\.<\/b> Showing Thursday 10:00 AM/);
  });
  it("reads a day word as that year's day", () => {
    expect(parseQuery("wed").filters.day).toBe("2027-09-01");
    expect(parseQuery("trek saturday").filters.day).toBe("2027-09-04");
    expect(parseQuery("monday").filters.day).toBe("2027-09-06");
  });
});

describe("a venues file of other values", () => {
  it("orders the hotels by the file, and names, groups and colours them as it does", () => {
    expect(HOTEL_ORDER.slice(0, 2)).toEqual(["Hyatt", "Marriott"]);
    expect([hotelShort("Hyatt"), hotelGroup("Hyatt"), hotelVar("Hyatt")]).toEqual(["Regency", "Towers", "--h-Blue"]);
  });
  it("walks by the file's walk and its two minute values", () => {
    expect(WALK["Marriott|Hyatt"]).toBe(30);
    expect(walkMin("Hyatt", "Marriott")).toBe(Math.round(30 * settings.crowd));
    expect(walkMin("Hilton", "Hilton")).toBe(Math.round(7 * settings.crowd));
    expect(walkMin("Hyatt", "Other")).toBe(Math.round(20 * settings.crowd));
  });
  it("takes the slack from the file, and the tight band with it", () => {
    expect(LEAVE_BUFFER_MIN).toBe(25);
    const walk = walkMin("Marriott", "Hyatt");
    const prev = { hotel: "Marriott", _s: new Date("2027-09-04T13:00"), _e: new Date("2027-09-04T14:00"), _cd: "2027-09-04" };
    const after = gap => { const _s = new Date(prev._e.getTime() + gap * 60000); return { hotel: "Hyatt", _s, _e: new Date(_s.getTime() + 3600000), _cd: "2027-09-04" }; };
    expect(gapHTML(prev, after(walk + 24))).toMatch(/Tight but doable/);
    expect(gapHTML(prev, after(walk + 25))).toBe("");
  });
});
