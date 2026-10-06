/* For you, the first thing on Explore's grid (DECISIONS #87), where jsdom
   cannot say: it stands whole at each size - nothing scrolling sideways, no
   control cut - every reason is on its row, Show more is 44 px tall or more
   (#66), and Following is folded under it for a reader who never tapped its
   heading. One page a test, walked, every assertion soft and named for
   where it was read. Before the con and on its Saturday, with Larger text
   off and on.

   The readers are For you's own and live here, not in the harness: the
   design sketch's - nine picks, Star Trek and Sean Astin followed - once
   with nothing stored of Following's fold and once with it stored shut. */
import { CLOCKS, check, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0], BEFORE = CLOCKS[2];
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const SKETCH = {
  picks: [
    "6ecc75745a676d39f2300556239d62d0", "c32d19e7750818e0eb903f152ac43c0e", "c32d19e7750818e0eb903f152ad81594",
    "c32d19e7750818e0eb903f152ad84b6f", "1e3995157984a4c0e6515a2ed631ee27", "c32d19e7750818e0eb903f152ac06f6f",
    "c32d19e7750818e0eb903f152ac72ab7", "c32d19e7750818e0eb903f152ac14835", "6ecc75745a676d39f230055623a7291a",
  ],
  follows: [{ kind: "work", key: "star-trek" }, { kind: "person", key: "sean-astin" }],
};
const FOLDED = { ...SKETCH, followingOpen: false };

/* What For you shows: the heading, each row's reason with whether its words
   are all there and inside the row, and Show more's box. */
const shown = page => page.evaluate(() => {
  const section = document.getElementById("foryou");
  if (!section) return null;
  const more = section.querySelector('[data-act="foryou-more"]'), box = more && more.getBoundingClientRect();
  return {
    first: document.getElementById("view-explore").firstElementChild === section,
    head: section.querySelector(".fy-head").textContent.replace(/\s+/g, " ").trim(),
    rows: [...section.querySelectorAll(".row")].map(row => {
      const status = row.querySelector(".flags .status"), r = row.getBoundingClientRect(), s = status && status.getBoundingClientRect();
      return { title: row.querySelector(".title").textContent.trim(), says: status ? status.textContent.trim() : "",
        whole: !!status && status.scrollWidth <= status.clientWidth, inside: !!s && s.width > 0 && s.left >= r.left && s.right <= r.right };
    }),
    more: more && { text: more.textContent.trim(), height: box.height, width: box.width },
  };
});
const fold = page => page.evaluate(() => {
  const head = document.querySelector("#following .fol-head"), body = document.getElementById("folBody");
  return head && { expanded: head.getAttribute("aria-expanded"), hidden: body.hidden, after: head.closest("section").previousElementSibling.id };
});
async function whole(page, where) {
  const found = await check(page);
  expect.soft(found.sideways, `${where}: nothing scrolls sideways`).toEqual([]);
  expect.soft(found.cut, `${where}: no control is cut off`).toEqual([]);
}
function reasons(got, where) {
  for (const row of got.rows) {
    expect.soft(row.says, `${where}: "${row.title}" says its reason`).toMatch(/^(You follow|Like your picks:) \S/);
    expect.soft([row.whole, row.inside], `${where}: the reason "${row.says}" is whole, and on its row`).toEqual([true, true]);
  }
}

for (const [text, storage] of Object.entries(TEXT)) {
  for (const clock of [BEFORE, SATURDAY]) {
    test.describe(`For you, ${clock.name}${text}`, () => {
      test.use({ storageState: seed({ ...SKETCH, ...storage }) });

      test(`stands first and whole: four rows with their reasons, Show more 44 px tall or more, the rest in place, and Following folded under it${text}`, async ({ page }) => {
        const where = `${clock.name}${text}`;
        await open(page, clock.now);
        await tab(page, "explore");
        let got = await shown(page);
        expect(got, `${where}: For you is on the page`).not.toBeNull();
        expect.soft([got.first, got.head, got.rows.length], `${where}: first in the view, eight chosen, four shown`).toEqual([true, "For you (8)", 4]);
        reasons(got, where);
        expect.soft(got.more.text, `${where}: Show more says how many`).toBe("Show 4 more");
        expect.soft(got.more.height, `${where}: Show more is 44 px tall or more`).toBeGreaterThanOrEqual(44);
        expect.soft(await fold(page), `${where}: Following is folded, straight after For you`).toEqual({ expanded: "false", hidden: true, after: "foryou" });
        await whole(page, where);

        await page.locator('#foryou [data-act="foryou-more"]').tap();
        await expect(page.locator("#foryou .row")).toHaveCount(8);
        got = await shown(page);
        expect.soft([got.head, got.more], `${where}, the rest shown: the count as it was, and no Show more`).toEqual(["For you (8)", null]);
        reasons(got, `${where}, the rest shown`);
        await whole(page, `${where}, the rest shown`);
      });
    });
  }

  test.describe(`Following's fold under For you${text}`, () => {
    test.use({ storageState: seed({ ...FOLDED, ...storage }) });

    test(`a reader who stored it shut finds it shut, and a tap on its heading opens it under For you, which stays as it was${text}`, async ({ page }) => {
      await open(page, SATURDAY.now);
      await tab(page, "explore");
      const before = await shown(page);
      expect.soft(await fold(page), "stored shut: folded").toEqual({ expanded: "false", hidden: true, after: "foryou" });
      await page.locator("#following .fol-head").tap();
      await expect(page.locator("#following .fol-head")).toHaveAttribute("aria-expanded", "true");
      expect.soft(await fold(page), "tapped: open").toEqual({ expanded: "true", hidden: false, after: "foryou" });
      expect.soft(await shown(page), "For you is as it was").toEqual(before);
      await whole(page, "Following open under For you");
    });
  });
}
