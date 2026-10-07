/* The stack (DECISIONS #95; docs/screens/contract.md, section 6): a venue
   with a building lifted into its floors in the Map's own frame - what opens
   it and what does not, its plates and their three kinds, what a day lights,
   counts and edges, a plate selected, the card under the map in its three
   states, the ways back, arriving from an event's place line as deep as its
   place goes, and the draw in place. The page is the sample schedule at
   Saturday 1:05 PM; where the sample lacks a thing - an event on a shared
   plate's second level, a cancelled event, an end on a later con day, a
   schedule that changes which plates are inert - a copy of it is handed to
   replaceSchedule(), as a refresh hands one. The layout's numbers are
   tests/unit/stack.test.js's, the crew on the venue's line
   tests/page/crew-everywhere.test.js's, and where a plate stands on a screen
   tests/browser/stack.spec.js's. New tests, not rows of
   tests/PORT-LEDGER.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { mutationsDuring, tap } from "../helpers/act.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = JSON.parse(fs.readFileSync(path.join(HERE, "..", "sample-events.json"), "utf8"));
const css = fs.readFileSync(path.join(HERE, "..", "..", "src", "styles.css"), "utf8").replace(/\r\n/g, "\n");
const NOW = "2026-09-05T13:05", WED = "2026-09-02", SAT = "2026-09-05", SUN = "2026-09-06";
const PARK = "Hardy Ivy Park", MART2 = "AmericasMart Building 2", MART3 = "AmericasMart Building 3";
const EXHIBIT = "exhibit+tower-ll2", BALLROOM = "ballroom+tower-ll1";
/* Two of the reader's Saturday picks at the Hyatt, one a plate: 2:30 PM in
   Centennial II-IV, a composite of three rooms on the Ballroom Level, and
   4:00 PM in Grand Hall C on the Exhibit Level. */
const IN_BALLROOM = "s0376", IN_EXHIBIT = "s0263";

describe("the stack: a venue lifted into its floors", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-map");
  const svg = () => view().querySelector("svg.map");
  const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
  const block = hotel => svg().querySelector(`.map-hotel[data-hotel="${hotel}"]`);
  const groups = () => [...svg().querySelectorAll(".map-stacks > .map-stack")];
  const group = hotel => groups().find(g => g.dataset.hotel === hotel) || null;
  const shown = () => groups().filter(g => !g.hasAttribute("hidden"));
  const plates = () => [...shown()[0].querySelectorAll(".plate")];
  const plate = key => plates().find(p => p.dataset.plate === key);
  const label = key => [...shown()[0].querySelectorAll(".plate-label")].find(t => t.dataset.plate === key);
  const kinds = () => plates().map(p => p.getAttribute("class").split(" ")[1]);
  /* Where a plate's label stands in the Map's frame, and at what size: its
     own place and scale, its plate's lift and the camera, composed. */
  const stands = key => {
    const read = (node, pattern) => pattern.exec(node.getAttribute("transform") || "translate(0 0)").slice(1).map(Number);
    const [px, py, k] = read(label(key), /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/), [lift] = read(plate(key), /^translate\(0 (-?[\d.]+)\)$/);
    const [tx, ty, s] = read(shown()[0].querySelector(".stack-cam"), /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/);
    return { x: tx + s * px, y: ty + s * (py + lift), size: s * k };
  };
  const lit = () => [...shown()[0].querySelectorAll(".lit")].map(r => `${r.dataset.level}|${r.dataset.room}`).sort();
  const under = () => el("mapUnder");
  const rows = () => [...under().querySelectorAll(".pc-row")].map(r => [words(r.querySelector(".pc-title")), words(r.querySelector(".pc-when"))]);
  const cardLines = () => [...el("mapPlate").children].filter(n => !n.matches(".pc-rows, .pc-none")).map(words);
  const dayChip = day => view().querySelector(`[data-chip="map-day"][data-value="${day}"]`);
  const press = (target, key) => !target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));   // true where the page took the key
  const navTo = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
  const byId = id => app.byId.get(id);
  const places = (v, n) => String(Math.round(v * 10 ** n) / 10 ** n);
  /* The city map at Saturday 1:05 PM, nothing open, with these picks. */
  const city = (ids = []) => {
    handle.closeSheet();
    app.setOverride(NOW);
    state.tab = "map";
    Object.assign(state.map, { day: null, focus: null, stack: null, plate: null });
    handle.picks.set(ids);
    handle.render();
  };
  /* A venue's stack, by a tap on its block. */
  const lift = hotel => tap(block(hotel).querySelector("rect"));
  /* What says a stack is open, and which. */
  const open = () => [state.map.stack, svg().getAttribute("data-stack"), shown().map(g => g.dataset.hotel).join(",") || null, el("mapBack").hidden];
  const CLOSED = [null, null, null, true];

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    navTo("map");
  }, 30000);
  afterAll(() => page.cleanup());
  beforeEach(() => city());

  it("found the sample the tests stand on: seven venues with a building, and the park with none", () => {
    expect(app.BUILDINGS).toEqual(["Marriott", "Hyatt", "Hilton", "Courtland Grand", "Westin", MART2, MART3]);
    expect([app.building(PARK), app.MAP_HOTELS[PARK].park]).toEqual([null, true]);
    expect([byId(IN_BALLROOM), byId(IN_EXHIBIT)].map(e => [e.hotel, e.level, e._cd])).toEqual([["Hyatt", "ballroom", SAT], ["Hyatt", "exhibit", SAT]]);
    expect(open()).toEqual(CLOSED);
  });

  describe("what opens it, and what does not", () => {
    it("a tap on a venue's block - its shape or its name - opens its stack: no sheet, the way back shown, and keyboard focus on it", () => {
      for (const part of ["rect", "text"]) {
        city();
        tap(block("Hyatt").querySelector(part));
        expect(open(), part).toEqual(["Hyatt", "Hyatt", "Hyatt", false]);
        expect([el("sheetWrap").hidden, state.sheetHotel, state.map.plate]).toEqual([true, null, null]);
        expect(document.activeElement).toBe(el("mapBack"));
      }
    });
    it("each of the seven has one, by its block", () => {
      for (const hotel of app.BUILDINGS) { city(); lift(hotel); expect(open(), hotel).toEqual([hotel, hotel, hotel, false]); }
    });
    it("its gold pill opens it too, at a tap on the pill's shape or its number", () => {
      for (const part of ["rect", "text"]) {
        city([IN_EXHIBIT]);
        tap(svg().querySelector(`.map-pill[data-hotel="Hyatt"] ${part}`));
        expect([open(), el("sheetWrap").hidden], part).toEqual([["Hyatt", "Hyatt", "Hyatt", false], true]);
      }
    });
    it("Enter and Space on its block open it, the key taken, and focus goes to the way back", () => {
      for (const key of ["Enter", " "]) {
        city();
        block("Westin").focus();
        expect(press(block("Westin"), key), key).toBe(true);
        expect([open(), el("sheetWrap").hidden, document.activeElement === el("mapBack")], key).toEqual([["Westin", "Westin", "Westin", false], true, true]);
      }
      city();
      expect(press(block("Westin"), "a")).toBe(false);       // any other key is the page's
      expect(open()).toEqual(CLOSED);
    });
    it("a key held down is one press: a repeat opens nothing, closes nothing and selects nothing, and is taken, so the way back's own button never hears it", () => {
      const held = (target, key) => { const e = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e.defaultPrevented; };
      expect([held(block("Westin"), "Enter"), held(block("Westin"), " "), open()]).toEqual([true, true, CLOSED]);
      block("Westin").focus();
      press(block("Westin"), "Enter");                       // the press: its stack, and focus on the way back
      expect([held(el("mapBack"), "Enter"), held(el("mapBack"), " "), open()]).toEqual([true, true, ["Westin", "Westin", "Westin", false]]);
      expect([held(plate("f6"), "Enter"), state.map.plate]).toEqual([true, null]);
      press(plate("f6"), "Enter");
      expect([held(plate("f6"), " "), held(plate("f6"), "Enter"), state.map.plate]).toEqual([true, true, "f6"]);
      expect([press(el("mapBack"), "Enter"), held(el("mapBack"), "a"), held(document.getElementById("mapVenue") || el("mapPlate"), "Enter")]).toEqual([false, false, false]);   // a press on the way back is the button's own, and a repeat elsewhere is not the Map's
    });
    it("the park has no building: its block, its gold pill and Enter on it open its hotel sheet, as built, and no stack", () => {
      const inPark = handle.events.find(e => e.hotel === PARK && e._cd === SAT);
      for (const go of [() => tap(block(PARK).querySelector("rect")), () => tap(svg().querySelector(`.map-pill[data-hotel="${PARK}"] rect`)), () => press(block(PARK), "Enter")]) {
        city([inPark.id]);
        go();
        expect([el("sheetWrap").hidden, state.sheetHotel, words(el("sheetTitleHotel"))]).toEqual([false, PARK, PARK]);
        expect(open()).toEqual(CLOSED);
      }
    });
    it("openStack() says whether it opened one, and opens none for a place with no building", () => {
      expect([app.openStack(PARK), app.openStack("Streaming"), app.openStack("no such place"), state.map.stack]).toEqual([false, false, false, null]);
      expect([app.openStack("Hilton"), state.map.stack]).toEqual([true, "Hilton"]);
    });
    it("and opens with nothing selected, whatever was: the Courtland Grand's second floor is not the Mart's", () => {
      lift("Courtland Grand");
      tap(plate("f2").querySelector(".plate-hull"));
      expect([state.map.stack, state.map.plate, app.building(MART3).plates.some(p => p.key === "f2" && !p.inert)]).toEqual(["Courtland Grand", "f2", true]);
      expect([app.openStack(MART3), state.map.stack, state.map.plate, el("mapPlate"), !!el("mapVenue")]).toEqual([true, MART3, null, null, true]);
      expect(svg().querySelectorAll('.plate.selected, .plate[aria-pressed="true"]')).toHaveLength(0);
    });
    it("it is state in memory alone - the venue and the plate, each null for none: opening one and selecting a plate writes nothing the page keeps - and a fresh page shows the city map", async () => {
      const kept = () => JSON.stringify([localStorage, sessionStorage].map(store => Object.keys(store).sort().map(key => [key, store.getItem(key)])));
      const before = kept();
      lift("Hyatt");
      tap(plate("acc").querySelector(".plate-hull"));
      expect([state.map.stack, state.map.plate]).toEqual(["Hyatt", "acc"]);
      expect(kept()).toBe(before);                           // whatever a key is called, none was written or changed
      expect(Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => /stack|plate/i.test(k))).toEqual([]);
      await page.cleanup();
      page = await bootPage();
      ({ app, handle } = page);
      state = handle.state;
      navTo("map");
      expect([state.map.stack, state.map.plate, open()]).toEqual([null, null, CLOSED]);
    }, 30000);
  });

  describe("the plates", () => {
    it("a venue's are its building's, one a storey, bottom to top in the page and on the screen: the Hyatt's four", () => {
      lift("Hyatt");
      expect(plates().map(p => p.dataset.plate)).toEqual(["acc", EXHIBIT, BALLROOM, "lobby"]);
      expect(plates().map(p => p.dataset.plate)).toEqual(app.building("Hyatt").plates.map(p => p.key));
      const lifts = plates().map(p => Number((/^translate\(0 (-?[\d.]+)\)$/.exec(p.getAttribute("transform") || "translate(0 0)") || [])[1]));
      expect(lifts[0]).toBe(0);
      for (let j = 1; j < lifts.length; j++) expect(lifts[j]).toBeLessThan(lifts[j - 1]);          // each stands above the one before it
      const ys = plates().map(p => stands(p.dataset.plate).y);
      for (let j = 1; j < ys.length; j++) expect(ys[j]).toBeLessThan(ys[j - 1]);                    // and its label with it
    });
    it("three kinds: drawn, a floor with no drawing, and inert - the Hyatt's Lobby Level, the Westin's 12th and 14th Floors, the Mart's floors", () => {
      lift("Hyatt");
      expect(kinds()).toEqual(["drawn", "drawn", "drawn", "inert"]);
      city(); lift("Westin");
      expect([plates().map(p => p.dataset.plate), kinds()]).toEqual([["f6", "f7", "f8", "f12", "f14"], ["drawn", "drawn", "drawn", "floor", "inert"]]);
      city(); lift(MART3);
      expect([plates().map(p => p.dataset.plate), kinds()]).toEqual([["f1", "f2"], ["floor", "floor"]]);
      city(); lift(MART2);
      expect(kinds()).toEqual(["inert", "inert", "floor", "inert"]);
    });
    it("a plate that is not inert is a button a key can reach, named and saying whether it is selected; an inert one is neither, and has no name of a button's", () => {
      lift("Hyatt");
      expect(plates().map(p => [p.getAttribute("role"), p.getAttribute("tabindex"), p.getAttribute("aria-pressed")])).toEqual([["button", "0", "false"], ["button", "0", "false"], ["button", "0", "false"], [null, null, null]]);
      expect(plate("lobby").getAttribute("aria-label")).toBe(null);
      expect(plate("lobby").querySelector(".plate-sel")).toBe(null);
    });
    it("a drawn plate carries its rooms, its open areas and its ballrooms' outlines, each room and each open area with an id saying its level and its id; a floor and an inert plate carry their outline alone", () => {
      lift("Hyatt");
      for (const p of app.building("Hyatt").plates) {
        const node = plate(p.key), ballrooms = p.groups.filter(g => g.kind === "ballroom");
        expect([node.querySelectorAll(".plate-room").length, node.querySelectorAll(".plate-open").length, node.querySelectorAll(".plate-group").length], p.key).toEqual([p.rooms.length, p.open.length, ballrooms.length]);
        expect([...node.querySelectorAll(".plate-room")].map(r => `${r.dataset.level}|${r.dataset.room}`), p.key).toEqual(p.rooms.map(r => `${r.level}|${r.id}`));
        expect([...node.querySelectorAll(".plate-open.place")].map(r => `${r.dataset.level}|${r.dataset.room}`), p.key).toEqual(p.open.filter(o => "id" in o).map(o => `${o.level}|${o.id}`));
        expect(node.querySelectorAll(".plate-open:not(.place)[data-room]").length).toBe(0);         // scenery is no place: it cannot be lit
      }
      expect(app.building("Hyatt").plates.map(p => p.rooms.length > 0)).toEqual([true, true, true, false]);
      expect(plate(EXHIBIT).querySelectorAll('[data-level="exhibit"]').length).toBeGreaterThan(0);  // a shared plate: both its levels' rooms
      expect(plate(EXHIBIT).querySelectorAll('[data-level="tower-ll2"]').length).toBeGreaterThan(0);
      city(); lift("Westin");
      expect(["f12", "f14"].map(k => [...plate(k).querySelector(".plate-tilt").children].map(n => n.getAttribute("class")))).toEqual([["plate-sel", "plate-hull"], ["plate-hull"]]);
    });
    it("every plate is the venue's hull, one outline; a venue with no drawing takes its block's own shape", () => {
      lift("Hyatt");
      const hull = app.building("Hyatt").hull;
      const outlines = [...shown()[0].querySelectorAll(".plate-hull")];
      expect(outlines.map(o => o.tagName)).toEqual(["polygon", "polygon", "polygon", "polygon"]);
      expect(new Set(outlines.map(o => o.getAttribute("points"))).size).toBe(1);
      expect(outlines[0].getAttribute("points")).toBe(hull.map(p => `${places(p[0], 1)},${places(p[1], 1)}`).join(" "));
      city(); lift(MART2);
      const b = app.MAP_HOTELS[MART2];
      expect(app.building(MART2).hull).toBe(null);
      expect([...shown()[0].querySelectorAll(".plate-hull")].map(o => [o.tagName, o.getAttribute("x"), o.getAttribute("y"), o.getAttribute("width"), o.getAttribute("height"), o.getAttribute("rx")]))
        .toEqual(Array(4).fill(["rect", "0", "0", String(b.w), String(b.h), "10"]));
    });
    it("it stands where stack.js lays it out in the Map's own frame: the camera, the tilt about the outline's centre, each plate's lift, and each label in its plate's group - upright, at the frame's own size, under its plate's near corner", () => {
      const [x, y, w, h] = svg().getAttribute("viewBox").split(" ").map(Number);
      for (const hotel of ["Hyatt", MART3]) {
        city(); lift(hotel);
        const made = app.building(hotel), points = made.hull || app.blockOutline(app.MAP_HOTELS[hotel]), at = app.stackLayout(points, made.plates.length, { x, y, w, h });
        expect(shown()[0].querySelector(".stack-cam").getAttribute("transform"), hotel).toBe(`translate(${places(at.tx, 3)} ${places(at.ty, 3)}) scale(${places(at.scale, 5)})`);
        const [cx, cy] = at.centre;
        expect(new Set([...shown()[0].querySelectorAll(".plate-tilt")].map(t => t.getAttribute("transform"))), hotel)
          .toEqual(new Set([`translate(${places(cx, 3)} ${places(cy, 3)}) skewX(-30) scale(1 0.5) translate(${places(-cx, 3)} ${places(-cy, 3)})`]));
        expect(plates().map(p => p.getAttribute("transform")), hotel).toEqual(made.plates.map((p, j) => (j ? `translate(0 ${places(-j * at.gap, 3)})` : null)));
        expect(shown()[0].querySelectorAll(".plate-label")).toHaveLength(made.plates.length);
        made.plates.forEach((p, j) => {
          const on = stands(p.key), box = at.plates[j], name = `${hotel}, ${p.key}`;
          expect([label(p.key).parentNode === plate(p.key), plate(p.key).lastElementChild === label(p.key), label(p.key).closest(".plate-tilt")], name).toEqual([true, true, null]);
          expect([Math.abs(on.x - (box.x0 + 7)) < 0.02, Math.abs(on.y - (box.y1 - 5)) < 0.02, Math.abs(on.size - 1) < 1e-4], `${name}: 7 in from its plate's left and 5 up from its foot, at the frame's own size`).toEqual([true, true, true]);
        });
        expect(shown()[0].querySelector(".stack-labels")).toBe(null);                                  // no layer of labels apart from the plates
      }
    });
    it("behind it the city map is pushed in 2.2 times toward the venue, its block's centre where the ground plate's centre stands, clipped to the frame, out of a screen reader's way and out of the tab order, the venue's own block marked", () => {
      const [x, y, w, h] = svg().getAttribute("viewBox").split(" ").map(Number);
      const city0 = svg().querySelector(".map-city"), cam = city0.querySelector(".map-cam");
      expect([city0.getAttribute("clip-path"), city0.getAttribute("aria-hidden"), cam.getAttribute("transform")]).toEqual([null, null, null]);
      lift("Westin");
      const at = app.stackLayout(app.building("Westin").hull, 5, { x, y, w, h }), b = app.MAP_HOTELS.Westin;
      expect(cam.getAttribute("transform")).toBe(`translate(${places(at.ground[0], 3)} ${places(at.ground[1], 3)}) scale(2.2) translate(${-(b.x + b.w / 2)} ${-(b.y + b.h / 2)})`);
      expect([city0.getAttribute("clip-path"), city0.getAttribute("aria-hidden")]).toEqual(["url(#mapClip)", "true"]);
      const clip = svg().querySelector("defs > clipPath#mapClip > rect"), ground = svg().querySelector(".map-ground");
      expect(["x", "y", "width", "height", "rx"].map(a => clip.getAttribute(a))).toEqual(["x", "y", "width", "height", "rx"].map(a => ground.getAttribute(a)));
      expect([...svg().querySelectorAll(".map-hotel")].map(g => g.getAttribute("tabindex"))).toEqual(Array(8).fill("-1"));
      expect([...svg().querySelectorAll(".map-hotel.lifted")].map(g => g.dataset.hotel)).toEqual(["Westin"]);
      expect([cam.contains(block("Westin")), cam.contains(svg().querySelector(".map-layer-pills")), cam.contains(svg().querySelector(".map-streets")), cam.contains(shown()[0]), ground.parentNode === svg()]).toEqual([true, true, true, false, true]);
      el("mapBack").click();
      expect([city0.getAttribute("clip-path"), city0.getAttribute("aria-hidden"), cam.getAttribute("transform")]).toEqual([null, null, null]);
      expect([...svg().querySelectorAll(".map-hotel")].map(g => g.getAttribute("tabindex"))).toEqual(Array(8).fill("0"));
      expect(svg().querySelectorAll(".map-hotel.lifted")).toHaveLength(0);
    });
    it("the stylesheet dims what is behind and hides what is not shown: the other blocks at 20%, the streets and bridges at 10%, the pills, the rings and the venue's own block not at all", () => {
      expect(css).toMatch(/\n\.map\[data-stack\] \.map-streets \{ opacity: \.1; \}/);
      expect(css).toMatch(/\n\.map\[data-stack\] \.map-hotel \{ opacity: \.2; \}/);
      expect(css).toMatch(/\n\.map\[data-stack\] \.map-hotel\.lifted, \.map\[data-stack\] \.map-layer-rings, \.map\[data-stack\] \.map-layer-focus, \.map\[data-stack\] \.map-layer-pills \{ visibility: hidden; \}/);
      lift("Hyatt");
      expect(svg().querySelector(".map-streets").querySelectorAll(".map-street, .map-bridge")).toHaveLength(6);
    });
  });

  describe("a day lights, counts and edges it", () => {
    beforeEach(() => { city([IN_BALLROOM, IN_EXHIBIT]); lift("Hyatt"); });

    it("lit gold: each room the model lists for the Map's day and the reader's picks, a composite as its rooms - and no other", () => {
      const want = app.dayLights("Hyatt", SAT, handle.picks.get()).flatMap(row => row.lit.map(at => `${at.level}|${at.id}`)).sort();
      expect(want).toEqual(["ballroom|Centennial II", "ballroom|Centennial III", "ballroom|Centennial IV", "exhibit|Grand Hall C"]);
      expect(lit()).toEqual(want);
      expect(shown()[0].querySelectorAll(".plate-hull.lit, .plate-group.lit, .plate.lit")).toHaveLength(0);
    });
    it("the gold edge is on a plate that holds a pick that day, and on no other", () => {
      expect(plates().filter(p => p.classList.contains("mine")).map(p => p.dataset.plate)).toEqual([EXHIBIT, BALLROOM]);
      handle.picks.set([IN_EXHIBIT]); handle.render();
      expect(plates().filter(p => p.classList.contains("mine")).map(p => p.dataset.plate)).toEqual([EXHIBIT]);
      handle.picks.set([]); handle.render();
      expect([plates().filter(p => p.classList.contains("mine")), lit()]).toEqual([[], []]);
    });
    it("a label is the plate's short name, and a star with how many where it holds picks; a floor with no drawing says its day's events, an inert plate its name alone", () => {
      expect(["acc", EXHIBIT, BALLROOM, "lobby"].map(k => words(label(k)))).toEqual(["Conference Center", "Exhibit Level + Intl Tower LL2 ★ 1", "Ballroom Level + Intl Tower LL1 ★ 1", "Lobby Level"]);
      expect([label(EXHIBIT).querySelector(".pl-picks").textContent, label("acc").querySelector(".pl-picks, .pl-count")]).toEqual([" ★ 1", null]);
      expect(["acc", "lobby"].map(k => [label(k).classList.contains("inert"), label(k).getAttribute("aria-hidden")])).toEqual([[false, "true"], [true, null]]);
      const onTwelfth = handle.events.filter(e => e.hotel === "Westin" && e.level === "f12" && e._cd === SAT);
      city([onTwelfth[1].id, onTwelfth[2].id]); lift("Westin");
      expect(onTwelfth).toHaveLength(4);
      expect(["f6", "f12", "f14"].map(k => words(label(k)))).toEqual(["6th Floor", "12th Floor · 4 events ★ 2", "14th Floor"]);
      expect([label("f12").querySelector(".pl-count").textContent, label("f12").querySelector(".pl-picks").textContent]).toEqual([" · 4 events", " ★ 2"]);
      expect(plate("f12").classList.contains("mine")).toBe(true);                                   // a dashed plate has the gold edge too
      dayChip(WED).click();
      expect([words(label("f12")), plate("f12").classList.contains("mine")]).toEqual(["12th Floor · no events", false]);
      city(); lift(MART3);
      expect(["f1", "f2"].map(k => words(label(k)))).toEqual(["Floor 1 · 1 event", "Floor 2 · 3 events"]);
    });
    it("a button says its plate by its full name, its picks on the day, and its events only where it has no drawing", () => {
      expect(["acc", EXHIBIT, BALLROOM].map(k => plate(k).getAttribute("aria-label"))).toEqual([
        "Atlanta Conference Center (LL3): no picks on Saturday",
        "Exhibit Level (LL2) + International Tower · LL2: 1 pick on Saturday",
        "Ballroom Level (LL1) + International Tower · LL1: 1 pick on Saturday"]);
      const onTwelfth = handle.events.filter(e => e.hotel === "Westin" && e.level === "f12" && e._cd === SAT);
      city([onTwelfth[1].id, onTwelfth[2].id]); lift("Westin");
      expect(["f6", "f12"].map(k => plate(k).getAttribute("aria-label"))).toEqual(["6th Floor: no picks on Saturday", "12th Floor: 4 events, 2 picks on Saturday"]);
      dayChip(WED).click();
      expect(plate("f12").getAttribute("aria-label")).toBe("12th Floor: no events, no picks on Wednesday");
      city(); lift(MART3);
      expect(plate("f1").getAttribute("aria-label")).toBe("1st Floor: 1 event, no picks on Saturday");
    });
    it("a day chip lights, counts and labels it again in place: no node of the stack is replaced, the selection is kept", () => {
      tap(plate(BALLROOM).querySelector(".plate-hull"));
      const kept = { group: shown()[0], cam: shown()[0].querySelector(".stack-cam"), plates: plates(), labels: plates().map(p => label(p.dataset.plate)), shapes: [...shown()[0].querySelectorAll(".plate-tilt > *")] };
      const same = () => [shown()[0] === kept.group, shown()[0].querySelector(".stack-cam") === kept.cam, plates().every((p, i) => p === kept.plates[i]), plates().every((p, i) => label(p.dataset.plate) === kept.labels[i]),
        [...shown()[0].querySelectorAll(".plate-tilt > *")].every((n, i) => n === kept.shapes[i]) && kept.shapes.every(n => n.isConnected)];
      const seen = mutationsDuring(svg().querySelector(".map-stacks"), () => dayChip(SUN).click());
      expect([state.map.day, state.map.stack, state.map.plate, same()]).toEqual([SUN, "Hyatt", BALLROOM, [true, true, true, true, true]]);
      expect(seen.filter(m => m.type === "childList" && !m.target.closest(".plate-label")).length).toBe(0);     // only a label's words are written anew
      expect([lit(), plates().filter(p => p.classList.contains("mine")).length, words(label(BALLROOM)), plate(BALLROOM).getAttribute("aria-label")])
        .toEqual([[], 0, "Ballroom Level + Intl Tower LL1", "Ballroom Level (LL1) + International Tower · LL1: no picks on Sunday"]);
      expect([plate(BALLROOM).classList.contains("selected"), plate(BALLROOM).getAttribute("aria-pressed"), el("mapPlate").dataset.plate]).toEqual([true, "true", BALLROOM]);
      dayChip(SAT).click();
      expect([same(), lit().length, words(label(BALLROOM))]).toEqual([[true, true, true, true, true], 4, "Ballroom Level + Intl Tower LL1 ★ 1"]);
    });
    it("and so after a star: the plate takes its edge, its label its star and its room its light, on the nodes that were there", () => {
      handle.picks.set([]); handle.render();
      tap(plate("acc").querySelector(".plate-hull"));
      const kept = plates(), room = shown()[0].querySelector('[data-level="acc"][data-room="Roswell"]');
      const next = under().querySelector(".pc-row");
      expect([next.dataset.hero, room.classList.contains("lit"), plate("acc").classList.contains("mine")]).toEqual(["s0303", false, false]);
      next.click();                                          // its sheet, and the star there
      el("sheetStar").click();
      handle.closeSheet();
      expect(handle.picks.get().has("s0303")).toBe(true);
      expect([plates().every((p, i) => p === kept[i]), room.isConnected, room.classList.contains("lit"), plate("acc").classList.contains("mine"), words(label("acc"))]).toEqual([true, true, true, true, "Conference Center ★ 1"]);
      expect([state.map.plate, el("mapPlate").classList.contains("mine"), under().querySelector(".pc-row").classList.contains("mine")]).toEqual(["acc", true, true]);
    });
  });

  describe("a tap on a plate", () => {
    beforeEach(() => { city([IN_EXHIBIT]); lift("Hyatt"); });

    it("selects it, wherever on it the tap lands - its outline, a room on it - and the card under the map is that plate's", () => {
      for (const part of [".plate-hull", ".plate-room"]) {
        city([IN_EXHIBIT]); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(part));
        expect([state.map.plate, plates().filter(p => p.classList.contains("selected")).map(p => p.dataset.plate), plate(EXHIBIT).getAttribute("aria-pressed"), el("mapPlate").dataset.plate], part)
          .toEqual([EXHIBIT, [EXHIBIT], "true", EXHIBIT]);
        expect([state.map.stack, open()[3]]).toEqual(["Hyatt", false]);
      }
    });
    it("one plate at most: a tap on another moves the selection, and a tap on the selected plate clears it", () => {
      tap(plate("acc").querySelector(".plate-hull"));
      tap(plate(BALLROOM).querySelector(".plate-hull"));
      expect([state.map.plate, plates().map(p => p.getAttribute("aria-pressed"))]).toEqual([BALLROOM, ["false", "false", "true", null]]);
      expect(plates().filter(p => p.classList.contains("selected"))).toHaveLength(1);
      tap(plate(BALLROOM).querySelector(".plate-hull"));
      expect([state.map.plate, plates().filter(p => p.classList.contains("selected")).length, plates().map(p => p.getAttribute("aria-pressed")), el("mapPlate"), !!el("mapVenue")])
        .toEqual([null, 0, ["false", "false", "false", null], null, true]);
    });
    it("Enter and Space on a plate are its tap, the key taken, and focus stays on the plate", () => {
      plate("acc").focus();
      expect(press(plate("acc"), "Enter")).toBe(true);
      expect([state.map.plate, document.activeElement === plate("acc")]).toEqual(["acc", true]);
      expect(press(plate("acc"), " ")).toBe(true);
      expect([state.map.plate, document.activeElement === plate("acc")]).toEqual([null, true]);
      expect(press(plate("acc"), "Tab")).toBe(false);
      expect(state.map.plate).toBe(null);
    });
    it("a tap on a plate's name is a tap on that plate - the words are in its group, wherever on the stack they stand: it selects it, and again clears it, by a star or a count in the name too", () => {
      tap(label(BALLROOM));
      expect([state.map.stack, state.map.plate, plate(BALLROOM).getAttribute("aria-pressed")]).toEqual(["Hyatt", BALLROOM, "true"]);
      tap(label(EXHIBIT).querySelector(".pl-picks"));        // the star in its name
      expect([state.map.plate, plates().filter(p => p.classList.contains("selected")).map(p => p.dataset.plate)]).toEqual([EXHIBIT, [EXHIBIT]]);
      tap(label(EXHIBIT));
      expect([state.map.stack, state.map.plate, open()[3]]).toEqual(["Hyatt", null, false]);
      city(); lift("Westin");
      tap(label("f12").querySelector(".pl-count"));          // a dashed floor's count
      expect(state.map.plate).toBe("f12");
    });
    it("an inert plate is no button: a tap or a key that reached it, or its name, selects nothing and closes nothing - on a phone none reaches it, and what is under it answers (tests/browser/stack.spec.js)", () => {
      tap(plate("acc").querySelector(".plate-hull"));
      tap(plate("lobby").querySelector(".plate-hull"));
      tap(label("lobby"));
      expect([state.map.stack, state.map.plate, plate("lobby").classList.contains("selected")]).toEqual(["Hyatt", "acc", false]);
      expect(press(plate("lobby"), "Enter")).toBe(false);
      expect([state.map.stack, state.map.plate]).toEqual(["Hyatt", "acc"]);
    });
    it("the selection reads apart from the gold edge, and both show where both hold: two outlines, the selection's the light text colour under the plate's own edge", () => {
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      expect([plate(EXHIBIT).classList.contains("mine"), plate(EXHIBIT).classList.contains("selected")]).toEqual([true, true]);
      expect([...plate(EXHIBIT).querySelector(".plate-tilt").children].slice(0, 2).map(n => n.getAttribute("class"))).toEqual(["plate-sel", "plate-hull"]);
      expect(css).toMatch(/\n\.plate\.selected \.plate-sel \{ stroke: var\(--text\); stroke-width: 7; \}/);
      expect(css).toMatch(/\n\.plate\.mine \.plate-hull \{ stroke: var\(--gold\); stroke-width: 2\.5; \}/);
      expect(css).not.toMatch(/\.plate\.selected[^{]*\{[^}]*--gold/);
    });
  });

  describe("the card under the map", () => {
    it("with nothing selected it is the venue's line: one button, the venue by its key, the day and the reader's picks there, and a chevron no screen reader meets", () => {
      city([IN_BALLROOM, IN_EXHIBIT]); lift("Hyatt");
      const line = el("mapVenue");
      expect([line.tagName, line.getAttribute("type"), line.className, line.dataset.venue]).toEqual(["BUTTON", "button", "next-card venue-line", "Hyatt"]);
      expect([words(line.querySelector(".nc-title")), words(line.querySelector(".nc-when"))]).toEqual(["Hyatt", "Saturday · 2 picks"]);
      expect([words(line.querySelector(".vl-chevron")), line.querySelector(".vl-chevron").getAttribute("aria-hidden")]).toEqual(["›", "true"]);
      expect(line.getAttribute("style")).toBe(block("Hyatt").getAttribute("style"));
      handle.picks.set([IN_EXHIBIT]); handle.render();
      expect(words(el("mapVenue").querySelector(".nc-when"))).toBe("Saturday · 1 pick");
      handle.picks.set([]); handle.render();
      expect(words(el("mapVenue").querySelector(".nc-when"))).toBe("Saturday · no picks");
      city(); lift(MART2);
      expect(words(el("mapVenue").querySelector(".nc-title"))).toBe(MART2);
    });
    it("under it, one quiet line that is no control - and it stands with the venue's line alone", () => {
      city([IN_EXHIBIT]); lift("Hyatt");
      const hint = under().querySelector(".map-hint");
      expect([[...under().children].map(n => n.id || n.className), hint.tagName, words(hint)]).toEqual([["mapVenue", "map-hint"], "P", "Tap a floor for what is on there."]);
      expect([hint.closest("button, a"), hint.querySelector("button, a"), hint.getAttribute("tabindex"), hint.getAttribute("role")]).toEqual([null, null, null, null]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      expect([[...under().children].map(n => n.id), under().querySelector(".map-hint")]).toEqual([["mapPlate"], null]);
      app.showOnMap(IN_EXHIBIT);
      expect([[...under().children].map(n => n.id), under().querySelector(".map-hint")]).toEqual([["mapNext"], null]);
    });
    it("the line counts every pick at the venue that day, the pill's number, so it may be more than the plates' stars: an event known only to its venue is on no plate", () => {
      const onSteps = handle.events.find(e => e.hotel === "Hilton" && e._cd === SAT && !e.level);
      city([onSteps.id]);
      expect(words(svg().querySelector('.map-pill[data-hotel="Hilton"]'))).toBe("1");
      lift("Hilton");
      expect(words(el("mapVenue").querySelector(".nc-when"))).toBe("Saturday · 1 pick");
      expect([plates().filter(p => p.classList.contains("mine")).length, shown()[0].querySelectorAll(".pl-picks").length, lit()]).toEqual([0, 0, []]);
    });
    it("the city map's own are not shown while a stack is open: no next pick's card, no On now line, no off-map line", () => {
      const onNow = handle.events.find(e => e._s <= handle.now() && handle.now() < e._e && e.hotel === "Hilton"), stream = handle.events.find(e => e.hotel === "Streaming" && e._cd === SAT);
      city([onNow.id, IN_EXHIBIT, stream.id]);
      expect([!!el("mapOnNow"), el("mapNext").dataset.hero, words(under().querySelector(".map-offmap"))]).toEqual([true, IN_EXHIBIT, "1 pick streaming or offsite"]);
      lift("Hyatt");
      expect([el("mapOnNow"), el("mapNext"), under().querySelector(".map-offmap"), [...under().children].map(n => n.id || n.className)]).toEqual([null, null, null, ["mapVenue", "map-hint"]]);
      tap(plate("acc").querySelector(".plate-hull"));
      expect([el("mapOnNow"), el("mapNext"), under().querySelector(".map-offmap")]).toEqual([null, null, null]);
      el("mapBack").click();
      expect([!!el("mapOnNow"), el("mapNext").dataset.hero, !!under().querySelector(".map-offmap")]).toEqual([true, IN_EXHIBIT, true]);
    });

    describe("a plate's card", () => {
      it("the venue's short name, small; the plate's name; the day, what is happening and the reader's picks - and a star before the name where a pick is on it that day", () => {
        city([IN_EXHIBIT]); lift("Hyatt");
        tap(plate("acc").querySelector(".plate-hull"));
        const made = el("mapPlate");
        expect([made.tagName, made.className, made.getAttribute("style")]).toEqual(["DIV", "next-card plate-card", block("Hyatt").getAttribute("style")]);
        expect([...made.children].map(n => n.className)).toEqual(["nc-label", "nc-title", "nc-when", "pc-rows"]);
        expect(cardLines()).toEqual(["Hyatt", "Atlanta Conference Center (LL3)", "Saturday · 2 events"]);
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        expect([el("mapPlate").className, cardLines()[2]]).toEqual(["next-card plate-card mine", "Saturday · 9 events · 1 pick"]);
        expect(css).toMatch(/\n\.plate-card\.mine \.nc-title::before, \.pc-row\.mine \.pc-title::before \{ content: "★"; margin-right: \.2em; color: var\(--gold\); \}/);
        city(); lift(MART3);
        tap(plate("f2").querySelector(".plate-hull"));
        expect(cardLines()).toEqual(["Mart 3", "2nd Floor", "Saturday · 3 events"]);
      });
      it("a shared plate is named by its levels' short names, as its label on the stack says them; a plate of one level keeps its full name", () => {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        expect([cardLines()[1], words(label(EXHIBIT))]).toEqual(["Exhibit Level + Intl Tower LL2", "Exhibit Level + Intl Tower LL2"]);
        tap(plate(BALLROOM).querySelector(".plate-hull"));
        expect(cardLines()[1]).toBe("Ballroom Level + Intl Tower LL1");
        tap(plate("acc").querySelector(".plate-hull"));
        expect([cardLines()[1], words(label("acc"))]).toEqual(["Atlanta Conference Center (LL3)", "Conference Center"]);
      });
      it("its title is one line, an ellipsis its net, and the venue's line's too", () => {
        expect(css).toMatch(/\n\.plate-card \.nc-title \{ display: block; white-space: nowrap; text-overflow: ellipsis; \}/);
        expect(css).toMatch(/\n\.next-card \.nc-title \{[^}]*overflow: hidden;/);
        expect(css).toMatch(/\n\.venue-line \.nc-title, \.venue-line \.nc-when \{ display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; \}/);
      });
      it("on the clock's own day, with one thing on now: it, when it ends, and then what is next - one row after it", () => {
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect(rows()).toEqual([["Artemis: Bridge Crew Open Play", "On now · ends 3:00 PM"], ["Artemis: Bridge Crew Open Play", "Next · 4:00–6:00 PM"]]);
        expect([...under().querySelectorAll(".pc-row")].map(r => r.dataset.hero)).toEqual(["s0294", "s0349"]);
        expect([...under().querySelectorAll(".pc-when b")].map(words)).toEqual(["On now", "Next"]);
      });
      it("with more on now, how many more - and the reader's pick first, else the schedule's first", () => {
        const at = handle.now(), atrium = handle.events.filter(e => e.hotel === "Marriott" && e.level === "atrium" && e._cd === SAT);
        const on = atrium.filter(e => e._s <= at && at < e._e), next = atrium.filter(e => e._s > at);
        expect(on.length).toBeGreaterThanOrEqual(2);
        city(); lift("Marriott");
        tap(plate("atrium").querySelector(".plate-hull"));
        const said = e => `On now · ends ${app.fmtShort(e._e)} · ${on.length - 1} more on now · ${e.rooms.join(" + ")}`;
        expect(rows()).toEqual([[on[0].title, said(on[0])], [next[0].title, `Next · ${app.fmtRange(next[0]._s, next[0]._e)} · ${next[0].rooms.join(" + ")}`]]);
        expect(under().querySelector(".pc-row").dataset.hero).toBe(on[0].id);
        handle.picks.set([on[1].id]); handle.render();
        expect([under().querySelector(".pc-row").dataset.hero, rows()[0], under().querySelector(".pc-row").classList.contains("mine")]).toEqual([on[1].id, [on[1].title, said(on[1])], true]);
        expect(rows()).toHaveLength(2);
      });
      it("with nothing on now, what is next and then: two rows, the second Then - or one, where one is left", () => {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        expect(rows()).toEqual([["Deep Dive: Dune Roundtable", "Next · 4:00–5:00 PM · Grand Hall C"], ["Deep Dive: Warhammer 40K", "Then · 4:00–5:00 PM · Grand Hall C"]]);
        tap(plate("acc").querySelector(".plate-hull"));
        expect(rows()).toEqual([["Screening: Alien", "Next · 11:30 PM–12:30 AM · Roswell"]]);
      });
      it("with nothing left today, it says so - under the day's count, which is still the day's", () => {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        handle.setTimeOverride("2026-09-06T03:00");            // 3 AM: still Saturday's night, and its last event ended at 2
        expect([state.map.stack, state.map.plate, app.mapDay()]).toEqual(["Hyatt", EXHIBIT, SAT]);
        expect([rows(), words(under().querySelector(".pc-none")), cardLines()[2]]).toEqual([[], "Nothing more here today.", "Saturday · 9 events"]);
        handle.setTimeOverride(NOW);
      });
      it("on another day, its first two, each with its time - no On now, no Next", () => {
        city(); lift("Hyatt");
        tap(plate("acc").querySelector(".plate-hull"));
        dayChip(SUN).click();
        expect([cardLines()[2], rows()]).toEqual(["Sunday · 2 events", [["Q&A: Dune Roundtable", "8:30–9:30 PM · Roswell"], ["Workshop: Warhammer 40K Uncut", "10:00–11:00 PM · Roswell"]]]);
        expect(under().querySelectorAll(".pc-when b")).toHaveLength(0);
        tap(plate(BALLROOM).querySelector(".plate-hull"));
        expect(rows()).toHaveLength(2);                        // eight that Sunday: two shown
        expect(cardLines()[2]).toBe("Sunday · 8 events");
      });
      it("with none that day: so, and how many are on other days - and nothing more where there are none at all", () => {
        city(); lift("Hyatt");
        tap(plate("acc").querySelector(".plate-hull"));
        dayChip(WED).click();
        expect([cardLines()[2], rows(), words(under().querySelector(".pc-none"))]).toEqual(["Wednesday · no events", [], "Nothing here on Wednesday. 18 events on other days."]);
        city(); lift("Marriott");
        tap(plate("lobby").querySelector(".plate-hull"));       // drawn, so no inert plate, and nothing is ever on it in the sample
        expect([cardLines(), words(under().querySelector(".pc-none"))]).toEqual([["Marriott", "Lobby Level", "Saturday · no events"], "Nothing here on Saturday."]);
      });
      it("one event on other days is said as one", () => {
        const only = SAMPLE.events.filter(e => e.hotel === "Westin" && e.level === "f12")[0];
        app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.filter(e => !(e.hotel === "Westin" && e.level === "f12") || e.id === only.id) });
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        dayChip(app.byId.get(only.id)._cd === WED ? SAT : WED).click();
        expect(words(under().querySelector(".pc-none"))).toMatch(/^Nothing here on (Wednesday|Saturday)\. 1 event on other days\.$/);
        app.replaceSchedule(SAMPLE);
      });
      it("a row says its room where that is more than the floor: its room ids, joined; a Mart vendor hall's booth by the words after its floor; and nothing, with no dot before it, where the room only repeats the floor", () => {
        city(); lift("Hyatt");
        tap(plate(BALLROOM).querySelector(".plate-hull"));
        expect(rows()[0]).toEqual(["Writing Villains Readers Love to Hate", "Next · 2:30–3:30 PM · Centennial II + Centennial III + Centennial IV"]);
        city(); lift(MART2);
        tap(plate("f3").querySelector(".plate-hull"));
        expect([byId("s0298").room, rows()]).toEqual(["Mart2 Vendor Hall Floor 3 Aethon Books booth 3500",
          [["Q&A: Cyberpunk", "Next · 2:30–3:30 PM · Aethon Books booth 3500"], ["Fan Panel: Cyberpunk Roundtable", "Then · 7:00–8:00 PM · Aethon Books booth 3500"]]]);
        city(); lift(MART3);
        tap(plate("f2").querySelector(".plate-hull"));
        expect([byId("s0305").room, rows()]).toEqual(["Mart Building 3, Floor 2", [["Fan Panel: Cosplay Armor 101", "On now · ends 2:00 PM"], ["Deep Dive: Trek Ships", "Next · 10:00–11:00 PM"]]]);
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect([byId("s0294").room, rows().map(r => r[1])]).toEqual(["12th Floor", ["On now · ends 3:00 PM", "Next · 4:00–6:00 PM"]]);
        expect(under().textContent).not.toMatch(/·\s*$/);
      });
      it("what a row says is escaped, its title and its room", () => {
        const odd = SAMPLE.events.find(e => e.id === "s0349");
        app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === odd.id ? { ...e, title: "Bridge <b>Crew</b> & co", rooms: ["A <i>"] } : e)) });
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect([rows()[1], under().querySelector(".pc-row b:not(.pc-when b), .pc-row i")]).toEqual([["Bridge <b>Crew</b> & co", "Next · 4:00–6:00 PM · A <i>"], null]);
        app.replaceSchedule(SAMPLE);
      });
      it("an end names its day only where it is on a later con day: 2 AM is still its own night's, and noon tomorrow is tomorrow's", () => {
        const long = { ...SAMPLE.events.find(e => e.id === "s0294"), id: "x-long", source_id: "x-long", title: "A Day Long", start: "2026-09-05T12:00", end: "2026-09-06T12:00" };
        const late = { ...SAMPLE.events.find(e => e.id === "s0294"), id: "x-late", source_id: "x-late", title: "Until Tomorrow", start: "2026-09-05T15:30", end: "2026-09-06T09:00" };
        app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events.filter(e => !(e.hotel === "Westin" && e.level === "f12" && e.start.startsWith("2026-09-05T1"))), long, late] });
        city([]); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect(rows()).toEqual([["A Day Long", "On now · ends Sun 12:00 PM"], ["Until Tomorrow", "Next · 3:30 PM–Sun 9:00 AM"]]);
        handle.setTimeOverride("2026-09-05T23:45");            // the midnight session: it ends at 2 AM, its own night's
        expect(rows().map(r => r[1])).toEqual(["On now · ends Sun 12:00 PM · 1 more on now", "Next · 12:00–2:00 AM"]);
        handle.picks.set(["s0507"]);                           // the reader's pick is said first: on at half past midnight, over at 2
        handle.setTimeOverride("2026-09-06T00:30");
        expect(rows()).toEqual([["Artemis: Bridge Crew Open Play", "On now · ends 2:00 AM · 2 more on now"]]);
        dayChip(SUN).click();                                  // on Sunday's own card neither long one is listed: each is Saturday's
        expect(rows().map(r => r[0])).not.toContain("A Day Long");
        expect(rows().map(r => r[0])).not.toContain("Until Tomorrow");
        handle.setTimeOverride(NOW);
        app.replaceSchedule(SAMPLE);
      });
      it("and an end at 5 AM sharp is still its own night's: the con day turns there, and the event is over as it does", () => {
        const base = SAMPLE.events.find(e => e.id === "s0294");
        const five = { ...base, id: "x-five", source_id: "x-five", title: "Until Five", start: "2026-09-05T12:00", end: "2026-09-06T05:00" };
        const eight = { ...base, id: "x-eight", source_id: "x-eight", title: "From Eight", start: "2026-09-05T20:00", end: "2026-09-06T05:00" };
        app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events.filter(e => !(e.hotel === "Westin" && e.level === "f12")), five, eight] });
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect(rows()).toEqual([["Until Five", "On now · ends 5:00 AM"], ["From Eight", "Next · 8:00 PM–5:00 AM"]]);
        app.replaceSchedule(SAMPLE);
      });
      it("on now is whatever is running, an event that began on an earlier con day too: counted with the rest, behind the day's own, first where it is the reader's pick - and the row itself where the day has nothing of its own", () => {
        const base = SAMPLE.events.find(e => e.id === "s0294");                                       // the Westin's 12th Floor: on now until 3:00 PM
        const room = { ...base, id: "x-room", source_id: "x-room", title: "The Room That Never Shuts", start: "2026-09-03T10:00", end: "2026-09-07T12:00" };
        app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, room] });
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect([cardLines()[2], rows()]).toEqual(["Saturday · 4 events", [["Artemis: Bridge Crew Open Play", "On now · ends 3:00 PM · 1 more on now"], ["Artemis: Bridge Crew Open Play", "Next · 4:00–6:00 PM"]]]);
        handle.picks.set(["x-room"]); handle.render();
        expect([rows()[0], under().querySelector(".pc-row").classList.contains("mine"), rows()[1][1]]).toEqual([["The Room That Never Shuts", "On now · ends Mon 12:00 PM · 1 more on now"], true, "Next · 4:00–6:00 PM"]);
        expect([cardLines()[2], plate("f12").classList.contains("mine")]).toEqual(["Saturday · 4 events", false]);     // the day's count and its gold edge are the day's own
        const onSaturday = e => e.hotel === "Westin" && e.level === "f12" && e.start >= "2026-09-05T05:00" && e.start < "2026-09-06T05:00";
        app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events.filter(e => !onSaturday(e)), room] });
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        expect([cardLines()[2], rows(), under().querySelector(".pc-none")]).toEqual(["Saturday · no events", [["The Room That Never Shuts", "On now · ends Mon 12:00 PM"]], null]);
        dayChip(SUN).click();                                  // another day's card is that day's own: the room began on Thursday
        expect(rows().map(r => r[0])).not.toContain("The Room That Never Shuts");
        app.replaceSchedule(SAMPLE);
      });
      it("a cancelled event is in no row and no count, lights nothing and edges nothing - though it is the reader's pick", () => {
        const gone = "s0263";                                  // 4:00 PM in Grand Hall C, the Exhibit Level's next
        app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === gone ? { ...e, cancelled: true } : e)) });
        city([gone]); lift("Hyatt");
        expect([words(el("mapVenue").querySelector(".nc-when")), lit(), plate(EXHIBIT).classList.contains("mine"), words(label(EXHIBIT)), plate(EXHIBIT).getAttribute("aria-label")])
          .toEqual(["Saturday · no picks", [], false, "Exhibit Level + Intl Tower LL2", "Exhibit Level (LL2) + International Tower · LL2: no picks on Saturday"]);
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        expect([cardLines()[2], el("mapPlate").classList.contains("mine"), rows().map(r => r[0])]).toEqual(["Saturday · 8 events", false, ["Deep Dive: Warhammer 40K", "Fan Panel: Cosplay Armor 101 Retrospective"]]);
        dayChip(WED).click();
        const live = handle.events.filter(e => e.hotel === "Hyatt" && e.level === "exhibit" && !e.cancelled).length;
        expect(words(under().querySelector(".pc-none"))).toBe(`Nothing here on Wednesday. ${live} events on other days.`);
        expect(live).toBe(34);
        app.replaceSchedule(SAMPLE);
      });
      it("a shared plate lists both its levels' events as one, in the schedule's order, and counts both", () => {
        const inTower = { ...SAMPLE.events.find(e => e.id === "s0263"), id: "x-tower", source_id: "x-tower", title: "Tower Talk", start: "2026-09-05T14:00", end: "2026-09-05T15:00", level: "tower-ll2", rooms: ["Embassy A", "Embassy B"], room: "Embassy AB" };
        app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, inTower] });
        city(["x-tower"]); lift("Hyatt");
        expect([words(label(EXHIBIT)), lit()]).toEqual(["Exhibit Level + Intl Tower LL2 ★ 1", ["tower-ll2|Embassy A", "tower-ll2|Embassy B"]]);
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        expect([cardLines()[2], rows()]).toEqual(["Saturday · 10 events · 1 pick", [["Tower Talk", "Next · 2:00–3:00 PM · Embassy A + Embassy B"], ["Deep Dive: Dune Roundtable", "Then · 4:00–5:00 PM · Grand Hall C"]]]);
        app.replaceSchedule(SAMPLE);
      });
    });

    describe("a row, and the venue's line, each to its sheet and back", () => {
      it("a row is a button, 46 px or more by the stylesheet, and opens its event's sheet; closing it comes back to the stack, the plate still selected, keyboard focus on the row", () => {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        const row = under().querySelector(".pc-row");
        expect([row.tagName, row.getAttribute("type"), row.closest("li").parentNode.className]).toEqual(["BUTTON", "button", "pc-rows"]);
        expect(css).toMatch(/\n\.pc-row \{[^}]*min-height: 46px;/);
        row.focus();
        row.click();
        expect([el("sheetWrap").hidden, el("panel-event").hidden, state.sheetId, words(el("sheetTitleEvent"))]).toEqual([false, false, IN_EXHIBIT, "Deep Dive: Dune Roundtable"]);
        el("closeSheetEvent").click();
        expect([el("sheetWrap").hidden, state.tab, state.map.stack, state.map.plate, plate(EXHIBIT).classList.contains("selected")]).toEqual([true, "map", "Hyatt", EXHIBIT, true]);
        expect([document.activeElement === under().querySelector(".pc-row"), document.activeElement.dataset.hero]).toEqual([true, IN_EXHIBIT]);
        expect(app.focusKey(under().querySelector(".pc-row"))).toBe(`[data-hero="${IN_EXHIBIT}"]`);
      });
      it("the venue's line opens the hotel sheet, as built, on the Map's day; closing it comes back to the stack, keyboard focus on the line", () => {
        city([IN_EXHIBIT]); lift("Hyatt");
        dayChip(SUN).click();
        el("mapVenue").focus();
        el("mapVenue").click();
        expect([el("sheetWrap").hidden, el("panel-hotel").hidden, state.sheetHotel, words(el("sheetTitleHotel")), words(el("panel-hotel").querySelector(".ev-when"))]).toEqual([false, false, "Hyatt", "Hyatt", "Sunday · no picks"]);
        el("closeSheetHotel").click();
        expect([el("sheetWrap").hidden, state.map.stack, state.map.day, document.activeElement === el("mapVenue")]).toEqual([true, "Hyatt", SUN, true]);
        expect(app.focusKey(el("mapVenue"))).toBe("#mapVenue");
      });
      it("an event opened from the hotel sheet the line opened closes back to the stack too, focus on the line: two sheets later", () => {
        city([IN_EXHIBIT]); lift("Hyatt");
        el("mapVenue").focus();
        el("mapVenue").click();
        el("panel-hotel").querySelector(".row .row-main").click();
        expect([state.sheetId, el("panel-event").hidden]).toEqual([IN_EXHIBIT, false]);
        handle.closeSheet();
        expect([el("sheetWrap").hidden, state.map.stack, document.activeElement === el("mapVenue")]).toEqual([true, "Hyatt", true]);
      });
      it("a row that had keyboard focus and has left the card hands it on, and does not drop it to the page: to the card's first row, and with no row left to the plate the card is about", () => {
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        under().querySelector('.pc-row[data-hero="s0294"]').focus();                                  // on now, until 3:00 PM
        handle.setTimeOverride("2026-09-05T15:00");            // it is over, and its row gone
        expect([under().querySelector('.pc-row[data-hero="s0294"]'), document.activeElement === under().querySelector(".pc-row"), document.activeElement.dataset.hero]).toEqual([null, true, "s0349"]);
        handle.setTimeOverride("2026-09-06T04:00");            // the night's last is over: no row is left
        expect([under().querySelectorAll(".pc-row").length, words(under().querySelector(".pc-none")), document.activeElement === plate("f12")]).toEqual([0, "Nothing more here today.", true]);
        handle.setTimeOverride(NOW);
      });
      it("and so at a sheet's close: opened from a row whose event has since left the card, focus goes to the card's first row", () => {
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        const on = under().querySelector('.pc-row[data-hero="s0294"]');
        on.focus();
        on.click();
        expect([state.sheetId, el("sheetWrap").hidden]).toEqual(["s0294", false]);
        handle.setTimeOverride("2026-09-05T15:00");
        handle.closeSheet();
        expect([el("sheetWrap").hidden, state.map.plate, document.activeElement === under().querySelector(".pc-row"), document.activeElement.dataset.hero]).toEqual([true, "f12", true, "s0349"]);
        handle.setTimeOverride(NOW);
      });
      it("a row that has keyboard focus keeps it through a draw that writes the card again", () => {
        city(); lift("Westin");
        tap(plate("f12").querySelector(".plate-hull"));
        const next = [...under().querySelectorAll(".pc-row")].find(r => r.dataset.hero === "s0349");
        next.focus();
        handle.picks.set(["s0294"]); handle.render();          // the row above takes a star: the card is written again, and both rows are still in it
        expect([rows().length, under().querySelector(".pc-row").classList.contains("mine"), document.activeElement.dataset.hero, document.activeElement === under().querySelectorAll(".pc-row")[1]]).toEqual([2, true, "s0349", true]);
        app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === "s0294" ? { ...e, title: "Open Play, Renamed" } : e)) });
        handle.render();                                       // the row above changes its words alone: the card's rows are new nodes, and focus is on the second still - not handed to the first
        expect([rows().map(r => r[0]), document.activeElement.dataset.hero, document.activeElement === under().querySelectorAll(".pc-row")[1]]).toEqual([["Open Play, Renamed", "Artemis: Bridge Crew Open Play"], "s0349", true]);
        app.replaceSchedule(SAMPLE);
        handle.render();
        handle.setTimeOverride("2026-09-05T15:05");            // the first is over: the row that had focus is the first row now
        expect([rows()[0], document.activeElement.dataset.hero, document.activeElement.closest("#mapPlate") === el("mapPlate")]).toEqual([["Artemis: Bridge Crew Open Play", "Next · 4:00–6:00 PM"], "s0349", true]);
        handle.setTimeOverride(NOW);
      });
    });
  });

  describe("the way back", () => {
    const gone = hotel => [open(), [state.map.stack, state.map.plate, state.map.focus], document.activeElement === block(hotel), group(hotel).hasAttribute("hidden")];
    const GONE = [CLOSED, [null, null, null], true, true];
    const staged = () => { city([IN_EXHIBIT]); app.showOnMap(IN_EXHIBIT); expect([state.map.stack, state.map.plate, state.map.focus]).toEqual(["Hyatt", EXHIBIT, IN_EXHIBIT]); };

    it("one control at the frame's top left: a button before the drawing, ← Map, named Back to the map, hidden while no stack is open", () => {
      const back = el("mapBack");
      expect([back.tagName, back.getAttribute("type"), back.className, words(back), back.getAttribute("aria-label"), back.hidden]).toEqual(["BUTTON", "button", "map-back", "← Map", "Back to the map", true]);
      expect([back.parentNode.className, back.nextElementSibling === svg(), svg().nextElementSibling === under()]).toEqual(["map-wrap", true, true]);
      lift("Hyatt");
      expect([el("mapBack") === back, back.hidden, view().querySelector(".map-wrap").getAttribute("data-stack")]).toEqual([true, false, "Hyatt"]);
      expect(css).toMatch(/\n\.map-back \{ position: absolute; left: 20px; top: 18px; z-index: 1; height: 44px; min-width: 44px;/);
      expect(css).toMatch(/\n\.map-wrap \{ position: relative; /);
    });
    it("the control closes the stack, clears the selection, ends the focus and puts keyboard focus on the venue's block", () => {
      staged();
      el("mapBack").click();
      expect(gone("Hyatt")).toEqual(GONE);
      expect([view().querySelector(".map-wrap").hasAttribute("data-stack"), svg().querySelector(".map-focus")]).toEqual([false, null]);
    });
    it("a stack put away keeps no selection: no plate in the page says it is pressed, and the tick that would write it again writes nothing", () => {
      staged();
      expect([plate(EXHIBIT).classList.contains("selected"), plate(EXHIBIT).getAttribute("aria-pressed")]).toEqual([true, "true"]);
      el("mapBack").click();
      expect([svg().querySelectorAll(".plate.selected").length, svg().querySelectorAll('.plate[aria-pressed="true"]').length]).toEqual([0, 0]);
      expect(group("Hyatt").querySelectorAll('.plate[aria-pressed="false"]')).toHaveLength(3);          // its three buttons, each still saying so
      expect(app.tickMap()).toBe(false);
    });
    it("and its plates leave the tab order, since WebKit walks Tab through a button it does not draw; opened again, they are back in it - whichever stack is open, only its own plates take Tab", () => {
      const tabbed = () => [...svg().querySelectorAll('.plate[tabindex="0"]')].map(p => `${p.closest(".map-stack").dataset.hotel}|${p.dataset.plate}`);
      city(); lift("Hyatt");
      expect(tabbed()).toEqual(["Hyatt|acc", `Hyatt|${EXHIBIT}`, `Hyatt|${BALLROOM}`]);
      el("mapBack").click();
      expect([tabbed(), [...group("Hyatt").querySelectorAll(".plate")].map(p => p.getAttribute("tabindex"))]).toEqual([[], ["-1", "-1", "-1", null]]);
      expect(app.tickMap()).toBe(false);
      lift("Westin");
      expect(tabbed()).toEqual(["Westin|f6", "Westin|f7", "Westin|f8", "Westin|f12"]);
      el("mapBack").click();
      lift("Hyatt");
      expect(tabbed()).toEqual(["Hyatt|acc", `Hyatt|${EXHIBIT}`, `Hyatt|${BALLROOM}`]);
      expect(app.tickMap()).toBe(false);
    });
    it("so does a tap inside the frame on anything but a plate or the control: the ground, a street, another venue's block, a pill left under the stack, the frame itself", () => {
      for (const at of [".map-ground", ".map-street", '.map-hotel[data-hotel="Marriott"] rect', '.map-hotel[data-hotel="Hyatt"] text', ".map-pill rect", null]) {
        staged();
        tap(at ? svg().querySelector(at) : svg());
        expect(gone("Hyatt"), String(at)).toEqual(GONE);
        expect(el("sheetWrap").hidden).toBe(true);
      }
    });
    it("and so does Escape, with no sheet open - wherever keyboard focus is", () => {
      for (const from of [() => document.body, () => plate("acc"), () => el("mapBack"), () => dayChip(SAT)]) {
        staged();
        expect(press(from(), "Escape")).toBe(true);
        expect(gone("Hyatt")).toEqual(GONE);
      }
    });
    it("Escape under an open sheet closes the sheet and leaves the stack, its selection with it; a second Escape goes back", () => {
      for (const sheet of [() => under().querySelector(".pc-row").click(), () => handle.openSheet("hotel", "Hyatt"), () => handle.openSheet("settings")]) {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(".plate-hull"));
        sheet();
        expect(el("sheetWrap").hidden).toBe(false);
        press(document.activeElement, "Escape");
        expect([el("sheetWrap").hidden, state.map.stack, state.map.plate, open()[3]]).toEqual([true, "Hyatt", EXHIBIT, false]);
        press(document.activeElement, "Escape");
        expect(open()).toEqual(CLOSED);
      }
    });
    it("a held Escape is one press: under an open sheet it closes the sheet, and its repeats leave the stack standing, untaken", () => {
      city(); lift("Hyatt");
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      handle.openSheet("hotel", "Hyatt");
      press(document.activeElement, "Escape");
      const repeat = new KeyboardEvent("keydown", { key: "Escape", repeat: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(repeat);
      expect([el("sheetWrap").hidden, repeat.defaultPrevented, open(), state.map.plate]).toEqual([true, false, ["Hyatt", "Hyatt", "Hyatt", false], EXHIBIT]);
      expect([press(document.body, "Escape"), open()]).toEqual([true, CLOSED]);                       // the next press goes back
    });
    it("Escape with no stack open, or on another tab, is not the Map's: nothing is taken and nothing changes", () => {
      expect([press(document.body, "Escape"), open()]).toEqual([false, CLOSED]);
      lift("Hyatt");
      navTo("browse");
      expect([press(document.body, "Escape"), state.map.stack]).toEqual([false, "Hyatt"]);
      expect(press(document.body, "Enter")).toBe(false);
    });
    it("a tap outside the frame is no way back: a day chip and the strip it is in, the slot under the map and its hint, the Map's own tab", () => {
      lift("Hyatt");
      dayChip(SUN).click();
      expect([state.map.day, open()]).toEqual([SUN, ["Hyatt", "Hyatt", "Hyatt", false]]);
      tap(view().querySelector(".controls"));
      tap(under());
      tap(under().querySelector(".map-hint"));
      navTo("map");
      expect([state.tab, open(), el("sheetWrap").hidden]).toEqual(["map", ["Hyatt", "Hyatt", "Hyatt", false], true]);
    });
    it("closeStack() with none open does nothing", () => {
      block("Hilton").focus();
      app.closeStack();
      expect([open(), document.activeElement === block("Hilton")]).toEqual([CLOSED, true]);
    });
  });

  describe("the Map's focus, and what ends it", () => {
    const onSteps = () => handle.events.find(e => e.hotel === "Hilton" && e._cd === SAT && !e.level && e._s > handle.now());

    it("a block's tap ends it: it changes what the Map shows", () => {
      const flat = onSteps();
      city(); app.showOnMap(flat.id);
      expect([state.map.focus, state.map.stack, svg().querySelector(".map-focus").dataset.hotel]).toEqual([flat.id, null, "Hilton"]);
      lift("Hilton");
      expect([state.map.focus, state.map.stack, svg().querySelector(".map-focus"), !!el("mapVenue")]).toEqual([null, "Hilton", null, true]);
      city(); app.showOnMap(flat.id);
      press(block("Marriott"), "Enter");
      expect([state.map.focus, state.map.stack]).toEqual([null, "Marriott"]);
    });
    it("the park's sheet does not: a sheet over the Map leaves the focus, as it always has", () => {
      const flat = onSteps();
      city(); app.showOnMap(flat.id);
      tap(block(PARK).querySelector("rect"));
      expect([el("sheetWrap").hidden, state.sheetHotel, state.map.focus]).toEqual([false, PARK, flat.id]);
      handle.closeSheet();
      expect([state.map.focus, svg().querySelector(".map-focus").dataset.hotel]).toEqual([flat.id, "Hilton"]);
    });
    it("while it is held, a tap on any plate ends it and leaves that plate selected - the selected one too", () => {
      city(); app.showOnMap(IN_EXHIBIT);
      expect([state.map.focus, state.map.plate, el("mapNext").dataset.hero]).toEqual([IN_EXHIBIT, EXHIBIT, IN_EXHIBIT]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));       // the selected one: the reader asked for the plate
      expect([state.map.focus, state.map.plate, el("mapNext"), el("mapPlate").dataset.plate]).toEqual([null, EXHIBIT, null, EXHIBIT]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));       // and with no focus held, the same tap clears it
      expect(state.map.plate).toBe(null);
      city(); app.showOnMap(IN_EXHIBIT);
      tap(plate("acc").querySelector(".plate-hull"));         // another plate: selected, the focus gone
      expect([state.map.focus, state.map.plate, el("mapPlate").dataset.plate]).toEqual([null, "acc", "acc"]);
      city(); app.showOnMap(IN_EXHIBIT);
      press(plate(EXHIBIT), "Enter");
      expect([state.map.focus, state.map.plate]).toEqual([null, EXHIBIT]);
    });
    it("a day chip ends it and keeps the stack and the selection; the Map is then on the day the chip chose", () => {
      const sunday = handle.events.find(e => e.hotel === "Hyatt" && e.level === "acc" && e._cd === SUN);
      city(); app.showOnMap(sunday.id);
      expect([app.mapDay(), state.map.day]).toEqual([SUN, null]);
      dayChip(SAT).click();
      expect([state.map.focus, state.map.stack, state.map.plate, app.mapDay(), el("mapNext"), el("mapPlate").dataset.plate]).toEqual([null, "Hyatt", "acc", SAT, null, "acc"]);
    });
    it("a plate's tap that ends it puts the Map back on the day it had: the focus wrote none", () => {
      const sunday = handle.events.find(e => e.hotel === "Hyatt" && e.level === "acc" && e._cd === SUN);
      city(); app.showOnMap(sunday.id);
      expect(cardDay()).toBe(SUN);
      tap(plate(BALLROOM).querySelector(".plate-hull"));
      expect([state.map.focus, state.map.day, cardDay(), cardLines()[2]]).toEqual([null, null, SAT, "Saturday · 10 events"]);
    });
    const cardDay = () => view().querySelector(".map-wrap").dataset.day;
  });

  describe("arriving from an event's place line, as deep as its place goes", () => {
    const depth = id => app.depthOf(byId(id));
    const arrived = () => [state.tab, state.map.focus, state.map.stack, state.map.plate];

    it("a room: its venue's stack, its plate selected, the focus held, the card showing the event - its level on it - and keyboard focus on the card", () => {
      expect(depth(IN_EXHIBIT)).toMatchObject({ depth: "room", plate: EXHIBIT, level: "exhibit" });
      state.tab = "browse"; handle.render();
      app.showOnMap(IN_EXHIBIT);
      expect(arrived()).toEqual(["map", IN_EXHIBIT, "Hyatt", EXHIBIT]);
      expect([open(), plate(EXHIBIT).classList.contains("selected"), plate(EXHIBIT).getAttribute("aria-pressed")]).toEqual([["Hyatt", "Hyatt", "Hyatt", false], true, "true"]);
      expect([...under().children].map(n => n.id)).toEqual(["mapNext"]);
      expect([...el("mapNext").children].map(words)).toEqual(["You were looking at", "Deep Dive: Dune Roundtable", "Hyatt · Grand Hall C · Exhibit Level", "Saturday 4:00–5:00 PM"]);
      expect(document.activeElement).toBe(el("mapNext"));
      expect([svg().querySelector(".map-focus"), svg().querySelector(".map-layer-focus").children.length]).toEqual([null, 0]);   // the ring is the city map's
    });
    it("a level - a drawn level, and no room the drawing has: the same, its plate selected", () => {
      const ev = handle.events.find(e => e.hotel === "Marriott" && e.level === "marquis" && !e.rooms.length && e._cd === SAT);
      expect(depth(ev.id)).toMatchObject({ depth: "level", plate: "marquis" });
      app.showOnMap(ev.id);
      expect([arrived(), el("mapNext").dataset.hero, plate("marquis").classList.contains("selected")]).toEqual([["map", ev.id, "Marriott", "marquis"], ev.id, true]);
    });
    it("a floor - a level with no drawing: the same, the dashed plate selected", () => {
      expect(depth("s0349")).toMatchObject({ depth: "floor", plate: "f12" });
      app.showOnMap("s0349");
      expect([arrived(), plate("f12").getAttribute("class"), el("mapNext").dataset.hero]).toEqual([["map", "s0349", "Westin", "f12"], "plate floor selected", "s0349"]);
      app.showOnMap("s0305");                                // and from one venue's stack to another's
      expect([arrived(), open()]).toEqual([["map", "s0305", MART3, "f2"], [MART3, MART3, MART3, false]]);
    });
    it("the venue - a venue with a building, and an event with no level: the city map, the focus's ring on its block, as built, and no stack", () => {
      const flat = handle.events.find(e => e.hotel === "Hilton" && e._cd === SAT && !e.level);
      expect(depth(flat.id)).toEqual({ depth: "venue" });
      app.showOnMap(flat.id);
      expect([arrived(), open(), svg().querySelector(".map-focus").dataset.hotel, el("mapNext").dataset.hero, document.activeElement === el("mapNext")]).toEqual([["map", flat.id, null, null], CLOSED, "Hilton", flat.id, true]);
      lift("Hyatt");
      tap(plate("acc").querySelector(".plate-hull"));
      app.showOnMap(flat.id);                                // from an open stack too: the city map
      expect([arrived(), open(), svg().querySelector(".map-focus").dataset.hotel]).toEqual([["map", flat.id, null, null], CLOSED, "Hilton"]);
    });
    it("nothing - the park, which has no building: the city map, the ring on its block", () => {
      const inPark = handle.events.find(e => e.hotel === PARK && e._cd === SAT);
      expect(depth(inPark.id)).toEqual({ depth: "nothing" });
      app.showOnMap(inPark.id);
      expect([arrived(), open(), svg().querySelector(".map-focus").dataset.hotel]).toEqual([["map", inPark.id, null, null], CLOSED, PARK]);
    });
    it("an event the Map cannot show arrives nowhere, and leaves an open stack as it was", () => {
      lift("Hyatt");
      tap(plate("acc").querySelector(".plate-hull"));
      const stream = handle.events.find(e => e.hotel === "Streaming");
      for (const id of [stream.id, "no-such-event", undefined]) { app.showOnMap(id); expect([state.map.focus, state.map.stack, state.map.plate], String(id)).toEqual([null, "Hyatt", "acc"]); }
    });
    it("the focused card's tap opens the event's sheet, and its close comes back to the stack with the focus still held", () => {
      app.showOnMap(IN_EXHIBIT);
      el("mapNext").click();
      expect(state.sheetId).toBe(IN_EXHIBIT);
      el("closeSheetEvent").click();
      expect([state.map.focus, state.map.stack, state.map.plate, document.activeElement === el("mapNext")]).toEqual([IN_EXHIBIT, "Hyatt", EXHIBIT, true]);
    });
  });

  describe("what is kept, and what is not", () => {
    it("the Map tab left and come back to: the stack and the selection kept, the focus gone", () => {
      for (const leave of [() => navTo("browse"), () => { state.tab = "plans"; handle.render(); }, () => app.openExplorePage("track", handle.events[0].tracks[0])]) {
        city(); app.showOnMap(IN_EXHIBIT);
        leave();
        expect([state.tab === "map", state.map.focus, state.map.stack, state.map.plate]).toEqual([false, null, "Hyatt", EXHIBIT]);
        navTo("map");
        expect([open(), plate(EXHIBIT).classList.contains("selected"), el("mapNext"), el("mapPlate").dataset.plate]).toEqual([["Hyatt", "Hyatt", "Hyatt", false], true, null, EXHIBIT]);
        state.explore.page = null; app.setExploreHash(null);
      }
    });
    it("the hotel sheet's search leaves the tab from a stack, and the stack is there on the way back", () => {
      city(); lift("Westin");
      el("mapVenue").click();
      el("panel-hotel").querySelector('[data-act="map-search"]').click();
      expect([state.tab, state.browse.hotel, state.map.stack]).toEqual(["browse", "Westin", "Westin"]);
      Object.assign(state.browse, { hotel: "All", day: null });
      navTo("map");
      expect(open()).toEqual(["Westin", "Westin", "Westin", false]);
    });
    it("a new moment on the clock keeps both, and ends the focus", () => {
      city(); app.showOnMap(IN_EXHIBIT);
      handle.setTimeOverride("2026-09-05T13:10");
      expect([state.map.focus, state.map.stack, state.map.plate, open()]).toEqual([null, "Hyatt", EXHIBIT, ["Hyatt", "Hyatt", "Hyatt", false]]);
      handle.setTimeOverride(NOW);
    });
  });

  describe("whatever the clock says", () => {
    afterAll(() => handle.setTimeOverride(NOW));

    it("after the con, where the city map has no card, a stack has its own: the venue's line, and a plate's with the day's first two - the first full day's, the Map's day outside the con", () => {
      handle.setTimeOverride("2026-09-08T12:00");
      expect([app.conPhase(), under().children.length, app.mapDay()]).toEqual(["ended", 0, "2026-09-03"]);
      lift("Hyatt");
      expect([[...under().children].map(n => n.id || n.className), words(el("mapVenue").querySelector(".nc-when"))]).toEqual([["mapVenue", "map-hint"], "Thursday · no picks"]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      const thursday = handle.events.filter(e => e.hotel === "Hyatt" && e.level === "exhibit" && e._cd === "2026-09-03");
      expect([cardLines()[2], rows()]).toEqual(["Thursday · 4 events", thursday.slice(0, 2).map(e => [e.title, `${app.fmtRange(e._s, e._e)} · ${e.rooms.join(" + ")}`])]);
      el("mapBack").click();
      expect(under().children.length).toBe(0);
    });
    it("before the con, where the city map says how to get a pick, the same", () => {
      handle.setTimeOverride("2026-08-20T10:00");
      expect([app.conPhase(), !!under().querySelector(".next-card.empty")]).toEqual(["before", true]);
      lift("Westin");
      expect([...under().children].map(n => n.id || n.className)).toEqual(["mapVenue", "map-hint"]);
      tap(plate("f12").querySelector(".plate-hull"));
      expect([cardLines(), rows().length, under().querySelectorAll(".pc-when b").length]).toEqual([["Westin", "12th Floor", "Thursday · 2 events"], 2, 0]);
    });
  });

  describe("built once, drawn in place", () => {
    it("a venue's group is built at its first open and found afterwards: none before, the same node at every later open, and the others' kept beside it, hidden", () => {
      const mine = groups().length;                          // whatever the tests above opened: this page's own
      const first = (lift("Courtland Grand"), group("Courtland Grand"));
      expect([!!first, first.hasAttribute("hidden"), first.parentNode === svg().querySelector(".map-stacks")]).toEqual([true, false, true]);
      el("mapBack").click();
      expect([group("Courtland Grand") === first, first.hasAttribute("hidden")]).toEqual([true, true]);
      lift("Hilton");
      expect([group("Courtland Grand") === first, first.hasAttribute("hidden"), shown().map(g => g.dataset.hotel)]).toEqual([true, true, ["Hilton"]]);
      el("mapBack").click();
      const made = mutationsDuring(svg().querySelector(".map-stacks"), () => lift("Courtland Grand"));
      expect([group("Courtland Grand") === first, first.hasAttribute("hidden"), made.filter(m => m.type === "childList").length]).toEqual([true, false, 0]);
      expect(groups().length).toBeGreaterThanOrEqual(Math.max(mine, 2));
      expect(new Set(groups().map(g => g.dataset.hotel)).size).toBe(groups().length);
    });
    it("a fresh page has built none: the stacks' group is empty until a venue is opened", async () => {
      await page.cleanup();
      page = await bootPage();
      ({ app, handle } = page);
      state = handle.state;
      navTo("map");
      expect([svg().querySelector(".map-stacks").children.length, svg().querySelectorAll(".plate").length]).toEqual([0, 0]);
      lift("Hyatt");
      expect([groups().map(g => g.dataset.hotel), svg().querySelectorAll(".plate").length]).toEqual([["Hyatt"], 4]);
    }, 30000);
    it("two quiet ticks write nothing, with the venue's line, with a plate's card and with the focus held - and the tick says so", () => {
      for (const stage of [() => { city([IN_EXHIBIT]); lift("Hyatt"); }, () => { city([IN_EXHIBIT]); lift("Hyatt"); tap(plate(EXHIBIT).querySelector(".plate-hull")); }, () => { city(); app.showOnMap(IN_EXHIBIT); }]) {
        stage();
        let results;
        expect(mutationsDuring(view(), () => { results = [app.tickMap(), app.tickMap()]; })).toHaveLength(0);
        expect(results).toEqual([false, false]);
      }
    });
    it("a minute that changes nothing a plate's card says writes nothing; one that changes a row writes it, and the tick says so", () => {
      city(); lift("Westin");
      tap(plate("f12").querySelector(".plate-hull"));
      const node = el("mapPlate"), stack = shown()[0];
      app.setOverride("2026-09-05T13:06");                   // a minute on: the same thing is on, and ends when it did
      let ticked;
      expect(mutationsDuring(view(), () => { ticked = app.tickMap(); })).toHaveLength(0);
      expect(ticked).toBe(false);
      app.setOverride("2026-09-05T15:00");                   // it is over: the rows move up
      const seen = mutationsDuring(view(), () => { ticked = app.tickMap(); });
      expect([ticked, seen.length > 0, rows()]).toEqual([true, true, [["Artemis: Bridge Crew Open Play", "Next · 4:00–6:00 PM"], ["Artemis: Bridge Crew Open Play", "Then · 8:30–10:30 PM"]]]);
      expect([el("mapPlate") === node, shown()[0] === stack, seen.some(m => stack.contains(m.target))]).toEqual([true, true, false]);     // the card in place, and nothing of the stack written
      expect(app.tickMap()).toBe(false);
      app.setOverride(NOW);
    });
    it("a tick that only moves a light says it wrote: one pick put for another on the same plate that day, every count and every word as it was", () => {
      const lights = id => app.dayLights("Hyatt", SAT, new Set([id])).flatMap(row => row.lit.map(at => `${at.level}|${at.id}`)).sort();
      const other = byId("s0347");                           // 4:00 PM in Centennial I: as IN_BALLROOM is, the reader's next, so the city's ring stays where it is
      expect([other.hotel, other.level, other._cd, lights(other.id), lights(IN_BALLROOM)]).toEqual(["Hyatt", "ballroom", SAT, ["ballroom|Centennial I"], ["ballroom|Centennial II", "ballroom|Centennial III", "ballroom|Centennial IV"]]);
      city([IN_BALLROOM]); lift("Hyatt");
      const said = () => [words(el("mapVenue")), plates().map(p => [p.getAttribute("class"), p.getAttribute("aria-label")]), plates().map(p => words(label(p.dataset.plate)))];
      const was = said();
      expect(lit()).toEqual(lights(IN_BALLROOM));
      handle.picks.set([other.id]);                          // with no draw: the next tick's to find
      let ticked;
      const seen = mutationsDuring(view(), () => { ticked = app.tickMap(); });
      expect([ticked, lit(), said()]).toEqual([true, lights(other.id), was]);
      expect(seen.length).toBe(lights(IN_BALLROOM).length + lights(other.id).length);
      expect(seen.every(m => m.type === "attributes" && m.attributeName === "class" && m.target.hasAttribute("data-room"))).toBe(true);
      expect(app.tickMap()).toBe(false);
    });
    it("a stack opened or closed with no draw is drawn at the next tick", () => {
      state.map.stack = "Hilton";
      expect([app.tickMap(), open()]).toEqual([true, ["Hilton", "Hilton", "Hilton", false]]);
      expect(app.tickMap()).toBe(false);
      state.map.stack = null;
      expect([app.tickMap(), open(), app.tickMap()]).toEqual([true, CLOSED, false]);
    });
  });

  describe("a new schedule", () => {
    afterAll(() => app.replaceSchedule(SAMPLE));

    it("that leaves a floor with no event makes its plate inert: the venue's group is built again, the plate no button, and a selection on it cleared", () => {
      city(); lift("Westin");
      tap(plate("f12").querySelector(".plate-hull"));
      const was = shown()[0];
      expect([state.map.plate, kinds()]).toEqual(["f12", ["drawn", "drawn", "drawn", "floor", "inert"]]);
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.filter(e => !(e.hotel === "Westin" && e.level === "f12")) });
      handle.render();
      expect([shown()[0] !== was, was.isConnected, groups().filter(g => g.dataset.hotel === "Westin").length, kinds()]).toEqual([true, false, 1, ["drawn", "drawn", "drawn", "inert", "inert"]]);
      expect([state.map.stack, state.map.plate, plate("f12").getAttribute("role"), plate("f12").getAttribute("tabindex"), plate("f12").getAttribute("aria-label"), el("mapPlate"), !!el("mapVenue")])
        .toEqual(["Westin", null, null, null, null, null, true]);
      expect([words(label("f12")), label("f12").classList.contains("inert")]).toEqual(["12th Floor", true]);
      tap(plate("f12").querySelector(".plate-hull"));
      expect(state.map.plate).toBe(null);
    });
    it("and one that puts an event on an inert plate wakes it: a floor, a button, its day's count on its label - a cancelled event wakes it too, and is not counted", () => {
      const made = cancelled => ({ ...SAMPLE.events.find(e => e.id === "s0294"), id: "x-14", source_id: "x-14", title: "Up on Fourteen", level: "f14", room: "14th Floor", cancelled });
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, made(false)] });
      city(); lift("Westin");
      expect([kinds()[4], plate("f14").getAttribute("role"), words(label("f14")), plate("f14").getAttribute("aria-label")]).toEqual(["floor", "button", "14th Floor · 1 event", "14th Floor: 1 event, no picks on Saturday"]);
      tap(plate("f14").querySelector(".plate-hull"));
      expect([state.map.plate, rows()]).toEqual(["f14", [["Up on Fourteen", "On now · ends 3:00 PM"]]]);
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, made(true)] });
      handle.render();
      expect([kinds()[4], words(label("f14")), state.map.plate, rows(), words(under().querySelector(".pc-none"))]).toEqual(["floor", "14th Floor · no events", "f14", [], "Nothing here on Saturday."]);
    });
    it("one that changes no plate's kind leaves the group as it was: the same node, written in place", () => {
      app.replaceSchedule(SAMPLE);
      city(); lift("Hyatt");
      const was = shown()[0], kept = plates();
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.filter(e => e.id !== "s0263") });
      handle.render();
      expect([shown()[0] === was, plates().every((p, i) => p === kept[i])]).toEqual([true, true]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      expect(cardLines()[2]).toBe("Saturday · 8 events");
    });
  });
});
