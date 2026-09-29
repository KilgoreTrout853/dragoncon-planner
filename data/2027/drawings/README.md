# drawings/ — our own level drawings, as data

One file per hotel level, `<hotel>-<level>.json`, where `<hotel>` is the hotel's `hotel` key in `venues.json` folded
to lower case and `<level>` is the level's `id` there. The file holds geometry only: what to draw, in feet, north up.
Names, aliases and notes stay in `venues.json`; `tools/render_drawings.py` looks a level's name up there, and the app
will, from W38 (DECISIONS #60). Every drawn room is a room id of that level, so a schedule reading that lands on a room
can light its shape.

The drawings are ours (DECISIONS #28). Sizes come from the hotels' published capacity tables; placement and
orientation come from reading Dragon Con's own map for where each room sits (`reference/dragoncon/maps.json`,
gitignored). Nothing of theirs is copied into these files.

## Coordinates

- Units are feet. The origin is the top-left corner of the level's `extent`; x runs east, y runs south (north is up,
  as on a screen). `extent.w` × `extent.h` is the drawn area; it is per level, not yet a shared frame across a hotel's
  levels (an open item: the elevator core should sit at the same x, y on every level of a hotel before the app stacks
  them).
- A rectangle is its centre `cx, cy`, its size `w` (along its own axis) × `h` (across it), and `rot`, degrees clockwise;
  `rot: 0` means `w` runs east–west. Rotate about the centre.

## Keys

| key | what |
|---|---|
| `hotel`, `level` | the `venues.json` hotel key and level id this file draws |
| `units`, `north` | always `"ft"` and `"up"`; stated so a reader need not guess |
| `extent` | `{w, h}` of the drawn area |
| `rooms[]` | one rectangle per **leaf** room: `{id, cx, cy, w, h, rot}`. `id` is a room id of the level. Every id once. |
| `composites[]` | rooms of the level that are unions of leaf rooms, `{id, of: [leaf ids]}` — e.g. Grand East = Grand Ballroom A + B. Not drawn as shapes; lit by lighting their parts. |
| `groups[]` | rooms that share one outline: `{name, kind, rooms: [ids], outline: {cx, cy, w, h, rot}}`. `kind` is `"run"` (separate rooms in a row, air walls between) or `"ballroom"` (one hall with operable partitions). Drawn as the outline, with the members' shared edges dashed. |
| `open[]` | unbookable floor: lobbies, pre-function, corridors, foyers — `{name, cx, cy, w, h, rot}`. Dashed, no fill. |
| `landmarks[]` | `{kind, name, x, y}`; `kind` is one of `escalator`, `elevator`, `entrance`, `bridge`, `info`. Points, not areas. |
| `streets[]` | `{name, side}`; `side` is `N`, `S`, `E` or `W` of the extent. Orientation cues only. |
| `sources[]`, `notes[]` | prose: where the numbers came from, what was inferred rather than read |

A room of the level that is not in the file is simply not drawn (the Hilton's 2nd-floor rooms 215–224, say, which
the con does not use). The test `tests/test_drawings.py` holds the file to this: known hotel and level, every `rooms`,
`composites` and `groups` id a room of that level, no id twice, every rectangle inside the extent.

## Rendering

`python tools/render_drawings.py [--png]` draws every file here to `docs/venues/drawings/<hotel>-<level>.svg` at
2 px per foot with sizes printed, for checking by eye. That renderer documents the data; the app's stage builder will be
its own code and will read the same files, from W38 (DECISIONS #60).
