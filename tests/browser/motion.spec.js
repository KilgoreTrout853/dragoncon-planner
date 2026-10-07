/* The motion between the Map's views (DECISIONS #97), in real browsers: the
   lift, the drop-in, the zoom, each way back and the arrival, each played in
   its own time, in both engines at the three sizes. jsdom has no Web
   Animations and no layout; tests/page/motion.test.js holds which tap starts
   which set against a stand-in, and tests/unit/motion.test.js the lists.

   What is held here: after each move has ended the page is the same view
   reached under Reduce Motion - the drawing's markup, and every box,
   visibility and opacity in it, to 1 px - with no animation of the motion
   left; under Reduce Motion none ever starts; through a move the frame's and
   the slot's layout boxes keep their size, and only transform, opacity and
   visibility are animated; a set's first frame is painted before it runs,
   and at a lift's the tapped block stands where it stood before the tap; a
   tap on the drawing while a set runs is spent, and any other acts; a venue's
   group that is put away shows nothing and takes no touch and no Tab stop;
   and the block's face is not shown in any of the four views.

   A set is told by its animations' id, harness.js MOTION. Nothing here
   waits by the clock: a move's end is that none of its animations is left.
   The other specs do not wait at all: harness.js settled() finishes a
   running set. */
import { CLOCKS, MOTION, READERS, expect, open, seed, tab, test } from "./harness.js";

const SATURDAY = CLOCKS.find(clock => clock.name === "Saturday 1:05 PM").now;
const EXHIBIT = "exhibit+tower-ll2";
/* Two events of Friday's, by the tails of their ids, for a shared day's
   link: Kids Yoga with Margot in Roswell, one small room of the Hyatt's
   Conference Center, and Filk & Cookies in Hanover F and G, two rooms of its
   Exhibit Level. An event's sheet's place line is the arrival. */
const DAY_LINK = "&day=2026.fri.23719014-23741be5";
const ROSWELL = "Kids Yoga with Margot", HANOVER_FG = "Filk & Cookies";
const TOLERANCE = 1;

/* ---- Read in the page ---------------------------------------------- */
/* The drawing as it stands: its markup, the card's, the way back, and for
   every element of it its box on the screen and whether it is shown. */
function picture() {
  const svg = document.querySelector("#view-map svg.map"), back = document.getElementById("mapBack"), under = document.getElementById("mapUnder");
  const box = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
  const parts = [svg, ...svg.querySelectorAll("*")].map(el => { const style = getComputedStyle(el); return [...box(el), style.visibility, style.opacity, style.display]; });
  return {
    markup: svg.outerHTML, card: under.innerHTML, parts, slot: box(under), layout: [svg.clientWidth, svg.clientHeight, under.offsetHeight],
    back: back.hidden ? null : { words: back.textContent, box: box(back) }, stack: svg.getAttribute("data-stack"), level: svg.getAttribute("data-level"),
    focus: document.activeElement ? document.activeElement.id || document.activeElement.getAttribute("class") : null,
  };
}
/* The motion's animations, now: how many, and what their keyframes animate. */
function motion(id) {
  const set = document.getAnimations().filter(anim => anim.id === id);
  const props = new Set(set.flatMap(anim => anim.effect.getKeyframes().flatMap(Object.keys)));
  for (const known of ["offset", "computedOffset", "easing", "composite"]) props.delete(known);
  return { count: set.length, props: [...props].sort(), span: set.length ? set[0].effect.getTiming().duration : 0, fills: [...new Set(set.map(anim => anim.effect.getTiming().fill))] };
}
/* A watch on every frame from now: the frame's and the slot's layout boxes,
   and the running set's clock - its state, its time, its start and the
   page's timeline - as each frame's first callback sees them. */
function watch(id) {
  window.__watch = { on: true, frames: [] };
  const look = () => {
    if (!window.__watch.on) return;
    const svg = document.querySelector("#view-map svg.map"), set = document.getAnimations().filter(anim => anim.id === id);
    window.__watch.frames.push({ layout: [svg.clientWidth, svg.clientHeight, document.getElementById("mapUnder").offsetHeight], count: set.length,
      state: set.length ? set[0].playState : null, time: set.length ? set[0].currentTime : null, start: set.length ? set[0].startTime : null, timeline: document.timeline.currentTime,
      ground: (b => [b.left, b.top, b.width, b.height])(svg.querySelector(".map-ground").getBoundingClientRect()),
      faces: [...svg.querySelectorAll(".map-stack:not([hidden]) .stack-face rect")].map(el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }) });
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}
const watched = page => page.evaluate(() => { window.__watch.on = false; return window.__watch.frames; });

/* ---- Done to the page ---------------------------------------------- */
const frames = (page, count = 2) => page.evaluate(n => new Promise(done => { const next = left => (left ? requestAnimationFrame(() => next(left - 1)) : done()); next(n); }), count);
const moving = page => page.evaluate(motion, MOTION);
/* A move over, in its own time: none of its animations is left. */
const ended = async page => { await expect.poll(async () => (await moving(page)).count, { timeout: 8000 }).toBe(0); await frames(page); };
const middle = (page, selector) => page.locator(selector).first().evaluate(el => { const b = el.getBoundingClientRect(); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; });
const block = hotel => `#view-map .map-hotel[data-hotel="${hotel}"] rect`;
const name = key => `#view-map .map-stack:not([hidden]) .plate-label[data-plate="${key}"]`;
const room = id => `#view-map .plate.flat [data-room="${id}"]`;
const touch = async (page, selector) => { const at = await middle(page, selector); await page.touchscreen.tap(at.x, at.y); };
const goBack = page => page.locator("#mapBack").tap();

/* Two pictures alike: the same markup and card, and every part's box within
   a px, shown or not alike - and keyboard focus on the same control, but
   where `focus` is false. */
function alike(got, want, what, focus = true) {
  expect.soft(got.markup === want.markup, `${what}: the drawing's markup is the Reduce Motion page's`).toBe(true);
  expect.soft(got.card, `${what}: the card`).toBe(want.card);
  expect.soft([got.stack, got.level, got.back && got.back.words, focus && got.focus], `${what}: the view, the way back's words, keyboard focus`).toEqual([want.stack, want.level, want.back && want.back.words, focus && want.focus]);
  expect.soft(got.parts.length, `${what}: as many parts`).toBe(want.parts.length);
  const off = [];
  got.parts.forEach((part, i) => {
    const other = want.parts[i] || [];
    if ([0, 1, 2, 3].some(k => Math.abs(part[k] - other[k]) > TOLERANCE) || part[4] !== other[4] || part[5] !== other[5] || part[6] !== other[6]) off.push(`part ${i}: ${JSON.stringify(part)} for ${JSON.stringify(other)}`);
  });
  expect.soft(off.slice(0, 5), `${what}: every box within ${TOLERANCE} px, and shown alike`).toEqual([]);
  expect.soft([got.layout, got.slot.map(Math.round)], `${what}: the frame's and the slot's boxes`).toEqual([want.layout, want.slot.map(Math.round)]);
}
/* One step played with motion on, in its own time, and its page held to
   `want`, the same step's under Reduce Motion: a set of `span` ms starts - 0
   for none - of transform, opacity and visibility alone, with no fill; the
   frame's and the slot's layout boxes keep their size on every frame of it;
   and when it has ended the page is `want`, with nothing of the set left. */
async function played(page, what, go, span, want) {
  await page.evaluate(watch, MOTION);
  await frames(page);
  await go();
  const set = await moving(page);
  expect.soft([set.count > 0, Math.round(set.span)], `${what}: a set starts, of its span`).toEqual([span !== 0, span]);
  expect.soft(set.props.filter(p => !["transform", "opacity", "visibility"].includes(p)), `${what}: only transform, opacity and visibility are animated`).toEqual([]);
  expect.soft(set.fills.filter(fill => fill !== "none" && fill !== "auto"), `${what}: no animation fills`).toEqual([]);
  await ended(page);
  const seen = await watched(page), got = await page.evaluate(picture), live = seen.filter(f => f.count > 0);
  expect.soft(live.every(f => JSON.stringify(f.layout) === JSON.stringify(got.layout)), `${what}: the frame's and the slot's layout boxes keep their size through the move, ${live.length} frames`).toBe(true);
  alike(got, want, what);
  expect.soft((await moving(page)).count, `${what}: nothing of the set is left`).toBe(0);
  if (got.back) expect.soft([got.back.box[3] >= 44, got.back.box[2] >= 44], `${what}: the way back is 44 px`).toEqual([true, true]);
}
/* A walk: its steps done under Reduce Motion, where no set may start, and
   each one's page kept; then from the start again with motion on, each step
   played and held to the page kept. `reset` brings the page back to where
   the walk starts. The steps are walked once before either, so that every
   venue's group they open is built, and both passes start alike. */
async function walk(page, steps, reset) {
  const want = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [, go] of steps) { await go(); await frames(page); }
  await reset();
  for (const [what, go] of steps) {
    await go();
    expect.soft((await moving(page)).count, `${what}, under Reduce Motion: no set starts`).toBe(0);
    await frames(page);
    want.push(await page.evaluate(picture));
  }
  await reset();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [i, [what, go, span]] of steps.entries()) await played(page, what, go, span, want[i]);
}

test.describe("the motion between the Map's views", () => {
  test.use({ storageState: seed(READERS["a reader with picks and follows"]) });

  test("the lift, the drop-in and each way back, played in their own time: after each the page is the Reduce Motion page, and nothing of the set is left", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await walk(page, [
      ["the lift on the Hyatt", () => touch(page, block("Hyatt")), 630],
      ["the drop-in on its Exhibit plate", () => touch(page, name(EXHIBIT)), 550],
      ["the way back to the stack", () => goBack(page), 358],
      ["the way back to the city", () => goBack(page), 410],
      ["the lift on the Hilton, five plates", () => touch(page, block("Hilton")), 660],
      ["its way back", () => goBack(page), 429],
      ["the lift on the Mart's Building 3, which has no drawing", () => touch(page, block("AmericasMart Building 3")), 570],
      ["its way back, by a touch off the plates", () => page.touchscreen.tap(page.viewportSize().width - 30, 200), 371],
    ], async () => {});
  });

  test("the zoom, in, from room to room and out, and a room selected in place, which moves nothing", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await touch(page, block("Hyatt")); await ended(page);
    await touch(page, name(EXHIBIT)); await ended(page);
    await walk(page, [
      ["Hanover F, small at the fit", () => touch(page, room("Hanover F")), 240],
      ["Hanover D, while close", () => touch(page, room("Hanover D")), 240],
      ["Hanover D again: nothing moves", () => touch(page, room("Hanover D")), 0],
      ["Whole level", () => goBack(page), 240],
    ], async () => { await touch(page, room("Hanover F")); await frames(page); await goBack(page); await frames(page); await page.touchscreen.tap(page.viewportSize().width - 30, 200); await frames(page); });
  });

  test("the arrival from an event's place line: at one small room two beats in one set, at two rooms the drop-in alone, and where the Map already shows the level nothing at all", async ({ page }) => {
    /* The shared day's panel, and an event's sheet opened from it: its place line is the arrival. */
    const sheet = async title => {
      await open(page, SATURDAY, DAY_LINK);
      await page.getByText(title).first().tap();
      await expect(page.locator("#sheetPlace")).toBeVisible();
    };
    const arrive = async () => {
      await page.locator("#sheetPlace").tap();
      await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-stack", "Hyatt");
    };
    const want = {};
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const title of [ROSWELL, HANOVER_FG]) {
      await sheet(title); await arrive();
      expect.soft((await moving(page)).count, `${title}, under Reduce Motion: no set starts`).toBe(0);
      await frames(page);
      want[title] = await page.evaluate(picture);
    }
    expect([want[ROSWELL].level, want[ROSWELL].back.words, want[HANOVER_FG].level, want[HANOVER_FG].back.words]).toEqual(["acc", "← Whole level", EXHIBIT, "← Hyatt"]);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await sheet(ROSWELL);
    await played(page, "an arrival at Roswell, one small room", arrive, 790, want[ROSWELL]);
    await sheet(HANOVER_FG);
    await played(page, "an arrival at Hanover F and G, two rooms", arrive, 550, want[HANOVER_FG]);
    /* The Map shows that level at its fit: the focused card is the event's, and its sheet's place line the arrival again - nothing moves. */
    await page.locator("#mapNext").tap();
    await expect(page.locator("#sheetPlace")).toBeVisible();
    await page.locator("#sheetPlace").tap();
    await expect(page.locator("#sheetWrap")).toBeHidden();
    expect((await moving(page)).count, "an arrival where the camera does not move starts no set").toBe(0);
    alike(await page.evaluate(picture), want[HANOVER_FG], "the level, arrived at again");
  });

  test("a set's first frame is painted before it runs: it is made held at its start, and started at that frame's own time - and at a lift's the tapped block stands where it stood, to 1 px, whatever the frame's box became", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    const before = await page.locator(block("Hilton")).evaluate(el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    const ground = await page.locator("#view-map svg.map .map-ground").evaluate(el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    await page.evaluate(watch, MOTION);
    await frames(page);
    await touch(page, block("Hilton"));
    await ended(page);
    const seen = await watched(page), at = seen.findIndex(f => f.count > 0), first = seen[at], second = seen[at + 1], last = seen[seen.length - 1];
    expect([first.state, first.time, first.start], "the set as its first frame finds it: held, at its start").toEqual(["paused", 0, null]);
    expect([second.state, Math.abs(second.start - first.timeline) < 0.01], `and started in that frame, at that frame's time: ${second.start} for ${first.timeline}`).toEqual(["running", true]);
    expect(first.faces).toHaveLength(1);
    expect(first.faces[0].map((v, i) => Math.abs(v - before[i]) <= TOLERANCE), `the block's face at the first frame, ${JSON.stringify(first.faces[0])}, where the block stood, ${JSON.stringify(before)}`).toEqual([true, true, true, true]);
    expect(first.ground.map((v, i) => Math.abs(v - ground[i]) <= TOLERANCE), "the frame as drawn at the first frame is the frame as it stood").toEqual([true, true, true, true]);
    /* and the way back the same: the stack's frame at its first frame */
    await page.evaluate(watch, MOTION);
    await frames(page);
    await goBack(page);
    await ended(page);
    const back = await watched(page), from = back.find(f => f.count > 0);
    expect(from.ground.map((v, i) => Math.abs(v - last.ground[i]) <= TOLERANCE), "the way back's first frame is the stack's frame").toEqual([true, true, true, true]);
    expect(back[back.length - 1].ground.map((v, i) => Math.abs(v - ground[i]) <= TOLERANCE), "and its end the city's").toEqual([true, true, true, true]);
  });

  test("a double tap on a hotel ends on its stack with no level open; a tap on the drawing while a set runs is spent, and the way back while one runs steps back", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await touch(page, block("Marriott")); await frames(page);
    const stack = await page.evaluate(picture);
    await goBack(page); await frames(page);
    const city = await page.evaluate(picture);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const at = await middle(page, block("Marriott"));
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await frames(page);
    /* Keyboard focus aside: the second touch falls on a plate, and a browser may give a touched control its focus before the page hears the tap. */
    alike(await page.evaluate(picture), stack, "after a double tap on the Marriott", false);
    expect((await moving(page)).count, "the second tap finished the lift").toBe(0);
    expect(await page.locator("#view-map .plate.selected, #view-map .plate.flat").count()).toBe(0);

    /* The way back while the lift runs: the lift is finished, and the way back plays. */
    await goBack(page); await ended(page);
    await page.touchscreen.tap(at.x, at.y);
    expect((await moving(page)).count, "the lift is running").toBeGreaterThan(0);
    await goBack(page);
    const back = await moving(page);
    expect([await page.locator("#view-map svg.map").getAttribute("data-stack"), back.count > 0, Math.round(back.span)]).toEqual([null, true, 410]);
    await ended(page);
    alike(await page.evaluate(picture), city, "the city, after the way back taken mid-lift");

    /* A tap on a plate's place while the lift runs opens no level; the next tap, the set over, does. */
    await page.touchscreen.tap(at.x, at.y);
    const frame = await page.locator("#view-map svg.map").boundingBox();
    await page.touchscreen.tap(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await frames(page);
    expect([await page.locator("#view-map svg.map").getAttribute("data-stack"), await page.locator("#view-map svg.map").getAttribute("data-level"), (await moving(page)).count]).toEqual(["Marriott", null, 0]);
    await touch(page, name("marquis"));
    await expect(page.locator("#view-map svg.map")).toHaveAttribute("data-level", "marquis");
    /* A day chip while the drop-in runs: the set is finished and the day chosen. */
    await page.locator('#view-map [data-chip="map-day"][data-value="2026-09-06"]').tap();
    expect([(await moving(page)).count, await page.locator("#view-map .map-wrap").getAttribute("data-day")]).toEqual([0, "2026-09-06"]);
  });

  test("a venue's group that is put away shows nothing and takes no touch and no Tab stop; and the block's face is not shown in any of the four views", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    /* What the page says of the put-away groups and of every face. */
    const away = () => page.evaluate(() => {
      const svg = document.querySelector("#view-map svg.map"), groups = [...svg.querySelectorAll(".map-stack[hidden]")];
      const shown = groups.flatMap(g => [g, ...g.querySelectorAll("*")]).filter(el => el.checkVisibility({ visibilityProperty: true })).length;
      const box = svg.getBoundingClientRect(), hits = [];
      for (let x = box.left + 6; x < box.right; x += 12) for (let y = box.top + 6; y < box.bottom; y += 12) if (document.elementsFromPoint(x, y).some(el => el.closest(".map-stack[hidden]"))) hits.push([x, y]);
      return { groups: groups.map(g => g.dataset.hotel), display: groups.map(g => getComputedStyle(g).display), shown, hits: hits.length,
        tabs: groups.flatMap(g => [...g.querySelectorAll('[tabindex="0"], [role="button"]:not([tabindex="-1"])')]).length,
        faces: [...svg.querySelectorAll(".stack-face")].map(face => getComputedStyle(face).visibility) };
    });
    /* Tab from the way back, or the first day chip, through the page: no stop is inside a group put away. */
    const tabStops = async from => {
      await page.locator(from).first().focus();
      const stops = [];
      for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); stops.push(await page.evaluate(() => { const el = document.activeElement; return el && el.closest ? !!el.closest(".map-stack[hidden]") : false; })); }
      return stops.filter(Boolean).length;
    };
    await touch(page, block("Hyatt")); await ended(page);
    await touch(page, name(EXHIBIT)); await ended(page);
    await goBack(page); await ended(page);
    await goBack(page); await ended(page);
    /* the city: the Hyatt's group is put away */
    let said = await away();
    expect.soft(said, "the city, the Hyatt's group put away").toEqual({ groups: ["Hyatt"], display: ["inline"], shown: 0, hits: 0, tabs: 0, faces: ["hidden"] });
    expect.soft(await tabStops('#view-map [data-chip="map-day"]'), "the city: Tab stops in a group put away").toBe(0);
    /* another venue's stack */
    await touch(page, block("Hilton")); await ended(page);
    said = await away();
    expect.soft([said.groups, said.shown, said.hits, said.tabs, said.faces], "the Hilton's stack, the Hyatt's group put away").toEqual([["Hyatt"], 0, 0, 0, ["hidden", "hidden"]]);
    expect.soft(await tabStops("#mapBack"), "a stack: Tab stops in a group put away").toBe(0);
    /* a level, and a room brought close */
    await touch(page, name("l2")); await ended(page);
    said = await away();
    expect.soft([said.shown, said.hits, said.tabs, said.faces], "a level").toEqual([0, 0, 0, ["hidden", "hidden"]]);
    await touch(page, room("209")); await ended(page);
    said = await away();
    expect.soft([await page.locator("#mapBack").textContent(), said.shown, said.hits, said.faces], "a room brought close").toEqual(["← Whole level", 0, 0, ["hidden", "hidden"]]);
    expect.soft(await tabStops("#mapBack"), "a level: Tab stops in a group put away").toBe(0);
  });

  test("a closing level's names are in the page while its way back plays and gone when it ends; a set finished from outside leaves the same page", async ({ page }) => {
    await open(page, SATURDAY);
    await tab(page, "map");
    await touch(page, block("Hyatt")); await ended(page);
    const names = () => page.evaluate(() => document.querySelectorAll("#view-map .map-stack:not([hidden]) .level-labels > *, #view-map .map-stack:not([hidden]) .level-streets > *").length);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await touch(page, name(EXHIBIT)); await frames(page);
    await goBack(page); await frames(page);
    const want = await page.evaluate(picture);
    expect(await names()).toBe(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const end of ["in its own time", "finished from outside"]) {
      await touch(page, name(EXHIBIT)); await ended(page);
      const open = await names();
      await goBack(page);
      expect([await names(), (await moving(page)).count > 0], `${end}: the names stand while the way back plays`).toEqual([open, true]);
      if (end === "in its own time") await ended(page);
      else { await page.evaluate(id => { for (const anim of document.getAnimations()) if (anim.id === id) anim.finish(); }, MOTION); await frames(page); }
      expect([await names(), (await moving(page)).count], `${end}: and are gone with the set`).toEqual([0, 0]);
      alike(await page.evaluate(picture), want, `the stack, its level closed, ${end}`);
    }
  });
});
