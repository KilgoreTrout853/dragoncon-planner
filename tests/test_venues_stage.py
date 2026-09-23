"""Tests for the venues stage, venues_stage.py (DECISIONS #45; contract.md, `venues.json`): the split - every case
tests/test_parse.py held for scraper.split_hotel, the Courtland and hyphenated strings it read wrong, no key, empty,
the Mart's whole location - each rule of the grammar reading its rooms and failing when one is missing or they span
two levels, the order of alias, exact and rule, the Mart, floors, partitions, the rewrites, the trailing note, the
placeless hotels and the re-split, the report and its counters, and purity. All on an inline venues file; nothing here
reads data/.

Run:  python -m pytest tests/
"""
import copy
import os
import sys

import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import venues  # noqa: E402
import venues_stage as vs  # noqa: E402


def level(lid, name, order, rooms, aliases=None):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": aliases or {}, "notes": []}


def hotel(name, order, keys, levels=(), unplaced=None, placeless=False, display="rest"):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": display, "levels": list(levels), "unplaced": unplaced or {}}


HANOVER = [f"Hanover {x}" for x in "ABCDEFG"]
VENUES = {"walk": {}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10, "hotels": [
    hotel("Marriott", 0, ["Marriott"], [
        level("marquis", "Marquis Level", 0, ["Imperial Ballroom A", "Imperial Ballroom B", "Marquis Ballroom A",
                                              "Marquis Ballroom B", "M301", "M302", "M303"]),
        level("lobby", "Lobby Level", 1, ["L401", "L402", "L403"]),
        level("atrium", "Atrium Level", 2, [f"Atrium Ballroom {x}" for x in "ABCD"])]),
    hotel("Hyatt", 1, ["Hyatt"], [
        level("acc", "Conference Center", 0, ["Piedmont", "Inman"],
              aliases={"conference piedmont": ["Piedmont"], "inman": ["Piedmont"]}),
        level("exhibit", "Exhibit Level", 1, ["Grand Hall", "Grand Hall D"] + HANOVER + ["Hanover AB", "Regency VII"]),
        level("ballroom", "Ballroom Level", 2, ["Centennial I", "Centennial II", "Centennial III", "Centennial IV",
                                                "Regency V", "Regency VI", "Learning Center"],
              aliases={"centennial ii-iv": ["Centennial II"]}),
        level("tower-ll1", "Tower LL1", 3, ["International North", "International South"]),
        level("tower-ll2", "Tower LL2", 4, ["Embassy A", "Embassy B"])]),
    hotel("Hilton", 2, ["Hilton"], [
        level("galleria", "Galleria", 0, [f"Galleria {n}" for n in range(1, 9)]),
        level("l2", "Level 2", 1, ["209", "210", "211", "212", "213", "214", "Salon East", "Salon West"]),
        level("l3", "Level 3", 2, ["215", "216", "301"])],                 # a run from 213 to 216 spans two levels
          unplaced={"Steps B": "a Dragon Con name; level unknown"}),
    hotel("Courtland Grand", 3, ["Courtland Grand", "Courtland"],
          [level("unknown", "levels unknown", 0, ["Athens", "Capitol Ballroom"])]),
    hotel("Westin", 4, ["Westin"], [
        level("f7", "Seventh Floor", 0, ["Augusta I", "Augusta II", "Augusta III"]),
        level("f8", "Eighth Floor", 1, ["Peachtree Ballroom A", "Peachtree Ballroom B", "Peachtree Ballroom C"]),
        level("f9", "Ninth Floor", 2, ["Peachtree G", "Peachtree H"]),
        level("f10", "Tenth Floor", 3, ["Peachtree 1", "Peachtree 2"]),
        level("f12", "Twelfth Floor", 4, ["1201"]),
        level("f14", "Fourteenth Floor", 5, ["1401"])]),
    hotel("AmericasMart", 5, ["AmericasMart", "Mart2", "Mart"], [
        level("b3f1", "Building 3, Floor 1", 0, []),
        level("b3f2", "Building 3, Floor 2", 1, []),
        level("b2-rooms", "Building 2, meeting rooms", 2, ["203A", "203B", "203C", "203D", "204J"]),
        level("b2-vendor-f1", "Building 2, Vendor Hall Floor 1", 3, [])], display="location"),
    hotel("Hardy Ivy Park", 6, ["Hardy"]),
    hotel("Streaming", 7, ["Streaming"], placeless=True),
    hotel("Other", 8, ["O", "Other"], placeless=True),
    hotel("Unknown", 9, [], placeless=True),
]}
V = venues.check(VENUES)


def at(location):
    """A location's five fields: (hotel, room, level, rooms, place)."""
    p = vs.place(location, V)
    return p.hotel, p.room, p.level, list(p.rooms), p.place


def rules(location):
    return vs.place(location, V).rules


# ---------------------------------------------------------------------------
# The split
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("location, expected", [
    # what tests/test_parse.py held for scraper.split_hotel, which this replaces
    ("Marriott M302-M303", ("Marriott", "M302-M303")),
    ("Mart Building 3, Floor 1", ("AmericasMart", "Mart Building 3, Floor 1")),
    ("Hilton 202", ("Hilton", "202")),
    ("Hyatt Grand Hall C", ("Hyatt", "Grand Hall C")),
    ("Courtland Grand Capitol Ballroom", ("Courtland Grand", "Capitol Ballroom")),   # was "Grand Capitol Ballroom"
    ("Westin Chastain F", ("Westin", "Chastain F")),
    ("Mart2 Vendor Hall Floor 3", ("AmericasMart", "Mart2 Vendor Hall Floor 3")),
    ("Hardy Ivy Structure", ("Hardy Ivy Park", "Ivy Structure")),
    ("Streaming STRM_TWITCH https://twitch.tv/x", ("Streaming", "STRM_TWITCH https://twitch.tv/x")),
    ("", ("Unknown", "")),
    # the offsite marker, "O", is a key of Other and dropped; a string no key begins is Other, whole
    ("O Joystick Gamebar", ("Other", "Joystick Gamebar")),
    ("O Georgia Aquarium", ("Other", "Georgia Aquarium")),
    ("Walton Spring Park", ("Other", "Walton Spring Park")),
    ("Onesie Lounge", ("Other", "Onesie Lounge")),                # "O" is a whole token or nothing
], ids=lambda x: x if isinstance(x, str) else None)
def test_the_split_reads_every_case_split_hotel_did(location, expected):
    assert at(location)[:2] == expected


def test_the_split_takes_the_longest_key_as_whole_tokens_and_cuts_after_a_space_comma_or_hyphen():
    assert vs.split("Courtland Grand Athens", V) == ("Courtland Grand", "Athens", "Courtland Grand")
    assert vs.split("Courtland Athens", V) == ("Courtland Grand", "Athens", "Courtland")
    assert vs.split("Hilton-Salon", V) == ("Hilton", "Salon", "Hilton")
    assert vs.split("Hyatt-Grand Hall D", V) == ("Hyatt", "Grand Hall D", "Hyatt")
    assert vs.split("Marriott-A703", V) == ("Marriott", "A703", "Marriott")
    assert vs.split("Hardy - Terraces", V) == ("Hardy Ivy Park", "Terraces", "Hardy")
    assert vs.split("Marriott, Imperial Ballroom", V) == ("Marriott", "Imperial Ballroom", "Marriott")
    assert vs.split("hilton  galleria 5 ", V) == ("Hilton", "galleria 5", "Hilton")      # case, and spacing
    assert vs.split("Mart2 203A", V) == ("AmericasMart", "203A", "Mart2")
    assert vs.split("Martian Room", V) == ("Other", "Martian Room", None)                 # "Mart" is not a token
    assert vs.split("Walton Spring Park", V) == ("Other", "Walton Spring Park", None)
    assert vs.split("  ", V) == ("Unknown", "", None)


def test_a_bare_key_is_the_hotel_alone_with_an_empty_room():
    assert at("Hyatt") == ("Hyatt", "", None, [], "hotel") and rules("Hyatt") == ("hotel only",)
    assert vs.place("Hyatt", V).why == "hotel only"
    assert at("Hyatt Hyatt") == ("Hyatt", "Hyatt", None, [], "hotel")                 # the hotel's name again
    assert at("Hardy Ivy Structure") == ("Hardy Ivy Park", "Ivy Structure", None, [], "hotel")  # no levels: no reading
    assert vs.place("Hardy Ivy Structure", V).why == "no reading"


def test_the_mart_shows_its_whole_location_and_reads_the_rest():
    assert at("Mart2 204J") == ("AmericasMart", "Mart2 204J", "b2-rooms", ["204J"], "exact")
    assert vs.place("Mart2 204J", V).string == "204J"


# ---------------------------------------------------------------------------
# The grammar
# ---------------------------------------------------------------------------

def test_each_combined_rule_on_its_own():
    assert vs.numeric_run("209-211") == ["209", "210", "211"]
    assert vs.numeric_run("A601-A602") == ["A601", "A602"] and vs.numeric_run("M302-M303") == ["M302", "M303"]
    assert vs.numeric_run("09-11") == ["09", "10", "11"]
    assert vs.numeric_run("201-221") == [str(n) for n in range(201, 222)]            # a span of 20, the longest
    for no in ("211-209", "1-40", "A601-B602", "209-2110", "201-222"):
        assert vs.numeric_run(no) is None, no
    assert vs.roman_run("Regency VI-VII") == ["Regency VI", "Regency VII"] and vs.roman_run("Regency VII-VI") is None
    assert vs.letter_run("Chastain H-I-J") == ["Chastain H", "Chastain I", "Chastain J"]
    assert vs.letter_run("Hanover E-C") is None and vs.letter_run("Hanover C-E-D") is None
    assert vs.number_run("Galleria 2-3") == ["Galleria 2", "Galleria 3"]
    assert vs.number_run("Galleria 2-3 Hallway Just outside Galleria 2-3") is None    # a sentence, not a name
    assert vs.letters_together("Embassy AB") == ["Embassy A", "Embassy B"] and vs.letters_together("Embassy BA") is None
    assert vs.number_letters("203BC") == ["203B", "203C"]
    assert vs.number_letters("Hall 203BC") == ["Hall 203B", "Hall 203C"]
    assert vs.slash_list("Savannah Ballroom B/C") == ["Savannah Ballroom B", "Savannah Ballroom C"]
    assert vs.slash_list("203D Black Phoenix Alchemy Lab - booth 1417/1419") is None
    assert vs.word_pair("International North-South") == ["International North", "International South"]
    assert at("Hyatt Embassy BA")[2:] == (None, [], "hotel")                          # out of order: no reading


@pytest.mark.parametrize("location, level_, rooms_, rule", [
    ("Hilton 212-214", "l2", ["212", "213", "214"], "numeric run"),
    ("Marriott L401-L403", "lobby", ["L401", "L402", "L403"], "numeric run"),
    ("Hyatt Centennial I-III", "ballroom", ["Centennial I", "Centennial II", "Centennial III"], "roman run"),
    ("Hyatt Hanover C-E", "exhibit", ["Hanover C", "Hanover D", "Hanover E"], "letter run"),
    ("Hilton Galleria 2-3", "galleria", ["Galleria 2", "Galleria 3"], "number run"),
    ("Hyatt Embassy AB", "tower-ll2", ["Embassy A", "Embassy B"], "letters together"),
    ("Mart2 203BC", "b2-rooms", ["203B", "203C"], "number and letters"),
    ("Westin Peachtree Ballroom B/C", "f8", ["Peachtree Ballroom B", "Peachtree Ballroom C"], "slash list"),
    ("Hyatt International North-South", "tower-ll1", ["International North", "International South"], "word pair"),
], ids=lambda x: x if isinstance(x, str) and " " in x else None)
def test_each_combined_rule_reads_rooms_that_are_all_on_one_level(location, level_, rooms_, rule):
    p = vs.place(location, V)
    assert (p.level, list(p.rooms), p.place, p.rules) == (level_, rooms_, "rule", (rule,))


@pytest.mark.parametrize("location, place_, level_, rule", [
    # a room missing: the rule fails, and the rooms it did find give their level
    ("Hilton Galleria 8-9", "level", "galleria", ("number run",)),
    ("Hyatt Hanover F-H", "level", "exhibit", ("letter run",)),
    ("Hyatt Embassy BC", "level", "tower-ll2", ("letters together",)),
    ("Westin Peachtree Ballroom C/D", "level", "f8", ("slash list",)),
    ("Mart2 203DE", "level", "b2-rooms", ("number and letters",)),
    ("Hyatt Centennial IV-VI", "level", "ballroom", ("roman run",)),
    # every room missing: nothing
    ("Marriott M103-M105", "hotel", None, ()),
    ("Hyatt International East-West", "hotel", None, ()),
    # every room there, but on two levels: nothing, and no level
    ("Hilton 213-216", "hotel", None, ()),
    ("Hyatt Regency V-VII", "hotel", None, ()),
], ids=lambda x: x if isinstance(x, str) and " " in x else None)
def test_a_rule_fails_when_a_room_is_missing_or_its_rooms_span_two_levels(location, place_, level_, rule):
    p = vs.place(location, V)
    assert (p.place, p.level, list(p.rooms), p.rules) == (place_, level_, [], rule)


def test_an_alias_beats_an_exact_room_and_an_exact_room_beats_a_rule():
    assert at("Hyatt Inman") == ("Hyatt", "Inman", "acc", ["Piedmont"], "alias")               # an alias, not the room
    assert at("Hyatt Conference  PIEDMONT") == ("Hyatt", "Conference  PIEDMONT", "acc", ["Piedmont"], "alias")  # folded
    assert at("Hyatt Centennial II-IV") == ("Hyatt", "Centennial II-IV", "ballroom", ["Centennial II"], "alias")
    assert at("Hyatt Hanover AB")[3:] == (["Hanover AB"], "exact")                             # not letters together
    assert rules("Hyatt Inman") == rules("Hyatt Hanover AB") == ()
    assert at("Hilton galleria 5")[2:] == ("galleria", ["Galleria 5"], "exact")                # case-folded


def test_the_mart_rules():
    assert at("Mart Building 3, Floor 2") == ("AmericasMart", "Mart Building 3, Floor 2", "b3f2", [], "level")
    assert rules("Mart Building 3, Floor 2") == ("mart building",)
    assert at("Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300") == (
        "AmericasMart", "Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300", "b2-vendor-f1", [], "level")
    assert rules("Mart2 Vendor Hall Floor 1 The Missing Volume booth 1300") == ("mart vendor hall",)
    assert at("Mart2 203D ArtCarp - booth # 1718")[2:] == ("b2-rooms", ["203D"], "rule")
    assert rules("Mart2 203D ArtCarp - booth # 1718") == ("mart room",)
    for nowhere in ("Mart Building 4, Floor 1", "Mart2 Vendor Hall Floor 2 Booth 7", "Mart2 205Q booth 9"):
        assert at(nowhere)[2:] == (None, [], "hotel"), nowhere                   # no such level, no such room


def test_a_floor_alone_reads_the_level_named_for_it():
    assert at("Westin 14th Floor")[2:] == ("f14", [], "level") and rules("Westin 14th Floor") == ("floor only",)
    assert at("Westin Floor 12")[2:] == ("f12", [], "level")
    assert at("Hilton 3rd")[2:] == ("l3", [], "level")                           # "Level 3" is named for it too
    assert at("Hilton 5th")[2:] == (None, [], "hotel")                           # no level of the file is


def test_partitions_name_a_level_s_lettered_or_numbered_rooms_and_nothing_else():
    assert at("Marriott Atrium Ballroom")[2:] == ("atrium", [f"Atrium Ballroom {x}" for x in "ABCD"], "rule")
    assert rules("Marriott Atrium Ballroom") == ("partitions",)
    assert at("Marriott Imperial Ballroom")[3] == ["Imperial Ballroom A", "Imperial Ballroom B"]
    assert at("Hilton Galleria")[3] == [f"Galleria {n}" for n in range(1, 9)]
    assert at("Hyatt Centennial")[3] == ["Centennial I", "Centennial II", "Centennial III", "Centennial IV"]
    assert at("Hyatt Hanover")[3] == HANOVER                                     # not Hanover AB: two letters
    assert vs.partitions("Salon", VENUES["hotels"][2]["levels"]) is None         # East and West are words
    assert vs.partitions("Marquis", VENUES["hotels"][0]["levels"]) is None       # "Ballroom A" is two words
    assert vs.partitions("Peachtree", VENUES["hotels"][4]["levels"]) is None     # two levels have two each
    assert vs.partitions("Piedmont", VENUES["hotels"][1]["levels"]) is None      # a room, not a prefix
    assert vs.partitions("Crystal", [level("l1", "Level 1", 0, ["Crystal A", "Crystal Ballroom"])]) is None  # one
    for unread in ("Hilton Salon", "Marriott Marquis", "Westin Peachtree"):
        assert at(unread)[2:] == (None, [], "hotel"), unread


def test_the_rewrites_read_the_string_again():
    assert at("Hyatt Hanover C-E Hanover C-E")[3:] == (["Hanover C", "Hanover D", "Hanover E"], "rule")
    assert rules("Hyatt Hanover C-E Hanover C-E") == ("doubled", "letter run")
    assert at("Hyatt The Learning Center")[2:] == ("ballroom", ["Learning Center"], "rule")
    assert rules("Hyatt The Learning Center") == ("leading The",)
    # the hotel's own initials and a hyphen: the Hyatt's H, the Courtland Grand's CG - and the Hilton's H
    assert at("Hyatt H-Piedmont")[2:] == ("acc", ["Piedmont"], "rule")
    assert rules("Hyatt H-Piedmont") == ("hotel initials",)
    assert at("Courtland Grand CG-Athens")[2:] == ("unknown", ["Athens"], "rule")
    assert at("Hilton H-Salon East")[2:] == ("l2", ["Salon East"], "rule")
    assert at("Courtland Grand CG-Grand Ballroom A-F")[2:] == (None, [], "hotel")   # read again, and still no rooms
    # a rewrite's string whose rule finds some of its rooms gives their level, once every rule has failed
    assert at("Hyatt The Hanover F-H")[2:] == ("exhibit", [], "level")
    assert rules("Hyatt The Hanover F-H") == ("leading The", "letter run")
    for other in ("Westin H-1201", "Hyatt HY-Piedmont", "Hyatt X-Piedmont"):     # nothing else strips
        assert at(other)[2:] == (None, [], "hotel"), other
    assert vs.initials("Courtland Grand") == "CG" and vs.hotel_initials("CG-Athens", "Courtland Grand") == "Athens"


def test_the_level_of_found_rooms_is_the_first_failed_rule_s():
    data = {"hotels": [hotel("Odd", 0, ["Odd"], [level("one", "One", 0, ["The Hanover F", "Regency VI"]),
                                                 level("two", "Two", 1, ["Hanover F", "Regency W"])]),
                       hotel("Other", 1, ["Other"], placeless=True), hotel("Unknown", 2, [], placeless=True)]}
    odd = vs.Resolver(data)
    # "Regency V-X": the roman run finds Regency VI on one level, then the letter run Regency W on the other
    p = odd.place("Odd Regency V-X")
    assert (p.place, p.level, p.rules) == ("level", "one", ("roman run",))
    # "The Hanover F-H": the letter run finds "The Hanover F" on one level; read again without "The", it finds
    # "Hanover F" on the other
    p = odd.place("Odd The Hanover F-H")
    assert (p.place, p.level, p.rules) == ("level", "one", ("letter run",))


def test_a_trailing_note_reads_the_longest_leading_room():
    assert at("Hyatt Grand Hall D Poole Booth 111 for more info!!")[2:] == ("exhibit", ["Grand Hall D"], "rule")
    assert rules("Hyatt Grand Hall D Poole Booth 111 for more info!!") == ("trailing note",)
    assert at("Hyatt Grand Hall Main Floor")[3] == ["Grand Hall"]
    assert at("Hilton 212-214 Hilton, 3rd floor outdoor deck")[2:] == (None, [], "hotel")  # a room's head, not a rule's
    assert vs.trailing_note("A B C") == ["A B", "A"]


# ---------------------------------------------------------------------------
# Placeless hotels, the re-split, and an unplaced room
# ---------------------------------------------------------------------------

def test_placeless_hotels_read_none_and_their_room_string_is_split_again_once():
    assert at("Streaming STRM_FBL") == ("Streaming", "STRM_FBL", None, [], "none")
    assert at("O Joystick Gamebar") == ("Other", "Joystick Gamebar", None, [], "none")
    assert at("") == ("Unknown", "", None, [], "none")
    # less a repeat of its own key, the string is split against the placed hotels' keys, and read there
    assert at("O Other Marriott, Imperial Ballroom") == (
        "Marriott", "Imperial Ballroom", "marquis", ["Imperial Ballroom A", "Imperial Ballroom B"], "rule")
    assert rules("O Other Marriott, Imperial Ballroom") == ("re-split", "partitions")
    assert at("Other Hilton 212") == ("Hilton", "212", "l2", ["212"], "rule")
    assert rules("Other Hilton 212") == ("re-split",)
    assert at("O Other Hyatt Lobby") == ("Hyatt", "Lobby", None, [], "hotel")
    assert rules("O Other Hyatt Lobby") == ("re-split",)
    assert at("O Mart2 203A") == ("AmericasMart", "Mart2 203A", "b2-rooms", ["203A"], "rule")
    # a string no key begins is not split again: every key was tried
    assert at("Walton Spring Park") == ("Other", "Walton Spring Park", None, [], "none")
    assert vs.place("Walton Spring Park", V).key is None and vs.place("O Parade", V).key == "O"


def test_an_unplaced_room_reads_hotel_the_file_knowing_it_but_not_where_it_is():
    p = vs.place("Hilton Steps B", V)
    assert (p.hotel, p.room, p.level, list(p.rooms), p.place, p.why) == (
        "Hilton", "Steps B", None, [], "hotel", "unplaced")


# ---------------------------------------------------------------------------
# The stage and its report
# ---------------------------------------------------------------------------

LOCATIONS = (["Hilton 212-214"] * 3 + ["Hilton Steps B"] * 4 + ["Hilton Steps A"] * 5 + ["Hyatt"] * 2
             + ["Hyatt Inman", "Hyatt H-Piedmont", "Mart Building 3, Floor 2", "Mart Building 3, Floor 2",
                "Westin 14th Floor", "Westin Augusta 1-2", "Walton Spring Park", "Walton Spring Park",
                "Peachtree Plaza", "O Other Marriott, Imperial Ballroom", "Streaming STRM_FBL", "", "Hilton Salon",
                "O Joystick Gamebar"])


def rows():
    return [{"source_id": f"{k:02d}", "title": f"Event {k}", "location": loc} for k, loc in enumerate(LOCATIONS)]


def test_the_report_counts_by_place_and_hotel_and_lists_the_worklist():
    r = vs.resolve(rows(), V).report
    assert r.places == {"exact": 0, "alias": 1, "rule": 5, "level": 3, "hotel": 13, "none": 6}
    assert r.hotels == {"Marriott": {"exact": 0, "alias": 0, "rule": 1, "level": 0, "hotel": 0, "none": 0},
                        "Hyatt": {"exact": 0, "alias": 1, "rule": 1, "level": 0, "hotel": 2, "none": 0},
                        "Hilton": {"exact": 0, "alias": 0, "rule": 3, "level": 0, "hotel": 10, "none": 0},
                        "Westin": {"exact": 0, "alias": 0, "rule": 0, "level": 1, "hotel": 1, "none": 0},
                        "AmericasMart": {"exact": 0, "alias": 0, "rule": 0, "level": 2, "hotel": 0, "none": 0},
                        "Streaming": {"exact": 0, "alias": 0, "rule": 0, "level": 0, "hotel": 0, "none": 1},
                        "Other": {"exact": 0, "alias": 0, "rule": 0, "level": 0, "hotel": 0, "none": 4},
                        "Unknown": {"exact": 0, "alias": 0, "rule": 0, "level": 0, "hotel": 0, "none": 1}}
    assert r.unresolved == [{"hotel": "Hilton", "string": "Steps A", "events": 5, "why": "no reading"},
                            {"hotel": "Hyatt", "string": "", "events": 2, "why": "hotel only"},
                            {"hotel": "Hilton", "string": "Salon", "events": 1, "why": "no reading"},
                            {"hotel": "Westin", "string": "Augusta 1-2", "events": 1, "why": "no reading"}]
    assert r.unplaced == [{"hotel": "Hilton", "string": "Steps B", "events": 4}]
    # a location no key begins; "O Joystick Gamebar" is Other by its key, and not unknown
    assert r.unknown == [{"string": "Walton Spring Park", "events": 2}, {"string": "Peachtree Plaza", "events": 1}]
    assert r.resplit == [{"location": "O Other Marriott, Imperial Ballroom", "hotel": "Marriott",
                          "string": "Imperial Ballroom", "events": 1}]
    assert r.aliases == [{"hotel": "Hyatt", "string": "Inman", "events": 1, "rooms": ["Piedmont"]}]
    assert r.rules == {"re-split": {"strings": 1, "events": 1}, "mart building": {"strings": 1, "events": 2},
                       "numeric run": {"strings": 1, "events": 3}, "hotel initials": {"strings": 1, "events": 1},
                       "partitions": {"strings": 1, "events": 1}, "hotel only": {"strings": 1, "events": 2},
                       "floor only": {"strings": 1, "events": 1}}
    # the run summary's venue counters: an unplaced room is not unresolved, and a level is placed by design
    assert (r.rooms_unresolved, r.hotels_unknown) == (9, 3)


def test_resolve_adds_the_five_fields_and_changes_nothing_it_is_given():
    given, v_before = rows(), copy.deepcopy(VENUES)
    frozen = [{"id": "a1", "location": "Courtland Grand Athens", "hotel": "Courtland Grand", "room": "Grand Athens"}]
    before = copy.deepcopy((given, frozen))
    out = vs.resolve(given + frozen, V).rows
    assert (given, frozen) == before and VENUES == v_before
    assert list(out[0]) == ["source_id", "title", "location", "hotel", "room", "level", "rooms", "place"]
    assert out[0] == {**given[0], "hotel": "Hilton", "room": "212-214", "level": "l2", "rooms": ["212", "213", "214"],
                      "place": "rule"}
    # a frozen year's own hotel and room are replaced: the split is the stage's
    assert out[-1] == {"id": "a1", "location": "Courtland Grand Athens", "hotel": "Courtland Grand", "room": "Athens",
                       "level": "unknown", "rooms": ["Athens"], "place": "exact"}
    assert [r["location"] for r in out] == LOCATIONS + ["Courtland Grand Athens"]
    assert vs.resolve(list(reversed(given)), V).rows == list(reversed(out[:-1]))


def test_the_split_falls_back_to_other_and_unknown_and_needs_them():
    for missing in ("Other", "Unknown"):
        data = {**VENUES, "hotels": [h for h in VENUES["hotels"] if h["hotel"] != missing]}
        with pytest.raises(ValueError, match=f"no {missing} hotel"):
            vs.Resolver(data)
