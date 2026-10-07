/* The level (DECISIONS #96): a drawn plate laid flat, where a phone draws it.
   jsdom cannot say any of this: every box there is 0, and it has no matrix
   to take a touch through. Each of the 18 levels opens by a touch on its
   plate's name and stands inside the frame, clear of the way back, in a
   frame the same size as the stack's, with its card whole on the screen; the
   other plates, the labels and the city behind are not drawn. A touch at a
   room's middle is that room's, on every room of four levels; a room that
   does not zoom stands where it stood, to 1 px, and one that does comes to
   the middle with its shorter side 62 of the Map's units; a touch beside a
   small room, within reach, selects the nearest, and one past reach of every
   room clears the selection; the way back is 44 px at each of its three
   steps; and by the keyboard Tab reaches the way back, the open level's
   rooms and the card, and no other level's, each room showing its focus by
   its own edge, Enter selects and Escape steps back.

   One page a test, walked, its assertions soft and named for their level
   and room. The reader is seeded here, as tests/browser/stack.spec.js's is:
   picks in the Hyatt's Concourse and Hanover F and G, and the Hilton's 209
   to 211. */
import { CLOCKS, answers, check, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const READER = { picks: [
  "c32d19e7750818e0eb903f152ac90776", "6ecc75745a676d39f23005562373d163",     // the Hyatt: the Concourse, on now, and Hanover F-G at 2:30
  "c32d19e7750818e0eb903f152ad9f1a0",                                         // the Hilton: 209-211
] };
const LEVELS = [
  ["Marriott", "international"], ["Marriott", "marquis"], ["Marriott", "lobby"], ["Marriott", "atrium"],
  ["Hyatt", "acc"], ["Hyatt", "exhibit+tower-ll2"], ["Hyatt", "ballroom+tower-ll1"],
  ["Hilton", "galleria"], ["Hilton", "l1"], ["Hilton", "l2"], ["Hilton", "l3"], ["Hilton", "l4"],
  ["Courtland Grand", "f1"], ["Courtland Grand", "f2"], ["Courtland Grand", "f3"],
  ["Westin", "f6"], ["Westin", "f7"], ["Westin", "f8"],
];
const SHORT = { Marriott: "Marriott", Hyatt: "Hyatt", Hilton: "Hilton", "Courtland Grand": "Courtland", Westin: "Westin" };
const EXHIBIT = "exhibit+tower-ll2";
const TOLERANCE = 1;
/* The design's numbers, of the Map's units (src/level.js): the zoom brings a room's shorter side to 62, and a tap reaches 22. */
const ZOOM_TO = 62, REACH = 22, DROP = 12;

/* What stands where while a level is open: run in the page. Each room and
   identified open area of the plate laid flat with its middle on the screen
   - through its own matrix, turned as it is - what a touch there answers
   to, its shorter side in px, and what its button says; the box every room
   and open area stands in; the frame as drawn - the ground's rectangle -
   and a unit of the Map in px; the way back, the card and the streets. */
function levelState() {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const svg = document.querySelector("#view-map svg.map"), group = svg.querySelector(".map-stack:not([hidden])"), flat = group && group.querySelector(".plate.flat");
  const under = document.getElementById("mapUnder"), card = under.firstElementChild, back = document.getElementById("mapBack");
  const cut = el => el.scrollWidth > el.clientWidth;
  const says = card && card.querySelector(".nc-when");
  const rooms = flat ? [...flat.querySelectorAll("[data-room]")].map(r => {
    const m = r.getScreenCTM(), w = Number(r.getAttribute("width")), h = Number(r.getAttribute("height")), cx = Number(r.getAttribute("x")) + w / 2, cy = Number(r.getAttribute("y")) + h / 2;
    const x = m.a * cx + m.c * cy + m.e, y = m.b * cx + m.d * cy + m.f, k = Math.hypot(m.a, m.b), hit = document.elementFromPoint(x, y), style = getComputedStyle(r);
    return { level: r.dataset.level, id: r.dataset.room, x, y, own: hit === r, across: Math.min(w, h) * k, turned: Math.abs(m.b) > 1e-6, ...box(r), role: r.getAttribute("role"), tab: r.getAttribute("tabindex"),
      pressed: r.getAttribute("aria-pressed"), says: r.getAttribute("aria-label"), lit: r.classList.contains("lit"), edge: parseFloat(style.strokeWidth), stroke: style.stroke };
  }) : [];
  const shapes = flat ? [...flat.querySelectorAll(".plate-room, .plate-open")].map(box) : [];
  const ground = box(svg.querySelector(".map-ground"));
  return {
    stack: svg.getAttribute("data-stack"), level: svg.getAttribute("data-level"), frame: box(svg), ground, unit: svg.getScreenCTM().a, slot: box(under), rooms,
    content: shapes.length ? { left: Math.min(...shapes.map(s => s.left)), top: Math.min(...shapes.map(s => s.top)), right: Math.max(...shapes.map(s => s.right)), bottom: Math.max(...shapes.map(s => s.bottom)) } : null,
    under: shapes.filter(s => !back.hidden && s.left < back.getBoundingClientRect().right && s.right > back.getBoundingClientRect().left && s.top < back.getBoundingClientRect().bottom && s.bottom > back.getBoundingClientRect().top).length,
    card: card ? { id: card.id, rows: card.querySelectorAll(".pc-row").length, ...box(card), says: says ? says.textContent : "", title: card.querySelector(".nc-title") ? card.querySelector(".nc-title").textContent : "",
      cut: [...card.querySelectorAll(".nc-title")].filter(cut).map(el => el.textContent) } : null,
    back: back.hidden ? null : { ...box(back), words: back.textContent, name: back.getAttribute("aria-label") },
    head: document.querySelector(".hdr").getBoundingClientRect().bottom, nav: document.querySelector(".nav").getBoundingClientRect().top,
    selected: rooms.filter(r => r.pressed === "true").map(r => r.id), outlines: flat ? flat.querySelectorAll(".level-sel > *").length : 0,
    streets: group ? [...group.querySelectorAll(".level-streets text")].map(t => ({ side: t.dataset.side, ...box(t) })) : [],
    hidden: group ? { plates: [...group.querySelectorAll(".plate:not(.flat)")].map(p => getComputedStyle(p).visibility), labels: [...group.querySelectorAll(".plate-label")].map(t => getComputedStyle(t).visibility),
      city: getComputedStyle(svg.querySelector(".map-city")).visibility } : null,
    ink: flat ? [...flat.querySelectorAll(".level-labels .lit")].map(t => getComputedStyle(t).fill) : [],
    /* The open plate's edge, beside the edge of a plate of this venue that holds no pick. */
    hull: flat ? (() => {
      const edge = p => { const style = p ? getComputedStyle(p.querySelector(".plate-hull")) : null; return style ? `${style.stroke} ${parseFloat(style.strokeWidth)}` : null; };
      return { mine: flat.classList.contains("mine"), edge: edge(flat), plain: edge(group.querySelector(".plate.drawn:not(.mine)")) };
    })() : null,
  };
}
const openStack = async (page, hotel) => {
  await page.locator(`#view-map .map-hotel[data-hotel="${hotel}"]`).tap();
  await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", hotel);
  await settled(page);
};
/* A level, by a touch on its plate's name in its venue's stack: the name is
   its plate's own, wherever it stands (stack.spec.js). The touch is at the
   middle of the words' own box, read in the page: WebKit gives Playwright
   another point for a line of SVG text, off the words. */
const touchName = async (page, key) => {
  const at = await page.evaluate(k => {
    const words = [...document.querySelectorAll("#view-map .map-stack:not([hidden]) .plate-label")].find(t => t.dataset.plate === k).getBoundingClientRect();
    return { x: (words.left + words.right) / 2, y: (words.top + words.bottom) / 2 };
  }, key);
  await page.touchscreen.tap(at.x, at.y);
};
const openLevel = async (page, hotel, key) => {
  await openStack(page, hotel);
  await touchName(page, key);
  await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-level", key);
  await settled(page);
};
const stepBack = async page => { await page.locator("#mapBack").tap(); await settled(page); };
const toCity = async page => {
  for (let i = 0; i < 3 && await page.locator("#view-map svg.map").getAttribute("data-stack"); i++) await stepBack(page);
  await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
};
const pressed = (page, id, level) => page.locator(`#view-map .plate.flat [data-room="${id}"][data-level="${level}"]`);
/* The card whole on the screen, between the header and the nav, inside its slot. */
const whole = s => !!s.card && s.card.height > 0 && s.card.top >= s.head && s.card.bottom <= s.nav + 0.5 && s.card.bottom <= s.slot.bottom + 0.5 && s.slot.bottom <= s.nav + 0.5 && s.card.left >= 0 && s.card.right <= s.frame.right + 0.5;
const apart = (a, b) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`a level${text}`, () => {
    test.use({ storageState: seed({ ...READER, ...storage }) });

    test(`each of the 18 opens by a touch on its plate's name: it stands inside the frame, clear of the way back, in a frame the stack's own size; the way back is 44 px and says where it goes; the card is whole on the screen${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      for (const [hotel, key] of LEVELS) {
        const name = `${hotel}, ${key}`;
        await openStack(page, hotel);
        const stack = await page.evaluate(levelState);
        await touchName(page, key);
        await expect(page.locator("#view-map svg.map"), name).toHaveAttribute("data-level", key);
        await settled(page);
        const s = await page.evaluate(levelState);
        expect.soft([s.frame.width - stack.frame.width, s.frame.height - stack.frame.height, s.slot.height - stack.slot.height].map(d => Math.abs(d) <= 0.5), `${name}: the frame, ${s.frame.width.toFixed(1)} by ${s.frame.height.toFixed(1)} px, and the slot are the stack's own size`).toEqual([true, true, true]);
        expect.soft(s.rooms.length, `${name}: its rooms are drawn`).toBeGreaterThan(0);
        expect.soft([s.content.left >= s.ground.left - 0.5, s.content.right <= s.ground.right + 0.5, s.content.top >= s.ground.top - 0.5, s.content.bottom <= s.ground.bottom + 0.5], `${name}: every room and open area is inside the frame`).toEqual([true, true, true, true]);
        expect.soft(s.under, `${name}: no room or open area stands under the way back - the level's top is at ${s.content.top.toFixed(1)} px, the way back's foot at ${s.back.bottom.toFixed(1)}`).toBe(0);
        expect.soft(s.streets.filter(t => !apart(t, s.back)).map(t => t.side), `${name}: no street's name stands under the way back`).toEqual([]);
        expect.soft([s.back.height >= 44, s.back.width >= 44, s.back.words, s.back.name], `${name}: the way back is ${s.back.width.toFixed(1)} by ${s.back.height.toFixed(1)} px and says where it goes`)
          .toEqual([true, true, `← ${SHORT[hotel]}`, `Back to the ${SHORT[hotel]}'s floors`]);
        expect.soft(await page.evaluate(answers, "#mapBack"), `${name}: a touch just inside each edge of the way back is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
        expect.soft([s.card.id, whole(s), s.card.cut], `${name}: the plate's card, whole on the screen`).toEqual(["mapPlate", true, []]);
        expect.soft([[...new Set(s.hidden.plates)], [...new Set(s.hidden.labels)], s.hidden.city], `${name}: the other plates, every plate's label and the city are not drawn`).toEqual([["hidden"], ["hidden"], "hidden"]);
        expect.soft(s.rooms.filter(r => r.role !== "button" || r.tab !== "0").map(r => r.id), `${name}: every room is a button`).toEqual([]);
        const found = await check(page);
        expect.soft(found.sideways, `${name}: nothing scrolls sideways`).toEqual([]);
        expect.soft(found.cut, `${name}: no control is cut off`).toEqual([]);
        await toCity(page);
      }
    });

    test(`a room touched that does not zoom stands where it stood, to 1 px, and every room beside it; the frame and the slot keep their size, and its card is whole on the screen${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      let large = 0;
      for (const [hotel, key] of [["Courtland Grand", "f1"], ["Courtland Grand", "f3"], ["Marriott", "atrium"], ["Westin", "f8"]]) {
        await openLevel(page, hotel, key);
        const start = await page.evaluate(levelState);
        for (const room of start.rooms.filter(r => r.across >= 44 * start.unit)) {
          const name = `${hotel}, ${key}, ${room.id}`;
          expect.soft(room.own, `${name}: a touch at its middle is its own`).toBe(true);
          await page.touchscreen.tap(room.x, room.y);
          await expect(pressed(page, room.id, room.level), name).toHaveAttribute("aria-pressed", "true");
          await settled(page);
          const after = await page.evaluate(levelState);
          const moved = Math.max(...after.rooms.map(r => { const was = start.rooms.find(x => x.id === r.id && x.level === r.level); return Math.max(Math.abs(r.left - was.left), Math.abs(r.top - was.top)); }));
          expect.soft([after.selected, after.outlines, after.back.words], `${name}: selected alone, outlined, and the camera where it was`).toEqual([[room.id], 1, `← ${SHORT[hotel]}`]);
          expect.soft(moved, `${name}: it and every room stand where they stood, ${moved.toFixed(2)} px at most`).toBeLessThanOrEqual(TOLERANCE);
          expect.soft([after.frame.height - start.frame.height, after.frame.width - start.frame.width, after.slot.height - start.slot.height].map(d => Math.abs(d) <= 0.5), `${name}: the frame and the slot as they were`).toEqual([true, true, true]);
          expect.soft([after.card.id, after.card.title, whole(after), after.card.cut], `${name}: its card, whole on the screen`).toEqual(["mapRoom", room.id, true, []]);
          large++;
        }
        await toCity(page);
      }
      expect.soft(large, "rooms large enough not to zoom were met").toBeGreaterThanOrEqual(8);
    });
  });
}

test.describe("a level's rooms, by a touch", () => {
  test.use({ storageState: seed(READER) });

  /* One level a test: the walk of a level's every room is long, and WebKit's is twice Chromium's. */
  for (const [hotel, key, among] of [["Hyatt", EXHIBIT, "a shared plate's two levels' rooms"], ["Hilton", "l2", "its wing's turned rooms"], ["Hyatt", "acc", "twenty small rooms"], ["Marriott", "international", "a composite's leaves"]]) {
    test(`a touch at a room's middle is that room's, on every room and identified open area of a level - ${among}: ${SHORT[hotel]}, ${key}; a small one comes to the middle, its shorter side 62 of the Map's units, and the way back is then 44 px and says Whole level`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      let turned = 0, zoomed = 0, places = 0;
      await openLevel(page, hotel, key);
      const start = await page.evaluate(levelState);
      expect.soft(start.rooms.filter(r => !r.own).map(r => r.id), `${hotel}, ${key}: a touch at each room's middle is that room's own - no name, outline or landmark is in its way`).toEqual([]);
      for (const room of start.rooms) {
        const name = `${hotel}, ${key}, ${room.id}`, small = room.across < 44 * start.unit;
        await page.touchscreen.tap(room.x, room.y);
        await expect(pressed(page, room.id, room.level), name).toHaveAttribute("aria-pressed", "true");
        await settled(page);
        const after = await page.evaluate(levelState), now = after.rooms.find(r => r.id === room.id && r.level === room.level);
        expect.soft([after.selected, after.card.id, after.card.title, whole(after)], `${name}: selected alone, its card whole on the screen`).toEqual([[room.id], "mapRoom", room.id, true]);
        expect.soft(after.back.words, `${name}: ${small ? "small, so the camera went to it" : "large, so the camera stayed"}`).toBe(small ? "← Whole level" : `← ${SHORT[hotel]}`);
        if (room.turned) turned++;
        if (room.level !== start.rooms[0].level) places++;
        if (!small) continue;
        zoomed++;
        const mid = [(after.ground.left + after.ground.right) / 2, (after.ground.top + after.ground.bottom) / 2 + DROP * after.unit];
        expect.soft(Math.abs(now.across - ZOOM_TO * after.unit), `${name}: its shorter side, ${now.across.toFixed(1)} px, is 62 of the Map's units, ${(ZOOM_TO * after.unit).toFixed(1)} px`).toBeLessThanOrEqual(0.5);
        expect.soft(Math.max(Math.abs(now.x - mid[0]), Math.abs(now.y - mid[1])), `${name}: it stands in the middle of the frame, 12 units below`).toBeLessThanOrEqual(TOLERANCE);
        expect.soft([after.back.height >= 44, after.back.width >= 44, after.back.name, now.own], `${name}: the way back is 44 px, says the whole level, and a touch at the room's middle is still its own`).toEqual([true, true, "Back to the whole level", true]);
        expect.soft([after.frame.height - start.frame.height, after.slot.height - start.slot.height].map(d => Math.abs(d) <= 0.5), `${name}: the frame and the slot as they were`).toEqual([true, true]);
        expect.soft(after.streets.length, `${name}: no street's name while zoomed`).toBe(0);
        await stepBack(page);
        const whole1 = await page.evaluate(levelState);
        expect.soft([whole1.back.words, whole1.selected, Math.abs(whole1.rooms.find(r => r.id === room.id && r.level === room.level).left - room.left) <= TOLERANCE], `${name}: the whole level again, the room still selected, where it stood`).toEqual([`← ${SHORT[hotel]}`, [room.id], true]);
      }
      await toCity(page);
      expect.soft([key !== "l2" || turned > 0, zoomed > 5, key !== EXHIBIT || places > 0], "the level's turned rooms, its small rooms and its second level's were among them").toEqual([true, true, true]);
    });
  }

  test("a touch beside a small room, within 22 of the Map's units of it and nearer no other, selects it; a touch past 22 of every room clears the selection and goes nowhere", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await openLevel(page, "Hyatt", "acc");
    const start = await page.evaluate(levelState), reach = REACH * start.unit;
    /* Points beside each room, 9 px off the middle of each side, that land on no room and are nearer that room than any other by 4 px or more: run in the page. */
    const beside = await page.evaluate(({ off, clear }) => {
      const flat = document.querySelector("#view-map .map-stack:not([hidden]) .plate.flat"), ground = document.querySelector("#view-map .map-ground").getBoundingClientRect(), back = document.getElementById("mapBack").getBoundingClientRect();
      const rooms = [...flat.querySelectorAll("[data-room]")].map(r => ({ id: r.dataset.room, level: r.dataset.level, b: r.getBoundingClientRect() }));
      const far = (b, x, y) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
      const out = [];
      for (const r of rooms) {
        const mx = (r.b.left + r.b.right) / 2, my = (r.b.top + r.b.bottom) / 2;
        for (const [x, y] of [[r.b.left - off, my], [r.b.right + off, my], [mx, r.b.top - off], [mx, r.b.bottom + off]]) {
          if (x < ground.left + 2 || x > ground.right - 2 || y < ground.top + 2 || y > ground.bottom - 2) continue;
          if (x < back.right + 2 && y < back.bottom + 2) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || hit.closest("[data-room]") || !hit.closest("svg.map")) continue;
          const others = rooms.filter(o => o !== r).map(o => far(o.b, x, y));
          if (Math.min(...others) >= far(r.b, x, y) + clear) out.push({ id: r.id, level: r.level, x, y, hit: hit.getAttribute("class") });
        }
      }
      return out;
    }, { off: 9, clear: 4 });
    expect.soft(reach, `22 of the Map's units is ${reach.toFixed(1)} px here: 9 px is within it`).toBeGreaterThan(12);
    expect.soft(beside.length, "points beside a room, on no room, were found").toBeGreaterThanOrEqual(6);
    const seen = new Set();
    for (const at of beside.filter(p => !seen.has(p.id) && seen.add(p.id)).slice(0, 8)) {
      const name = `beside ${at.id}, on ${at.hit}, at ${at.x.toFixed(0)}, ${at.y.toFixed(0)}`;
      await page.touchscreen.tap(at.x, at.y);
      await settled(page);
      const after = await page.evaluate(levelState);
      expect.soft(after.selected, `${name}: the nearest room is selected`).toEqual([at.id]);
      if (after.back.words === "← Whole level") await stepBack(page);
    }
    /* Past reach of every room: the first point of a grid over the frame that is more than 22 units and 4 px from each, and on the level. */
    const away = await page.evaluate(least => {
      const flat = document.querySelector("#view-map .map-stack:not([hidden]) .plate.flat"), ground = document.querySelector("#view-map .map-ground").getBoundingClientRect(), back = document.getElementById("mapBack").getBoundingClientRect();
      const boxes = [...flat.querySelectorAll("[data-room]")].map(r => r.getBoundingClientRect());
      const far = (b, x, y) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
      for (let y = ground.bottom - 6; y > ground.top + 6; y -= 6) {
        for (let x = ground.left + 6; x < ground.right - 6; x += 6) {
          if (x < back.right + 4 && y < back.bottom + 4) continue;
          if (Math.min(...boxes.map(b => far(b, x, y))) > least) return { x, y, hit: document.elementFromPoint(x, y).getAttribute("class") };
        }
      }
      return null;
    }, reach + 4);
    expect.soft(!!away, "a point past reach of every room was found in the frame").toBe(true);
    const before = await page.evaluate(levelState);
    expect.soft(before.selected.length, "a room is selected before the touch that misses").toBe(1);
    await page.touchscreen.tap(away.x, away.y);
    await settled(page);
    const after = await page.evaluate(levelState);
    expect.soft([after.selected, after.level, after.stack, after.card.id], `a touch at ${away.x.toFixed(0)}, ${away.y.toFixed(0)}, on ${away.hit}: nothing selected, the level still open, its plate's card`).toEqual([[], "acc", "Hyatt", "mapPlate"]);
  });

  test("the way back is 44 px at each of its three steps, a touch just inside each edge its own, and each touch goes back one step: the whole level, the venue's stack, the city", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await openLevel(page, "Hyatt", "acc");
    const first = (await page.evaluate(levelState)).rooms[0];
    await page.touchscreen.tap(first.x, first.y);
    await expect(page.locator("#mapBack")).toHaveText("← Whole level");
    for (const [words, then] of [["← Whole level", { level: "acc", selected: [first.id] }], ["← Hyatt", { level: null, selected: [] }], ["← Map", null]]) {
      const s = await page.evaluate(levelState);
      expect.soft([s.back.words, s.back.height >= 44, s.back.width >= 44, s.back.top >= s.frame.top, s.back.right <= s.frame.right], `${words}: 44 px or more, inside the frame - ${s.back.width.toFixed(1)} by ${s.back.height.toFixed(1)}`).toEqual([words, true, true, true, true]);
      expect.soft(await page.evaluate(answers, "#mapBack"), `${words}: a touch just inside each edge is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
      await stepBack(page);
      const after = await page.evaluate(levelState);
      if (then) expect.soft([after.stack, after.level, after.selected], `${words}: one step back`).toEqual(["Hyatt", then.level, then.selected]);
      else expect.soft([after.stack, after.back], `${words}: the city map`).toEqual([null, null]);
    }
  });

  test("what the reader's picks light is gold, an open area as a room is, and its name is in the gold's ink; an arrival from an event's place line opens its level on its room, the card showing the event", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await openLevel(page, "Hyatt", EXHIBIT);
    const s = await page.evaluate(levelState), lit = s.rooms.filter(r => r.lit);
    expect.soft(lit.map(r => r.id).sort(), "the Concourse, and Hanover F and G").toEqual(["Concourse", "Hanover F", "Hanover G"]);
    expect.soft([s.ink.length > 0, [...new Set(s.ink)]], "a lit place's name is drawn in the gold's ink").toEqual([true, ["rgb(42, 34, 0)"]]);
    expect.soft(lit.map(r => r.says), "each says the reader's pick").toEqual(lit.map(r => expect.stringMatching(/, 1 pick on Saturday$/)));
    expect.soft([s.hull.mine, s.hull.edge, /^rgb\(.+\) 1\.4$/.test(s.hull.plain)], "the plate laid flat holds a pick and wears no gold edge: the hull's plain one, as a plate with no pick has").toEqual([true, s.hull.plain, true]);
    /* The arrival: a shared day's link lists the event, its row opens its sheet, and the sheet's place line is the way in. */
    const id = READER.picks[1];
    await page.goto(`/?now=${SATURDAY}&day=2026.sat.${id.slice(-8)}`);
    await expect(page.locator("#fresh")).not.toBeEmpty();
    await page.locator(`#panel-shared [data-id="${id}"] .row-main`).tap();
    await page.locator("#sheetPlace").tap();
    await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-level", EXHIBIT);
    await settled(page);
    const there = await page.evaluate(levelState);
    expect.soft([there.selected.sort(), there.outlines, there.back.words, there.card.id, whole(there)], "Hanover F and G selected and outlined, the level at its fit - two rooms do not zoom - and the focused card whole").toEqual([["Hanover F", "Hanover G"], 2, "← Hyatt", "mapNext", true]);
  });
});

test.describe("a level, by the keyboard", () => {
  test.use({ storageState: seed(READER) });

  test("Tab reaches the way back, the open level's rooms in the drawing's order and then the card, and no other level's; a room shows its focus by its own edge, a lit one too; Enter selects and keeps focus; Escape steps back to the whole level, to the stack with focus on that level's plate, and to the city", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    /* Another venue's level, opened and put away, stands in the page before the Hyatt's: Tab must not walk its rooms. */
    await openLevel(page, "Marriott", "international");
    await toCity(page);
    await openLevel(page, "Hyatt", EXHIBIT);
    const s = await page.evaluate(levelState);
    const focused = () => page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const room = a.closest && a.closest("[data-room]");
      if (room) return { room: room.dataset.room, level: room.dataset.level, plate: room.closest(".plate").dataset.plate, hotel: room.closest(".map-stack").dataset.hotel, edge: parseFloat(getComputedStyle(room).strokeWidth), stroke: getComputedStyle(room).stroke, lit: room.classList.contains("lit") };
      return { id: a.id || null, hero: a.getAttribute("data-hero"), plate: a.getAttribute("data-plate"), block: a.getAttribute("data-hotel"), within: a.closest("#mapUnder") ? "card" : a.closest("nav") ? "nav" : a.closest("svg.map") ? "map" : "page" };
    });
    await page.locator("#mapBack").focus();
    const walked = [];
    for (let i = 0; i < s.rooms.length + 3; i++) { await page.keyboard.press("Tab"); walked.push(await focused()); }
    const rooms = walked.filter(w => w && w.room);
    expect.soft(rooms.map(w => `${w.level}|${w.room}`), "Tab walks every room and identified open area of the level, in the drawing's order").toEqual(s.rooms.map(r => `${r.level}|${r.id}`));
    expect.soft([[...new Set(rooms.map(w => w.hotel))], [...new Set(rooms.map(w => w.plate))]], "and no room of another level, or another venue's").toEqual([["Hyatt"], [EXHIBIT]]);
    expect.soft(walked.slice(s.rooms.length, s.rooms.length + 2).map(w => w && w.within), "then the card's two rows").toEqual(["card", "card"]);
    expect.soft(walked.filter(w => w && !w.room && (w.plate || w.block)), "no plate and no block of the city map takes Tab while a level is open").toEqual([]);
    const text = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text").trim());
    const light = await page.evaluate(colour => { const probe = document.createElement("i"); probe.style.color = colour; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; }, text);
    expect.soft([[...new Set(rooms.map(w => w.edge))], [...new Set(rooms.map(w => w.stroke))], rooms.some(w => w.lit)], "focus shows on every room as its own edge, 4 px and light, on a lit room too").toEqual([[4], [light], true]);
    expect.soft(Math.max(...(await page.evaluate(levelState)).rooms.map(r => r.edge)), "and with focus on none, no room's edge is over a pixel").toBeLessThanOrEqual(1);
    /* Enter on a room: back to the first, by Shift+Tab from the card. */
    const hall = page.locator(`#view-map .plate.flat [data-room="${s.rooms[1].id}"][data-level="${s.rooms[1].level}"]`);
    await hall.focus();
    await page.keyboard.press("Enter");
    await expect(hall).toHaveAttribute("aria-pressed", "true");
    const on = await focused(), after = await page.evaluate(levelState);
    expect.soft([on && on.room, after.selected, after.back.words, after.card.id], "Enter selected the room, the camera went to it, and focus is still on it").toEqual([s.rooms[1].id, [s.rooms[1].id], "← Whole level", "mapRoom"]);
    await page.keyboard.press("Escape");
    await expect(page.locator("#mapBack")).toHaveText("← Hyatt");
    expect.soft([(await focused() || {}).room, (await page.evaluate(levelState)).selected], "Escape: the whole level, the room still selected and focus still on it").toEqual([s.rooms[1].id, [s.rooms[1].id]]);
    await page.keyboard.press("Escape");
    await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-level", /./);
    expect.soft([await page.locator("#view-map svg.map").getAttribute("data-stack"), (await focused() || {}).plate], "Escape: the stack, and focus on that level's plate").toEqual(["Hyatt", EXHIBIT]);
    await page.keyboard.press("Escape");
    await expect(page.locator("#view-map svg.map")).not.toHaveAttribute("data-stack", /./);
    expect.soft((await focused() || {}).block, "Escape: the city map, focus on the venue's block").toBe("Hyatt");
  });
});
