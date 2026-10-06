/* The gear (DECISIONS #92): Settings fits its screen, and About this app is
   behind it. Settings is its heading, one body that scrolls and Done pinned
   at its foot, in a sheet no taller than 86% of the screen: in every state
   it has - no backend; with one, signed out, a code sent, signed in; with
   Advanced and Walk-time defaults shut and open - the heading and Done are
   whole on the screen. The backend's states are read on the harness's
   second page, whose backend is the harness (harness.js). One page a test,
   its states walked, and every assertion soft and named for its state. */
import { CLOCKS, ORIGIN, SIGNED_IN, WITH_BACKEND, check, expect, open, seed, settled, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const STATES = [
  { name: "no backend", at: ORIGIN, storage: {}, keep: null },
  { name: "a backend, signed out", at: WITH_BACKEND, storage: {}, keep: "#keepEmailForm" },
  { name: "a backend, a code sent", at: WITH_BACKEND, storage: {}, keep: "#keepCodeForm", code: true },
  { name: "a backend, signed in", at: WITH_BACKEND, storage: { session: SIGNED_IN }, keep: "#keepSignOut" },
];
const CONTROLS = "#sheet button, #sheet a[href], #sheet input, #sheet select, #sheet summary";

/* What stands where in the sheet, for the panel shown: run in the page. */
function sheetState(panelId) {
  const box = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height, width: b.width }; };
  const screen = { width: window.innerWidth, height: window.innerHeight };
  const whole = b => b.height > 0 && b.top >= 0 && b.bottom <= screen.height + 0.5 && b.left >= 0 && b.right <= screen.width + 0.5;
  const panel = document.getElementById(panelId), sheet = box(document.getElementById("sheet"));
  const body = panel.querySelector(".sheet-body"), foot = panel.querySelector(".sheet-foot"), button = foot.querySelector(".btn");
  const bodyBox = box(body);
  return {
    screen, top: sheet.top, height: sheet.height, bottom: sheet.bottom,
    heading: whole(box(panel.querySelector("h2"))), button: whole(box(button)), buttonHeight: box(button).height,
    buttonWide: box(button).width >= box(foot).width - 0.5, footUnderBody: box(foot).top >= bodyBox.bottom - 4.5,
    room: body.clientHeight, content: body.scrollHeight, scrolled: body.scrollTop,
    sideways: body.scrollWidth - body.clientWidth,
    wide: [...body.querySelectorAll("*")].filter(el => el.getClientRects().length && (box(el).right > bodyBox.right + 0.5 || box(el).left < bodyBox.left - 0.5)).map(el => el.id || el.tagName),
    arrow: getComputedStyle(foot, "::before").content !== "none",
    more: body.getAttribute("data-more"),
  };
}
/* Each checkbox of Settings beside its words: the box, its label's row, and
   where the words' lines stand. */
function toggles() {
  return [...document.querySelectorAll("#panel-settings label.toggle")].map(label => {
    const box = label.querySelector("input").getBoundingClientRect(), row = label.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(label);
    const lines = [...range.getClientRects()].filter(r => r.width > 30);
    return { id: label.querySelector("input").id, row: row.height, box: [box.width, box.height],
      beside: lines.length > 0 && lines.every(r => r.left >= box.right && r.top < row.bottom && r.bottom > row.top),
      level: box.top >= row.top - 0.5 && box.bottom <= row.bottom + 0.5 };
  });
}
const toEnd = (page, id) => page.evaluate(body => { const el = document.getElementById(body); el.scrollTop = el.scrollHeight; }, id);
const toTop = (page, id) => page.evaluate(body => { document.getElementById(body).scrollTop = 0; }, id);

/* What holds of a panel wherever it stands: the sheet on the screen and no
   taller than its cap, the heading and the main button whole, nothing wider
   than the body, and the arrow there exactly while 20 px or more is below. */
async function stands(page, panelId, bodyId, at) {
  await settled(page);
  const s = await page.evaluate(sheetState, panelId);
  expect.soft(s.top, `${at}: the sheet's top is on the screen`).toBeGreaterThanOrEqual(0);
  expect.soft(s.height, `${at}: the sheet is at most 86% of the screen`).toBeLessThanOrEqual(s.screen.height * 0.86 + 0.5);
  expect.soft(Math.abs(s.bottom - s.screen.height), `${at}: the sheet stands on the screen's foot`).toBeLessThan(1);
  expect.soft(s.heading, `${at}: the heading is whole on the screen`).toBe(true);
  expect.soft(s.button, `${at}: the main button is whole on the screen`).toBe(true);
  expect.soft(s.buttonHeight, `${at}: the main button is 44 px or more`).toBeGreaterThanOrEqual(44);
  expect.soft(s.buttonWide, `${at}: the main button is as wide as the sheet`).toBe(true);
  expect.soft(s.footUnderBody, `${at}: the foot is under the body, not in it`).toBe(true);
  expect.soft(s.sideways, `${at}: the body does not scroll sideways`).toBe(0);
  expect.soft(s.wide, `${at}: nothing is wider than the body`).toEqual([]);
  const found = await check(page, CONTROLS);
  expect.soft(found.sideways, `${at}: nothing scrolls sideways`).toEqual([]);
  expect.soft(found.cut, `${at}: no control is cut off`).toEqual([]);
  if (s.content - s.room >= 20) {
    await toTop(page, bodyId);
    await expect.soft.poll(() => page.evaluate(sheetState, panelId).then(now => now.arrow), `${at}: the arrow is there while more is below`).toBe(true);
    await toEnd(page, bodyId);
    await expect.soft.poll(() => page.evaluate(sheetState, panelId).then(now => now.arrow), `${at}: the arrow is gone at the end`).toBe(false);
    const end = await page.evaluate(sheetState, panelId);
    expect.soft(end.heading && end.button, `${at}: scrolled to its end, the heading and the button are still whole`).toBe(true);
    await toTop(page, bodyId);
  } else {
    expect.soft(s.arrow, `${at}: no arrow where everything fits`).toBe(false);
  }
  return s;
}

async function openSettings(page, state) {
  await open(page, SATURDAY, "", state.at);
  await page.locator("#settingsBtn").tap();
  await expect(page.locator("#panel-settings")).toBeVisible();
  if (state.code) {
    await page.locator("#keepEmail").fill("you@example.com");
    await page.locator("#keepSend").tap();
    await page.locator("#keepEmail").blur();
  }
  if (state.keep) await expect(page.locator(state.keep), `${state.name}: Keep your plan is in that state`).toBeVisible();
  else await expect(page.locator("#keep")).toBeHidden();
}

for (const [text, big] of Object.entries(TEXT)) {
  for (const state of STATES) {
    test.describe(`Settings, ${state.name}${text}`, () => {
      test.use({ storageState: seed({ ...state.storage, ...big }, state.at) });

      test(`its heading and Done are whole on the screen, Advanced shut and open: ${state.name}${text}`, async ({ page }) => {
        await openSettings(page, state);
        const shut = await stands(page, "panel-settings", "settingsBody", "as it opens");
        /* sending the form scrolled to it: every other state is as the gear opened it */
        if (!state.code) expect.soft(shut.scrolled, "as it opens: the body is at its top").toBe(0);
        for (const t of await page.evaluate(toggles)) {
          expect.soft(t.beside, `${t.id}: the box stands beside its words, in their row`).toBe(true);
          expect.soft(t.level, `${t.id}: the box is inside its row`).toBe(true);
          expect.soft(t.row, `${t.id}: the row is 44 px or more`).toBeGreaterThanOrEqual(44);
          expect.soft(t.box, `${t.id}: the box is not squeezed`).toEqual([22, 22]);
        }
        expect.soft((await page.locator("#aboutRow").boundingBox()).height, "the About row is 44 px or more").toBeGreaterThanOrEqual(44);
        const body = await page.locator("#settingsBody").boundingBox(), row = await page.locator("#aboutRow").boundingBox();
        expect.soft(Math.abs(row.width - (body.width - 8)), "the About row is as wide as the body").toBeLessThan(1);

        await page.locator("#advanced > summary").tap();
        await page.locator("#advanced details > summary").tap();
        await expect(page.locator("#walkTable")).toBeVisible();
        const opened = await stands(page, "panel-settings", "settingsBody", "Advanced and Walk-time defaults open");
        expect.soft(opened.content, "Advanced open: the body holds more than its room, and scrolls").toBeGreaterThan(opened.room + 20);
        /* Advanced has no scroller of its own: the whole fold is in the body. */
        expect.soft(await page.evaluate(() => { const fold = document.querySelector(".advanced-body"); return fold.scrollHeight - fold.clientHeight; }), "Advanced's fold holds everything it has").toBe(0);

        /* Done closes, from wherever the body was left. */
        await toEnd(page, "settingsBody");
        await page.locator("#closeSheet").tap();
        await expect(page.locator("#sheetWrap")).toBeHidden();
      });
    });
  }

  for (const state of [STATES[0], STATES[3]]) {
    test.describe(`About this app, ${state.name}${text}`, () => {
      test.use({ storageState: seed({ ...state.storage, ...big }, state.at) });

      test(`stands behind Settings' row, whole, and every way out is back: ${state.name}${text}`, async ({ page, browserName }) => {
        await openSettings(page, state);
        /* Where Settings' body stands with the row in view: read before the
           tap, since a hidden panel's scroll reads 0 - which is why the page
           keeps it. With a backend the row is under the fold. */
        await page.locator("#aboutRow").scrollIntoViewIfNeeded();
        const at = await page.evaluate(() => document.getElementById("settingsBody").scrollTop);
        if (state.keep) expect.soft(at, "with a backend the row is under the fold").toBeGreaterThan(0);
        await page.locator("#aboutRow").tap();
        await expect(page.locator("#panel-about")).toBeVisible();
        await expect(page.locator("#panel-settings")).toBeHidden();
        await expect(page.locator("#sheetTitleAbout")).toBeFocused();

        const about = await stands(page, "panel-about", "aboutBody", "the about panel");
        expect.soft(about.content, "the about panel: its words are more than its room").toBeGreaterThan(about.room + 20);
        expect.soft((await page.locator("#aboutLink").boundingBox()).height, "the link is 44 px or more where it is tapped").toBeGreaterThanOrEqual(44);
        await expect.soft(page.locator("#aboutLink")).toHaveAttribute("href", "https://www.dragoncon.org/");
        /* Every word can be reached: at its end the last line is inside the body. */
        await toEnd(page, "aboutBody");
        expect.soft(await page.evaluate(() => {
          const body = document.getElementById("aboutBody"), last = body.lastElementChild.getBoundingClientRect(), box = body.getBoundingClientRect();
          return last.bottom <= box.bottom + 0.5 && last.top >= box.top;
        }), "the about panel: its last paragraph is whole at its end").toBe(true);

        /* Back to Settings: Settings again, where it was, focus on the row. */
        const back = async how => {
          await expect(page.locator("#panel-settings"), `${how}: Settings is shown`).toBeVisible();
          await expect(page.locator("#panel-about"), `${how}: the about panel is not`).toBeHidden();
          await expect(page.locator("#aboutRow"), `${how}: focus is on the row`).toBeFocused();
          expect.soft(await page.evaluate(() => document.getElementById("settingsBody").scrollTop), `${how}: Settings' body is where it was`).toBe(at);
          await expect(page.locator("#aboutRow"), `${how}: the row is in view`).toBeInViewport({ ratio: 1 });
        };
        await page.locator("#aboutBack").tap();
        await back("Back to Settings");
        await page.locator("#aboutRow").tap();
        await expect(page.locator("#panel-about")).toBeVisible();
        await page.keyboard.press("Escape");
        await back("Escape");
        await page.locator("#aboutRow").tap();
        await expect(page.locator("#panel-about")).toBeVisible();
        const sheet = await page.locator("#sheet").boundingBox();
        await page.touchscreen.tap(sheet.x + sheet.width / 2, sheet.y / 2);      // the backdrop, above the sheet
        await back("a tap on the backdrop");

        await page.locator("#closeSheet").tap();
        await expect(page.locator("#sheetWrap")).toBeHidden();
        /* WebKit does not focus a button that is tapped, so there the sheet
           had no opener to give focus back to. */
        if (browserName === "chromium") await expect(page.locator("#settingsBtn")).toBeFocused();
      });
    });
  }
}

test.describe("Plans' strip", () => {
  test.use({ storageState: seed({ picks: ["1e3995157984a4c0e6515a2ed62d4003", "1e3995157984a4c0e6515a2ed62d2026"] }) });

  test("is Export to calendar and Share a day, on one row, with no Remove all", async ({ page }) => {
    await open(page, SATURDAY);
    await page.locator('nav button[data-tab="plans"]').tap();
    const strip = page.locator("#view-plans .plans-actions .btn");
    await expect(strip).toHaveText(["Export to calendar", "Share a day"]);
    const [first, second] = [await strip.nth(0).boundingBox(), await strip.nth(1).boundingBox()];
    expect(first.y, "the two are on one row").toBe(second.y);
    expect(first.height, "each 44 px").toBe(44);
    await expect(page.locator("#view-plans").getByText("Remove all")).toHaveCount(0);
  });
});
