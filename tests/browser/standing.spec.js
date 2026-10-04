/* The two standing checks (DECISIONS #81), on each of the five tabs, for
   each reader at each standing clock: nothing scrolls sideways, and no
   control is cut off. One page a test, the five tabs walked, and every
   assertion soft and named for its tab, so a run reports every tab that
   fails and not the first alone. The rule is harness.js layout()'s, held on
   a page of its own by rule.spec.js. */
import { CLOCKS, READERS, TABS, check, expect, open, seed, tab, test } from "./harness.js";

for (const [who, storage] of Object.entries(READERS)) {
  test.describe(who, () => {
    test.use({ storageState: seed(storage) });
    for (const clock of CLOCKS.filter(c => c.standing)) {
      test(`nothing scrolls sideways and no control is cut off, on any tab: ${who}, ${clock.name}`, async ({ page }) => {
        await open(page, clock.now);
        /* the seed took: Plans counts the picks */
        if (storage.picks) await expect(page.locator("#plansBadge")).toHaveText(String(storage.picks.length));
        for (const name of TABS) {
          await tab(page, name);
          const found = await check(page);
          expect.soft(found.count, `${name}: its controls were found`).toBeGreaterThan(5);
          expect.soft(found.sideways, `${name}: nothing scrolls sideways`).toEqual([]);
          expect.soft(found.cut, `${name}: no control is cut off`).toEqual([]);
        }
      });
    }
  });
}
