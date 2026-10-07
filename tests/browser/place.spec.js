/* The place filter (DECISIONS #98), where a phone draws it. jsdom cannot say
   any of this: every box there is 0. The head of a plate's card and of a
   room's is a button 44 px tall or more, as wide as the card, a touch at
   each of its edges its own - and the slot under the map and the frame
   above it are the size they are with no head, to half a pixel; its touch
   lands on Search at its top, the place's chip in view under the box with
   keyboard focus on it; the tab bar's Map is then the level as it was left,
   and no move of the motion is played. And the zoom's one rule: on the
   seven levels where a room tapped after the smallest would stand too
   close, no part of a zoomed room stands under the way back, nor nearer
   the frame's edge than 20 of the Map's units. Each with Larger text off
   and on.

   One page a test, its assertions soft and named. The reader has no pick:
   the counts are the schedule's own at Saturday 1:05 PM. */
import { CLOCKS, MOTION, answers, check, expect, open, seed, settled, tab, test } from "./harness.js";

const SATURDAY = CLOCKS[0].now;
const TEXT = { "": {}, ", with Larger text on": { bigtext: true } };
const EXHIBIT = "exhibit+tower-ll2";
/* The levels where the zoom's rule eases a room out: each has a room that,
   tapped after the level's smallest, would stand past the frame's margin or
   under the way back. And the rule's numbers, of the Map's units (src/level.js). */
const EASED = [["Marriott", "marquis"], ["Marriott", "atrium"], ["Hyatt", "acc"], ["Hyatt", EXHIBIT], ["Hilton", "l2"], ["Courtland Grand", "f1"], ["Westin", "f8"]];
const ZOOM_MARGIN = 20, HALF = 0.5;

/* Run in the page: a click at an element's middle, as the page's own
   listener hears a tap - for the steps that only lead to what is measured. */
function click(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
  return true;
}
/* The card under the map, its head, the slot and the frame as drawn. */
function cardState() {
  const box = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
  const under = document.getElementById("mapUnder"), svg = document.querySelector("#view-map svg.map"), card = under.firstElementChild, head = card.querySelector(".pc-head");
  const rows = card.querySelector(".pc-rows, .pc-none"), title = card.querySelector(".nc-title");
  return { id: card.id, slot: box(under), frame: box(svg), ground: box(svg.querySelector(".map-ground")), card: box(card), head: box(head), tag: head ? head.tagName : null, name: head ? head.getAttribute("aria-label") : null,
    chevron: box(card.querySelector(".pc-chevron")), words: box(card.querySelector(".pc-words")), rows: box(rows), title: title ? title.textContent : "", cut: title ? title.scrollWidth > title.clientWidth : null,
    nav: document.querySelector(".nav").getBoundingClientRect().top };
}
/* Search as the head's touch leaves it. */
function searchState() {
  const chip = document.querySelector('#view-browse .parsed-chips [data-dim="place"]'), main = document.querySelector("main");
  const hdr = document.querySelector(".hdr").getBoundingClientRect(), nav = document.querySelector(".nav").getBoundingClientRect(), sticky = document.querySelector("#view-browse .controls-sticky").getBoundingClientRect();
  const b = chip ? chip.getBoundingClientRect() : null;
  return { shown: !document.getElementById("view-browse").hidden, top: main.scrollTop, chip: chip ? { words: chip.querySelector(".chip-label").textContent, name: chip.getAttribute("aria-label"), height: b.height, left: b.left, right: b.right,
    inView: b.top >= Math.max(hdr.bottom, sticky.bottom) - 0.5 && b.bottom <= nav.top + 0.5 && b.left >= 0 && b.right <= window.innerWidth + 0.5, focused: document.activeElement === chip } : null,
  badge: document.getElementById("filtersBadge").textContent, count: document.querySelector("#view-browse .section-title .count").textContent, rows: document.querySelectorAll("#view-browse #browseRest .list .row").length,
  day: [...document.querySelectorAll('#dayChips [aria-pressed="true"]')].map(c => c.textContent), q: document.getElementById("q").value };
}
/* The open level as the Map holds it: its camera, the room pressed, the way back's words, the card. */
function levelHeld() {
  const svg = document.querySelector("#view-map svg.map"), group = svg.querySelector(".map-stack:not([hidden])");
  return { level: svg.getAttribute("data-level"), cam: group.querySelector(".stack-cam").getAttribute("transform"), pressed: [...group.querySelectorAll('.plate.flat [aria-pressed="true"]')].map(r => r.dataset.room),
    back: document.getElementById("mapBack").textContent, card: document.getElementById("mapUnder").firstElementChild.id };
}
/* A level's rooms walked, in the page: its smallest room first, which
   brings the camera closest, and then every room and identified open area
   in turn, each tapped while zoomed - the move it starts finished, through
   the Web Animations API, before the next. Of each, as it then stands: its
   box against the frame as drawn and against the way back, in the Map's
   units. */
async function walk(id) {
  const frames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  const still = async () => { for (const anim of document.getAnimations()) if (anim.id === id) anim.finish(); await frames(); };
  const svg = document.querySelector("#view-map svg.map"), flat = svg.querySelector(".map-stack:not([hidden]) .plate.flat"), back = document.getElementById("mapBack");
  const tap = el => { const b = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); };
  const rooms = [...flat.querySelectorAll("[data-room]")], side = r => Math.min(Number(r.getAttribute("width")), Number(r.getAttribute("height")));
  const smallest = rooms.reduce((a, b) => (side(b) < side(a) ? b : a));
  tap(smallest); await still();
  const out = [];
  for (const room of rooms) {
    tap(room); await still();
    const unit = svg.getScreenCTM().a, g = svg.querySelector(".map-ground").getBoundingClientRect(), r = room.getBoundingClientRect(), k = back.getBoundingClientRect();
    out.push({ id: room.dataset.room, pressed: room.getAttribute("aria-pressed"), words: back.textContent, left: (r.left - g.left) / unit, right: (g.right - r.right) / unit, top: (r.top - g.top) / unit, bottom: (g.bottom - r.bottom) / unit,
      under: !back.hidden && r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top, width: r.width / unit, height: r.height / unit });
  }
  return { smallest: smallest.dataset.room, rooms: out };
}

const step = async (page, selector) => { expect(await page.evaluate(click, selector), selector).toBe(true); await settled(page); };
const toRoom = async (page, hotel, key, id) => {
  await step(page, `#view-map .map-hotel[data-hotel="${hotel}"]`);
  await step(page, `#view-map .map-stack:not([hidden]) .plate[data-plate="${key}"]`);
  if (id) await step(page, `#view-map .plate.flat [data-room="${id}"]`);
};
const toCity = async page => { for (let i = 0; i < 3 && await page.locator("#view-map svg.map").getAttribute("data-stack"); i++) await step(page, "#mapBack"); };
const same = (a, b) => ["left", "top", "width", "height"].every(k => Math.abs(a[k] - b[k]) <= HALF);

for (const [text, storage] of Object.entries(TEXT)) {
  test.describe(`a card's head${text}`, () => {
    test.use({ storageState: seed(storage) });

    test(`is a button 44 px tall or more, as wide as the card, a touch at each of its edges its own; and the slot and the frame are the size they are with no head, to half a pixel${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      await step(page, '#view-map .map-hotel[data-hotel="Hyatt"]');
      const line = await page.evaluate(cardState);                    // the venue's line: no head
      expect.soft([line.id, line.tag], "the venue's line has no head").toEqual(["mapVenue", null]);
      const cards = [];
      await step(page, `#view-map .map-stack:not([hidden]) .plate[data-plate="${EXHIBIT}"]`);
      cards.push(["an open level's", await page.evaluate(cardState), await page.evaluate(answers, "#mapAll"), await check(page, "#mapAll")]);
      await step(page, '#view-map .plate.flat [data-room="Hanover F"]');
      cards.push(["a room's", await page.evaluate(cardState), await page.evaluate(answers, "#mapAll"), await check(page, "#mapAll")]);
      await step(page, '#view-map .plate.flat [data-room="Grand Hall A"]');
      const none = await page.evaluate(cardState);                    // a room with no event at all: the same lines, no button
      await toCity(page);
      await step(page, '#view-map .map-hotel[data-hotel="Westin"]');
      const westin = await page.evaluate(cardState);
      await step(page, '#view-map .map-stack:not([hidden]) .plate[data-plate="f12"]');
      cards.push(["a floor's", await page.evaluate(cardState), await page.evaluate(answers, "#mapAll"), await check(page, "#mapAll"), westin]);
      for (const [which, s, touch, cut, base = line] of cards) {
        expect.soft([s.tag, s.head.height >= 44, s.name], `${which}: a button, ${s.head.height.toFixed(1)} px tall, named for where it goes`).toEqual(["BUTTON", true, expect.stringMatching(/^(All \d+ events|The 1 event) in .+ on Saturday, in Search$/)]);
        expect.soft([Math.abs(s.head.left - s.card.left - 1) <= HALF, Math.abs(s.card.right - 1 - s.head.right) <= HALF, Math.abs(s.head.top - s.card.top - 1) <= HALF, s.rows.top >= s.head.bottom - HALF], `${which}: it reaches the card's top and sides, and ends above the rows`).toEqual([true, true, true, true]);
        expect.soft([s.chevron.width > 0, s.chevron.left >= s.words.right, s.chevron.right <= s.card.right - 14 + HALF], `${which}: the chevron at its right, inside the card's padding`).toEqual([true, true, true]);
        expect.soft(touch, `${which}: a touch just inside each of its edges is its own`).toEqual({ left: true, right: true, top: true, bottom: true });
        expect.soft([cut.count, cut.cut, cut.sideways], `${which}: drawn whole`).toEqual([1, [], []]);
        expect.soft([same(s.slot, base.slot), same(s.frame, base.frame), same(s.ground, base.ground)], `${which}: the slot, ${s.slot.height.toFixed(2)} px, and the frame as with no head`).toEqual([true, true, true]);
        expect.soft([s.card.bottom <= s.slot.bottom + HALF, s.slot.bottom <= s.nav + HALF], `${which}: the card whole in its slot, above the nav`).toEqual([true, true]);
      }
      expect.soft([none.id, none.tag, none.name, none.chevron], "nothing at all there: the same lines, no button and no chevron").toEqual(["mapRoom", "DIV", null, null]);
      expect.soft([same(none.slot, line.slot), same(none.frame, line.frame), same(none.head, cards[1][1].head)], "and the same box: the slot, the frame and the head's own").toEqual([true, true, true]);
    });

    test(`its touch lands on Search at its top, the place's chip in view under the box with keyboard focus on it; and the tab bar's Map is the level as it was left, with no move played${text}`, async ({ page }) => {
      await open(page, SATURDAY);
      await tab(page, "map");
      await toRoom(page, "Hyatt", EXHIBIT, "Hanover F");
      const left = await page.evaluate(levelHeld);
      expect.soft([left.level, left.pressed, left.back, left.card]).toEqual([EXHIBIT, ["Hanover F"], "← Whole level", "mapRoom"]);
      await page.locator("#mapAll").tap();
      await expect(page.locator("#view-browse")).toBeVisible();
      await settled(page);
      const s = await page.evaluate(searchState);
      expect.soft([s.shown, s.top, s.q, s.day, s.badge, s.count, s.rows], "Search, at its top: no query, the Map's day, one filter, the room's 8 events").toEqual([true, 0, "", ["Sat"], "1", "8", 8]);
      expect.soft([s.chip.words, s.chip.name, s.chip.height >= 44, s.chip.inView, s.chip.focused], "the place's chip: in view under the box, 44 px, with keyboard focus").toEqual(["Hyatt · Hanover F", "Remove Hyatt · Hanover F filter", true, true, true]);
      const search = await check(page);
      expect.soft([search.sideways, search.cut], "nothing scrolls sideways, and no control is cut off").toEqual([[], []]);
      await page.locator('nav button[data-tab="map"]').tap();
      await expect(page.locator("#view-map")).toBeVisible();
      const moves = await page.evaluate(id => document.getAnimations().filter(anim => anim.id === id).length, MOTION);
      const later = await page.evaluate(id => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(document.getAnimations().filter(anim => anim.id === id).length)))), MOTION);
      expect.soft([moves, later], "no move of the motion is played on the way back").toEqual([0, 0]);
      expect.soft(await page.evaluate(levelHeld), "the level, the room, the zoom and the card as they were left").toEqual(left);
    });

    test(`the zoom never brings a room closer than it fits: after its level's smallest room, no room of the seven levels the rule eases stands under the way back, nor nearer the frame's edge than 20 of the Map's units${text}`, async ({ page }) => {
      /* Seven levels, each room of each a tap and the move it starts: a timeout of its own. */
      test.setTimeout(90000);
      await open(page, SATURDAY);
      await tab(page, "map");
      let walked = 0;
      for (const [hotel, key] of EASED) {
        await toRoom(page, hotel, key);
        const got = await page.evaluate(walk, MOTION);
        for (const r of got.rooms) {
          const name = `${hotel}, ${key}, ${r.id} after ${got.smallest}`;
          expect.soft([r.pressed, r.words], `${name}: selected, the camera on it`).toEqual(["true", "← Whole level"]);
          expect.soft(r.under, `${name}: no part of it under the way back`).toBe(false);
          expect.soft(Math.min(r.left, r.right, r.top, r.bottom) >= ZOOM_MARGIN - HALF, `${name}: ${r.width.toFixed(0)} by ${r.height.toFixed(0)}, inside the frame by 20 - it stands ${[r.left, r.right, r.top, r.bottom].map(v => v.toFixed(1)).join(", ")} from its left, right, top and foot`).toBe(true);
          walked++;
        }
        await toCity(page);
      }
      expect.soft(walked > 80, `${walked} rooms walked`).toBe(true);
    });
  });
}
