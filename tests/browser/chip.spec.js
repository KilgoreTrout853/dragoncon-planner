/* The header's simulated-time chip (DECISIONS #82): the one tap back to the
   real clock. While the clock is simulated it is drawn whole - the words
   after it give way, never the chip - and its tap area is 44 px tall or
   more, inside the header. The brand stands over the line on Now alone, so
   each is read on Now and on one tab without it. */
import { CLOCKS, answers, check, chipArea, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const HEADERS = ["browse", "now"];
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const simulated = page => page.evaluate(() => new URLSearchParams(location.search).has("now"));

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`the simulated-time chip${text}`, () => {
    test.use({ storageState: seed(storage) });

    for (const clock of CLOCKS) {
      test(`is drawn whole${text}: ${clock.name}`, async ({ page }) => {
        await open(page, clock.now);
        for (const name of HEADERS) {
          await tab(page, name);
          await expect.soft(page.locator("#simChip"), `${name}: the chip is shown`).toBeVisible();
          const found = await check(page, "#simChip");
          expect.soft(found.count, `${name}: the chip was found`).toBe(1);
          expect.soft(found.cut, `${name}: the chip is not cut off`).toEqual([]);
          expect.soft(await page.evaluate(answers, "#simChip"), `${name}: each edge of the chip answers a tap`)
            .toEqual({ left: true, right: true, top: true, bottom: true });
        }
      });
    }

    test(`has a tap area 44 px tall or more, inside the header, that takes no tap of the gear's or the page's${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      let area;
      for (const name of HEADERS) {
        await tab(page, name);
        area = await page.evaluate(chipArea);
        expect.soft(area.hdrH, `${name}: --hdr-h is what it was`).toBe("63px");
        expect.soft(area.header.height, `${name}: the header's height is what it was`).toBe(63);
        if (area.top === null) { expect.soft(area.top, `${name}: the chip answers a tap somewhere`).not.toBeNull(); continue; }
        expect.soft(area.unbroken, `${name}: the area is one piece`).toBe(true);
        expect.soft(area.bottom - area.top, `${name}: the area's height`).toBeGreaterThanOrEqual(44);
        expect.soft(area.top, `${name}: the area starts inside the header`).toBeGreaterThanOrEqual(area.header.top);
        expect.soft(area.bottom, `${name}: the area ends inside the header`).toBeLessThan(area.header.bottom);
        expect.soft(area.beside, `${name}: the area is no wider than the chip`).toEqual({ left: false, right: false });
        expect.soft(area.underHeader.inHeader, `${name}: the first px under the header is the page's`).toBe(false);
      }
      /* no tap until the area is where it should be */
      if (test.info().errors.length) return;
      /* On Now. The first px of the page under the header: not the chip's. */
      await page.touchscreen.tap(area.x, area.underHeader.y);
      await expect(page.locator("#simChip")).toBeVisible();
      expect(await simulated(page), "a tap under the header leaves the clock simulated").toBe(true);
      await expect(page.locator("#sheetWrap")).toBeHidden();
      /* The gear takes its own tap. */
      await page.locator("#settingsBtn").tap();
      await expect(page.locator("#panel-settings")).toBeVisible();
      expect(await simulated(page), "a tap on the gear leaves the clock simulated").toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.locator("#sheetWrap")).toBeHidden();
      /* And the area's top edge is the chip's. */
      await page.touchscreen.tap(area.x, area.top);
      await expect(page.locator("#simChip")).toBeHidden();
      expect(await simulated(page), "a tap at the area's top edge returns the real clock").toBe(false);
    });
  });
}

test.describe("the simulated-time chip", () => {
  test("a tap on it returns the real clock and takes it away", async ({ page }) => {
    await open(page, SATURDAY);
    await expect(page.locator("#clock")).toHaveText("Sat 1:05 PM");
    await page.locator("#simChip").tap();
    await expect(page.locator("#simChip")).toBeHidden();
    expect(await simulated(page), "the address no longer names a moment").toBe(false);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes("timeOverride"))), "nor does the session").toEqual([]);
  });

  test("is not drawn while the clock is real", async ({ page }) => {
    await open(page, null);
    await expect(page.locator("#simChip")).toBeHidden();
    await expect(page.locator("#simChip")).toHaveCount(1);
  });
});
