/* Before the con (DECISIONS #99): the preview banner stands on Now alone.
   Above the Map it was not counted in the tab's height, so the tab stood
   taller than the screen by the banner and its margin - main scrolled 73 px
   at every size, in both engines - and the card under the map was cut by the
   nav for a reader with picks at 375 and 390 wide. So: before the con the
   Map does not scroll - main is no taller than its box - and its card is
   whole, between the header and the nav; and the banner is drawn whole on
   Now and on no other tab. After the con the has-ended notice still stands
   above every tab, the Map among them, until its OK: that is as built. */
import { CLOCKS, READERS, TABS, expect, open, seed, tab, test } from "./harness.js";

const BEFORE = CLOCKS.find(clock => clock.name.startsWith("before the con")).now;
const BANNER = "Preview. This tab is showing Thursday 10:00 AM, the con's first full day. Settings can preview any other time.";
const SLACK = 0.5;

/* Read in the page: main's two heights, whether the notice is shown and
   where, and the card under the map against the header, the nav and the
   screen's sides. */
function read() {
  const main = document.querySelector("main"), notice = document.getElementById("notice");
  const box = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
  const card = document.querySelector("#view-map .next-card");
  return {
    scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollTop: main.scrollTop,
    notice: notice.hidden || !notice.getClientRects().length ? null : { ...box(notice), text: notice.textContent.replace(/\s+/g, " ").trim() },
    card: card && card.getClientRects().length ? box(card) : null,
    header: box(document.querySelector(".hdr")).bottom, nav: box(document.querySelector(".nav")).top, width: document.documentElement.clientWidth,
  };
}

for (const [who, storage] of Object.entries(READERS)) {
  test.describe(`before the con, ${who}`, () => {
    test.use({ storageState: seed(storage) });

    test(`the Map does not scroll and its card is whole: ${who}`, async ({ page }) => {
      await open(page, BEFORE);
      await tab(page, "map");
      const at = await page.evaluate(read);
      expect.soft(at.notice, "no banner stands above the Map").toBeNull();
      expect.soft(at.scrollHeight, "main is no taller than its box").toBeLessThanOrEqual(at.clientHeight);
      expect.soft(at.scrollTop, "and stands at its top").toBe(0);
      expect(at.card, "the card under the map is drawn").not.toBeNull();
      expect.soft(at.card.height, "the card has a height").toBeGreaterThan(20);
      expect.soft(at.card.top, "the card starts under the header").toBeGreaterThanOrEqual(at.header - SLACK);
      expect.soft(at.card.bottom, "the card ends above the nav").toBeLessThanOrEqual(at.nav + SLACK);
      expect.soft(at.card.left, "the card starts on the screen").toBeGreaterThanOrEqual(-SLACK);
      expect.soft(at.card.right, "the card ends on the screen").toBeLessThanOrEqual(at.width + SLACK);
    });

    test(`the banner stands whole on Now, and on no other tab: ${who}`, async ({ page }) => {
      await open(page, BEFORE);
      for (const name of TABS) {
        await tab(page, name);
        const at = await page.evaluate(read);
        if (name !== "now") { expect.soft(at.notice, `${name}: no banner`).toBeNull(); continue; }
        expect(at.notice, "now: the banner is drawn").not.toBeNull();
        expect.soft(at.notice.text, "now: its words").toBe(BANNER);
        expect.soft(at.scrollTop, "now: the page is at its top").toBe(0);
        expect.soft(at.notice.top, "now: it starts under the header").toBeGreaterThanOrEqual(at.header - SLACK);
        expect.soft(at.notice.bottom, "now: it ends above the nav").toBeLessThanOrEqual(at.nav + SLACK);
        expect.soft(at.notice.left, "now: it starts on the screen").toBeGreaterThanOrEqual(-SLACK);
        expect.soft(at.notice.right, "now: it ends on the screen").toBeLessThanOrEqual(at.width + SLACK);
      }
    });
  });
}
