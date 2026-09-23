"""Tests for venues.py: one failing fixture per rule, the warning and the two helpers, and the committed files.

The fixtures are inline. The last test loads both committed years, data/2026/venues.json and data/2027/venues.json,
so that CI checks every later edit to them.

Run:  python -m pytest tests/
"""
import copy
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import venues  # noqa: E402


def level(lid, order, rooms, aliases=None, notes=None):
    return {"id": lid, "name": lid.title(), "order": order, "rooms": list(rooms), "aliases": aliases or {},
            "notes": notes or []}


def hotel(name, order, keys, levels=(), placeless=False, unplaced=None):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name,
            "order": order, "placeless": placeless, "display": "rest", "levels": list(levels),
            "unplaced": unplaced or {}}


# Hilton is first in the file and second in order; Streaming is placeless, so no walk pair is owed for it.
GOOD = {"walk": {"Hilton|Hyatt": 12}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10,
        "hotels": [hotel("Hilton", 1, ["Hilton"],
                         [level("l2", 1, ["Salon East", "Salon West", "202"],
                                aliases={"salon": ["Salon East", "Salon West"]}),
                          level("galleria", 0, ["Galleria 5"], notes=["directly under the lobby"])],
                         unplaced={"Steps B": "a Dragon Con name; level unknown"}),
                   hotel("Hyatt", 0, ["Hyatt"], [level("acc", 0, ["Piedmont"])]),
                   hotel("Streaming", 2, ["Streaming"], placeless=True)]}


def good():
    return copy.deepcopy(GOOD)


def problems(data):
    """The problems `check` raises, or [] when it is happy."""
    try:
        venues.check(data)
        return []
    except venues.VenuesError as exc:
        return exc.problems


def only(data):
    """The one problem this fixture is built to produce."""
    found = problems(data)
    assert len(found) == 1, found
    return found[0]


# --- the smallest valid file, and the helpers ------------------------------------

def test_a_valid_file_loads_with_its_two_helpers():
    v = venues.check(good())
    assert [h["hotel"] for h in v.hotels()] == ["Hyatt", "Hilton", "Streaming"]   # by order, not by the file's
    assert v.level_of("Hilton", "Salon East") == "l2" and v.level_of("Hilton", "Galleria 5") == "galleria"
    assert v.level_of("Hilton", "Steps B") is None                                 # unplaced: no level
    assert v.level_of("Hilton", "Piedmont") is None and v.level_of("Westin", "202") is None
    assert v.warnings == [] and v.data == GOOD


# --- keys: every one present, and no other ---------------------------------------

def test_every_key_is_required_and_no_other_is_known():
    d = good()
    del d["slack_min"]
    assert only(d) == "the file: slack_min is missing"
    d = good()
    d["slak_min"] = 10
    assert only(d) == "the file: 'slak_min' is not a key this file knows"
    d = good()
    del d["hotels"][0]["display"]
    assert only(d) == "hotels[0] Hilton: display is missing"
    d = good()
    d["hotels"][0]["levels"][0]["note"] = "a typo for notes"
    assert only(d) == "hotels[0] Hilton, level 'l2': 'note' is not a key this file knows"


def test_the_three_minute_values_are_whole_numbers():
    for bad in (-1, 2.5, "10", True, None):
        d = good()
        d["slack_min"] = bad
        assert "slack_min" in only(d) and "is not a whole number of minutes" in only(d), bad


# --- hotels ----------------------------------------------------------------------

def test_no_two_hotels_share_a_key_case_folded():
    d = good()
    d["hotels"][1]["keys"] = ["HILTON"]
    assert only(d) == "hotels[1] Hyatt: key 'HILTON' is also a key of Hilton"
    d = good()
    d["hotels"][0]["keys"] = ["Hilton", "hilton"]
    assert only(d) == "hotels[0] Hilton: key 'hilton' is listed twice"


def test_a_hotel_key_is_whole_tokens():
    for bad in ("Hilton-", " Hilton", "Hilton ", "Hil  ton", "Hilton, Atlanta", "Mart-2", ""):
        d = good()
        d["hotels"][0]["keys"] = [bad]
        assert "is not whole tokens" in only(d), bad
    d = good()
    d["hotels"][0]["keys"] = ["Courtland Grand", "Courtland"]    # two words are whole tokens
    assert problems(d) == []


def test_order_is_distinct_among_hotels_and_among_a_hotels_levels():
    d = good()
    d["hotels"][1]["order"] = 1
    assert only(d) == "hotels[1] Hyatt: order 1 is taken by Hilton"
    d = good()
    d["hotels"][0]["levels"][1]["order"] = 1
    assert only(d) == "hotels[0] Hilton, level 'galleria': order 1 is taken by level 'l2'"
    d = good()
    d["hotels"][1]["order"] = "0"
    assert only(d) == "hotels[1] Hyatt: order '0' is not a whole number"


def test_display_placeless_and_unplaced_are_checked():
    d = good()
    d["hotels"][0]["display"] = "whole"
    assert "is not one of rest, location" in only(d)
    d = good()
    d["hotels"][0]["placeless"] = "no"
    assert "placeless 'no' is not true or false" in only(d)
    d = good()
    d["hotels"][0]["unplaced"] = ["Steps B"]
    assert "unplaced is not a map of a room to its note" in only(d)


# --- levels and rooms ------------------------------------------------------------

def test_level_ids_are_unique_within_a_hotel():
    d = good()
    d["hotels"][0]["levels"][1]["id"] = "l2"
    assert only(d) == "hotels[0] Hilton, level 'l2': id 'l2' is already levels[0]"
    d = good()
    d["hotels"][1]["levels"][0]["id"] = "l2"                      # another hotel may use it
    assert problems(d) == []


def test_room_ids_are_unique_within_a_hotel_case_folded():
    d = good()
    d["hotels"][0]["levels"][1]["rooms"].append("salon east")     # across levels, case-folded
    assert only(d) == "hotels[0] Hilton, level 'galleria': room 'salon east' is already on level 'l2'"
    d = good()
    d["hotels"][0]["levels"][0]["rooms"].append("202")            # twice on one level
    assert only(d) == "hotels[0] Hilton, level 'l2': room '202' is already on level 'l2'"
    d = good()
    d["hotels"][0]["unplaced"]["202"] = "a second 202"            # an unplaced room against a level's
    assert only(d) == "hotels[0] Hilton: room '202' is already on level 'l2'"
    d = good()
    d["hotels"][1]["levels"][0]["rooms"].append("202")            # another hotel may hold it
    assert problems(d) == []


def test_an_alias_is_written_folded():
    for bad in ("Salon", "salon  hall", " salon", "SALON"):
        d = good()
        d["hotels"][0]["levels"][0]["aliases"] = {bad: ["Salon East"]}
        assert "is not written folded" in only(d), bad


def test_an_alias_names_rooms_on_its_own_level():
    d = good()
    d["hotels"][0]["levels"][0]["aliases"] = {"galleria five": ["Galleria 5"]}   # a room of another level
    assert only(d) == ("hotels[0] Hilton, level 'l2': alias 'galleria five' names 'Galleria 5', which is not a room "
                       "of this level")
    d = good()
    d["hotels"][0]["levels"][0]["aliases"] = {"salon": ["Salon North"]}         # no such room
    assert "names 'Salon North', which is not a room of this level" in only(d)
    d = good()
    d["hotels"][0]["levels"][0]["aliases"] = {"salon": []}
    assert only(d) == "hotels[0] Hilton, level 'l2': alias 'salon' names no rooms"


# --- the walk --------------------------------------------------------------------

def test_a_missing_walk_pair_between_placed_hotels_is_a_warning_not_a_problem():
    d = good()
    d["walk"] = {}
    v = venues.check(d)
    assert v.warnings == ["walk: no minutes for Hyatt and Hilton; unknown_pair_min is used"]   # never Streaming


def test_a_walk_pair_names_two_hotels_of_the_file_once():
    for key in ("Hilton|Nowhere", "Hilton|Hilton", "Hilton", "Hilton|Hyatt|Streaming"):
        d = good()
        d["walk"][key] = 5
        assert "is not two hotels of the file" in only(d), key
    d = good()
    d["walk"]["Hyatt|Hilton"] = 9
    assert only(d) == "walk: 'Hyatt|Hilton' is the pair 'Hilton|Hyatt' again"
    d = good()
    d["walk"]["Hilton|Hyatt"] = -3
    assert only(d) == "walk: 'Hilton|Hyatt' -3 is not a whole number of minutes"
    d = good()
    d["walk"]["Streaming|Hilton"] = 0                            # a placeless hotel may have one
    assert problems(d) == []


# --- one error, every problem ----------------------------------------------------

def test_load_reads_a_file_and_lists_every_problem_sorted(tmp_path):
    d = good()
    d["slack_min"] = "ten"
    d["hotels"][1]["keys"] = ["hilton"]
    d["walk"]["Hilton|Nowhere"] = 1
    path = tmp_path / "venues.json"
    path.write_text(json.dumps(d), encoding="utf-8")
    with pytest.raises(venues.VenuesError) as exc:
        venues.load(str(path))
    assert len(exc.value.problems) == 3 and exc.value.problems == sorted(exc.value.problems)
    assert "3 problem(s)" in str(exc.value)
    (tmp_path / "broken.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(venues.VenuesError, match="is not JSON"):
        venues.load(str(tmp_path / "broken.json"))
    with pytest.raises(venues.VenuesError, match="cannot be read"):
        venues.load(str(tmp_path / "absent.json"))
    with pytest.raises(venues.VenuesError, match="not an object"):
        venues.check([])


# --- the committed files ---------------------------------------------------------

def test_the_committed_venues_files_are_valid():
    """Both years, so that CI checks every later edit; 2026's holds every hotel value the frozen schedule does."""
    with open(os.path.join(ROOT, "data", "2026", "events.json"), "rb") as f:
        schedule = json.loads(f.read().decode("utf-8"))["events"]
    for year in ("2026", "2027"):
        v = venues.load(os.path.join(ROOT, "data", year, "venues.json"))
        held = {h["hotel"] for h in v.hotels()}
        if year == "2026":
            assert {e["hotel"] for e in schedule} <= held
        assert {"Streaming", "Other", "Unknown"} <= {h["hotel"] for h in v.hotels() if h["placeless"]}
