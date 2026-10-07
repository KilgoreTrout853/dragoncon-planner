/* The stack's layout (src/stack.js; DECISIONS #95): a venue's plates tilted,
   stood apart and fitted in a frame, as numbers worked out here by hand. No
   page and no venue: an outline is a few points, and a frame four numbers.
   tests/real-data.test.js asks the same of the seven real venues, and
   tests/page/stack.test.js of what the Map draws from it. New tests, not
   rows of tests/PORT-LEDGER.md. */
import { describe, expect, it } from "vitest";
import { MARGIN, MIN_WIDE, PUSH, SKEW, SQUASH, STRIP, blockOutline, bounds, project, stackLayout } from "../../src/stack.js";

/* How far a point leans for each unit it stands back: the skew, squashed. */
const LEAN = Math.tan(30 * Math.PI / 180) / 2;
const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]];
/* A frame whose room, inside the margins, is 376 by 240. */
const FRAME = { x: 10, y: 20, w: 400, h: 300 };
const near = (got, want) => expect(got).toBeCloseTo(want, 6);

describe("the stack's layout", () => {
  it("the design's numbers: a 30 degree skew, half the depth, the city pushed in 2.2 times, a 40 strip, 55% of the frame, and the margins that clear the back control", () => {
    expect([SKEW, SQUASH, PUSH, STRIP, MIN_WIDE]).toEqual([30, 0.5, 2.2, 40, 0.55]);
    expect(MARGIN).toEqual({ l: 12, r: 12, t: 46, b: 14 });
  });

  describe("a point projected", () => {
    const centre = [100, 50];
    it("on the centre's row it stands where it stood", () => {
      expect(project([100, 50], centre)).toEqual([100, 50]);
      expect(project([160, 50], centre)).toEqual([160, 50]);
    });
    it("further back it leans right and stands half as far back; nearer, left and half as near", () => {
      const back = project([100, 0], centre), front = project([100, 100], centre);
      near(back[0], 100 + 50 * LEAN); near(back[1], 25);
      near(front[0], 100 - 50 * LEAN); near(front[1], 75);
    });
    it("a lift takes it straight up the page, and moves it no other way", () => {
      const flat = project([30, 10], centre), lifted = project([30, 10], centre, 12);
      expect([lifted[0], lifted[1]]).toEqual([flat[0], flat[1] - 12]);
    });
  });

  describe("a plate's outline projected", () => {
    it("a square becomes a parallelogram half as deep, its far side leaning right", () => {
      const flat = SQUARE.map(p => project(p, [50, 50]));
      const want = [[50 * LEAN, 25], [100 + 50 * LEAN, 25], [100 - 50 * LEAN, 75], [-50 * LEAN, 75]];
      flat.forEach((p, i) => { near(p[0], want[i][0]); near(p[1], want[i][1]); });
      const box = bounds(flat);
      near(box.w, 100 + 100 * LEAN); near(box.h, 50);
    });
    it("bounds(): the box some points stand in", () => {
      expect(bounds([[3, 9], [-2, 4], [7, 5]])).toEqual({ x0: -2, y0: 4, x1: 7, y1: 9, w: 9, h: 5 });
    });
  });

  describe("the spacing", () => {
    const flatW = 100 + 100 * LEAN, widest = 376 / flatW;
    it("where the strip holds at the stack's full width, the plates stand 40 apart and are as wide as the room allows", () => {
      for (const count of [2, 3]) {                          // 145.9 deep at full width, and 40 or 80 of strips: inside 240
        const at = stackLayout(SQUARE, count, FRAME);
        near(at.scale, widest); near(at.strip, STRIP); near(at.gap, STRIP / widest); near(at.wide, 100 * widest);
      }
    });
    it("where the frame is too short for that, the plates narrow until each strip is 40 again", () => {
      const at = stackLayout(SQUARE, 4, FRAME);              // 240 less three strips leaves 120 for a plate 50 deep
      near(at.scale, 2.4); near(at.strip, STRIP); near(at.wide, 240);
      expect(at.wide).toBeGreaterThanOrEqual(MIN_WIDE * FRAME.w);
    });
    it("and where a 40 strip would take a plate under 55% of the frame, the width wins and the strip is what is left", () => {
      const at = stackLayout(SQUARE, 5, FRAME);              // four strips of 40 would leave 80: a plate 160 wide
      near(at.wide, MIN_WIDE * FRAME.w); near(at.scale, 2.2);
      near(at.strip, (240 - 50 * 2.2) / 4);
      expect(at.strip).toBeLessThan(STRIP);
      near(at.gap * at.scale, at.strip);
    });
    it("one plate has nothing above it: no gap, and as large as the room allows", () => {
      const at = stackLayout(SQUARE, 1, FRAME);
      near(at.scale, widest); expect([at.gap, at.strip]).toEqual([0, 0]);
      expect(at.plates).toHaveLength(1);
      near(stackLayout([[0, 0], [100, 0], [100, 400], [0, 400]], 1, FRAME).scale, 240 / 200);   // a deep one is held by the room's height
    });
    it("an outline too deep for the room at 55% still stands inside it, its plates together", () => {
      const deep = [[0, 0], [100, 0], [100, 2000], [0, 2000]], at = stackLayout(deep, 2, FRAME);
      near(at.scale, 240 / 1000); near(at.strip, 0);
      for (const box of at.plates) expect(box.y1 - box.y0).toBeLessThanOrEqual(240 + 1e-9);
    });
    it("and a deep, narrow outline in a narrow frame is held by the room's width before the 55%: no plate is wider than the room, and the strip is what the height leaves", () => {
      const narrow = { x: 0, y: 0, w: 200, h: 400 }, deep = [[0, 0], [20, 0], [20, 100], [0, 100]];     // a room 176 by 340; at 55% of the frame its lean would take a plate to 269
      const at = stackLayout(deep, 6, narrow);
      near(at.scale, 176 / (20 + 100 * LEAN));
      near(at.strip, (340 - 50 * at.scale) / 5);
      expect(at.strip).toBeLessThan(STRIP);
      for (const box of at.plates) { expect(box.x0).toBeGreaterThanOrEqual(12 - 1e-9); expect(box.x1).toBeLessThanOrEqual(188 + 1e-9); }
    });
  });

  describe("the fit inside the frame", () => {
    const inside = at => {
      const left = FRAME.x + MARGIN.l, right = FRAME.x + FRAME.w - MARGIN.r, top = FRAME.y + MARGIN.t, bottom = FRAME.y + FRAME.h - MARGIN.b;
      const all = bounds(at.plates.flatMap(b => [[b.x0, b.y0], [b.x1, b.y1]]));
      return { all, gaps: [all.x0 - left, right - all.x1, all.y0 - top, bottom - all.y1] };
    };
    it("every plate stands inside the margins, the stack in the middle of the room: as much to its left as its right, above as below", () => {
      for (const count of [1, 2, 4, 5]) {
        const { gaps } = inside(stackLayout(SQUARE, count, FRAME));
        for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(-1e-9);
        near(gaps[0], gaps[1]); near(gaps[2], gaps[3]);
      }
    });
    it("at its full width it fills the room from side to side; narrowed for its strips, from top to bottom", () => {
      const wide = inside(stackLayout(SQUARE, 2, FRAME)).gaps, tall = inside(stackLayout(SQUARE, 4, FRAME)).gaps;
      near(wide[0], 0); expect(wide[2]).toBeGreaterThan(1);
      near(tall[2], 0); expect(tall[0]).toBeGreaterThan(1);
    });
    it("the plates stand bottom to top, each a strip above the one below and no other way moved", () => {
      const at = stackLayout(SQUARE, 4, FRAME);
      at.plates.forEach((box, j) => {
        near(box.y1, at.plates[0].y1 - j * at.strip); near(box.y0, at.plates[0].y0 - j * at.strip);
        near(box.x0, at.plates[0].x0); near(box.x1, at.plates[0].x1);
      });
    });
    it("a point of the outline stands at tx + scale * x, ty + scale * y once projected - the ground plate's centre among them, and its corners its box", () => {
      const at = stackLayout(SQUARE, 3, FRAME), to = p => [at.tx + at.scale * p[0], at.ty + at.scale * p[1]];
      expect(at.centre).toEqual([50, 50]);
      const ground = to(project(at.centre, at.centre));
      near(at.ground[0], ground[0]); near(at.ground[1], ground[1]);
      const box = bounds(SQUARE.map(p => to(project(p, at.centre))));
      near(box.x0, at.plates[0].x0); near(box.y1, at.plates[0].y1);
      const top = bounds(SQUARE.map(p => to(project(p, at.centre, 2 * at.gap))));
      near(top.y0, at.plates[2].y0); near(top.x1, at.plates[2].x1);
    });
    it("the margins are a parameter: with none, the stack fills the frame", () => {
      const at = stackLayout(SQUARE, 2, FRAME, { l: 0, r: 0, t: 0, b: 0 });
      const all = bounds(at.plates.flatMap(b => [[b.x0, b.y0], [b.x1, b.y1]]));
      near(all.x0, FRAME.x); near(all.x1, FRAME.x + FRAME.w);
    });
  });

  describe("a venue with no hull", () => {
    it("is given its block's own shape: the block's rectangle, from 0, 0, whatever its place on the Map", () => {
      expect(blockOutline({ x: 12, y: 270, w: 72, h: 50 })).toEqual([[0, 0], [72, 0], [72, 50], [0, 50]]);
    });
    it("and stands as any outline does: four floors of a 72 by 50 block, each strip 40, the plates as wide as the room", () => {
      const at = stackLayout(blockOutline({ x: 12, y: 270, w: 72, h: 50 }), 4, FRAME), flatW = 72 + 50 * LEAN;
      near(at.scale, 376 / flatW); near(at.strip, STRIP); near(at.wide, 72 * 376 / flatW);
      expect(at.centre).toEqual([36, 25]);
    });
  });
});
