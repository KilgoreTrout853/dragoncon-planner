/* In place of a pick (DECISIONS #90), where jsdom cannot say: the
   picks-changed notice and the folds under it stand whole at each size, on
   Now and on Plans' My day - nothing scrolling sideways, no control cut -
   each fold's button and the notice's OK are 44 px tall or more (#66), and
   an open fold's rows say their reasons whole. One page a test, walked,
   every assertion soft and named for where it was read. With Larger text
   off and on.

   The news is staged as it arises on a phone, from what storage holds
   against the real schedule, with no response edited: the reader is the
   design sketch's - nine picks, Star Trek and Sean Astin followed - with a
   tenth pick, 2026's cancelled Temporal Formal, whose snapshot is from
   before a snapshot said cancelled, so the page finds it cancelled; and
   the snapshot of Is NASA Still 'NASA'? says Sunday 1:00 PM, where the
   schedule says 4:00 PM, so the page finds it moved. Two lines, two folds:
   the first names a short title, the second the schedule's longest of the
   two cancelled ones, which wraps. The readers live here, not in the
   harness. */
import { CLOCKS, check, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0];
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const NASA = "c32d19e7750818e0eb903f152ad84b6f", FORMAL = "c32d19e7750818e0eb903f152aced30a";
const CHANGED = {
  picks: [
    "6ecc75745a676d39f2300556239d62d0", "c32d19e7750818e0eb903f152ac43c0e", "c32d19e7750818e0eb903f152ad81594",
    NASA, "1e3995157984a4c0e6515a2ed631ee27", "c32d19e7750818e0eb903f152ac06f6f",
    "c32d19e7750818e0eb903f152ac72ab7", "c32d19e7750818e0eb903f152ac14835", "6ecc75745a676d39f230055623a7291a", FORMAL,
  ],
  follows: [{ kind: "work", key: "star-trek" }, { kind: "person", key: "sean-astin" }],
  pickInfo: {
    [NASA]: { title: "Is NASA Still 'NASA'?", start: "2026-09-06T13:00", location: "Hilton 212-214", end: "2026-09-06T14:00", hotel: "Hilton" },
    [FORMAL]: { title: "CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams", start: "2026-09-06T22:00", location: "Courtland Grand CG-Grand Ballroom A-F" },
  },
};
const FOLDS = ["In place of Is NASA Still 'NASA'?, Sun 1:00 PM (3)", "In place of CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams, Sun 10:00 PM (3)"];

/* What stands under the notice on a tab: its lines, its OK's box, and each
   fold - what it says, whether it is open, its button's box, and its rows,
   each with its reason where it has one and whether the reason is whole and
   on its row. */
const shown = (page, name) => page.evaluate(view => {
  const root = document.getElementById(`view-${view}`), notice = root.querySelector(".pick-news");
  if (!notice) return null;
  const box = el => { const b = el.getBoundingClientRect(); return { height: b.height, left: b.left, right: b.right }; };
  const said = el => el.textContent.replace(/\s+/g, " ").trim();
  return {
    lines: [...notice.querySelectorAll("li")].map(said),
    ok: box(notice.querySelector('[data-act="dismiss-news"]')),
    under: notice.nextElementSibling.className,
    gap: notice.nextElementSibling.getBoundingClientRect().top - notice.getBoundingClientRect().bottom,
    folds: [...root.querySelectorAll(".divider.fold.in-place button")].map(button => {
      const list = button.parentElement.nextElementSibling, open = button.getAttribute("aria-expanded") === "true";
      return {
        says: said(button).replace(/ [▸▾]$/, ""), open, box: box(button),
        rows: open ? [...list.querySelectorAll(".row")].map(row => {
          const status = row.querySelector(".flags .status"), r = row.getBoundingClientRect(), s = status && status.getBoundingClientRect();
          return { title: said(row.querySelector(".title")), list: row.dataset.list, day: !!row.querySelector(".day"), says: status ? said(status) : "",
            whole: !status || status.scrollWidth <= status.clientWidth, inside: !s || (s.width > 0 && s.left >= r.left && s.right <= r.right) };
        }) : [],
      };
    }),
  };
}, name);
async function whole(page, where) {
  const found = await check(page);
  expect.soft(found.sideways, `${where}: nothing scrolls sideways`).toEqual([]);
  expect.soft(found.cut, `${where}: no control is cut off`).toEqual([]);
}
function standing(got, where, width) {
  expect.soft(got.lines, `${where}: the notice's two lines`).toEqual([
    "Is NASA Still 'NASA'? moved to Sun 4:00 PM, Hilton 212-214. It was Sun 1:00 PM, Hilton 212-214.",
    "CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams was cancelled. It was Sun 10:00 PM, Courtland Grand CG-Grand Ballroom A-F. It stays in Plans, marked.",
  ]);
  expect.soft(got.ok.height, `${where}: the notice's OK is 44 px tall or more`).toBeGreaterThanOrEqual(44);
  expect.soft(got.under, `${where}: the first fold stands straight under the notice`).toBe("divider fold in-place");
  expect.soft(got.gap, `${where}: and clear of its box, by 8 px or more`).toBeGreaterThanOrEqual(8);
  expect.soft(got.folds.map(f => f.says), `${where}: a fold a change, in the news's order`).toEqual(FOLDS);
  for (const f of got.folds) {
    expect.soft(f.box.height, `${where}: "${f.says}" is 44 px tall or more`).toBeGreaterThanOrEqual(44);
    expect.soft([f.box.left >= 0, f.box.right <= width], `${where}: "${f.says}" is inside the screen`).toEqual([true, true]);
  }
}
function rows(fold, where, list) {
  expect.soft(fold.rows.length, `${where}: three rows`).toBe(3);
  for (const row of fold.rows) {
    expect.soft([row.list, row.day], `${where}: "${row.title}" is in its fold's list, with no day on it`).toEqual([list, false]);
    if (row.says) expect.soft(row.says, `${where}: "${row.title}" says its reason as For you does`).toMatch(/^(You follow|Like your picks:) \S/);
    expect.soft([row.whole, row.inside], `${where}: the reason of "${row.title}" is whole, and on its row`).toEqual([true, true]);
  }
}

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`in place of a pick${text}`, () => {
    test.use({ storageState: seed({ ...CHANGED, ...storage }) });

    for (const name of ["now", "plans"]) {
      test(`under the notice on ${name === "now" ? "Now" : "My day"}: two folds, shut and whole, 44 px tall or more, and each opened to three rows${text}`, async ({ page }) => {
        const where = `${name === "now" ? "Now" : "My day"}${text}`, width = page.viewportSize().width;
        await open(page, SATURDAY.now);
        await tab(page, name);
        let got = await shown(page, name);
        expect(got, `${where}: the notice is on the page`).not.toBeNull();
        standing(got, `${where}, shut`, width);
        expect.soft(got.folds.map(f => f.open), `${where}: both shut until tapped`).toEqual([false, false]);
        await whole(page, `${where}, shut`);

        for (const n of [0, 1]) {
          const button = page.locator(`#inPlace-${name}-${n}`);
          await button.scrollIntoViewIfNeeded();
          await button.tap();
          await expect(page.locator(`#inPlace-${name}-${n}`)).toHaveAttribute("aria-expanded", "true");
          got = await shown(page, name);
          standing(got, `${where}, fold ${n + 1} opened`, width);
          expect.soft(got.folds.map(f => f.open), `${where}: fold ${n + 1} opened, and no other tapped one shut`).toEqual(n ? [true, true] : [true, false]);
          rows(got.folds[n], `${where}, fold ${n + 1}`, `in-place:${name}:${n}`);
          await whole(page, `${where}, fold ${n + 1} opened`);
        }
      });
    }
  });
}
