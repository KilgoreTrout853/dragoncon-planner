/* The bottom sheet: one wrapper, three panels. The number in brackets is the
   harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("the bottom sheet", () => {
  let page, app, handle, firstTitle;
  const el = id => document.getElementById(id);

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    /* the harness arrived here with the first row of Now starred */
    const first = document.querySelector("#view-now .row");
    firstTitle = first.querySelector(".title").textContent.trim();
    handle.picks.set([first.dataset.id]);
    handle.render();
  }, 30000);
  afterAll(() => page.cleanup());

  describe("step 1: tapping a row opens the event panel", () => {
    beforeAll(() => document.querySelector("#view-now .row-main").click());

    it("row tap opens the sheet [60]", () => {
      expect(el("sheetWrap").hidden).toBe(false);
    });
    it("event panel is shown [61]", () => {
      expect(el("panel-event").hidden).toBe(false);
    });
    it("settings panel is hidden [62]", () => {
      expect(el("panel-settings").hidden).toBe(true);
    });
    it("sheet shows the tapped event's title [63]", () => {
      expect(el("sheetTitleEvent").textContent.trim()).toBe(firstTitle);
    });
    it("dialog is labelled by the event title [64]", () => {
      expect(el("sheet").getAttribute("aria-labelledby")).toBe("sheetTitleEvent");
    });
    it("sheet shows the room [65]", () => {
      expect(document.querySelector("#panel-event .ev-room")).toBeTruthy();
    });
    it("room is set in the hotel's hue [66]", () => {
      expect(document.querySelector("#panel-event .ev-room").getAttribute("style") || "").toMatch(/var\(--h-/);
    });
    it("sheet shows day/time/duration [67]", () => {
      expect(document.querySelector("#panel-event .ev-when").textContent.trim().length).toBeGreaterThan(0);
    });
  });

  describe("the star inside the sheet, on an event already picked", () => {
    const stored = () => JSON.parse(window.localStorage.getItem("dc26.picks"));

    it("sheet star reflects an existing pick [70]", () => {
      expect(el("sheetStar").getAttribute("aria-pressed")).toBe("true");
    });
    it("sheet star unstars [72]", () => {
      el("sheetStar").click();
      expect(el("sheetStar").getAttribute("aria-pressed")).toBe("false");
    });
    it("unstar persisted [73]", () => {
      expect(stored()).toHaveLength(0);
    });
    it("restar persisted [75]", () => {
      el("sheetStar").click();
      expect(stored()).toHaveLength(1);
    });
  });

  describe("closing clears everything the drag touched, or the next open is offset", () => {
    it("drag applies a transform [96]", () => {
      app.setDrag(120);
      expect(el("sheet").style.transform).not.toBe("");
    });
    it("closing clears the drag transform [98]", () => {
      handle.closeSheet();
      expect(el("sheet").style.transform).toBe("");
    });
    it("closing clears the backdrop fade [99]", () => {
      expect(el("sheetBack").style.opacity).toBe("");
    });
    it("closing clears the settling class [100]", () => {
      expect(el("sheet").classList.contains("settling")).toBe(false);
    });
    it("backdrop tap closes the sheet [104]", () => {
      document.querySelector("#view-now .row-main").click();
      expect(el("sheetWrap").hidden).toBe(false);
      el("sheetBack").click();
      expect(el("sheetWrap").hidden).toBe(true);
    });
    it("inline row expansion is gone [105]", () => {
      expect(document.querySelector(".detail")).toBe(null);
    });
  });

  describe("the settings panel", () => {
    it("settings opens [538]", () => {
      el("settingsBtn").click();
      expect(el("sheetWrap").hidden).toBe(false);
    });
    it("settings panel shown, event panel hidden [539]", () => {
      expect(el("panel-settings").hidden).toBe(false);
      expect(el("panel-event").hidden).toBe(true);
    });
    it("settings closes [541]", () => {
      el("closeSheet").click();
      expect(el("sheetWrap").hidden).toBe(true);
    });
  });
});
