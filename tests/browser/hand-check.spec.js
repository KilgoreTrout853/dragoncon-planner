/* After the first hand check (DECISIONS #103), where a phone draws it.

   The crew's day, folded: each head 44 px tall or more, whole on the screen,
   and where it stood after its tap, opened and shut (#86).

   The crew on the floors: a floor's name in the stack ends inside the
   stage, its crew's count in the text's colour and never gold; a card's
   day line is one line; and the crew adds nothing to the Map's sizes - the
   stage, the slot, the way back, every plate and the card are, to the px,
   what the same reader's are out of a crew, which stage.spec.js,
   stack.spec.js and level.spec.js hold to what was measured. And the guard:
   a day's line made longer than any real one is still one line, cut with an
   ellipsis, the card and the slot the height they were.

   The Filters button and the box beside it, whole on the screen, the icon
   before the word; the box's words never cut at the normal size, with a
   badge or without, and at 375 wide with Larger text on and a badge showing
   cut by an ellipsis, not mid-letter.

   The filter sheet's two titles whole, each over what it names; and at
   375 x 667 its first screen ends on the "Type" title, the switch under
   the fold.

   On the page with a backend the reader's crew is seeded as sync keeps one,
   and what the page asks of its backend is refused, as
   first-contact.spec.js has it: an empty pull takes a crew away. One page a
   test, its assertions soft. */
import { ANONYMOUS, BACKEND, CLOCKS, WITH_BACKEND, check, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const ME = ANONYMOUS.user.id, BO = "00000000-0000-4000-8000-0000000000b0", CY = "00000000-0000-4000-8000-0000000000c0", DEE = "00000000-0000-4000-8000-0000000000d0";
/* The Hyatt that Saturday: the reader's two picks on its Exhibit Level, in
   the Concourse and in Hanover F-G; Bo in Hanover F-G and on the Ballroom
   Level, Cy in Hanover F-G, Dee in the Concourse, in the International
   Tower's LL2 and on the Ballroom Level. So three of the crew at the hotel
   and on the Exhibit Level's plate, two on the Ballroom Level's and two in
   Hanover F. Bo has a pick on Friday too, and Cy and Dee have none. */
const EMILY = "c32d19e7750818e0eb903f152ac90776", CORWYN = "6ecc75745a676d39f23005562373d163", INSTAFILK = "6ecc75745a676d39f23005562373dc31", BETH = "c32d19e7750818e0eb903f152ac903c1";
const NIVEK = "6ecc75745a676d39f23005562371b51f", BUTCHER = "c32d19e7750818e0eb903f152acc0321", SWORD = "c32d19e7750818e0eb903f152acf7088", FRI_BOWIE = "6ecc75745a676d39f230055623762af6";
const picked = ids => Object.fromEntries(ids.map(id => [id, true]));
const READER = { picks: [EMILY, CORWYN] };
const IN_A_CREW = { session: ANONYMOUS, syncStamp: { user: ME, picks: null, follows: null }, plansView: "crew",
  crew: [{ id: "11111111-1111-4111-8111-111111111111", name: "Peachtree Irregulars", creator: ME, invite_token: "made-up",
    members: [{ user_id: ME, display_name: "Ada" }, { user_id: BO, display_name: "Bo" }, { user_id: CY, display_name: "Cy" }, { user_id: DEE, display_name: "Dee" }] }],
  crewPicks: { [BO]: picked([INSTAFILK, NIVEK, FRI_BOWIE]), [CY]: picked([CORWYN]), [DEE]: picked([BETH, BUTCHER, SWORD]) } };
const EXHIBIT = "exhibit+tower-ll2";
const GOLD = "rgb(243, 198, 75)", WORDS = "rgb(243, 239, 228)";
const refused = page => page.route(url => url.origin === BACKEND.url, route => route.abort());

/* The crew's day: run in the page. A block a person - its head's box and
   whether it is open, or the quiet line's - and the rows in the page. */
function crewDay() {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
  return [...document.querySelectorAll("#view-plans .crew-person")].map(person => {
    const head = person.querySelector(".crew-fold"), line = person.querySelector(".crew-none");
    return { says: (head || line).textContent.replace(/\s+/g, " ").trim(), head: head ? box(head) : null, open: head ? head.getAttribute("aria-expanded") : null,
      caret: head ? box(head.querySelector(".caret")) : null, button: !!person.querySelector("button"), rows: person.querySelectorAll(".row").length };
  });
}
/* The Map while a stack is open: run in the page. Every box a size could
   move - the stage, the wrap, the slot, the way back, the chips, each
   plate's outline, the card and its rows - and what the names and the day's
   line say, with how many lines the day's line takes. */
function mapBoxes() {
  const box = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => Math.round(v * 100) / 100); };
  const view = document.getElementById("view-map"), svg = view.querySelector("svg.map"), under = document.getElementById("mapUnder"), main = document.querySelector("main");
  const group = svg.querySelector(".map-stack:not([hidden])"), when = under.querySelector(".nc-when"), range = document.createRange();
  if (when) range.selectNodeContents(when);
  return {
    sizes: { stage: box(svg), wrap: box(view.querySelector(".map-wrap")), slot: box(under), back: box(document.getElementById("mapBack")), chips: box(view.querySelector(".chips")),
      main: [main.scrollHeight, main.clientHeight], plates: [...group.querySelectorAll(".plate")].map(p => box(p.querySelector(".plate-hull"))), card: box(under.firstElementChild), rows: [...under.querySelectorAll(".pc-row")].map(box) },
    names: [...group.querySelectorAll(".plate-label")].map(label => ({ says: label.textContent, right: label.getBoundingClientRect().right,
      crew: [...label.querySelectorAll(".pl-crew")].map(t => getComputedStyle(t).fill), star: [...label.querySelectorAll(".pl-picks")].map(t => getComputedStyle(t).fill) })),
    line: when ? { says: when.textContent, lines: new Set([...range.getClientRects()].map(b => Math.round(b.top))).size, cut: when.scrollWidth > when.clientWidth, ends: getComputedStyle(when).textOverflow } : null,
  };
}
/* Search's top: run in the page. The box and the button with their boxes,
   the icon, and whether the box's words fit: the placeholder set as the
   box's value for the reading, since a box says how far its words run only
   of a value, and taken out again. */
function searchTop() {
  const box = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const q = document.getElementById("q"), button = document.getElementById("filtersBtn"), icon = button.querySelector("svg"), badge = document.getElementById("filtersBadge");
  q.value = q.placeholder;
  const over = q.scrollWidth - q.clientWidth;
  q.value = "";
  return { q: box(q), button: box(button), icon: box(icon), badge: badge.hidden ? null : badge.textContent, placeholder: q.placeholder, over, ends: getComputedStyle(q).textOverflow,
    edge: getComputedStyle(button).borderTopColor, line: getComputedStyle(q).borderTopColor, fill: getComputedStyle(button).backgroundColor,
    word: [...button.childNodes].filter(n => n.nodeType === 3).map(n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().left; })[0] };
}
/* The filter sheet's body: run in the page. Each title with its box and
   what stands under it, and the body's fold. */
function sheetTitles() {
  const body = document.getElementById("filtersBody"), fold = body.getBoundingClientRect(), box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
  return { fold: { left: fold.left, right: fold.right, bottom: fold.bottom }, at: body.scrollTop,
    titles: [...body.querySelectorAll(".filter-label")].map(label => ({ says: label.textContent, ...box(label), whole: label.scrollWidth <= label.clientWidth, under: box(label.nextElementSibling), next: label.nextElementSibling.className })),
    switch: box(body.querySelector('[data-group="type"] .seg')) };
}

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`the crew's day, folded${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...IN_A_CREW, ...storage }, WITH_BACKEND) });
    test(`every fold shut, each head 44 px tall or more and whole on the screen; a head's tap opens its person alone and leaves the head where it stood, opened and shut; a person with no pick that day is a line and no button${text}`, async ({ page }) => {
      await refused(page);
      await open(page, SATURDAY, "", WITH_BACKEND);
      await tab(page, "plans");
      const width = page.viewportSize().width, shut = await page.evaluate(crewDay);
      expect.soft(shut.map(p => [p.says, p.open, p.rows])).toEqual([["Ada (you) 2▸", "false", 0], ["Bo 2▸", "false", 0], ["Cy 1▸", "false", 0], ["Dee 3▸", "false", 0]]);
      for (const p of shut) {
        expect.soft(p.head.height, `${p.says}: its head is ${p.head.height.toFixed(1)} px tall`).toBeGreaterThanOrEqual(44);
        expect.soft([p.head.left >= 0, p.head.right <= width + 0.5, p.caret.right <= p.head.right + 0.5, p.caret.left >= p.head.left], `${p.says}: the head and its caret are on the screen`).toEqual([true, true, true, true]);
      }
      expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      await page.locator(`#crewFold-${BO}`).tap();
      await settled(page);
      const one = await page.evaluate(crewDay);
      expect.soft(one.map(p => [p.open, p.rows])).toEqual([["false", 0], ["true", 2], ["false", 0], ["false", 0]]);
      expect.soft(Math.abs(one[1].head.top - shut[1].head.top), `Bo's head stood at ${shut[1].head.top.toFixed(1)} and stands at ${one[1].head.top.toFixed(1)} once open`).toBeLessThanOrEqual(1);
      expect.soft(one[1].head.height).toBeGreaterThanOrEqual(44);
      expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      await page.locator(`#crewFold-${BO}`).tap();
      await settled(page);
      const again = await page.evaluate(crewDay);
      expect.soft([again[1].open, again[1].rows, Math.abs(again[1].head.top - shut[1].head.top) <= 1]).toEqual(["false", 0, true]);
      /* Friday: Bo's one pick, and three people with none - a line each, and no button */
      await page.locator('#view-plans [data-chip="plans-day"][data-value="2026-09-04"]').tap();
      await settled(page);
      const friday = await page.evaluate(crewDay);
      expect.soft(friday.map(p => [p.says, p.button])).toEqual([["Ada (you) · no picks on Friday", false], ["Bo 1▸", true], ["Cy · no picks on Friday", false], ["Dee · no picks on Friday", false]]);
      expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
    });
  });

  test.describe(`the crew on the floors${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...IN_A_CREW, ...storage }, WITH_BACKEND) });
    test(`a floor's name says its crew after its star, inside the stage and never gold; a floor's card and a room's say it on one line; and the stage, the slot, the way back, every plate and the card are to the px what they are out of a crew${text}`, async ({ page }) => {
      await refused(page);
      const walk = async () => {
        await open(page, SATURDAY, "", WITH_BACKEND);
        await tab(page, "map");
        await page.locator('#view-map .map-hotel[data-hotel="Hyatt"]').tap();
        await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", "Hyatt");
        await settled(page);
        const stack = await page.evaluate(mapBoxes);
        await page.locator(`#view-map .plate[data-plate="${EXHIBIT}"]`).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-level", EXHIBIT);
        await settled(page);
        const floor = await page.evaluate(mapBoxes);
        await page.locator('#view-map .plate.flat [data-room="Hanover F"][data-level="exhibit"]').focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#mapRoom")).toBeVisible();
        await settled(page);
        return { stack, floor, room: await page.evaluate(mapBoxes) };
      };
      const crew = await walk();
      expect.soft(crew.stack.names.map(n => n.says)).toEqual(["Conference Center", "Exhibit Level + Intl Tower LL2 ★ 2 · 3 crew", "Ballroom Level + Intl Tower LL1 · 2 crew", "Lobby Level"]);
      expect.soft(crew.stack.names.flatMap(n => n.crew), "the crew's count is the text's colour").toEqual([WORDS, WORDS]);
      expect.soft(crew.stack.names.flatMap(n => n.star), "and the star's is gold").toEqual([GOLD]);
      const stage = crew.stack.sizes.stage;
      for (const n of crew.stack.names) expect.soft(n.right, `"${n.says}" ends at ${n.right.toFixed(1)}, inside the stage, which ends at ${(stage[0] + stage[2]).toFixed(1)}`).toBeLessThanOrEqual(stage[0] + stage[2]);
      expect.soft([crew.stack.line, crew.floor.line, crew.room.line].map(l => [l.says, l.lines, l.cut])).toEqual([
        ["Saturday · 2 picks · 3 of your crew", 1, false], ["Saturday · 69 events · 2 picks · 3 crew", 1, false], ["Saturday · 8 events · 1 pick · 2 crew", 1, false]]);
      expect.soft(await check(page, "#view-map button")).toMatchObject({ sideways: [], cut: [] });
      /* the guard: a line longer than any real one is one line still, and nothing grows */
      const long = await page.evaluate(() => {
        const under = document.getElementById("mapUnder"), when = under.querySelector(".nc-when"), was = when.textContent, range = document.createRange();
        const heights = () => [under.getBoundingClientRect().height, under.firstElementChild.getBoundingClientRect().height, when.getBoundingClientRect().height];
        const before = heights();
        when.textContent = "Wednesday · 1,145 events · 112 picks · 112 crew, and words no day's line will ever have to hold";
        range.selectNodeContents(when);
        const out = { before, after: heights(), lines: new Set([...range.getClientRects()].map(b => Math.round(b.top))).size, cut: when.scrollWidth > when.clientWidth, ends: getComputedStyle(when).textOverflow };
        when.textContent = was;
        return out;
      });
      expect.soft([long.lines, long.cut, long.ends, long.after], "a day's line too long for its card is one line, cut with an ellipsis, and the slot, the card and the line keep their height").toEqual([1, true, "ellipsis", long.before]);
      /* the same reader out of a crew: every box where it was */
      await page.evaluate(() => { for (const key of Object.keys(window.localStorage)) if (/\.(crew|crewPicks)$/.test(key)) window.localStorage.removeItem(key); });
      const alone = await walk();
      expect.soft(alone.stack.names.map(n => n.says)).toEqual(["Conference Center", "Exhibit Level + Intl Tower LL2 ★ 2", "Ballroom Level + Intl Tower LL1", "Lobby Level"]);
      expect.soft([alone.stack.line.says, alone.floor.line.says, alone.room.line.says]).toEqual(["Saturday · 2 picks", "Saturday · 69 events · 2 picks", "Saturday · 8 events · 1 pick"]);
      for (const view of ["stack", "floor", "room"]) expect.soft(crew[view].sizes, `the ${view}: every box with a crew is the box without one`).toEqual(alone[view].sizes);
    });
  });

  test.describe(`the Filters button and the box beside it${text}`, () => {
    test.use({ storageState: seed({ ...storage }) });
    test(`whole on the screen, the icon before the word and the edge lighter than the box's; the box's words fit at the normal size, and where Larger text and a badge leave them no room at 375 wide they end in an ellipsis${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "browse");
      const width = page.viewportSize().width, large = text !== "";
      const sound = (top, name) => {
        expect.soft([top.q.left >= 0, top.q.right <= top.button.left, top.button.right <= width + 0.5, Math.abs(top.q.height - top.button.height) <= 0.5, top.button.height >= 44],
          `${name}: the box, ${top.q.width.toFixed(1)} px, then the button, ${top.button.width.toFixed(1)} px, to ${top.button.right.toFixed(1)} of ${width}`).toEqual([true, true, true, true, true]);
        expect.soft([top.icon.left >= top.button.left, top.icon.right <= top.word, top.icon.height >= 16, top.icon.top >= top.button.top, top.icon.bottom <= top.button.bottom], `${name}: the icon, ${top.icon.width.toFixed(1)} px, stands in the button before its word`).toEqual([true, true, true, true, true]);
        expect.soft([top.edge === top.line, top.fill !== GOLD, top.edge !== GOLD, top.ends], `${name}: the button's edge, ${top.edge}, is not the box's, ${top.line}; nothing of it is gold`).toEqual([false, true, true, "ellipsis"]);
      };
      const none = await page.evaluate(searchTop);
      sound(none, "no badge");
      expect.soft([none.badge, none.placeholder]).toEqual([null, "Titles, guests, fandoms"]);
      if (!large) expect.soft(none.over, "no badge: the box's words fit").toBeLessThanOrEqual(0);
      expect.soft(await check(page, "#view-browse .search-row input, #view-browse .search-row button")).toMatchObject({ sideways: [], cut: [] });
      /* a filter set: the Hilton, from the sheet */
      await page.locator("#filtersBtn").tap();
      await page.locator('#panel-filters [data-chip="hotel"][data-value="Hilton"]').tap();
      await page.locator("#filtersShow").tap();
      await expect(page.locator("#sheetWrap")).toBeHidden();
      await settled(page);
      const set = await page.evaluate(searchTop);
      sound(set, "a badge");
      expect.soft([set.badge, set.button.width > none.button.width, set.q.width < none.q.width]).toEqual(["1", true, true]);
      if (!large) expect.soft(set.over, "a badge: the box's words still fit").toBeLessThanOrEqual(0);
      if (large && width === 375) expect.soft([set.over > 0, set.ends], `a badge, at 375 wide with Larger text on: the words run ${set.over} px past the box, and end in an ellipsis`).toEqual([true, "ellipsis"]);
      expect.soft(await check(page, "#view-browse .search-row input, #view-browse .search-row button")).toMatchObject({ sideways: [], cut: [] });
    });
  });

  test.describe(`the filter sheet's two titles${text}`, () => {
    test.use({ storageState: seed({ ...storage }) });
    test(`What it's about over the six menus and Type over its switch, each whole and in the sheet; at 375 x 667 the first screen ends on the Type title, its switch under the fold${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "browse");
      await page.locator("#filtersBtn").tap();
      await expect(page.locator("#filtersBody")).toBeVisible();
      await settled(page);
      const first = await page.evaluate(sheetTitles), { width, height } = page.viewportSize();
      expect.soft(first.titles.map(t => t.says)).toEqual(["Hotel", "What it’s about", "Type", "Kind", "Getting in"]);
      const about = first.titles[1], type = first.titles[2];
      expect.soft([about.next, type.next]).toEqual(["filter-pair", "seg"]);
      if (!text && width === 375 && height === 667) {
        expect.soft([first.at, type.bottom <= first.fold.bottom, first.switch.top < first.fold.bottom, first.switch.bottom > first.fold.bottom],
          `the first screen: the Type title ends at ${type.bottom.toFixed(1)} and its switch runs ${first.switch.top.toFixed(1)} to ${first.switch.bottom.toFixed(1)}, over a fold at ${first.fold.bottom.toFixed(1)}`).toEqual([0, true, true, true]);
      }
      for (const says of ["What it’s about", "Type"]) {
        await page.locator("#filtersBody .filter-label", { hasText: says }).scrollIntoViewIfNeeded();
        await settled(page);
        const now = await page.evaluate(sheetTitles), title = now.titles.find(t => t.says === says);
        expect.soft([title.whole, title.left >= now.fold.left, title.right <= now.fold.right, title.bottom <= title.under.top + 0.5, Math.abs(title.left - title.under.left) <= 0.5],
          `"${says}" is whole, in the sheet, over what it names and flush with it`).toEqual([true, true, true, true, true]);
      }
      expect.soft(await check(page, "#panel-filters button, #panel-filters select, #panel-filters input")).toMatchObject({ sideways: [], cut: [] });
    });
  });
}
