/* The notice above the views, by the phase of the con (DECISIONS #99;
   docs/screens/contract.md, section 2). Before the con the preview banner
   stands on Now alone - it is about what Now shows - and Search, Explore,
   the Map and Plans carry none; during the con there is none; after it the
   has-ended notice is on every tab, as built, until its OK. One boot, the
   clock moved between the three. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const BEFORE = "2026-08-20T10:00", SATURDAY = "2026-09-05T13:05", AFTER = "2026-09-20T12:00";
const TABS = ["now", "browse", "explore", "map", "plans"], OTHERS = TABS.filter(tab => tab !== "now");
const BANNER = "Preview. This tab is showing Thursday 10:00 AM, the con's first full day. Settings can preview any other time.";
const el = id => document.getElementById(id);
const tap = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
const said = () => (el("notice").hidden ? null : el("notice").textContent.replace(/\s+/g, " ").trim());

describe("the notice above the views", () => {
  let page, app, handle;

  beforeAll(async () => {
    page = await bootPage({ now: BEFORE });
    ({ app, handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  describe("before the con", () => {
    it("the page opens on Explore, with no banner", () => {
      expect(handle.state.tab).toBe("explore");
      expect(said()).toBe(null);
      expect(el("notice").innerHTML).toBe("");
    });
    it("on Now the banner stands, in these words, its first word in bold - and it does not say when the con starts: its first evening has events", () => {
      tap("now");
      expect(said()).toBe(BANNER);
      expect([...el("notice").querySelectorAll("b")].map(b => b.textContent)).toEqual(["Preview."]);
      expect(said()).not.toMatch(/starts/i);
      expect(el("notice").className).toBe("notice");
      expect(el("notice").querySelectorAll("button").length).toBe(0);
    });
    it("and Now shows what it says: the preview of Thursday morning", () => {
      expect(el("view-now").textContent).toMatch(/next hour/);
      expect(app.effectiveNow().now.getTime()).toBe(new Date("2026-09-03T10:00").getTime());
    });
    for (const tab of OTHERS) {
      it(`${tab} carries none, and Now has it again`, () => {
        tap(tab);
        expect(said(), tab).toBe(null);
        expect(el("notice").innerHTML, tab).toBe("");
        tap("now");
        expect(said()).toBe(BANNER);
      });
    }
    it("the minute's tick leaves it as it is: standing on Now, away on the Map", () => {
      tap("now");
      app.onMinute();
      expect(said()).toBe(BANNER);
      tap("map");
      app.onMinute();
      expect(said()).toBe(null);
    });
    it("a draw of any other kind decides by the tab too: a star, a sheet closed", () => {
      tap("browse");
      handle.picks.set([handle.events[0].id]);
      handle.render();
      expect(said()).toBe(null);
      handle.openSheet("settings");
      handle.closeSheet();
      expect(said()).toBe(null);
      handle.picks.set([]);
      tap("now");
      expect(said()).toBe(BANNER);
    });
  });

  describe("during the con", () => {
    beforeAll(() => handle.setTimeOverride(SATURDAY));

    for (const tab of TABS) {
      it(`${tab} carries none`, () => {
        tap(tab);
        expect(said(), tab).toBe(null);
      });
    }
  });

  describe("after the con, as built", () => {
    beforeAll(() => handle.setTimeOverride(AFTER));

    for (const tab of TABS) {
      it(`the has-ended notice stands on ${tab}, with its OK`, () => {
        tap(tab);
        expect(said(), tab).toMatch(/^Dragon Con 2026 has ended\. Your starred events are on the Now tab as your 2026 schedule\. OK$/);
        expect(el("notice").className).toBe("notice archive");
        expect(el("notice").querySelectorAll('button[data-act="dismiss-archive"]').length).toBe(1);
      });
    }
  });
});
