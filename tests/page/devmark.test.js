/* The dev-build mark: only on a build stamped with a channel. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md).
   The stamps are the two metas the build writes; that the build writes them
   is tests/build.test.js. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("an unstamped page", () => {
  let page, key;
  beforeAll(async () => { page = await bootPage(); key = page.app.TIME_OVERRIDE_KEY; }, 30000);
  afterAll(() => page.cleanup());

  it("unstamped, there is no mark and no channel [1988]", () => {
    expect(document.querySelector(".devmark")).toBe(null);
    expect(page.app.BUILD).toEqual({ channel: "", id: "" });
  });
  it("and the unstamped page keeps the plain key for its simulated clock [2002, merged into 2000]", () => {
    expect(key).toBe("dc26.timeOverride");
  });
});

describe("a page stamped with a channel and a build id", () => {
  let page;
  beforeAll(async () => { page = await bootPage({ channel: "next", build: "abc1234" }); }, 30000);
  afterAll(() => page.cleanup());

  it("stamped with a channel, the mark reads dev build · next · build [1995]", () => {
    expect(document.querySelector(".devmark").textContent).toBe("dev build · next · abc1234");
  });
  it("it is decorative [1996, the page half]", () => {
    expect(document.querySelector(".devmark").getAttribute("aria-hidden")).toBe("true");
  });
  it("the device readout names the channel and build [1998]", () => {
    expect(page.app.deviceLine()).toMatch(/next build abc1234/);
  });
  it("and the page otherwise works as it does unstamped [1999]", () => {
    expect(page.text("clock")).toMatch(/^Sat 1:05 PM/);
    expect(document.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
  });
  it("a stamped page keeps its simulated clock under a key of its own, so it never follows the reader to the live site on the same origin [2000]", () => {
    expect(page.app.TIME_OVERRIDE_KEY).toBe("dc26.timeOverride.next");
    expect(window.sessionStorage.getItem("dc26.timeOverride.next")).toBe("2026-09-05T13:05");
    expect(window.sessionStorage.getItem("dc26.timeOverride")).toBe(null);
  });
});
