/* Plans: the control strip, the timeline, the list, and Remove all picks,
   which is Settings' alone since DECISIONS #92. The number in brackets is
   the harness line the assertion came from (tests/PORT-LEDGER.md). */
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

  describe("the control strip: the actions on two columns, the view's switch under them", () => {
    it("four controls in order [433]", () => {
      const strip = [...plans().querySelectorAll(".plans-actions .btn, .plans-view button")].map(b => b.textContent.trim());
      expect(strip.join(" | ")).toBe("Export to calendar | Share a day | Timeline | List");
    });
    it("actions above the view toggle [434]", () => {
      const order = plans().querySelector(".plans-actions").compareDocumentPosition(plans().querySelector(".plans-view"));
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

    /* The Timeline draws no walk (DECISIONS #103): its hours, its blocks and
       the now line, and nothing between two picks - where the List still
       says the walk between their rows. A new test, not a ledger row. */
    it("the Timeline draws no walk between two picks in two hotels a tight walk apart - no link, no badge, nothing but hours, blocks and the now line - and the List's gap line between their rows still says it", () => {
      const sat = handle.events.filter(e => e._cd === "2026-09-05" && !e.cancelled && app.MAP_HOTELS[e.hotel]), said = node => node.textContent.replace(/\s+/g, " ").trim();
      let pair = null;
      for (const prev of sat) {
        const next = sat.find(e => e._s >= prev._e && e.hotel !== prev.hotel && ["cant", "tight"].includes((app.connection(prev, e) || {}).band));
        if (next) { pair = [prev, next]; break; }
      }
      const [prev, next] = pair, c = app.connection(prev, next), kinds = () => [...new Set([...plans().querySelectorAll(".tl-grid > *")].map(n => n.className.split(" ")[0]))].sort();
      handle.picks.set([prev.id, next.id]); handle.render();
      expect(state.mineView).toBe("timeline");
      expect([plans().querySelectorAll(".tl-block").length, plans().querySelectorAll(".tl-link, .gap").length, kinds().filter(k => k !== "tl-now")]).toEqual([2, 0, ["tl-block", "tl-hour"]]);
      expect([...plans().querySelectorAll(".tl-grid > :not(.tl-block)")].map(said).filter(text => /\bmin\b/.test(text))).toEqual([]);
      plans().querySelector('[data-act="view-list"]').click();
      const move = `${app.hotelShort(prev.hotel)} to ${app.hotelShort(next.hotel)}`, gap = plans().querySelector(".gap");
      expect([...plans().querySelectorAll(".gap")].map(said)).toEqual([c.band === "cant" ? `${c.gap} min to get there, ${move} is about ${c.walk} min at con pace` : `${c.gap} min gap, ${move} about ${c.walk} min. Tight but doable`]);
      expect([c.walk > 0, gap.previousElementSibling.dataset.id, gap.nextElementSibling.dataset.id]).toEqual([true, prev.id, next.id]);
      plans().querySelector('[data-act="view-timeline"]').click();
      expect([state.mineView, plans().querySelectorAll(".tl-link, .gap").length]).toEqual(["timeline", 0]);
      window.localStorage.removeItem("dc26.mineView");
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

  /* The strip's Remove all is gone (DECISIONS #92): the rows it had are
     read through Settings' Remove all picks, the one place left. */
  describe("Remove all", () => {
    const reset = () => { handle.openSheet("settings"); document.getElementById("resetPicks").click(); };

    it("the strip has none, and nothing in Plans empties the plan", () => {
      expect(plans().querySelector('[data-act="clear"]')).toBe(null);
      expect([...plans().querySelectorAll("button")].filter(b => /remove all/i.test(b.textContent))).toEqual([]);
    });
    it("Settings' Remove all picks asks first, and a no leaves every pick and the sheet as they were", () => {
      const asked = [], had = window.confirm, before = [...handle.picks.get()];
      window.confirm = words => { asked.push(words); return false; };
      try { reset(); } finally { window.confirm = had; }
      expect(asked).toEqual(["Remove everything from my schedule?"]);
      expect([...handle.picks.get()]).toEqual(before);
      expect(before.length).toBeGreaterThan(0);
      expect(document.getElementById("sheetWrap").hidden).toBe(false);
      handle.closeSheet();
    });
    it("clear all works [509]", () => {
      reset();      // the helper answers the confirm
      expect(handle.picks.get().size).toBe(0);
      expect(document.getElementById("sheetWrap").hidden).toBe(true);
      expect(plans().textContent).toContain("Nothing picked yet");
    });
    it("with nothing picked, the two actions are disabled [510]", () => {
      expect(plans().querySelectorAll(".plans-actions .btn")).toHaveLength(2);
      expect(plans().querySelectorAll(".plans-actions .btn[disabled]")).toHaveLength(2);
    });
    it("and there is no view toggle to switch [511]", () => {
      expect(plans().querySelector(".plans-view")).toBe(null);
    });
  });
});
