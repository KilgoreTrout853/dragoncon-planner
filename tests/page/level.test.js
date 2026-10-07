/* The level (DECISIONS #96; docs/screens/contract.md, section 6): a drawn
   plate of an open stack laid flat in the Map's own frame - what opens it and
   what does not, that it is its plate's own nodes, what is shown and what is
   not, its rooms as buttons, its labels, a tap in it, the zoom on a small
   room, the card under the map in its states, the way back a step at a time,
   arriving from an event's place line, and the draw in place. The page is the
   sample schedule at Saturday 1:05 PM; where the sample lacks a thing - an
   event on a shared plate's second level, a cancelled event in a drawn room,
   an event alone in a large room, one that names a room the drawing lacks - a
   copy of it is handed to replaceSchedule(), as a refresh hands one. The
   layout's numbers are tests/unit/level.test.js's, the stack under it
   tests/page/stack.test.js's, and where a room stands on a screen, and which
   one a finger finds, tests/browser/level.spec.js's: jsdom has no layout and
   no matrix, so here a tap is its target's, or is handed one. New tests, not
   rows of tests/PORT-LEDGER.md. */
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
const EXHIBIT = "exhibit+tower-ll2";
/* The reader's Saturday pick in Grand Hall C, a small room of the Hyatt's
   Exhibit Level, at 4:00 PM; and a photo session booked as International
   Hall South, a composite of seven rooms of the Marriott's. */
const IN_EXHIBIT = "s0263", AS_SOUTH = "s0301";
const SOUTH = ["International 10", "International 9", "International 8", "International 7", "International 6", "International 5", "International 4"];

describe("the level: a drawn plate laid flat, its rooms in place", () => {
  let page, app, handle, state;
  const el = id => document.getElementById(id);
  const view = () => el("view-map");
  const svg = () => view().querySelector("svg.map");
  const words = node => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");
  const block = hotel => svg().querySelector(`.map-hotel[data-hotel="${hotel}"]`);
  const shown = () => [...svg().querySelectorAll(".map-stacks > .map-stack")].filter(g => !g.hasAttribute("hidden"));
  const group = hotel => [...svg().querySelectorAll(".map-stacks > .map-stack")].find(g => g.dataset.hotel === hotel) || null;
  const plates = () => [...shown()[0].querySelectorAll(".plate")];
  const plate = key => plates().find(p => p.dataset.plate === key);
  const laid = () => shown()[0].querySelector(".plate.flat");
  const shapes = () => [...laid().querySelectorAll("[data-room]")];
  const shape = (id, level) => shapes().find(r => r.dataset.room === id && (!level || r.dataset.level === level));
  const under = () => el("mapUnder");
  const card = () => el("mapRoom") || el("mapPlate");
  const rows = () => [...under().querySelectorAll(".pc-row")].map(r => [words(r.querySelector(".pc-title")), words(r.querySelector(".pc-when"))]);
  const cardLines = () => [...card().children].filter(n => !n.matches(".pc-rows, .pc-none")).map(words);
  const dayChip = day => view().querySelector(`[data-chip="map-day"][data-value="${day}"]`);
  const press = (target, key, more = {}) => !target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...more }));   // true where the page took the key
  const navTo = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
  const byId = id => app.byId.get(id);
  const back = () => el("mapBack");
  const frame = () => { const [x, y, w, h] = svg().getAttribute("viewBox").split(" ").map(Number); return { x, y, w, h }; };
  const model = (hotel, key) => app.building(hotel).plates.find(p => p.key === key);
  const place = (hotel, key, id, level) => app.levelPlaces(model(hotel, key)).find(r => r.id === id && (!level || r.level === level));
  /* The camera as the page has it: where a point of the drawing stands in the frame. */
  const cam = () => { const [, tx, ty, scale] = /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/.exec(shown()[0].querySelector(".stack-cam").getAttribute("transform")).map(Number); return { tx, ty, scale }; };
  const sameCam = (got, want) => { expect(got.scale).toBeCloseTo(want.scale, 4); expect(got.tx).toBeCloseTo(want.tx, 2); expect(got.ty).toBeCloseTo(want.ty, 2); };
  /* What the Map holds of the building view. */
  const held = () => [state.map.stack, state.map.plate, state.map.level, state.map.rooms, state.map.zoom && state.map.zoom.id];
  /* The city map at Saturday 1:05 PM, nothing open, with these picks. */
  const city = (ids = []) => {
    handle.closeSheet();
    app.setOverride(NOW);
    state.tab = "map";
    Object.assign(state.map, { day: null, focus: null, stack: null, plate: null, level: null, rooms: null, zoom: null });
    handle.picks.set(ids);
    handle.render();
  };
  const lift = hotel => tap(block(hotel).querySelector("rect"));
  /* A level, by a tap on its venue's block and then on its plate's outline. */
  const level = (hotel, key, ids = []) => { city(ids); lift(hotel); tap(plate(key).querySelector(".plate-hull")); };
  const room = (id, lv) => tap(shape(id, lv));
  const said = () => [words(back()), back().getAttribute("aria-label")];

  beforeAll(async () => {
    page = await bootPage();
    ({ app, handle } = page);
    state = handle.state;
    navTo("map");
  }, 30000);
  afterAll(() => page.cleanup());
  beforeEach(() => city());

  describe("what opens it, and what does not", () => {
    it("a tap on a drawn plate of an open stack opens its level: the plate's key and nothing selected, no plate selected, and keyboard focus on the way back", () => {
      lift("Hyatt");
      plate("acc").focus();
      tap(plate("acc").querySelector(".plate-hull"));
      expect(held()).toEqual(["Hyatt", null, "acc", null, null]);
      expect([svg().getAttribute("data-stack"), svg().getAttribute("data-level"), shown()[0].getAttribute("data-level"), plates().filter(p => p.classList.contains("flat")).map(p => p.dataset.plate)]).toEqual(["Hyatt", "acc", "acc", ["acc"]]);
      expect([document.activeElement === back(), back().hidden, plates().filter(p => p.classList.contains("selected")).length]).toEqual([true, false, 0]);
      expect(el("sheetWrap").hidden).toBe(true);
    });
    it("wherever on the plate the tap lands: its outline, a room on it, an open area, its name", () => {
      for (const part of [".plate-hull", ".plate-room", ".plate-open", ".plate-label"]) {
        city(); lift("Hyatt");
        tap(plate(EXHIBIT).querySelector(part));
        expect(held(), part).toEqual(["Hyatt", null, EXHIBIT, null, null]);
      }
    });
    it("Enter and Space on a drawn plate are its tap, the key taken; a key held down is one press, and opens nothing", () => {
      for (const key of ["Enter", " "]) {
        city(); lift("Hyatt");
        plate("acc").focus();
        expect([press(plate("acc"), key, { repeat: true }), state.map.level]).toEqual([true, null]);
        expect([press(plate("acc"), key), state.map.level, document.activeElement === back()]).toEqual([true, "acc", true]);
      }
    });
    it("a floor with no drawing opens none: its tap selects it, as built, and openLevel() says so - as it does for a key the venue lacks, and with no stack open", () => {
      expect(app.openLevel("acc")).toBe(false);
      lift("Westin");
      tap(plate("f12").querySelector(".plate-hull"));
      expect(held()).toEqual(["Westin", "f12", null, null, null]);
      expect([app.openLevel("f12"), app.openLevel("f14"), app.openLevel("no-such-floor"), state.map.level, state.map.plate]).toEqual([false, false, false, null, "f12"]);
      expect([svg().hasAttribute("data-level"), shown()[0].hasAttribute("data-level"), svg().querySelectorAll(".plate.flat").length]).toEqual([false, false, 0]);
      expect([app.openLevel("f6"), state.map.level, state.map.plate]).toEqual([true, "f6", null]);                      // and a drawn one's clears the floor that was selected
    });
    it("each of the 18 drawn plates opens its own", () => {
      const drawn = app.BUILDINGS.flatMap(hotel => app.building(hotel).plates.filter(p => p.drawn).map(p => [hotel, p.key]));
      expect(drawn).toHaveLength(18);
      for (const [hotel, key] of drawn) {
        level(hotel, key);
        expect([state.map.stack, state.map.level, laid().dataset.plate], `${hotel} ${key}`).toEqual([hotel, key, key]);
      }
    });
    it("a level open in one venue is not carried to the next: the Courtland Grand's second floor is not the Mart's, and another venue's stack opens with none", () => {
      level("Courtland Grand", "f2");
      expect([app.openStack("AmericasMart Building 3"), state.map.stack, state.map.level, state.map.plate, svg().hasAttribute("data-level")]).toEqual([true, "AmericasMart Building 3", null, null, false]);
      level("Courtland Grand", "f2");
      room("Macon");
      expect([app.openStack("Hilton"), held()]).toEqual([true, ["Hilton", null, null, null, null]]);
    });
  });

  describe("the plate's own nodes, laid flat", () => {
    it("the same nodes: the venue's group, its camera, every plate, its tilt and every shape on it are the stack's; nothing is added or taken but the words in the level's own groups", () => {
      city([IN_EXHIBIT]); lift("Hyatt");
      const kept = { group: shown()[0], cam: shown()[0].querySelector(".stack-cam"), plates: plates(), tilts: plates().map(p => p.querySelector(".plate-tilt")), all: [...shown()[0].querySelectorAll(".plate-tilt > *")] };
      const seen = mutationsDuring(svg(), () => tap(plate(EXHIBIT).querySelector(".plate-hull")));
      expect([shown()[0] === kept.group, shown()[0].querySelector(".stack-cam") === kept.cam, plates().every((p, i) => p === kept.plates[i] && p.querySelector(".plate-tilt") === kept.tilts[i]),
        [...shown()[0].querySelectorAll(".plate-tilt > *")].every((n, i) => n === kept.all[i])]).toEqual([true, true, true, true]);
      expect([...new Set(seen.filter(m => m.type === "childList").map(m => m.target.closest(".level-labels, .level-streets, .level-sel") && m.target.closest(".level-labels, .level-streets, .level-sel").getAttribute("class")))]).toEqual(["level-labels", "level-streets"]);
    });
    it("the tilt undone, the lift undone and the camera moved - each the stack's own list of functions, with the values that undo it, and the stack's again after the way back", () => {
      lift("Hyatt");
      const stack = { cam: shown()[0].querySelector(".stack-cam").getAttribute("transform"), tilt: plate(EXHIBIT).querySelector(".plate-tilt").getAttribute("transform"), lift: plate(EXHIBIT).getAttribute("transform") };
      expect([/^translate\(\S+ \S+\) skewX\(-30\) scale\(1 0\.5\) translate\(\S+ \S+\)$/.test(stack.tilt), /^translate\(0 -[\d.]+\)$/.test(stack.lift), plate("acc").hasAttribute("transform")]).toEqual([true, true, false]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      expect(plate(EXHIBIT).querySelector(".plate-tilt").getAttribute("transform")).toBe(stack.tilt.replace("skewX(-30) scale(1 0.5)", "skewX(0) scale(1 1)"));
      expect(plate(EXHIBIT).getAttribute("transform")).toBe("translate(0 0)");
      expect(/^translate\(-?[\d.]+ -?[\d.]+\) scale\([\d.]+\)$/.test(shown()[0].querySelector(".stack-cam").getAttribute("transform"))).toBe(true);
      sameCam(cam(), app.levelFit(model("Hyatt", EXHIBIT), frame()));
      expect(plates().filter(p => p !== plate(EXHIBIT)).map(p => p.querySelector(".plate-tilt").getAttribute("transform"))).toEqual([stack.tilt, stack.tilt, stack.tilt]);      // the others stand as they stood
      back().click();
      expect([shown()[0].querySelector(".stack-cam").getAttribute("transform"), plate(EXHIBIT).querySelector(".plate-tilt").getAttribute("transform"), plate(EXHIBIT).getAttribute("transform")]).toEqual([stack.cam, stack.tilt, stack.lift]);
      tap(plate("acc").querySelector(".plate-hull"));            // the ground plate has no lift to undo
      expect([plate("acc").hasAttribute("transform"), plate("acc").querySelector(".plate-tilt").getAttribute("transform")]).toEqual([false, stack.tilt.replace("skewX(-30) scale(1 0.5)", "skewX(0) scale(1 1)")]);
    });
    it("it stands in the Map's frame as it is - the frame is the stack's and the city's - fitted to its rooms and open areas inside the margins, clear of the way back", () => {
      const was = svg().getAttribute("viewBox");
      level("Hyatt", EXHIBIT);
      expect(svg().getAttribute("viewBox")).toBe(was);
      const f = frame(), m = app.LEVEL_MARGIN, at = cam(), made = model("Hyatt", EXHIBIT);
      const points = [...made.rooms, ...made.open].flatMap(app.corners).map(([x, y]) => [at.tx + at.scale * x, at.ty + at.scale * y]);
      const box = app.bounds(points);
      expect([box.x0 >= f.x + m.l - 0.01, box.x1 <= f.x + f.w - m.r + 0.01, box.y0 >= f.y + m.t - 0.01, box.y1 <= f.y + f.h - m.b + 0.01]).toEqual([true, true, true, true]);
      expect(Math.min(box.x0 - (f.x + m.l), box.y0 - (f.y + m.t))).toBeLessThan(0.01);                 // and as large as they allow: it touches one pair of them
    });
    it("what is not shown stays in the page, hidden by the stylesheet: the other plates, every plate's label and the city behind - and the other plates leave the tab order", () => {
      level("Hyatt", EXHIBIT);
      expect(plates().map(p => [p.dataset.plate, p.classList.contains("flat"), p.getAttribute("tabindex")])).toEqual([["acc", false, "-1"], [EXHIBIT, true, null], ["ballroom+tower-ll1", false, "-1"], ["lobby", false, null]]);
      expect([shown()[0].querySelectorAll(".plate-label").length, svg().querySelector(".map-city").isConnected, svg().querySelectorAll(".map-hotel").length]).toEqual([4, true, 8]);
      expect(css).toMatch(/\n\.map\[data-level\] \.map-city \{ visibility: hidden; \}/);
      expect(css).toMatch(/\n\.map-stack\[data-level\] \.plate:not\(\.flat\), \.map-stack\[data-level\] \.plate-label \{ visibility: hidden; \}/);
      expect(css).not.toMatch(/\[data-level\][^{]*\{[^}]*display: none/);
      back().click();
      expect(plates().map(p => p.getAttribute("tabindex"))).toEqual(["0", "0", "0", null]);
    });
    it("the plate laid flat is a group and no button while its rooms are: none stands inside another; back on the stack it is a button again", () => {
      level("Hyatt", "acc", ["s0303"]);
      expect([laid().getAttribute("role"), laid().getAttribute("tabindex"), laid().getAttribute("aria-pressed"), laid().getAttribute("aria-label")]).toEqual(["group", null, null, "Atlanta Conference Center (LL3): 1 pick on Saturday"]);
      expect(laid().querySelectorAll('[role="button"]').length).toBe(20);
      back().click();
      expect([plate("acc").getAttribute("role"), plate("acc").getAttribute("tabindex"), plate("acc").getAttribute("aria-pressed"), plate("acc").querySelectorAll('[role="button"]').length]).toEqual(["button", "0", "false", 0]);
    });
    it("the venue's group is clipped to the frame while a level is open - the group, which does not move - and not on the stack", () => {
      lift("Hyatt");
      expect(shown()[0].getAttribute("clip-path")).toBe(null);
      tap(plate("acc").querySelector(".plate-hull"));
      expect([shown()[0].getAttribute("clip-path"), !!svg().querySelector("defs clipPath#mapClip rect"), shown()[0].querySelector(".stack-cam").hasAttribute("clip-path")]).toEqual(["url(#mapClip)", true, false]);
      back().click();
      expect(shown()[0].getAttribute("clip-path")).toBe(null);
    });
  });

  describe("its rooms are buttons", () => {
    it("each room and identified open area of the open level: a key can reach it, it says its name, what is on there that day and the reader's picks - no picks at none - and whether it is selected; open floor that is no place is none", () => {
      level("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      const made = model("Hyatt", EXHIBIT);
      expect(shapes().map(r => `${r.dataset.level}|${r.dataset.room}`)).toEqual(app.levelPlaces(made).map(r => `${r.level}|${r.id}`));
      expect(shapes().every(r => r.getAttribute("role") === "button" && r.getAttribute("tabindex") === "0" && r.getAttribute("aria-pressed") === "false")).toBe(true);
      expect([shape("Grand Hall C").getAttribute("aria-label"), shape("Concourse").getAttribute("aria-label"), shape("Grand Hall D").getAttribute("aria-label")])
        .toEqual(["Grand Hall C: 5 events, 1 pick on Saturday", "Concourse: 4 events, no picks on Saturday", "Grand Hall D: no events, no picks on Saturday"]);
      const scenery = [...laid().querySelectorAll(".plate-open:not(.place)")];
      expect([scenery.length > 0, scenery.every(n => !n.hasAttribute("role") && !n.hasAttribute("tabindex") && !n.hasAttribute("aria-label"))]).toEqual([true, true]);
      handle.picks.set([IN_EXHIBIT, "s0332"]); handle.render();
      expect(shape("Grand Hall C").getAttribute("aria-label")).toBe("Grand Hall C: 5 events, 2 picks on Saturday");
    });
    it("one event is said as one", () => {
      const all = app.BUILDINGS.flatMap(hotel => app.building(hotel).plates.filter(p => p.drawn).flatMap(p => app.levelPlaces(p).map(r => [hotel, p.key, r])));
      const [hotel, key, one] = all.find(([h, , r]) => app.roomEvents(h, r.level, r.id).filter(x => x.ev._cd === SAT && !x.ev.cancelled).length === 1);
      level(hotel, key);
      expect(shape(one.id, one.level).getAttribute("aria-label")).toBe(`${one.id}: 1 event, no picks on Saturday`);
    });
    it("the rooms of a level that is not open are in no tab order and are no buttons: none on a stack, none on the plates behind an open level, and none again after the way back", () => {
      const buttons = () => [...shown()[0].querySelectorAll("[data-room]")].filter(r => r.hasAttribute("role") || r.hasAttribute("tabindex") || r.hasAttribute("aria-label") || r.hasAttribute("aria-pressed")).map(r => r.closest(".plate").dataset.plate);
      lift("Hyatt");
      expect(buttons()).toEqual([]);
      tap(plate("acc").querySelector(".plate-hull"));
      expect([[...new Set(buttons())], buttons().length]).toEqual([["acc"], 20]);
      back().click();
      expect(buttons()).toEqual([]);
    });
    it("a shared plate is one level view: both its levels' rooms are its buttons, each counting its own level's events", () => {
      const inTower = { ...SAMPLE.events.find(e => e.id === IN_EXHIBIT), id: "x-tower", source_id: "x-tower", title: "Tower Talk", start: "2026-09-05T14:00", end: "2026-09-05T15:00", level: "tower-ll2", rooms: ["Embassy A", "Embassy B"], room: "Embassy AB" };
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, inTower] });
      level("Hyatt", EXHIBIT, ["x-tower"]);
      expect([...new Set(shapes().map(r => r.dataset.level))]).toEqual(["exhibit", "tower-ll2"]);
      expect([shape("Embassy A", "tower-ll2").getAttribute("aria-label"), shape("Embassy C", "tower-ll2").getAttribute("aria-label"), shape("Embassy A").classList.contains("lit"), shape("Embassy B").classList.contains("lit")])
        .toEqual(["Embassy A: 1 event, 1 pick on Saturday", "Embassy C: no events, no picks on Saturday", true, true]);
      room("Embassy A");
      expect([cardLines(), rows()]).toEqual([["Hyatt · International Tower · LL2", "Embassy A", "Saturday · 1 event · 1 pick"], [["Tower Talk", "Next · 2:00–3:00 PM"]]]);
      app.replaceSchedule(SAMPLE);
    });
  });

  describe("what a level says", () => {
    const labels = () => laid().querySelector(".level-labels");
    const texts = selector => [...labels().querySelectorAll(selector)].map(words);
    it("the labels' group holds level.js's words for the camera's scale: the open areas', the rooms', the groups' and the landmarks, each at its size undone by the camera, a turned room's turned with it", () => {
      level("Hyatt", EXHIBIT);
      const scale = cam().scale, want = app.levelLabels(model("Hyatt", EXHIBIT), app.levelFit(model("Hyatt", EXHIBIT), frame()).scale);
      expect([texts(".lv-open"), texts(".lv-room"), texts(".lv-group"), labels().querySelectorAll(".lv-mark").length]).toEqual([want.open.map(l => l.text), want.rooms.map(l => l.text), want.groups.map(l => l.text), want.landmarks.length]);
      expect(want.rooms.length).toBeGreaterThan(10);
      const sizes = [...labels().querySelectorAll(".lv-room")].map(t => Number(t.getAttribute("font-size")) * scale);
      sizes.forEach((size, i) => expect(size).toBeCloseTo(want.rooms[i].size, 1));
      expect([...labels().querySelectorAll(".lv-room")].map(t => [t.getAttribute("x"), t.getAttribute("y")])).toEqual(want.rooms.map(l => [String(Math.round(l.x * 10) / 10), String(Math.round(l.y * 10) / 10)]));
      expect([...labels().querySelectorAll(".lv-group")].map(t => t.classList.contains("middle"))).toEqual(want.groups.map(l => l.middle));
      expect([labels().getAttribute("aria-hidden"), [...laid().querySelector(".plate-tilt").children].slice(-2).map(n => n.getAttribute("class"))]).toEqual(["true", ["level-sel", "level-labels"]]);
      level("Hilton", "l2");                                  // its wing's rooms stand turned
      const turned = app.levelLabels(model("Hilton", "l2"), cam().scale).rooms;
      expect(turned.some(l => l.rot)).toBe(true);
      expect([...labels().querySelectorAll(".lv-room")].map(t => t.getAttribute("transform"))).toEqual(turned.map(l => (l.rot ? `rotate(${l.rot} ${Math.round(l.x * 10) / 10} ${Math.round(l.y * 10) / 10})` : null)));
    });
    it("on a stack no plate says a level's words: the labels' and the outlines' groups are empty - before a level, on the plates behind one, and after the way back", () => {
      const filled = () => [...shown()[0].querySelectorAll(".level-labels, .level-sel, .level-streets")].filter(g => g.childNodes.length).map(g => `${g.getAttribute("class")}${g.closest(".plate") ? ` ${g.closest(".plate").dataset.plate}` : ""}`);
      lift("Hyatt");
      expect([shown()[0].querySelectorAll(".level-labels").length, shown()[0].querySelectorAll(".level-sel").length, shown()[0].querySelectorAll(".level-streets").length, filled()]).toEqual([3, 3, 1, []]);
      tap(plate(EXHIBIT).querySelector(".plate-hull"));
      room("Grand Hall C");
      back().click();                                        // from the zoom: the streets are back
      expect(filled()).toEqual([`level-sel ${EXHIBIT}`, `level-labels ${EXHIBIT}`, "level-streets"]);
      back().click();
      expect(filled()).toEqual([]);
      city(); lift("AmericasMart Building 3");               // a venue with no drawing has no level's groups at all
      expect(shown()[0].querySelectorAll(".level-labels, .level-sel, .level-streets")).toHaveLength(0);
    });
    it("lit by day: the rooms dayLights() gives for the Map's day and the reader's picks are gold, a composite as its rooms, as on the stack - and a day chip lights them again in place", () => {
      const sunday = handle.events.find(e => e.hotel === "Hyatt" && e.level === "exhibit" && e._cd === SUN && e.rooms.length && !e.rooms.includes("Grand Hall C") && !e.cancelled);
      level("Hyatt", EXHIBIT, [IN_EXHIBIT, sunday.id]);
      const gold = () => shapes().filter(r => r.classList.contains("lit")).map(r => `${r.dataset.level}|${r.dataset.room}`).sort();
      const want = day => app.dayLights("Hyatt", day, handle.picks.get()).flatMap(row => row.lit.map(at => `${at.level}|${at.id}`)).sort();
      expect([gold(), gold()]).toEqual([want(SAT), ["exhibit|Grand Hall C"]]);
      const kept = shapes();
      dayChip(SUN).click();
      expect([gold(), gold().length > 0, gold().includes("exhibit|Grand Hall C"), shapes().every((r, i) => r === kept[i]), state.map.level]).toEqual([want(SUN), true, false, true, EXHIBIT]);
      expect(shape("Grand Hall C").getAttribute("aria-label")).toMatch(/, no picks on Sunday$/);
      level("Marriott", "international", [AS_SOUTH]);        // booked as a composite: each of its rooms is lit
      expect(gold()).toEqual(SOUTH.map(id => `international|${id}`).sort());
    });
    it("a lit room's label, and a lit open area's, is in the gold's ink: the class the stylesheet colours, on what the day lights and no other", () => {
      level("Hyatt", "ballroom+tower-ll1", ["s0347"]);          // Centennial I at 4:00 PM
      const lit = () => [...labels().querySelectorAll(".lit")].map(words);
      expect([shape("Centennial I").classList.contains("lit"), lit().length]).toEqual([true, 1]);
      level("Hyatt", EXHIBIT, ["s0314"]);                       // the Concourse, an open area, at 7:00 PM
      expect([shape("Concourse").classList.contains("lit"), [...labels().querySelectorAll(".lv-open.lit")].map(words), labels().querySelectorAll(".lv-room.lit").length]).toEqual([true, ["Concourse"], 0]);
      handle.picks.set([]); handle.render();
      expect(lit()).toEqual([]);
      expect(css).toMatch(/\n\.lv-room\.lit, \.lv-open\.lit \{ fill: var\(--gold-ink\); font-weight: 700; \}/);
      expect(css).not.toMatch(/\.lv-(mark|group|open|room)[^{]*\{[^}]*var\(--gold\)/);                 // gold is the reader's own: no landmark and no name is gold
    });
    it("landmarks are glyphs by kind, one size on the screen whatever the camera, their names said only from 1.5 units a foot: none at the Hyatt's fit, each once zoomed", () => {
      level("Hyatt", EXHIBIT);
      const marks = () => [...labels().querySelectorAll(".lv-mark")], made = model("Hyatt", EXHIBIT);
      expect(marks().map(g => g.dataset.kind)).toEqual(made.landmarks.map(l => l.kind));
      expect([marks().every(g => g.children.length > 0), labels().querySelectorAll(".lv-mark text").length, cam().scale < 1.5]).toEqual([true, 0, true]);
      marks().forEach(g => expect(Number(/scale\(([\d.]+)\)$/.exec(g.getAttribute("transform"))[1]) * cam().scale).toBeCloseTo(1, 3));
      room("Grand Hall C");
      expect(cam().scale).toBeGreaterThan(1.5);
      expect([...labels().querySelectorAll(".lv-mark text")].map(words)).toEqual(made.landmarks.map(l => l.name));
      marks().forEach(g => expect(Number(/scale\(([\d.]+)\)$/.exec(g.getAttribute("transform"))[1]) * cam().scale).toBeCloseTo(1, 3));
      expect([...new Set(app.BUILDINGS.flatMap(hotel => app.building(hotel).plates.flatMap(p => p.landmarks.map(l => l.kind))))].sort()).toEqual(["bridge", "elevator", "entrance", "escalator", "info"]);
    });
    it("street names stand on the frame's four edges where the drawing has them, in the frame's own units outside the camera - and are not shown while zoomed, nor on the stack", () => {
      level("Hyatt", EXHIBIT);
      const streets = () => [...shown()[0].querySelectorAll(".level-streets text")], f = frame(), m = app.LEVEL_MARGIN, mid = f.y + m.t + (f.h - m.t - m.b) / 2;
      expect(streets().map(t => [t.dataset.side, words(t)])).toEqual(model("Hyatt", EXHIBIT).streets.map(s => [s.side, s.name]));
      expect(streets().map(t => t.dataset.side).sort()).toEqual(["E", "N", "S", "W"]);
      const at = side => streets().find(t => t.dataset.side === side);
      expect([[at("N").getAttribute("x"), at("N").getAttribute("y")], [at("S").getAttribute("x"), at("S").getAttribute("y")], at("W").getAttribute("transform"), at("E").getAttribute("transform")])
        .toEqual([[String(f.x + f.w - 14), String(f.y + 14)], [String(f.x + f.w / 2), String(f.y + f.h - 8)], `translate(${f.x + 13} ${mid}) rotate(-90)`, `translate(${f.x + f.w - 13} ${mid}) rotate(90)`]);
      expect([shown()[0].querySelector(".level-streets").parentNode === shown()[0], shown()[0].querySelector(".level-streets").getAttribute("aria-hidden"), streets().every(t => t.getAttribute("class") === "map-street-label level-street")]).toEqual([true, "true", true]);
      room("Grand Hall C");
      expect([state.map.zoom.id, streets()]).toEqual(["Grand Hall C", []]);
      back().click();
      expect(streets()).toHaveLength(4);
      level("Hilton", "l2");
      expect(streets().map(t => t.dataset.side)).toEqual(["W"]);
      level("Hilton", "l3");
      expect(streets()).toEqual([]);
    });
  });

  describe("a tap in the level", () => {
    const outlines = () => [...laid().querySelectorAll(".level-sel > *")];
    const pressed = () => shapes().filter(r => r.getAttribute("aria-pressed") === "true").map(r => r.dataset.room);
    it("selects the room it lands on: one room, its outline drawn over it, its button pressed, and the card that room's", () => {
      level("Courtland Grand", "f1");
      room("North Capitol Ballroom");
      expect(held()).toEqual(["Courtland Grand", null, "f1", [{ level: "f1", id: "North Capitol Ballroom" }], null]);
      const own = shape("North Capitol Ballroom");
      expect(outlines().map(r => [r.tagName, r.getAttribute("class"), ...["x", "y", "width", "height"].map(a => r.getAttribute(a) === own.getAttribute(a))])).toEqual([["rect", "level-sel-room", true, true, true, true]]);
      expect([pressed(), el("mapRoom").dataset.plate, el("mapPlate"), cardLines()[1]]).toEqual([["North Capitol Ballroom"], "f1", null, "North Capitol Ballroom"]);
      expect(css).toMatch(/\n\.level-sel-room \{ fill: none; stroke: var\(--text\); stroke-width: 2\.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; pointer-events: none; \}/);
    });
    it("another tap moves it - one room at a tap - and a tap on the selected room keeps it", () => {
      level("Courtland Grand", "f1");
      room("North Capitol Ballroom");
      room("Georgia Ballroom");
      expect([state.map.rooms, pressed(), outlines().length, cardLines()[1]]).toEqual([[{ level: "f1", id: "Georgia Ballroom" }], ["Georgia Ballroom"], 1, "Georgia Ballroom"]);
      room("Georgia Ballroom");
      expect([state.map.rooms, pressed()]).toEqual([[{ level: "f1", id: "Georgia Ballroom" }], ["Georgia Ballroom"]]);
    });
    it("a tap off every room clears the selection and goes nowhere: the plate's own outline, open floor that is no place, the ground, the frame - the level stays, and the card is its plate's again", () => {
      for (const at of [() => laid().querySelector(".plate-hull"), () => laid().querySelector(".plate-open:not(.place)"), () => svg().querySelector(".map-ground"), () => svg()]) {
        level("Courtland Grand", "f1");
        room("North Capitol Ballroom");
        tap(at());
        expect([held(), outlines().length, pressed(), el("mapRoom"), el("mapPlate").dataset.plate, back().hidden]).toEqual([["Courtland Grand", null, "f1", null, null], 0, [], null, "f1", false]);
      }
    });
    it("a turned room's outline is turned with it", () => {
      level("Hilton", "l2");
      room("205");
      expect([outlines()[0].getAttribute("transform"), outlines()[0].getAttribute("transform") === shape("205").getAttribute("transform")]).toEqual([expect.stringMatching(/^rotate\(-?\d+ /), true]);
    });
    it("a room's name, its outline and a landmark take no pointer, so a tap on them is the room's under them (the stylesheet's)", () => {
      expect(css).toMatch(/\n\.level-labels \{ pointer-events: none; \}/);
      expect(css).toMatch(/\n\.level-sel-room \{[^}]*pointer-events: none;/);
      expect(css).toMatch(/\n\.plate-group \{[^}]*pointer-events: none;/);
    });
    it("a large room does not zoom, and stands where it stood: the camera is the level's fit before and after", () => {
      level("Courtland Grand", "f1");
      const was = shown()[0].querySelector(".stack-cam").getAttribute("transform"), big = place("Courtland Grand", "f1", "North Capitol Ballroom");
      expect(app.isSmall(big, cam().scale)).toBe(false);
      const seen = mutationsDuring(shown()[0], () => room("North Capitol Ballroom"));
      expect([state.map.zoom, shown()[0].querySelector(".stack-cam").getAttribute("transform"), said()]).toEqual([null, was, ["← Courtland", "Back to the Courtland's floors"]]);
      expect(seen.filter(m => m.attributeName === "transform")).toHaveLength(0);
      expect(shown()[0].querySelectorAll(".level-streets text").length).toBeGreaterThan(0);
    });
    it("a small room zooms: the camera goes to it until its shorter side is 62, the room 12 below the frame's middle, and the way back says Whole level", () => {
      level("Hyatt", "acc");
      const small = place("Hyatt", "acc", "Roswell"), fit = app.levelFit(model("Hyatt", "acc"), frame()), f = frame();
      expect(app.isSmall(small, fit.scale)).toBe(true);
      room("Roswell");
      expect([state.map.rooms, state.map.zoom.level, state.map.zoom.id]).toEqual([[{ level: "acc", id: "Roswell" }], "acc", "Roswell"]);
      expect(state.map.zoom.scale).toBeCloseTo(62 / Math.min(small.w, small.h), 6);
      sameCam(cam(), app.cameraOn(small, state.map.zoom.scale, f));
      expect(cam().tx + cam().scale * small.cx).toBeCloseTo(f.x + f.w / 2, 1);
      expect(cam().ty + cam().scale * small.cy).toBeCloseTo(f.y + f.h / 2 + 12, 1);
      expect(Math.min(small.w, small.h) * cam().scale).toBeCloseTo(62, 1);
      expect(said()).toEqual(["← Whole level", "Back to the whole level"]);
    });
    it("while zoomed, a tap on another room brings it to the middle at the same zoom or closer: a larger room at the zoom it stood at, a smaller one closer, and never back out", () => {
      level("Hyatt", "acc");
      const f = frame(), fit = app.levelFit(model("Hyatt", "acc"), f).scale, own = id => app.zoomScale(place("Hyatt", "acc", id), fit);
      expect([own("Piedmont") < own("Roswell"), own("Roswell") < own("Heritage Boardroom")]).toEqual([true, true]);
      room("Roswell");
      room("Piedmont");
      expect([state.map.rooms, state.map.zoom.id]).toEqual([[{ level: "acc", id: "Piedmont" }], "Piedmont"]);
      expect(state.map.zoom.scale).toBeCloseTo(own("Roswell"), 6);
      sameCam(cam(), app.cameraOn(place("Hyatt", "acc", "Piedmont"), own("Roswell"), f));
      room("Heritage Boardroom");
      expect(state.map.zoom.scale).toBeCloseTo(own("Heritage Boardroom"), 6);
      room("Piedmont");
      expect(state.map.zoom.scale).toBeCloseTo(own("Heritage Boardroom"), 6);
      sameCam(cam(), app.cameraOn(place("Hyatt", "acc", "Piedmont"), own("Heritage Boardroom"), f));
      level("Courtland Grand", "f1");                        // and a large room tapped while zoomed comes to the middle too, where from the fit it would stay put
      room("South Capitol Ballroom");
      const close = state.map.zoom.scale;
      room("North Capitol Ballroom");
      expect([state.map.zoom.id, state.map.zoom.scale]).toEqual(["North Capitol Ballroom", close]);
    });
    it("the labels are worked out again for the zoom: a room with a short name or none at the fit has its full name once the camera is close", () => {
      level("Hyatt", "acc");
      const texts = () => [...laid().querySelectorAll(".level-labels .lv-room")].map(words);
      const atFit = texts(), unsaid = model("Hyatt", "acc").rooms.find(r => !atFit.includes(r.id));          // a room with no label at the fit
      expect([!!unsaid, atFit.length < 20]).toEqual([true, true]);
      room(unsaid.id);
      expect(texts()).toEqual(app.levelLabels(model("Hyatt", "acc"), state.map.zoom.scale).rooms.map(l => l.text));
      expect([texts().includes(unsaid.id), texts().length > atFit.length]).toEqual([true, true]);
      back().click();
      expect(texts()).toEqual(atFit);
    });
    it("a tap off the rooms while zoomed clears the selection and keeps the zoom", () => {
      level("Hyatt", "acc");
      room("Roswell");
      const close = state.map.zoom.scale;
      tap(laid().querySelector(".plate-hull"));
      expect([state.map.rooms, state.map.zoom, el("mapPlate").dataset.plate, said()[0]]).toEqual([null, { level: "acc", id: "Roswell", scale: close }, "acc", "← Whole level"]);
    });
    it("Enter and Space on a room are its tap, the key taken, and focus stays on the room; a key held down is one press; any other key is the page's", () => {
      level("Courtland Grand", "f1");
      const big = shape("North Capitol Ballroom");
      big.focus();
      expect([press(big, "Enter", { repeat: true }), state.map.rooms]).toEqual([true, null]);
      expect([press(big, "Enter"), state.map.rooms, document.activeElement === big]).toEqual([true, [{ level: "f1", id: "North Capitol Ballroom" }], true]);
      const small = shape("South Capitol Ballroom");
      small.focus();
      expect([press(small, " "), state.map.rooms[0].id, state.map.zoom.id, document.activeElement === small]).toEqual([true, "South Capitol Ballroom", "South Capitol Ballroom", true]);
      expect([press(small, "Tab"), press(small, "a"), state.map.rooms[0].id]).toEqual([false, false, "South Capitol Ballroom"]);
    });
    describe("a tap that hits no room, given the plate's matrix - jsdom has none", () => {
      /* A matrix whose inverse takes a point on the screen to the drawing's feet: here two px a foot, moved by 10 and 20. */
      const matrix = { inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -10, f: -20 }) };
      const on = (x, y) => ({ clientX: (x + 10) * 2, clientY: (y + 20) * 2 });
      const tapAt = (node, point) => node.dispatchEvent(new MouseEvent("click", { bubbles: true, ...point }));
      /* The level's westmost place and its westmost corner: a point due west of that corner is as far from that place as it is from the
         corner, and no nearer any other, since nothing of the level stands further west. */
      const west = made => {
        const all = app.levelPlaces(made), leftmost = r => Math.min(...app.corners(r).map(c => c[0])), found = all.reduce((a, r) => (leftmost(r) < leftmost(a) ? r : a));
        return { all, found, corner: app.corners(found).reduce((a, c) => (c[0] < a[0] ? c : a)) };
      };
      it("within 22 of the Map's units of a room it selects the nearest, and past 22 of every room it clears the selection - by the tap's point taken through the open plate's own matrix", () => {
        level("Courtland Grand", "f1");
        const tilt = laid().querySelector(".plate-tilt"), scale = cam().scale, { all, found, corner } = west(model("Courtland Grand", "f1"));
        tilt.getScreenCTM = () => matrix;
        expect(app.isSmall(found, scale)).toBe(false);          // a large room: no camera moves between the taps
        expect(app.nearest(all, [corner[0] - 21 / scale, corner[1]], 22 / scale)).toBe(found);
        tapAt(laid().querySelector(".plate-hull"), on(corner[0] - 21 / scale, corner[1]));
        expect([state.map.rooms, state.map.zoom]).toEqual([[{ level: found.level, id: found.id }], null]);
        tapAt(laid().querySelector(".plate-hull"), on(corner[0] - 23 / scale, corner[1]));
        expect(state.map.rooms).toBe(null);
        tapAt(svg().querySelector(".map-ground"), on(corner[0] - 5 / scale, corner[1]));            // whatever in the frame the tap lands on
        expect(state.map.rooms).toEqual([{ level: found.level, id: found.id }]);
        delete tilt.getScreenCTM;
      });
      it("the reach is 22 on the screen whatever the camera: zoomed, the same distance in feet is past it", () => {
        level("Hyatt", "acc");
        const tilt = laid().querySelector(".plate-tilt"), fit = cam().scale, { all, found, corner } = west(model("Hyatt", "acc"));
        tilt.getScreenCTM = () => matrix;
        const point = [corner[0] - 16 / fit, corner[1]];        // 16 of the Map's units west of it, at the fit
        tapAt(laid().querySelector(".plate-hull"), on(...point));
        expect(state.map.rooms).toEqual([{ level: found.level, id: found.id }]);
        expect(16 / fit * state.map.zoom.scale).toBeGreaterThan(22);                                // it was small: the camera is close now, and the same point past the reach
        expect(app.nearest(all, point, 22 / state.map.zoom.scale)).toBe(null);
        tapAt(laid().querySelector(".plate-hull"), on(...point));
        expect([state.map.rooms, state.map.zoom.id]).toEqual([null, found.id]);
        delete tilt.getScreenCTM;
      });
      it("a room that is hit is that room, whatever the matrix says: the tap's target comes first", () => {
        level("Courtland Grand", "f1");
        const tilt = laid().querySelector(".plate-tilt"), north = place("Courtland Grand", "f1", "North Capitol Ballroom");
        tilt.getScreenCTM = () => matrix;
        tapAt(shape("Georgia Ballroom"), on(north.cx, north.cy));
        expect(state.map.rooms).toEqual([{ level: "f1", id: "Georgia Ballroom" }]);
        delete tilt.getScreenCTM;
      });
    });
  });

  describe("the card under the map", () => {
    it("with no room selected it is the level's plate's card, as the stack has it: its name, the day's line and two rows - no hint line, and none of the city map's", () => {
      level("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      expect([[...under().children].map(n => n.id), el("mapPlate").className, cardLines()]).toEqual([["mapPlate"], "next-card plate-card mine", ["Hyatt", "Exhibit Level + Intl Tower LL2", "Saturday · 9 events · 1 pick"]]);
      expect([rows().length, under().querySelector(".map-hint"), el("mapNext"), el("mapVenue"), el("mapOnNow"), under().querySelector(".map-offmap")]).toEqual([2, null, null, null, null, null]);
    });
    it("a room's: the venue's short name and the room's own level's name, small, on one line; the room's name, a star before it where a pick is there that day; the day, what is on there and the reader's picks; then its rows", () => {
      level("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      room("Grand Hall C");
      const made = el("mapRoom");
      expect([made.tagName, made.className, made.dataset.plate, made.getAttribute("style")]).toEqual(["DIV", "next-card plate-card room-card mine", EXHIBIT, block("Hyatt").getAttribute("style")]);
      expect([...made.children].map(n => n.className)).toEqual(["nc-label", "nc-title", "nc-when", "pc-rows"]);
      expect(cardLines()).toEqual(["Hyatt · Exhibit Level (LL2)", "Grand Hall C", "Saturday · 5 events · 1 pick"]);
      expect(css).toMatch(/\n\.room-card \.nc-label \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
      expect(css).toMatch(/\n\.plate-card\.mine \.nc-title::before, \.pc-row\.mine \.pc-title::before \{ content: "★"; margin-right: \.2em; color: var\(--gold\); \}/);
      handle.picks.set([]); handle.render();
      expect([el("mapRoom").className, cardLines()[2]]).toEqual(["next-card plate-card room-card", "Saturday · 5 events"]);
      handle.picks.set(["s0377"]); handle.render();          // a pick there at 1 AM: still Saturday's night
      expect(el("mapRoom").className).toBe("next-card plate-card room-card mine");
      dayChip(SUN).click();                                  // and a pick there on another day is no star on this one
      expect(el("mapRoom").className).toBe("next-card plate-card room-card");
    });
    it("its rows are the plate card's own: on the clock's day what is on now, and then what is next; with nothing on now, what is next and then - and a row says no room: the card is the room", () => {
      level("Marriott", "atrium");
      room("Atrium Ballroom A");
      expect(rows()).toEqual([[byId("s0307").title, "On now · ends 2:00 PM"], [byId("s0587").title, "Next · 8:00–10:00 PM"]]);
      expect([...under().querySelectorAll(".pc-row")].map(r => r.dataset.hero)).toEqual(["s0307", "s0587"]);
      level("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      room("Grand Hall C");
      expect(rows()).toEqual([["Deep Dive: Dune Roundtable", "Next · 4:00–5:00 PM"], ["Deep Dive: Warhammer 40K", "Then · 4:00–5:00 PM"]]);
      expect([...under().querySelectorAll(".pc-row")].map(r => r.classList.contains("mine"))).toEqual([true, false]);
      expect(under().textContent).not.toMatch(/Grand Hall C.*Grand Hall C/);
    });
    it("on another day, its first two; with none that day, so, and how many are on other days; and nothing more where the room has none at all", () => {
      level("Hyatt", "acc");
      room("Roswell");
      expect([cardLines()[2], rows()]).toEqual(["Saturday · 2 events", [["Screening: Alien", "Next · 11:30 PM–12:30 AM"]]]);
      dayChip(SUN).click();
      expect([cardLines()[2], rows()]).toEqual(["Sunday · 2 events", [["Q&A: Dune Roundtable", "8:30–9:30 PM"], ["Workshop: Warhammer 40K Uncut", "10:00–11:00 PM"]]]);
      dayChip(WED).click();
      expect([cardLines()[2], rows(), words(under().querySelector(".pc-none"))]).toEqual(["Wednesday · no events", [], "Nothing here on Wednesday. 18 events on other days."]);
      level("Hyatt", "acc");
      room("Piedmont");
      expect([cardLines(), words(under().querySelector(".pc-none"))]).toEqual([["Hyatt · Atlanta Conference Center (LL3)", "Piedmont", "Saturday · no events"], "Nothing here on Saturday."]);
    });
    it("a row says as International Hall South where the event booked the room as part of a composite - and nothing where it booked the room itself, alone or with others", () => {
      level("Marriott", "international");
      room("International 6");
      expect([cardLines(), rows()]).toEqual([["Marriott · International Level", "International 6", "Saturday · 4 events"],
        [[byId(AS_SOUTH).title, "Next · 4:00–4:10 PM · as International Hall South"], [byId("s0369").title, "Then · 5:30–5:40 PM · as International Hall South"]]]);
      const own = { ...SAMPLE.events.find(e => e.id === AS_SOUTH), id: "x-own", source_id: "x-own", title: "In Six Alone", start: "2026-09-05T14:00", end: "2026-09-05T15:00", rooms: ["International 6"], room: "International 6" };
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, own] });
      handle.render();
      expect(rows()).toEqual([["In Six Alone", "Next · 2:00–3:00 PM"], [byId(AS_SOUTH).title, "Then · 4:00–4:10 PM · as International Hall South"]]);
      app.replaceSchedule(SAMPLE);
      level("Marriott", "atrium");                           // booked into three rooms by their names, no composite among them
      room("Atrium Ballroom A");
      expect([byId("s0307").rooms, under().textContent.includes(" as ")]).toEqual([["Atrium Ballroom A", "Atrium Ballroom B", "Atrium Ballroom C"], false]);
    });
    it("a cancelled event is in no row and no count, and its room says so too", () => {
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.map(e => (e.id === AS_SOUTH ? { ...e, cancelled: true } : e)) });
      level("Marriott", "international", [AS_SOUTH]);
      expect([shape("International 6").getAttribute("aria-label"), shape("International 6").classList.contains("lit")]).toEqual(["International 6: 3 events, no picks on Saturday", false]);
      room("International 6");
      expect([cardLines()[2], el("mapRoom").className, rows().map(r => r[1])]).toEqual(["Saturday · 3 events", "next-card plate-card room-card", ["Next · 5:30–5:40 PM · as International Hall South", "Then · 7:00–7:10 PM · as International Hall South"]]);
      expect(under().querySelector(`[data-hero="${AS_SOUTH}"]`)).toBe(null);
      app.replaceSchedule(SAMPLE);
    });
    it("a row is a button to its event's sheet; closing it comes back to the level as it was - the room, the zoom - with keyboard focus on the row", () => {
      level("Hyatt", EXHIBIT);
      room("Grand Hall C");
      const row = under().querySelector(".pc-row"), close = state.map.zoom.scale;
      expect([row.tagName, row.getAttribute("type"), row.dataset.hero]).toEqual(["BUTTON", "button", IN_EXHIBIT]);
      row.focus();
      row.click();
      expect([el("sheetWrap").hidden, state.sheetId, words(el("sheetTitleEvent"))]).toEqual([false, IN_EXHIBIT, "Deep Dive: Dune Roundtable"]);
      el("closeSheetEvent").click();
      expect([el("sheetWrap").hidden, state.tab, held(), state.map.zoom.scale]).toEqual([true, "map", ["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"], close]);
      expect([document.activeElement === under().querySelector(".pc-row"), document.activeElement.dataset.hero]).toEqual([true, IN_EXHIBIT]);
    });
    it("rooms selected together, as an arrival leaves them, are named by their composite where they are exactly its leaves, their events each once - and a row then need not say as", () => {
      city(); app.showOnMap(AS_SOUTH);
      expect([state.map.rooms.map(r => r.id), state.map.zoom, el("mapNext").dataset.hero]).toEqual([SOUTH, null, AS_SOUTH]);
      dayChip(SAT).click();                                  // the focus ends, and the card is the rooms'
      expect([cardLines(), rows()]).toEqual([["Marriott · International Level", "International Hall South", "Saturday · 4 events"],
        [[byId(AS_SOUTH).title, "Next · 4:00–4:10 PM"], [byId("s0369").title, "Then · 5:30–5:40 PM"]]]);
      expect(shapes().filter(r => r.getAttribute("aria-pressed") === "true").map(r => r.dataset.room).sort()).toEqual([...SOUTH].sort());
      expect(laid().querySelectorAll(".level-sel > *")).toHaveLength(7);
    });
    it("any other set is named one by one, joined, an ellipsis its net: three rooms of the Hilton's that no composite holds", () => {
      const three = handle.events.find(e => e.hotel === "Hilton" && e.level === "l2" && e.rooms.join("+") === "209+210+211" && e._cd === SAT);
      city(); app.showOnMap(three.id);
      dayChip(SAT).click();
      expect([state.map.rooms.map(r => r.id), state.map.zoom, cardLines().slice(0, 2)]).toEqual([["209", "210", "211"], null, ["Hilton · 2nd Floor", "209 + 210 + 211"]]);
      expect(css).toMatch(/\n\.plate-card \.nc-title \{ display: block; white-space: nowrap; text-overflow: ellipsis; \}/);
      const each = new Set(["209", "210", "211"].flatMap(id => app.roomEvents("Hilton", "l2", id).filter(x => x.ev._cd === SAT && !x.ev.cancelled).map(x => x.ev.id)));
      expect(cardLines()[2]).toBe(`Saturday · ${each.size} events`);
    });
  });

  describe("the Map's focus, and what ends it", () => {
    const arrived = () => { city(); app.showOnMap(IN_EXHIBIT); expect([state.map.focus, state.map.level, state.map.zoom.id, el("mapNext").dataset.hero]).toEqual([IN_EXHIBIT, EXHIBIT, "Grand Hall C", IN_EXHIBIT]); };
    it("a room's tap ends it, and the card is that room's", () => {
      arrived();
      room("Grand Hall D");
      expect([state.map.focus, state.map.rooms, el("mapNext"), cardLines()[1]]).toEqual([null, [{ level: "exhibit", id: "Grand Hall D" }], null, "Grand Hall D"]);
      arrived();
      room("Grand Hall C");                                  // the room it is in, too: the reader asked for the room
      expect([state.map.focus, el("mapNext"), cardLines()[1]]).toEqual([null, null, "Grand Hall C"]);
      arrived();
      press(shape("Grand Hall D"), "Enter");
      expect(state.map.focus).toBe(null);
    });
    it("a tap off the rooms ends it, and clears the selection", () => {
      arrived();
      tap(laid().querySelector(".plate-hull"));
      expect([state.map.focus, state.map.rooms, el("mapNext"), el("mapPlate").dataset.plate]).toEqual([null, null, null, EXHIBIT]);
    });
    it("each step of the way back ends it: from the zoom, where the room's card then stands, and from a level", () => {
      arrived();
      back().click();
      expect([state.map.focus, state.map.zoom, state.map.rooms, el("mapNext"), cardLines()[1]]).toEqual([null, null, [{ level: "exhibit", id: "Grand Hall C" }], null, "Grand Hall C"]);
      const marquis = handle.events.find(e => e.hotel === "Marriott" && e.level === "marquis" && !e.rooms.length && e._cd === SAT);
      city(); app.showOnMap(marquis.id);
      back().click();
      expect([state.map.focus, held(), !!el("mapVenue")]).toEqual([null, ["Marriott", null, null, null, null], true]);
    });
    it("a drawn plate's tap ends it: an arrival at a floor, and then the level of the plate under it", () => {
      city(); app.showOnMap("s0349");                        // the Westin's 12th Floor
      expect([state.map.focus, state.map.plate]).toEqual(["s0349", "f12"]);
      tap(plate("f6").querySelector(".plate-hull"));
      expect([state.map.focus, held(), el("mapNext"), el("mapPlate").dataset.plate]).toEqual([null, ["Westin", null, "f6", null, null], null, "f6"]);
    });
    it("a day chip ends it and keeps the level, the selection and the zoom, on the day the chip chose", () => {
      arrived();
      const close = state.map.zoom.scale, kept = [laid(), shape("Grand Hall C")];
      dayChip(SUN).click();
      expect([state.map.focus, state.map.day, held(), state.map.zoom.scale]).toEqual([null, SUN, ["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"], close]);
      expect([laid() === kept[0], shape("Grand Hall C") === kept[1], shape("Grand Hall C").getAttribute("aria-pressed"), said()[0], cardLines()[1], cardLines()[2].startsWith("Sunday · ")]).toEqual([true, true, "true", "← Whole level", "Grand Hall C", true]);
    });
    it("a sheet opened and closed over the level, and a star, leave it: the focused card's tap, and its close", () => {
      arrived();
      el("mapNext").click();
      expect(state.sheetId).toBe(IN_EXHIBIT);
      el("sheetStar").click();
      el("closeSheetEvent").click();
      expect([state.map.focus, state.map.level, state.map.zoom.id, document.activeElement === el("mapNext"), handle.picks.get().has(IN_EXHIBIT), shape("Grand Hall C").classList.contains("lit")]).toEqual([IN_EXHIBIT, EXHIBIT, "Grand Hall C", true, true, true]);
    });
  });

  describe("the way back, a step at a time", () => {
    it("one control, and its words say where it goes: Whole level while zoomed, the venue's short name from a level, Map from the stack - each with its name", () => {
      lift("Courtland Grand");
      expect(said()).toEqual(["← Map", "Back to the map"]);
      tap(plate("f1").querySelector(".plate-hull"));
      expect(said()).toEqual(["← Courtland", "Back to the Courtland's floors"]);
      room("South Capitol Ballroom");
      expect(said()).toEqual(["← Whole level", "Back to the whole level"]);
      expect([back().tagName, back().getAttribute("type"), view().querySelectorAll("#mapBack, .map-back").length]).toEqual(["BUTTON", "button", 1]);
      back().click(); back().click(); back().click();
      expect([said(), back().hidden]).toEqual([["← Map", "Back to the map"], true]);
    });
    it("from a zoom to the whole level: the selection kept, the camera at the level's fit, and focus where it was", () => {
      level("Hyatt", "acc");
      room("Roswell");
      back().focus();
      back().click();
      expect([held(), document.activeElement === back(), shapes().filter(r => r.getAttribute("aria-pressed") === "true").map(r => r.dataset.room)]).toEqual([["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], null], true, ["Roswell"]]);
      sameCam(cam(), app.levelFit(model("Hyatt", "acc"), frame()));
      expect(cardLines()[1]).toBe("Roswell");
    });
    it("from a level to its stack: the stack still open, nothing selected - no room and no plate - and keyboard focus on that level's plate", () => {
      level("Hyatt", EXHIBIT);
      room("Concourse");
      back().click();                                        // the whole level
      back().click();                                        // the stack
      expect([held(), svg().getAttribute("data-stack"), svg().hasAttribute("data-level"), shown().map(g => g.dataset.hotel), back().hidden]).toEqual([["Hyatt", null, null, null, null], "Hyatt", false, ["Hyatt"], false]);
      expect([document.activeElement === plate(EXHIBIT), plates().filter(p => p.classList.contains("selected") || p.classList.contains("flat")).length, [...under().children].map(n => n.id || n.className)]).toEqual([true, 0, ["mapVenue", "map-hint"]]);
    });
    it("from the stack to the city map, as built: focus on the venue's block", () => {
      level("Hyatt", "acc");
      back().click(); back().click();
      expect([held(), svg().hasAttribute("data-stack"), back().hidden, document.activeElement === block("Hyatt")]).toEqual([[null, null, null, null, null], false, true, true]);
    });
    it("Escape, with no sheet open, does what the control does - one step a press, wherever keyboard focus is", () => {
      for (const from of [() => document.body, () => shape("Roswell"), () => back(), () => dayChip(SAT)]) {
        level("Hyatt", "acc");
        room("Roswell");
        expect([press(from(), "Escape"), held()]).toEqual([true, ["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], null]]);
        expect([press(document.body, "Escape"), held()]).toEqual([true, ["Hyatt", null, null, null, null]]);
        expect([press(document.body, "Escape"), held()]).toEqual([true, [null, null, null, null, null]]);
        expect(press(document.body, "Escape")).toBe(false);
      }
    });
    it("a held Escape is one press: its repeats are not taken and go no further back", () => {
      level("Hyatt", "acc");
      room("Roswell");
      expect([press(document.body, "Escape"), press(document.body, "Escape", { repeat: true }), press(document.body, "Escape", { repeat: true }), held()]).toEqual([true, false, false, ["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], null]]);
    });
    it("Escape under an open sheet closes the sheet and leaves the level, its room and its zoom; the next goes back a step", () => {
      for (const sheet of [() => under().querySelector(".pc-row").click(), () => handle.openSheet("settings")]) {
        level("Hyatt", EXHIBIT);
        room("Grand Hall C");
        sheet();
        expect(el("sheetWrap").hidden).toBe(false);
        press(document.activeElement, "Escape");
        expect([el("sheetWrap").hidden, held()]).toEqual([true, ["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"]]);
        press(document.activeElement, "Escape");
        expect(held()).toEqual(["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], null]);
      }
    });
    it("Escape on another tab is not the Map's, and a tap outside the frame is no way back: a day chip's strip, the slot under the map, the Map's own tab", () => {
      level("Hyatt", "acc");
      room("Roswell");
      tap(view().querySelector(".controls"));
      tap(under());
      navTo("map");
      expect(held()).toEqual(["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], "Roswell"]);
      navTo("browse");
      expect([press(document.body, "Escape"), state.map.level, state.map.zoom.id]).toEqual([false, "acc", "Roswell"]);
    });
    it("stepBack() with nothing open does nothing", () => {
      block("Hilton").focus();
      app.stepBack();
      expect([held(), document.activeElement === block("Hilton")]).toEqual([[null, null, null, null, null], true]);
    });
  });

  describe("arriving from an event's place line, as deep as its place goes", () => {
    it("a room: its level, the room selected, the focus held, the card showing the event, keyboard focus on the card - and a large room does not zoom", () => {
      const large = { ...SAMPLE.events.find(e => e.id === IN_EXHIBIT), id: "x-large", source_id: "x-large", title: "In the Georgia Ballroom", hotel: "Courtland Grand", level: "f1", rooms: ["Georgia Ballroom"], room: "Georgia Ballroom" };
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, large] });
      city(); state.tab = "browse"; handle.render();
      app.showOnMap("x-large");
      expect([state.tab, state.map.focus, held()]).toEqual(["map", "x-large", ["Courtland Grand", null, "f1", [{ level: "f1", id: "Georgia Ballroom" }], null]]);
      expect([[...under().children].map(n => n.id), el("mapNext").dataset.hero, document.activeElement === el("mapNext"), said()[0]]).toEqual([["mapNext"], "x-large", true, "← Courtland"]);
      expect([shape("Georgia Ballroom").getAttribute("aria-pressed"), laid().querySelectorAll(".level-sel > *").length, svg().querySelector(".map-focus")]).toEqual(["true", 1, null]);
      sameCam(cam(), app.levelFit(model("Courtland Grand", "f1"), frame()));
      app.replaceSchedule(SAMPLE);
    });
    it("one small room alone zooms: the camera on it, and the way back says Whole level", () => {
      city(); app.showOnMap(IN_EXHIBIT);
      const small = place("Hyatt", EXHIBIT, "Grand Hall C"), f = frame();
      expect(held()).toEqual(["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"]);
      expect(state.map.zoom.scale).toBeCloseTo(62 / Math.min(small.w, small.h), 6);
      sameCam(cam(), app.cameraOn(small, state.map.zoom.scale, f));
      expect([said()[0], el("mapNext").dataset.hero, document.activeElement === el("mapNext")]).toEqual(["← Whole level", IN_EXHIBIT, true]);
    });
    it("several rooms do not zoom, small as they are: every one selected, the level at its fit", () => {
      const three = handle.events.find(e => e.hotel === "Hilton" && e.level === "l2" && e.rooms.join("+") === "209+210+211" && e._cd === SAT);
      city(); app.showOnMap(three.id);
      expect(held()).toEqual(["Hilton", null, "l2", [{ level: "l2", id: "209" }, { level: "l2", id: "210" }, { level: "l2", id: "211" }], null]);
      expect(["209", "210", "211"].every(id => app.isSmall(place("Hilton", "l2", id), cam().scale))).toBe(true);
      sameCam(cam(), app.levelFit(model("Hilton", "l2"), frame()));
    });
    it("a level - a drawn level, and no room the drawing has: its level with nothing selected; and the rooms the drawing does have of it selected, at the fit, where it names one the drawing lacks", () => {
      const none = handle.events.find(e => e.hotel === "Marriott" && e.level === "marquis" && !e.rooms.length && e._cd === SAT);
      expect(app.depthOf(none)).toMatchObject({ depth: "level", plate: "marquis", rooms: [] });
      city(); app.showOnMap(none.id);
      expect([state.map.focus, held(), el("mapNext").dataset.hero]).toEqual([none.id, ["Marriott", null, "marquis", null, null], none.id]);
      const half = { ...SAMPLE.events.find(e => e.id === IN_EXHIBIT), id: "x-half", source_id: "x-half", title: "Half Drawn", hotel: "Hilton", level: "l2", rooms: ["201", "202"], room: "201-202" };
      app.replaceSchedule({ ...SAMPLE, events: [...SAMPLE.events, half] });
      expect(app.depthOf(app.byId.get("x-half"))).toMatchObject({ depth: "level", plate: "l2", rooms: ["202"] });
      city(); app.showOnMap("x-half");
      expect([held(), app.isSmall(place("Hilton", "l2", "202"), cam().scale)]).toEqual([["Hilton", null, "l2", [{ level: "l2", id: "202" }], null], true]);
      app.replaceSchedule(SAMPLE);
    });
    it("a floor, the venue and the park open no level, as built: the stack with the floor selected, and the city map", () => {
      city(); app.showOnMap("s0349");
      expect(held()).toEqual(["Westin", "f12", null, null, null]);
      const flat = handle.events.find(e => e.hotel === "Hilton" && e._cd === SAT && !e.level), inPark = handle.events.find(e => e.hotel === "Hardy Ivy Park" && e._cd === SAT);
      for (const ev of [flat, inPark]) {
        level("Hyatt", "acc"); room("Roswell");                // from a zoomed level, too
        app.showOnMap(ev.id);
        expect([state.map.focus, held(), svg().hasAttribute("data-level")], ev.hotel).toEqual([ev.id, [null, null, null, null, null], false]);
      }
    });
    it("from one venue's level to another's: the first is put away with its rooms out of the tab order, and found as a stack when its venue is opened again", () => {
      level("Hyatt", "acc"); room("Roswell");
      app.showOnMap(AS_SOUTH);
      expect([state.map.stack, state.map.level, shown().map(g => g.dataset.hotel)]).toEqual(["Marriott", "international", ["Marriott"]]);
      expect([group("Hyatt").hasAttribute("hidden"), group("Hyatt").querySelectorAll('[tabindex="0"]').length, group("Hyatt").querySelectorAll(".plate.flat, [data-room][role], [data-room][aria-pressed]").length, group("Hyatt").hasAttribute("data-level")])
        .toEqual([true, 0, 0, false]);
      expect([...group("Hyatt").querySelectorAll(".plate")].map(p => [p.getAttribute("role"), p.getAttribute("tabindex"), p.getAttribute("aria-pressed")])).toEqual([["button", "-1", "false"], ["button", "-1", "false"], ["button", "-1", "false"], [null, null, null]]);
      expect(app.tickMap()).toBe(false);
      city(); lift("Hyatt");
      expect([shown()[0] === group("Hyatt"), shown()[0].hasAttribute("data-level"), shown()[0].querySelectorAll("[data-room][role], [data-room][tabindex]").length, shown()[0].querySelectorAll(".level-sel > *, .level-labels > *").length, plates().map(p => p.getAttribute("tabindex"))])
        .toEqual([true, false, 0, 0, ["0", "0", "0", null]]);
    });
    it("an event the Map cannot show arrives nowhere, and leaves an open level as it was", () => {
      level("Hyatt", "acc"); room("Roswell");
      const stream = handle.events.find(e => e.hotel === "Streaming");
      for (const id of [stream.id, "no-such-event", undefined]) { app.showOnMap(id); expect(held(), String(id)).toEqual(["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], "Roswell"]); }
    });
  });

  describe("what is kept, and what is not", () => {
    it("the Map tab left and come back to: the level, the selection and the zoom kept, the focus gone", () => {
      for (const leave of [() => navTo("browse"), () => { state.tab = "plans"; handle.render(); }]) {
        city(); app.showOnMap(IN_EXHIBIT);
        const close = state.map.zoom.scale;
        leave();
        expect([state.tab === "map", state.map.focus, held(), state.map.zoom.scale]).toEqual([false, null, ["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"], close]);
        navTo("map");
        expect([laid().dataset.plate, shape("Grand Hall C").getAttribute("aria-pressed"), said()[0], el("mapNext"), cardLines()[1]]).toEqual([EXHIBIT, "true", "← Whole level", null, "Grand Hall C"]);
      }
    });
    it("a new moment on the clock keeps them, and ends the focus", () => {
      city(); app.showOnMap(IN_EXHIBIT);
      handle.setTimeOverride("2026-09-05T13:10");
      expect([state.map.focus, held()]).toEqual([null, ["Hyatt", null, EXHIBIT, [{ level: "exhibit", id: "Grand Hall C" }], "Grand Hall C"]]);
      handle.setTimeOverride(NOW);
    });
    it("a level whose plate the venue no longer holds as drawn is closed where it is drawn: the level, its rooms and its zoom cleared, the stack standing", () => {
      level("Hyatt", "acc"); room("Roswell");
      state.map.level = "no-such-plate";
      handle.render();
      expect([held(), svg().hasAttribute("data-level"), svg().querySelectorAll(".plate.flat").length, !!el("mapVenue")]).toEqual([["Hyatt", null, null, null, null], false, 0, true]);
      city(); lift("Westin");
      Object.assign(state.map, { level: "f12", rooms: [{ level: "f12", id: "x" }] });                              // a floor with no drawing is no level either
      handle.render();
      expect([held(), svg().querySelectorAll(".plate.flat").length, plate("f12").getAttribute("role")]).toEqual([["Westin", null, null, null, null], 0, "button"]);
      Object.assign(state.map, { stack: null, level: "acc", rooms: [{ level: "acc", id: "Roswell" }] });            // and with no stack there is no level
      handle.render();
      expect(held()).toEqual([null, null, null, null, null]);
    });
  });

  describe("built once, drawn in place", () => {
    it("two quiet ticks write nothing - with a level open, a room selected, zoomed, and with the focus held - and the tick says so", () => {
      for (const stage of [() => level("Hyatt", EXHIBIT, [IN_EXHIBIT]), () => { level("Courtland Grand", "f1"); room("North Capitol Ballroom"); }, () => { level("Hyatt", EXHIBIT, [IN_EXHIBIT]); room("Grand Hall C"); },
        () => { city(); app.showOnMap(IN_EXHIBIT); }, () => { city(); app.showOnMap(AS_SOUTH); }]) {
        stage();
        let results;
        expect(mutationsDuring(view(), () => { results = [app.tickMap(), app.tickMap()]; })).toHaveLength(0);
        expect(results).toEqual([false, false]);
      }
    });
    it("a minute that changes nothing a room's card says writes nothing; one that changes a row writes the card in place, and nothing of the level", () => {
      level("Marriott", "atrium");
      room("Atrium Ballroom A");
      const node = el("mapRoom"), stack = shown()[0];
      app.setOverride("2026-09-05T13:06");
      let ticked;
      expect(mutationsDuring(view(), () => { ticked = app.tickMap(); })).toHaveLength(0);
      expect(ticked).toBe(false);
      app.setOverride("2026-09-05T14:00");                   // the one on now is over: the rows move up
      const seen = mutationsDuring(view(), () => { ticked = app.tickMap(); });
      expect([ticked, seen.length > 0, rows().map(r => r[1])]).toEqual([true, true, ["Next · 8:00–10:00 PM", "Then · 8:30–9:30 PM"]]);
      expect([el("mapRoom") === node, shown()[0] === stack, seen.some(m => stack.contains(m.target))]).toEqual([true, true, false]);
      expect(app.tickMap()).toBe(false);
      app.setOverride(NOW);
    });
    it("a tick that only moves a light says it wrote, and the label's ink moves with it", () => {
      level("Hyatt", "ballroom+tower-ll1", [IN_EXHIBIT]);
      handle.picks.set(["s0347"]);                           // with no draw: Centennial I, for the next tick to find
      let ticked;
      const seen = mutationsDuring(shown()[0], () => { ticked = app.tickMap(); });
      expect([ticked, shape("Centennial I").classList.contains("lit"), laid().querySelectorAll(".level-labels .lit").length]).toEqual([true, true, 1]);
      expect(seen.some(m => m.type === "attributes" && m.attributeName === "class" && m.target === shape("Centennial I"))).toBe(true);
      expect(app.tickMap()).toBe(false);
    });
    it("a level opened, a room selected or the camera moved with no draw is drawn at the next tick", () => {
      city(); lift("Hyatt");
      state.map.level = "acc";
      expect([app.tickMap(), laid().dataset.plate, said()[0], app.tickMap()]).toEqual([true, "acc", "← Hyatt", false]);
      state.map.rooms = [{ level: "acc", id: "Roswell" }];
      expect([app.tickMap(), shape("Roswell").getAttribute("aria-pressed"), cardLines()[1], app.tickMap()]).toEqual([true, "true", "Roswell", false]);
      state.map.zoom = { level: "acc", id: "Roswell", scale: 2 };
      expect([app.tickMap(), cam().scale, said()[0], app.tickMap()]).toEqual([true, 2, "← Whole level", false]);
      state.map.level = null;
      expect([app.tickMap(), svg().querySelectorAll(".plate.flat").length, held(), app.tickMap()]).toEqual([true, 0, ["Hyatt", null, null, null, null], false]);
    });
    it("a control of the card that had keyboard focus and has left it hands focus on: to the card's first row; with no row left, to the selected room; and with none selected, to the way back", () => {
      level("Marriott", "atrium");
      room("Atrium Ballroom A");
      under().querySelector('.pc-row[data-hero="s0307"]').focus();                                  // on now, until 2:00 PM
      handle.setTimeOverride("2026-09-05T14:00");
      expect([under().querySelector('.pc-row[data-hero="s0307"]'), document.activeElement === under().querySelector(".pc-row"), document.activeElement.dataset.hero]).toEqual([null, true, "s0587"]);
      handle.setTimeOverride("2026-09-06T04:00");            // the night's last is over: no row is left
      expect([under().querySelectorAll(".pc-row").length, words(under().querySelector(".pc-none")), document.activeElement === shape("Atrium Ballroom A")]).toEqual([0, "Nothing more here today.", true]);
      handle.setTimeOverride(NOW);
      level("Marriott", "atrium");
      under().querySelector(".pc-row").focus();              // the plate's card, no room selected
      handle.setTimeOverride("2026-09-06T04:00");
      expect([under().querySelectorAll(".pc-row").length, document.activeElement === back()]).toEqual([0, true]);
      handle.setTimeOverride(NOW);
    });
    it("a new schedule writes the open level again in place: its rooms' names and its card, on the nodes that were there", () => {
      level("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      room("Grand Hall C");
      const kept = [shown()[0], laid(), shape("Grand Hall C")], close = state.map.zoom.scale;
      app.replaceSchedule({ ...SAMPLE, events: SAMPLE.events.filter(e => e.id !== IN_EXHIBIT) });
      handle.render();
      expect([shown()[0] === kept[0], laid() === kept[1], shape("Grand Hall C") === kept[2], shape("Grand Hall C").getAttribute("aria-label"), shape("Grand Hall C").classList.contains("lit"), cardLines()[2], state.map.zoom.scale])
        .toEqual([true, true, true, "Grand Hall C: 4 events, no picks on Saturday", false, "Saturday · 4 events", close]);
      app.replaceSchedule(SAMPLE);
    });
  });

  describe("in memory alone", () => {
    it("a level, a room selected and the camera on it write nothing the page keeps - and a fresh page shows the city map", async () => {
      const kept = () => JSON.stringify([localStorage, sessionStorage].map(store => Object.keys(store).sort().map(key => [key, store.getItem(key)])));
      const before = kept();
      lift("Hyatt");
      tap(plate("acc").querySelector(".plate-hull"));
      room("Roswell");
      expect(held()).toEqual(["Hyatt", null, "acc", [{ level: "acc", id: "Roswell" }], "Roswell"]);
      expect(kept()).toBe(before);
      expect(Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => /level|room|zoom/i.test(k))).toEqual([]);
      await page.cleanup();
      page = await bootPage();
      ({ app, handle } = page);
      state = handle.state;
      navTo("map");
      expect([held(), svg().hasAttribute("data-stack"), svg().hasAttribute("data-level"), back().hidden]).toEqual([[null, null, null, null, null], false, false, true]);
    }, 30000);
  });
});
