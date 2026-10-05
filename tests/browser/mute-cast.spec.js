/* Mute, the Muted fold and the cast folds (DECISIONS #84, #85), where jsdom
   cannot say: Follow and Mute whole on one line, a muted chip's row that
   scrolls where the page does not, and 44 px or more of every control these
   added - Mute, a fold's button wherever the app draws one, a muted chip's
   name and its x (#66). One page a test, walked, every assertion soft and
   named for where it was read. With Larger text off and on. */
import { CLOCKS, READERS, check, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const READER = READERS["a reader with picks and follows"];
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
/* a third mute, so the row is wider than any of the three screens */
const MUTES = [...READER.mutes, { kind: "track", key: "Artemis Spaceship Bridge Simulator" }];

/* The boxes of what a selector finds, shown or scrolled away. */
const boxes = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(el => {
  const b = el.getBoundingClientRect();
  return { text: el.textContent.trim().replace(/\s+/g, " "), left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
}), selector);

/* The two standing checks, on the controls of the screen as it stands. */
async function whole(page, where) {
  const found = await check(page);
  expect.soft(found.sideways, `${where}: nothing scrolls sideways`).toEqual([]);
  expect.soft(found.cut, `${where}: no control is cut off`).toEqual([]);
}
/* Every fold's button on the screen, 44 px tall or more; how many. */
async function folds(page, where) {
  const found = (await boxes(page, "main .divider.fold button")).filter(b => b.height > 0);
  for (const b of found) expect.soft(b.height, `${where}: the fold "${b.text}" is 44 px tall or more`).toBeGreaterThanOrEqual(44);
  return found.map(b => b.text);
}

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`Mute and the Muted fold${text}`, () => {
    test.use({ storageState: seed({ ...READER, mutes: MUTES, ...storage }) });

    test(`Follow and Mute stand whole on one line, 44 px tall or more, through a page's taps; a muted chip's name and its x are 44 px, and its row scrolls where the page does not${text}`, async ({ page }) => {
      await open(page, SATURDAY, "#explore=work:firefly");
      const head = page.locator("#view-explore .explore-head");
      const pair = async (where, words) => {
        await expect(head.locator(".eh-acts button")).toHaveText(words);
        const [follow, mute] = await boxes(page, "#view-explore .eh-acts button");
        expect.soft(Math.abs(follow.top - mute.top), `${where}: the two start on one line`).toBeLessThan(0.5);
        expect.soft(follow.right, `${where}: Follow ends before Mute begins`).toBeLessThanOrEqual(mute.left);
        expect.soft(follow.height, `${where}: Follow is 44 px tall or more`).toBeGreaterThanOrEqual(44);
        expect.soft(mute.height, `${where}: Mute is 44 px tall or more`).toBeGreaterThanOrEqual(44);
        const found = await check(page, "#view-explore .eh-acts button");
        expect.soft(found.count, `${where}: the two were found`).toBe(2);
        expect.soft(found.cut, `${where}: neither is cut off`).toEqual([]);
        await whole(page, where);
      };
      await pair("a page, Follow and Mute", ["Follow", "Mute"]);
      await expect(head.locator(".eh-muted")).toHaveCount(0);
      await head.locator(".follow-btn").tap();
      await pair("a page, Following and Mute", ["Following", "Mute"]);
      await head.locator(".mute-btn").tap();
      await pair("a page, muted", ["Follow", "Muted"]);
      await expect(head.locator(".eh-muted")).toHaveText("Not suggested to you. Still in Search, and here.");
      await head.locator(".mute-btn").tap();
      await pair("a page, unmuted", ["Follow", "Mute"]);

      /* the grid: the fold shut, then open */
      await page.locator('[data-act="explore-back"]').tap();
      const fold = page.locator('#muted [data-act="explore-muted"]');
      await expect(fold).toHaveAttribute("aria-expanded", "false");
      await expect(fold).toContainText(`Muted (${MUTES.length})`);
      expect.soft(await folds(page, "the grid, the fold shut"), "the grid: its folds").toContain(`Muted (${MUTES.length}) ▸`);
      await whole(page, "the grid, the fold shut");
      await fold.tap();
      await expect(page.locator('#muted [data-act="explore-muted"]')).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#muted .mute-chip")).toHaveCount(MUTES.length);
      await folds(page, "the grid, the fold open");
      for (const name of await boxes(page, "#muted .mute-chip .fc-name")) {
        expect.soft(name.height, `the muted chip "${name.text}": its name is 44 px tall or more`).toBeGreaterThanOrEqual(44);
      }
      for (const x of await boxes(page, "#muted .mute-chip .fc-x")) {
        expect.soft(x.height, "a muted chip's x is 44 px tall or more").toBeGreaterThanOrEqual(44);
        expect.soft(x.width, "a muted chip's x is 44 px wide or more").toBeGreaterThanOrEqual(44);
      }
      const row = await page.evaluate(() => { const r = document.querySelector("#muted .mute-chips"); return { scroll: r.scrollWidth, client: r.clientWidth, overflow: getComputedStyle(r).overflowX }; });
      expect.soft(row.scroll, "the muted chips' row is wider than its box").toBeGreaterThan(row.client);
      expect.soft(row.overflow, "and scrolls sideways").toBe("auto");
      await whole(page, "the grid, the fold open");
      /* the last chip, brought into its row's view, is whole, and its x unmutes */
      const last = page.locator("#muted .mute-chip").last();
      await last.scrollIntoViewIfNeeded();
      const found = await check(page, "#muted .mute-chip button");
      expect.soft(found.count, "the muted chips' buttons were found").toBe(MUTES.length * 2);
      expect.soft(found.cut, "no muted chip's button is cut off").toEqual([]);
      await last.locator(".fc-x").tap();
      await expect(page.locator("#muted .mute-chip")).toHaveCount(MUTES.length - 1);
      await whole(page, "the grid, a chip unmuted");
    });
  });

  test.describe(`the cast folds${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...storage }) });

    test(`a fold's button is 44 px tall or more, and nothing is cut or scrolls sideways: Following's cast shut, open and with its photo ops, and Search's${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      const cast = page.locator('#following [data-act="fol-cast"]');
      await expect(cast).toHaveCount(1);
      await expect(cast).toHaveAttribute("aria-expanded", "false");
      expect.soft((await folds(page, "Following")).some(t => t.startsWith("With the cast (")), "Following: the cast's fold is among its folds").toBe(true);
      await whole(page, "Following, the cast shut");
      await cast.tap();
      await expect(page.locator('#following [data-act="fol-cast"]')).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator('#following .row[data-list="folc:work:star-trek"]').first()).toBeVisible();
      await folds(page, "Following, the cast open");
      await whole(page, "Following, the cast open");
      const more = page.locator('#following [data-act="fol-cast-noise"]');
      const [box] = await boxes(page, '#following [data-act="fol-cast-noise"]');
      expect.soft(box.height, "the photo ops' button is 44 px tall or more").toBeGreaterThanOrEqual(44);
      const before = await page.locator('#following .row[data-list="folc:work:star-trek"]').count();
      await more.tap();
      await expect(page.locator('#following [data-act="fol-cast-noise"]')).toHaveCount(0);
      expect.soft(await page.locator('#following .row[data-list="folc:work:star-trek"]').count(), "the photo ops and signings joined the rows").toBeGreaterThan(before);
      await whole(page, "Following, the photo ops shown");
      /* By time: no fold of the cast's */
      await page.locator('#following [data-act="fol-time"]').tap();
      await expect(page.locator('#following [data-act="fol-cast"]')).toHaveCount(0);

      /* Search, the Fandom set in the filter sheet */
      await tab(page, "browse");
      await page.locator("#filtersBtn").tap();
      await page.locator("#fandom").selectOption("star-trek");
      await page.locator("#filtersShow").tap();
      await expect(page.locator("#sheetWrap")).toBeHidden();
      const group = page.locator('#browseRest [data-act="browse-cast"]');
      await expect(group).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator('#browseRest .row[data-list="browse-cast"]').first()).toBeAttached();
      expect.soft((await folds(page, "Search")).some(t => t.startsWith("With the cast (")), "Search: the cast's fold is among its folds").toBe(true);
      await whole(page, "Search, the cast open");
      await group.scrollIntoViewIfNeeded();
      await group.tap();
      await expect(page.locator('#browseRest [data-act="browse-cast"]')).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator('#browseRest .row[data-list="browse-cast"]')).toHaveCount(0);
      await folds(page, "Search, the cast shut");
      await whole(page, "Search, the cast shut");
    });
  });
}
