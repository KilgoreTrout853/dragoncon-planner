/* The year the client is built for (DECISIONS #49): the con's days and
   bounds are the season file's, the hotels, the walk and the slack are the
   venues file's, and what the app keeps is keyed by the year. The files are
   read here as the build resolves them, data/<year>/, for the year under
   test; tests/unit/year-files.test.js hands the client files of other values.
   New tests, not rows of tests/PORT-LEDGER.md, so their titles carry no
   harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const noon = day => new Date(`${day}T12:00`);

/* What src/venues.js held as constants until the client read the file. The
   file is the truth now; these are here so the move is seen to change
   nothing for the year under test. */
const BEFORE = {
  walk: {
    "Marriott|Hyatt": 8, "Marriott|Hilton": 7, "Hyatt|Hilton": 12,
    "Marriott|Courtland Grand": 10, "Hilton|Courtland Grand": 8, "Hyatt|Courtland Grand": 15,
    "Westin|Hyatt": 8, "Westin|Marriott": 12, "Westin|Hilton": 15, "Westin|Courtland Grand": 18,
    "AmericasMart|Hyatt": 7, "AmericasMart|Marriott": 12, "AmericasMart|Westin": 8, "AmericasMart|Hilton": 15, "AmericasMart|Courtland Grand": 18,
    "Hardy Ivy Park|Marriott": 5, "Hardy Ivy Park|Hilton": 4, "Hardy Ivy Park|Hyatt": 10, "Hardy Ivy Park|Courtland Grand": 8, "Hardy Ivy Park|Westin": 12, "Hardy Ivy Park|AmericasMart": 12,
  },
  sameVenue: 5, unknownPair: 12, slack: 10,
};

describe("the year under test", () => {
  let page, app, handle, season, venues;
  const file = name => JSON.parse(fs.readFileSync(path.join(ROOT, "data", String(app.YEAR), name), "utf8"));

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    season = file("season.json");
    venues = file("venues.json");
  }, 30000);
  afterAll(() => page.cleanup());

  describe("what the app keeps is keyed by the year", () => {
    it("the build's year is the season file's, and the keys carry its last two digits", () => {
      expect(app.YEAR).toBe(season.year);
      expect(app.YY).toBe(String(season.year).slice(2));
      expect(app.CON.year).toBe(season.year);
    });
    it("a starred event is saved under dc<YY>.picks, and its snapshot under dc<YY>.pickInfo", () => {
      const star = document.querySelector("#view-now .row .star"), id = star.closest(".row").dataset.id;
      star.click();
      expect(JSON.parse(window.localStorage.getItem(`dc${app.YY}.picks`))).toEqual([id]);
      expect(Object.keys(JSON.parse(window.localStorage.getItem(`dc${app.YY}.pickInfo`)))).toEqual([id]);
    });
    it("a follow is saved under dc<YY>.follows", () => {
      handle.follows.set([{ kind: "track", key: "Science" }]);
      expect(JSON.parse(window.localStorage.getItem(`dc${app.YY}.follows`))).toEqual([{ kind: "track", key: "Science" }]);
    });
    it("the simulated clock is kept under dc<YY>.timeOverride for the session", () => {
      expect(app.TIME_OVERRIDE_KEY).toBe(`dc${app.YY}.timeOverride`);
      expect(window.sessionStorage.getItem(app.TIME_OVERRIDE_KEY)).not.toBe(null);
    });
    it("and nothing is kept under any other key", () => {
      expect(Object.keys(window.localStorage).filter(k => !k.startsWith(`dc${app.YY}.`))).toEqual([]);
      expect(Object.keys(window.sessionStorage).filter(k => !k.startsWith(`dc${app.YY}.`))).toEqual([]);
    });
    it("and, unstamped, none carries a channel: every key is storageKey()'s, dc<YY>. and a name", () => {
      expect(app.storageKey("picks")).toBe(`dc${app.YY}.picks`);
      const plain = new RegExp(`^dc${app.YY}\\.[A-Za-z]+$`);
      const keys = [...Object.keys(window.localStorage), ...Object.keys(window.sessionStorage)];
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.filter(k => !plain.test(k))).toEqual([]);
    });
  });

  describe("CON is the season file's", () => {
    it("its days run from con.first to con.last, one a day", () => {
      expect(app.CON_DAYS[0]).toBe(season.con.first);
      expect(app.CON_DAYS.at(-1)).toBe(season.con.last);
      app.CON_DAYS.slice(1).forEach((day, i) => {
        const next = noon(app.CON_DAYS[i]);
        next.setDate(next.getDate() + 1);
        expect(app.dayOf(next)).toBe(day);
      });
    });
    it("each day is named by its weekday, and labelled by the name's first three letters", () => {
      expect(Object.keys(app.DAY_LONG)).toEqual(app.CON_DAYS);
      for (const day of app.CON_DAYS) {
        expect(app.DAY_LONG[day], day).toBe(WEEKDAYS[noon(day).getDay()]);
        expect(app.DAY_LABEL[day], day).toBe(app.DAY_LONG[day].slice(0, 3));
      }
    });
    it("it runs from 18:00 on its first day to 19:00 on its last, 2026's observed bounds", () => {
      expect(app.CON.start.getTime()).toBe(new Date(`${season.con.first}T18:00`).getTime());
      expect(app.CON.end.getTime()).toBe(new Date(`${season.con.last}T19:00`).getTime());
    });
    it("its first full day, which the preview and the default day open on, is the second, a Thursday", () => {
      expect(app.FIRST_FULL_DAY).toBe(app.CON_DAYS[1]);
      expect(app.DAY_LONG[app.FIRST_FULL_DAY]).toBe("Thursday");
    });
  });

  describe("the hotels and the walk are the venues file's", () => {
    it("the hotels in the file's order, each with its short name, group and colour", () => {
      const hotels = [...venues.hotels].sort((a, b) => a.order - b.order);
      expect(app.HOTEL_ORDER).toEqual(hotels.map(h => h.hotel));
      for (const h of hotels) {
        expect(app.hotelShort(h.hotel), h.hotel).toBe(h.short);
        expect(app.hotelGroup(h.hotel), h.hotel).toBe(h.group);
        expect(app.hotelVar(h.hotel), h.hotel).toBe(`--h-${h.var}`);
      }
    });
    it("every pair of the walk, either way round, at the crowd factor", () => {
      const crowd = app.settings.crowd;
      for (const [pair, minutes] of Object.entries(venues.walk)) {
        const [a, b] = pair.split("|");
        expect(app.walkMin(a, b), pair).toBe(Math.round(minutes * crowd));
        expect(app.walkMin(b, a), pair).toBe(Math.round(minutes * crowd));
      }
    });
    it("the same venue, a pair the walk lacks and a stream, each by its own rule", () => {
      const crowd = app.settings.crowd;
      expect(app.walkMin("Hilton", "Hilton")).toBe(Math.round(venues.same_venue_min * crowd));
      expect(venues.walk["Hyatt|Other"] ?? venues.walk["Other|Hyatt"]).toBeUndefined();
      expect(app.walkMin("Hyatt", "Other")).toBe(Math.round(venues.unknown_pair_min * crowd));
      expect(app.walkMin("Streaming", "Hyatt")).toBe(0);
    });
    it("the values are the ones the client held before it read the file, the Settings table in the same order", () => {
      expect(app.WALK).toEqual(BEFORE.walk);
      expect(Object.keys(app.WALK)).toEqual(Object.keys(BEFORE.walk));
      expect([venues.same_venue_min, venues.unknown_pair_min, app.LEAVE_BUFFER_MIN]).toEqual([BEFORE.sameVenue, BEFORE.unknownPair, BEFORE.slack]);
    });
    it("the tight band's slack is the file's slack_min", () => {
      expect(app.LEAVE_BUFFER_MIN).toBe(venues.slack_min);
      const day = app.CON_DAYS[3], walk = app.walkMin("Marriott", "Hyatt");
      const prev = { hotel: "Marriott", _s: new Date(`${day}T13:00`), _e: new Date(`${day}T14:00`), _cd: day };
      const after = gap => { const _s = new Date(prev._e.getTime() + gap * 60000); return { hotel: "Hyatt", _s, _e: new Date(_s.getTime() + 3600000), _cd: day }; };
      expect(app.gapHTML(prev, after(walk - 1))).toMatch(/to get there/);
      expect(app.gapHTML(prev, after(walk + venues.slack_min - 1))).toMatch(/Tight but doable/);
      expect(app.gapHTML(prev, after(walk + venues.slack_min))).toBe("");
    });
  });
});
