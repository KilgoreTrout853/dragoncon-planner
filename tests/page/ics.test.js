/* Calendar export: one event from the sheet, all of them from Mine. The number
   in brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("calendar export", () => {
  let page, handle, firstTitle, exported, restore;

  /* the download is a blob behind an object URL and a click on a link jsdom
     would try to follow; catch the blob, swallow the click */
  function catchDownloads() {
    const had = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: HTMLAnchorElement.prototype.click };
    URL.createObjectURL = blob => { exported = blob.text(); return "blob:x"; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    return () => { URL.createObjectURL = had.create; URL.revokeObjectURL = had.revoke; HTMLAnchorElement.prototype.click = had.click; };
  }

  beforeAll(async () => {
    page = await bootPage();
    ({ handle } = page);
    restore = catchDownloads();
    const first = document.querySelector("#view-now .row");
    firstTitle = first.querySelector(".title").textContent.trim();
    handle.picks.set([first.dataset.id]);
    handle.render();
  }, 30000);
  afterAll(async () => { restore(); await page.cleanup(); });

  describe("one event, from the sheet", () => {
    let text;
    beforeAll(async () => {
      document.querySelector("#view-now .row-main").click();
      document.getElementById("sheetICS").click();
      text = await exported;
      handle.closeSheet();
    });

    it("sheet exports exactly one VEVENT [82]", () => {
      expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    });
    it("single-event ICS carries the Eastern timezone [83]", () => {
      expect(text).toMatch(/DTSTART;TZID=America\/New_York:2026090[0-9]T\d{6}/);
    });
    it("single-event ICS is the event from the sheet [84]", () => {
      expect(text).toContain(firstTitle.slice(0, 20));
    });
  });

  it("ICS export has events with TZ [506]", async () => {
    handle.state.tab = "mine";
    handle.render();
    document.querySelector('#view-mine [data-act="ics"]').click();
    const text = await exported;
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("TZID=America/New_York");
    expect(text).toMatch(/DTSTART;TZID=America\/New_York:2026090[0-9]T\d{6}/);
  });
});
