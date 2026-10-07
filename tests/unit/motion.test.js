/* The motion's timelines (src/motion.js; DECISIONS #97): each move between
   the Map's views as a list of steps - what moves, by which property, from
   and to what, when, for how long and on which curve - worked out here by
   hand. No page and no venue: what the two draws say is a few made-up
   strings, and a list is plain data. tests/page/motion.test.js asks which
   tap plays which list and what map.js makes of it, and
   tests/browser/motion.spec.js plays them. New tests, not rows of
   tests/PORT-LEDGER.md. */
import { describe, expect, it } from "vitest";
import { DIM, INOUT, QUINT, QUINT_BACK, TIMES, cssOf, keyframes, spanOf, timeline } from "../../src/motion.js";

const near = (got, want) => expect(got).toBeCloseTo(want, 6);
/* What the two draws say of a lift for a venue of `count` plates: every
   string its own, so a step that took the wrong one is seen. */
const liftSaid = (count, frame = null) => ({
  count, city: ["city at rest", "city pushed in"], cam: ["cam at the block", "cam at the stack"], tilt: ["tilt flat", "tilt tilted"],
  lifts: Object.fromEntries(Array.from({ length: count - 1 }, (_, i) => [i + 1, [`plate ${i + 1} down`, `plate ${i + 1} up`]])), frame,
});
const DROP = { cam: ["cam at the stack", "cam at the fit"], tilt: ["tilt tilted", "tilt flat"], lift: ["plate up", "plate down"] };
const by = (list, what, property) => list.filter(s => s.what === what && (!property || s.property === property));
const one = (list, what, property) => { const found = by(list, what, property); expect(found, `${what} ${property || ""}`).toHaveLength(1); return found[0]; };
/* A step as [from, to, delay, duration, easing, show]. */
const row = s => [s.from, s.to, s.delay, s.duration, s.easing, s.show];
const LINEAR = "linear";

describe("the motion's timelines", () => {
  it("the design's numbers, every one in one place: round 6's timings, in ms and as shares, and its two curves", () => {
    expect(TIMES).toEqual({
      lift: 450, dim: 0.6, gone: 0.5, plates: 0.6, plate: 300, stagger: 30, cap: 250, face: [0.15, 0.45], faceName: 0.3, labels: 220,
      drop: 550, others: 0.5, plateLabels: 0.3, names: 0.45, zoom: 240, zoomNames: 0.45, back: 0.65,
    });
    expect([QUINT, INOUT]).toEqual(["cubic-bezier(.22,1,.36,1)", "cubic-bezier(.65,0,.35,1)"]);
    expect(QUINT_BACK).toBe("cubic-bezier(.64,0,.78,0)");            // the ease-out mirrored in time: (1 - x2, 1 - y2, 1 - x1, 1 - y1)
    expect(DIM).toEqual({ streets: 0.1, blocks: 0.2 });
  });

  describe("the lift, city to stack", () => {
    const list = timeline("lift", liftSaid(5));
    it("the cameras, the tilt and the face's tilt take the lift's 450 on the ease-out, each from one draw's own words to the other's", () => {
      for (const [what, from, to] of [["city-cam", "city at rest", "city pushed in"], ["stack-cam", "cam at the block", "cam at the stack"], ["tilts", "tilt flat", "tilt tilted"]]) {
        expect(row(one(list, what)), what).toEqual([from, to, 0, 450, QUINT, false]);
      }
      expect(row(one(list, "face", "transform"))).toEqual(["tilt flat", "tilt tilted", 0, 450, QUINT, false]);
    });
    it("over the first 60% the streets dim to .1 and the other blocks to .2; over the first half the pills, the rings and the focus's ring fade out, shown while they go", () => {
      expect(row(one(list, "streets"))).toEqual([1, 0.1, 0, 270, LINEAR, false]);
      expect(row(one(list, "blocks"))).toEqual([1, 0.2, 0, 270, LINEAR, false]);
      for (const what of ["pills", "rings", "focus"]) expect(row(one(list, what)), what).toEqual([1, 0, 0, 225, LINEAR, true]);
    });
    it("the face fades from 15% of the lift for 45% of it, shown while it goes, and its name over the first 30%", () => {
      expect(row(one(list, "face", "opacity"))).toEqual([1, 0, 67.5, 202.5, LINEAR, true]);
      expect(row(one(list, "face-name"))).toEqual([1, 0, 0, 135, LINEAR, false]);
    });
    it("each plate above the ground has its own lift of 300, the top plate first, 60% into the lift, the others 30 apart - and the ground plate none", () => {
      const lifts = list.filter(s => s.what.startsWith("plate:"));
      expect(lifts.map(s => [s.what, s.delay, s.duration, s.easing, s.property])).toEqual([
        ["plate:4", 270, 300, QUINT, "transform"], ["plate:3", 300, 300, QUINT, "transform"], ["plate:2", 330, 300, QUINT, "transform"], ["plate:1", 360, 300, QUINT, "transform"]]);
      expect(lifts.map(s => [s.from, s.to])).toEqual([["plate 4 down", "plate 4 up"], ["plate 3 down", "plate 3 up"], ["plate 2 down", "plate 2 up"], ["plate 1 down", "plate 1 up"]]);
      expect(by(list, "plate:0")).toEqual([]);
    });
    it("the plates' labels fade in last: the last 220 of the set", () => {
      expect(row(one(list, "plate-labels"))).toEqual([0, 1, 440, 220, LINEAR, false]);
    });
    it("its span is when its last plate lands: 450 for one plate, where the camera is the last of it, and 570 to 660 for two to five", () => {
      expect([1, 2, 3, 4, 5].map(count => spanOf(timeline("lift", liftSaid(count))))).toEqual([450, 570, 600, 630, 660]);
      expect(row(one(timeline("lift", liftSaid(1)), "plate-labels"))).toEqual([0, 1, 230, 220, LINEAR, false]);
      expect(timeline("lift", liftSaid(1)).filter(s => s.what.startsWith("plate:"))).toEqual([]);
    });
    it("the staggers are 250 in all at the most: ten plates are 30 apart still, and from eleven they close up, the last plate starting 250 after the first", () => {
      const starts = count => timeline("lift", liftSaid(count)).filter(s => s.what.startsWith("plate:")).map(s => s.delay);
      expect([starts(10)[1] - starts(10)[0], starts(10)[8] - starts(10)[0]]).toEqual([30, 240]);
      for (const count of [11, 13, 20]) {
        const at = starts(count);
        near(at[at.length - 1] - at[0], 250);
        near(at[1] - at[0], 250 / (count - 2));
        near(spanOf(timeline("lift", liftSaid(count))), 270 + 250 + 300);
      }
    });
    it("the frame's step is there only where the drawing's box changed: over the city camera's time and curve, from the box it had", () => {
      expect(by(list, "frame")).toEqual([]);
      expect(row(one(timeline("lift", liftSaid(5, ["frame as it was", "frame as it is"])), "frame"))).toEqual(["frame as it was", "frame as it is", 0, 450, QUINT, false]);
    });
  });

  describe("the way back from a stack", () => {
    it("is the lift mirrored in time, in 65% of its span: each step's two values changed about, its place counted from the end, its curve mirrored", () => {
      for (const count of [1, 2, 5]) {
        const way = timeline("lift", liftSaid(count)), back = timeline("lift-back", liftSaid(count)), span = spanOf(way);
        near(spanOf(back), span * 0.65);
        expect(back.length).toBe(way.length + 2);
        way.forEach((s, i) => {
          const b = back[i];
          expect([b.what, b.property, b.from, b.to, b.show], `${count}: ${s.what}`).toEqual([s.what, s.property, s.to, s.from, s.show]);
          near(b.delay, (span - s.delay - s.duration) * 0.65);
          near(b.duration, s.duration * 0.65);
          expect(b.easing).toBe(s.easing === QUINT ? QUINT_BACK : s.easing);
        });
      }
    });
    it("so the plates come down first, the ground's neighbour before the top, and the cameras end with the set", () => {
      const back = timeline("lift-back", liftSaid(5)), span = spanOf(back);
      expect(back.filter(s => s.what.startsWith("plate:")).sort((a, b) => a.delay - b.delay).map(s => s.what)).toEqual(["plate:1", "plate:2", "plate:3", "plate:4"]);
      near(one(back, "plate:1").delay, 0);
      for (const what of ["city-cam", "stack-cam", "tilts"]) { const s = one(back, what); near(s.delay + s.duration, span); expect(s.easing).toBe(QUINT_BACK); }
      expect([one(back, "city-cam").from, one(back, "city-cam").to]).toEqual(["city pushed in", "city at rest"]);
    });
    it("the venue's group, which the draw has put away, is shown for the whole span, and its own block is not: the face stands for it until the set ends", () => {
      const back = timeline("lift-back", liftSaid(5)), span = spanOf(back);
      expect(row(one(back, "stack"))).toEqual(["visible", "visible", 0, span, LINEAR, false]);
      expect(one(back, "stack").property).toBe("visibility");
      expect(row(one(back, "block"))).toEqual([0, 0, 0, span, LINEAR, false]);
      expect([by(timeline("lift", liftSaid(5)), "stack"), by(timeline("lift", liftSaid(5)), "block")]).toEqual([[], []]);
    });
    it("the frame's step is this move's own, from the box before the draw, and ends with the set as the city's camera does", () => {
      const back = timeline("lift-back", liftSaid(5, ["frame as it was", "frame as it is"])), frame = one(back, "frame"), camera = one(back, "city-cam");
      expect([frame.from, frame.to, frame.easing]).toEqual(["frame as it was", "frame as it is", QUINT_BACK]);
      near(frame.delay, camera.delay); near(frame.duration, camera.duration);
      expect(by(timeline("lift-back", liftSaid(5)), "frame")).toEqual([]);
    });
  });

  describe("the drop-in, stack to level", () => {
    const list = timeline("drop", DROP);
    it("the venue's camera, the plate's tilt and its lift take the whole 550 on the ease-out, each to the level's own value", () => {
      expect(row(one(list, "stack-cam"))).toEqual(["cam at the stack", "cam at the fit", 0, 550, QUINT, false]);
      expect(row(one(list, "tilt"))).toEqual(["tilt tilted", "tilt flat", 0, 550, QUINT, false]);
      expect(row(one(list, "plate"))).toEqual(["plate up", "plate down", 0, 550, QUINT, false]);
      expect(spanOf(list)).toBe(550);
    });
    it("the ground plate has no lift to undo", () => {
      expect(by(timeline("drop", { ...DROP, lift: null }), "plate")).toEqual([]);
    });
    it("over the first half the other plates and the city fade out, the plates' labels sooner, each shown while it goes", () => {
      expect(row(one(list, "others"))).toEqual([1, 0, 0, 275, LINEAR, true]);
      expect(row(one(list, "city"))).toEqual([1, 0, 0, 275, LINEAR, true]);
      expect(row(one(list, "plate-labels"))).toEqual([1, 0, 0, 165, LINEAR, true]);
    });
    it("the level's names, the selected rooms' outlines and the street names fade in over the last 45%", () => {
      for (const what of ["names", "sel", "level-streets"]) {
        const s = one(list, what);
        expect([s.from, s.to, s.easing, s.show], what).toEqual([0, 1, LINEAR, false]);
        near(s.delay, 302.5); near(s.duration, 247.5);
      }
    });
    it("the city's camera has no step - its two draws say the same - and nothing of the lift is played", () => {
      expect(list.map(s => s.what)).toEqual(["stack-cam", "tilt", "plate", "others", "plate-labels", "city", "names", "sel", "level-streets"]);
    });
  });

  describe("the way back from a level", () => {
    const way = timeline("drop", DROP), back = timeline("drop-back", DROP);
    it("is the drop-in mirrored in time, in 65% of its span, and shows nothing the stack's end state does not", () => {
      near(spanOf(back), 357.5);
      expect(back.map(s => s.what)).toEqual(way.map(s => s.what));
      way.forEach((s, i) => {
        expect([back[i].property, back[i].from, back[i].to, back[i].show], s.what).toEqual([s.property, s.to, s.from, false]);
        near(back[i].delay, (550 - s.delay - s.duration) * 0.65);
        near(back[i].duration, s.duration * 0.65);
        expect(back[i].easing).toBe(s.easing === QUINT ? QUINT_BACK : s.easing);
      });
    });
    it("the names, the outlines and the street names go first, over its first part; the other plates and the city come back over its second half", () => {
      for (const what of ["names", "sel", "level-streets"]) { const s = one(back, what); expect([s.from, s.to, s.delay]).toEqual([1, 0, 0]); near(s.duration, 160.875); }
      for (const what of ["others", "city"]) { const s = one(back, what); expect([s.from, s.to]).toEqual([0, 1]); near(s.delay, 178.75); near(s.delay + s.duration, 357.5); }
    });
  });

  describe("the zoom", () => {
    it("is the camera alone, 240 on the in-out curve, where the scale does not change: from room to room", () => {
      expect(timeline("zoom", { cam: ["cam a", "cam b"], names: false, streets: false }).map(s => [s.what, ...row(s)])).toEqual([["stack-cam", "cam a", "cam b", 0, 240, INOUT, false]]);
    });
    it("where the scale changes the names for the new one come in over its last 45%", () => {
      const list = timeline("zoom", { cam: ["cam a", "cam b"], names: true, streets: false }), names = one(list, "names");
      expect(list.map(s => s.what)).toEqual(["stack-cam", "names"]);
      expect([names.from, names.to, names.easing]).toEqual([0, 1, LINEAR]);
      near(names.delay, 132); near(names.duration, 108);
      expect(spanOf(list)).toBe(240);
    });
    it("back at the whole level the street names fade in over all of it; the outline waits with the names only where it is asked to", () => {
      const out = timeline("zoom", { cam: ["cam a", "cam b"], names: true, streets: true });
      expect(out.map(s => s.what)).toEqual(["stack-cam", "names", "level-streets"]);
      expect(row(one(out, "level-streets"))).toEqual([0, 1, 0, 240, LINEAR, false]);
      const waits = one(timeline("zoom", { cam: ["cam a", "cam b"], names: true, sel: true }), "sel");
      near(waits.delay, 132); near(waits.duration, 108);
    });
    it("the in-out curve is its own mirror: a zoom has no way back of its own", () => {
      const [x1, y1, x2, y2] = /\(([^)]+)\)/.exec(INOUT)[1].split(",").map(Number);
      expect([1 - x2, 1 - y2, 1 - x1, 1 - y1].map(v => Math.round(v * 100) / 100)).toEqual([x1, y1, x2, y2]);
    });
  });

  describe("the arrival at a level", () => {
    it("at the level's fit is the drop-in alone, as a tap on its plate plays it: 550", () => {
      const list = timeline("arrive", { ...DROP, zoom: null });
      expect(list).toEqual(timeline("drop", DROP));
      expect(spanOf(list)).toBe(550);
    });
    it("at one small room is two beats in one set: the drop-in to the fit, its steps as a tap plays them, and then the zoom's, 790 in all", () => {
      const list = timeline("arrive", { ...DROP, zoom: ["cam at the fit", "cam on the room"] });
      const first = timeline("drop", DROP).filter(s => !["names", "sel", "level-streets"].includes(s.what));
      expect(list.slice(0, first.length)).toEqual(first);
      const second = timeline("zoom", { cam: ["cam at the fit", "cam on the room"], names: true, sel: true });
      expect(list.slice(first.length)).toEqual(second.map(s => ({ ...s, delay: s.delay + 550 })));
      expect(spanOf(list)).toBe(790);
    });
    it("the camera goes to the fit and then to the room, never to the room in one move", () => {
      const cams = by(timeline("arrive", { ...DROP, zoom: ["cam at the fit", "cam on the room"] }), "stack-cam");
      expect(cams.map(row)).toEqual([["cam at the stack", "cam at the fit", 0, 550, QUINT, false], ["cam at the fit", "cam on the room", 550, 240, INOUT, false]]);
    });
    it("through the first beat the level shows no names: they and the room's outline come in over the second beat's last 45%, and no street names, which a zoomed level has none of", () => {
      const list = timeline("arrive", { ...DROP, zoom: ["cam at the fit", "cam on the room"] });
      for (const what of ["names", "sel"]) { const s = one(list, what); expect([s.from, s.to]).toEqual([0, 1]); near(s.delay, 550 + 132); near(s.duration, 108); }
      expect(by(list, "level-streets")).toEqual([]);
    });
    it("plays nothing of the lift: no camera of the city's, no face, no plate's own lift, no frame", () => {
      for (const zoom of [null, ["cam at the fit", "cam on the room"]]) {
        const whats = timeline("arrive", { ...DROP, zoom }).map(s => s.what);
        expect(whats.filter(what => /^(city-cam|streets|blocks|pills|rings|focus|tilts|face|face-name|frame|block|stack)$|^plate:/.test(what))).toEqual([]);
      }
    });
  });

  describe("every move", () => {
    const moves = [["lift", liftSaid(5, ["a", "b"])], ["lift-back", liftSaid(5, ["a", "b"])], ["drop", DROP], ["drop-back", DROP],
      ["zoom", { cam: ["a", "b"], names: true, streets: true, sel: true }], ["arrive", { ...DROP, zoom: ["a", "b"] }], ["arrive", { ...DROP, zoom: null }]];
    it("animates transform, opacity and visibility, and no other property", () => {
      for (const [move, said] of moves) expect([...new Set(timeline(move, said).map(s => s.property))].filter(p => !["transform", "opacity", "visibility"].includes(p)), move).toEqual([]);
    });
    it("a transform's two values are the draws' own words, as handed in: nothing is worked out again", () => {
      for (const [move, said] of moves) {
        const handed = new Set([said.city, said.cam, said.tilt, said.frame, said.lift, said.zoom, ...Object.values(said.lifts || {})].filter(Boolean).flat());
        for (const s of timeline(move, said).filter(s => s.property === "transform")) expect([handed.has(s.from), handed.has(s.to)], `${move} ${s.what}`).toEqual([true, true]);
      }
    });
    it("no step starts before the set or runs for no time", () => {
      for (const [move, said] of moves) for (const s of timeline(move, said)) expect(s.delay >= 0 && s.duration > 0, `${move} ${s.what}`).toBe(true);
    });
  });

  describe("a draw's words as CSS says them", () => {
    it("every digit kept: a length in px, an angle in degrees, a scale as it is", () => {
      expect(cssOf("translate(72.776 220.39) scale(0.47245)")).toBe("translate(72.776px, 220.39px) scale(0.47245)");
      expect(cssOf("translate(187.5 250) skewX(-30) scale(1 0.5) translate(-187.5 -250)")).toBe("translate(187.5px, 250px) skewX(-30deg) scale(1, 0.5) translate(-187.5px, -250px)");
      expect(cssOf("translate(0 0)")).toBe("translate(0px, 0px)");
      expect(cssOf("translate(337 250) scale(2.2) translate(-337 -250)")).toBe("translate(337px, 250px) scale(2.2) translate(-337px, -250px)");
    });
  });

  describe("a node's keyframes", () => {
    it("run the set's whole span: the first value held until the step starts, the step's curve on its own stretch, the last value held to the end", () => {
      const frames = keyframes([{ property: "opacity", from: 0, to: 1, delay: 440, duration: 220, easing: "linear", show: false }], 880);
      expect(frames).toEqual([{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 0, easing: "linear" }, { offset: 0.75, opacity: 1 }, { offset: 1, opacity: 1 }]);
    });
    it("a step that starts with the set and ends with it is its two values and no more", () => {
      expect(keyframes([{ property: "transform", from: "translate(1 2)", to: "translate(3 4)", delay: 0, duration: 450, easing: QUINT, show: false }], 450))
        .toEqual([{ offset: 0, transform: "translate(1px, 2px)", easing: QUINT }, { offset: 1, transform: "translate(3px, 4px)" }]);
    });
    it("a thing shown while it goes is visible in every keyframe, from the set's first frame to its last", () => {
      const frames = keyframes([{ property: "opacity", from: 1, to: 0, delay: 0, duration: 225, easing: "linear", show: true }], 450);
      expect(frames).toEqual([{ offset: 0, opacity: 1, visibility: "visible", easing: "linear" }, { offset: 0.5, opacity: 0, visibility: "visible" }, { offset: 1, opacity: 0, visibility: "visible" }]);
    });
    it("two steps of one property are one animation, the second starting where the first ended: an arrival's camera", () => {
      const cams = by(timeline("arrive", { cam: ["translate(1 1) scale(1)", "translate(2 2) scale(2)"], tilt: ["a", "b"], lift: null, zoom: ["translate(2 2) scale(2)", "translate(3 3) scale(3)"] }), "stack-cam");
      const frames = keyframes(cams, 790);
      expect(frames.map(f => f.transform)).toEqual(["translate(1px, 1px) scale(1)", "translate(2px, 2px) scale(2)", "translate(2px, 2px) scale(2)", "translate(3px, 3px) scale(3)"]);
      expect(frames.map(f => f.easing)).toEqual([QUINT, undefined, INOUT, undefined]);
      near(frames[1].offset, 550 / 790); near(frames[2].offset, 550 / 790);
      expect([frames[0].offset, frames[3].offset]).toEqual([0, 1]);
    });
    it("every list's keyframes stand in order within the span, and carry no fill of their own", () => {
      for (const [move, said] of [["lift", liftSaid(5, ["translate(1 1) scale(1.2)", "translate(0 0) scale(1)"])], ["lift-back", liftSaid(5)], ["drop-back", DROP], ["arrive", { ...DROP, zoom: ["a", "b"] }]]) {
        const list = timeline(move, said), span = spanOf(list);
        for (const s of list) {
          const frames = keyframes([s], span), offsets = frames.map(f => f.offset);
          expect(offsets[0], `${move} ${s.what}`).toBe(0);
          expect(offsets[offsets.length - 1], `${move} ${s.what}`).toBe(1);
          expect(offsets.every((o, i) => !i || o >= offsets[i - 1])).toBe(true);
          expect(frames.some(f => "fill" in f)).toBe(false);
        }
      }
    });
  });
});
