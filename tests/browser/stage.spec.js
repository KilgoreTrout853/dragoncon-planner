/* The Map's stage (DECISIONS #100), where a phone draws it. jsdom cannot say
   any of this: every box there is 0, and nothing there plays a move. The
   stage is the map's own box - its fill, its edge, its corners - whatever
   the drawing in it is scaled to; the way back stands 6 px inside its left
   edge and its top at every size, in a stack, in a level and on a room
   zoomed on; the frame and the slot are the sizes they were measured at
   before the stage was drawn, so nothing of the Map moved for it - the
   strips are tests/browser/stack.spec.js's; the dimmed city behind a stack
   is cut by the stage and no longer at the drawing's own edge; and through
   a lift and its way back the stage's box does not change, from the first
   frame after the tap to rest, while the drawing in it moves from where it
   stood - the frame's step is the drawing's, never the svg's.

   The reader is seeded here, as tests/browser/stack.spec.js's is. */
import { CLOCKS, MOTION, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const READER = { picks: [
  "c32d19e7750818e0eb903f152ac90776", "6ecc75745a676d39f23005562373d163",     // the Hyatt: the Concourse, on now, and Hanover F-G at 2:30
  "c32d19e7750818e0eb903f152ad9f1a0",                                         // the Hilton: 209-211
  "1e3995157984a4c0e6515a2ed6314ce1",                                         // the Westin's 12th Floor
  "c32d19e7750818e0eb903f152ac64313",                                         // Mart Building 2: 204J, on its 4th floor
] };
const EXHIBIT = "exhibit+tower-ll2";
const INSIDE = 6;                                         // the way back, from the stage's left edge and from its top, in px
/* The frame under a stack - its width and its height - and the slot's
   height, in px, by the screen's width: as measured in Chromium and in
   WebKit, which agreed, on the build before the stage. */
const SIZES = {
  "": { 375: [347, 241.9, 199.1], 390: [362, 238.9, 199.1], 402: [374, 288.9, 199.1] },
  ", with Larger text on": { 375: [347, 222.1, 218.9], 390: [362, 219.1, 218.9], 402: [374, 269.1, 218.9] },
};
const MEASURED = 0.3;                                     // what a measurement may be out by

/* What stands where on the Map: run in the page. */
function stage() {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const svg = document.querySelector("#view-map svg.map"), style = getComputedStyle(svg), back = document.getElementById("mapBack"), ground = svg.querySelector(".map-ground");
  const look = el => { const s = getComputedStyle(el); return { fill: s.backgroundColor, edge: s.borderTopColor }; };
  const token = name => { const probe = document.createElement("i"); probe.style.color = `var(--${name})`; document.body.appendChild(probe); const said = getComputedStyle(probe).color; probe.remove(); return said; };
  return {
    stack: svg.getAttribute("data-stack"), level: svg.getAttribute("data-level"), frame: box(svg), ground: box(ground), slot: box(document.getElementById("mapUnder")),
    fill: style.backgroundColor, corners: style.borderTopLeftRadius, edge: style.boxShadow, border: style.borderTopWidth, groundFill: getComputedStyle(ground).fill,
    clip: getComputedStyle(svg.querySelector(".map-city")).clipPath, clipped: svg.querySelector(".map-city").getAttribute("clip-path"),
    back: back.hidden ? null : { ...box(back), words: back.textContent, ...look(back) },
    tokens: { stage: token("stage"), line: token("line"), surface: token("surface"), muted: token("muted") },
  };
}
/* A watch on every frame from now: the stage's box, the drawing's - the
   ground's rectangle - and how many of the motion's animations run. */
function watch(id) {
  window.__stage = { on: true, frames: [] };
  const box = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
  const look = () => {
    if (!window.__stage.on) return;
    const svg = document.querySelector("#view-map svg.map");
    window.__stage.frames.push({ stage: box(svg), ground: box(svg.querySelector(".map-ground")), count: document.getAnimations().filter(anim => anim.id === id).length });
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}
const watched = page => page.evaluate(() => { window.__stage.on = false; return window.__stage.frames; });
const frames = (page, count = 2) => page.evaluate(n => new Promise(done => { const next = left => (left ? requestAnimationFrame(() => next(left - 1)) : done()); next(n); }), count);
const moving = page => page.evaluate(id => document.getAnimations().filter(anim => anim.id === id).length, MOTION);
const ended = async page => { await expect.poll(() => moving(page), { timeout: 8000 }).toBe(0); await frames(page); };
const boxOf = b => [b.left, b.top, b.width, b.height];
const far = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

const openStack = async (page, hotel) => {
  await page.locator(`#view-map .map-hotel[data-hotel="${hotel}"]`).tap();
  await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", hotel);
  await settled(page);
};
/* A level, by a touch on its plate's name, at the middle of the words' own box (level.spec.js). */
const openLevel = async (page, key) => {
  const at = await page.evaluate(k => {
    const words = [...document.querySelectorAll("#view-map .map-stack:not([hidden]) .plate-label")].find(t => t.dataset.plate === k).getBoundingClientRect();
    return { x: (words.left + words.right) / 2, y: (words.top + words.bottom) / 2 };
  }, key);
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-level", key);
  await settled(page);
};
const goBack = async page => { await page.locator("#mapBack").tap(); await settled(page); };

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`the Map's stage${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...storage }) });

    test(`the stage is the map's own box - its fill, its edge, its corners - and the way back is ${INSIDE} px inside its left edge and its top in the city's stacks, in a level and on a room zoomed on; the frame and the slot are the sizes they were${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      const city = await page.evaluate(stage), [width, height, slot] = SIZES[text][page.viewportSize().width];
      expect.soft([city.fill, city.corners, city.border, city.groundFill], "the city: the stage's fill and corners are the svg's own, with no border to move the drawing, and the ground draws nothing").toEqual([city.tokens.stage, "14px", "0px", "rgba(0, 0, 0, 0)"]);
      expect.soft(city.edge, `the city: the edge is a shadow inside the box, 1 px of --line: ${city.edge}`).toMatch(new RegExp(`^${city.tokens.line.replace(/[()]/g, "\\$&")} 0px 0px 0px 1px inset$`));
      expect.soft([city.frame.left, city.frame.right, city.back], "the city: the stage runs from gutter to gutter, and the way back is not shown").toEqual([14, page.viewportSize().width - 14, null]);
      expect.soft(city.ground.left >= city.frame.left - 0.5 && city.ground.right <= city.frame.right + 0.5 && Math.abs(city.ground.height - city.frame.height) <= 0.5, `the city: the drawing stands inside the stage, as tall as it: ${city.ground.left.toFixed(1)} to ${city.ground.right.toFixed(1)} in ${city.frame.left} to ${city.frame.right}`).toBe(true);

      const held = async (name, sized) => {
        const s = await page.evaluate(stage);
        expect.soft([s.back.left - s.frame.left, s.back.top - s.frame.top].map(v => Math.abs(v - INSIDE) <= 0.5), `${name}: the way back, at ${s.back.left.toFixed(1)}, ${s.back.top.toFixed(1)}, is ${INSIDE} px inside the stage, at ${s.frame.left.toFixed(1)}, ${s.frame.top.toFixed(1)}`).toEqual([true, true]);
        expect.soft([s.back.right <= s.frame.right, s.back.bottom <= s.frame.bottom, s.back.height >= 44, s.back.width >= 44], `${name}: and whole inside it, 44 px or more each way`).toEqual([true, true, true, true]);
        expect.soft([s.back.fill, s.back.edge], `${name}: the way back wears a control's fill and a lighter edge`).toEqual([s.tokens.surface, s.tokens.muted]);
        expect.soft([s.fill, s.frame.left, s.frame.right], `${name}: the stage as it was in the city, gutter to gutter`).toEqual([city.tokens.stage, 14, page.viewportSize().width - 14]);
        if (sized) expect.soft([s.frame.width - width, s.frame.height - height, s.slot.height - slot].map(d => Math.abs(d) <= MEASURED), `${name}: the frame, ${s.frame.width.toFixed(1)} by ${s.frame.height.toFixed(1)} px, and the slot, ${s.slot.height.toFixed(1)}, are ${width} by ${height} and ${slot}`).toEqual([true, true, true]);
        return s;
      };
      for (const hotel of ["Hyatt", "Hilton", "Westin"]) {
        await openStack(page, hotel);
        const s = await held(`${hotel}'s stack`, true);
        /* The dimmed city runs to the stage's edge: the draw's clip stands on the group, and the stylesheet lifts it. */
        expect.soft([s.clipped !== null, s.clip], `${hotel}'s stack: the city's clip is lifted`).toEqual([true, "none"]);
        await goBack(page);
      }
      await openStack(page, "Hyatt");
      await openLevel(page, EXHIBIT);
      await held("the Hyatt's Exhibit Level", true);
      /* its smallest room, which the camera goes to */
      const room = await page.evaluate(() => {
        const rooms = [...document.querySelectorAll("#view-map .map-stack:not([hidden]) .plate.flat [data-room][role]")].map(r => { const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, across: Math.min(b.width, b.height) }; });
        return rooms.sort((a, b) => a.across - b.across)[0];
      });
      await page.touchscreen.tap(room.x, room.y);
      await settled(page);
      const zoomed = await held("a room zoomed on", true);
      expect.soft(zoomed.back.words, "the camera went to the room").toBe("← Whole level");
    });

    test(`through a lift and its way back the stage's box does not change, from the first frame after the tap to rest, and the drawing in it moves from where it stood${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      for (const hotel of ["Hyatt", "Hilton", "Westin"]) {
        for (const [move, go] of [["the lift", () => page.locator(`#view-map .map-hotel[data-hotel="${hotel}"]`).tap()], ["its way back", () => page.locator("#mapBack").tap()]]) {
          const name = `${hotel}, ${move}`, before = await page.evaluate(stage);
          await page.evaluate(watch, MOTION);
          await frames(page);
          await go();
          expect.soft(await moving(page), `${name}: a set plays`).toBeGreaterThan(0);
          await ended(page);
          const seen = await watched(page), after = await page.evaluate(stage), rest = boxOf(after.frame);
          const first = seen.findIndex(f => f.count > 0), live = seen.slice(first);
          expect.soft([first > 0, live.length > 3], `${name}: frames were seen before the set and through it, ${live.length}`).toEqual([true, true]);
          expect.soft(live.filter(f => far(f.stage, rest) > 0.05).length, `${name}: the stage's box is its box at rest, ${rest.map(v => v.toFixed(1)).join(", ")}, on every frame from the first after the tap`).toBe(0);
          expect.soft(far(live[0].ground, boxOf(before.ground)) <= 1, `${name}: the drawing at the first frame, ${live[0].ground.map(v => v.toFixed(1)).join(", ")}, is where it stood, ${boxOf(before.ground).map(v => v.toFixed(1)).join(", ")}`).toBe(true);
          expect.soft(far(seen[seen.length - 1].ground, boxOf(after.ground)) <= 0.05, `${name}: and at rest where the draw put it`).toBe(true);
          /* where the slot changed the drawing's box, the drawing moved inside the stage - and so stood, for a frame at least, apart from both ends */
          if (far(boxOf(before.ground), boxOf(after.ground)) > 2) {
            expect.soft(far(boxOf(before.frame), rest) > 2, `${name}: the stage's own box changed at the tap, with the slot`).toBe(true);
            expect.soft(live.some(f => far(f.ground, boxOf(before.ground)) > 0.5 && far(f.ground, boxOf(after.ground)) > 0.5), `${name}: the drawing moved through the set`).toBe(true);
          }
          expect.soft(after.ground.left >= after.frame.left - 0.5 && after.ground.right <= after.frame.right + 0.5, `${name}: the drawing ends inside the stage`).toBe(true);
        }
      }
    });
  });
}
