/* The level's layout (src/level.js; DECISIONS #96): a plate laid flat in a
   frame, its rooms' names and their sizes, the room a point is nearest, the
   zoom's camera and what rooms selected together are called - as numbers
   worked out here by hand. No page and no venue: a plate is a few
   rectangles, in feet, each saying its level, and a frame four numbers.
   tests/real-data.test.js asks the same of the 18 real level views, and
   tests/page/level.test.js of what the Map draws from it. New tests, not
   rows of tests/PORT-LEDGER.md. */
import { describe, expect, it } from "vitest";
import {
  FULL, LEAST, LEVEL_MARGIN, NAMES_FROM, REACH, SMALL, ZOOM_CAP, ZOOM_DROP, ZOOM_TO,
  cameraOn, corners, isSmall, levelFit, levelLabels, levelPlaces, namedTogether, nearest, placeKey, roomLabel, shortNames, zoomScale,
} from "../../src/level.js";

/* A frame whose room, inside the level's margins, is 360 by 198. */
const FRAME = { x: 10, y: 20, w: 400, h: 300 };
const near = (got, want) => expect(got).toBeCloseTo(want, 6);
const rect = (cx, cy, w, h, rot = 0) => ({ cx, cy, w, h, rot });
const room = (id, shape, level = "x") => ({ id, level, ...shape });
const plate = parts => ({ rooms: [], open: [], groups: [], landmarks: [], composites: [], ...parts });
const group = (name, rooms, outline, level = "x", kind = "run") => ({ name, kind, rooms, outline, level });
const NONE = new Map();

describe("the level's layout", () => {
  it("the design's numbers, all of the Map's units: a full name at 11, no label under 8, a reach of 22, a room under 44 zooms until it is 62 across, at most 7 a foot, 12 below the middle; a landmark's name from 1.5; and the margins that clear the way back", () => {
    expect([FULL, LEAST, REACH, SMALL, ZOOM_TO, ZOOM_CAP, ZOOM_DROP, NAMES_FROM]).toEqual([11, 8, 22, 44, 62, 7, 12, 1.5]);
    expect(LEVEL_MARGIN).toEqual({ l: 20, r: 20, t: 72, b: 30 });
  });

  describe("a rectangle's corners", () => {
    it("with no turn: its box, from the top left round", () => {
      expect(corners(rect(50, 30, 40, 20))).toEqual([[30, 20], [70, 20], [70, 40], [30, 40]]);
      expect(corners({ cx: 50, cy: 30, w: 40, h: 20 })).toEqual([[30, 20], [70, 20], [70, 40], [30, 40]]);        // no rot is no turn
    });
    it("turned a quarter clockwise, where y runs south: its long side stands north to south", () => {
      const got = corners(rect(0, 0, 40, 20, 90)), want = [[10, -20], [10, 20], [-10, 20], [-10, -20]];
      got.forEach((p, i) => { near(p[0], want[i][0]); near(p[1], want[i][1]); });
    });
  });

  describe("what a tap can select", () => {
    it("the identified open areas, then the rooms, as they are painted; an open area with no id is scenery", () => {
      const p = plate({ rooms: [room("A", rect(0, 0, 10, 10)), room("B", rect(20, 0, 10, 10))],
        open: [{ name: "Lobby", level: "x", ...rect(0, 0, 50, 50) }, { name: "Concourse", id: "Concourse", level: "x", ...rect(10, 40, 30, 10) }] });
      expect(levelPlaces(p).map(place => place.id)).toEqual(["Concourse", "A", "B"]);
    });
  });

  describe("the fit inside the frame", () => {
    it("a wide level is held by the width: it fills the room from side to side, as far from its top as from its foot", () => {
      const at = levelFit(plate({ rooms: [room("A", rect(100, 35, 180, 60))] }), FRAME);          // a box 180 by 60, from 10, 5
      near(at.scale, 2);
      near(at.tx + at.scale * 10, FRAME.x + LEVEL_MARGIN.l);
      near(at.tx + at.scale * 190, FRAME.x + FRAME.w - LEVEL_MARGIN.r);
      const top = at.ty + at.scale * 5 - (FRAME.y + LEVEL_MARGIN.t), foot = FRAME.y + FRAME.h - LEVEL_MARGIN.b - (at.ty + at.scale * 65);
      near(top, 39); near(foot, 39);
    });
    it("a tall one by the height: from the margin under the way back to the one at the foot, in the middle from side to side", () => {
      const at = levelFit(plate({ rooms: [room("A", rect(30, 99, 60, 198))] }), FRAME);          // 60 by 198, from 0, 0
      near(at.scale, 1);
      near(at.ty, FRAME.y + LEVEL_MARGIN.t);
      near(at.ty + 198, FRAME.y + FRAME.h - LEVEL_MARGIN.b);
      near(at.tx - (FRAME.x + LEVEL_MARGIN.l), 150); near(FRAME.x + FRAME.w - LEVEL_MARGIN.r - (at.tx + 60), 150);
    });
    it("it is fitted to every room and open area, scenery too, and to a turned room's true corners", () => {
      const rooms = [room("A", rect(50, 50, 20, 20))];
      near(levelFit(plate({ rooms }), FRAME).scale, 198 / 20);
      near(levelFit(plate({ rooms, open: [{ name: "Lobby", level: "x", ...rect(140, 50, 200, 20) }] }), FRAME).scale, 360 / 200);
      near(levelFit(plate({ rooms: [room("T", rect(50, 50, 180, 20, 90))] }), FRAME).scale, 198 / 180);       // on its end, 180 deep
    });
    it("the margins are a parameter: with none, the level fills the frame", () => {
      const at = levelFit(plate({ rooms: [room("A", rect(100, 75, 200, 150))] }), FRAME, { l: 0, r: 0, t: 0, b: 0 });
      near(at.scale, 2); near(at.tx, FRAME.x); near(at.ty, FRAME.y);
    });
  });

  describe("the short names", () => {
    const key = (id, level = "x") => placeKey({ level, id });
    it("a group's members lose the words they all begin with: Grand Hall A is A", () => {
      const ids = ["Grand Hall A", "Grand Hall B", "Grand Hall C"], p = plate({ rooms: ids.map(id => room(id, rect(0, 0, 10, 10))), groups: [group("Grand Hall A–C", ids, rect(0, 0, 30, 10))] });
      expect(ids.map(id => shortNames(p).get(key(id)))).toEqual(["A", "B", "C"]);
    });
    it("rooms in no group lose the words shared by every room that begins with their first word", () => {
      const ids = ["Chastain 1", "Chastain 2", "Chastain F", "Overlook"], p = plate({ rooms: ids.map(id => room(id, rect(0, 0, 10, 10))) });
      expect(ids.map(id => shortNames(p).get(key(id)))).toEqual(["1", "2", "F", undefined]);
    });
    it("one word is always kept, a room alone has nothing to be told from, and a name with nothing to leave off has no short one", () => {
      const ids = ["Augusta", "Augusta 1", "Regency", "301", "302"], p = plate({ rooms: ids.map(id => room(id, rect(0, 0, 10, 10))), groups: [group("Regency", ["Regency"], rect(0, 0, 10, 10))] });
      expect(shortNames(p).size).toBe(0);
    });
    it("the group's cut comes first and is kept: Grand Ballroom A is A, though Grand Salon shares only its first word", () => {
      const ids = ["Grand Ballroom A", "Grand Ballroom B", "Grand Salon"], p = plate({ rooms: ids.map(id => room(id, rect(0, 0, 10, 10))), groups: [group("Grand Ballroom", ids.slice(0, 2), rect(0, 0, 20, 10))] });
      expect(ids.map(id => shortNames(p).get(key(id)))).toEqual(["A", "B", "Salon"]);
    });
    it("a shared plate's two levels keep their own: a name is by its level and its id", () => {
      const p = plate({ rooms: [room("Hall A", rect(0, 0, 10, 10), "x"), room("Hall B", rect(0, 0, 10, 10), "x"), room("Hall A", rect(0, 0, 10, 10), "y")], groups: [group("Hall A–B", ["Hall A", "Hall B"], rect(0, 0, 20, 10), "x")] });
      expect([shortNames(p).get(key("Hall A", "x")), shortNames(p).get(key("Hall B", "x")), shortNames(p).get(key("Hall A", "y"))]).toEqual(["A", "B", "A"]);
    });
  });

  describe("a room's label", () => {
    const size = (shape, text, scale = 1) => roomLabel(room(text, shape), NONE, scale).size;
    it("its size is what its depth allows - 55% of it - what its width allows for that many letters, and 14 at the most", () => {
      near(size(rect(0, 0, 200, 20), "Hall"), 11);                                   // a wide room: its depth
      near(size(rect(0, 0, 30, 100), "Hall"), 30 * 0.9 / (4 * 0.56));                // a tall one: its width, for four letters
      near(size(rect(0, 0, 200, 100), "Hall"), 14);
      near(size(rect(0, 0, 100, 10), "Hall", 2), 11);                                // and it follows the scale
    });
    it("a name of one letter is sized as if it were 1.6", () => {
      near(size(rect(0, 0, 10, 100), "A"), 10 * 0.9 / (1.6 * 0.56));
    });
    it("a room turned past 45 degrees takes its words along its other side, turned back by a quarter; one turned less keeps its own", () => {
      const said = (rot, scale = 1) => levelLabels(plate({ rooms: [room("Hall", rect(50, 50, 100, 30, rot))] }), scale).rooms[0];
      near(said(90).size, 30 * 0.9 / (4 * 0.56)); expect(said(90).rot).toBe(0);
      near(said(61).size, 30 * 0.9 / (4 * 0.56)); expect(said(61).rot).toBe(-29);
      expect(said(-61).rot).toBe(29);
      near(said(-29).size, 14); expect(said(-29).rot).toBe(-29);
      near(said(45).size, 14); expect(said(45).rot).toBe(45);
      expect([said(0).x, said(0).y, said(0).rot]).toEqual([50, 50, 0]);                // in the middle of its room
    });
    describe("full name, short name, none", () => {
      const names = new Map([["x|Hanover A", "A"]]);
      it("the full name where it fits at 11 or more - at 11 exactly too", () => {
        expect(roomLabel(room("Hanover A", rect(0, 0, 40, 40)), names, 2)).toEqual({ text: "Hanover A", size: 14, short: false });
        const at11 = roomLabel(room("Hanover A", rect(0, 0, 200, 20)), names, 1);
        expect([at11.text, at11.short]).toEqual(["Hanover A", false]); near(at11.size, 11);
      });
      it("else its short name, at whatever size that fits", () => {
        expect(roomLabel(room("Hanover A", rect(0, 0, 40, 40)), names, 1)).toEqual({ text: "A", size: 14, short: true });
        const small = roomLabel(room("Hanover A", rect(0, 0, 40, 16)), names, 1);
        expect([small.text, small.short]).toEqual(["A", true]); near(small.size, 8.8);
      });
      it("a room with no short name keeps its full name down to 8: 301 is already short", () => {
        const said = roomLabel(room("301", rect(0, 0, 20, 20)), NONE, 1);
        expect([said.text, said.short]).toEqual(["301", false]); near(said.size, 20 * 0.9 / (3 * 0.56));
      });
      it("and under 8 there is no label, full or short", () => {
        expect(roomLabel(room("301", rect(0, 0, 20, 14)), NONE, 1)).toBe(null);                    // 7.7
        expect(roomLabel(room("Hanover A", rect(0, 0, 40, 14)), names, 1)).toBe(null);
        near(roomLabel(room("301", rect(0, 0, 20, 15)), NONE, 1).size, 8.25);
      });
    });
  });

  describe("what a level says", () => {
    /* Hanover A and B, 40 by 40 each, side by side from 60 to 140 and 80 to 120: at a unit a foot each shows its short name. */
    const pair = [room("Hanover A", rect(80, 100, 40, 40)), room("Hanover B", rect(120, 100, 40, 40))], hanover = group("Hanover A–B", ["Hanover A", "Hanover B"], rect(100, 100, 80, 40));
    it("each room's label, by its level and id, in the middle of it - and none for a room under the least size", () => {
      const said = levelLabels(plate({ rooms: [...pair, room("301", rect(200, 100, 20, 10))], groups: [hanover] }), 1);
      expect(said.rooms).toEqual([{ level: "x", id: "Hanover A", text: "A", size: 14, short: true, x: 80, y: 100, rot: 0 }, { level: "x", id: "Hanover B", text: "B", size: 14, short: true, x: 120, y: 100, rot: 0 }]);
    });
    it("an open area's name where it fits at 8 or more, 11 at the most, by half its depth and its width - scenery with no id, a place with its own", () => {
      const open = [{ name: "Lobby", level: "x", ...rect(50, 50, 100, 30) }, { name: "Concourse", id: "Concourse", level: "y", ...rect(50, 150, 100, 18) }, { name: "Pre-function", level: "x", ...rect(50, 250, 100, 14) },
        { name: "Regency Foyer", level: "x", ...rect(300, 50, 50, 40) }];
      const said = levelLabels(plate({ open }), 1).open;
      expect(said.map(l => [l.text, l.level, l.id, l.x, l.y])).toEqual([["Lobby", "x", null, 50, 50], ["Concourse", "y", "Concourse", 50, 150]]);
      near(said[0].size, 11); near(said[1].size, 9);                                 // 15 allowed, and 11 the most; half of 18
      expect(levelLabels(plate({ open }), 2).open.map(l => l.text)).toEqual(["Lobby", "Concourse", "Pre-function", "Regency Foyer"]);
    });
    describe("a group's name", () => {
      it("stands above its outline, at its left, in capitals, where a member shows its short name - 4 of the frame's units above, whatever the scale", () => {
        expect(levelLabels(plate({ rooms: pair, groups: [hanover] }), 1).groups).toEqual([{ text: "HANOVER A–B", size: 9, x: 60, y: 76, middle: false, where: "above" }]);
        const tight = [room("Hanover A", rect(80, 100, 40, 8)), room("Hanover B", rect(120, 100, 40, 8))];                      // 8 deep: a short name at two units a foot too
        expect(levelLabels(plate({ rooms: tight, groups: [group("Hanover A–B", ["Hanover A", "Hanover B"], rect(100, 100, 80, 8))] }), 2).groups[0]).toMatchObject({ x: 60, y: 94, where: "above" });
      });
      it("and where a member shows no label at all", () => {
        const tiny = [room("301", rect(80, 100, 40, 10)), room("302", rect(120, 100, 40, 10))];
        const said = levelLabels(plate({ rooms: tiny, groups: [group("301–302", ["301", "302"], rect(100, 100, 80, 10))] }), 1);
        expect([said.rooms, said.groups.map(g => g.text)]).toEqual([[], ["301–302"]]);
      });
      it("is not said where every member shows its full name", () => {
        expect(levelLabels(plate({ rooms: pair, groups: [hanover] }), 2).groups).toEqual([]);
      });
      it("stands below where above would land on a room that is not its own, or on an identified open area", () => {
        const over = room("Overlook", rect(100, 65, 20, 10));
        expect(levelLabels(plate({ rooms: [...pair, over], groups: [hanover] }), 1).groups).toEqual([{ text: "HANOVER A–B", size: 9, x: 60, y: 132, middle: false, where: "below" }]);
        const place = { name: "Foyer", id: "Foyer", level: "x", ...rect(100, 65, 20, 10) }, scenery = { name: "Foyer", level: "x", ...rect(100, 65, 20, 10) };
        expect(levelLabels(plate({ rooms: pair, open: [place], groups: [hanover] }), 1).groups[0].where).toBe("below");
        expect(levelLabels(plate({ rooms: pair, open: [scenery], groups: [hanover] }), 1).groups[0].where).toBe("above");        // open floor is no room
      });
      it("and is dropped where below would too", () => {
        const over = room("Overlook", rect(100, 65, 20, 10)), under = room("Underpass", rect(100, 128, 20, 10));
        expect(levelLabels(plate({ rooms: [...pair, over, under], groups: [hanover] }), 1).groups).toEqual([]);
      });
      it("its own members never push it, though a room of the same name on the plate's other level does", () => {
        const wide = [room("Hanover A", rect(80, 86, 40, 40)), room("Hanover B", rect(120, 86, 40, 40))];                      // each stands above its group's outline
        expect(levelLabels(plate({ rooms: wide, groups: [hanover] }), 1).groups[0].where).toBe("above");
        expect(levelLabels(plate({ rooms: [...wide, room("Hanover A", rect(100, 70, 20, 10), "y")], groups: [hanover] }), 1).groups[0].where).toBe("below");
      });
      it("the largest group is placed first, and a smaller one's name gives way to it", () => {
        const big = [room("Grand A", rect(80, 100, 40, 40)), room("Grand B", rect(120, 100, 40, 40))], small = [room("Salon A", rect(85, 60, 30, 20)), room("Salon B", rect(115, 60, 30, 20))];
        const groups = [group("Salon", ["Salon A", "Salon B"], rect(100, 60, 60, 20)), group("Grand", ["Grand A", "Grand B"], rect(100, 100, 80, 40))];
        const said = levelLabels(plate({ rooms: [...big, ...small], groups }), 1).groups;
        /* Grand's name would stand above at 67 to 78, on the Salon's rooms, so it goes below; the Salon's stands above its own, clear. */
        expect(said.map(g => [g.text, g.where])).toEqual([["GRAND", "below"], ["SALON", "above"]]);
      });
      it("a name already placed is in the way of the next: two groups whose names would share a place", () => {
        const a = [room("Embassy A", rect(7.5, 100, 15, 20)), room("Embassy B", rect(22.5, 100, 15, 20))], b = [room("Chicago A", rect(41.5, 100, 15, 20)), room("Chicago B", rect(56.5, 100, 15, 20))];
        const groups = [group("Embassy A–B", ["Embassy A", "Embassy B"], rect(15, 100, 30, 20)), group("Chicago A–B", ["Chicago A", "Chicago B"], rect(49, 100, 30, 20))];
        /* Two outlines side by side, each too narrow for its words, which stand over its middle and reach past it. The first, of two as
           large, stands above; the second's words would run into the first's, above no room at all, so they go below. */
        expect(levelLabels(plate({ rooms: [...a, ...b], groups }), 1).groups.map(g => [g.text, g.where, g.y, g.middle])).toEqual([["EMBASSY A–B", "above", 86, true], ["CHICAGO A–B", "below", 122, true]]);
      });
      it("stands over the middle of an outline too narrow for its words", () => {
        const slim = [room("Embassy C", rect(90, 100, 20, 20)), room("Embassy D", rect(110, 100, 20, 20))];
        expect(levelLabels(plate({ rooms: slim, groups: [group("Embassy C–D", ["Embassy C", "Embassy D"], rect(100, 100, 40, 20))] }), 1).groups).toEqual([{ text: "EMBASSY C–D", size: 9, x: 100, y: 86, middle: true, where: "above" }]);
      });
    });
    it("landmarks are where the drawing has them, their names said from 1.5 units a foot, and a kind the glyphs lack drawn as info", () => {
      const landmarks = [{ kind: "elevator", name: "Lifts", x: 20, y: 60, level: "x" }, { kind: "stairs", name: "Stairs", x: 40, y: 60, level: "x" }];
      expect(levelLabels(plate({ landmarks }), 1.49).landmarks).toEqual([{ kind: "elevator", name: "", x: 20, y: 60 }, { kind: "info", name: "", x: 40, y: 60 }]);
      expect(levelLabels(plate({ landmarks }), 1.5).landmarks.map(l => l.name)).toEqual(["Lifts", "Stairs"]);
      expect(["elevator", "escalator", "entrance", "bridge", "info"].map(kind => levelLabels(plate({ landmarks: [{ kind, name: "", x: 0, y: 0, level: "x" }] }), 1).landmarks[0].kind))
        .toEqual(["elevator", "escalator", "entrance", "bridge", "info"]);
    });
  });

  describe("the nearest room to a tap", () => {
    const a = room("A", rect(50, 50, 20, 20)), b = room("B", rect(100, 50, 20, 20));
    it("the room the point is in, and outside every room the nearest, to its side or its corner", () => {
      expect(nearest([a, b], [55, 45], 5)).toBe(a);
      expect(nearest([a, b], [72, 50], 15)).toBe(a);                   // 12 from A, 18 from B
      expect(nearest([a, b], [80, 50], 15)).toBe(b);
      expect(nearest([a, b], [63, 63], 4.3)).toBe(a);                  // 4.24 from its corner
      expect(nearest([a, b], [63, 63], 4.2)).toBe(null);
    });
    it("a miss: nothing where every room is past the reach, and the reach itself is still inside it", () => {
      expect(nearest([a, b], [72, 50], 11.9)).toBe(null);
      expect(nearest([a, b], [72, 50], 12)).toBe(a);
      expect(nearest([], [72, 50], 100)).toBe(null);
    });
    it("a tie goes to the one painted last: a room over the open area it stands in, the later of two as near", () => {
      const hall = { name: "Concourse", id: "Concourse", level: "x", ...rect(75, 50, 200, 100) };
      expect(nearest([hall, a, b], [55, 50], 5)).toBe(a);
      expect(nearest([hall, a, b], [75, 50], 5)).toBe(hall);
      expect(nearest([a, b], [75, 50], 20)).toBe(b);
    });
    it("a turned room is measured as it stands", () => {
      const turned = room("T", rect(0, 0, 40, 10, 90));              // on its end: 10 wide, 40 deep
      expect(nearest([turned], [0, 18], 1)).toBe(turned);
      expect(nearest([turned], [8, 0], 2.9)).toBe(null);
      expect(nearest([turned], [8, 0], 3.1)).toBe(turned);
      expect(nearest([room("S", rect(0, 0, 40, 10, 30))], [15, 10], 1)).not.toBe(null);      // inside it, turned a third of a right angle
      expect(nearest([room("S", rect(0, 0, 40, 10))], [15, 10], 1)).toBe(null);
    });
  });

  describe("the zoom", () => {
    const small = rect(50, 60, 20, 40);
    it("a room is small where its shorter side is under 44 at the scale", () => {
      expect([isSmall(small, 2), isSmall(small, 2.2), isSmall(rect(0, 0, 40, 20), 2), isSmall(rect(0, 0, 100, 80), 0.5)]).toEqual([true, false, true, true]);
    });
    it("the camera's scale brings its shorter side to 62", () => {
      near(zoomScale(small, 1), 3.1); near(zoomScale(rect(0, 0, 40, 20), 1), 3.1);
    });
    it("at most 7 units a foot, however small the room", () => {
      near(zoomScale(rect(0, 0, 5, 40), 1), 7);
    });
    it("a room already large enough stays at the level's fit: the camera never stands further out", () => {
      near(zoomScale(rect(0, 0, 100, 80), 1), 1);
    });
    it("and never further out than the zoom it is already at: the same zoom, or closer", () => {
      near(zoomScale(small, 1, 4), 4); near(zoomScale(small, 1, 2), 3.1); near(zoomScale(rect(0, 0, 100, 80), 1, 2.5), 2.5);
    });
    it("the camera on a room puts its middle 12 below the frame's, at the scale given", () => {
      const cam = cameraOn(small, 3, FRAME);
      expect(cam.scale).toBe(3);
      near(cam.tx + 3 * 50, FRAME.x + FRAME.w / 2); near(cam.ty + 3 * 60, FRAME.y + FRAME.h / 2 + 12);
    });
  });

  describe("rooms selected together", () => {
    const p = plate({ composites: [{ id: "Hall South", of: ["H1", "H2", "H3"], level: "x" }, { id: "Solo", of: ["H9"], level: "x" }] });
    const sel = (ids, level = "x") => ids.map(id => ({ level, id }));
    it("one room is its own name, though a composite has it for its one leaf", () => {
      expect([namedTogether(sel(["H1"]), p), namedTogether(sel(["H9"]), p)]).toEqual(["H1", "H9"]);
    });
    it("exactly a composite's leaves on its level are named by the composite, in any order", () => {
      expect([namedTogether(sel(["H1", "H2", "H3"]), p), namedTogether(sel(["H3", "H1", "H2"]), p)]).toEqual(["Hall South", "Hall South"]);
    });
    it("any other set is named one by one, in the order given, joined: fewer than the leaves, more, or others", () => {
      expect([namedTogether(sel(["H1", "H2"]), p), namedTogether(sel(["H1", "H2", "H3", "H4"]), p), namedTogether(sel(["H1", "H2", "H4"]), p)])
        .toEqual(["H1 + H2", "H1 + H2 + H3 + H4", "H1 + H2 + H4"]);
    });
    it("and so are the same names on the plate's other level, or across its two", () => {
      expect(namedTogether(sel(["H1", "H2", "H3"], "y"), p)).toBe("H1 + H2 + H3");
      expect(namedTogether([...sel(["H1", "H2"]), ...sel(["H3"], "y")], p)).toBe("H1 + H2 + H3");
    });
  });
});
