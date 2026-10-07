/* The stack (DECISIONS #95): a venue lifted into its floors, where a phone
   draws it. jsdom cannot say any of this: every box there is 0. Each of the
   seven venues opens by a touch on its block; a touch at the middle of the
   strip each plate shows is that plate's own; the way back is 44 px; a
   plate that is touched stands where it stood, to 1 px, selected and
   cleared, because the frame is one size whatever the card says (#86); the
   card is whole on the screen; an inert plate has no fill and takes no
   touch, so the plate under it does; and by the keyboard Tab reaches the
   way back and every plate, Enter selects, Escape goes back and focus is on
   the block.

   The strips are held to what was measured when the stack was built, at
   each size, with Larger text off and on: the stack is laid out in the
   Map's own units, so a strip is 40 of them and never 40 px, and a short
   screen draws the frame, and the strip with it, smaller. The Hilton's is
   its own: five floors, and the width wins. They cannot get worse unseen.

   One page a test, walked, its assertions soft and named for their venue
   and plate. The reader is seeded here: picks at the Hyatt, the Hilton, the
   Westin's 12th Floor and Mart Building 2. */
import { CLOCKS, answers, check, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const VENUES = ["Marriott", "Hyatt", "Hilton", "Courtland Grand", "Westin", "AmericasMart Building 2", "AmericasMart Building 3"];
const READER = { picks: [
  "c32d19e7750818e0eb903f152ac90776", "6ecc75745a676d39f23005562373d163",     // the Hyatt: the Concourse, on now, and Hanover F-G at 2:30
  "c32d19e7750818e0eb903f152ad9f1a0",                                         // the Hilton: 209-211
  "1e3995157984a4c0e6515a2ed6314ce1",                                         // the Westin's 12th Floor
  "c32d19e7750818e0eb903f152ac64313",                                         // Mart Building 2: 204J, on its 4th floor
] };
const LOBBY = "lobby", BALLROOM = "ballroom+tower-ll1";
const TOLERANCE = 1;
/* The strip a plate shows under the one above, in px, by the screen's width:
   every venue's, and the Hilton's - as measured in Chromium and in WebKit,
   which agreed to 0.2 px. */
const STRIPS = {
  "": { 375: [31.7, 25.1], 390: [31.3, 24.8], 402: [37.9, 30.0] },
  ", with Larger text on": { 375: [29.1, 23.1], 390: [28.7, 22.7], 402: [35.3, 27.9] },
};
const MEASURED = 0.3;                                    // what a measurement may be out by

/* What stands where while a stack is open: run in the page. Each plate with
   its outline's box, the strip it shows under the plate above - the top
   plate shows its whole face - and whether a touch at the middle of that
   strip is its own: the middle of the run of the strip's row that answers to
   the plate, since a plate's outline is no rectangle. */
function stackState() {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const svg = document.querySelector("#view-map svg.map"), group = svg.querySelector(".map-stack:not([hidden])");
  const under = document.getElementById("mapUnder"), card = under.firstElementChild, back = document.getElementById("mapBack");
  const plates = group ? [...group.querySelectorAll(".plate")] : [], boxes = plates.map(p => box(p.querySelector(".plate-hull")));
  const hull = p => getComputedStyle(p.querySelector(".plate-hull"));
  return {
    stack: svg.getAttribute("data-stack"), frame: box(svg), slot: box(under), card: card ? { id: card.id, rows: card.querySelectorAll(".pc-row").length, ...box(card) } : null,
    back: back.hidden ? null : box(back), head: document.querySelector(".hdr").getBoundingClientRect().bottom, nav: document.querySelector(".nav").getBoundingClientRect().top,
    selected: plates.filter(p => p.classList.contains("selected")).map(p => p.dataset.plate),
    plates: plates.map((p, j) => {
      const own = boxes[j], above = boxes[j + 1] || null, y = above ? (above.bottom + own.bottom) / 2 : (own.top + own.bottom) / 2;
      let first = null, last = null;
      for (let x = own.left; x <= own.right; x += 1) {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit.closest(".plate") === p) { if (first === null) first = x; last = x; }
      }
      const x = first === null ? (own.left + own.right) / 2 : (first + last) / 2, hit = document.elementFromPoint(x, y);
      return { key: p.dataset.plate, inert: p.classList.contains("inert"), button: p.getAttribute("role") === "button", pressed: p.getAttribute("aria-pressed"),
        top: own.top, left: own.left, strip: above ? own.bottom - above.bottom : own.height, x, y, own: !!hit && hit.closest(".plate") === p,
        fill: hull(p).fill, pointer: getComputedStyle(p).pointerEvents };
    }),
  };
}
/* A point inside the outline of one plate, by its key, and what answers a
   touch there: the middle of the outline's box, checked against the outline
   itself, corner by corner on the screen, since a see-through plate answers
   no touch that could say so. */
function through(key) {
  const group = document.querySelector("#view-map .map-stack:not([hidden])"), plate = [...group.querySelectorAll(".plate")].find(p => p.dataset.plate === key);
  const outline = plate.querySelector(".plate-hull"), b = outline.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2;
  const matrix = outline.getScreenCTM(), svg = outline.ownerSVGElement;
  const corners = [...outline.points].map(p => { const at = svg.createSVGPoint(); at.x = p.x; at.y = p.y; const on = at.matrixTransform(matrix); return [on.x, on.y]; });
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, yi] = corners[i], [xj, yj] = corners[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  const hit = document.elementFromPoint(x, y), under = hit && hit.closest(".plate");
  return { x, y, inside, answers: under ? under.dataset.plate : null };
}
const openStack = async (page, hotel) => {
  await page.locator(`#view-map .map-hotel[data-hotel="${hotel}"]`).tap();
  await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", hotel);
  await settled(page);
};
const goBack = async page => {
  await page.locator("#mapBack").tap();
  await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
  await settled(page);
};
/* The card whole on the screen, between the header and the nav, inside its slot. */
const whole = s => !!s.card && s.card.height > 0 && s.card.top >= s.head && s.card.bottom <= s.nav + 0.5 && s.card.bottom <= s.slot.bottom + 0.5 && s.slot.bottom <= s.nav + 0.5 && s.card.left >= 0 && s.card.right <= s.frame.right + 0.5;

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`a venue's stack${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...storage }) });

    test(`each of the seven opens by a touch on its block: every strip is its plate's own and no shallower than measured, the way back is 44 px, the card is whole on the screen, and the frame is one size for all${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      const [strip, hilton] = STRIPS[text][page.viewportSize().width], frames = [];
      for (const hotel of VENUES) {
        await openStack(page, hotel);
        const s = await page.evaluate(stackState);
        frames.push([s.frame.width, s.frame.height].map(v => v.toFixed(1)).join(" x "));
        expect.soft(s.plates.length, `${hotel}: its plates are drawn`).toBeGreaterThan(1);
        for (const [j, p] of s.plates.entries()) {
          if (p.inert) continue;
          expect.soft(p.own, `${hotel}, ${p.key}: a touch at the middle of its strip is its own`).toBe(true);
          if (j < s.plates.length - 1) expect.soft(p.strip, `${hotel}, ${p.key}: its strip, ${p.strip.toFixed(1)} px`).toBeGreaterThanOrEqual((hotel === "Hilton" ? hilton : strip) - MEASURED);
        }
        expect.soft([s.back.height >= 44, s.back.width >= 44], `${hotel}: the way back is ${s.back.width.toFixed(1)} by ${s.back.height.toFixed(1)} px`).toEqual([true, true]);
        expect.soft(await page.evaluate(answers, "#mapBack"), `${hotel}: a touch just inside each edge of the way back is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
        expect.soft([s.card.id, whole(s)], `${hotel}: the venue's line, whole on the screen`).toEqual(["mapVenue", true]);
        expect.soft(s.card.height, `${hotel}: the venue's line is a 44 px tap or more`).toBeGreaterThanOrEqual(44);
        const found = await check(page);
        expect.soft(found.sideways, `${hotel}: nothing scrolls sideways`).toEqual([]);
        expect.soft(found.cut, `${hotel}: no control is cut off`).toEqual([]);
        await goBack(page);
      }
      expect.soft(new Set(frames).size, `the frame is one size under every venue's line: ${[...new Set(frames)].join(", ")}`).toBe(1);
    });

    test(`a plate touched stands where it stood, to 1 px, selected and cleared; the frame and the slot keep their size, and the card is whole on the screen${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      for (const hotel of VENUES) {
        await openStack(page, hotel);
        const start = await page.evaluate(stackState);
        for (const { key } of start.plates.filter(p => p.button)) {
          for (const turn of ["selected", "cleared"]) {
            const name = `${hotel}, ${key}, ${turn}`, before = await page.evaluate(stackState), plate = before.plates.find(p => p.key === key);
            await page.touchscreen.tap(plate.x, plate.y);
            await expect(page.locator(`#view-map .map-stack:not([hidden]) .plate[data-plate="${key}"]`)).toHaveAttribute("aria-pressed", String(turn === "selected"));
            await settled(page);
            const after = await page.evaluate(stackState), now = after.plates.find(p => p.key === key);
            expect.soft(after.selected, name).toEqual(turn === "selected" ? [key] : []);
            expect.soft(Math.max(Math.abs(now.top - plate.top), Math.abs(now.left - plate.left)), `${name}: it stood at ${plate.left.toFixed(1)}, ${plate.top.toFixed(1)} and stands at ${now.left.toFixed(1)}, ${now.top.toFixed(1)}`).toBeLessThanOrEqual(TOLERANCE);
            expect.soft([after.frame.height - start.frame.height, after.slot.height - start.slot.height].map(d => Math.abs(d) <= 0.5), `${name}: the frame, ${after.frame.height.toFixed(1)} px, and the slot, ${after.slot.height.toFixed(1)}, as they were`).toEqual([true, true]);
            expect.soft([after.card.id, whole(after)], `${name}: the card whole on the screen`).toEqual([turn === "selected" ? "mapPlate" : "mapVenue", true]);
            /* The slot is a plate's card with two rows, and its 10 px above: no more, and no less. */
            if (after.card.rows === 2) expect.soft(Math.abs(after.slot.height - after.card.height - 10), `${name}: the slot, ${after.slot.height.toFixed(1)} px, is its two-row card, ${after.card.height.toFixed(1)}, and the 10 above it`).toBeLessThanOrEqual(0.5);
          }
        }
        await goBack(page);
      }
    });

    test(`an inert plate is see-through: the Hyatt's Lobby Level has no fill and takes no touch, and a touch on the Ballroom plate's face inside its outline is the Ballroom plate's own${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      await openStack(page, "Hyatt");
      const s = await page.evaluate(stackState), lobby = s.plates.find(p => p.key === LOBBY);
      expect.soft([lobby.inert, lobby.button, lobby.fill, lobby.pointer], "the Lobby Level: inert, no button, no fill, no pointer").toEqual([true, false, "none", "none"]);
      const at = await page.evaluate(through, LOBBY);
      expect.soft([at.inside, at.answers], "the middle of the Lobby Level's outline is inside it, and answers to the Ballroom plate under it").toEqual([true, BALLROOM]);
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.locator(`#view-map .plate[data-plate="${BALLROOM}"]`)).toHaveAttribute("aria-pressed", "true");
      const after = await page.evaluate(stackState);
      expect.soft([after.stack, after.selected, after.card.id], "the touch selected the Ballroom plate, and the stack stands").toEqual(["Hyatt", [BALLROOM], "mapPlate"]);
    });
  });
}

test.describe("a venue's stack, by the keyboard", () => {
  test.use({ storageState: seed(READER) });

  test("Enter on a block opens its stack with focus on the way back; Tab then walks the plates bottom to top and comes to the card; Enter selects; Escape goes back, and focus is on the block", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? a.id || a.getAttribute("data-plate") || a.getAttribute("data-hotel") || a.tagName : null; });
    await page.locator('#view-map .map-hotel[data-hotel="Hyatt"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", "Hyatt");
    expect.soft(await focused(), "focus is on the way back").toBe("mapBack");
    const walked = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); walked.push(await focused()); }
    expect.soft(walked, "Tab: the plates that are buttons, bottom to top, then the venue's line - no block of the city map, and no inert plate").toEqual(["acc", "exhibit+tower-ll2", BALLROOM, "mapVenue"]);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator(`#view-map .plate[data-plate="${BALLROOM}"]`)).toHaveAttribute("aria-pressed", "true");
    expect.soft(await focused(), "Enter selected the plate, and focus is still on it").toBe(BALLROOM);
    const s = await page.evaluate(stackState);
    expect.soft([s.selected, s.card.id, whole(s)], "its card, whole on the screen").toEqual([[BALLROOM], "mapPlate", true]);
    await page.keyboard.press(" ");
    await expect(page.locator(`#view-map .plate[data-plate="${BALLROOM}"]`)).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
    expect.soft(await focused(), "Escape went back, and focus is on the venue's block").toBe("Hyatt");
    await page.keyboard.press("Enter");
    await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", "Hyatt");
    await page.keyboard.press("Enter");                          // the way back has focus: Enter is its tap
    await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
    expect.soft(await focused(), "the way back, by the keyboard: focus on the block").toBe("Hyatt");
  });
});
