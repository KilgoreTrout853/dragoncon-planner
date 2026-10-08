/* A build that carries its clock (DECISIONS #99): DC_NOW gives it a default
   moment, the home clock, which the page opens at with no ?now= and an
   empty session - as a launch from the home screen opens it - and goes back
   to when the reader clears a moment of their own. At the default there is
   no chip: that simply is the time. The page is built with the default as
   the build defines it, by tests/helpers/page.js. The order's and the
   clock's pure parts are tests/unit/time.test.js's; the build's guard is
   tests/unit/clock-env.test.js's. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

const DEFAULT = "2026-09-01T10:00", SATURDAY = "2026-09-05T13:05", SUNDAY = "2026-09-06T09:30";
const KEY = "dc26.timeOverride";
const ms = at => new Date(at).getTime();
const el = id => document.getElementById(id);
const shownTab = () => document.querySelector('.nav button[aria-current="page"]').dataset.tab;
/* The clock as the reader has it: its words, the chip, the address, the session. */
const clock = () => ({ says: el("clock").textContent.trim(), chip: !el("simChip").hidden, address: window.location.search, session: window.sessionStorage.getItem(KEY) });
const AT_HOME = { says: "Tue 10:00 AM", chip: false, address: "", session: null };
const ON_SATURDAY = { says: "Sat 1:05 PM", chip: true, address: `?now=${SATURDAY}`, session: SATURDAY };
/* Settings' field set and its button tapped, as a reader does it. */
function apply(handle, value) {
  handle.openSheet("settings");
  el("previewTime").value = value;
  el("applyPreview").click();
}

describe("a build with a default moment, opened at its bare address in a fresh session", () => {
  let page, app, handle, text;

  beforeAll(async () => {
    page = await bootPage({ now: null, home: DEFAULT });
    ({ app, handle, text } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("opens at the default: now() is it, and the header says Tue 10:00 AM", () => {
    expect(handle.now().getTime()).toBe(ms(DEFAULT));
    expect(text("clock")).toBe("Tue 10:00 AM");
  });
  it("before the con, so on Explore", () => {
    expect(app.conPhase()).toBe("before");
    expect(handle.state.tab).toBe("explore");
    expect(shownTab()).toBe("explore");
    expect(el("view-explore").hidden).toBe(false);
  });
  it("with no chip: at the default that simply is the time", () => {
    expect(app.isSimulated()).toBe(false);
    expect(el("simChip").hidden).toBe(true);
  });
  it("and nothing in the address or the session", () => {
    expect(clock()).toEqual(AT_HOME);
    expect(Object.keys(window.sessionStorage)).toEqual([]);
  });
  it("the header's line says the count alone: the schedule was refreshed after the moment shown", () => {
    expect(text("fresh")).toMatch(/^· [\d,]+ events$/);
  });
  it("the banner stands on Now, and not on the tab the page opened on", () => {
    expect(el("notice").hidden).toBe(true);
    document.querySelector('.nav button[data-tab="now"]').click();
    expect(el("notice").hidden).toBe(false);
    expect(text("notice")).toMatch(/^Con starts Thursday\. This tab is showing Thursday 10:00 AM as a preview\./);
    document.querySelector('.nav button[data-tab="explore"]').click();
    expect(el("notice").hidden).toBe(true);
  });
  it("wallClock() is the real clock all the same: a default moves no sync stamp", () => {
    const before = Date.now(), wall = app.wallClock().getTime(), after = Date.now();
    expect(wall).toBeGreaterThanOrEqual(before);
    expect(wall).toBeLessThanOrEqual(after);
    expect(wall).not.toBe(handle.now().getTime());
  });

  describe("Settings", () => {
    afterEach(() => { handle.closeSheet(); if (app.isSimulated()) handle.setTimeOverride(null); });

    it("the field shows the default, so a phone's picker opens on the con and not on today's real date", () => {
      handle.openSheet("settings");
      expect(el("previewTime").value).toBe(DEFAULT);
    });
    it("the readout says the build's clock, before the build time, which stays last", () => {
      handle.openSheet("settings");
      expect(text("deviceLine")).toMatch(/ · clock 2026-09-01T10:00 · build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
      expect(text("deviceLine")).not.toMatch(/email off|sync:/);
    });
    it("applying the default itself sets no moment: no chip, nothing in the address or the session", () => {
      apply(handle, DEFAULT);
      expect(el("sheetWrap").hidden).toBe(true);
      expect(app.isSimulated()).toBe(false);
      expect(clock()).toEqual(AT_HOME);
    });
    it("a time set in Settings is the reader's own: the chip shows, and the address and the session keep it", () => {
      apply(handle, SATURDAY);
      expect(handle.now().getTime()).toBe(ms(SATURDAY));
      expect(clock()).toEqual(ON_SATURDAY);
    });
    it("the field then shows the reader's moment, not the default", () => {
      apply(handle, SATURDAY);
      handle.openSheet("settings");
      expect(el("previewTime").value).toBe(SATURDAY);
    });
    it("the header's line still says the count alone", () => {
      apply(handle, SATURDAY);
      expect(text("fresh")).toMatch(/^· [\d,]+ events$/);
    });
    it("the chip's tap goes back to the default, not to today", () => {
      apply(handle, SATURDAY);
      el("simChip").click();
      expect(handle.now().getTime()).toBe(ms(DEFAULT));
      expect(clock()).toEqual(AT_HOME);
    });
    it("Clear preview time goes back to the default too", () => {
      apply(handle, SATURDAY);
      handle.openSheet("settings");
      el("clearPreview").click();
      expect(el("sheetWrap").hidden).toBe(true);
      expect(handle.now().getTime()).toBe(ms(DEFAULT));
      expect(clock()).toEqual(AT_HOME);
    });
    it("the default applied over a moment of the reader's own clears it: home again, no chip", () => {
      apply(handle, SATURDAY);
      apply(handle, DEFAULT);
      expect(clock()).toEqual(AT_HOME);
    });
    it("a blank field applied closes the sheet and changes nothing, at home or at the reader's moment", () => {
      apply(handle, "");
      expect(el("sheetWrap").hidden).toBe(true);
      expect(clock()).toEqual(AT_HOME);
      apply(handle, SATURDAY);
      apply(handle, "");
      expect(clock()).toEqual(ON_SATURDAY);
    });
  });
});

describe("a build with a default moment, opened by a link that names another", () => {
  let page;

  beforeAll(async () => { page = await bootPage({ now: SATURDAY, home: DEFAULT }); }, 30000);
  afterAll(() => page.cleanup());

  it("the address's ?now= still wins: Saturday, live, on Now, the chip showing", () => {
    expect(page.handle.now().getTime()).toBe(ms(SATURDAY));
    expect(clock()).toEqual(ON_SATURDAY);
    expect(page.handle.state.tab).toBe("now");
  });
  it("and its chip goes back to the default", () => {
    el("simChip").click();
    expect(page.handle.now().getTime()).toBe(ms(DEFAULT));
    expect(clock()).toEqual(AT_HOME);
  });
});

describe("a build with a default moment, reloaded in a session that kept a moment", () => {
  let page;

  beforeAll(async () => {
    window.sessionStorage.setItem(KEY, SUNDAY);
    page = await bootPage({ now: null, home: DEFAULT });
  }, 30000);
  afterAll(() => page.cleanup());

  it("the session's moment carries on, over the default, with the chip", () => {
    expect(page.handle.now().getTime()).toBe(ms(SUNDAY));
    expect(clock()).toEqual({ says: "Sun 9:30 AM", chip: true, address: "", session: SUNDAY });
  });
});

describe("a build with no default is as it was", () => {
  let page;

  beforeAll(async () => { page = await bootPage({ now: null }); }, 30000);
  afterAll(() => page.cleanup());

  it("with no ?now= and an empty session, the real clock, and no chip", () => {
    expect(Math.abs(page.handle.now().getTime() - Date.now())).toBeLessThan(5000);
    expect(page.app.isSimulated()).toBe(false);
    expect(el("simChip").hidden).toBe(true);
    expect(page.app.homeMoment).toBe("");
  });
  it("Settings' field is blank, and the readout says nothing of a clock", () => {
    page.handle.openSheet("settings");
    expect(el("previewTime").value).toBe("");
    expect(page.text("deviceLine")).not.toMatch(/clock|email off|sync:/);
    page.handle.closeSheet();
  });
  it("the header's line says how fresh the schedule is, after the count", () => {
    expect(page.text("fresh")).toMatch(/^· [\d,]+ events · \S/);
  });
  it("a time applied is the reader's own, and clearing it is the real clock again", () => {
    apply(page.handle, DEFAULT);
    expect(clock()).toEqual({ says: "Tue 10:00 AM", chip: true, address: `?now=${DEFAULT}`, session: DEFAULT });
    el("simChip").click();
    expect(Math.abs(page.handle.now().getTime() - Date.now())).toBeLessThan(5000);
    expect(clock().chip).toBe(false);
  });
});

/* The words are one wording, true on both kinds of build: neither says "the
   real clock", which a build with a default does not go back to. */
describe("the chip's and Settings' words", () => {
  let page;

  beforeAll(async () => { page = await bootPage({ now: SATURDAY }); }, 30000);
  afterAll(() => page.cleanup());

  it("the chip says simulated time, and is named for what its tap does", () => {
    expect(el("simChip").textContent.replace(/\s+/g, " ").trim()).toBe("simulated time ×");
    expect(el("simChip").getAttribute("aria-label")).toBe("Simulated time. Tap to clear it");
  });
  it("Settings' label and its two buttons", () => {
    page.handle.openSheet("settings");
    const label = el("previewTime").closest("label");
    expect(label.textContent.replace(/\s+/g, " ").trim()).toBe("Preview a different time");
    expect([el("applyPreview").textContent, el("clearPreview").textContent]).toEqual(["Apply preview time", "Clear preview time"]);
    expect(document.getElementById("panel-settings").textContent).not.toMatch(/real clock|real time/i);
    page.handle.closeSheet();
  });
});
