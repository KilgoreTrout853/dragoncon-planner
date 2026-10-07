/* The stack (DECISIONS #95): a venue lifted into its floors, where a phone
   draws it. jsdom cannot say any of this: every box there is 0. Each of the
   seven venues opens by a touch on its block; a touch at the middle of the
   strip each plate shows is that plate's own; the way back is 44 px; a
   plate that is touched stands where it stood, to 1 px, selected and
   cleared, because the frame is one size whatever the card says (#86); the
   card is whole on the screen, no line of it cut short; an inert plate has
   no fill and takes no touch, so the plate under it does; a touch on a
   floor's name is that floor's, wherever the words stand; an open area
   with a pick in it is lit as a room is; and by the keyboard Tab reaches
   the way back and every plate, each showing its focus by its edge - a
   gold edge too - Enter selects, a held key is one press, Escape goes back
   and focus is on the block. And on a screen too short for the map's floor
   and the slot, the tab scrolls and the card's last row can be reached.

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
/* How many of them are at each venue that Saturday: what its line says, and
   whether any of its plates has the gold edge. */
const PICKS = { Hyatt: 2, Hilton: 1, Westin: 1, "AmericasMart Building 2": 1 };
const LOBBY = "lobby", BALLROOM = "ballroom+tower-ll1", EXHIBIT = "exhibit+tower-ll2";
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
   the plate, since a plate's outline is no rectangle. And its name: the
   middle of its label's box, and whether a touch there is the label's own.
   Of the card: what its day's line says, and whether an ellipsis has cut
   its name or, on the venue's line, either line. Of what is lit: whether it
   is an open area, and its fill. */
function stackState() {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const svg = document.querySelector("#view-map svg.map"), group = svg.querySelector(".map-stack:not([hidden])");
  const under = document.getElementById("mapUnder"), card = under.firstElementChild, back = document.getElementById("mapBack");
  const plates = group ? [...group.querySelectorAll(".plate")] : [], boxes = plates.map(p => box(p.querySelector(".plate-hull")));
  const labels = group ? [...group.querySelectorAll(".plate-label")] : [];
  const hull = p => getComputedStyle(p.querySelector(".plate-hull"));
  const cut = el => el.scrollWidth > el.clientWidth;
  const says = card && card.querySelector(".nc-when");
  return {
    stack: svg.getAttribute("data-stack"), frame: box(svg), slot: box(under),
    card: card ? { id: card.id, rows: card.querySelectorAll(".pc-row").length, ...box(card), says: says ? says.textContent : "", cut: [...card.querySelectorAll(card.id === "mapVenue" ? ".nc-title, .nc-when" : ".nc-title")].filter(cut).map(el => el.textContent) } : null,
    back: back.hidden ? null : box(back), head: document.querySelector(".hdr").getBoundingClientRect().bottom, nav: document.querySelector(".nav").getBoundingClientRect().top,
    selected: plates.filter(p => p.classList.contains("selected")).map(p => p.dataset.plate),
    lit: group ? [...group.querySelectorAll(".lit")].map(n => ({ place: n.classList.contains("plate-open"), fill: getComputedStyle(n).fill })) : [],
    plates: plates.map((p, j) => {
      const own = boxes[j], above = boxes[j + 1] || null, y = above ? (above.bottom + own.bottom) / 2 : (own.top + own.bottom) / 2;
      let first = null, last = null;
      for (let x = own.left; x <= own.right; x += 1) {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit.closest(".plate") === p) { if (first === null) first = x; last = x; }
      }
      const x = first === null ? (own.left + own.right) / 2 : (first + last) / 2, hit = document.elementFromPoint(x, y);
      const label = labels.find(t => t.dataset.plate === p.dataset.plate), words = label.getBoundingClientRect(), nx = (words.left + words.right) / 2, ny = (words.top + words.bottom) / 2, named = document.elementFromPoint(nx, ny);
      const below = document.elementsFromPoint(nx, ny).filter(n => !n.closest(".plate-label")).map(n => n.closest(".plate")).find(Boolean);        // the plate the words stand over, if any
      return { key: p.dataset.plate, inert: p.classList.contains("inert"), button: p.getAttribute("role") === "button", pressed: p.getAttribute("aria-pressed"), mine: p.classList.contains("mine"),
        top: own.top, left: own.left, strip: above ? own.bottom - above.bottom : own.height, x, y, own: !!hit && hit.closest(".plate") === p,
        name: { x: nx, y: ny, own: !!named && named.closest(".plate-label") === label, over: below ? below.dataset.plate : null },
        fill: hull(p).fill, edge: parseFloat(hull(p).strokeWidth), pointer: getComputedStyle(p).pointerEvents };
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
          expect.soft(p.name.own, `${hotel}, ${p.key}: a touch at the middle of its name is the name's own`).toBe(true);
          if (j < s.plates.length - 1) expect.soft(p.strip, `${hotel}, ${p.key}: its strip, ${p.strip.toFixed(1)} px`).toBeGreaterThanOrEqual((hotel === "Hilton" ? hilton : strip) - MEASURED);
        }
        expect.soft([s.back.height >= 44, s.back.width >= 44], `${hotel}: the way back is ${s.back.width.toFixed(1)} by ${s.back.height.toFixed(1)} px`).toEqual([true, true]);
        expect.soft(await page.evaluate(answers, "#mapBack"), `${hotel}: a touch just inside each edge of the way back is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
        expect.soft([s.card.id, whole(s), s.card.cut], `${hotel}: the venue's line, whole on the screen, neither line cut short`).toEqual(["mapVenue", true, []]);
        expect.soft(s.card.height, `${hotel}: the venue's line is a 44 px tap or more`).toBeGreaterThanOrEqual(44);
        /* The reader seeded above is the reader the page drew for: their picks on the line, and a gold edge where they have one. */
        const picks = PICKS[hotel] || 0;
        expect.soft([s.card.says, s.plates.some(p => p.mine)], `${hotel}: the reader's picks on its line, and a gold edge where there are any`).toEqual([`Saturday · ${picks ? `${picks} pick${picks === 1 ? "" : "s"}` : "no picks"}`, picks > 0]);
        if (hotel === "Hyatt") {
          const place = s.lit.filter(l => l.place), room = s.lit.filter(l => !l.place);
          expect.soft([place.length, room.length > 0, place.map(l => l.fill)], "the Hyatt: the Concourse, an open area with a pick in it, is lit, and as a room is").toEqual([1, true, room.slice(0, 1).map(l => l.fill)]);
        }
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
      let tall = 0;
      for (const hotel of VENUES) {
        await openStack(page, hotel);
        const start = await page.evaluate(stackState);
        expect.soft(start.plates.filter(p => p.button).length, `${hotel}: it has plates that take a touch`).toBeGreaterThan(0);
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
            expect.soft([after.card.id, whole(after), after.card.cut], `${name}: the card whole on the screen, its name whole on its line`).toEqual([turn === "selected" ? "mapPlate" : "mapVenue", true, []]);
            /* The slot is a plate's card with two rows, and its 10 px above: no more, and no less. */
            if (after.card.rows !== 2) continue;
            tall++;
            expect.soft(Math.abs(after.slot.height - after.card.height - 10), `${name}: the slot, ${after.slot.height.toFixed(1)} px, is its two-row card, ${after.card.height.toFixed(1)}, and the 10 above it`).toBeLessThanOrEqual(0.5);
          }
        }
        await goBack(page);
      }
      expect.soft(tall, "a card with two rows was met, so the slot was held to it").toBeGreaterThan(0);
    });

    test(`a touch on a floor's name is that floor's, wherever the words stand - over its own plate, over the plate below, or over the ground: it selects it, and again clears it${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      const elsewhere = [];
      for (const hotel of VENUES) {
        await openStack(page, hotel);
        const start = await page.evaluate(stackState);
        for (const { key } of start.plates.filter(p => p.button)) {
          for (const turn of ["selected", "cleared"]) {
            const before = await page.evaluate(stackState), plate = before.plates.find(p => p.key === key);
            if (turn === "selected" && plate.name.over !== key) elsewhere.push(`${hotel}, ${key}`);
            await page.touchscreen.tap(plate.name.x, plate.name.y);
            await expect(page.locator(`#view-map .map-stack:not([hidden]) .plate[data-plate="${key}"]`), `${hotel}, ${key}, by its name: ${turn}`).toHaveAttribute("aria-pressed", String(turn === "selected"));
            await settled(page);
            const after = await page.evaluate(stackState);
            expect.soft([after.stack, after.selected], `${hotel}, ${key}, by its name: ${turn}, and the stack stands`).toEqual([hotel, turn === "selected" ? [key] : []]);
          }
        }
        await goBack(page);
      }
      expect.soft(elsewhere.length, `a name that stands over something other than its own plate was among them: ${elsewhere.join("; ")}`).toBeGreaterThan(0);
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
    /* Another venue's stack, opened and put away, stands in the page before the Hyatt's: Tab must not walk its plates, which WebKit would. */
    await openStack(page, "Marriott");
    await goBack(page);
    const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? a.id || a.getAttribute("data-plate") || a.getAttribute("data-hotel") || a.tagName : null; });
    await page.locator('#view-map .map-hotel[data-hotel="Hyatt"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", "Hyatt");
    expect.soft(await focused(), "focus is on the way back").toBe("mapBack");
    const edge = key => page.evaluate(k => parseFloat(getComputedStyle(document.querySelector(`#view-map .map-stack:not([hidden]) .plate[data-plate="${k}"] .plate-hull`)).strokeWidth), key);
    const walked = [], edges = {};
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      walked.push(await focused());
      if (walked[i] !== "mapVenue") edges[walked[i]] = { focused: await edge(walked[i]) };
    }
    expect.soft(walked, "Tab: the plates that are buttons, bottom to top, then the venue's line - no block of the city map, and no inert plate").toEqual(["acc", EXHIBIT, BALLROOM, "mapVenue"]);
    /* Focus is on the venue's line now: each plate's edge as it is with none, against what it was with focus on it. */
    const gold = (await page.evaluate(stackState)).plates.filter(p => p.mine).map(p => p.key);
    expect.soft([gold.length > 0, gold.length < 3], "the walk met a plate with the gold edge, and one without").toEqual([true, true]);
    for (const [key, at] of Object.entries(edges)) {
      const plain = await edge(key);
      expect.soft(at.focused, `${key}${gold.includes(key) ? ", gold-edged" : ""}: focus showed as a thicker edge, ${at.focused} px against ${plain}`).toBeGreaterThanOrEqual(plain * 2);
    }
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
    /* A key held down is one press: the open puts focus on the way back, which the same key works, and its repeats must not reach it. */
    for (const key of ["Enter", " "]) {
      await page.keyboard.down(key);
      await page.keyboard.down(key);
      await page.keyboard.down(key);
      await page.keyboard.up(key);
      await settled(page);
      expect.soft([await page.locator("#view-map svg.map").getAttribute("data-stack"), await focused()], `${key === " " ? "Space" : key} held on the block: its stack, opened once, and focus on the way back`).toEqual(["Hyatt", "mapBack"]);
      await page.keyboard.press("Escape");
      await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
    }
  });
});

test.describe("a venue's stack on a screen too short for it", () => {
  test.use({ storageState: seed(READER) });

  test("375 by 553, a small phone in a browser tab: the map is on its floor, a plate's card runs under the nav, and the tab scrolls until its last row is above the nav and takes a touch", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 553 });
    await open(page, SATURDAY);
    await tab(page, "map");
    await openStack(page, "Hyatt");
    const plate = (await page.evaluate(stackState)).plates.find(p => p.key === EXHIBIT);
    await page.touchscreen.tap(plate.x, plate.y);
    await expect(page.locator("#mapPlate")).toBeVisible();
    await settled(page);
    const read = () => page.evaluate(() => {
      const main = document.querySelector("main"), rows = [...document.querySelectorAll("#mapUnder .pc-row")], last = rows[rows.length - 1].getBoundingClientRect();
      return { rows: rows.length, bottom: last.bottom, nav: document.querySelector(".nav").getBoundingClientRect().top, far: main.scrollHeight - main.clientHeight, at: main.scrollTop, frame: document.querySelector("#view-map svg.map").getBoundingClientRect().height };
    });
    const before = await read();
    expect.soft([before.rows, Math.round(before.frame), before.bottom > before.nav], `two rows, the map on its 200 px floor, and the last row's end, ${before.bottom.toFixed(1)} px, under the nav's top, ${before.nav.toFixed(1)}`).toEqual([2, 200, true]);
    expect.soft(before.far, `the tab scrolls, ${before.far} px, as far as the row is under`).toBeGreaterThanOrEqual(Math.floor(before.bottom - before.nav));
    await page.evaluate(() => { const main = document.querySelector("main"); main.scrollTop = main.scrollHeight; });
    await settled(page);
    const after = await read();
    expect.soft(after.bottom, `scrolled to its end, the last row ends at ${after.bottom.toFixed(1)} px, above the nav's top`).toBeLessThanOrEqual(after.nav);
    await page.locator("#mapUnder .pc-row").last().tap();
    await expect(page.locator("#sheetTitleEvent")).toBeVisible();
  });
});
