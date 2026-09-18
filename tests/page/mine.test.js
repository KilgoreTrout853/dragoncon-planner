/* Mine: the control strip, the timeline, the list, Remove all. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("Mine", () => {
  let page, app, handle, state, at, first;
  const mine = () => document.getElementById("view-mine");
  const picked = () => handle.events.filter(e => handle.picks.get().has(e.id));

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    at = handle.now();
    /* the harness arrived here with one pick: the first event still to end */
    first = handle.events.filter(e => e._e > at)[0];
    handle.picks.set([first.id]);
    document.querySelector('.nav button[data-tab="mine"]').click();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("the control strip: two rows of two, one footprint", () => {
    it("four controls in order [433]", () => {
      const strip = [...mine().querySelectorAll(".mine-actions .btn, .view-toggle button")].map(b => b.textContent.trim());
      expect(strip.join(" | ")).toBe("Export to calendar | Remove all | Timeline | List");
    });
    it("actions above the view toggle [434]", () => {
      const order = mine().querySelector(".mine-actions").compareDocumentPosition(mine().querySelector(".view-toggle"));
      expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it("with picks, both actions are live [446]", () => {
      expect(mine().querySelectorAll(".mine-actions .btn[disabled]")).toHaveLength(0);
    });
  });

  describe("step 5: timeline is the default view on Mine", () => {
    it("Mine defaults to the timeline [449]", () => {
      expect(state.mineView).toBe("timeline");
    });
    it("timeline grid renders [450]", () => {
      expect(mine().querySelector(".tl-grid")).toBeTruthy();
    });
    it("timeline draws a block per pick [451]", () => {
      expect(mine().querySelectorAll(".tl-block")).toHaveLength(picked().length);
    });
    it("hour ruler renders [452]", () => {
      expect(mine().querySelectorAll(".tl-hour").length).toBeGreaterThanOrEqual(2);
    });
    it("block height tracks duration at 60px/hour [459]", () => {
      const minutes = picked().sort((a, b) => a._s - b._s).map(e => Math.round((e._e - e._s) / 60000));
      const heights = [...mine().querySelectorAll(".tl-block")].map(b => parseFloat(b.style.height));
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((h, i) => expect(Math.abs(h - (minutes[i] - 2)) < 1.5 || h === 24).toBe(true));
    });
    it("long blocks flagged for fading [467]", () => {
      const longs = picked().filter(e => (e._e - e._s) / 60000 >= 152).length;
      expect(mine().querySelectorAll(".tl-block.long")).toHaveLength(longs);
    });
    it.skip("a long block says when it runs to: the sample fixture never gives this test a pick of 152 minutes or more, so no .tl-block.long exists to read [470]", () => {});
    it("tapping a timeline block opens the event sheet [473]", () => {
      mine().querySelector(".tl-block").click();
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
        const block = mine().querySelector(".tl-block");
        expect(block.classList.contains("tight")).toBe(true);
        expect(block.classList.contains("tighter")).toBe(false);
      });
      it("and drops the room when that is still not enough", () => {
        fitsOnceTight = false; handle.render();
        const block = mine().querySelector(".tl-block");
        expect(block.classList.contains("tight")).toBe(true);
        expect(block.classList.contains("tighter")).toBe(true);
      });
    });
  });

  describe("the list view", () => {
    it("toggle switches to the list view [496]", () => {
      mine().querySelector('[data-act="view-list"]').click();
      expect(state.mineView).toBe("list");
    });
    it("view choice persists [497]", () => {
      expect(JSON.parse(window.localStorage.getItem("dc26.mineView"))).toBe("list");
    });
    it("Mine lists picks [498]", () => {
      expect(mine().querySelectorAll(".row")).toHaveLength(picked().length);
    });
    it.skip("walk warning shown for tight transfer: the sample fixture has no event starting within five minutes of the first pick's end in another hotel, so no tight pair is starred [499]", () => {});
  });

  describe("Remove all", () => {
    beforeAll(() => mine().querySelector('[data-act="clear"]').click());      // the helper answers the confirm

    it("clear all works [509]", () => {
      expect(mine().textContent).toContain("Nothing picked yet");
    });
    it("with nothing picked, both actions are disabled [510]", () => {
      expect(mine().querySelectorAll(".mine-actions .btn[disabled]")).toHaveLength(2);
    });
    it("and there is no view toggle to switch [511]", () => {
      expect(mine().querySelector(".view-toggle")).toBe(null);
    });
  });
});
