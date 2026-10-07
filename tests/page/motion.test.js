/* The motion between the Map's views (DECISIONS #97; docs/screens/contract.md,
   section 6): which tap, key and arrival starts which set, and what starts
   none; what a set is made of, and that its first and last values are the
   two draws' own; Reduce Motion, and a page with no animate(); a tap and a
   key while a set runs; a draw while one runs; what a set holds in the page
   for a closing level, and that nothing of a set is left when it ends.
   jsdom has no Web Animations, so the page is given a stand-in animate()
   that records what it is asked - the element, its keyframes, its options -
   and plays nothing; animation frames are run by hand. The page is the
   sample schedule at Saturday 1:05 PM. The lists themselves are
   tests/unit/motion.test.js's, and what a browser plays of them
   tests/browser/motion.spec.js's. New tests, not rows of
   tests/PORT-LEDGER.md. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootPage } from "../helpers/page.js";
import { tap } from "../helpers/act.js";

const NOW = "2026-09-05T13:05", SUN = "2026-09-06";
const EXHIBIT = "exhibit+tower-ll2";
/* The reader's Saturday pick in Grand Hall C, a small room of the Hyatt's
   Exhibit Level; and an event on the Westin's 12th Floor, which has no
   drawing. */
const IN_EXHIBIT = "s0263", ON_A_FLOOR = "s0349";
/* A room large enough at its level's fit that a tap on it moves no camera:
   the Courtland Grand's Georgia Ballroom, on its 1st floor. */
const GRAND = "Courtland Grand", F1 = "f1", BALLROOM = "Georgia Ballroom";
const MOTION = "map-motion";

describe("the motion between the Map's views", () => {
  let page, app, handle, state, reduce = false, hadFrame, hadAnimate;
  const el = id => document.getElementById(id);
  const view = () => el("view-map");
  const svg = () => view().querySelector("svg.map");
  const block = hotel => svg().querySelector(`.map-hotel[data-hotel="${hotel}"]`);
  const group = hotel => [...svg().querySelectorAll(".map-stacks > .map-stack")].find(g => g.dataset.hotel === hotel) || null;
  const shown = () => [...svg().querySelectorAll(".map-stacks > .map-stack")].find(g => !g.hasAttribute("hidden")) || null;
  const plates = () => [...shown().querySelectorAll(".plate")];
  const plate = key => plates().find(p => p.dataset.plate === key);
  const laid = () => shown().querySelector(".plate.flat");
  const shape = id => [...laid().querySelectorAll("[data-room]")].find(r => r.dataset.room === id);
  const back = () => el("mapBack");
  const cam = () => shown().querySelector(".stack-cam").getAttribute("transform");
  const press = (target, key, more = {}) => !target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...more }));
  const navTo = tab => document.querySelector(`.nav button[data-tab="${tab}"]`).click();
  const flush = () => new Promise(done => setTimeout(done, 0));

  /* The stand-in: every animation asked for, in order. One is "held" once
     paused, "running" once played or given a start time - whatever it was
     before, as the real one is: an animation that is over plays again when
     it is told to - and "cancelled" or "finished" at its end, when its
     promise settles. */
  const made = [];
  let frames = [];
  function standIn() {
    Element.prototype.animate = function animate(keyframes, options) {
      let settle;
      const finished = new Promise((resolve, reject) => { settle = { resolve, reject }; });
      finished.catch(() => {});
      const anim = {
        el: this, keyframes, options, id: options.id, state: "running", started: undefined, finished, was: null,
        pause() { if (this.state === "running") this.state = "held"; },
        play() { this.state = "running"; this.started = "played"; },
        set startTime(at) { this.state = "running"; this.started = at; },
        cancel() { if (this.state === "held" || this.state === "running") { this.state = "cancelled"; this.was = JSON.stringify(state.map); settle.reject(new Error("cancelled")); } },
        finish() { if (this.state === "held" || this.state === "running") { this.state = "finished"; settle.resolve(); } },
      };
      made.push(anim);
      return anim;
    };
  }
  /* The animations made since the last look. */
  const take = () => made.splice(0);
  /* The animation frames asked for, run. */
  const frame = () => { const due = frames; frames = []; due.forEach(callback => callback(0)); };
  /* A set as what it is of: "<the node> <the properties>", sorted. */
  const kind = node => (node.matches("svg.map") ? "frame" : node.matches(".map-hotel") ? `block ${node.dataset.hotel}` : node.matches(".plate") ? `plate ${node.dataset.plate}`
    : node.matches(".plate-tilt") ? `tilt ${node.parentNode.dataset.plate}` : node.matches(".plate-label") ? `label ${node.dataset.plate}`
      : node.matches(".level-labels") ? "names" : node.matches(".level-sel") ? "sel" : node.matches(".stack-face text") ? "face-name" : (node.getAttribute("class") || node.tagName).split(" ")[0]);
  const props = anim => Object.keys(anim.keyframes[0]).filter(k => k !== "offset" && k !== "easing").sort().join("+");
  const of = set => set.map(anim => `${kind(anim.el)} ${props(anim)}`).sort();
  const find = (set, what, property) => { const found = set.filter(anim => kind(anim.el) === what && (!property || property in anim.keyframes[0])); expect(found, `${what} ${property || ""}`).toHaveLength(1); return found[0]; };
  const ends = (anim, property) => [anim.keyframes[0][property], anim.keyframes[anim.keyframes.length - 1][property]];
  const span = set => { const spans = [...new Set(set.map(anim => anim.options.duration))]; expect(spans).toHaveLength(1); return spans[0]; };
  /* A set over: every animation of it finished, and the page told. */
  const finish = async set => { set.forEach(anim => anim.finish()); await flush(); };
  const css = said => app.cssOf(said);

  /* The city map at Saturday 1:05 PM, nothing open and nothing moving. */
  const city = (ids = []) => {
    app.settleMotion();
    handle.closeSheet();
    app.setOverride(NOW);
    state.tab = "map";
    Object.assign(state.map, { day: null, focus: null, stack: null, plate: null, level: null, rooms: null, zoom: null });
    handle.picks.set(ids);
    handle.render();
    take(); frames = [];
  };
  /* A view reached with no set left running: the set its tap started is finished. */
  const still = async () => { await finish(take()); frames = []; };
  const lift = hotel => tap(block(hotel).querySelector("rect"));
  const drop = key => tap(plate(key).querySelector(".plate-hull"));
  const stackOf = async hotel => { city(); lift(hotel); await still(); };
  const levelOf = async (hotel, key, ids = []) => { city(ids); lift(hotel); await still(); drop(key); await still(); };
  const model = (hotel, key) => app.building(hotel).plates.find(p => p.key === key);
  const fitOf = (hotel, key) => { const [x, y, w, h] = svg().getAttribute("viewBox").split(" ").map(Number); return app.levelFit(model(hotel, key), { x, y, w, h }); };
  /* The rooms of a level that a tap zooms on at the fit, the smallest first, and the first of them. */
  const smalls = (hotel, key) => app.levelPlaces(model(hotel, key)).filter(r => app.isSmall(r, fitOf(hotel, key).scale)).sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h));
  const small = (hotel, key) => smalls(hotel, key)[0];
  const picture = () => svg().outerHTML;

  beforeAll(async () => {
    page = await bootPage({ matchMedia: query => reduce && /prefers-reduced-motion: reduce/.test(query) });
    ({ app, handle } = page);
    state = handle.state;
    hadAnimate = Element.prototype.animate;
    hadFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    standIn();
    navTo("map");
  }, 30000);
  afterAll(() => {
    globalThis.requestAnimationFrame = hadFrame;
    if (hadAnimate) Element.prototype.animate = hadAnimate; else delete Element.prototype.animate;
    return page.cleanup();
  });
  beforeEach(() => { reduce = false; standIn(); city(); });

  describe("the lift: a tap on a venue's block", () => {
    it("starts one set over the city and the venue's group: the two cameras, every plate's tilt, each plate above the ground, the labels, the face - and dims the city, each by its own animation", () => {
      lift("Hyatt");
      const set = take();
      expect(of(set)).toEqual([
        "block AmericasMart Building 2 opacity", "block AmericasMart Building 3 opacity", "block Courtland Grand opacity", "block Hardy Ivy Park opacity", "block Hilton opacity", "block Marriott opacity", "block Westin opacity",
        "face-name opacity", "label acc opacity", "label ballroom+tower-ll1 opacity", `label ${EXHIBIT} opacity`, "label lobby opacity",
        "map-cam transform", "map-layer-focus opacity+visibility", "map-layer-pills opacity+visibility", "map-layer-rings opacity+visibility", "map-streets opacity",
        "plate ballroom+tower-ll1 transform", `plate ${EXHIBIT} transform`, "plate lobby transform", "stack-cam transform", "stack-face opacity+visibility", "stack-face transform",
        "tilt acc transform", "tilt ballroom+tower-ll1 transform", `tilt ${EXHIBIT} transform`, "tilt lobby transform"]);
      expect(span(set)).toBe(630);                                     // four plates: 270, two staggers of 30, and 300
    });
    it("every animation of it runs the set's whole span, carries the motion's id, and fills neither way: when it ends nothing of it is left", () => {
      lift("Hyatt");
      for (const anim of take()) {
        expect(anim.options).toEqual({ duration: 630, id: MOTION });
        expect([anim.keyframes[0].offset, anim.keyframes[anim.keyframes.length - 1].offset]).toEqual([0, 1]);
      }
    });
    it("only transform, opacity and visibility are in its keyframes", () => {
      lift("Hyatt");
      expect([...new Set(take().flatMap(anim => anim.keyframes.flatMap(Object.keys)))].sort()).toEqual(["easing", "offset", "opacity", "transform", "visibility"]);
    });
    it("its last values are the draw's own, to the digit: the camera's, each tilt's and each plate's lift are the attributes the draw wrote, and the city's camera its pushed-in words", () => {
      lift("Hyatt");
      const set = take();
      expect(ends(find(set, "stack-cam"), "transform")[1]).toBe(css(cam()));
      expect(ends(find(set, "map-cam"), "transform")[1]).toBe(css(svg().querySelector(".map-cam").getAttribute("transform")));
      for (const p of plates()) {
        expect(ends(find(set, `tilt ${p.dataset.plate}`), "transform")[1], p.dataset.plate).toBe(css(p.querySelector(".plate-tilt").getAttribute("transform")));
        if (p.hasAttribute("transform")) expect(ends(find(set, `plate ${p.dataset.plate}`), "transform")[1]).toBe(css(p.getAttribute("transform")));
      }
      expect(ends(find(set, "stack-face", "transform"), "transform")[1]).toBe(css(shown().querySelector(".stack-face").getAttribute("transform")));
      expect(ends(find(set, "map-streets"), "opacity")).toEqual([1, 0.1]);
      expect(ends(find(set, "block Marriott"), "opacity")).toEqual([1, 0.2]);
    });
    it("its first values are the city's: the city's camera at rest, in the pushed-in camera's own shape, the plates flat and unlifted in their block's place, wearing its face", () => {
      lift("Hyatt");
      const set = take(), tilted = plate("acc").querySelector(".plate-tilt").getAttribute("transform");
      expect(ends(find(set, "map-cam"), "transform")[0]).toBe("translate(150px, 250px) scale(1) translate(-150px, -250px)");        // the Hyatt's block, its middle: nothing moved
      expect(ends(find(set, "tilt acc"), "transform")[0]).toBe(css(tilted.replace("skewX(-30)", "skewX(0)").replace("scale(1 0.5)", "scale(1 1)")));
      expect(ends(find(set, "plate lobby"), "transform")[0]).toBe("translate(0px, 0px)");
      expect(ends(find(set, "stack-face", "opacity"), "opacity")).toEqual([1, 0]);
      /* the venue's camera stands its outline on its block: its middle on the block's, as large as the block holds */
      const [, tx, ty, scale] = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/.exec(ends(find(set, "stack-cam"), "transform")[0]).map(Number);
      const tilt = /^translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(tilted).slice(1).map(Number), hull = app.building("Hyatt").hull;
      const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]);
      expect(tx + scale * tilt[0]).toBeCloseTo(150, 1); expect(ty + scale * tilt[1]).toBeCloseTo(250, 1);
      expect(scale).toBeCloseTo(Math.min(60 / (Math.max(...xs) - Math.min(...xs)), 56 / (Math.max(...ys) - Math.min(...ys))), 4);
    });
    it("the same from Enter and from Space on the block, and from a tap on its gold pill", async () => {
      for (const key of ["Enter", " "]) {
        city();
        block("Hyatt").focus();
        expect([press(block("Hyatt"), key), state.map.stack, take().length]).toEqual([true, "Hyatt", 27]);
      }
      city([IN_EXHIBIT]);
      tap(svg().querySelector('.map-pill[data-hotel="Hyatt"] rect'));
      expect([state.map.stack, take().length]).toEqual(["Hyatt", 27]);
    });
    it("a venue of two plates and one of five: a plate's own lift each above the ground, and the span for each", async () => {
      lift("AmericasMart Building 3");
      let set = take();
      expect([of(set).filter(what => /^plate /.test(what)).length, span(set)]).toEqual([1, 570]);
      await finish(set);
      city(); lift("Westin");
      set = take();
      expect([of(set).filter(what => /^plate /.test(what)).length, span(set)]).toEqual([4, 660]);
    });
    it("the park, which has no building, opens its sheet and starts none", () => {
      lift("Hardy Ivy Park");
      expect([el("sheetWrap").hidden, take().length]).toEqual([false, 0]);
    });
    it("keyboard focus, the way back's words and the card are the end state's at once: nothing waits for the set", () => {
      lift("Hyatt");
      expect([document.activeElement === back(), back().hidden, back().textContent, el("mapVenue") !== null, svg().getAttribute("data-stack")]).toEqual([true, false, "← Map", true, "Hyatt"]);
      expect(take().every(anim => anim.state === "held")).toBe(true);          // and not a frame has passed
    });
  });

  describe("the frame's step", () => {
    /* jsdom lays nothing out: the ground's box is handed in, as it stood before the draw and as it stands after. */
    const boxes = (before, after) => { const ground = svg().querySelector(".map-ground"), order = [before, after]; ground.getBoundingClientRect = () => order.shift() || after; return ground; };
    const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
    it("the lift moves the drawing from the box it had before the draw to the one it has, about its middle: a transform of the drawing itself", () => {
      const ground = boxes(box(14, 138, 362, 286.8), box(44.2, 138, 301.6, 238.9));
      lift("Hyatt");
      const set = take(), step = find(set, "frame");
      expect(ends(step, "transform")).toEqual(["translate(0px, 23.95px) scale(1.20027)", "translate(0px, 0px) scale(1)"]);
      expect(step.keyframes[0].easing).toBe(app.QUINT);
      expect(step.keyframes[1].offset).toBeCloseTo(450 / 630, 6);
      delete ground.getBoundingClientRect;
    });
    it("and its way back the same, from the stack's box to the city's, ending with the set", async () => {
      await stackOf("Hyatt");
      const ground = boxes(box(44.2, 138, 301.6, 238.9), box(14, 138, 362, 286.8));
      tap(back());
      const step = find(take(), "frame");
      expect(ends(step, "transform")).toEqual(["translate(0px, -23.95px) scale(0.83315)", "translate(0px, 0px) scale(1)"]);
      expect([step.keyframes[step.keyframes.length - 1].offset, step.keyframes[step.keyframes.length - 2].easing]).toEqual([1, app.QUINT_BACK]);
      delete ground.getBoundingClientRect;
    });
    it("where the box did not change - a screen with room, a page with no layout - there is no step", async () => {
      const ground = boxes(box(14, 138, 362, 286.8), box(14, 138, 362, 286.8));
      lift("Hyatt");
      expect(of(take()).filter(what => /^frame/.test(what))).toEqual([]);
      delete ground.getBoundingClientRect;
      await stackOf("Westin");
      tap(back());
      expect(of(take()).filter(what => /^frame/.test(what))).toEqual([]);
    });
    it("no other move has one", async () => {
      await stackOf("Hyatt");
      const ground = boxes(box(14, 138, 362, 286.8), box(44.2, 138, 301.6, 238.9));
      drop(EXHIBIT);
      expect(of(take()).filter(what => /^frame/.test(what))).toEqual([]);
      delete ground.getBoundingClientRect;
    });
  });

  describe("the drop-in: a tap on a drawn plate", () => {
    it("starts one set of 550 over the venue's group and the city: the camera, the plate's tilt and lift, the other plates, every label, the city, and the level's names, outlines and streets", async () => {
      await stackOf("Hyatt");
      drop(EXHIBIT);
      const set = take();
      expect(of(set)).toEqual([
        "label acc opacity+visibility", "label ballroom+tower-ll1 opacity+visibility", `label ${EXHIBIT} opacity+visibility`, "label lobby opacity+visibility",
        "level-streets opacity", "map-city opacity+visibility", "names opacity", "plate acc opacity+visibility", "plate ballroom+tower-ll1 opacity+visibility",
        `plate ${EXHIBIT} transform`, "plate lobby opacity+visibility", "sel opacity", "stack-cam transform", `tilt ${EXHIBIT} transform`]);
      expect([span(set), set.every(anim => anim.options.id === MOTION && !("fill" in anim.options))]).toEqual([550, true]);
    });
    it("goes from the stack's own values to the level's: the camera, the tilt and the lift each from the attribute the stack's draw wrote to the one the level's wrote", async () => {
      await stackOf("Hyatt");
      const was = { cam: cam(), tilt: plate(EXHIBIT).querySelector(".plate-tilt").getAttribute("transform"), lift: plate(EXHIBIT).getAttribute("transform") };
      drop(EXHIBIT);
      const set = take();
      expect(ends(find(set, "stack-cam"), "transform")).toEqual([css(was.cam), css(cam())]);
      expect(ends(find(set, `tilt ${EXHIBIT}`), "transform")).toEqual([css(was.tilt), css(laid().querySelector(".plate-tilt").getAttribute("transform"))]);
      expect(ends(find(set, `plate ${EXHIBIT}`), "transform")).toEqual([css(was.lift), css(laid().getAttribute("transform"))]);
      expect(was.cam).not.toBe(cam());
    });
    it("the ground plate has no lift to undo, and the names come in over the last 45%", async () => {
      await stackOf("Hyatt");
      drop("acc");
      const set = take(), names = find(set, "names");
      expect(of(set).filter(what => /^plate acc/.test(what))).toEqual([]);
      expect(names.keyframes.map(f => [Math.round(f.offset * 100) / 100, f.opacity])).toEqual([[0, 0], [0.55, 0], [1, 1]]);
    });
    it("the same from Enter on the plate; a floor with no drawing is selected, as built, with no set - and cleared with none", async () => {
      await stackOf("Hyatt");
      plate("acc").focus();
      expect([press(plate("acc"), "Enter"), state.map.level, take().length]).toEqual([true, "acc", 13]);
      await stackOf("Westin");
      tap(plate("f12").querySelector(".plate-hull"));
      expect([state.map.plate, take().length]).toEqual(["f12", 0]);
      tap(plate("f12").querySelector(".plate-hull"));
      expect([state.map.plate, take().length]).toEqual([null, 0]);
    });
  });

  describe("the zoom", () => {
    it("a tap on a small room brings the camera to it: 240, the camera from the fit's own words to the room's, and the names for the new scale over its last 45%", async () => {
      await levelOf("Hyatt", EXHIBIT);
      const was = cam(), room = small("Hyatt", EXHIBIT);
      tap(shape(room.id));
      const set = take();
      expect([of(set), span(set)]).toEqual([["names opacity", "stack-cam transform"], 240]);
      expect(ends(find(set, "stack-cam"), "transform")).toEqual([css(was), css(cam())]);
      expect(find(set, "stack-cam").keyframes[0].easing).toBe(app.INOUT);
      expect(find(set, "names").keyframes.map(f => [Math.round(f.offset * 100) / 100, f.opacity])).toEqual([[0, 0], [0.55, 0], [1, 1]]);
      expect(state.map.zoom.id).toBe(room.id);
    });
    it("a room selected that does not move the camera starts none; and a tap off every room neither", async () => {
      await levelOf(GRAND, F1);
      tap(shape(BALLROOM));
      expect([state.map.rooms.map(r => r.id), state.map.zoom, take().length]).toEqual([[BALLROOM], null, 0]);
      tap(laid().querySelector(".plate-hull"));
      expect([state.map.rooms, take().length]).toEqual([null, 0]);
    });
    it("from room to room while close the camera moves alone where the scale does not change; the way back then is the zoom out, the names and the street names with it", async () => {
      await levelOf("Hyatt", EXHIBIT);
      const rooms = smalls("Hyatt", EXHIBIT);
      tap(shape(rooms[0].id)); await still();                    // the smallest: no other room asks for a closer camera
      const same = rooms[1], was = cam(), scale = state.map.zoom.scale;
      tap(shape(same.id));
      expect(state.map.zoom).toEqual({ level: same.level, id: same.id, scale });
      let set = take();
      expect(of(set)).toEqual(["stack-cam transform"]);
      expect(ends(set[0], "transform")).toEqual([css(was), css(cam())]);
      await finish(set);
      const close = cam();
      tap(back());
      set = take();
      expect([of(set), span(set), state.map.zoom, state.map.level]).toEqual([["level-streets opacity", "names opacity", "stack-cam transform"], 240, null, EXHIBIT]);
      expect(ends(find(set, "stack-cam"), "transform")).toEqual([css(close), css(cam())]);
      expect(ends(find(set, "level-streets"), "opacity")).toEqual([0, 1]);
    });
  });

  describe("each way back", () => {
    it("from a level: the drop-in mirrored, 65% of its span, from the level's own values to the stack's - by the control and by Escape", async () => {
      for (const go of [() => tap(back()), () => press(document.body, "Escape")]) {
        await levelOf("Hyatt", EXHIBIT);
        const was = { cam: cam(), tilt: laid().querySelector(".plate-tilt").getAttribute("transform") };
        go();
        const set = take();
        expect([state.map.level, span(set)]).toEqual([null, 357.5]);
        expect(of(set)).toEqual([
          "label acc opacity", "label ballroom+tower-ll1 opacity", `label ${EXHIBIT} opacity`, "label lobby opacity",
          "level-streets opacity", "map-city opacity", "names opacity", "plate acc opacity", "plate ballroom+tower-ll1 opacity",
          `plate ${EXHIBIT} transform`, "plate lobby opacity", "sel opacity", "stack-cam transform", `tilt ${EXHIBIT} transform`]);
        expect(ends(find(set, "stack-cam"), "transform")).toEqual([css(was.cam), css(cam())]);
        expect(ends(find(set, `tilt ${EXHIBIT}`), "transform")).toEqual([css(was.tilt), css(plate(EXHIBIT).querySelector(".plate-tilt").getAttribute("transform"))]);
        expect(find(set, "stack-cam").keyframes[0].easing).toBe(app.QUINT_BACK);
        expect(ends(find(set, "plate acc"), "opacity")).toEqual([0, 1]);
      }
    });
    it("from a stack: the lift mirrored, with the venue's group - put away by the draw - shown while it goes and its own block unseen until the end; by the control, by Escape and by a tap off the plates", async () => {
      for (const go of [() => tap(back()), () => press(document.body, "Escape"), () => tap(svg().querySelector(".map-ground"))]) {
        await stackOf("Hyatt");
        const was = cam();
        go();
        const set = take();
        expect([state.map.stack, group("Hyatt").hasAttribute("hidden"), span(set), set.length]).toEqual([null, true, 409.5, 29]);
        expect(find(set, "map-stack").keyframes.map(f => f.visibility)).toEqual(["visible", "visible"]);
        expect(ends(find(set, "block Hyatt"), "opacity")).toEqual([0, 0]);
        expect(ends(find(set, "stack-cam"), "transform")[0]).toBe(css(was));
        expect(ends(find(set, "map-cam"), "transform")[1]).toBe("translate(150px, 250px) scale(1) translate(-150px, -250px)");
        expect(ends(find(set, "map-cam"), "transform")[0]).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\(2\.2\) translate\(-150px, -250px\)$/);
        expect(ends(find(set, "stack-face", "opacity"), "opacity")).toEqual([0, 1]);
        expect(document.activeElement === block("Hyatt")).toBe(true);             // at once
      }
    });
  });

  describe("the arrival from an event's place line", () => {
    it("at one small room is one set of two beats: the drop-in from the venue's stack as it would stand to the level's fit, 550, and then the zoom to the room, 790 in all", async () => {
      await stackOf("Hyatt");
      const stack = cam();
      drop(EXHIBIT); await still();
      const fit = cam();
      city([IN_EXHIBIT]);
      app.showOnMap(IN_EXHIBIT);
      const set = take(), camera = find(set, "stack-cam");
      expect([span(set), state.map.level, state.map.zoom.id]).toEqual([790, EXHIBIT, "Grand Hall C"]);
      expect(camera.keyframes.map(f => f.transform)).toEqual([css(stack), css(fit), css(fit), css(cam())]);
      expect(camera.keyframes.map(f => Math.round(f.offset * 1000) / 1000)).toEqual([0, 0.696, 0.696, 1]);
      expect([camera.keyframes[0].easing, camera.keyframes[2].easing]).toEqual([app.QUINT, app.INOUT]);
      expect(of(set)).toEqual([
        "label acc opacity+visibility", "label ballroom+tower-ll1 opacity+visibility", `label ${EXHIBIT} opacity+visibility`, "label lobby opacity+visibility",
        "map-city opacity+visibility", "names opacity", "plate acc opacity+visibility", "plate ballroom+tower-ll1 opacity+visibility",
        `plate ${EXHIBIT} transform`, "plate lobby opacity+visibility", "sel opacity", "stack-cam transform", `tilt ${EXHIBIT} transform`]);
    });
    it("through its first beat the level shows no names: they and the room's outline come in over the second beat's last 45%", () => {
      city([IN_EXHIBIT]);
      app.showOnMap(IN_EXHIBIT);
      const set = take();
      for (const what of ["names", "sel"]) expect(find(set, what).keyframes.map(f => [Math.round(f.offset * 1000) / 1000, f.opacity]), what).toEqual([[0, 0], [0.863, 0], [1, 1]]);
      expect(laid().querySelector(".level-sel").childElementCount).toBe(1);
    });
    it("plays nothing of the lift, though it comes from the city map", () => {
      city([IN_EXHIBIT]);
      app.showOnMap(IN_EXHIBIT);
      expect(of(take()).filter(what => /^(map-cam|map-streets|block|stack-face|face-name|frame|map-layer)/.test(what))).toEqual([]);
    });
    it("at a level's fit - several rooms, small as they are, or a level alone - is the drop-in alone, 550, its names and the rooms' outlines over its last 45%", () => {
      const three = handle.events.find(e => e.hotel === "Hilton" && e.level === "l2" && e.rooms.join("+") === "209+210+211" && e._cd === "2026-09-05");
      app.showOnMap(three.id);
      let set = take();
      expect([span(set), state.map.zoom, state.map.rooms.map(r => r.id)]).toEqual([550, null, ["209", "210", "211"]]);
      expect(find(set, "stack-cam").keyframes).toHaveLength(2);
      for (const what of ["names", "sel", "level-streets"]) expect(find(set, what).keyframes.map(f => [Math.round(f.offset * 100) / 100, f.opacity]), what).toEqual([[0, 0], [0.55, 0], [1, 1]]);
      city();
      const none = handle.events.find(e => e.hotel === "Marriott" && e.level === "marquis" && !e.rooms.length && e._cd === "2026-09-05");
      app.showOnMap(none.id);
      set = take();
      expect([span(set), state.map.level, state.map.rooms]).toEqual([550, "marquis", null]);
    });
    it("where the Map last showed that level it is the zoom between the two cameras - and nothing where the camera does not move", async () => {
      await levelOf("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      const fit = cam();
      app.showOnMap(IN_EXHIBIT);
      let set = take();
      expect([of(set), span(set)]).toEqual([["names opacity", "stack-cam transform"], 240]);
      expect(ends(find(set, "stack-cam"), "transform")).toEqual([css(fit), css(cam())]);
      await finish(set);
      app.showOnMap(IN_EXHIBIT);
      expect(take()).toEqual([]);
      /* and from another tab, the level still as the Map last showed it */
      navTo("browse"); navTo("map"); take();
      app.showOnMap(IN_EXHIBIT);
      expect(take()).toEqual([]);
    });
    it("where the Map last showed another level of the venue, or its stack, it is the arrival from the stack as it would stand", async () => {
      await levelOf("Hyatt", "acc", [IN_EXHIBIT]);
      app.showOnMap(IN_EXHIBIT);
      expect(span(take())).toBe(790);
      await stackOf("Hyatt"); handle.picks.set([IN_EXHIBIT]);
      app.showOnMap(IN_EXHIBIT);
      expect(span(take())).toBe(790);
    });
    it("an arrival at a floor, and at a venue, is its end state: no set", () => {
      app.showOnMap(ON_A_FLOOR);
      expect([state.map.stack, state.map.plate, take().length]).toEqual(["Westin", "f12", 0]);
      city();
      const venue = handle.events.find(ev => app.onTheMap(ev) && app.depthOf(ev).depth === "venue");
      app.showOnMap(venue.id);
      expect([state.map.focus, state.map.stack, take().length]).toEqual([venue.id, null, 0]);
    });
  });

  describe("what starts no set", () => {
    it("a day chip, with the city, a stack or a level on screen", async () => {
      const chip = () => tap(view().querySelector(`[data-chip="map-day"][data-value="${SUN}"]`));
      chip();
      expect([state.map.day, take().length]).toEqual([SUN, 0]);
      await stackOf("Hyatt"); chip();
      expect([state.map.day, state.map.stack, take().length]).toEqual([SUN, "Hyatt", 0]);
      await levelOf("Hyatt", EXHIBIT); chip();
      expect([state.map.day, state.map.level, take().length]).toEqual([SUN, EXHIBIT, 0]);
    });
    it("the minute's tick, a draw of the whole page, and a new schedule", async () => {
      await levelOf("Hyatt", EXHIBIT);
      app.tickMap(); handle.render();
      app.replaceSchedule({ ...page.handle.meta, events: JSON.parse(JSON.stringify(page.handle.events)) }); handle.render();
      expect(take()).toEqual([]);
    });
    it("coming back to the Map tab, with a stack or a level kept; and a sheet opened and closed over the Map", async () => {
      await stackOf("Hyatt");
      navTo("browse"); navTo("map");
      expect([state.map.stack, take().length]).toEqual(["Hyatt", 0]);
      await levelOf("Hyatt", EXHIBIT);
      navTo("plans"); navTo("map");
      handle.openSheet("event", IN_EXHIBIT); handle.closeSheet();
      expect([state.map.level, take().length]).toEqual([EXHIBIT, 0]);
    });
    it("the Map opened afresh: a page's first draw of it", () => {
      expect([made.length, frames.length]).toEqual([0, 0]);
    });
  });

  describe("Reduce Motion, and a page with no animate()", () => {
    /* Every move there is, each by its own tap or key. */
    const walk = async () => {
      const seen = [];
      const look = () => { seen.push(picture()); };
      city([IN_EXHIBIT]); lift("Hyatt"); look();
      drop(EXHIBIT); look();
      tap(shape(small("Hyatt", EXHIBIT).id)); look();
      tap(back()); look();
      tap(back()); look();
      press(document.body, "Escape"); look();
      app.showOnMap(IN_EXHIBIT); look();
      await flush();
      return seen;
    };
    it("under prefers-reduced-motion: reduce no set starts, at any move: the page is its end states", async () => {
      reduce = true;
      const seen = await walk();
      expect([made.length, frames.length, seen.length]).toEqual([0, 0, 7]);
      expect([state.map.level, state.map.zoom.id]).toEqual([EXHIBIT, "Grand Hall C"]);
    });
    it("and it is read at each move: turned on mid-visit, the next move starts none; turned off, the next one plays", async () => {
      lift("Hyatt");
      expect(take().length).toBe(27);
      reduce = true;
      drop(EXHIBIT);
      expect(take()).toEqual([]);
      reduce = false;
      tap(back());
      expect(take().length).toBeGreaterThan(0);
    });
    it("with no animate() on an element no set starts and nothing throws: every move still lands on its end state", async () => {
      reduce = true;
      const want = await walk();
      reduce = false;
      delete Element.prototype.animate;
      const got = await walk();
      expect(got).toEqual(want);
      expect([made.length, frames.length]).toEqual([0, 0]);
    });
    it("with motion on, each view reached - its set finished - is the same page as under Reduce Motion", async () => {
      reduce = true;
      const want = await walk();
      reduce = false;
      const got = [];
      const look = async () => { await still(); got.push(picture()); };
      city([IN_EXHIBIT]); lift("Hyatt"); await look();
      drop(EXHIBIT); await look();
      tap(shape(small("Hyatt", EXHIBIT).id)); await look();
      tap(back()); await look();
      tap(back()); await look();
      press(document.body, "Escape"); await look();
      app.showOnMap(IN_EXHIBIT); await look();
      expect(got).toEqual(want);
    });
  });

  describe("a set is held at its first frame until that frame has come", () => {
    it("made paused, and started in the next animation frame - not before, and once", () => {
      lift("Hyatt");
      const set = take();
      expect([set.every(anim => anim.state === "held"), frames.length]).toEqual([true, 1]);
      frame();
      expect([set.every(anim => anim.state === "running" && anim.started === "played"), frames.length]).toEqual([true, 0]);
    });
    it("at that frame's own time, where the page has a timeline: the first frame painted is the set's first", () => {
      Object.defineProperty(document, "timeline", { value: { currentTime: 4321.5 }, configurable: true });
      lift("Hyatt");
      const set = take();
      frame();
      delete document.timeline;
      expect(set.every(anim => anim.state === "running" && anim.started === 4321.5)).toBe(true);
    });
    it("a held set is a running set: a tap on the drawing before its first frame is spent, and the frame then starts nothing", () => {
      lift("Hyatt");
      const set = take();
      tap(plate("acc").querySelector(".plate-hull"));
      expect([state.map.level, set.every(anim => anim.state === "cancelled")]).toEqual([null, true]);
      frame();
      expect([set.every(anim => anim.state === "cancelled"), take().length]).toEqual([true, 0]);
    });
  });

  describe("a tap or a key while a set runs", () => {
    it("a second tap on the hotel finishes the lift and does nothing more: the stack is open, with no level and nothing selected", () => {
      lift("Hyatt");
      const set = take();
      frame();
      tap(block("Hyatt").querySelector("rect"));
      expect([state.map.stack, state.map.level, state.map.plate, set.every(anim => anim.state === "cancelled"), take().length]).toEqual(["Hyatt", null, null, true, 0]);
      expect(plates().filter(p => p.matches(".selected, .flat")).length).toBe(0);
      /* and the tap after it acts */
      drop(EXHIBIT);
      expect([state.map.level, take().length]).toEqual([EXHIBIT, 14]);
    });
    it("a tap on a plate mid-lift opens no level, and one on a floor selects none; a tap on the drawing off the plates does not go back", async () => {
      for (const [hotel, key] of [["Hyatt", "acc"], ["Westin", "f12"]]) {
        city(); lift(hotel);
        const set = take();
        tap(plate(key).querySelector(".plate-hull"));
        expect([state.map.stack, state.map.level, state.map.plate, set.every(anim => anim.state === "cancelled"), take().length], key).toEqual([hotel, null, null, true, 0]);
      }
      city(); lift("Hyatt"); take();
      tap(svg().querySelector(".map-ground"));
      expect([state.map.stack, take().length]).toEqual(["Hyatt", 0]);
    });
    it("a tap on another room mid-zoom leaves the selection and the camera as they were", async () => {
      await levelOf("Hyatt", EXHIBIT);
      const rooms = app.levelPlaces(model("Hyatt", EXHIBIT)).filter(r => app.isSmall(r, fitOf("Hyatt", EXHIBIT).scale));
      tap(shape(rooms[0].id));
      const set = take(), was = cam();
      tap(shape(rooms[1].id));
      expect([state.map.rooms.map(r => r.id), state.map.zoom.id, cam() === was, set.every(anim => anim.state === "cancelled"), take().length]).toEqual([[rooms[0].id], rooms[0].id, true, true, 0]);
    });
    it("the way back mid-set finishes the set and then steps back: the set is ended before anything changes, and its way back plays", () => {
      lift("Hyatt");
      const set = take();
      tap(back());
      expect([state.map.stack, set.every(anim => anim.state === "cancelled")]).toEqual([null, true]);
      expect(set.every(anim => JSON.parse(anim.was).stack === "Hyatt")).toBe(true);      // finished while the stack was still the view
      expect(span(take())).toBe(409.5);
    });
    it("Enter on the focused control mid-set acts, and Escape steps back: a key is never spent, and the set is finished before it acts", async () => {
      lift("Hyatt");
      let set = take();
      plate("acc").focus();
      expect([press(plate("acc"), "Enter"), state.map.level, set.every(anim => anim.state === "cancelled"), span(take())]).toEqual([true, "acc", true, 550]);
      expect(set.every(anim => JSON.parse(anim.was).level === null)).toBe(true);        // finished while the stack was still the view
      /* and a key whose answer plays no set finishes the one that is playing all the same: Enter on a floor with no drawing */
      city(); lift("Westin");
      set = take();
      plate("f12").focus();
      expect([press(plate("f12"), "Enter"), state.map.plate, set.every(anim => anim.state === "cancelled"), take().length]).toEqual([true, "f12", true, 0]);
      await stackOf("Hyatt");
      drop(EXHIBIT);
      set = take();
      expect([press(document.body, "Escape"), state.map.level, set.every(anim => anim.state === "cancelled"), span(take())]).toEqual([true, null, true, 357.5]);
      expect(set.every(anim => JSON.parse(anim.was).level === EXHIBIT)).toBe(true);
    });
    it("a key held down is still one press: its repeats finish nothing and do nothing", () => {
      lift("Hyatt");
      const set = take();
      plate("acc").focus();
      expect([press(plate("acc"), "Enter", { repeat: true }), state.map.level, set.every(anim => anim.state === "held")]).toEqual([true, null, true]);
    });
    it("a day chip mid-set finishes the set and chooses the day, with no set of its own; a tap on the card's line too, and it opens its sheet", () => {
      lift("Hyatt");
      let set = take();
      tap(view().querySelector(`[data-chip="map-day"][data-value="${SUN}"]`));
      expect([state.map.day, state.map.stack, set.every(anim => anim.state === "cancelled"), take().length]).toEqual([SUN, "Hyatt", true, 0]);
      city(); lift("Hyatt");
      set = take();
      tap(el("mapVenue"));
      expect([el("sheetWrap").hidden, set.every(anim => anim.state === "cancelled")]).toEqual([false, true]);
    });
    it("a tap on another tab's page finishes nothing: it is the Map's taps that do", () => {
      lift("Hyatt");
      const set = take();
      navTo("browse");
      tap(el("view-browse"));
      expect(set.every(anim => anim.state === "held")).toBe(true);
    });
  });

  describe("a draw while a set runs", () => {
    it("the minute's tick writes in place as it would, and the set plays on", () => {
      lift("Hyatt");
      const set = take();
      frame();
      app.setOverride("2026-09-05T13:06");
      app.tickMap(); handle.render();
      expect([set.every(anim => anim.state === "running"), take().length, state.map.stack]).toEqual([true, 0, "Hyatt"]);
    });
  });

  describe("a closing level's names, outlines and street names", () => {
    const groups = () => [plate(F1).querySelector(".level-labels"), plate(F1).querySelector(".level-sel"), shown().querySelector(".level-streets")];
    const counts = () => groups().map(g => g.childElementCount);
    /* The Courtland Grand's 1st floor at its fit, the Georgia Ballroom selected: names, an outline and street names, as they stand. */
    const open = async () => { await levelOf(GRAND, F1); tap(shape(BALLROOM)); return [laid().querySelector(".level-labels"), laid().querySelector(".level-sel"), shown().querySelector(".level-streets")].map(g => g.innerHTML); };
    const stillPage = async () => { reduce = true; await open(); tap(back()); const want = picture(); reduce = false; return want; };
    it("are held in the page by the way back's set, as they stood, and fade over its first part", async () => {
      const was = await open();
      expect(was.every(html => html.length > 0)).toBe(true);
      tap(back());
      const set = take();
      expect([state.map.level, groups().map(g => g.innerHTML)]).toEqual([null, was]);
      for (const what of ["names", "sel", "level-streets"]) expect(find(set, what).keyframes.map(f => [Math.round(f.offset * 100) / 100, f.opacity]), what).toEqual([[0, 1], [0.45, 0], [1, 0]]);
    });
    it("and are emptied when the set ends: the page is then the Reduce Motion page", async () => {
      const want = await stillPage();
      await open(); tap(back());
      expect(counts().every(n => n > 0)).toBe(true);
      await finish(take());
      expect([counts(), picture() === want]).toEqual([[0, 0, 0], true]);
    });
    it("and when the set is finished early, by a tap or a key", async () => {
      const want = await stillPage();
      await open(); tap(back()); take();
      tap(svg().querySelector(".map-ground"));                   // spent: it finishes the set and no more
      expect([counts(), state.map.stack, picture() === want]).toEqual([[0, 0, 0], GRAND, true]);
      await open(); tap(back()); take();
      plate("f2").focus(); press(plate("f2"), "Enter");
      expect([state.map.level, plate(F1).querySelector(".level-labels").childElementCount, plate(F1).querySelector(".level-sel").childElementCount]).toEqual(["f2", 0, 0]);
    });
    it("and by any draw that comes while the set plays, with no error when the set then ends", async () => {
      const want = await stillPage();
      await open(); tap(back());
      const set = take();
      app.tickMap();
      expect([counts(), picture() === want, set.every(anim => anim.state === "held")]).toEqual([[0, 0, 0], true, true]);
      await finish(set);
      expect([counts(), picture() === want]).toEqual([[0, 0, 0], true]);
    });
    it("a level opened again while its way back still plays keeps its own words: the set that held the old ones, finished then, takes none of them out", async () => {
      await levelOf("Hyatt", EXHIBIT, [IN_EXHIBIT]);
      tap(back());
      const set = take();
      expect(plate(EXHIBIT).querySelector(".level-labels").childElementCount).toBeGreaterThan(0);        // held
      app.showOnMap(IN_EXHIBIT);                                 // an arrival: no tap of the Map's finished the set first
      expect([state.map.level, set.every(anim => anim.state === "cancelled")]).toEqual([EXHIBIT, true]);
      expect([laid().querySelector(".level-labels").childElementCount > 0, laid().querySelector(".level-sel").childElementCount]).toEqual([true, 1]);
    });
    it("a set ended from outside - its animations cancelled, not by a tap - is over all the same: it holds nothing, and the next tap on the drawing acts", async () => {
      await open(); tap(back());
      const set = take();
      set.forEach(anim => anim.cancel());
      await flush();
      expect(counts()).toEqual([0, 0, 0]);
      tap(plate(F1).querySelector(".plate-hull"));               // no set is running: the tap is not spent
      expect(state.map.level).toBe(F1);
    });
    it("under Reduce Motion nothing is put back: the closing draw's page stands", async () => {
      reduce = true;
      await open();
      tap(back());
      expect([counts(), made.length]).toEqual([[0, 0, 0], 0]);
    });
    it("from a zoom the way back is the zoom out, and holds nothing", async () => {
      await levelOf("Hyatt", EXHIBIT);
      tap(shape(small("Hyatt", EXHIBIT).id)); await still();
      tap(back());
      expect(of(take())).toEqual(["level-streets opacity", "names opacity", "stack-cam transform"]);
      expect(laid().querySelector(".level-labels").childElementCount).toBeGreaterThan(0);
    });
  });

  describe("the block's face", () => {
    it("is the one node the motion adds: last in the venue's camera, after its plates - the block's rectangle and its name, tilted as a plate is, hidden from a screen reader and taking no pointer by its own attributes", async () => {
      await stackOf("Hyatt");
      const camera = shown().querySelector(".stack-cam"), face = camera.lastElementChild;
      expect([face.getAttribute("class"), face.getAttribute("aria-hidden"), face.getAttribute("pointer-events"), [...face.children].map(n => n.tagName), face.textContent]).toEqual(["stack-face", "true", "none", ["rect", "text"], "HYATT"]);
      expect([camera.querySelectorAll(".stack-face").length, [...camera.children].slice(0, -1).every(n => n.matches(".plate")), face.getAttribute("transform")]).toEqual([1, true, plate("acc").querySelector(".plate-tilt").getAttribute("transform")]);
      expect(face.hasAttribute("tabindex") || face.hasAttribute("role")).toBe(false);
    });
    it("stands exactly on the block under the camera the lift starts from: the block's own size and middle, and its name's size", async () => {
      lift("Hyatt");
      const start = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/.exec(ends(find(take(), "stack-cam"), "transform")[0]).slice(1).map(Number);
      const rect = shown().querySelector(".stack-face rect"), text = shown().querySelector(".stack-face text"), n = name => Number(rect.getAttribute(name));
      const [tx, ty, scale] = start;
      expect(tx + scale * n("x")).toBeCloseTo(120, 1); expect(ty + scale * n("y")).toBeCloseTo(222, 1);
      expect(scale * n("width")).toBeCloseTo(60, 1); expect(scale * n("height")).toBeCloseTo(56, 1); expect(scale * n("rx")).toBeCloseTo(10, 1);
      expect(scale * Number(text.getAttribute("font-size"))).toBeCloseTo(11, 1);
    });
    it("a long name keeps the block's smaller size, and a venue with no drawing has one too, its block's own rectangle", async () => {
      await stackOf("Courtland Grand");
      expect([shown().querySelector(".stack-face text").getAttribute("class"), shown().querySelector(".stack-face text").textContent]).toEqual(["long", "COURTLAND"]);
      await stackOf("AmericasMart Building 3");
      const rect = shown().querySelector(".stack-face rect");
      expect(["x", "y", "width", "height", "rx"].map(name => rect.getAttribute(name))).toEqual(["0", "0", "72", "50", "10"]);
    });
    it("only the lift and its way back animate it: no other move's set touches it", async () => {
      await stackOf("Hyatt");
      drop(EXHIBIT);
      const sets = [take()];
      await finish(sets[0]);
      tap(shape(small("Hyatt", EXHIBIT).id)); sets.push(take()); await finish(sets[1]);
      tap(back()); sets.push(take()); await finish(sets[2]);
      tap(back()); sets.push(take()); await finish(sets[3]);
      expect(sets.flat().filter(anim => anim.el.closest(".stack-face")).length).toBe(0);
    });
  });
});
