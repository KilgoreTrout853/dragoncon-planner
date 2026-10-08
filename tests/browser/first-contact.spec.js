/* The first-contact pass (DECISIONS #101), where a phone draws it: the top
   of Plans in each of its cases - with no backend and with one, with no
   crew and in one, with no pick and with picks - whole on the screen, none
   of it gold, Timeline | List a segment at the right end of its row and the
   rung a card; the way back from an Explore page and a follow chip's two
   taps 44 px, "Follow more" the row's height beside them; and the Map's
   card with no pick whole above the nav.

   On a build with a backend the reader's crew is seeded as sync keeps one,
   and what the page asks of its backend is refused here, where the harness
   would answer a table empty: an empty pull takes a crew away. It is not a
   test of a crew, nor of sync. */
import { ANONYMOUS, BACKEND, CLOCKS, READERS, WITH_BACKEND, answers, check, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const READER = READERS["a reader with picks and follows"];
const ME = ANONYMOUS.user.id, BO = "00000000-0000-4000-8000-0000000000b0";
const IN_A_CREW = { session: ANONYMOUS, syncStamp: { user: ME, picks: null, follows: null }, plansView: "mine",
  crew: [{ id: "11111111-1111-4111-8111-111111111111", name: "Peachtree Irregulars", creator: ME, invite_token: "made-up", members: [{ user_id: ME, display_name: "Ada" }, { user_id: BO, display_name: "Bo" }] }],
  crewPicks: { [BO]: { [READER.picks[3]]: true } } };
const GOLD = "rgb(243, 198, 75)";

/* Plans' top: run in the page. Every control above the plan with its box
   and its fill, the rung's card, the two segments, and where the plan
   starts. */
function plansTop() {
  const box = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const view = document.getElementById("view-plans"), plan = view.querySelector(".tl-day, .list, .empty, .crew-person");
  const above = node => !!(node.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING);
  const controls = [...view.querySelectorAll("button, select")].filter(above).map(b => ({ says: b.textContent.trim(), ...box(b), fill: getComputedStyle(b).backgroundColor, pressed: b.getAttribute("aria-pressed") }));
  const rung = view.querySelector(".crew-rung"), actions = view.querySelector(".plans-actions");
  return { controls, rung: rung ? { ...box(rung), edge: getComputedStyle(rung).borderTopWidth, fill: getComputedStyle(rung).backgroundColor } : null,
    actions: box(actions), seg: box(view.querySelector(".plans-seg:not(.plans-view)")), view: box(view.querySelector(".plans-view")),
    plan: box(plan), nav: document.querySelector(".nav").getBoundingClientRect().top, head: document.querySelector(".hdr").getBoundingClientRect().bottom };
}
const said = top => top.controls.map(c => c.says);
/* Every control of Plans' top: 44 px tall or more and at least 44 wide, on the screen, and none gold. */
function sound(top, name, width) {
  for (const c of top.controls) {
    expect.soft([c.height >= 44, c.width >= 44], `${name}: ${c.says} is ${c.width.toFixed(1)} by ${c.height.toFixed(1)} px`).toEqual([true, true]);
    expect.soft([c.left >= 0, c.right <= width + 0.5], `${name}: ${c.says} is on the screen, ${c.left.toFixed(1)} to ${c.right.toFixed(1)}`).toEqual([true, true]);
  }
  expect.soft(top.controls.filter(c => c.fill === GOLD).map(c => c.says), `${name}: nothing on Plans' top is gold`).toEqual([]);
}
/* The view's switch: a segment that hugs its words at the right end of its row, under the actions and over the plan. */
function switched(top, name) {
  const [first, last] = ["Export to calendar", "Share a day"].map(says => top.controls.find(c => c.says === says));
  expect.soft([Math.abs(top.view.right - last.right) <= 0.5, top.view.width < (last.right - first.left) / 2, top.view.top >= last.bottom, top.plan.top >= top.view.bottom],
    `${name}: Timeline | List, ${top.view.width.toFixed(1)} px wide, ends where Share a day ends, at ${last.right.toFixed(1)}, under the actions and over the plan`).toEqual([true, true, true, true]);
}

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`the top of Plans on a build with no backend${text}`, () => {
    test.describe("a stranger", () => {
      test.use({ storageState: seed({ ...storage }) });
      test(`no pick: the two actions, and nothing else above the empty state${text}`, async ({ page }) => {
        await open(page, SATURDAY);
        await tab(page, "plans");
        const top = await page.evaluate(plansTop), width = page.viewportSize().width;
        expect.soft(said(top)).toEqual(["Export to calendar", "Share a day"]);
        sound(top, "no pick", width);
        expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      });
    });
    test.describe("a reader with picks", () => {
      test.use({ storageState: seed({ ...READER, ...storage }) });
      test(`picks: the two actions, then Timeline | List at the right end of its row${text}`, async ({ page }) => {
        await open(page, SATURDAY);
        await tab(page, "plans");
        const top = await page.evaluate(plansTop), width = page.viewportSize().width;
        expect.soft(said(top)).toEqual(["Export to calendar", "Share a day", "Timeline", "List"]);
        sound(top, "picks", width);
        switched(top, "picks");
        expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
        /* a touch on List is List's, and the switch stands where it stood */
        await page.locator('#view-plans [data-act="view-list"]').tap();
        await settled(page);
        const list = await page.evaluate(plansTop);
        expect.soft([list.controls.find(c => c.says === "List").pressed, Math.abs(list.view.top - top.view.top) <= 1, Math.abs(list.view.left - top.view.left) <= 1], "List pressed, and the switch where it stood").toEqual(["true", true, true]);
      });
    });
  });

  test.describe(`the top of Plans on a build with a backend${text}`, () => {
    test.describe("no crew, no pick", () => {
      test.use({ storageState: seed({ ...storage }, WITH_BACKEND) });
      test(`the rung's card, then the two actions${text}`, async ({ page }) => {
        await open(page, SATURDAY, "", WITH_BACKEND);
        await tab(page, "plans");
        const top = await page.evaluate(plansTop), width = page.viewportSize().width;
        expect.soft(said(top)).toEqual(["Start a crew", "Join with a link", "Export to calendar", "Share a day"]);
        sound(top, "no crew, no pick", width);
        expect.soft([top.rung.left, top.rung.right, top.rung.edge, top.rung.bottom <= top.actions.top], "the rung is a card from gutter to gutter, edged, over the actions").toEqual([14, width - 14, "1px", true]);
        expect.soft(top.controls.slice(0, 2).every(c => c.left >= top.rung.left && c.right <= top.rung.right && c.top >= top.rung.top && c.bottom <= top.rung.bottom), "its two buttons stand inside it").toBe(true);
        expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      });
    });
    test.describe("no crew, picks", () => {
      test.use({ storageState: seed({ ...READER, ...storage }, WITH_BACKEND) });
      test(`the rung's card, the two actions, then Timeline | List${text}`, async ({ page }) => {
        await open(page, SATURDAY, "", WITH_BACKEND);
        await tab(page, "plans");
        const top = await page.evaluate(plansTop), width = page.viewportSize().width;
        expect.soft(said(top)).toEqual(["Start a crew", "Join with a link", "Export to calendar", "Share a day", "Timeline", "List"]);
        sound(top, "no crew, picks", width);
        switched(top, "no crew, picks");
        expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      });
    });
    test.describe("in a crew, picks", () => {
      test.use({ storageState: seed({ ...READER, ...IN_A_CREW, ...storage }, WITH_BACKEND) });
      test(`My day: the crew's head, My day | Crew across the width, the two actions, then Timeline | List, the narrower of the two segments${text}`, async ({ page }) => {
        await page.route(url => url.origin === BACKEND.url, route => route.abort());
        await open(page, SATURDAY, "", WITH_BACKEND);
        await tab(page, "plans");
        const top = await page.evaluate(plansTop), width = page.viewportSize().width;
        expect.soft(said(top)).toEqual(["Manage", "My day", "Crew", "Export to calendar", "Share a day", "Timeline", "List"]);
        sound(top, "in a crew", width);
        switched(top, "in a crew");
        expect.soft([top.rung, Math.abs(top.seg.width - (width - 28)) <= 0.5, top.seg.bottom <= top.actions.top, top.view.width < top.seg.width / 2],
          `no rung; My day | Crew, ${top.seg.width.toFixed(1)} px, spans the width over the actions, and Timeline | List, ${top.view.width.toFixed(1)}, is under half of it`).toEqual([null, true, true, true]);
        expect.soft(await check(page, "#view-plans button")).toMatchObject({ sideways: [], cut: [] });
      });
    });
  });

  test.describe(`two taps${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...storage }) });
    test(`the way back from an Explore page is 44 px tall and at least 44 wide, its whole box its own, and stands inside the page's head${text}`, async ({ page }) => {
      await open(page, SATURDAY, "#explore=work:star-trek");
      const got = await page.evaluate(() => {
        const head = document.querySelector(".explore-head"), back = head.querySelector(".back"), b = back.getBoundingClientRect(), h = head.getBoundingClientRect(), kind = head.querySelector(".eh-kind").getBoundingClientRect();
        return { width: b.width, height: b.height, top: b.top, bottom: b.bottom, head: [h.top, h.bottom], hdr: document.querySelector(".hdr").getBoundingClientRect().bottom, kind: kind.top, line: 1.3 * parseFloat(getComputedStyle(back).fontSize) };
      });
      expect.soft([got.height >= 44, got.width >= 44], `it is ${got.width.toFixed(1)} by ${got.height.toFixed(1)} px`).toEqual([true, true]);
      expect.soft(await page.evaluate(answers, ".explore-head .back"), "a touch just inside each of its edges is its own").toEqual({ left: true, right: true, top: true, bottom: true });
      expect.soft([got.top >= got.head[0] - 0.5, got.top >= got.hdr - 0.5, got.bottom <= got.head[1]], `its box, ${got.top.toFixed(1)} to ${got.bottom.toFixed(1)}, starts at the head's top, under the header, and ends inside the head`).toEqual([true, true, true]);
      /* and the head is no taller for it: it takes one line's room, as its words alone did - the head's 10 px of padding, a line, then the 5 px gap and the kind's 4 px margin */
      expect.soft(Math.abs(got.kind - got.head[0] - (10 + got.line + 9)) <= 0.5, `the kind's line starts ${(got.kind - got.head[0]).toFixed(1)} px under the head's top, a line of ${got.line.toFixed(1)} px and 19 more`).toBe(true);
      await page.locator(".explore-head .back").tap();
      await expect(page.locator("#exploreGrid")).toBeVisible();
    });
    test(`a follow chip's name is 44 px tall and its x 44 by 44, each its own to a touch, and "Follow more" is 44 px tall beside them${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "explore");
      await page.evaluate(() => document.querySelector(".follow-chips").scrollIntoView({ block: "center" }));
      await settled(page);
      const got = await page.evaluate(() => {
        const size = el => { const b = el.getBoundingClientRect(); return [b.width, b.height]; };
        const row = document.querySelector(".follow-chips");
        return { chips: [...row.querySelectorAll(".follow-chip")].map(c => ({ says: c.querySelector(".fc-name").textContent, name: size(c.querySelector(".fc-name")), x: size(c.querySelector(".fc-x")), chip: size(c) })),
          add: size(row.querySelector(".fc-add")), scrolls: getComputedStyle(row).overflowX };
      });
      expect.soft(got.chips.map(c => c.says)).toEqual(["Star Trek", "Alan Tudyk"]);
      for (const c of got.chips) {
        expect.soft([c.name[1] >= 44, c.x[0] >= 44, c.x[1] >= 44], `${c.says}: its name is ${c.name[1].toFixed(1)} px tall, its x ${c.x[0].toFixed(1)} by ${c.x[1].toFixed(1)}`).toEqual([true, true, true]);
      }
      expect.soft([got.add[1] >= 44, got.scrolls], `"Follow more" is ${got.add[1].toFixed(1)} px tall, in a row that scrolls where it is too long`).toEqual([true, "auto"]);
      for (const part of [".fc-name", ".fc-x"]) {
        expect.soft(await page.evaluate(answers, `.follow-chips .follow-chip ${part}`), `the first chip's ${part}: a touch just inside each edge is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
      }
    });
  });

  test.describe(`the Map's card with no pick${text}`, () => {
    test.use({ storageState: seed({ ...storage }) });
    test(`it says a hotel can be tapped, whole on the screen above the nav, and the map over it is no shorter than its floor${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      const got = await page.evaluate(() => {
        const card = document.querySelector("#mapUnder .next-card"), b = card.getBoundingClientRect(), svg = document.querySelector("#view-map svg.map").getBoundingClientRect();
        return { says: card.textContent, top: b.top, bottom: b.bottom, left: b.left, right: b.right, nav: document.querySelector(".nav").getBoundingClientRect().top, map: [svg.bottom, svg.height], cut: card.scrollHeight > card.clientHeight };
      });
      expect.soft(got.says).toBe("Tap a hotel to see its floors. Star things in Explore or Search and your next pick shows here.");
      expect.soft([got.top >= got.map[0], got.bottom <= got.nav + 0.5, got.left >= 0, got.right <= page.viewportSize().width, got.cut], `the card, ${got.top.toFixed(1)} to ${got.bottom.toFixed(1)}, is under the map and above the nav, at ${got.nav.toFixed(1)}`).toEqual([true, true, true, true, false]);
      expect.soft(got.map[1] >= 200, `the map is ${got.map[1].toFixed(1)} px tall`).toBe(true);
    });
  });
}
