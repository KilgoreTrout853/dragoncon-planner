/* The stack's layout (DECISIONS #95): a venue lifted into its floors, as
   geometry and nothing else. A venue's plates are one outline, drawn once a
   storey, each tilted - skewed and squashed about the outline's centre - and
   lifted above the one below, the whole stood in the middle of a frame.
   Pure: no DOM, no storage, no clock, and it imports nothing, so it stands
   right after season in the order and the imports rule keeps it so (#29).
   map.js draws what this lays out.

   Everything is in the frame's own units - the Map's viewBox - and nothing
   is measured from the page: the same stack in jsdom and at every width, and
   a resize needs no new layout. So the rule's 40 is forty of the Map's
   units, which a narrow phone draws smaller than 40 px. */

const SKEW = 30, SQUASH = 0.5;           // degrees; and how much of a plate's depth is left
const LEAN = Math.tan(SKEW * Math.PI / 180) * SQUASH;   // how far a point moves sideways for each unit it stands back
const PUSH = 2.2;                        // how far the city map is pushed in behind a stack
const STRIP = 40;                        // the strip of a plate left showing under the one above
const MIN_WIDE = 0.55;                   // of the frame's width: no plate is narrower, where the frame allows
/* The frame's room kept clear, in its units: the back control stands at the
   top left. */
const MARGIN = {l: 12, r: 12, t: 46, b: 14};

/* The box some points stand in. */
function bounds(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0};
}

/* A point of a plate as the stack shows it: tilted about the centre's row -
   a point further back leans right and stands half as far back - and lifted
   by the plate's height above the ground plate. y runs down the page, so a
   lift takes y away. */
const project = ([x, y], centre, lift = 0) => [x - LEAN * (y - centre[1]), centre[1] + SQUASH * (y - centre[1]) - lift];

/* The outline of a venue with no drawing: its block's own rectangle on the
   Map, from 0, 0 - its corners; the block's rounding is the drawing's. */
const blockOutline = block => [[0, 0], [block.w, 0], [block.w, block.h], [0, block.h]];

/* A stack laid out in a frame {x, y, w, h}: `points` a venue's outline in
   its own units - feet, or a block's - and `count` its plates. The plates
   stand as far apart as it takes for each to show a strip STRIP deep under
   the one above, as long as a plate stays MIN_WIDE of the frame wide or
   more; where both cannot hold, the width wins and the strip is what is
   left. Solved, not searched: at its widest the stack either has room for
   its strips or it does not, and then the scale at which they fit is one
   division.

   It answers {scale, tx, ty} - a point of the outline is at tx + scale * x,
   ty + scale * y once projected - `gap`, the lift between two plates in the
   outline's units, `centre`, what the tilt turns about, `wide` and `strip`,
   a plate's width and the strip under each in the frame's units, `ground`,
   where the ground plate's centre stands, and `plates`, each plate's box in
   the frame, bottom to top. */
function stackLayout(points, count, frame, margin = MARGIN) {
  const box = bounds(points), centre = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
  const flat = bounds(points.map(point => project(point, centre)));
  const room = {w: frame.w - margin.l - margin.r, h: frame.h - margin.t - margin.b}, above = count - 1;
  const widest = room.w / flat.w;
  let scale, gap;
  if (!above) { scale = Math.min(widest, room.h / flat.h); gap = 0; }
  else if (flat.h * widest + above * STRIP <= room.h) { scale = widest; gap = STRIP / scale; }
  else {
    const held = (room.h - above * STRIP) / flat.h;              // the scale at which every strip still holds
    const least = Math.min(widest, MIN_WIDE * frame.w / box.w, room.h / flat.h);
    scale = Math.max(held, least);
    gap = scale === held ? STRIP / scale : (room.h / scale - flat.h) / above;
  }
  const tall = flat.h + above * gap;
  const tx = frame.x + margin.l + (room.w - flat.w * scale) / 2 - flat.x0 * scale;
  const ty = frame.y + margin.t + (room.h - tall * scale) / 2 - (flat.y0 - above * gap) * scale;
  const plates = Array.from({length: count}, (_, j) => {
    const at = bounds(points.map(point => project(point, centre, j * gap)));
    return bounds([[tx + scale * at.x0, ty + scale * at.y0], [tx + scale * at.x1, ty + scale * at.y1]]);
  });
  return {scale, tx, ty, gap, centre, wide: box.w * scale, strip: gap * scale, ground: [tx + scale * centre[0], ty + scale * centre[1]], plates};
}

export { SKEW, SQUASH, PUSH, STRIP, MIN_WIDE, MARGIN, bounds, project, blockOutline, stackLayout };
