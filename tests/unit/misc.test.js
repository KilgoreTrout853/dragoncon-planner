/* Pure exports of the modules under src/: no page, no schedule, no clock.
   The number in brackets is the harness line the assertion came from
   (tests/PORT-LEDGER.md). Importing a module can still touch the document, so
   this runs in jsdom; with no markup its DOM consts are null, and nothing
   here reaches them. */
import { describe, expect, it } from "vitest";
import { pickActiveSection } from "../../src/explore.js";
import { FOLLOW_KINDS } from "../../src/follows.js";
import { HOUR_PX } from "../../src/mine.js";
import { nudgeCopy } from "../../src/now.js";
import { IS_IOS } from "../../src/platform.js";
import { LEAVE_BUFFER_MIN } from "../../src/venues.js";

describe("constants the layout and the leave-by depend on", () => {
  it("leave-by: LEAVE_BUFFER_MIN is 10, the slack on every leave-by [116]", () => {
    expect(LEAVE_BUFFER_MIN).toBe(10);
  });
  it("the timeline: HOUR_PX is 60 [461]", () => {
    expect(HOUR_PX).toBe(60);
  });
  it("four kinds of follow [951]", () => {
    expect(FOLLOW_KINDS).toEqual(["track", "fandom", "topic", "person"]);
  });
  it("the edge-touch handlers are not wired up outside iOS [784]", () => {
    expect(IS_IOS).toBe(false);
  });
});

describe("the install nudge's copy", () => {
  it("the iOS copy covers the chat-app browser and never offers a button it cannot honour [842]", () => {
    const ios = nudgeCopy(true, false);
    expect(ios.body).toMatch(/Open in Safari/);
    expect(ios.body).toMatch(/Add to Home Screen/);
    expect(ios.install).toBe(false);
  });
  it("with a browser install prompt in hand, Android gets a real Install button [843]", () => {
    const android = nudgeCopy(false, true);
    expect(android.install).toBe(true);
    expect(android.lead).toMatch(/Install this app/);
  });
  it("anything else gets the generic wording [844]", () => {
    const other = nudgeCopy(false, false);
    expect(other.install).toBe(false);
    expect(other.lead).toMatch(/home screen/i);
  });
});

describe("which Explore section is on screen", () => {
  it("the section on screen is the last header past the sticky line [1062]", () => {
    expect(pickActiveSection([{ id: "track", top: -500 }, { id: "fandom", top: -10 }, { id: "topic", top: 300 }], 203)).toBe("fandom");
  });
  it("above the first header nothing is pressed [1064]", () => {
    expect(pickActiveSection([{ id: "track", top: 400 }], 203)).toBe(null);
  });
  it("and no headers means nothing pressed [1065]", () => {
    expect(pickActiveSection([], 203)).toBe(null);
  });
  it("at the end of the page the last section is current even if its header never reached the line [1066]", () => {
    expect(pickActiveSection([{ id: "track", top: -500 }, { id: "panelist", top: 300 }], 203, true)).toBe("panelist");
  });
});
