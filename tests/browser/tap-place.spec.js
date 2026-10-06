/* What is tapped stays where it stood (DECISIONS #86): a control that is
   tapped and is still there after the draw stands where it stood, to 1 px,
   wherever the page is scrolled; where the tap takes the control away, what
   stood just above it stays. jsdom cannot say: every rect there is 0.

   Each case puts its control at a height on the screen by scrolling main,
   checks that a touch at its middle is its own, touches it there - a tap,
   not a scripted click - waits for the draw and reads the same thing again.
   One page a test, walked, every assertion soft and named for its case. With
   Larger text off and on. The readers are seeded here: the harness's are
   the standing checks'. */
import { CLOCKS, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const TOLERANCE = 1;
const MUTES = [{ kind: "track", key: "Main Programming" }, { kind: "track", key: "Live Performances - Hyatt Concourse" }];
const FIREFLY = { kind: "work", key: "firefly" }, TREK = { kind: "work", key: "star-trek" };
/* Nothing starred, one fandom followed, two things muted: only the folds
   stand between Firefly's Already happened and the filter block. Each of
   these two opened Following's fold, which is shut under For you while
   never stored (DECISIONS #87). */
const NEAR = { follows: [FIREFLY], mutes: MUTES, followingOpen: true };
/* A second fandom after it, with more than a page still to come: a
   screenful and more between Firefly's folds and the filter block. */
const FAR = { follows: [FIREFLY, TREK], mutes: MUTES, followingOpen: true };
/* For you's: the design sketch's reader - nine picks, Star Trek and Sean
   Astin followed - who gets eight rows on the Saturday, four behind Show
   more, and never tapped Following's heading. */
const SKETCH = {
  picks: [
    "6ecc75745a676d39f2300556239d62d0", "c32d19e7750818e0eb903f152ac43c0e", "c32d19e7750818e0eb903f152ad81594",
    "c32d19e7750818e0eb903f152ad84b6f", "1e3995157984a4c0e6515a2ed631ee27", "c32d19e7750818e0eb903f152ac06f6f",
    "c32d19e7750818e0eb903f152ac72ab7", "c32d19e7750818e0eb903f152ac14835", "6ecc75745a676d39f230055623a7291a",
  ],
  follows: [TREK, { kind: "person", key: "sean-astin" }],
};
/* In place of a pick's (DECISIONS #90): that reader with a tenth pick, 2026's
   cancelled Temporal Formal, under a snapshot from before one said
   cancelled, and a snapshot of Is NASA Still 'NASA'? that says Sunday
   1:00 PM where the schedule says 4:00 PM - so the page boots to two lines
   of news and a fold under each, as tests/browser/in-place.spec.js has it. */
const NASA = "c32d19e7750818e0eb903f152ad84b6f", FORMAL = "c32d19e7750818e0eb903f152aced30a";
const CHANGED = {
  ...SKETCH, picks: [...SKETCH.picks, FORMAL],
  pickInfo: {
    [NASA]: { title: "Is NASA Still 'NASA'?", start: "2026-09-06T13:00", location: "Hilton 212-214", end: "2026-09-06T14:00", hotel: "Hilton" },
    [FORMAL]: { title: "CANCELLED - The Temporal Formal: Silver Screens and Golden Dreams", start: "2026-09-06T22:00", location: "Courtland Grand CG-Grand Ballroom A-F" },
  },
};

const HDR = ".hdr", BOX = "#view-explore .controls-sticky";
const fold = (act, follow) => `#view-explore [data-act="${act}"]` + (follow ? `[data-follow="${follow}"]` : "");

/* Two frames: what a draw or a scroll queued for the next one has run. */
const settled = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

/* Where the first thing a selector finds stands, and whether a touch at its
   middle is its own; with main's scroll, the foot of the header and of the
   screen, and the filter block's box where there is one. */
const read = (page, selector) => page.evaluate(({ sel, hdr, box }) => {
  const el = document.querySelector(sel), main = document.querySelector("main"), block = document.querySelector(box);
  if (!el) return null;
  const b = el.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2;
  const hit = document.elementFromPoint(x, y), k = block && block.getBoundingClientRect();
  return {
    top: b.top, bottom: b.bottom, x, y, own: !!hit && (hit === el || el.contains(hit)),
    scrolled: main.scrollTop, room: main.scrollHeight - main.clientHeight - main.scrollTop,
    head: document.querySelector(hdr).getBoundingClientRect().bottom, foot: main.getBoundingClientRect().bottom,
    block: k && { top: k.top, bottom: k.bottom },
  };
}, { sel: selector, hdr: HDR, box: BOX });

/* Scroll main until a thing's top stands `down` px under the foot of
   `under` - the header, or a block that sticks beneath it - or as near as
   the page allows; "end" is the page's end. */
async function put(page, selector, down, under = HDR) {
  await page.evaluate(({ sel, down, under }) => {
    const main = document.querySelector("main"), el = document.querySelector(sel);
    if (down === "end") main.scrollTop = main.scrollHeight;
    else if (el) main.scrollTop += el.getBoundingClientRect().top - document.querySelector(under).getBoundingClientRect().bottom - down;
  }, { sel: selector, down, under });
  await settled(page);
}

/* One case. control: what is touched. watch: what is read before and after -
   the control, or what stood above one the tap takes away. drawn: resolves
   once the tap's draw is on the page. stage: what must be true of the page
   before the tap for the case to be the case it says - a list of
   [what, whether] from the reading - and the case fails where one is not. */
async function holds(page, name, { control, watch = control, down = 60, under, drawn, stage = () => [] }) {
  await put(page, control, down, under);
  const touch = await read(page, control), before = await read(page, watch);
  if (!touch || !before) { expect.soft(null, `${name}: its control, and what is read, are on the page`).not.toBeNull(); return; }
  expect.soft(touch.own, `${name}: a touch at the control's middle is its own`).toBe(true);
  for (const [what, ok] of stage(touch)) expect.soft(ok, `${name}: the stage - ${what}`).toBe(true);
  await page.touchscreen.tap(touch.x, touch.y);
  await drawn();
  await settled(page);
  const after = await read(page, watch);
  if (!after) { expect.soft(after, `${name}: what was read is still on the page`).not.toBeNull(); return; }
  expect.soft(Math.abs(after.top - before.top), `${name}: it stood at ${before.top.toFixed(1)} px and stands at ${after.top.toFixed(1)}`).toBeLessThanOrEqual(TOLERANCE);
}

/* The page is not at its top, and the filter block is on screen below the
   control: inside main's box, under the header's foot, the nav's cover
   notwithstanding. */
const blockBelow = t => [
  ["the page is scrolled", t.scrolled > 0],
  ["the filter block is on screen below the control", !!t.block && t.block.top >= t.bottom && t.block.top < t.foot && t.block.bottom > t.head],
];
/* And the same block past the foot of the screen. */
const blockAway = t => [
  ["the page is scrolled", t.scrolled > 0],
  ["the filter block is off screen, below", !!t.block && t.block.top >= t.foot],
];
const expanded = (page, selector, value) => () => expect(page.locator(selector)).toHaveAttribute("aria-expanded", String(value));
const gone = (page, selector) => () => expect(page.locator(selector)).toHaveCount(0);
/* A row, by its list and its place in it, as a selector that finds it again
   after a draw: its event's id. */
async function rowAt(page, list, n) {
  const id = await page.locator(`main .row[data-list="${list}"]`).nth(n).getAttribute("data-id");
  return `main .row[data-list="${list}"][data-id="${id}"]`;
}

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`a fold of Explore's grid${text}`, () => {
    test.use({ storageState: seed({ ...NEAR, ...storage }) });

    test(`stays under the finger with the filter block on screen below it: Already happened, With the cast, and the Muted fold opened and shut${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      const past = fold("fol-past", "work:firefly"), cast = fold("fol-cast", "work:firefly"), muted = fold("explore-muted");
      await holds(page, "Already happened, opened", { control: past, drawn: expanded(page, past, true), stage: blockBelow });
      await page.locator(past).tap();
      await expanded(page, past, false)();
      await holds(page, "With the cast, opened", { control: cast, drawn: expanded(page, cast, true), stage: blockBelow });
      await page.locator(cast).tap();
      await expanded(page, cast, false)();
      await holds(page, "the Muted fold, opened", { control: muted, drawn: expanded(page, muted, true), stage: blockBelow });
      await holds(page, "the Muted fold, shut", { control: muted, drawn: expanded(page, muted, false), stage: blockBelow });
    });
  });

  test.describe(`a tap in Following${text}`, () => {
    test.use({ storageState: seed({ ...FAR, ...storage }) });

    test(`stays under the finger: a fold with the filter block off screen, what stood above Show more, the photo ops' button and a muted chip's x, and a row's star${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      const past = fold("fol-past", "work:firefly"), cast = fold("fol-cast", "work:firefly");
      await holds(page, "Already happened, opened, the filter block off screen", { control: past, drawn: expanded(page, past, true), stage: blockAway });
      await page.locator(past).tap();
      await expanded(page, past, false)();
      await holds(page, "With the cast, opened, the filter block off screen", { control: cast, drawn: expanded(page, cast, true), stage: blockAway });
      await page.locator(cast).tap();
      await expanded(page, cast, false)();

      /* Show more: the last row above it is still the row above what it showed. */
      const more = fold("fol-more", "work:star-trek");
      await expect(page.locator(more)).toHaveCount(1);
      const shown = await page.locator('main .row[data-list="fol:work:star-trek"]').count();
      await holds(page, "Show more, by the last row above it", {
        control: more, watch: await rowAt(page, "fol:work:star-trek", shown - 1), down: 200, drawn: gone(page, more),
      });

      /* The photo ops and signings join the cast's rows by time, so a row
         may rightly move down: the fold above them is what stays. */
      const trekCast = fold("fol-cast", "work:star-trek"), noise = fold("fol-cast-noise", "work:star-trek");
      await page.locator(trekCast).tap();
      await expanded(page, trekCast, true)();
      await expect(page.locator(noise)).toHaveCount(1);
      await holds(page, "the feed's photo ops' button, by the fold above it", { control: noise, watch: trekCast, down: 200, drawn: gone(page, noise) });
      await page.locator(trekCast).tap();
      await expanded(page, trekCast, false)();

      /* A muted chip's x: the fold above the chips. */
      const muted = fold("explore-muted"), x = "#muted .mute-chip .fc-x";
      await page.locator(muted).tap();
      await expanded(page, muted, true)();
      await holds(page, "a muted chip's x, by the fold above it", {
        control: x, watch: muted, down: 200, drawn: () => expect(page.locator("#muted .mute-chip")).toHaveCount(MUTES.length - 1),
      });

      /* The star on a Following row: Because you starred arrives below it. */
      const row = await rowAt(page, "fol:work:firefly", 2);
      await holds(page, "a star on a Following row", {
        control: `${row} .star`, watch: row, down: 120, drawn: () => expect(page.locator(`${row} .star`)).toHaveAttribute("aria-pressed", "true"),
      });
    });
  });

  /* For you (DECISIONS #87): Show more puts four rows between itself and
     the filter block, which is on screen below it at the taller sizes and
     past the foot at the shorter; and a star changes nothing above its row
     - the list is held - so the row and the star stay. */
  test.describe(`a tap in For you${text}`, () => {
    test.use({ storageState: seed({ ...SKETCH, ...storage }) });

    test(`stays under the finger: what stood above Show more, and a row's star${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      const more = '#foryou [data-act="foryou-more"]';
      await expect(page.locator('main .row[data-list="foryou"]')).toHaveCount(4);
      await holds(page, "For you's Show more, by the last row above it", {
        control: more, watch: await rowAt(page, "foryou", 3), down: 200, drawn: gone(page, more), stage: t => [["the page is scrolled", t.scrolled > 0]],
      });
      await expect(page.locator('main .row[data-list="foryou"]')).toHaveCount(8);

      const row = await rowAt(page, "foryou", 5), star = `${row} .star`;
      await holds(page, "a star on a For you row", {
        control: star, watch: row, down: 120, drawn: () => expect(page.locator(star)).toHaveAttribute("aria-pressed", "true"),
        stage: t => [["the page is scrolled", t.scrolled > 0]],
      });
      await expect.soft(page.locator('main .row[data-list="foryou"]'), "the starred row is still one of the eight").toHaveCount(8);
    });
  });

  /* The zero state (DECISIONS #88), a stranger's: Show all puts the rest of
     the big ones between itself and the filter block; and a star changes
     nothing above its row - the zero state is held - so the row and the
     star stay, with Because you starred arriving below. */
  test.describe(`a tap in the zero state${text}`, () => {
    test.use({ storageState: seed(storage) });

    test(`stays under the finger: what stood above Show all, and a big one's star${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      const all = '#zero [data-act="zero-all"]', rows = page.locator('main .row[data-list="big"]');
      await expect(rows).toHaveCount(4);
      await holds(page, "the big ones' Show all, by the last row above it", {
        control: all, watch: await rowAt(page, "big", 3), down: 200, drawn: gone(page, all), stage: t => [["the page is scrolled", t.scrolled > 0]],
      });
      await expect(rows).toHaveCount(12);

      const row = await rowAt(page, "big", 5), star = `${row} .star`;
      await holds(page, "a star on a big one", {
        control: star, watch: row, down: 120, drawn: () => expect(page.locator(star)).toHaveAttribute("aria-pressed", "true"),
        stage: t => [["the page is scrolled", t.scrolled > 0]],
      });
      await expect.soft(rows, "the starred row is still one of the twelve").toHaveCount(12);
      await expect.soft(page.locator("#zero .fy-head").first(), "and Start here still stands above them").toHaveText("Start here");
    });
  });

  test.describe(`a tap on a fandom's page and in Search${text}`, () => {
    test.use({ storageState: seed(storage) });

    /* The page's folds are its last things: each is read with the page at
       its end, where what stands after the view is on screen. */
    test(`stays under the finger on a fandom's page: Already happened, With the cast, and the fold above its photo ops' button${text}`, async ({ page }) => {
      await open(page, SATURDAY, "#explore=work:firefly");
      const past = fold("explore-past"), cast = fold("explore-cast"), noise = fold("explore-cast-noise");
      const scrolled = t => [["the page is scrolled", t.scrolled > 0]];
      await holds(page, "a page's Already happened, opened", { control: past, down: "end", drawn: expanded(page, past, true), stage: scrolled });
      await page.locator(past).tap();
      await expanded(page, past, false)();
      await holds(page, "a page's With the cast, opened", { control: cast, down: "end", drawn: expanded(page, cast, true), stage: scrolled });
      await expect(page.locator(noise)).toHaveCount(1);
      await holds(page, "a page's photo ops' button, by the fold above it", { control: noise, watch: cast, down: "end", drawn: gone(page, noise), stage: scrolled });
    });

    test(`stays under the finger in Search: Already happened under a word that ranks, and With the cast under a Fandom${text}`, async ({ page }) => {
      const STICKY = "#view-browse .controls-sticky";
      await open(page, SATURDAY);
      await tab(page, "browse");
      const past = '#browseRest [data-act="toggle-past"]', cast = '#browseRest [data-act="browse-cast"]';
      await page.locator("#q").fill("firefly");
      await expect(page.locator(past)).toHaveCount(1);
      await holds(page, "Search's Already happened, opened", { control: past, under: STICKY, drawn: expanded(page, past, true) });

      /* With a Fandom set and nothing typed the group starts open, the
         page's last thing: shut there, the page is too short to hold it,
         so that tap is not read, and the one that opens it is. */
      await page.locator("#q").fill("");
      await expect(page.locator(past)).toHaveCount(0);
      await page.locator("#filtersBtn").tap();
      await page.locator("#fandom").selectOption("star-trek");
      await page.locator("#filtersShow").tap();
      await expect(page.locator("#sheetWrap")).toBeHidden();
      await expanded(page, cast, true)();
      await page.locator(cast).scrollIntoViewIfNeeded();
      await page.locator(cast).tap();
      await expanded(page, cast, false)();
      await holds(page, "Search's With the cast, opened", { control: cast, down: "end", under: STICKY, drawn: expanded(page, cast, true) });
    });
  });

  /* togglePick() in src/shell.js: the first pick puts the hero card above
     the row, and taking it off takes the card away. */
  test.describe(`the star${text}`, () => {
    test.use({ storageState: seed(storage) });

    test(`keeps its row under the finger: a stranger's first pick on Now, the same star taken off, and a star in Search${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "now");
      const row = await rowAt(page, "around", 4), star = `${row} .star`;
      const pressed = (selector, value) => () => expect(page.locator(selector)).toHaveAttribute("aria-pressed", String(value));
      await expect(page.locator("#view-now .hero")).toHaveCount(0);
      await holds(page, "a stranger's first pick on Now", { control: star, watch: row, down: 120, drawn: pressed(star, true), stage: t => [["the page is scrolled", t.scrolled > 0]] });
      await expect.soft(page.locator("#view-now .hero"), "the first pick put the hero card above the row").toHaveCount(1);
      /* where it stands: the card's height is above it to be taken back */
      const there = await read(page, row);
      await holds(page, "the same star taken off", { control: star, watch: row, down: there.top - there.head, drawn: pressed(star, false) });
      await expect.soft(page.locator("#view-now .hero"), "and taking it off took the card away").toHaveCount(0);

      await tab(page, "browse");
      const found = await rowAt(page, "browse", 3);
      await holds(page, "a star in Search", { control: `${found} .star`, watch: found, down: 100, under: "#view-browse .controls-sticky", drawn: pressed(`${found} .star`, true) });
    });
  });

  /* In place of a pick (DECISIONS #90): a fold under the picks-changed
     notice opens downward, so it stays where it stood; and a star in it
     changes nothing above its row - what the folds hold is held - so the
     row stays. On Now, and then on My day, where Now's markup, hidden, still
     holds the same folds: a row is found by its own tab's list. */
  test.describe(`a tap under the picks-changed notice${text}`, () => {
    test.use({ storageState: seed({ ...CHANGED, ...storage }) });

    test(`stays under the finger: a fold opened and shut, and a star in it, on Now and on My day${text}`, async ({ page }) => {
      const scrolled = t => [["the page is scrolled", t.scrolled > 0]];
      await open(page, SATURDAY);
      for (const [name, entry] of [["now", 0], ["plans", 1]]) {
        await tab(page, name);
        const fold = `#inPlace-${name}-${entry}`, list = `in-place:${name}:${entry}`;
        await holds(page, `${name}: a fold in place of a pick, opened`, { control: fold, drawn: expanded(page, fold, true), stage: scrolled });
        await holds(page, `${name}: the same fold, shut`, { control: fold, drawn: expanded(page, fold, false), stage: scrolled });
        await page.locator(fold).tap();
        await expanded(page, fold, true)();
        const row = await rowAt(page, list, 1), star = `${row} .star`;
        await holds(page, `${name}: a star in the fold`, {
          control: star, watch: row, down: 120, drawn: () => expect(page.locator(star)).toHaveAttribute("aria-pressed", "true"), stage: scrolled,
        });
        await expect.soft(page.locator(`main .row[data-list="${list}"]`), `${name}: the starred row is still one of the three`).toHaveCount(3);
      }
    });
  });
}
