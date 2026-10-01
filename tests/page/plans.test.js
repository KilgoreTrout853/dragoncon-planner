/* Plans: the control strip, the timeline, the list, Remove all. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("Plans", () => {
  let page, app, handle, state, at, first;
  const plans = () => document.getElementById("view-plans");
  const picked = () => handle.events.filter(e => handle.picks.get().has(e.id));

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now();
    /* the harness arrived here with one pick: the first event still to end */
    first = handle.events.filter(e => e._e > at)[0];
    handle.picks.set([first.id]);
    document.querySelector('.nav button[data-tab="plans"]').click();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the control strip: the actions on two columns, the toggle under them", () => {
    it("five controls in order [433]", () => {
      const strip = [...plans().querySelectorAll(".plans-actions .btn, .view-toggle button")].map(b => b.textContent.trim());
      expect(strip.join(" | ")).toBe("Export to calendar | Share a day | Remove all | Timeline | List");
    });
    it("actions above the view toggle [434]", () => {
      const order = plans().querySelector(".plans-actions").compareDocumentPosition(plans().querySelector(".view-toggle"));
      expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it("with picks, both actions are live [446]", () => {
      expect(plans().querySelectorAll(".plans-actions .btn[disabled]")).toHaveLength(0);
    });
  });

  describe("step 5: timeline is the default view on Plans", () => {
    it("Plans defaults to the timeline [449]", () => {
      expect(state.mineView).toBe("timeline");
    });
    it("timeline grid renders [450]", () => {
      expect(plans().querySelector(".tl-grid")).toBeTruthy();
    });
    it("timeline draws a block per pick [451]", () => {
      expect(plans().querySelectorAll(".tl-block")).toHaveLength(picked().length);
    });
    it("hour ruler renders [452]", () => {
      expect(plans().querySelectorAll(".tl-hour").length).toBeGreaterThanOrEqual(2);
    });
    it("block height tracks duration at 60px/hour [459]", () => {
      const minutes = picked().sort((a, b) => a._s - b._s).map(e => Math.round((e._e - e._s) / 60000));
      const heights = [...plans().querySelectorAll(".tl-block")].map(b => parseFloat(b.style.height));
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((h, i) => expect(Math.abs(h - (minutes[i] - 2)) < 1.5 || h === 24).toBe(true));
    });
    it("long blocks flagged for fading [467]", () => {
      const longs = picked().filter(e => (e._e - e._s) / 60000 >= 152).length;
      expect(plans().querySelectorAll(".tl-block.long")).toHaveLength(longs);
    });
    it.skip("a long block says when it runs to: the sample fixture never gives this test a pick of 152 minutes or more, so no .tl-block.long exists to read [470]", () => {});
    it("tapping a timeline block opens the event sheet [473]", () => {
      plans().querySelector(".tl-block").click();
      expect(document.getElementById("sheetWrap").hidden).toBe(false);
      expect(document.getElementById("panel-event").hidden).toBe(false);
      document.getElementById("sheetBack").click();
    });

    describe("overlapping picks become side-by-side columns", () => {
      let pair;
      beforeAll(() => {
        const over = handle.events.find(e => !handle.picks.get().has(e.id) && e._s < first._e && e._e > first._s && e.id !== first.id);
        handle.picks.set([first.id, over.id]); handle.render();
        const laid = app.layoutColumns(picked().filter(e => app.conDayKey(e._s) === app.conDayKey(first._s)));
        pair = laid.filter(i => i.ev.id === first.id || i.ev.id === over.id);
        handle.picks.set([first.id]); handle.render();
      });

      it("overlapping picks widen the cluster to two columns or more [489]", () => {
        expect(Math.max(...pair.map(i => i.cols))).toBeGreaterThanOrEqual(2);
      });
      it("overlapping picks land in different columns [490]", () => {
        expect(new Set(pair.map(i => i.col)).size).toBeGreaterThanOrEqual(2);
      });
    });

    /* The quieter Now's stream rule at its third site (DECISIONS #40): no
       walk, no band, no link. A new test, not a ledger row. */
    it("a stream has no walk, so no walk link runs to or from it; two picks in two hotels keep theirs", () => {
      const sat = handle.events.filter(e => e._cd === "2026-09-05" && !e.cancelled), placed = e => !!app.MAP_HOTELS[e.hotel];
      const stream = sat.find(s => s.hotel === "Streaming" && sat.some(e => placed(e) && e._e <= s._s));
      const before = sat.filter(e => placed(e) && e._e <= stream._s).pop();
      const after = sat.find(e => placed(e) && e._s >= stream._e && e.hotel !== before.hotel);
      const links = () => [...plans().querySelectorAll(".tl-link span")].map(s => s.textContent.trim());
      handle.picks.set([before.id, after.id]); handle.render();
      expect(links()).toEqual([`${app.walkMin(before.hotel, after.hotel)} min`]);
      handle.picks.set([before.id, stream.id, after.id]); handle.render();
      expect(links()).toEqual([]);
      handle.picks.set([first.id]); handle.render();
    });

    /* The harness matched fitTimelineBlocks' source. What it does is
       measurable once a block reports a height: jsdom never does, so give it
       one. */
    describe("blocks that cannot hold their text give way by measurement [1729, the page half]", () => {
      let fitsOnceTight;
      const describeProp = name => Object.getOwnPropertyDescriptor(Element.prototype, name);
      const had = { scrollHeight: describeProp("scrollHeight"), clientHeight: describeProp("clientHeight") };
      beforeAll(() => {
        Object.defineProperty(Element.prototype, "clientHeight", { configurable: true, get() { return this.classList.contains("tl-block") ? 40 : 0; } });
        Object.defineProperty(Element.prototype, "scrollHeight", { configurable: true,
          get() { return !this.classList.contains("tl-block") ? 0 : this.classList.contains("tight") && fitsOnceTight ? 40 : 100; } });
      });
      afterAll(() => {
        Object.defineProperty(Element.prototype, "scrollHeight", had.scrollHeight);
        Object.defineProperty(Element.prototype, "clientHeight", had.clientHeight);
        handle.render();
      });

      it("a block whose text overflows takes the one-line title first", () => {
        fitsOnceTight = true; handle.render();
        const block = plans().querySelector(".tl-block");
        expect(block.classList.contains("tight")).toBe(true);
        expect(block.classList.contains("tighter")).toBe(false);
      });
      it("and drops the room when that is still not enough", () => {
        fitsOnceTight = false; handle.render();
        const block = plans().querySelector(".tl-block");
        expect(block.classList.contains("tight")).toBe(true);
        expect(block.classList.contains("tighter")).toBe(true);
      });
    });
  });

  describe("the list view", () => {
    it("toggle switches to the list view [496]", () => {
      plans().querySelector('[data-act="view-list"]').click();
      expect(state.mineView).toBe("list");
    });
    it("view choice persists [497]", () => {
      expect(JSON.parse(window.localStorage.getItem("dc26.mineView"))).toBe("list");
    });
    it("Plans lists picks [498]", () => {
      expect(plans().querySelectorAll(".row")).toHaveLength(picked().length);
    });
    it.skip("walk warning shown for tight transfer: the sample fixture has no event starting within five minutes of the first pick's end in another hotel, so no tight pair is starred [499]", () => {});
  });

  describe("Remove all", () => {
    beforeAll(() => plans().querySelector('[data-act="clear"]').click());      // the helper answers the confirm

    it("clear all works [509]", () => {
      expect(plans().textContent).toContain("Nothing picked yet");
    });
    it("with nothing picked, the three actions are disabled [510]", () => {
      expect(plans().querySelectorAll(".plans-actions .btn[disabled]")).toHaveLength(3);
    });
    it("and there is no view toggle to switch [511]", () => {
      expect(plans().querySelector(".view-toggle")).toBe(null);
    });
  });
});
