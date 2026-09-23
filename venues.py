#!/usr/bin/env python3
"""The venues file, data/<year>/venues.json: load it and validate it (DECISIONS #45).

Hand-curated, one copy a year (#27), runtime data only. Per hotel: `hotel`, the value the schedule's hotel field holds;
`name`; `keys`, the prefixes the source writes at the start of a location; `short`, `group`, `var` and `order`, as the
client's src/venues.js has them until PR 9 moves the client onto this file; `placeless`; `display`, whether the room
shown is the rest of the location or the whole of it; `levels`, each with `id`, `name`, `order`, `rooms`, `aliases` and
`notes`; and `unplaced`, a room with no known level and its note. At the top: `walk`, minutes between two hotels keyed
"A|B", and `same_venue_min`, `unknown_pair_min` and `slack_min`.

    from venues import load
    v = load("data/2027/venues.json")   # raises VenuesError listing every problem, not the first
    v.hotels()                           # the hotels, in their `order`
    v.level_of("Hilton", "Salon East")   # -> "l2"
    v.warnings                           # walk pairs between two placed hotels the file lacks: the default is used

The rules: a hotel key is whole tokens and no two hotels share one, case-folded; level ids and room ids are unique
within a hotel; an alias is written folded - case-folded, single spaces - and names rooms on its own level; the three
minute values are present; `order` is distinct among the hotels and among a hotel's levels; and no object holds a key
the file does not know, because a typo in a hand-edited file would otherwise do nothing, silently.

Helpers only. The hotel and room split and the reading of a room string are the venues stage's, venues_stage.py.
Standard library; nothing here writes a file or prints.
"""

import json
from itertools import combinations

TOP = ("walk", "same_venue_min", "unknown_pair_min", "slack_min", "hotels")
MINUTES = ("same_venue_min", "unknown_pair_min", "slack_min")
HOTEL = ("hotel", "name", "keys", "short", "group", "var", "order", "placeless", "display", "levels", "unplaced")
LEVEL = ("id", "name", "order", "rooms", "aliases", "notes")
DISPLAYS = ("rest", "location")
SPLITS = ",-"   # #45 splits a location at a space, a comma or a hyphen; a key is whole tokens, so it holds none of these


class VenuesError(Exception):
    """Every problem in the file, not the first. `problems` is the list."""

    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__(f"{len(self.problems)} problem(s) in the venues file:\n  " + "\n  ".join(self.problems))


class Venues:
    """The validated file as it is on disk, `data`, and what its load warned of, `warnings`."""

    def __init__(self, data, warnings=()):
        self.data, self.warnings = data, list(warnings)

    def hotels(self):
        """The hotels, in their `order`."""
        return sorted(self.data["hotels"], key=lambda h: h["order"])

    def level_of(self, hotel, room):
        """The id of the level that lists `room` at `hotel`: None for an unplaced room, or one the file lacks."""
        for h in self.data["hotels"]:
            if h["hotel"] == hotel:
                return next((lv["id"] for lv in h["levels"] if room in lv["rooms"]), None)
        return None


def folded(s):
    """How an alias is written: case-folded, whitespace collapsed to single spaces (#45)."""
    return " ".join(str(s).casefold().split())


def load(path):
    """The file at `path`, validated. Raises VenuesError listing every problem found."""
    try:
        with open(path, "rb") as f:
            data = json.loads(f.read().decode("utf-8"))
    except OSError as exc:
        raise VenuesError([f"{path}: cannot be read ({exc.strerror or exc})"]) from None
    except ValueError as exc:
        raise VenuesError([f"{path}: is not JSON ({exc})"]) from None
    return check(data)


def check(data):
    """Parsed JSON, validated: a Venues, or VenuesError listing every problem found."""
    problems, warnings = _problems(data)
    if problems:
        raise VenuesError(sorted(problems))
    return Venues(data, warnings)


# ---------------------------------------------------------------------------
# The rules
# ---------------------------------------------------------------------------

def _problems(data):
    if not isinstance(data, dict):
        return [f"the file holds {type(data).__name__}, not an object"], []
    out = _keys("the file", data, TOP)
    for name in MINUTES:
        if name in data and not _minutes(data[name]):
            out.append(f"{name} {data[name]!r} is not a whole number of minutes")
    hotels = data.get("hotels", [])
    if not isinstance(hotels, list):
        out.append("hotels is not a list")
        hotels = []
    seen, orders, keys = {}, {}, {}
    for i, h in enumerate(hotels):
        if not isinstance(h, dict):
            out.append(f"hotels[{i}]: is {type(h).__name__}, not an object")
            continue
        here = f"hotels[{i}] {h.get('hotel', '?')}"
        out += _keys(here, h, HOTEL)
        name = h.get("hotel")
        if not _text(name):
            out.append(f"{here}: hotel {name!r} is missing or empty")
        elif name in seen:
            out.append(f"{here}: hotel {name!r} is already hotels[{seen[name]}]")
        else:
            seen[name] = i
        for field in ("name", "short", "group", "var"):
            if field in h and not _text(h[field]):
                out.append(f"{here}: {field} {h[field]!r} is not a non-empty string")
        if "order" in h:
            if not _whole(h["order"]):
                out.append(f"{here}: order {h['order']!r} is not a whole number")
            elif h["order"] in orders:
                out.append(f"{here}: order {h['order']} is taken by {orders[h['order']]}")
            else:
                orders[h["order"]] = name
        if "placeless" in h and not isinstance(h["placeless"], bool):
            out.append(f"{here}: placeless {h['placeless']!r} is not true or false")
        if "display" in h and h["display"] not in DISPLAYS:
            out.append(f"{here}: display {h['display']!r} is not one of {', '.join(DISPLAYS)}")
        out += _hotel_keys(here, h.get("keys", []), keys, (i, name))
        out += _rooms(here, h)
    out += _walk(data.get("walk", {}), seen)
    placed = [h["hotel"] for h in sorted((h for h in hotels if isinstance(h, dict) and _whole(h.get("order"))),
                                         key=lambda h: h["order"])
              if h.get("placeless") is False and _text(h.get("hotel"))]
    walk = data.get("walk") if isinstance(data.get("walk"), dict) else {}
    warnings = [f"walk: no minutes for {a} and {b}; unknown_pair_min is used" for a, b in combinations(placed, 2)
                if f"{a}|{b}" not in walk and f"{b}|{a}" not in walk]
    return out, warnings


def _hotel_keys(here, hotel_keys, keys, owner):
    """A key is whole tokens - no space at either end, single spaces, no comma or hyphen - and no two hotels share
    one, case-folded, since the resolver matches keys against a location without regard to case. `keys` maps a
    folded key to the hotel that holds it, `owner` being this one."""
    if not isinstance(hotel_keys, list):
        return [f"{here}: keys is not a list"]
    out, mine = [], set()
    for k in hotel_keys:
        if not _text(k) or k != " ".join(k.split()) or any(c in k for c in SPLITS):
            out.append(f"{here}: key {k!r} is not whole tokens")
            continue
        if k.casefold() in mine:
            out.append(f"{here}: key {k!r} is listed twice")
            continue
        mine.add(k.casefold())
        held = keys.setdefault(k.casefold(), owner)
        if held != owner:
            out.append(f"{here}: key {k!r} is also a key of {held[1]}")
    return out


def _rooms(here, h):
    """The levels, their rooms and aliases, and the unplaced rooms."""
    out, levels, ids, orders, rooms = [], h.get("levels", []), {}, {}, {}
    if not isinstance(levels, list):
        return [f"{here}: levels is not a list"]
    for j, lv in enumerate(levels):
        if not isinstance(lv, dict):
            out.append(f"{here}: levels[{j}] is {type(lv).__name__}, not an object")
            continue
        at = f"{here}, level {lv.get('id', j)!r}"
        out += _keys(at, lv, LEVEL)
        lid = lv.get("id")
        if not _text(lid):
            out.append(f"{at}: id {lid!r} is missing or empty")
        elif lid in ids:
            out.append(f"{at}: id {lid!r} is already levels[{ids[lid]}]")
        else:
            ids[lid] = j
        if "name" in lv and not _text(lv["name"]):
            out.append(f"{at}: name {lv['name']!r} is not a non-empty string")
        if "order" in lv:
            if not _whole(lv["order"]):
                out.append(f"{at}: order {lv['order']!r} is not a whole number")
            elif lv["order"] in orders:
                out.append(f"{at}: order {lv['order']} is taken by level {orders[lv['order']]!r}")
            else:
                orders[lv["order"]] = lid
        if "notes" in lv and not _texts(lv["notes"]):
            out.append(f"{at}: notes is not a list of strings")
        here_rooms = lv.get("rooms", [])
        if not _texts(here_rooms) or not all(_text(r) for r in here_rooms):
            out.append(f"{at}: rooms is not a list of non-empty strings")
            here_rooms = []
        for r in here_rooms:
            out += _room(at, r, rooms, f"level {lid!r}")
        out += _aliases(at, lv.get("aliases", {}), set(here_rooms))
    unplaced = h.get("unplaced", {})
    if not isinstance(unplaced, dict) or not all(_text(r) and isinstance(note, str) for r, note in unplaced.items()):
        out.append(f"{here}: unplaced is not a map of a room to its note")
    else:
        for r in unplaced:
            out += _room(here, r, rooms, "unplaced")
    return out


def _room(at, room, rooms, where):
    """A room id is unique within its hotel, case-folded: on one level, across its levels, and against its unplaced
    rooms. `rooms` maps a folded room id to where it was first listed."""
    if room.casefold() in rooms:
        return [f"{at}: room {room!r} is already on {rooms[room.casefold()]}"]
    rooms[room.casefold()] = where
    return []


def _aliases(at, aliases, level_rooms):
    """An alias is written folded, and names one or more rooms of its own level."""
    if not isinstance(aliases, dict):
        return [f"{at}: aliases is not a map of a string to room ids"]
    out = []
    for alias, targets in aliases.items():
        if not _text(alias) or alias != folded(alias):
            out.append(f"{at}: alias {alias!r} is not written folded - lower case, single spaces - as {folded(alias)!r}")
        if not _texts(targets) or not targets:
            out.append(f"{at}: alias {alias!r} names no rooms")
            continue
        for r in targets:
            if r not in level_rooms:
                out.append(f"{at}: alias {alias!r} names {r!r}, which is not a room of this level")
    return out


def _walk(walk, hotels):
    """A walk key names two hotels of the file, "A|B", and no pair is listed twice; its value is whole minutes."""
    if not isinstance(walk, dict):
        return ["walk is not a map of \"A|B\" to minutes"]
    out, pairs = [], {}
    for key, minutes in walk.items():
        parts = key.split("|")
        if len(parts) != 2 or parts[0] == parts[1] or any(p not in hotels for p in parts):
            out.append(f"walk: {key!r} is not two hotels of the file, \"A|B\"")
            continue
        pair = frozenset(parts)
        if pair in pairs:
            out.append(f"walk: {key!r} is the pair {pairs[pair]!r} again")
        pairs.setdefault(pair, key)
        if not _minutes(minutes):
            out.append(f"walk: {key!r} {minutes!r} is not a whole number of minutes")
    return out


def _keys(where, obj, allowed):
    """Every key of `allowed` present, and no other."""
    missing = [f"{where}: {k} is missing" for k in allowed if k not in obj]
    unknown = [f"{where}: {k!r} is not a key this file knows" for k in obj if k not in allowed]
    return missing + unknown


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _texts(value):
    return isinstance(value, list) and all(isinstance(v, str) for v in value)


def _whole(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _minutes(value):
    return _whole(value) and value >= 0
