/* The zero state, in For you's place on Explore's grid (DECISIONS #88), where
   jsdom cannot say: for a stranger it stands first and whole at each size -
   nothing scrolling sideways, no control cut - "Start here" and its line,
   then "The big ones" with four rows and Show all, which is 44 px tall or
   more (#66) and opens the rest in place. And a star in it holds what is on
   screen until the grid is drawn from somewhere else: then the big ones
   less the star, without "Start here", or For you where the star gave it a
   row. One page a test, walked, every assertion soft and named for where it
   was read. Before the con, when Explore is the tab the app opens on (#62),
   and on its Saturday, with Larger text off and on.

   The reader is a stranger: nothing is seeded but the text's size. */
import { CLOCKS, check, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0], BEFORE = CLOCKS[2];
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const LINE = "Tap a star and the event goes on your plan. Follow a track, a fandom or a guest below, and its events show up here.";
/* What the real schedule lists at each clock (tests/real-data.test.js). */
const LISTS = [
  { clock: BEFORE, opens: true, count: 23, first: "WABE: Imagined Worlds, Real Nation – 40 Years of Fandom & America at 250" },
  { clock: SATURDAY, opens: false, count: 12, first: "The Rookie Guests" },
];

/* What the zero state shows: its headings, its line with whether its words
   lie inside the section, each row's title, day and list, and Show all's
   box; with whether For you, or the grid's hint, is on the page. */
const shown = page => page.evaluate(() => {
  const section = document.getElementById("zero"), words = el => el.textContent.replace(/\s+/g, " ").trim();
  const state = { foryou: !!document.getElementById("foryou"), hint: !!document.querySelector("#exploreGrid .hint") };
  if (!section) return { ...state, zero: null };
  const all = section.querySelector('[data-act="zero-all"]'), box = all && all.getBoundingClientRect();
  const line = section.querySelector(".fy-line"), s = section.getBoundingClientRect(), l = line && line.getBoundingClientRect();
  return {
    ...state,
    zero: {
      first: document.getElementById("view-explore").firstElementChild === section,
      heads: [...section.querySelectorAll(".fy-head")].map(words),
      line: line && { text: words(line), inside: l.width > 0 && l.left >= s.left && l.right <= s.right },
      rows: [...section.querySelectorAll(".row")].map(row => ({ title: words(row.querySelector(".title")), day: words(row.querySelector(".when .day")),
        list: row.dataset.list, starred: row.querySelector(".star").getAttribute("aria-pressed") === "true" })),
      all: all && { text: words(all), height: box.height, width: box.width },
    },
  };
});
async function whole(page, where) {
  const found = await check(page);
  expect.soft(found.sideways, `${where}: nothing scrolls sideways`).toEqual([]);
  expect.soft(found.cut, `${where}: no control is cut off`).toEqual([]);
}
const starOf = title => `#zero .row:has(.title:text-is("${title}")) .star`;

for (const [text, storage] of Object.entries(TEXT)) {
  for (const { clock, opens, count, first } of LISTS) {
    test.describe(`the zero state, ${clock.name}${text}`, () => {
      test.use({ storageState: seed(storage) });

      test(`stands first and whole for a stranger: Start here and its line, four big ones with the day on each, Show all 44 px tall or more, and the rest in place${text}`, async ({ page }) => {
        const where = `${clock.name}${text}`;
        await open(page, clock.now);
        if (opens) await expect(page.locator('nav button[data-tab="explore"]'), `${where}: the app opens on Explore`).toHaveAttribute("aria-current", "page");
        else await tab(page, "explore");
        let got = await shown(page);
        expect(got.zero, `${where}: the zero state is on the page`).not.toBeNull();
        expect.soft([got.foryou, got.hint], `${where}: no For you, and no hint in the grid`).toEqual([false, false]);
        expect.soft([got.zero.first, got.zero.heads], `${where}: first in the view, under its two headings`).toEqual([true, ["Start here", `The big ones (${count})`]]);
        expect.soft(got.zero.line, `${where}: the line, whole inside the section`).toEqual({ text: LINE, inside: true });
        expect.soft(got.zero.rows.length, `${where}: four rows`).toBe(4);
        expect.soft(got.zero.rows[0].title, `${where}: the soonest first`).toBe(first);
        for (const row of got.zero.rows) expect.soft([row.list, /^(Thu|Fri|Sat|Sun|Mon)$/.test(row.day)], `${where}: "${row.title}" is of the list big and says its day`).toEqual(["big", true]);
        expect.soft(got.zero.all.text, `${where}: Show all says how many there are`).toBe(`Show all ${count}`);
        expect.soft(got.zero.all.height, `${where}: Show all is 44 px tall or more`).toBeGreaterThanOrEqual(44);
        await whole(page, where);

        await page.locator('#zero [data-act="zero-all"]').tap();
        await expect(page.locator("#zero .row")).toHaveCount(count);
        got = await shown(page);
        expect.soft([got.zero.heads, got.zero.all], `${where}, all shown: the headings as they were, and no Show all`).toEqual([["Start here", `The big ones (${count})`], null]);
        await whole(page, `${where}, all shown`);
      });
    });
  }

  test.describe(`a star in the zero state${text}`, () => {
    test.use({ storageState: seed(storage) });

    test(`holds what is on screen, and another tab and back gives the big ones less the star without Start here, then For you once a star gives it a row${text}`, async ({ page }) => {
      await open(page, BEFORE.now);
      const before = await shown(page);
      expect(before.zero, "the zero state is on the page").not.toBeNull();
      const [wabe, , rookie] = before.zero.rows.map(row => row.title);
      expect.soft(rookie, "the third row is the one whose star gives For you a row").toBe("The Rookie Cast");

      await page.locator(starOf(wabe)).tap();
      await expect(page.locator(starOf(wabe))).toHaveAttribute("aria-pressed", "true");
      let got = await shown(page);
      expect.soft([got.zero.heads, got.zero.rows.map(row => row.title), got.zero.rows[0].starred, got.hint], "starred: the headings and the rows as they were, the row starred in its place, and still no hint")
        .toEqual([before.zero.heads, before.zero.rows.map(row => row.title), true, false]);
      await whole(page, "a big one starred");

      await tab(page, "plans");
      await tab(page, "explore");
      got = await shown(page);
      expect(got.zero, "another tab and back: the zero state is on the page").not.toBeNull();
      expect.soft([got.foryou, got.zero.heads, got.hint], "another tab and back: the big ones alone, one fewer, and the grid's hint").toEqual([false, ["The big ones (22)"], true]);
      expect.soft(got.zero.rows.map(row => row.title), "and the starred one is not among them").not.toContain(wabe);
      await whole(page, "the big ones alone");

      await page.locator(starOf(rookie)).tap();
      await expect(page.locator(starOf(rookie))).toHaveAttribute("aria-pressed", "true");
      got = await shown(page);
      expect.soft([got.foryou, got.zero && got.zero.heads], "a star that gives For you a row: For you waits").toEqual([false, ["The big ones (22)"]]);
      await tab(page, "plans");
      await tab(page, "explore");
      got = await shown(page);
      expect.soft([got.foryou, got.zero], "another tab and back: For you in its place").toEqual([true, null]);
      await whole(page, "For you in its place");
    });
  });
}
