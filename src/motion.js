/* The motion between the Map's views (DECISIONS #97), as timelines and
   nothing else: the lift, the drop-in, the zoom, each way back and the
   arrival. Pure: no DOM, no storage, no clock, and it imports nothing, so
   it stands fourth in the order (#29). map.js plays what this lists.

   The principle. A draw writes a view's end state, as it always did; then a
   set of animations plays from the view before to this one, over the same
   nodes, and when it ends nothing of it is left: the page is as the draw
   left it. So a move is a list of steps, each {what, property, from, to,
   delay, duration, easing, show}: `what` names the nodes (map.js finds
   them), `property` is transform, opacity or visibility and no other, and
   `from` and `to` are the two draws' own values - a transform as the draw
   says it, to the digit - so nothing jumps as a set starts or ends. `show`
   holds a thing visible while it goes where the end state's rules hide it.
   A way back is its own list: its way in's, mirrored in time.

   Every number of the motion is in TIMES, in ms or as a share. */

const QUINT = "cubic-bezier(.22,1,.36,1)", QUINT_BACK = "cubic-bezier(.64,0,.78,0)";   // round 6's ease-out, and it mirrored in time
const INOUT = "cubic-bezier(.65,0,.35,1)", LINEAR = "linear";                           // each its own mirror
const TIMES = {
  lift: 450,            // the lift: the city's camera, the venue's, the tilt, the frame
  dim: 0.6,             // of it: the streets and the other blocks dim
  gone: 0.5,            // of it: the pills and the rings fade out
  plates: 0.6,          // into it: the top plate's own lift starts
  plate: 300,           // a plate's own lift
  stagger: 30,          // between two plates' lifts
  cap: 250,             // the staggers in all, at the most
  face: [0.15, 0.45],   // of the lift: the block's face fades from, and for
  faceName: 0.3,        // of the lift: its name fades
  labels: 220,          // the plates' labels fade in, the last of the set
  drop: 550,            // the drop-in
  others: 0.5,          // of it: the other plates and the city fade out
  plateLabels: 0.3,     // of it: the plates' labels fade out
  names: 0.45,          // of it, its last: the level's names, outlines and streets fade in
  zoom: 240,            // the zoom
  zoomNames: 0.45,      // of it, its last: the names for the new scale fade in
  back: 0.65,           // a way back's span, of its way in's
};
/* How far the city dims behind a stack: the stylesheet's own two numbers,
   under [data-stack], which a rules test holds equal to these. */
const DIM = {streets: 0.1, blocks: 0.2};

const step = (what, property, [from, to], delay, duration, easing = LINEAR, show = false) => ({what, property, from, to, delay, duration, easing, show});
/* A list's span: when its last step ends. */
const spanOf = list => Math.max(...list.map(s => s.delay + s.duration));
const mirrored = easing => (easing === QUINT ? QUINT_BACK : easing === QUINT_BACK ? QUINT : easing);
/* A way back: its way in mirrored in time - each step's two values changed
   about, its place counted from the span's end, its curve mirrored - in
   TIMES.back of the span. */
function wayBack(list) {
  const span = spanOf(list), k = TIMES.back;
  return list.map(s => ({...s, from: s.to, to: s.from, delay: (span - s.delay - s.duration) * k, duration: s.duration * k, easing: mirrored(s.easing)}));
}
/* Between two plates' own lifts, for a venue whose top plate is `top`
   above the ground: TIMES.stagger, or less where that many would pass the
   cap in all (round 6's rule: it binds from eleven plates). */
const staggerOf = top => (top > 1 ? Math.min(TIMES.stagger, TIMES.cap / (top - 1)) : TIMES.stagger);

/* The lift, city to stack. `said`: {count, the plates; city, cam, tilt and
   frame, each [from, to]; lifts, {j: [from, to]} for each plate above the
   ground}. The city's camera
   pushes in, and the venue's stands its plates, flat and together, in the
   block's place and brings them to the stack's; they tilt the whole way,
   wearing the block's face, which fades; each plate's own lift starts late,
   the top one first; the labels come last. `frame` is the drawing's own box,
   from where it stood before the draw - none where it did not change. */
function lift(said) {
  const L = TIMES.lift, first = TIMES.plates * L, top = said.count - 1, apart = staggerOf(top);
  const span = top ? first + (top - 1) * apart + TIMES.plate : L;
  const list = [
    step("city-cam", "transform", said.city, 0, L, QUINT),
    step("streets", "opacity", [1, DIM.streets], 0, L * TIMES.dim),
    step("blocks", "opacity", [1, DIM.blocks], 0, L * TIMES.dim),
    step("pills", "opacity", [1, 0], 0, L * TIMES.gone, LINEAR, true),
    step("rings", "opacity", [1, 0], 0, L * TIMES.gone, LINEAR, true),
    step("focus", "opacity", [1, 0], 0, L * TIMES.gone, LINEAR, true),
    step("stack-cam", "transform", said.cam, 0, L, QUINT),
    step("tilts", "transform", said.tilt, 0, L, QUINT),
  ];
  for (let j = top; j >= 1; j--) list.push(step(`plate:${j}`, "transform", said.lifts[j], first + (top - j) * apart, TIMES.plate, QUINT));
  list.push(step("plate-labels", "opacity", [0, 1], span - TIMES.labels, TIMES.labels));
  list.push(step("face", "transform", said.tilt, 0, L, QUINT));
  list.push(step("face", "opacity", [1, 0], L * TIMES.face[0], L * TIMES.face[1], LINEAR, true));
  list.push(step("face-name", "opacity", [1, 0], 0, L * TIMES.faceName));
  if (said.frame) list.push(step("frame", "transform", said.frame, 0, L, QUINT));
  return list;
}
/* Its way back: the lift mirrored - `said` as the lift's, its frame this
   move's own [from, to] - with the venue's group, which the draw has put
   away, shown while it goes, and the venue's own block not shown until the
   set ends: the face stands for it. */
function liftBack(said) {
  const list = wayBack(lift({...said, frame: said.frame ? [said.frame[1], said.frame[0]] : null})), span = spanOf(list);
  list.push(step("stack", "visibility", ["visible", "visible"], 0, span));
  list.push(step("block", "opacity", [0, 0], 0, span));
  return list;
}
/* The drop-in, stack to level. `said`: {cam and tilt, each [from, to];
   lift, [from, to] or null for the ground plate}. The venue's camera goes
   to the level's, the plate's tilt and lift are undone; the other plates,
   every plate's label and the city fade out; and with `names` the level's
   names, the selected rooms' outlines and the street names fade in last. */
function drop(said, names = true) {
  const D = TIMES.drop, last = [D * (1 - TIMES.names), D * TIMES.names];
  const list = [
    step("stack-cam", "transform", said.cam, 0, D, QUINT),
    step("tilt", "transform", said.tilt, 0, D, QUINT),
    ...(said.lift ? [step("plate", "transform", said.lift, 0, D, QUINT)] : []),
    step("others", "opacity", [1, 0], 0, D * TIMES.others, LINEAR, true),
    step("plate-labels", "opacity", [1, 0], 0, D * TIMES.plateLabels, LINEAR, true),
    step("city", "opacity", [1, 0], 0, D * TIMES.others, LINEAR, true),
  ];
  if (names) for (const what of ["names", "sel", "level-streets"]) list.push(step(what, "opacity", [0, 1], ...last));
  return list;
}
/* Its way back: the drop-in mirrored. The names, the outlines and the
   street names, which the draw has emptied, are held in the page by the
   set while they go (map.js), and fade first. Nothing needs showing: the
   stack's end state hides none of it. */
const dropBack = said => wayBack(drop(said)).map(s => ({...s, show: false}));
/* The zoom, both ways and from room to room. `said`: {cam, [from, to];
   names, whether the scale changes, and so the names; streets, whether the
   street names are back; sel, whether the outline waits with the names -
   an arrival's}. The names for the new scale come in last; the old ones the
   draw took at once. */
function zoom(said) {
  const Z = TIMES.zoom, last = [Z * (1 - TIMES.zoomNames), Z * TIMES.zoomNames];
  return [
    step("stack-cam", "transform", said.cam, 0, Z, INOUT),
    ...(said.names ? [step("names", "opacity", [0, 1], ...last)] : []),
    ...(said.sel ? [step("sel", "opacity", [0, 1], ...last)] : []),
    ...(said.streets ? [step("level-streets", "opacity", [0, 1], 0, Z)] : []),
  ];
}
/* The arrival at a level from an event's place line: the drop-in to the
   level's fit, as a tap on its plate plays it, from the venue's stack as it
   would stand - and, where it is at one small room, a second beat in the
   same set, the zoom to it. `said`: the drop-in's, to the fit, and `zoom`,
   [from, to] or null. Through the first beat of two the level shows no
   names: the page's are the room's scale's, and come in with its outline
   as a zoom's names do. */
function arrive(said) {
  if (!said.zoom) return drop(said);
  return [...drop(said, false), ...zoom({cam: said.zoom, names: true, sel: true}).map(s => ({...s, delay: s.delay + TIMES.drop}))];
}
const MOVES = {lift, "lift-back": liftBack, drop, "drop-back": dropBack, zoom, arrive};
/* A move's list, for what its two views say. */
const timeline = (move, said) => MOVES[move](said);

/* A transform as a draw says it - an SVG attribute's words - as CSS says
   it, every digit kept: a length in px, an angle in degrees. */
const cssOf = said => said.replace(/translate\(([^ )]+) ([^)]+)\)/g, "translate($1px, $2px)").replace(/skewX\(([^)]+)\)/g, "skewX($1deg)").replace(/scale\(([^ )]+) ([^)]+)\)/g, "scale($1, $2)");
/* One node's keyframes for one property: its steps in a list, in the order
   they play, as one animation that runs the set's whole span - the first
   value held until its step starts, each step's curve on its own stretch,
   the last value held to the end. So no animation of a set needs a fill,
   and none ends before the set: a step over early would hand its node back
   to attributes a put-away group no longer keeps true. */
function keyframes(steps, span) {
  const frames = [], show = steps.some(s => s.show) ? {visibility: "visible"} : {};
  steps.forEach((s, i) => {
    const said = value => ({[s.property]: s.property === "transform" ? cssOf(value) : value, ...show});
    const starts = s.delay / span, ends = Math.min(1, (s.delay + s.duration) / span);
    if (!i && starts > 0) frames.push({offset: 0, ...said(s.from)});
    frames.push({offset: starts, ...said(s.from), easing: s.easing}, {offset: ends, ...said(s.to)});
    if (i === steps.length - 1 && ends < 1) frames.push({offset: 1, ...said(s.to)});
  });
  return frames;
}

export { QUINT, QUINT_BACK, INOUT, TIMES, DIM, spanOf, timeline, cssOf, keyframes };
