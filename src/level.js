/* The level's layout (DECISIONS #96): a plate laid flat and seen from above,
   as geometry and nothing else - where it stands in a frame, what each room
   is called there and how large, which room a point is nearest, where the
   camera stands for a room too small to see, and what rooms selected
   together are called. Pure: no DOM, no storage, no clock, and one import,
   stack.js's bounds(), so it stands third in the order (#29). map.js draws
   what this lays out.

   Everything is in the frame's own units - the Map's viewBox - as the stack
   is, and nothing is measured from the page: a label's size is worked out
   from its room's shape and the count of its letters, never from the words
   as drawn. So the rule's 11, 8, 22, 44 and 62 are of the Map's units, which
   a phone draws smaller than px, and a short phone smaller still. A plate
   is building.js's: its rooms, open areas, groups, landmarks and composites,
   each saying its level, in feet. */
import { bounds } from "./stack.js";

/* The frame's room kept clear, in its units: the way back stands at the top
   left, and a street's name on each edge. */
const LEVEL_MARGIN = {l: 20, r: 20, t: 72, b: 30};
const FULL = 11;          // a room's full name is shown where it fits at this size or more
const LEAST = 8;          // and no label is shown under this one
const MOST = 14;          // nor a room's any larger than this
const OPEN_MOST = 11;     // nor an open area's than this
const GROUP_SIZE = 9;     // a group's name
const REACH = 22;         // how far from a tap a room may be, and still be the one tapped
const SMALL = 44;         // a room under this across zooms when it is tapped
const ZOOM_TO = 62;       // until its shorter side is this
const ZOOM_CAP = 7;       // and never past this many units a foot
const ZOOM_DROP = 12;     // a zoomed room stands this far below the frame's middle, clear of the way back
const NAMES_FROM = 1.5;   // a landmark's name is shown from this many units a foot
const KINDS = ["elevator", "escalator", "entrance", "bridge", "info"];   // a landmark's, and info for any other
/* How wide a word is taken to be, a letter, as a share of its size: a
   room's name, an open area's in a lighter face, and a group's in capitals
   set apart. And how much of a shape its words may fill: a room's, 55% of
   its depth and 90% of its width, an open area's half its depth; a name of
   one letter is sized as if it were 1.6. */
const ROOM_LETTER = 0.56, OPEN_LETTER = 0.48, GROUP_LETTER = 0.72;
const ROOM_DEEP = 0.55, OPEN_DEEP = 0.5, WIDE = 0.9, FEWEST = 1.6;

/* The four corners of a rectangle {cx, cy, w, h, rot}, turned about its
   centre: rot is degrees clockwise where y runs south (the drawings'
   README), so a turned room's corners are its true ones. building.js makes
   a venue's hull of them. */
function corners(r) {
  const t = (r.rot || 0) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), hw = r.w / 2, hh = r.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [r.cx + x * c - y * s, r.cy + x * s + y * c]);
}

/* A room of a plate by its level and its id: a shared plate holds two
   levels' rooms, and a name is one level's. */
const placeKey = place => `${place.level}|${place.id}`;
/* What a tap can select on a plate: its identified open areas, then its
   rooms - the order they are painted in, a room over an open area. */
const levelPlaces = plate => [...plate.open.filter(area => "id" in area), ...plate.rooms];

/* A level in a frame {x, y, w, h}: the box of every room and open area of
   the plate, as large as the frame's room allows and in the middle of it.
   It answers the camera, {scale, tx, ty}: a point of the drawing, in feet,
   stands at tx + scale * x, ty + scale * y. */
function levelFit(plate, frame, margin = LEVEL_MARGIN) {
  const box = bounds([...plate.rooms, ...plate.open].flatMap(corners));
  const room = {w: frame.w - margin.l - margin.r, h: frame.h - margin.t - margin.b}, scale = Math.min(room.w / box.w, room.h / box.h);
  return {scale, tx: frame.x + margin.l + (room.w - box.w * scale) / 2 - box.x0 * scale, ty: frame.y + margin.t + (room.h - box.h * scale) / 2 - box.y0 * scale};
}

/* The short names of a plate's rooms, by placeKey(): the words that tell a
   room from its group's members - "Hanover A" is "A" - and then, for a room
   in no group, from the rooms that share its first word. The words every
   one of them begins with are left off, one word always kept; a room alone
   has nothing to be told from, and a name with nothing to leave off has no
   short one. */
function shortNames(plate) {
  const names = new Map();
  const cut = rooms => {
    if (rooms.length < 2) return;
    const words = rooms.map(room => room.id.split(" "));
    let shared = 0;
    while (words.every(w => w.length > shared + 1 && w[shared] === words[0][shared])) shared++;
    if (shared) rooms.forEach((room, i) => { if (!names.has(placeKey(room))) names.set(placeKey(room), words[i].slice(shared).join(" ")); });
  };
  for (const group of plate.groups) cut(group.rooms.map(id => ({level: group.level, id})));
  const byFirst = new Map();
  for (const room of plate.rooms) { const first = room.id.split(" ")[0]; byFirst.set(first, [...(byFirst.get(first) || []), room]); }
  for (const rooms of byFirst.values()) cut(rooms);
  return names;
}

/* A room as its words are read: turned no more than 45 degrees either way,
   so a room past that takes its words along its other side. */
function upright(r) {
  const rot = r.rot || 0;
  return rot > 45 ? {w: r.h, h: r.w, rot: rot - 90} : rot < -45 ? {w: r.h, h: r.w, rot: rot + 90} : {w: r.w, h: r.h, rot};
}
/* The size some words take in a room at a scale, units a foot: what its
   depth allows, what its width allows for that many letters, and MOST. */
function roomSize(room, text, scale) {
  const {w, h} = upright(room);
  return Math.min(MOST, h * scale * ROOM_DEEP, w * scale * WIDE / (Math.max(text.length, FEWEST) * ROOM_LETTER));
}
/* A room's label at a scale (round 7's rule): its full name where that fits
   at FULL or more; else its short name, where it has one, at whatever size
   that fits; and null under LEAST. {text, size, short}. */
function roomLabel(room, names, scale) {
  let text = room.id, size = roomSize(room, text, scale), short = false;
  if (size < FULL && names.has(placeKey(room))) { text = names.get(placeKey(room)); size = roomSize(room, text, scale); short = true; }
  return size < LEAST ? null : {text, size, short};
}

/* What a level says at a scale, units a foot - all of it data, each place in
   feet and each size in the frame's units:
   - open: an open area's name where it fits at LEAST or more, in the middle
     of it: {level, id, text, size, x, y}, id null for one that is scenery.
   - rooms: each room's label, in the middle of it, turned as it is read:
     {level, id, text, size, short, x, y, rot}.
   - groups: a group's name, in capitals, only where a member shows a short
     name or none: above its outline, at its left where the outline is as
     wide as the words and over its middle where it is not; below, where
     above would land on a group's name already placed or on a room or an
     identified open area that is not its own; and dropped where both would.
     The largest group first. {text, size, x, y, middle, where}.
   - landmarks: {kind, name, x, y}, the name "" under NAMES_FROM, and a kind
     the glyphs lack drawn as info. */
function levelLabels(plate, scale) {
  const names = shortNames(plate), unsaid = new Set(), open = [], rooms = [], groups = [];
  for (const area of plate.open) {
    const size = Math.min(OPEN_MOST, area.h * scale * OPEN_DEEP, area.w * scale * WIDE / (area.name.length * OPEN_LETTER));
    if (size >= LEAST) open.push({level: area.level, id: "id" in area ? area.id : null, text: area.name, size, x: area.cx, y: area.cy});
  }
  for (const room of plate.rooms) {
    const said = roomLabel(room, names, scale);
    if (!said || said.short) unsaid.add(placeKey(room));
    if (said) rooms.push({level: room.level, id: room.id, ...said, x: room.cx, y: room.cy, rot: upright(room).rot});
  }
  const placed = [], lands = (a, b) => b.x0 < a.x1 && b.x1 > a.x0 && b.y0 < a.y1 && b.y1 > a.y0;
  const shapes = levelPlaces(plate).map(place => { const b = bounds(corners(place)); return {place, box: {x0: b.x0 * scale, x1: b.x1 * scale, y0: b.y0 * scale, y1: b.y1 * scale}}; });
  for (const group of [...plate.groups].sort((a, b) => b.outline.w * b.outline.h - a.outline.w * a.outline.h)) {
    if (!group.rooms.some(id => unsaid.has(placeKey({level: group.level, id})))) continue;
    const box = bounds(corners(group.outline)), wide = group.name.length * GROUP_SIZE * GROUP_LETTER, fits = box.w * scale >= wide;
    const x = fits ? box.x0 : (box.x0 + box.x1) / 2, left = fits ? x * scale : x * scale - wide / 2;
    const others = shapes.filter(({place}) => place.level !== group.level || !group.rooms.includes(place.id));
    for (const [where, y] of [["above", box.y0 - 4 / scale], ["below", box.y1 + (GROUP_SIZE + 3) / scale]]) {
      const words = {x0: left - 2, x1: left + wide + 2, y0: y * scale - GROUP_SIZE, y1: y * scale + 2};
      if (placed.some(other => lands(other, words)) || others.some(other => lands(other.box, words))) continue;
      placed.push(words);
      groups.push({text: group.name.toUpperCase(), size: GROUP_SIZE, x, y, middle: !fits, where});
      break;
    }
  }
  const landmarks = plate.landmarks.map(mark => ({kind: KINDS.includes(mark.kind) ? mark.kind : "info", name: scale >= NAMES_FROM ? mark.name : "", x: mark.x, y: mark.y}));
  return {open, rooms, groups, landmarks};
}

/* How far a point is from a rectangle, both in feet: 0 inside it, and to
   its nearest side or corner outside, the rectangle turned as it is. */
function distanceTo(r, [x, y]) {
  const t = -(r.rot || 0) * Math.PI / 180, dx = x - r.cx, dy = y - r.cy;
  const along = dx * Math.cos(t) - dy * Math.sin(t), across = dx * Math.sin(t) + dy * Math.cos(t);
  return Math.hypot(Math.max(Math.abs(along) - r.w / 2, 0), Math.max(Math.abs(across) - r.h / 2, 0));
}
/* The place a tap is for: the nearest of `places` to the point within
   `reach` of it, all in feet, or null where every one is farther. A tie
   goes to the one later in the list - painted over the other, as a room
   stands in an open area. */
function nearest(places, point, reach) {
  let found = null, least = Infinity;
  for (const place of places) {
    const d = distanceTo(place, point);
    if (d <= reach && d <= least) { found = place; least = d; }
  }
  return found;
}

/* The zoom (round 7's second rule). A room is small where its shorter side
   is under SMALL at a scale, units a foot. The scale a camera on it stands
   at brings that side to ZOOM_TO, at most ZOOM_CAP a foot - and never
   further out than the level's own fit, nor than `least`, the zoom the
   camera is already at. And the camera on a room at a scale: the room's
   middle ZOOM_DROP below the frame's. */
const isSmall = (room, scale) => Math.min(room.w, room.h) * scale < SMALL;
const zoomScale = (room, fit, least = 0) => Math.max(fit, least, Math.min(ZOOM_TO / Math.min(room.w, room.h), ZOOM_CAP));
const cameraOn = (room, scale, frame) => ({scale, tx: frame.x + frame.w / 2 - scale * room.cx, ty: frame.y + frame.h / 2 + ZOOM_DROP - scale * room.cy});

/* What rooms selected together are called - `rooms` a list of {level, id},
   one or more, of one plate: a composite's own name where they are exactly
   its leaves on its level, "International Hall South"; else their names in
   the order given, joined: "Hanover A + Hanover B". */
function namedTogether(rooms, plate) {
  const ids = rooms.map(room => room.id), level = rooms[0].level;
  const whole = ids.length > 1 && rooms.every(room => room.level === level)
    && plate.composites.find(composite => composite.level === level && composite.of.length === ids.length && composite.of.every(id => ids.includes(id)));
  return whole ? whole.id : ids.join(" + ");
}

export {
  LEVEL_MARGIN, FULL, LEAST, REACH, SMALL, ZOOM_TO, ZOOM_CAP, ZOOM_DROP, NAMES_FROM,
  corners, placeKey, levelPlaces, levelFit, shortNames, roomLabel, levelLabels, nearest, isSmall, zoomScale, cameraOn, namedTogether,
};
