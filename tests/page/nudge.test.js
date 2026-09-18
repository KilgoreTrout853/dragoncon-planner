/* The install nudge on Now, until the app is on the home screen. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md);
   the nudge's copy is pure and lives in tests/unit/misc.test.js. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("in a browser tab", () => {
  let page, handle;
  const nudge = () => document.getElementById("nudge");

  beforeAll(async () => {
    page = await bootPage();
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("outside a home-screen install, Now opens with the nudge [838]", () => {
    expect(nudge()).toBeTruthy();
    expect(document.querySelector("#view-now > *")).toBe(nudge());
  });
  it("here, with no prompt captured, there is no Install button [845]", () => {
    expect(document.querySelector('#view-now [data-act="nudge-install"]')).toBe(null);
  });

  /* The harness matched `e.preventDefault(); installPrompt = e` in the source. */
  it("the browser install prompt is captured for the button to fire [846]", () => {
    const offer = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: vi.fn() });
    window.dispatchEvent(offer);
    expect(offer.defaultPrevented).toBe(true);                       // the browser's own banner is held back
    const install = document.querySelector('#view-now [data-act="nudge-install"]');
    expect(install).toBeTruthy();
    install.click();
    expect(offer.prompt).toHaveBeenCalledTimes(1);
  });

  it("Not now hides it for a week [840]", () => {
    document.querySelector('#view-now [data-act="nudge-later"]').click();
    expect(nudge()).toBe(null);
    const until = JSON.parse(window.localStorage.getItem("dc26.nudgeSnoozedUntil"));
    expect(until).toBeGreaterThan(handle.now().getTime() + 6 * 24 * 3600 * 1000);
  });
  it("after which it comes back [841]", () => {
    window.localStorage.setItem("dc26.nudgeSnoozedUntil", JSON.stringify(handle.now().getTime() - 1000));
    handle.render();
    expect(nudge()).toBeTruthy();
  });
});

/* The harness reassigned isStandalone. It asks matchMedia, so answer that. */
describe("opened from the home screen", () => {
  let page;
  beforeAll(async () => { page = await bootPage({ matchMedia: query => /display-mode: standalone/.test(query) }); }, 30000);
  afterAll(() => page.cleanup());

  it("and an installed app never shows it [839]", () => {
    expect(page.app.isStandalone()).toBe(true);
    expect(document.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
    expect(document.getElementById("nudge")).toBe(null);
  });
});
