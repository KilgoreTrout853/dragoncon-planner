"""Tests for the level drawings, data/<year>/drawings/ (DECISIONS #58, #67): one failing fixture per rule; every
committed drawing held to its year's venues.json, and each hotel's drawings of a year to one frame.

A drawing is geometry keyed by the venues file's ids; data/2027/drawings/README.md is the format. Its hotel and its
level are the venues file's, and its file is named for them; every room it names is a room of that level, drawn once
among its rooms, its composites and its identified open areas; its composites and its groups are made of the file's
own leaf rooms; every rectangle lies wholly on the drawn area, all four of its rotated corners, to within rounding; and
its anchors are well formed, named once and on the drawn area. The fixed values are the format's - feet, north up, a
group a run or a ballroom, a street on one of four sides - and a landmark's kind is one tools/render_drawings.py draws.
Across one year's drawings of a hotel, the levels share one frame: one extent, and one position for an anchor name, to
within 0.5 ft.

The fixtures are inline; the last test reads data/*/drawings/*.json and each year's venues.json.

Run:  python -m pytest tests/
"""
import copy
import glob
import json
import math
import os
import sys
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))

import render_drawings  # noqa: E402

GROUP_KINDS = ("run", "ballroom")
SIDES = ("N", "S", "E", "W")
ROUNDING = 0.05   # ft: a drawing writes its numbers to 0.1 ft, so a corner may sit half that past where it was measured
ANCHOR_TOLERANCE = 0.5   # ft: how far apart one anchor's positions in two files of a hotel may be, as the crow flies


def corners(r):
    """The four corners of a rectangle {cx, cy, w, h, rot}, rotated about its centre."""
    t = math.radians(r.get("rot", 0))
    c, s = math.cos(t), math.sin(t)
    return [(r["cx"] + dx * c - dy * s, r["cy"] + dx * s + dy * c)
            for dx in (-r["w"] / 2, r["w"] / 2) for dy in (-r["h"] / 2, r["h"] / 2)]


def well_formed(a):
    """An anchor is {name, x, y}: a name, and two numbers."""
    number = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    return (isinstance(a, dict) and set(a) == {"name", "x", "y"} and isinstance(a["name"], str) and a["name"].strip()
            and number(a["x"]) and number(a["y"]))


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
    ids = leaves + [c["id"] for c in d["composites"]] + [a["id"] for a in d["open"] if "id" in a]
    named = ids + [i for c in d["composites"] for i in c["of"]] + [i for g in d["groups"] for i in g["rooms"]]
    out += [f"{i!r} is not a room of {d['hotel']}'s level {d['level']!r}"
            for i in dict.fromkeys(named) if i not in level["rooms"]]
    out += [f"{i!r} is drawn more than once among the rooms, the composites and the open areas"
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
        if not all(-ROUNDING <= x <= w + ROUNDING and -ROUNDING <= y <= h + ROUNDING for x, y in corners(r)):
            out.append(f"{what}: a corner is off the extent")

    if "anchors" not in d:
        out.append("anchors is missing: [] where a level has none")
    anchors = [a for a in d.get("anchors", []) if well_formed(a)]
    out += [f"anchors[{i}] is not {{name, x, y}}: a name and two numbers"
            for i, a in enumerate(d.get("anchors", [])) if not well_formed(a)]
    names = [a["name"] for a in anchors]
    out += [f"anchor {n!r} is named twice" for n in dict.fromkeys(names) if names.count(n) > 1]
    out += [f"anchor {a['name']!r} is off the extent" for a in anchors if not (0 <= a["x"] <= w and 0 <= a["y"] <= h)]

    out += [f"landmark {m['name']!r}: kind {m['kind']!r} is not one the renderer draws"
            for m in d["landmarks"] if m["kind"] not in render_drawings.GLYPH]
    out += [f"group {g['name']!r}: kind {g['kind']!r} is not run or ballroom"
            for g in d["groups"] if g["kind"] not in GROUP_KINDS]
    out += [f"street {s['name']!r}: side {s['side']!r} is not N, S, E or W"
            for s in d["streets"] if s["side"] not in SIDES]
    return out


def frame_problems(files):
    """Every way one year's drawings of one hotel, `files` mapping a file's name to its drawing, break the shared frame;
    [] where they hold. An extent is told against the first file in name order; an anchor's position against every
    earlier file, in name order, that names it, so no two of its positions lie more than 0.5 ft apart."""
    out, first, seen = [], None, defaultdict(list)
    for name in sorted(files):
        d = files[name]
        w, h = d["extent"]["w"], d["extent"]["h"]
        if first is None:
            first = (name, w, h)
        elif (w, h) != first[1:]:
            out.append(f"{name}: extent {w:g} x {h:g} is not {first[0]}'s {first[1]:g} x {first[2]:g}")
        for a in d.get("anchors", []):
            if not well_formed(a):
                continue
            for there, x0, y0 in seen[a["name"]]:
                apart = math.hypot(a["x"] - x0, a["y"] - y0)
                if apart > ANCHOR_TOLERANCE:
                    out.append(f"anchor {a['name']!r}: {name} has ({a['x']:g}, {a['y']:g}), {apart:.1f} ft from "
                               f"{there}'s ({x0:g}, {y0:g})")
            seen[a["name"]].append((name, a["x"], a["y"]))
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
        "anchors": [{"name": "escalators", "x": 190, "y": 90}],
        "rooms": [{"id": "Grand Ballroom A", **rect(40, 30, 40, 40)}, {"id": "Grand Ballroom B", **rect(80, 30, 40, 40)},
                  {"id": "Salon West", **rect(110, 75, 40, 30)}, {"id": "Salon East", **rect(150, 75, 40, 30)},
                  {"id": "202", **rect(180, 20, 20, 30, 61)}],
        "composites": [{"id": "Grand East", "of": ["Grand Ballroom A", "Grand Ballroom B"]}],
        "groups": [{"name": "Grand Ballroom", "kind": "ballroom", "rooms": ["Grand Ballroom A", "Grand Ballroom B"],
                    "outline": rect(60, 30, 80, 40)},
                   {"name": "Salon", "kind": "ballroom", "rooms": ["Salon West", "Salon East"],
                    "outline": rect(130, 75, 80, 30)}],
        "open": [{"name": "Pre-function", **rect(100, 55, 180, 10)}],
        "landmarks": [{"kind": "escalator", "name": "Escalators", "x": 190, "y": 90}],
        "streets": [{"name": "Courtland Street", "side": "W"}],
        "sources": [], "notes": []}
# The floor below, in the same frame: the same extent, and the escalators where the 2nd floor has them.
L1_NAME = "hilton-l1.json"
L1 = {"hotel": "Hilton", "level": "l1", "units": "ft", "north": "up", "extent": {"w": 200, "h": 100},
      "anchors": [{"name": "escalators", "x": 190, "y": 90}, {"name": "lift", "x": 20, "y": 90}],
      "rooms": [{"id": "Crystal A", **rect(40, 40, 40, 40)}], "composites": [], "groups": [], "open": [],
      "landmarks": [], "streets": [], "sources": [], "notes": []}


def good():
    return copy.deepcopy(GOOD)


def l1():
    return copy.deepcopy(L1)


def only(d, name=NAME):
    """The one problem this fixture is built to produce."""
    found = problems(d, VENUES, name)
    assert len(found) == 1, found
    return found[0]


def only_frame(files):
    """The one problem this pair of floors is built to produce."""
    found = frame_problems(files)
    assert len(found) == 1, found
    return found[0]


# --- a valid drawing -------------------------------------------------------------

def test_a_valid_drawing_has_no_problems_and_renders():
    assert problems(good(), VENUES, NAME) == []
    svg = render_drawings.render(good(), "2nd Floor", "Hilton Atlanta")
    assert svg.startswith("<svg ") and svg.endswith("</svg>") and "\n" not in svg
    assert "Hilton Atlanta · 2nd Floor" in svg and "GRAND EAST" in svg
    anchor = svg.split('data-anchor="escalators"', 1)[1].split("</g>", 1)[0]   # an anchor: a cross and its name
    assert render_drawings.ANCHOR in anchor and ">escalators</text>" in anchor
    scenery = svg.split('data-open="Pre-function"', 1)[1].split("</text></g>", 1)[0]   # no id: scenery, its name
    assert render_drawings.LINE in scenery and scenery.endswith(">Pre-function") and 'data-place="' not in svg


def test_an_open_area_with_an_id_renders_as_a_place():
    d = good()
    d["open"][0]["id"] = "215"
    svg = render_drawings.render(d, "2nd Floor", "Hilton Atlanta")
    place = svg.split('data-place="215"', 1)[1].split("</g></g>", 1)[0]   # in the rooms' colour, labelled by its id
    assert render_drawings.ROOM_STROKE in place and ">215</text>" in place and 'data-open="' not in svg


def test_every_level_renders_at_one_scale_with_the_frame_at_one_offset():
    short, long = good(), good()
    long["notes"] = ["a note that runs on " * 30, "and another"]   # wrapped under the scale bar: the canvas grows
    a, b = (render_drawings.render(d, "2nd Floor", "Hilton Atlanta") for d in (short, long))
    for svg in (a, b):
        assert '<g transform="translate(40 120)"><rect x="0" y="0" width="400.0" height="200.0"' in svg   # 2 px per ft
    size = lambda svg: svg.split('viewBox="0 0 ', 1)[1].split('"', 1)[0].split()
    assert size(a)[0] == size(b)[0] and int(size(b)[1]) > int(size(a)[1])


def test_a_ballrooms_member_is_labelled_by_the_words_its_groups_name_lacks():
    svg = render_drawings.render(good(), "2nd Floor", "Hilton Atlanta")
    for label in ("A", "B", "West", "East"):   # Grand Ballroom A in Grand Ballroom; Salon West in Salon
        assert f">{label}</text>" in svg
    d = good()   # the id's last word is the group's: the words before it are the label
    d["composites"] = []
    d["rooms"][0]["id"], d["rooms"][1]["id"] = "North Grand Ballroom", "South Grand Ballroom"
    d["groups"][0]["rooms"] = ["North Grand Ballroom", "South Grand Ballroom"]
    svg = render_drawings.render(d, "2nd Floor", "Hilton Atlanta")
    assert ">North</text>" in svg and ">South</text>" in svg and ">Ballroom</text>" not in svg
    d["rooms"][0]["id"] = d["groups"][0]["rooms"][0] = "Grand Ballroom"   # every word the group's: its last word
    assert ">Ballroom</text>" in render_drawings.render(d, "2nd Floor", "Hilton Atlanta")


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
    assert only(d) == "'Salon East' is drawn more than once among the rooms, the composites and the open areas"
    d = good()
    d["composites"][0]["id"] = "Grand Ballroom A"   # a leaf is not also a composite
    assert only(d) == "'Grand Ballroom A' is drawn more than once among the rooms, the composites and the open areas"


def test_composites_and_groups_are_made_of_the_files_leaf_rooms():
    d = good()
    d["composites"][0]["of"].append("215")   # a room of the level, but not drawn
    assert only(d) == "composite 'Grand East': '215' is not a leaf room of this file"
    d = good()
    d["groups"][1]["rooms"].append("215")
    assert only(d) == "group 'Salon': '215' is not a leaf room of this file"


# --- open areas: scenery, or a place with a room's id -----------------------------

def test_an_open_area_with_an_id_is_a_room_of_the_level_drawn_once():
    d = good()
    d["open"][0]["id"] = "215"   # a room of the level that no rectangle draws: the open area is where it is
    assert problems(d, VENUES, NAME) == []
    d["open"][0]["id"] = "Crystal A"
    assert only(d) == "'Crystal A' is not a room of Hilton's level 'l2'"
    d["open"][0]["id"] = "Salon East"
    assert only(d) == "'Salon East' is drawn more than once among the rooms, the composites and the open areas"


def test_an_open_area_is_no_composites_or_groups_member():
    d = good()
    d["open"][0]["id"] = "215"
    d["composites"][0]["of"].append("215")
    assert only(d) == "composite 'Grand East': '215' is not a leaf room of this file"
    d = good()
    d["open"][0]["id"] = "215"
    d["groups"][1]["rooms"].append("215")
    assert only(d) == "group 'Salon': '215' is not a leaf room of this file"


# --- the extent ------------------------------------------------------------------

def test_every_rectangle_lies_wholly_on_the_extent():
    d = good()
    d["rooms"][0]["cx"] = 180   # 40 x 40: its east side on the extent's
    assert problems(d, VENUES, NAME) == []
    d["rooms"][0]["cx"] = 180.1
    assert only(d) == "room 'Grand Ballroom A': a corner is off the extent"
    d = good()
    d["rooms"][0]["cy"] = 20   # its north side on the extent's
    assert problems(d, VENUES, NAME) == []
    d["rooms"][0]["cy"] = 19.9
    assert only(d) == "room 'Grand Ballroom A': a corner is off the extent"
    d = good()
    d["rooms"][4]["cx"] = 182   # 20 x 30 turned 61 degrees: its east corner at 199.97, though its centre is 18 ft in
    assert problems(d, VENUES, NAME) == []
    d["rooms"][4]["cx"] = 182.1
    assert only(d) == "room '202': a corner is off the extent"
    d = good()
    d["groups"][1]["outline"]["cy"] = 85   # 80 x 30: its south side on the extent's
    assert problems(d, VENUES, NAME) == []
    d["groups"][1]["outline"]["cy"] = 85.1
    assert only(d) == "group 'Salon': a corner is off the extent"
    d = good()
    d["open"][0]["cx"] = 90   # 180 x 10: its west side on the extent's
    assert problems(d, VENUES, NAME) == []
    d["open"][0]["cx"] = 89.9
    assert only(d) == "open 'Pre-function': a corner is off the extent"


# --- anchors ---------------------------------------------------------------------

def test_anchors_are_well_formed():
    d = good()
    d["anchors"] = []   # a level may have none
    assert problems(d, VENUES, NAME) == []
    del d["anchors"]   # but says so
    assert only(d) == "anchors is missing: [] where a level has none"
    for broken in ({"name": "escalators", "x": "190", "y": 90}, {"name": "escalators", "x": 190},
                   {"name": "", "x": 190, "y": 90}, {"name": "escalators", "x": 190, "y": 90, "floor": 2},
                   {"name": "escalators", "x": True, "y": 90}):
        d = good()
        d["anchors"][0] = broken
        assert only(d) == "anchors[0] is not {name, x, y}: a name and two numbers", broken


def test_an_anchor_is_named_once_in_a_file():
    d = good()
    d["anchors"].append({"name": "escalators", "x": 10, "y": 10})
    assert only(d) == "anchor 'escalators' is named twice"


def test_every_anchor_is_on_the_extent():
    d = good()
    d["anchors"][0]["x"] = 200   # on the extent's east side
    assert problems(d, VENUES, NAME) == []
    d["anchors"][0]["x"] = 200.1
    assert only(d) == "anchor 'escalators' is off the extent"
    d["anchors"][0]["x"] = 0   # on its west side
    assert problems(d, VENUES, NAME) == []
    d["anchors"][0]["x"] = -0.1
    assert only(d) == "anchor 'escalators' is off the extent"
    d = good()
    d["anchors"][0]["y"] = 0   # on its north side
    assert problems(d, VENUES, NAME) == []
    d["anchors"][0]["y"] = -0.1
    assert only(d) == "anchor 'escalators' is off the extent"
    d["anchors"][0]["y"] = 100   # on its south side
    assert problems(d, VENUES, NAME) == []
    d["anchors"][0]["y"] = 100.1
    assert only(d) == "anchor 'escalators' is off the extent"


# --- a hotel's levels share one frame ---------------------------------------------

def test_a_hotels_levels_share_one_extent():
    assert problems(l1(), VENUES, L1_NAME) == []
    assert frame_problems({NAME: good(), L1_NAME: l1()}) == []
    d = good()
    d["extent"]["h"] = 110
    assert only_frame({NAME: d, L1_NAME: l1()}) == "hilton-l2.json: extent 200 x 110 is not hilton-l1.json's 200 x 100"
    d = good()
    d["extent"]["w"] = 210
    assert only_frame({NAME: d, L1_NAME: l1()}) == "hilton-l2.json: extent 210 x 100 is not hilton-l1.json's 200 x 100"


def test_an_anchor_named_in_two_files_has_one_position():
    d = good()
    d["anchors"][0]["x"] = 190.5   # 0.5 ft from the 1st floor's
    assert frame_problems({NAME: d, L1_NAME: l1()}) == []
    d["anchors"][0]["x"] = 190.6
    assert only_frame({NAME: d, L1_NAME: l1()}) == \
        "anchor 'escalators': hilton-l2.json has (190.6, 90), 0.6 ft from hilton-l1.json's (190, 90)"
    d = good()
    d["anchors"][0]["x"], d["anchors"][0]["y"] = 190.4, 90.4   # each within 0.5, but 0.57 ft as the crow flies
    assert only_frame({NAME: d, L1_NAME: l1()}) == \
        "anchor 'escalators': hilton-l2.json has (190.4, 90.4), 0.6 ft from hilton-l1.json's (190, 90)"
    d, l3 = good(), l1()   # three floors: each within 0.5 ft of the 1st, but the 2nd and the 3rd 0.9 ft apart
    d["anchors"][0]["x"] = 190.45
    l3["level"], l3["anchors"][0]["x"] = "l3", 189.55
    assert only_frame({NAME: d, L1_NAME: l1(), "hilton-l3.json": l3}) == \
        "anchor 'escalators': hilton-l3.json has (189.55, 90), 0.9 ft from hilton-l2.json's (190.45, 90)"


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

def test_every_committed_drawing_holds_to_its_years_venues_file_and_its_hotels_frame():
    paths = sorted(glob.glob(os.path.join(ROOT, "data", "*", "drawings", "*.json")))
    assert paths, "no drawing under data/<year>/drawings/"
    frames = defaultdict(dict)
    for path in paths:
        year = os.path.dirname(os.path.dirname(path))
        with open(os.path.join(year, "venues.json"), encoding="utf-8") as f:
            venues = json.load(f)
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        assert problems(d, venues, os.path.basename(path)) == [], path
        frames[(year, d["hotel"])][os.path.basename(path)] = d
    for (year, hotel), files in frames.items():
        assert frame_problems(files) == [], (year, hotel)
