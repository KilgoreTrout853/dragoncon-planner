# drawings/ — our own level drawings, as data

One file per hotel level, `<hotel>-<level>.json`, where `<hotel>` is the hotel's `hotel` key in `venues.json` folded
to lower case with its spaces as hyphens (`courtland-grand`), and `<level>` is the level's `id` there. The file holds geometry only: what to draw, in feet, north up.
Names, aliases and notes stay in `venues.json`; `tools/render_drawings.py` looks a level's name up there, and the app
will, from W38 (DECISIONS #60). Every drawn room is a room id of that level, so a schedule reading that lands on a room
can light its shape.

The drawings are ours (DECISIONS #28, #67). Placement, order and orientation come from the hotel's own floor plan where
there is one (`reference/plans/`, gitignored), read for position only. Dragon Con's own map
(`reference/dragoncon/maps.json`, gitignored) says which rooms the con uses and their names, and places a hotel that
has no plan. Sizes come from the hotels' published capacity tables, each room turned as the plan draws it; where a
table contradicts its own square footage, the plan's shape. Nothing of theirs is copied into these files.

## Coordinates

- Units are feet. The origin is the top-left corner of the `extent`; x runs east, y runs south (north is up, as on a
  screen). `extent.w` × `extent.h` is the drawn area.
- One frame per hotel: every level file of a hotel has the same origin and the same `extent`, and a point directly
  above another has the same x, y, so the levels stack. `anchors` name the points that tie them.
- A rectangle is its centre `cx, cy`, its size `w` (along its own axis) × `h` (across it), and `rot`, degrees clockwise;
  `rot: 0` means `w` runs east–west. Rotate about the centre.

## Keys

| key | what |
|---|---|
| `hotel`, `level` | the `venues.json` hotel key and level id this file draws |
| `units`, `north` | always `"ft"` and `"up"`; stated so a reader need not guess |
| `extent` | `{w, h}` of the drawn area, the same in every level file of a hotel |
| `anchors[]` | named fixed points, `{name, x, y}`, each on the extent: an elevator core, an escalator, the atrium. A name is used once in a file, and a name in two files of one hotel has one position there, within 0.5 ft. `[]` where a level has none. |
| `rooms[]` | one rectangle per **leaf** room: `{id, cx, cy, w, h, rot}`. `id` is a room id of the level. Every id once. |
| `composites[]` | rooms of the level that are unions of leaf rooms, `{id, of: [leaf ids]}` — e.g. Grand East = Grand Ballroom A + B. Not drawn as shapes; lit by lighting their parts. |
| `groups[]` | rooms that share one outline: `{name, kind, rooms: [ids], outline: {cx, cy, w, h, rot}}`. `kind` is `"run"` (separate rooms in a row, air walls between) or `"ballroom"` (one hall with operable partitions). Drawn as the outline, with the members' shared edges dashed. |
| `open[]` | open floor: lobbies, pre-function, corridors, foyers — `{name, cx, cy, w, h, rot}`, and optionally `id`. Without an `id` it is scenery: dashed, no fill. With one it is a place events happen: the `id` is a room of the level in `venues.json`, unique among the file's rooms, composites and open ids, and the app may light it; it is no composite's or group's member. |
| `landmarks[]` | `{kind, name, x, y}`; `kind` is one of `escalator`, `elevator`, `entrance`, `bridge`, `info`. Points, not areas. |
| `streets[]` | `{name, side}`; `side` is `N`, `S`, `E` or `W` of the extent. Orientation cues only. |
| `sources[]`, `notes[]` | prose: where the numbers came from, what was inferred rather than read |

A room of the level that is not in the file is simply not drawn (the Hilton's 2nd-floor rooms 215–224, say, which
the con does not use). The test `tests/test_drawings.py` holds the file to this: known hotel and level; every `rooms`,
`composites` and `groups` id and every open `id` a room of that level; no id twice among the rooms, composites and open
areas; every rectangle wholly on the extent, all four of its rotated corners, to within rounding; anchors well formed,
named once and on the extent. Across one year's files of a hotel it holds one `extent`, and one position, within
0.5 ft, for an anchor name.

## Rendering

`python tools/render_drawings.py [--png]` draws every file here to `docs/venues/drawings/<hotel>-<level>.svg` at
2 px per foot with sizes printed, for checking by eye, each anchor marked by a small cross and its name. A hotel's
levels render at one scale, with the frame at one offset, so two renders laid over each other show whether the levels
line up. That renderer documents the data; the app's stage builder will be
its own code and will read the same files, from W38 (DECISIONS #60).
