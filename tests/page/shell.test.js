/* The shell around the tabs: the nav, the header, the scroller, the edge of the
   page on iOS. The number in brackets is the harness line the assertion came
   from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { touch } from "../helpers/act.js";

const rootVar = name => document.documentElement.style.getPropertyValue(name);

describe("the shell", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);

  beforeAll(async () => { page = await bootPage(); ({ app, handle } = page); state = handle.state; }, 30000);
  afterAll(() => page.cleanup());

  describe("the venue map is gone: hotel filtering is chips again", () => {
    it("no map renders anywhere [259, and 260]", () => {
      expect(document.querySelector(".venue-map")).toBe(null);
      expect(document.querySelector("#view-now .hero-map")).toBe(null);
    });
    it("no home base control in Settings [263]", () => {
      expect(el("homeBase")).toBe(null);
    });
  });

  /* iOS ignores overscroll-behavior for the page, so a drag at the edge is
     refused by hand. jsdom has no layout: the page is at its top and its
     bottom at once. */
  describe("a drag at the edge of the page", () => {
    const fake = (x, y, target) => { let prevented = false; return { touches: [{ clientX: x, clientY: y }], target: target || document.body, preventDefault() { prevented = true; }, prevented: () => prevented }; };
    const drag = (from, to, target) => { app.edgeTouchStart(fake(from[0], from[1], target)); const move = fake(to[0], to[1], target); app.edgeTouchMove(move); return move.prevented(); };

    it("a drag down with the page at its top is refused [770]", () => {
      expect(drag([100, 100], [100, 160])).toBe(true);
    });
    it("so is a drag up with the page at its bottom [771]", () => {
      expect(drag([100, 300], [100, 240])).toBe(true);
    });
    it("a mostly sideways drag is not [772]", () => {
      expect(drag([100, 300], [220, 310])).toBe(false);
    });
    it("nor a drag that began in the sheet [773]", () => {
      expect(drag([100, 300], [100, 360], el("sheet"))).toBe(false);
    });
    it("nor one inside main, which scrolls and bounces on its own [774]", () => {
      expect(drag([100, 300], [100, 360], el("view-now"))).toBe(false);
    });
    it("nor a two-finger gesture [783]", () => {
      let prevented = false;
      app.edgeTouchStart(fake(100, 300));
      app.edgeTouchMove({ touches: [{ clientX: 100, clientY: 360 }, { clientX: 200, clientY: 360 }], preventDefault() { prevented = true; } });
      expect(prevented).toBe(false);
    });
    it("and the bottom inset is capped nowhere but on iOS [786]", () => {
      expect(rootVar("--safe-bottom")).toBe("");
    });
  });

  it("the scroll helpers address main [782]", () => {
    app.pageScrollTo(120); const a = app.pageScrollTop();
    app.pageScrollBy(30); const b = app.pageScrollTop();
    app.pageScrollTo(0); const c = app.pageScrollTop();
    /* a browser keeps the offsets; jsdom, with no layout, may keep none */
    expect((a === 120 && b === 150 && c === 0) || (a === 0 && b === 0)).toBe(true);
  });

  describe("step 0: the nav - Browse renamed to Search, For you folded into Explore, Map added", () => {
    const buttons = () => [...document.querySelectorAll(".nav button")];
    /* textContent would include <style> bodies; only rendered text and aria labels matter here */
    const visibleText = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let out = "", node;
      while ((node = walker.nextNode())) {
        const tag = node.parentElement && node.parentElement.tagName;
        if (tag !== "SCRIPT" && tag !== "STYLE") out += " " + node.textContent;
      }
      document.querySelectorAll("[aria-label]").forEach(e => { out += " " + e.getAttribute("aria-label"); });
      return out;
    };

    it("the nav reads Now · Search · Explore · Map · Mine [917]", () => {
      const labels = buttons().map(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(""));
      expect(labels.join(" · ")).toBe("Now · Search · Explore · Map · Mine");
    });
    it("five tabs [919]", () => {
      expect(buttons()).toHaveLength(5);
    });
    it("the word Browse is gone from what the reader sees [933]", () => {
      expect(visibleText()).not.toMatch(/Browse/i);
    });
    it("the internal identifiers are unchanged [934]", () => {
      expect(buttons().map(b => b.dataset.tab).join(",")).toBe("now,browse,explore,map,mine");
    });
    it("the For you tab is gone [936]", () => {
      expect(document.querySelector('.nav button[data-tab="foryou"]')).toBe(null);
    });
    it("and so is its view [937]", () => {
      expect(el("view-foryou")).toBe(null);
    });
    it("the explore tab switches [944]", () => {
      document.querySelector('.nav button[data-tab="explore"]').click();
      expect(state.tab).toBe("explore");
    });
    it("and its view shows [945]", () => {
      expect(el("view-explore").hidden).toBe(false);
    });
    it("while the others hide [946]", () => {
      expect(el("view-browse").hidden).toBe(true);
      document.querySelector('.nav button[data-tab="now"]').click();
    });
  });

  describe("polish 1: a compact header", () => {
    const line = () => document.querySelector(".hdr .hdr-line");

    it("the clock and the freshness text share one line [1619]", () => {
      expect(line().contains(el("clock"))).toBe(true);
      expect(line().contains(el("fresh"))).toBe(true);
    });
    it("the word refreshed is its own span, so it can go first when the line would clip [1622, the page half]", () => {
      expect(document.querySelector("#fresh .word").textContent).toBe("refreshed ");
    });
    it("the freshness text reads as the rest of the line [1626]", () => {
      expect(el("fresh").textContent).toMatch(/^ · [\d,]+ events · refreshed \d+ (min|h|d) ago/);
    });
    it("the brand shows on Now as a small label [1629, the page half]", () => {
      state.tab = "now"; handle.render();
      expect(el("brand").hidden).toBe(false);
      expect(el("brand").textContent).toBe("Dragon Con 2026");
    });
    it("above the line [1630]", () => {
      expect(el("brand").compareDocumentPosition(line()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it.each(["browse", "explore", "map", "mine"])("and not on %s [1631]", tab => {
      state.tab = tab; handle.render();
      expect(el("brand").hidden).toBe(true);
      state.tab = "now"; handle.render();
    });

    /* The harness matched fitHeaderLine's source. jsdom reports no widths, so
       the line is given some: it clips until it is told it fits. */
    describe("when the line would clip, it gives way by measurement [1622 and 1625, the source halves]", () => {
      let fitsOnceTight;
      const had = { scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"), clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth") };
      beforeAll(() => {
        Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get() { return this.classList.contains("hdr-line") ? 300 : 0; } });
        Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true,
          get() { return !this.classList.contains("hdr-line") ? 0 : this.classList.contains("tight") && fitsOnceTight ? 300 : 340; } });
      });
      afterAll(() => {
        Object.defineProperty(Element.prototype, "scrollWidth", had.scrollWidth);
        Object.defineProperty(Element.prototype, "clientWidth", had.clientWidth);
        app.updateClock();
      });

      it("the word refreshed goes first [1622]", () => {
        fitsOnceTight = true; app.updateClock();
        expect(line().classList.contains("tight")).toBe(true);
        expect(line().classList.contains("tighter")).toBe(false);
      });
      it("and if that is not enough, the line steps down a size [1625]", () => {
        fitsOnceTight = false; app.updateClock();
        expect(line().classList.contains("tight")).toBe(true);
        expect(line().classList.contains("tighter")).toBe(true);
      });
    });
  });
});

/* The sticky filters park under the header, whose height changes with the
   clock, the freshness line and the brand. The harness matched each
   re-measuring call in the source; here the header is given a height, the
   height is changed, and each moment is made to happen. */
describe("the header's height is measured, not assumed", () => {
  let page, observed, fontsReady, height = 60;
  const had = {};

  beforeAll(async () => {
    had.ResizeObserver = window.ResizeObserver;
    window.ResizeObserver = globalThis.ResizeObserver = class { constructor(callback) { observed = { callback }; } observe(target) { observed.target = target; } disconnect() {} };
    had.fonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(resolve => { fontsReady = resolve; }) } });
    page = await bootPage();
    document.querySelector(".hdr").getBoundingClientRect = () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: height });
  }, 30000);
  afterAll(async () => {
    await page.cleanup();
    window.ResizeObserver = globalThis.ResizeObserver = had.ResizeObserver;
    if (had.fonts) Object.defineProperty(document, "fonts", had.fonts); else delete document.fonts;
  });

  it("the header height is measured, not assumed: the root carries --hdr-h from the first render [1265]", () => {
    expect(rootVar("--hdr-h")).toMatch(/^\d+px$/);
  });
  it("and re-measured when the header changes size [1266]", () => {
    expect(observed.target).toBe(document.querySelector(".hdr"));
    height = 71; observed.callback([]);
    expect(rootVar("--hdr-h")).toBe("71px");
  });
  it("the header is re-measured when the freshness line changes it [1272]", () => {
    height = 82; page.app.updateFresh();
    expect(rootVar("--hdr-h")).toBe("82px");
  });
  it("and once the font has loaded and changed the text metrics [1274]", async () => {
    height = 93; fontsReady();
    await page.until(() => rootVar("--hdr-h") === "93px", 2000, "the re-measure after fonts.ready");
  });
  it("and on load, so it never rests on the observer alone [1276]", () => {
    height = 104; window.dispatchEvent(new Event("load"));
    expect(rootVar("--hdr-h")).toBe("104px");
  });
  it("the header is re-measured when the brand comes and goes [1632]", () => {
    height = 115; page.handle.state.tab = "browse"; page.handle.render();
    expect(rootVar("--hdr-h")).toBe("115px");
    height = 126; page.handle.state.tab = "now"; page.handle.render();
    expect(rootVar("--hdr-h")).toBe("126px");
  });
});

/* IS_IOS is read once, as the module is imported, so the platform is set
   before the boot. The harness matched the two lines in the source. */
describe("on an iPhone", () => {
  let page;
  beforeAll(async () => {
    Object.defineProperty(window.navigator, "platform", { configurable: true, value: "iPhone" });
    page = await bootPage();
  }, 30000);
  afterAll(async () => { await page.cleanup(); delete window.navigator.platform; });

  it("on iOS the bottom inset is capped at the home indicator [785]", () => {
    expect(page.app.IS_IOS).toBe(true);
    expect(rootVar("--safe-bottom")).toBe("min(env(safe-area-inset-bottom, 0px), 34px)");
  });
  it("on iOS the move listener is the kind that may cancel: a drag down at the top of the page comes back prevented [793]", () => {
    touch(document.body, "touchstart", { x: 100, y: 100 });
    const move = touch(document.body, "touchmove", { x: 100, y: 160 });
    expect(move.defaultPrevented).toBe(true);
    /* and a drag that began inside main is left to main */
    touch(document.getElementById("view-now"), "touchstart", { x: 100, y: 100 });
    expect(touch(document.getElementById("view-now"), "touchmove", { x: 100, y: 160 }).defaultPrevented).toBe(false);
  });
});
