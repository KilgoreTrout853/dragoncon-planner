/* One clock: now(), the ?now= override, the con day and the phase of the con,
   on a booted page. The number in brackets is the harness line the assertion
   came from (tests/PORT-LEDGER.md). One boot, tests in file order: each block
   leaves the clock on Saturday 1:05 PM for the next, as the harness did. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";

const SATURDAY = "2026-09-05T13:05";
const BROWSE_DEFAULTS = { q: "", day: null, prevDay: null, hotel: "All", type: "All", track: "All", work: "All",
  kind: "All", showHidden: false, showPast: false, noToday: false, hideNoise: true, page: 1 };

describe("a page booted from ?now=", () => {
  let page, app, handle, state, text;

  beforeAll(async () => {
    page = await bootPage({ now: SATURDAY });
    ({ app, handle, text } = page);
    state = handle.state;
    await page.until(() => app.BOOT.suggested > 0, 20000, "the search index");     // 671 searches by title
  }, 30000);
  afterAll(() => page.cleanup());

  describe("one definition of day: the con day, which runs to 5 AM, everywhere", () => {
    let late;

    beforeAll(() => {
      handle.setTimeOverride("2026-09-06T01:00");
      Object.assign(state.browse, BROWSE_DEFAULTS);         // earlier tests may leave chips set
      state.tab = "browse";
      handle.render();
      /* not a photo session or a screening: the default noise filter would hide it */
      late = handle.events.find(e => e.day === "2026-09-06" && e._s.getHours() < 5 && !app.isNoise(e));
    });
    afterAll(() => {
      handle.picks.set([]);
      handle.setTimeOverride(SATURDAY);
      state.tab = "now"; state.browse.day = null;
      handle.render();
    });

    it("at 1 AM Sunday, Search opens on the Saturday chip [669]", () => {
      expect(state.browse.day).toBe("2026-09-05");
    });
    it("a small-hours Sunday event is under Sat, not Sun [670]", () => {
      expect(late).toBeTruthy();
      state.browse.day = "2026-09-05"; app.renderBrowse();
      expect(app.browseResults().some(e => e.id === late.id)).toBe(true);
      state.browse.day = "2026-09-06"; app.renderBrowse();
      expect(app.browseResults().some(e => e.id === late.id)).toBe(false);
    });
    it("and its row is labelled Sat [671]", () => {
      state.browse.q = late.title; state.browse.day = "All"; app.renderBrowse();
      const row = document.querySelector(`#view-browse .row[data-id="${late.id}"]`);
      expect(row && row.querySelector(".t .day").textContent).toBe("Sat");
      state.browse.q = "";
    });
    it("Mine's list and timeline file it under the same day [672]", () => {
      handle.picks.set([late.id]);
      state.mineView = "list"; state.tab = "mine"; handle.render();
      expect(document.querySelector("#view-mine .day-head").textContent.trim()).toMatch(/^Saturday/);
      state.mineView = "timeline"; handle.render();
      expect(document.querySelector("#view-mine .tl-day .day-head").textContent.trim()).toMatch(/^Saturday/);
    });
    it("the sheet keeps the date and names the night [674]", () => {
      handle.openSheet("event", late.id);
      const when = document.querySelector("#panel-event .ev-when").textContent.replace(/\s+/g, " ").trim();
      handle.closeSheet();
      expect(when).toMatch(/^Sunday, /);
      expect(when).toMatch(/Saturday night/);
    });
  });

  it("the clock is back on Saturday afternoon [677]", () => {
    expect(state.browse.day === null || app.conDayKey(handle.now()) === "2026-09-05").toBe(true);
  });

  describe("the ?now= override", () => {
    it("booted from ?now=, the clock is simulated and the chip shows [1883]", () => {
      expect(app.isSimulated()).toBe(true);
      expect(document.getElementById("simChip").hidden).toBe(false);
    });
    it("the override is kept for the session [1884]", () => {
      expect(window.sessionStorage.getItem("dc26.timeOverride")).toBe(SATURDAY);
    });
    it("the clock reads the simulated time, with no suffix [1885]", () => {
      expect(text("clock")).toMatch(/^Sat 1:05 PM/);
      expect(text("clock")).not.toMatch(/preview/);
    });

    it("an offset in the override is honoured [1897]", () => {
      handle.setTimeOverride("2026-09-05T14:15:00-04:00");
      expect(handle.now().getTime()).toBe(new Date("2026-09-05T14:15:00-04:00").getTime());
    });
    it("the URL is kept in step and stays readable [1898]", () => {
      expect(window.location.search).toBe("?now=2026-09-05T14:15:00-04:00");
    });
    it("and so is the session [1899]", () => {
      expect(window.sessionStorage.getItem("dc26.timeOverride")).toBe("2026-09-05T14:15:00-04:00");
    });

    it("clearing goes back to the wall clock, hides the chip, and cleans the URL and the session [1903]", () => {
      handle.setTimeOverride(null);
      expect(app.isSimulated()).toBe(false);
      expect(document.getElementById("simChip").hidden).toBe(true);
      expect(window.location.search).toBe("");
      expect(window.sessionStorage.getItem("dc26.timeOverride")).toBe(null);
    });
    it("now() is the wall clock again [1905]", () => {
      expect(Math.abs(handle.now().getTime() - Date.now())).toBeLessThan(5000);
    });
    it("and back to Saturday, chip and all [1907]", () => {
      handle.setTimeOverride(SATURDAY);
      expect(text("clock")).toMatch(/^Sat 1:05 PM/);
      expect(document.getElementById("simChip").hidden).toBe(false);
    });
    it("tapping the chip clears the override [1909]", () => {
      document.getElementById("simChip").click();
      expect(app.isSimulated()).toBe(false);
    });

    it("the Settings field shows the override [1912]", () => {
      handle.setTimeOverride(SATURDAY);
      handle.openSheet("settings");
      expect(document.getElementById("previewTime").value).toBe(SATURDAY);
    });
    it("Apply preview time sets the override [1915]", () => {
      document.getElementById("previewTime").value = "2026-09-06T09:30";
      document.getElementById("applyPreview").click();
      expect(text("clock")).toMatch(/^Sun 9:30 AM/);
      expect(window.location.search).toBe("?now=2026-09-06T09:30");
    });
    it("Use real time clears it [1918]", () => {
      handle.openSheet("settings");
      document.getElementById("clearPreview").click();
      expect(app.isSimulated()).toBe(false);
      handle.setTimeOverride(SATURDAY);
    });
  });

  /* The harness matched `dragT = performance.now()` and `spyHoldUntil =
     performance.now()` in the source. What those lines are for is observable:
     under ?now= the clock stands still, and a stopwatch must not. */
  describe("elapsed time is a stopwatch, not the clock [1894]", () => {
    const touch = (el, type, y) => el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { touches: y === undefined ? [] : [{ clientX: 0, clientY: y }] }));
    const drag = (ms) => {
      const sheet = document.getElementById("sheet");
      handle.openSheet("event", handle.events[0].id);
      touch(sheet, "touchstart", 100);
      touch(sheet, "touchmove", 150);                     // 50 px: short of the 70 px that closes on distance alone
      vi.advanceTimersByTime(ms);
      touch(sheet, "touchend");
      vi.advanceTimersByTime(400);                        // settle()'s own fallback; jsdom fires no transitionend
      return document.getElementById("sheetWrap").hidden;
    };

    describe("the sheet's flick", () => {
      beforeAll(() => vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout"] }));
      afterAll(() => { handle.closeSheet(); vi.useRealTimers(); });

      it("the clock is frozen while the stopwatch runs", () => {
        expect(app.isSimulated()).toBe(true);
        const before = handle.now().getTime(), started = performance.now();
        vi.advanceTimersByTime(60000);
        expect(handle.now().getTime()).toBe(before);
        expect(performance.now() - started).toBe(60000);
      });
      it("a fast flick still closes the sheet: 50 px in 40 ms has a velocity only a moving stopwatch can give", () => {
        expect(drag(40)).toBe(true);
      });
      it("and the same 50 px over 400 ms does not", () => {
        expect(drag(400)).toBe(false);
      });
    });

    it("scroll events inside 700 ms of a jump-chip tap do not move the pressed chip; after it, they do", () => {
      state.tab = "explore"; state.explore.page = null; state.explore.q = ""; handle.render();
      const chips = [...document.querySelectorAll('#view-explore [data-act="explore-jump"]')];
      const pressed = () => chips.filter(c => c.getAttribute("aria-pressed") === "true").map(c => c.dataset.section).join(",");
      const scroll = () => { document.querySelector("main").dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(20); };   // the spy runs in the next frame
      expect(chips.length).toBeGreaterThan(1);
      const first = chips[0].dataset.section, last = chips[chips.length - 1].dataset.section;

      vi.useFakeTimers({ toFake: ["performance", "requestAnimationFrame", "cancelAnimationFrame"] });
      try {
        chips[0].click();
        expect(pressed()).toBe(first);
        scroll();
        expect(pressed()).toBe(first);                     // held
        vi.advanceTimersByTime(800);
        scroll();
        /* with no layout every header is "past the line", so the spy settles on the last section */
        expect(pressed()).toBe(last);
      } finally {
        vi.useRealTimers();
        state.tab = "now"; handle.render();
      }
    });
  });

  describe("the phase of the con, read from the clock", () => {
    it("with no argument it reads now() [1926]", () => {
      expect(app.conPhase()).toBe("live");
      expect(app.conEnded()).toBe(false);
    });
    it("before the con, the Thursday preview banner as before [1928]", () => {
      handle.setTimeOverride("2026-08-01T12:00");
      state.tab = "now"; handle.render();
      expect(document.getElementById("notice").hidden).toBe(false);
      expect(text("notice")).toMatch(/Con starts Thursday/);
    });
    it("and the Now tab previews Thursday morning [1929]", () => {
      expect(document.getElementById("view-now").textContent).toMatch(/next hour/);
      handle.setTimeOverride(SATURDAY);
    });
  });
});

/* The harness stripped ?now= from the URL and called initTimeOverride() a
   second time. The situation that function exists for is a reload in the
   same tab: no ?now=, and the override waiting in sessionStorage. */
describe("a page booted with no ?now=, in a session that has an override", () => {
  let page;

  beforeAll(async () => {
    window.sessionStorage.setItem("dc26.timeOverride", "2026-09-05T14:15:00-04:00");
    page = await bootPage({ now: null });
  }, 30000);
  afterAll(() => page.cleanup());

  it("with the URL stripped, the session's override carries on [1901]", () => {
    expect(window.location.search).toBe("");
    expect(page.app.isSimulated()).toBe(true);
    expect(page.handle.now().getTime()).toBe(new Date("2026-09-05T14:15:00-04:00").getTime());
  });
});
