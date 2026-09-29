"""Tests for the level drawings, data/<year>/drawings/ (DECISIONS #58): one failing fixture per rule, and every
committed drawing held to its year's venues.json.

A drawing is geometry keyed by the venues file's ids; data/2027/drawings/README.md is the format. Its hotel and its
level are the venues file's, and its file is named for them; every room it names is a room of that level, drawn once;
its composites and its groups are made of the file's own leaf rooms; and every rectangle's centre is on the drawn
area, give or take half the rectangle's diagonal. The fixed values are the format's - feet, north up, a group a run or
a ballroom, a street on one of four sides - and a landmark's kind is one tools/render_drawings.py draws.

The fixtures are inline; the last test reads data/*/drawings/*.json and each year's venues.json.

Run:  python -m pytest tests/
"""
import copy
import glob
import json
import math
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))

import render_drawings  # noqa: E402

GROUP_KINDS = ("run", "ballroom")
SIDES = ("N", "S", "E", "W")


def problems(d, venues, name):
    """Every way the drawing `d`, in a file named `name`, breaks the format against `venues`, a venues.json as loaded;
    [] where it holds. An unknown hotel or level is the one problem told, since every room would follow it."""
    hotel = next((h for h in venues["hotels"] if h["hotel"] == d["hotel"]), None)
    if hotel is None:
        return [f"hotel {d['hotel']!r} is not a hotel of the venues file"]
    level = next((lv for lv in hotel["levels"] if lv["id"] == d["level"]), None)
    if level is None:
        return [f"level {d['level']!r} is not a level of {d['hotel']}"]
    out = []
    named_for = render_drawings.stem(d["hotel"], d["level"]) + ".json"
    if name != named_for:
        out.append(f"the file is named {name!r}, not {named_for!r}")
    if d["units"] != "ft":
        out.append(f"units {d['units']!r} is not 'ft'")
    if d["north"] != "up":
        out.append(f"north {d['north']!r} is not 'up'")

    leaves = [r["id"] for r in d["rooms"]]
    ids = leaves + [c["id"] for c in d["composites"]]
    named = ids + [i for c in d["composites"] for i in c["of"]] + [i for g in d["groups"] for i in g["rooms"]]
    out += [f"{i!r} is not a room of {d['hotel']}'s level {d['level']!r}"
            for i in dict.fromkeys(named) if i not in level["rooms"]]
    out += [f"{i!r} is drawn more than once among the rooms and the composites"
            for i in dict.fromkeys(ids) if ids.count(i) > 1]
    out += [f"composite {c['id']!r}: {i!r} is not a leaf room of this file"
            for c in d["composites"] for i in c["of"] if i not in leaves]
    out += [f"group {g['name']!r}: {i!r} is not a leaf room of this file"
            for g in d["groups"] for i in g["rooms"] if i not in leaves]

    w, h = d["extent"]["w"], d["extent"]["h"]
    shapes = ([(f"room {r['id']!r}", r) for r in d["rooms"]]
              + [(f"group {g['name']!r}", g["outline"]) for g in d["groups"]]
              + [(f"open {a['name']!r}", a) for a in d["open"]])
    for what, r in shapes:
        slack = math.hypot(r["w"], r["h"]) / 2
        if not (-slack <= r["cx"] <= w + slack and -slack <= r["cy"] <= h + slack):
            out.append(f"{what}: its centre is off the extent by more than half its diagonal")

    out += [f"landmark {m['name']!r}: kind {m['kind']!r} is not one the renderer draws"
            for m in d["landmarks"] if m["kind"] not in render_drawings.GLYPH]
    out += [f"group {g['name']!r}: kind {g['kind']!r} is not run or ballroom"
            for g in d["groups"] if g["kind"] not in GROUP_KINDS]
    out += [f"street {s['name']!r}: side {s['side']!r} is not N, S, E or W"
            for s in d["streets"] if s["side"] not in SIDES]
    return out


def rect(cx, cy, w, h, rot=0):
    return {"cx": cx, "cy": cy, "w": w, "h": h, "rot": rot}


# Crystal A is the hotel's, on another level; 215 is the level's, and not drawn.
VENUES = {"hotels": [{"hotel": "Hilton", "levels": [
    {"id": "l1", "rooms": ["Crystal A"]},
    {"id": "l2", "rooms": ["202", "215", "Grand Ballroom A", "Grand Ballroom B", "Grand East", "Salon East",
                           "Salon West"]}]}]}
NAME = "hilton-l2.json"
GOOD = {"hotel": "Hilton", "level": "l2", "units": "ft", "north": "up", "extent": {"w": 200, "h": 100},
        "rooms": [{"id": "Grand Ballroom A", **rect(40, 30, 40, 40)}, {"id": "Grand Ballroom B", **rect(80, 30, 40, 40)},
                  {"id": "Salon West", **rect(110, 75, 40, 30)}, {"id": "Salon East", **rect(150, 75, 40, 30)},
                  {"id": "202", **rect(185, 20, 20, 30, 61)}],
        "composites": [{"id": "Grand East", "of": ["Grand Ballroom A", "Grand Ballroom B"]}],
        "groups": [{"name": "Grand Ballroom", "kind": "ballroom", "rooms": ["Grand Ballroom A", "Grand Ballroom B"],
                    "outline": rect(60, 30, 80, 40)},
                   {"name": "Salon", "kind": "ballroom", "rooms": ["Salon West", "Salon East"],
                    "outline": rect(130, 75, 80, 30)}],
        "open": [{"name": "Pre-function", **rect(100, 55, 180, 10)}],
        "landmarks": [{"kind": "escalator", "name": "Escalators", "x": 190, "y": 90}],
        "streets": [{"name": "Courtland Street", "side": "W"}],
        "sources": [], "notes": []}


def good():
    return copy.deepcopy(GOOD)


def only(d, name=NAME):
    """The one problem this fixture is built to produce."""
    found = problems(d, VENUES, name)
    assert len(found) == 1, found
    return found[0]


# --- a valid drawing -------------------------------------------------------------

def test_a_valid_drawing_has_no_problems_and_renders():
    assert problems(good(), VENUES, NAME) == []
    svg = render_drawings.render(good(), "2nd Floor", "Hilton Atlanta")
    assert svg.startswith("<svg ") and svg.endswith("</svg>") and "\n" not in svg
    assert "Hilton Atlanta · 2nd Floor" in svg and "GRAND EAST" in svg


# --- the hotel, the level and the file's name ------------------------------------

def test_the_hotel_and_the_level_are_the_venues_files():
    d = good()
    d["hotel"] = "Hiltn"
    assert only(d) == "hotel 'Hiltn' is not a hotel of the venues file"
    d = good()
    d["level"] = "l9"
    assert only(d) == "level 'l9' is not a level of Hilton"


def test_the_file_is_named_for_its_hotel_and_level():
    assert only(good(), "hilton-2nd-floor.json") == "the file is named 'hilton-2nd-floor.json', not 'hilton-l2.json'"
    assert render_drawings.stem("Courtland Grand", "l1") == "courtland-grand-l1"   # spaces as hyphens


def test_the_units_are_feet_and_north_is_up():
    d = good()
    d["units"] = "m"
    assert only(d) == "units 'm' is not 'ft'"
    d = good()
    d["north"] = "down"
    assert only(d) == "north 'down' is not 'up'"


# --- rooms: the level's ids, each once; composites and groups of the file's leaves --

def test_every_room_named_is_a_room_of_the_level():
    d = good()
    d["rooms"].append({"id": "Crystal A", **rect(20, 80, 20, 20)})   # the hotel's, but another level's
    assert only(d) == "'Crystal A' is not a room of Hilton's level 'l2'"
    d = good()
    d["composites"][0]["id"] = "Grand North"
    assert only(d) == "'Grand North' is not a room of Hilton's level 'l2'"


def test_no_room_is_drawn_twice():
    d = good()
    d["rooms"].append(copy.deepcopy(d["rooms"][3]))
    assert only(d) == "'Salon East' is drawn more than once among the rooms and the composites"
    d = good()
    d["composites"][0]["id"] = "Grand Ballroom A"   # a leaf is not also a composite
    assert only(d) == "'Grand Ballroom A' is drawn more than once among the rooms and the composites"


def test_composites_and_groups_are_made_of_the_files_leaf_rooms():
    d = good()
    d["composites"][0]["of"].append("215")   # a room of the level, but not drawn
    assert only(d) == "composite 'Grand East': '215' is not a leaf room of this file"
    d = good()
    d["groups"][1]["rooms"].append("215")
    assert only(d) == "group 'Salon': '215' is not a leaf room of this file"


# --- the extent ------------------------------------------------------------------

def test_every_rectangles_centre_is_on_the_extent_give_or_take_half_its_diagonal():
    d = good()
    d["rooms"][0]["cx"] = 200 + 28   # 40 x 40: half its diagonal is 28.3
    assert problems(d, VENUES, NAME) == []
    d["rooms"][0]["cx"] = 200 + 29
    assert only(d) == "room 'Grand Ballroom A': its centre is off the extent by more than half its diagonal"
    d = good()
    d["groups"][1]["outline"]["cy"] = -43   # 80 x 30: half its diagonal is 42.7
    assert only(d) == "group 'Salon': its centre is off the extent by more than half its diagonal"
    d = good()
    d["open"][0]["cx"] = -91   # 180 x 10: half its diagonal is 90.1
    assert only(d) == "open 'Pre-function': its centre is off the extent by more than half its diagonal"


# --- the kinds the format fixes --------------------------------------------------

def test_landmark_group_and_street_kinds_are_the_formats():
    d = good()
    d["landmarks"][0]["kind"] = "stairs"
    assert only(d) == "landmark 'Escalators': kind 'stairs' is not one the renderer draws"
    d = good()
    d["groups"][0]["kind"] = "hall"
    assert only(d) == "group 'Grand Ballroom': kind 'hall' is not run or ballroom"
    d = good()
    d["streets"][0]["side"] = "NE"
    assert only(d) == "street 'Courtland Street': side 'NE' is not N, S, E or W"
    assert set(render_drawings.GLYPH) == {"escalator", "elevator", "entrance", "bridge", "info"}   # the format's five


# --- the committed drawings ------------------------------------------------------

def test_every_committed_drawing_holds_to_its_years_venues_file():
    paths = sorted(glob.glob(os.path.join(ROOT, "data", "*", "drawings", "*.json")))
    assert paths, "no drawing under data/<year>/drawings/"
    for path in paths:
        with open(os.path.join(os.path.dirname(os.path.dirname(path)), "venues.json"), encoding="utf-8") as f:
            venues = json.load(f)
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        assert problems(d, venues, os.path.basename(path)) == [], path
