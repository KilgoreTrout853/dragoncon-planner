/* Boot: the first screen draws before the search index exists. The number in
   brackets is the harness line the assertion came from (tests/PORT-LEDGER.md). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";

describe("a first boot", () => {
  let page, indexAtFirstRender;

  beforeAll(async () => {
    page = await bootPage();
    indexAtFirstRender = page.app.BOOT.indexAtRender;          // read before the idle build can run
    await page.until(() => page.app.BOOT.suggested > 0, 20000, "the index build");
  }, 30000);
  afterAll(() => page.cleanup());

  it("the first render happened with no index; the index came later and the suggestion index after it [23]", () => {
    const boot = page.app.BOOT;
    expect(indexAtFirstRender).toBe(false);
    expect(boot.rendered).toBeGreaterThanOrEqual(boot.parsed);
    expect(boot.indexed).toBeGreaterThan(boot.rendered);
    expect(boot.suggested).toBeGreaterThan(boot.indexed);
  });
  it("clock shows preview time [27]", () => {
    expect(page.text("clock")).toMatch(/^Sat 1:05 PM/);
  });
  it("freshness line [28]", () => {
    expect(page.text("fresh")).toMatch(/[\d,]+ events · refreshed/);
  });
});

/* The harness matched `requestIdleCallback(fn, {timeout: 2000}) : setTimeout(fn, 0)`
   in the source. jsdom has no requestIdleCallback, so the boot above already
   ran on the setTimeout fallback; this one gives the page the real thing. */
describe("a boot in a browser that has requestIdleCallback", () => {
  let page;
  const calls = [];

  beforeAll(async () => {
    const idle = (fn, options) => { calls.push({ options }); return setTimeout(fn, 0); };
    window.requestIdleCallback = idle;
    globalThis.requestIdleCallback = idle;
    page = await bootPage();
    await page.until(() => page.app.BOOT.suggested > 0, 20000, "the index build");
  }, 30000);
  afterAll(async () => {
    await page.cleanup();
    delete window.requestIdleCallback;
    delete globalThis.requestIdleCallback;
  });

  it("the index builds in idle time, with a two-second timeout, and the suggestion index in a later idle slot [26]", () => {
    expect(calls.map(c => c.options)).toEqual([{ timeout: 2000 }, { timeout: 2000 }]);
    expect(page.app.BOOT.suggested).toBeGreaterThan(page.app.BOOT.indexed);
  });
});
