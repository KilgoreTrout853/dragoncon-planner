/* More past an edge (ROADMAP tentpole 5, step 7; DECISIONS #66, #76;
   docs/screens/contract.md, section 7, as built): seven areas of the sheet
   scroll on their own - six until DECISIONS #92, which made Settings' body
   and About's two of them and Advanced none - and each says what it hides past its top and past
   its bottom - `--more-above` and `--more-below`, in px, and `data-more`
   while either is above 0 - which the stylesheet fades. The mark is kept by
   three things boot() registers on the sheet and by no call at any draw: a
   scroll listener in the capture phase, a MutationObserver on its child
   lists, and a ResizeObserver on each area and its children. Since #78 the
   mark carries a word, "below", while an area hides 20 px or more below,
   and the stylesheet draws an arrow on what follows the area in its panel.

   jsdom lays nothing out, so an area's three numbers are 0 and no mark is
   ever written: a test gives a node the numbers a phone would, and a scroll
   event, which jsdom never sends, is dispatched by hand. jsdom has no
   ResizeObserver either: the first page is booted with a stand-in that
   keeps what it is handed, and the second with none, as jsdom is. What a
   phone draws is a browser's to see; the stylesheet's rules are pinned in
   tests/rules/style.test.js, and the arithmetic in tests/unit/scroll.test.js.
   New tests, not rows of tests/PORT-LEDGER.md, so their titles carry no
   harness line. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { mutationsDuring } from "../helpers/act.js";
import { YEAR } from "../../src/season.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "sample-events.json"), "utf8"));
const source = name => fs.readFileSync(path.join(ROOT, "src", name), "utf8").replace(/\r\n/g, "\n");
/* A shared day's link carries the last eight characters of an id (#69), and
   the sample's ids are five: the sample again, under ids a link can carry. */
const longId = i => `6ecc75745a676d39f2300556${(0x239c0000 + i).toString(16)}`;
const LONG = Object.fromEntries(sample.events.map((e, i) => [e.id, longId(i)]));
const data = { ...sample, events: sample.events.map(e => ({ ...e, id: LONG[e.id], source_id: LONG[e.id] })) };
/* The sample's Saturday at the Hyatt: 2:30 PM and 4:00 PM, both still to
   come at the harness's 1:05 PM; and a third event, for a sheet of its own. */
const HYATT = [LONG.s0376, LONG.s0263], OTHER = LONG.s0294;
const SATURDAY = "2026-09-05T13:05";
const dayQuery = `day=${YEAR}.sat.${HYATT.map(id => id.slice(-8)).join("-")}`;

const el = id => document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));   // a MutationObserver's records are delivered before this
/* The three numbers a phone would give a node, on the node itself. */
function sized(node, scrollTop, clientHeight, scrollHeight) {
  for (const [name, value] of Object.entries({ scrollTop, clientHeight, scrollHeight })) Object.defineProperty(node, name, { configurable: true, writable: true, value });
}
/* And on every node a selector finds, the ones not drawn yet among them:
   an area a draw replaces is a new node, which no test can reach before the
   page does. Put back by the function this returns. */
function laidOut(selector, [scrollTop, clientHeight, scrollHeight]) {
  const numbers = { scrollTop, clientHeight, scrollHeight };
  const had = Object.fromEntries(Object.keys(numbers).map(name => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)]));
  for (const name of Object.keys(numbers)) {
    Object.defineProperty(Element.prototype, name, { configurable: true,
      get() { return this.matches(selector) ? numbers[name] : had[name].get.call(this); },
      set(value) { if (had[name].set) had[name].set.call(this, value); } });
  }
  return () => { for (const name of Object.keys(numbers)) Object.defineProperty(Element.prototype, name, had[name]); };
}
const scrolled = node => node.dispatchEvent(new Event("scroll"));   // as a browser sends one: it does not bubble
const mark = node => [node.hasAttribute("data-more"), node.style.getPropertyValue("--more-above"), node.style.getPropertyValue("--more-below")];
const NONE = [false, "", ""];
/* The selectors of the stylesheet's arrow rule (DECISIONS #78), each less
   its ::before: the one rule that reads the word in data-more. */
const ARROW = (() => {
  const css = source("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim()).filter(s => s.includes('[data-more~="below"]'));
  if (rule.length !== 1) throw new Error(`one rule reads the word, not ${rule.length}`);
  return rule[0].split(",").map(s => s.trim().replace(/::before$/, ""));
})();

/* A stand-in for ResizeObserver that keeps what it is handed, in order. It
   has observe() and disconnect() and nothing else: the page never
   unobserves. */
function standIn() {
  const made = [];
  const had = window.ResizeObserver;
  window.ResizeObserver = globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.handed = []; made.push(this); }
    observe(target) { this.handed.push(target); }
    disconnect() {}
  };
  return { made, restore() { window.ResizeObserver = globalThis.ResizeObserver = had; } };
}

describe("more past an edge", () => {
  let page, handle, observers;
  /* The observer the sheet's areas are handed to: boot() makes one for the
     header and one for the nav too. */
  const sizes = () => observers.made.find(o => o.handed.includes(el("panel-crew")));
  const setPicks = ids => { handle.picks.set(ids); handle.render(); };

  beforeAll(async () => {
    observers = standIn();
    page = await bootPage({ data, backend: fakeBackend(), url: `https://example.test/?now=${SATURDAY}&${dayQuery}` });
    ({ handle } = page);
  }, 30000);
  afterAll(async () => { await page.cleanup(); observers.restore(); });

  /* Each of the seven, opened as a reader opens it, and the element that
     scrolls. The shared day comes first: the link opened it as the page
     loaded, and any other panel takes it away. */
  const AREAS = [
    ["the shared day's list", () => {}, () => el("sharedBody")],
    ["an event's body", () => handle.openSheet("event", OTHER), () => el("panel-event").querySelector(".ev-body")],
    ["the hotel sheet's list", () => { setPicks(HYATT); handle.openSheet("hotel", "Hyatt"); }, () => el("panel-hotel").querySelector(".ev-body")],
    ["the filter sheet's body", () => handle.openSheet("filters"), () => el("filtersBody")],
    ["Settings' body", () => handle.openSheet("settings"), () => el("settingsBody")],
    ["About this app's body", () => { handle.openSheet("settings"); el("aboutRow").click(); }, () => el("aboutBody")],
    ["the crew panel", () => handle.openSheet("crew", "create"), () => el("panel-crew")],
  ];
  /* What follows each area in its panel, which the arrow is drawn on
     (DECISIONS #78): an event's foot, the hotel's and the shared day's Done
     row, the filters' foot, Settings' foot and About's (#92). The crew panel
     is its own scroller, and keeps the fade alone. */
  const FOLLOWS = {
    "the shared day's list": ".ev-actions", "an event's body": ".ev-foot", "the hotel sheet's list": ".ev-actions",
    "the filter sheet's body": ".filters-foot", "Settings' body": ".sheet-foot", "About this app's body": ".sheet-foot", "the crew panel": null,
  };
  /* The element the stylesheet's arrow rule finds after an area, by the
     rule's own selectors less their ::before - jsdom draws no pseudo-element,
     but it matches a selector - or null where the rule finds none. */
  const arrowOn = area => ARROW.flatMap(s => [...document.querySelectorAll(s)]).find(next => next.previousElementSibling === area) || null;

  describe("each of the seven areas says what it hides, as it is scrolled", () => {
    for (const [name, open, find] of AREAS) {
      describe(name, () => {
        let area;
        beforeAll(() => { open(); area = find(); });

        it("is on screen, and carries nothing while jsdom gives it no numbers", () => {
          expect(area).not.toBe(null);
          expect(area.closest("[hidden]")).toBe(null);
          expect(mark(area)).toEqual(NONE);
          expect(area.hasAttribute("style")).toBe(false);
        });
        it("at its top: what is below, and nothing above", () => {
          sized(area, 0, 300, 320);
          scrolled(area);
          expect(mark(area)).toEqual([true, "", "20px"]);
        });
        it("in the middle: both", () => {
          sized(area, 12, 300, 340);
          scrolled(area);
          expect(mark(area)).toEqual([true, "12px", "28px"]);
        });
        it("at its end: what is above, and nothing below", () => {
          sized(area, 40, 300, 340);
          scrolled(area);
          expect(mark(area)).toEqual([true, "40px", ""]);
        });
        it("far from either end: the ceiling at both, 48px", () => {
          sized(area, 700, 300, 2000);
          scrolled(area);
          expect(mark(area)).toEqual([true, "48px", "48px"]);
        });
        it("with content that fits: no mark, and no attribute of ours left behind", () => {
          sized(area, 0, 300, 300);
          scrolled(area);
          expect(mark(area)).toEqual(NONE);
          expect(area.hasAttribute("style")).toBe(false);
          expect(area.hasAttribute("data-more")).toBe(false);
        });

        /* The word (DECISIONS #78): the mark says "below" while the area
           hides the threshold, 20 px, or more below, and the stylesheet's
           arrow hangs on the word. */
        it("hiding under the threshold below, the mark is there and says no word", () => {
          sized(area, 0, 300, 319);
          scrolled(area);
          expect(mark(area)).toEqual([true, "", "19px"]);
          expect(area.getAttribute("data-more")).toBe("");
          expect(arrowOn(area)).toBe(null);
        });
        it("at the threshold the word is written", () => {
          sized(area, 0, 300, 320);
          scrolled(area);
          expect(area.getAttribute("data-more")).toBe("below");
        });
        it(FOLLOWS[name] ? `and the arrow's rule finds what follows the area in its panel: ${FOLLOWS[name]}` : "and the arrow's rule finds nothing: nothing follows this area", () => {
          const next = arrowOn(area);
          if (FOLLOWS[name]) {
            expect(next).toBe(area.nextElementSibling);
            expect(next.matches(FOLLOWS[name])).toBe(true);
            expect(next.closest("[hidden]")).toBe(null);
          } else expect(next).toBe(null);
        });
        it("the word stays far from both ends, where the fade is at its cap", () => {
          sized(area, 700, 300, 2000);
          scrolled(area);
          expect(area.getAttribute("data-more")).toBe("below");
        });
        it("it is taken away as the area nears its end, the mark staying for what is still hidden", () => {
          sized(area, 1681, 300, 2000);
          scrolled(area);
          expect(mark(area)).toEqual([true, "48px", "19px"]);
          expect(area.getAttribute("data-more")).toBe("");
          expect(arrowOn(area)).toBe(null);
        });
        it("it is back on the way up", () => {
          sized(area, 1680, 300, 2000);
          scrolled(area);
          expect(area.getAttribute("data-more")).toBe("below");
        });
        it("what is hidden above alone never says it: at its end the mark is bare", () => {
          sized(area, 1700, 300, 2000);
          scrolled(area);
          expect(mark(area)).toEqual([true, "48px", ""]);
          expect(area.getAttribute("data-more")).toBe("");
        });
        it("and with nothing hidden the word goes with the mark", () => {
          sized(area, 0, 300, 320);
          scrolled(area);
          expect(area.getAttribute("data-more")).toBe("below");
          sized(area, 0, 300, 300);
          scrolled(area);
          expect(area.hasAttribute("data-more")).toBe(false);
          expect(area.hasAttribute("style")).toBe(false);
          expect(arrowOn(area)).toBe(null);
        });
      });
    }
  });

  describe("the mark is written only when it changes", () => {
    let area;
    const writes = during => mutationsDuring(area, during).filter(r => r.target === area).map(r => r.attributeName);
    /* And what the page asks of the element's style, counted: a browser may
       itself skip a write that changes nothing, and the page does not lean
       on that. */
    function asked(during) {
      const calls = [], style = area.style, { setProperty, removeProperty } = style;
      style.setProperty = function (name, ...rest) { calls.push(`set ${name}`); return setProperty.call(this, name, ...rest); };
      style.removeProperty = function (name) { calls.push(`remove ${name}`); return removeProperty.call(this, name); };
      try { during(); } finally { delete style.setProperty; delete style.removeProperty; }
      return calls;
    }
    beforeAll(() => { handle.openSheet("event", OTHER); area = el("panel-event").querySelector(".ev-body"); });

    it("a scroll that changes neither number writes nothing, and asks for no write", () => {
      sized(area, 10, 300, 330);
      scrolled(area);
      expect(mark(area)).toEqual([true, "10px", "20px"]);
      expect(writes(() => { scrolled(area); scrolled(area); })).toEqual([]);
      expect(asked(() => { scrolled(area); scrolled(area); })).toEqual([]);
    });
    it("nor does a scroll far from both ends: the number stands still at the ceiling", () => {
      sized(area, 500, 300, 2000);
      scrolled(area);
      expect(writes(() => { for (const top of [501, 620, 900, 1651]) { sized(area, top, 300, 2000); scrolled(area); } })).toEqual([]);
      expect(asked(() => { for (const top of [1650, 700, 49]) { sized(area, top, 300, 2000); scrolled(area); } })).toEqual([]);
      expect(mark(area)).toEqual([true, "48px", "48px"]);
    });
    it("within the ceiling of an end it is one write a px, to the one property that changed", () => {
      expect(writes(() => { sized(area, 1653, 300, 2000); scrolled(area); })).toEqual(["style"]);
      expect(mark(area)).toEqual([true, "48px", "47px"]);
      expect(writes(() => { sized(area, 1652.4, 300, 2000); scrolled(area); })).toEqual([]);   // the same whole px
      expect(asked(() => { sized(area, 1654, 300, 2000); scrolled(area); })).toEqual(["set --more-below"]);
      expect(mark(area)).toEqual([true, "48px", "46px"]);
      expect(asked(() => { sized(area, 1700, 300, 2000); scrolled(area); })).toEqual(["remove --more-below"]);
      expect(mark(area)).toEqual([true, "48px", ""]);
    });
    it("an inline style of the area's own is left where it was when the mark goes", () => {
      area.style.setProperty("--kept", "1");
      sized(area, 0, 300, 320);
      scrolled(area);
      expect(mark(area)).toEqual([true, "", "20px"]);
      sized(area, 0, 300, 300);
      scrolled(area);
      expect(mark(area)).toEqual(NONE);
      expect(area.style.getPropertyValue("--kept")).toBe("1");
      area.style.removeProperty("--kept");
      area.removeAttribute("style");
    });
    it("the hook goes on once, as the first px is hidden, and comes off once", () => {
      sized(area, 0, 300, 300);
      scrolled(area);
      expect(writes(() => { sized(area, 0, 300, 301); scrolled(area); })).toEqual(["style", "data-more"]);
      expect(writes(() => { sized(area, 0, 300, 305); scrolled(area); })).toEqual(["style"]);
      expect(writes(() => { sized(area, 0, 300, 300); scrolled(area); })).toEqual(["style", "data-more", "style"]);
      expect(area.hasAttribute("style")).toBe(false);
    });
    it("the word is one write of the hook as the threshold is crossed, either way, and none either side of it", () => {
      sized(area, 0, 300, 319);
      scrolled(area);
      expect(area.getAttribute("data-more")).toBe("");
      expect(writes(() => { sized(area, 0, 300, 320); scrolled(area); })).toEqual(["style", "data-more"]);
      expect(area.getAttribute("data-more")).toBe("below");
      expect(writes(() => { sized(area, 0, 300, 321); scrolled(area); })).toEqual(["style"]);
      expect(writes(() => { sized(area, 0, 300, 319); scrolled(area); })).toEqual(["style", "data-more"]);
      expect(area.getAttribute("data-more")).toBe("");
      expect(writes(() => { sized(area, 0, 300, 318); scrolled(area); })).toEqual(["style"]);
      sized(area, 0, 300, 300);
      scrolled(area);
      expect(mark(area)).toEqual(NONE);
    });
    it("a bounce past an end is that end: nothing negative is written", () => {
      sized(area, -30, 300, 320);
      scrolled(area);
      expect(mark(area)).toEqual([true, "", "48px"]);
      sized(area, 55, 300, 320);
      scrolled(area);
      expect(mark(area)).toEqual([true, "48px", ""]);
      sized(area, 0, 300, 300);
      scrolled(area);
    });
  });

  describe("what is not one of the seven carries no mark, whatever it scrolls", () => {
    const untouched = node => [node.hasAttribute("data-more"), node.style.getPropertyValue("--more-above"), node.style.getPropertyValue("--more-below")];

    it("Advanced, a fold in Settings' body since #92: the body has the cue", () => {
      handle.openSheet("settings");
      el("advanced").open = true;
      const fold = el("advanced").querySelector(".advanced-body");
      sized(fold, 20, 300, 600);
      scrolled(fold);
      expect(untouched(fold)).toEqual(NONE);
      for (const name of ["scrollTop", "clientHeight", "scrollHeight"]) delete fold[name];
      el("advanced").open = false;
    });

    it("an event's panel scrolling as one: its body has the cue, and its foot is pinned", () => {
      handle.openSheet("event", OTHER);
      const panel = el("panel-event");
      sized(panel, 20, 500, 600);
      scrolled(panel);
      expect(untouched(panel)).toEqual(NONE);
      for (const name of ["scrollTop", "clientHeight", "scrollHeight"]) delete panel[name];
    });
    it("the share panel's message, which is a field", () => {
      setPicks(HYATT);
      handle.openSheet("share");
      const box = el("shareText");
      expect(box).not.toBe(null);
      sized(box, 20, 100, 300);
      scrolled(box);
      expect(untouched(box)).toEqual(NONE);
    });
    it("and main, the page: the sheet's listener never hears it", () => {
      handle.closeSheet();
      const main = document.querySelector("main");
      sized(main, 200, 600, 4000);
      scrolled(main);
      expect(untouched(main)).toEqual(NONE);
      for (const name of ["scrollTop", "clientHeight", "scrollHeight"]) delete main[name];
    });
    it("the listener is the sheet's, in the capture phase, and passive: a scroll does not bubble", () => {
      expect(source("boot.js")).toContain('sheetEl.addEventListener("scroll", onMoreScroll, {capture: true, passive: true});');
    });
  });

  describe("an area drawn anew, or given a child: the sheet's child lists are watched, and no draw calls anything", () => {
    it("a panel opened onto an area that already hides something marks it, with no scroll", async () => {
      const restore = laidOut("#panel-hotel .ev-body", [0, 320, 500]);
      try {
        setPicks(HYATT);
        handle.openSheet("hotel", "Hyatt");
        const body = el("panel-hotel").querySelector(".ev-body");
        expect(mark(body)).toEqual(NONE);            // the draw itself wrote nothing
        await tick();
        expect(mark(body)).toEqual([true, "", "48px"]);
      } finally { restore(); }
    });
    it("a star in the hotel's sheet draws the panel again: the new body is marked, as the old one was", async () => {
      const restore = laidOut("#panel-hotel .ev-body", [0, 320, 350]);
      try {
        const was = el("panel-hotel").querySelector(".ev-body");
        el("panel-hotel").querySelector(".star").click();
        const body = el("panel-hotel").querySelector(".ev-body");
        expect(body).not.toBe(was);
        expect(body.isConnected && !was.isConnected).toBe(true);
        expect(mark(body)).toEqual(NONE);
        await tick();
        expect(mark(body)).toEqual([true, "", "30px"]);
      } finally { restore(); setPicks(HYATT); }
    });
    it("a child put into an area at its cap changes no box, only what is hidden: the mark follows", async () => {
      handle.openSheet("hotel", "Hyatt");
      await tick();
      const body = el("panel-hotel").querySelector(".ev-body");
      sized(body, 30, 320, 350);
      scrolled(body);
      expect(mark(body)).toEqual([true, "30px", ""]);
      sized(body, 30, 320, 390);
      const section = document.createElement("div");
      body.append(section);
      expect(mark(body)).toEqual([true, "30px", ""]);
      await tick();
      expect(mark(body)).toEqual([true, "30px", "40px"]);
      sized(body, 30, 320, 350);
      section.remove();
      await tick();
      expect(mark(body)).toEqual([true, "30px", ""]);
    });
    it("words written into a node already there wake it too: a line's text is a child", async () => {
      const body = el("panel-hotel").querySelector(".ev-body");
      sized(body, 0, 320, 364);
      body.querySelector(".title").textContent = "A title that now wraps to a second line";
      await tick();
      expect(mark(body)).toEqual([true, "", "44px"]);
    });
    it("but never an attribute, nor a text node's own data: the mark's write cannot wake what watches for it", async () => {
      const body = el("panel-hotel").querySelector(".ev-body");
      sized(body, 0, 320, 330);
      body.querySelector(".row").setAttribute("data-probe", "1");
      body.querySelector(".title").firstChild.data = "Other words";
      body.style.setProperty("--probe", "1px");
      await tick();
      expect(mark(body)).toEqual([true, "", "44px"]);
      body.style.removeProperty("--probe");
      expect(source("boot.js")).toContain("new MutationObserver(syncMore).observe(sheetEl, {childList: true, subtree: true});");
      scrolled(body);
      expect(mark(body)).toEqual([true, "", "10px"]);
    });
  });

  describe("the ResizeObserver: each area and each child of it, handed over once", () => {
    it("boot() makes one for the areas, and hands it those already in the page: the crew panel, and Settings' body with its children", () => {
      const body = el("settingsBody");
      expect(sizes()).toBeDefined();
      expect(body.children.length).toBeGreaterThan(2);
      for (const node of [el("panel-crew"), body, ...body.children]) expect(sizes().handed.filter(n => n === node).length).toBe(1);
    });
    it("an area a draw makes is handed over with its children, by the child lists' observer", async () => {
      handle.openSheet("event", OTHER);
      const body = el("panel-event").querySelector(".ev-body");
      expect(sizes().handed.includes(body)).toBe(false);
      await tick();
      expect(body.children.length).toBeGreaterThan(0);
      for (const node of [body, ...body.children]) expect(sizes().handed.filter(n => n === node).length).toBe(1);
    });
    it("and only once, however often the sheet is written into; a child that arrives later is handed over then", async () => {
      const body = el("panel-event").querySelector(".ev-body"), n = sizes().handed.length;
      el("sheetStar").click();
      el("sheetStar").click();
      await tick();
      expect(sizes().handed.length).toBe(n);
      const late = document.createElement("p");
      body.append(late);
      await tick();
      expect(sizes().handed.slice(n)).toEqual([late]);
      late.remove();
      await tick();
    });
    it("nothing outside the seven is handed to it: not the event's panel, its head or its foot, nor Advanced's fold, nor the sheet", () => {
      const panel = el("panel-event");
      for (const node of [panel, panel.querySelector(".ev-head"), panel.querySelector(".ev-foot"), el("advanced").querySelector(".advanced-body"), el("sheet"), document.querySelector("main")]) expect(sizes().handed.includes(node)).toBe(false);
    });
    it("when it fires - Larger text, Advanced opened, the window resized or turned, a box that grew - every area says again what it hides", () => {
      handle.openSheet("settings");
      el("advanced").open = true;
      const body = el("settingsBody");
      sized(body, 0, 300, 300);
      sizes().callback([]);
      expect(mark(body)).toEqual(NONE);
      /* Larger text: the content grows inside an area whose own box stays
         as it was, which only its children's boxes show. */
      el("bigText").click();
      sized(body, 0, 300, 310);
      sizes().callback([]);
      expect(mark(body)).toEqual([true, "", "10px"]);
      el("bigText").click();
      sized(body, 0, 300, 300);
      sizes().callback([]);
      expect(mark(body)).toEqual(NONE);
      el("advanced").open = false;
      handle.closeSheet();
    });
    it("an area in a panel that is no longer shown measures nothing, and loses its mark", () => {
      handle.openSheet("event", OTHER);
      const body = el("panel-event").querySelector(".ev-body");
      sized(body, 5, 300, 400);
      scrolled(body);
      expect(mark(body)).toEqual([true, "5px", "48px"]);
      handle.closeSheet();
      sized(body, 0, 0, 0);
      sizes().callback([]);
      expect(mark(body)).toEqual(NONE);
      expect(body.hasAttribute("style")).toBe(false);
    });
  });
});

describe("more past an edge, on a page where nothing has been opened yet", () => {
  let page, observers;

  beforeAll(async () => {
    observers = standIn();
    page = await bootPage({ data, url: `https://example.test/?now=${SATURDAY}` });
  }, 30000);
  afterAll(async () => { await page.cleanup(); observers.restore(); });

  it("boot() hands the observer the areas already in the page, before any draw: the crew panel, and Settings' body with its children", () => {
    const body = el("settingsBody"), sizes = observers.made.find(o => o.handed.includes(body));
    expect(el("sheetWrap").hidden).toBe(true);
    expect(sizes).toBeDefined();
    expect(body.children.length).toBeGreaterThan(2);
    expect(sizes.handed).toEqual([body, ...body.children, el("panel-crew")]);
  });
});

describe("more past an edge, in a browser with no ResizeObserver - jsdom's own", () => {
  let page, handle;

  beforeAll(async () => {
    expect(window.ResizeObserver).toBe(undefined);
    page = await bootPage({ data, url: `https://example.test/?now=${SATURDAY}` });
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("the page boots, and a scroll still marks an area", () => {
    handle.openSheet("event", OTHER);
    const body = el("panel-event").querySelector(".ev-body");
    sized(body, 8, 300, 330);
    scrolled(body);
    expect(mark(body)).toEqual([true, "8px", "22px"]);
  });
  it("and so does a child put into one", async () => {
    const body = el("panel-event").querySelector(".ev-body");
    sized(body, 8, 300, 360);
    body.append(document.createElement("p"));
    await tick();
    expect(mark(body)).toEqual([true, "8px", "48px"]);
    handle.closeSheet();
  });
  it("the registration is under boot()'s own test for one, beside the header's and the nav's", () => {
    const boot = source("boot.js"), at = boot.indexOf("if (window.ResizeObserver) {");
    expect(at).toBeGreaterThan(-1);
    expect(boot.slice(at, boot.indexOf("\n  }", at))).toContain("setMoreObserver(new ResizeObserver(syncMore));");
    expect(boot.match(/ResizeObserver\(syncMore\)/g).length).toBe(1);
  });
});
