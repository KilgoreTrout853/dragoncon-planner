/* Settings: the device readout, the everyday controls, Advanced, Larger text,
   and where Keep your plan sits on a build with a backend. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";
import { touch } from "../helpers/act.js";

describe("the Settings sheet", () => {
  let page, handle;
  const el = id => document.getElementById(id);

  beforeAll(async () => { page = await bootPage(); ({ handle } = page); }, 30000);
  afterAll(() => page.cleanup());

  describe("the settings sheet reports what the device says", () => {
    let readout;
    beforeAll(() => { handle.openSheet("settings"); readout = el("deviceLine").textContent; handle.closeSheet(); });

    it("settings carries a device readout [790]", () => {
      expect(readout).toMatch(/^(Home-screen app|Web page) · viewport \d+×\d+, visual .+, screen .+ · insets top .+, bottom .+/);
    });
    it("ending in the build stamp from the page's last-modified time [791, and 1699]", () => {
      expect(readout).toMatch(/ · build \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
    });
    /* What the bottom and the top of the page are laid out from (DECISIONS
       #62), as scroll.js measured them, so a phone can be asked for them.
       jsdom lays nothing out: the nav's 0 is ignored and its default stands. */
    it("and what the nav and the header were measured at, after the insets", () => {
      expect(readout).toMatch(/ · insets top .+, bottom .+ · --nav-h default, --hdr-h \d+px/);
      const root = document.documentElement.style, hdr = root.getPropertyValue("--hdr-h");
      root.setProperty("--nav-h", "105px"); root.setProperty("--hdr-h", "82px");
      try {
        expect(page.app.deviceLine()).toMatch(/ · --nav-h 105px, --hdr-h 82px( · |$)/);
      } finally {
        root.removeProperty("--nav-h"); root.setProperty("--hdr-h", hdr);
      }
    });
  });

  /* Since the gear PR (DECISIONS #92) the panel is its heading, one body
     that scrolls and a foot: the controls are the body's children, in the
     order they had, and Done is the foot's. The bracketed tests read the
     same controls where they now stand; the others are new tests, not rows
     of tests/PORT-LEDGER.md. */
  describe("polish 6: the everyday two up top and the rest under Advanced", () => {
    let panel, body, advanced, children;
    beforeAll(() => { handle.openSheet("settings"); panel = el("panel-settings"); body = el("settingsBody"); advanced = el("advanced"); children = [...body.children]; });
    afterAll(() => { el("advanced").open = false; handle.closeSheet(); });

    it("the panel is its heading, one body and a foot, and Done is alone in the foot", () => {
      expect([...panel.children].map(c => c.id || c.className)).toEqual(["sheetTitle", "settingsBody", "sheet-foot"]);
      expect(body.className).toBe("sheet-body");
      expect([...panel.lastElementChild.querySelectorAll("*")]).toEqual([el("closeSheet")]);
      expect(el("closeSheet").textContent.trim()).toBe("Done");
      expect(body.contains(el("closeSheet"))).toBe(false);
    });
    it("Crowd factor and Hide photo sessions come first [1695]", () => {
      expect(panel.children[0].id).toBe("sheetTitle");
      expect(children[0].contains(el("crowd"))).toBe(true);
      expect(children[1].contains(el("noiseDefault"))).toBe(true);
    });
    it("and Larger text [1696]", () => {
      expect(children[2].contains(el("bigText"))).toBe(true);
    });
    it("then a collapsed Advanced section [1697]", () => {
      expect(advanced.tagName).toBe("DETAILS");
      expect(children[3]).toBe(advanced);
      expect(advanced.open).toBe(false);
      expect(advanced.querySelector("summary").textContent.trim()).toBe("Advanced");
    });
    it("holding the preview clock, the walk-time defaults and the device readout with the build stamp [1698]", () => {
      for (const id of ["previewTime", "applyPreview", "clearPreview", "walkTable", "deviceLine"]) expect(advanced.contains(el(id)), id).toBe(true);
    });
    it("then Keep your plan's place, hidden with no backend, the About row, and Remove all picks, and nothing after it", () => {
      expect(children[4]).toBe(el("keep"));
      expect(el("keep").hidden).toBe(true);
      expect(children[5]).toBe(el("aboutRow"));
      expect(children[6].contains(el("resetPicks"))).toBe(true);
      expect(children.length).toBe(7);
    });
    it("the About row is a button named for where it goes, its mark kept from a screen reader", () => {
      const row = el("aboutRow");
      expect(row.tagName).toBe("BUTTON");
      expect(row.firstChild.textContent.trim()).toBe("About this app");
      expect(row.querySelectorAll("*").length).toBe(1);
      expect(row.querySelector("span").getAttribute("aria-hidden")).toBe("true");
    });
    it("no notifications toggle, and no element kept for one: the body's two checkboxes are the two it had", () => {
      expect([...panel.querySelectorAll("input[type=checkbox]")].map(box => box.id)).toEqual(["noiseDefault", "bigText"]);
    });
    it("each checkbox is in a row with its words: the box first, inside its own label", () => {
      for (const id of ["noiseDefault", "bigText"]) {
        const label = el(id).closest("label");
        expect(label.className, id).toBe("toggle");
        expect(label.firstChild, id).toBe(el(id));
        expect(label.textContent.trim().length, id).toBeGreaterThan(0);
        expect(label.parentElement, id).toBe(body);
      }
    });
    it("outside Advanced, the About row and Remove all picks in the body, then Done in the foot [1701]", () => {
      expect([...panel.querySelectorAll("button")].filter(b => !advanced.contains(b)).map(b => b.id)).toEqual(["aboutRow", "resetPicks", "closeSheet"]);
    });
    it("Remove all picks is last in the body, still destructive, outside Advanced and on its own row [1703]", () => {
      const reset = el("resetPicks");
      expect([...body.querySelectorAll("button, input, select, summary")].pop()).toBe(reset);
      expect(reset.classList.contains("danger")).toBe(true);
      expect(advanced.contains(reset)).toBe(false);
      expect(reset.parentElement).not.toBe(el("closeSheet").parentElement);
      expect([...reset.parentElement.querySelectorAll("button")]).toEqual([reset]);
    });
    it("opening Settings again leaves Advanced as you left it; the sheet does not force it shut [1709]", () => {
      advanced.open = true;
      handle.closeSheet();
      handle.openSheet("settings");
      expect(el("advanced").open).toBe(true);
    });
    it("and it opens with its body at its top, wherever it was left", () => {
      body.scrollTop = 180;
      handle.closeSheet();
      handle.openSheet("settings");
      expect(body.scrollTop).toBe(0);
    });
    /* The body is what scrolls (#92): a drag that starts in it is a scroll
       while it has more than its room, and must not take the sheet with it.
       Where everything fits - no backend, nothing opened - it has nothing to
       scroll, and a drag there moves the sheet, as one in the crew panel or
       an event's does: Settings then swipes shut from anywhere. jsdom lays
       nothing out, so the body is given the numbers a phone would. */
    describe("a drag", () => {
      const inside = () => [el("crowd"), el("bigText").closest("label"), advanced.querySelector("summary"), el("deviceLine"), el("walkTable"), el("aboutRow"), el("resetPicks"), body];
      const sized = (clientHeight, scrollHeight) => {
        for (const [name, value] of Object.entries({ clientHeight, scrollHeight })) Object.defineProperty(body, name, { configurable: true, value });
      };
      afterAll(() => { delete body.clientHeight; delete body.scrollHeight; });

      it("that starts in a body with more than its room scrolls it: the sheet does not move, and stays open", () => {
        sized(417, 606);
        for (const from of inside()) {
          touch(from, "touchstart", { y: 100 });
          expect(el("sheetBack").classList.contains("dragging")).toBe(false);
          touch(from, "touchmove", { y: 300 });
          expect(el("sheet").style.transform).toBe("");
          touch(from, "touchend", null);
          expect(el("sheetWrap").hidden).toBe(false);
        }
      });
      it("that starts in a body whose content fits moves the sheet", () => {
        sized(361, 361);
        for (const from of inside()) {
          touch(from, "touchstart", { y: 100 });
          expect(el("sheetBack").classList.contains("dragging")).toBe(true);
          touch(from, "touchmove", { y: 130 });
          expect(el("sheet").style.transform).toBe("translateY(30px)");
          touch(from, "touchcancel", null);
          expect(el("sheet").style.transform).toBe("");
          expect(el("sheetWrap").hidden).toBe(false);
        }
      });
      it("that starts on the heading or the foot moves the sheet, whatever the body holds", () => {
        sized(417, 606);
        for (const outside of [el("sheetTitle"), panel.lastElementChild, el("closeSheet")]) {
          touch(outside, "touchstart", { y: 100 });
          expect(el("sheetBack").classList.contains("dragging")).toBe(true);
          touch(outside, "touchmove", { y: 130 });
          expect(el("sheet").style.transform).toBe("translateY(30px)");
          touch(outside, "touchcancel", null);
          expect(el("sheet").style.transform).toBe("");
          expect(el("sheetWrap").hidden).toBe(false);
        }
      });
    });
  });

  describe("polish 7: larger text", () => {
    let big;
    beforeAll(() => { handle.openSheet("settings"); big = el("bigText"); });
    afterAll(() => handle.closeSheet());

    it("a Larger text toggle sits with the everyday controls [1716]", () => {
      expect(big.type).toBe("checkbox");
      expect(big.closest("label").textContent.trim()).toBe("Larger text");
      expect(el("advanced").contains(big)).toBe(false);
    });
    it("off by default [1717]", () => {
      expect(document.documentElement.classList.contains("bigtext")).toBe(false);
      expect(big.checked).toBe(false);
    });
    it("on: the html element takes the class and the choice is saved as dc26.bigtext [1719]", () => {
      big.click();
      expect(document.documentElement.classList.contains("bigtext")).toBe(true);
      expect(window.localStorage.getItem("dc26.bigtext")).toBe("true");
    });
    it("off again, and saved [1722]", () => {
      big.click();
      expect(document.documentElement.classList.contains("bigtext")).toBe(false);
      expect(window.localStorage.getItem("dc26.bigtext")).toBe("false");
    });

    /* The harness matched `saveJSON(...); syncHeaderHeight(); render();` in the
       source. Both effects are observable once the header reports a height. */
    it("toggling re-measures the header and re-renders, so the timeline refits [1733]", () => {
      handle.closeSheet();
      handle.picks.set([handle.events.find(e => e._e > handle.now()).id]);
      handle.state.tab = "plans"; handle.state.mineView = "timeline"; handle.render();
      const block = document.querySelector("#view-plans .tl-block");
      const hdr = document.querySelector(".hdr");
      hdr.getBoundingClientRect = () => ({ height: 77, top: 0, left: 0, right: 0, bottom: 77, width: 0 });
      handle.openSheet("settings");
      el("bigText").click();
      expect(document.documentElement.style.getPropertyValue("--hdr-h")).toBe("77px");
      expect(document.querySelector("#view-plans .tl-block")).toBeTruthy();
      expect(document.querySelector("#view-plans .tl-block")).not.toBe(block);
      el("bigText").click();
      delete hdr.getBoundingClientRect;
      handle.picks.set([]);
    });
  });
});

/* The harness matched `classList.toggle("bigtext", !!loadJSON(...))` in the source. */
describe("a boot with Larger text already chosen", () => {
  let page;
  beforeAll(async () => {
    window.localStorage.setItem("dc26.bigtext", "true");
    page = await bootPage();
  }, 30000);
  afterAll(() => page.cleanup());

  it("the saved choice is applied at startup, before the first paint [1723]", () => {
    expect(document.documentElement.classList.contains("bigtext")).toBe(true);
    page.handle.openSheet("settings");
    expect(document.getElementById("bigText").checked).toBe(true);
    page.handle.closeSheet();
  });
});

/* The same sheet on a build with a backend (DECISIONS #53, #92): Keep your
   plan sits in the body between Advanced and the About row. These extend
   [1701] and [1703] to that layout, so both are pinned; they are new tests,
   not ledger rows, and their titles carry no harness line. */
describe("the Settings sheet on a build with a backend", () => {
  let page, panel, body, advanced;
  const el = id => document.getElementById(id);

  beforeAll(async () => {
    page = await bootPage({ backend: fakeBackend() });
    page.handle.openSheet("settings");
    panel = el("panel-settings");
    body = el("settingsBody");
    advanced = el("advanced");
  }, 30000);
  afterAll(() => { page.handle.closeSheet(); return page.cleanup(); });

  it("Keep your plan sits after Advanced and before the About row, the everyday controls above it as they were, and Done alone in the foot", () => {
    const children = [...body.children];
    expect([...panel.children].map(c => c.id || c.className)).toEqual(["sheetTitle", "settingsBody", "sheet-foot"]);
    expect(children[3]).toBe(advanced);
    expect(children[4]).toBe(el("keep"));
    expect(el("keep").hidden).toBe(false);
    expect(children[5]).toBe(el("aboutRow"));
    expect(children[6].contains(el("resetPicks"))).toBe(true);
    expect(children.length).toBe(7);
    expect([...panel.lastElementChild.querySelectorAll("*")]).toEqual([el("closeSheet")]);
  });
  it("outside Advanced, the Keep section's buttons, then the About row and Remove all picks, and Done in the foot, in that order", () => {
    expect([...panel.querySelectorAll("button")].filter(b => !advanced.contains(b)).map(b => b.id))
      .toEqual(["keepSend", "keepConfirm", "keepSignOut", "aboutRow", "resetPicks", "closeSheet"]);
  });
  it("Remove all picks is still last in the body, still destructive, outside Advanced and on its own row", () => {
    const reset = el("resetPicks");
    expect([...body.querySelectorAll("button, input, select, summary")].pop()).toBe(reset);
    expect(reset.classList.contains("danger")).toBe(true);
    expect(advanced.contains(reset)).toBe(false);
    expect(reset.parentElement).not.toBe(el("closeSheet").parentElement);
  });
});
