/* The install nudge on Now, while the reader has a pick and until the app is
   on the home screen (DECISIONS #65). The number in brackets is the harness
   line the assertion came from (tests/PORT-LEDGER.md); a test written since
   carries none. The nudge's copy is pure and lives in tests/unit/misc.test.js.

   A boot that needs a pick finds one in storage, as a returning reader's
   phone would: one event later on the preview Saturday. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootPage } from "../helpers/page.js";

const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sample-events.json"), "utf8"));
const PICK = fixture.events.find(e => e.start > "2026-09-05T13:05" && e.start < "2026-09-06" && e.hotel !== "Streaming").id;
const seedPick = () => window.localStorage.setItem("dc26.picks", JSON.stringify([PICK]));

describe("in a browser tab, with a pick", () => {
  let page, handle;
  const nudge = () => document.getElementById("nudge");

  beforeAll(async () => {
    seedPick();
    page = await bootPage();
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("outside a home-screen install, Now opens with the nudge [838]", () => {
    expect([...handle.picks.get()]).toEqual([PICK]);
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

/* Over an empty plan the nudge would be nagging: there is nothing yet for
   the home screen to keep (DECISIONS #65). */
describe("in a browser tab, with nothing starred", () => {
  let page, handle;
  const nudge = () => document.getElementById("nudge");

  beforeAll(async () => {
    page = await bootPage();
    ({ handle } = page);
  }, 30000);
  afterAll(() => page.cleanup());

  it("Now has no nudge", () => {
    expect(handle.picks.get().size).toBe(0);
    expect(document.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
    expect(nudge()).toBe(null);
  });
  it("starring something brings it, first on Now", () => {
    document.querySelector('#view-now .row[data-list="around"] .star').click();
    expect(handle.picks.get().size).toBe(1);
    expect(document.querySelector("#view-now > *")).toBe(nudge());
  });
  it("and unstarring the last pick takes it away again", () => {
    document.querySelector('#view-now .row[data-list="around"] .star[aria-pressed="true"]').click();
    expect(handle.picks.get().size).toBe(0);
    expect(nudge()).toBe(null);
  });
});

/* The harness reassigned isStandalone. It asks matchMedia, so answer that. */
describe("opened from the home screen", () => {
  let page;
  beforeAll(async () => { seedPick(); page = await bootPage({ matchMedia: query => /display-mode: standalone/.test(query) }); }, 30000);
  afterAll(() => page.cleanup());

  it("and an installed app never shows it, though there is a pick [839]", () => {
    expect(page.app.isStandalone()).toBe(true);
    expect(page.handle.picks.get().size).toBe(1);
    expect(document.querySelectorAll("#view-now .row").length).toBeGreaterThan(0);
    expect(document.getElementById("nudge")).toBe(null);
  });
});
