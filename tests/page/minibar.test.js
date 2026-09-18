/* The sticky next-up mini-bar. The number in brackets is the harness line the
   assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("the mini-bar", () => {
  let page, app, handle, state, at, today, bar;
  const tab = name => document.querySelector(`.nav button[data-tab="${name}"]`).click();
  const setPicks = ids => { handle.picks.set(ids); handle.render(); };

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now(); today = app.conDayKey(at);
    bar = document.getElementById("minibar");
    /* the harness arrived here with one pick: the first event still to end */
    setPicks([handle.events.filter(e => e._e > at)[0].id]);
  }, 30000);
  afterAll(() => page.cleanup());

  describe("step 3: sticky next-up mini-bar", () => {
    let later;

    it("mini-bar element exists [223]", () => {
      expect(bar).toBeTruthy();
    });
    it("mini-bar is hidden on the Now tab [224]", () => {
      expect(bar.hidden).toBe(true);
    });
    it("found a pick later in the same con day [232]", () => {
      later = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && e.hotel !== "Streaming");
      expect(later).toBeTruthy();
      setPicks([...handle.picks.get(), later.id]);
    });
    it("mini-bar shows on Browse when a pick remains today [234]", () => {
      tab("browse");
      expect(bar.hidden).toBe(false);
    });
    it("mini-bar names the next pick [235]", () => {
      expect(bar.querySelector(".mb-title").textContent.trim()).toBe(later.title);
    });
    it("mini-bar room uses the hotel hue [236]", () => {
      expect(bar.querySelector(".mb-room").getAttribute("style") || "").toMatch(/var\(--h-/);
    });
    it("mini-bar says leave-by only while a pick is on [238]", () => {
      const on = handle.events.some(e => handle.picks.get().has(e.id) && e._s <= at && at < e._e && e.hotel !== "Streaming");
      expect(bar.querySelector(".mb-when").textContent.trim()).toMatch(on ? /^leave (by|now)/ : /^in \d+ (min|h)/);
    });
    /* read from the stylesheet the helper injects, as the harness read it from the built page's */
    it("mini-bar is 48px tall [239]", () => {
      expect(window.getComputedStyle(bar).height).toBe("48px");
    });
    it("body reserves room for the bar [240]", () => {
      expect(document.body.classList.contains("has-minibar")).toBe(true);
    });
    it("tapping the mini-bar switches to Now [243]", () => {
      bar.click();
      expect(state.tab).toBe("now");
    });
    it("mini-bar hides again once Now is active [244]", () => {
      expect(bar.hidden).toBe(true);
    });
    it("mini-bar stays hidden with no picks left today [253]", () => {
      setPicks([]);
      tab("browse");
      expect(bar.hidden).toBe(true);
    });
  });

  it("the mini-bar says hours for a pick more than three hours out [857]", () => {
    const far = handle.events.find(e => e._s > new Date(at.getTime() + 3 * 3600000) && app.conDayKey(e._s) === today && e.hotel !== "Streaming");
    state.tab = "browse";
    setPicks([far.id]);
    expect(bar.textContent.replace(/\s+/g, " ")).toMatch(/ in \d+ h/);
    setPicks([]);
  });

  /* The harness looked for `nextPickInConDay` in the source and for the word
     "follows" in renderMiniBar's. What that guards is observable. */
  it("the mini-bar reads picks, not follows: a followed track with events later today, and no picks, shows no bar [1241, and 1242]", () => {
    const later = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && (e.tracks || []).length);
    handle.follows.set([{ kind: "track", key: later.tracks[0] }]);
    state.tab = "browse";
    setPicks([]);
    expect(bar.hidden).toBe(true);
    setPicks([later.id]);
    expect(bar.hidden).toBe(false);
    handle.follows.set([]);
    setPicks([]);
  });

  describe("polish 3: no mini-bar on the Map tab", () => {
    let seen;
    beforeAll(() => {
      const later = handle.events.find(e => e._s > at && app.conDayKey(e._s) === today && app.MAP_HOTELS[e.hotel]);
      handle.picks.set([later.id]);
      const read = name => { state.tab = name; handle.render(); return { hidden: bar.hidden, reserved: document.body.classList.contains("has-minibar") }; };
      seen = { browse: read("browse"), map: read("map"), explore: read("explore"), mine: read("mine"), now: read("now"), back: read("map") };
    });
    afterAll(() => setPicks([]));

    it("with a pick later today the mini-bar shows on Search, Explore and Mine [1658]", () => {
      expect(seen.browse).toEqual({ hidden: false, reserved: true });
      expect(seen.explore.hidden).toBe(false);
      expect(seen.mine.hidden).toBe(false);
    });
    it("but not on the Map, whose caption already says what is next, and the body reserves no room for it there [1659]", () => {
      expect(seen.map).toEqual({ hidden: true, reserved: false });
      expect(seen.back).toEqual({ hidden: true, reserved: false });
    });
    it("nor on Now, as before [1660]", () => {
      expect(seen.now.hidden).toBe(true);
    });
  });
});
