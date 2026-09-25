/* Settings: the device readout, the everyday controls, Advanced, Larger text,
   and where Keep your plan sits on a build with a backend. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { fakeBackend } from "../helpers/backend.js";

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
  });

  describe("polish 6: the everyday two up top and the rest under Advanced", () => {
    let panel, advanced, children;
    beforeAll(() => { handle.openSheet("settings"); panel = el("panel-settings"); advanced = el("advanced"); children = [...panel.children]; });
    afterAll(() => { el("advanced").open = false; handle.closeSheet(); });

    it("Crowd factor and Hide photo sessions come first [1695]", () => {
      expect(children[0].id).toBe("sheetTitle");
      expect(children[1].contains(el("crowd"))).toBe(true);
      expect(children[2].contains(el("noiseDefault"))).toBe(true);
    });
    it("and Larger text [1696]", () => {
      expect(children[3].contains(el("bigText"))).toBe(true);
    });
    it("then a collapsed Advanced section [1697]", () => {
      expect(advanced.tagName).toBe("DETAILS");
      expect(children[4]).toBe(advanced);
      expect(advanced.open).toBe(false);
      expect(advanced.querySelector("summary").textContent.trim()).toBe("Advanced");
    });
    it("holding the preview clock, the walk-time defaults and the device readout with the build stamp [1698]", () => {
      for (const id of ["previewTime", "applyPreview", "clearPreview", "walkTable", "deviceLine"]) expect(advanced.contains(el(id)), id).toBe(true);
    });
    it("outside Advanced only Done and Remove all picks remain, in that order [1701]", () => {
      expect([...panel.querySelectorAll("button")].filter(b => !advanced.contains(b)).map(b => b.id)).toEqual(["closeSheet", "resetPicks"]);
    });
    it("Remove all picks is last, still destructive, outside Advanced and on its own row [1703]", () => {
      const reset = el("resetPicks");
      expect([...panel.querySelectorAll("button, input, select, summary")].pop()).toBe(reset);
      expect(reset.classList.contains("danger")).toBe(true);
      expect(advanced.contains(reset)).toBe(false);
      expect(reset.parentElement).not.toBe(el("closeSheet").parentElement);
    });
    it("opening Settings again leaves Advanced as you left it; the sheet does not force it shut [1709]", () => {
      advanced.open = true;
      handle.closeSheet();
      handle.openSheet("settings");
      expect(el("advanced").open).toBe(true);
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
      handle.state.tab = "mine"; handle.state.mineView = "timeline"; handle.render();
      const block = document.querySelector("#view-mine .tl-block");
      const hdr = document.querySelector(".hdr");
      hdr.getBoundingClientRect = () => ({ height: 77, top: 0, left: 0, right: 0, bottom: 77, width: 0 });
      handle.openSheet("settings");
      el("bigText").click();
      expect(document.documentElement.style.getPropertyValue("--hdr-h")).toBe("77px");
      expect(document.querySelector("#view-mine .tl-block")).toBeTruthy();
      expect(document.querySelector("#view-mine .tl-block")).not.toBe(block);
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

/* The same sheet on a build with a backend (DECISIONS #53): Keep your plan
   sits between Advanced and Done. These extend [1701] and [1703] to that
   layout, so both are pinned; they are new tests, not ledger rows, and
   their titles carry no harness line. */
describe("the Settings sheet on a build with a backend", () => {
  let page, panel, advanced;
  const el = id => document.getElementById(id);

  beforeAll(async () => {
    page = await bootPage({ backend: fakeBackend() });
    page.handle.openSheet("settings");
    panel = el("panel-settings");
    advanced = el("advanced");
  }, 30000);
  afterAll(() => { page.handle.closeSheet(); return page.cleanup(); });

  it("Keep your plan sits after Advanced and before Done, the everyday controls above it as they were", () => {
    const children = [...panel.children];
    expect(children[0].id).toBe("sheetTitle");
    expect(children[4]).toBe(advanced);
    expect(children[5]).toBe(el("keep"));
    expect(children[6].contains(el("closeSheet"))).toBe(true);
    expect(el("keep").hidden).toBe(false);
  });
  it("outside Advanced, the Keep section's buttons, then Done and Remove all picks, in that order", () => {
    expect([...panel.querySelectorAll("button")].filter(b => !advanced.contains(b)).map(b => b.id))
      .toEqual(["keepSend", "keepConfirm", "keepSignOut", "closeSheet", "resetPicks"]);
  });
  it("Remove all picks is still last, still destructive, outside Advanced and on its own row", () => {
    const reset = el("resetPicks");
    expect([...panel.querySelectorAll("button, input, select, summary")].pop()).toBe(reset);
    expect(reset.classList.contains("danger")).toBe(true);
    expect(advanced.contains(reset)).toBe(false);
    expect(reset.parentElement).not.toBe(el("closeSheet").parentElement);
  });
});
