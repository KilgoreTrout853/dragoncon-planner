"""Tests for tools/room_census.py: the exact match, an alias, each combined-string rule and each other shape on the
strings that showed them, the chains they make, and a render of a small schedule and venues file under two hash
seeds - all on inline fixtures. Nothing here reads data/ or docs/venues/.

Run:  python -m pytest tests/
"""
import importlib.util
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import venues as venues_file  # noqa: E402
from scraper import split_hotel  # noqa: E402

TOOL = os.path.join(ROOT, "tools", "room_census.py")
spec = importlib.util.spec_from_file_location("room_census", TOOL)
rc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rc)


def level(lid, name, order, rooms, notes=(), aliases=None):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": aliases or {},
            "notes": list(notes)}


def hotel(name, order, levels, keys, unplaced=None, placeless=False):
    return {"hotel": name, "name": name, "keys": keys, "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": "rest", "levels": levels, "unplaced": unplaced or {}}


# Other is left out on purpose: a hotel of the schedule the venues file lacks.
VENUES = {"walk": {}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10, "hotels": [
    hotel("Hilton", 0, [level("galleria", "Galleria", 0, ["Galleria 2", "Galleria 3", "Galleria 5"]),
                        level("l1", "Level 1", 1, ["Crystal A", "Crystal B"]),
                        level("l2", "Level 2", 2, ["209", "210", "211", "Salon East", "Salon West"])],
          ["Hilton"], unplaced={"Steps B": "a Dragon Con name; level unknown"}),
    hotel("Hyatt", 1, [level("ballroom", "Ballroom Level", 0, ["Regency VI", "Regency VII", "Learning Center"]),
                       level("acc", "Conference Center", 1, ["Piedmont"],
                             aliases={"conference piedmont": ["Piedmont"]})], ["Hyatt"]),
    hotel("Westin", 2, [level("f7", "Seventh Floor", 0, ["Augusta I", "Augusta II", "Augusta III"]),
                        level("f14", "Fourteenth Floor", 1, ["1401"]),
                        level("chastain", "Chastain", 2, ["Chastain 1"], notes=["Chastain A … J (confirm)"])],
          ["Westin"]),
    hotel("Courtland Grand", 3, [level("unknown", "levels unknown", 0, ["Athens"], notes=["(55 rooms; list unknown)"])],
          ["Courtland Grand", "Courtland"]),
    hotel("AmericasMart", 4, [level("unknown", "floors unknown", 0, [])], ["AmericasMart", "Mart2", "Mart"]),
    hotel("Hardy Ivy Park", 5, [], ["Hardy"]),
    hotel("Streaming", 6, [], ["Streaming"], placeless=True),
]}
V = venues_file.check(VENUES)

LOCATIONS = ["Hilton Galleria 5", "Hilton Galleria 5", "Hilton 209-211", "Hilton galleria 2-3", "Hilton-Salon",
             "Hilton Crystal Ballroom Crystal Ballroom", "Hilton Steps B", "Hilton Steps A", "Hilton 5th",
             "Hyatt Regency VI-VII", "Hyatt H-Piedmont", "Hyatt The Learning Center", "Hyatt", "Hyatt Concourse",
             "Hyatt-Grand Hall D", "Hyatt Conference  Piedmont", "Westin Augusta 1-2", "Westin Augusta 3",
             "Westin 14th Floor", "Westin Chastain H-I-J", "Courtland Grand Athens",
             "Courtland Grand CG-Grand Ballroom A-F", "Mart Building 3, Floor 2", "Mart2 Vendor Hall booth 1300",
             "Mart2 Vendor Hall Booth 1300", "Hardy Ivy Structure", "Streaming STRM_FBL", "O Joystick Gamebar"]


def schedule():
    events = []
    for k, loc in enumerate(LOCATIONS):
        hotel_name, room = split_hotel(loc)
        events.append({"id": f"{k:032x}", "title": f"Event {k}", "start": "2026-09-04T10:00", "location": loc,
                       "hotel": hotel_name, "room": room})
    events[1]["room"] = "Galleria  5"  # stored unlike split_hotel's answer: the census counts it
    events[15]["room"] = "Conference  Piedmont"  # an alias is read folded: case and spacing
    return {"generated_at": "2026-09-07T12:50:19+00:00", "count": len(events), "events": events}


def rooms(h):
    return rc.venue_rooms(V.hotels())[h]


def levels(h):
    return rc.levels_of(V.hotels())[h]


def notes(h):
    return rc.notes_of(V.hotels())[h]


def aliases(h):
    return rc.aliases_of(V.hotels())[h]


def read(s, h):
    return rc.resolve(s, h, rooms(h), levels(h), aliases(h))


def test_the_venues_file_is_read_case_folded_with_unplaced_rooms_on_a_level_of_their_own():
    hilton = rooms("Hilton")
    assert hilton["galleria 5"] == ("galleria", "Galleria", "Galleria 5")
    assert hilton["steps b"] == ("unplaced", "unplaced", "Steps B")
    assert aliases("Hyatt") == {"conference piedmont": ("acc", "Conference Center", ["Piedmont"])}
    assert rc.note_naming("J", notes("Westin")) == "Chastain A … J (confirm)"
    assert rc.note_naming("Chastain 1", notes("Westin")) is None  # a room, not a note
    assert notes("Hilton") == [] and rc.note_naming("202", notes("Hilton")) is None


def test_each_combined_string_rule_reads_the_strings_that_showed_it():
    assert rc.numeric_run("209-211") == ["209", "210", "211"]
    assert rc.numeric_run("A601-A602") == ["A601", "A602"] and rc.numeric_run("M302-M303") == ["M302", "M303"]
    assert rc.numeric_run("09-11") == ["09", "10", "11"]
    for no in ("211-209", "1-40", "A601-B602", "209-2110"):
        assert rc.numeric_run(no) is None, no
    assert rc.roman_run("Regency VI-VII") == ["Regency VI", "Regency VII"]
    assert rc.roman_run("Centennial II-IV") == ["Centennial II", "Centennial III", "Centennial IV"]
    assert rc.roman_run("Regency VII-VI") is None
    assert rc.letter_run("Hanover C-E") == ["Hanover C", "Hanover D", "Hanover E"]
    assert rc.letter_run("Chastain H-I-J") == ["Chastain H", "Chastain I", "Chastain J"]
    assert rc.letter_run("Hanover E-C") is None
    assert rc.number_run("Galleria 2-3") == ["Galleria 2", "Galleria 3"]
    assert rc.number_run("Galleria 2-3 Hallway Just outside Galleria 2-3") is None  # a sentence, not a name
    assert rc.letters_together("Embassy AB") == ["Embassy A", "Embassy B"] and rc.letters_together("Embassy BA") is None
    assert rc.number_letters("Mart2 203BC") == ["Mart2 203B", "Mart2 203C"]
    assert rc.slash_list("Savannah Ballroom B/C") == ["Savannah Ballroom B", "Savannah Ballroom C"]
    assert rc.slash_list("Mart2 203D Black Phoenix Alchemy Lab - booth 1417/1419") is None
    assert rc.word_pair("International North-South") == ["International North", "International South"]


def test_each_other_shape_reads_the_strings_that_showed_it():
    assert rc.courtland_prefix("Grand Athens", "Courtland Grand") == "Athens"
    assert rc.courtland_prefix("Grand Hall C", "Hyatt") is None
    assert rc.doubled("Crystal Ballroom Crystal Ballroom", "Hilton") == "Crystal Ballroom"
    assert rc.doubled("Crystal Ballroom", "Hilton") is None
    assert rc.hotel_prefix("Hilton-Salon", "Hilton") == "Salon" and rc.hotel_prefix("H-Piedmont", "Hyatt") == "Piedmont"
    assert rc.hotel_prefix("CG-Grand Ballroom A-F", "Courtland Grand") == "Grand Ballroom A-F"
    assert rc.hotel_prefix("M-Piedmont", "Hyatt") is None
    assert rc.leading_the("The Learning Center", "Hyatt") == "Learning Center"
    assert rc.partitions("Salon", rooms("Hilton")) == ["Salon East", "Salon West"]
    assert rc.partitions("Crystal Ballroom", rooms("Hilton")) is None  # the file says Crystal A, not ... Ballroom A
    assert rc.partitions("Galleria 5", rooms("Hilton")) is None
    assert rc.partitions("Chastain", rooms("Westin")) is None  # one room; the note is no room
    assert rc.floor_only("14th Floor", levels("Westin")) == (14, "f14")
    assert rc.floor_only("5th", levels("Hilton")) == (5, None)
    assert rc.floor_only("Level 5", levels("Hilton")) is None
    assert rc.trailing_note("Grand Hall D Poole Booth 111 for more info!!", {"grand hall d": ("x", "X", "Grand Hall D")}) \
        == (["trailing note"], ["Grand Hall D"])
    assert rc.trailing_note("212-214 Hilton, 3rd floor outdoor deck", {}) == (["trailing note", "numeric run"],
                                                                             ["212", "213", "214"])
    assert rc.numeral_swap("Augusta 3") == "Augusta III" and rc.numeral_swap("Chastain I") is None


def test_a_reading_is_a_chain_of_rules_and_its_kind_says_which():
    ch = lambda s, h: (read(s, h)["chain"], read(s, h)["parts"])
    assert ch("galleria 5", "Hilton") == ([], ["galleria 5"])
    assert ch("Grand CG-Grand Ballroom A-F", "Courtland Grand") == (
        ["Courtland prefix", "hotel prefix", "letter run"], [f"Grand Ballroom {x}" for x in "ABCDEF"])
    assert ch("Hilton-Salon", "Hilton") == (["hotel prefix", "partitions"], ["Salon East", "Salon West"])
    assert ch("Augusta 1-2", "Westin") == (["number run", "numeral style"], ["Augusta I", "Augusta II"])
    assert ch("Augusta 3", "Westin") == (["numeral style"], ["Augusta III"])
    assert ch("Chastain H-I-J", "Westin") == (["letter run"], ["Chastain H", "Chastain I", "Chastain J"])
    assert ch("Galleria 2-3 Hallway Just outside Galleria 2-3", "Hilton") == (
        ["trailing note", "number run"], ["Galleria 2", "Galleria 3"])
    assert read("Hyatt", "Hyatt")["hotel_only"] and read("Hyatt", "Hyatt")["chain"] == ["hotel only"]
    assert (read("14th Floor", "Westin")["floor"], read("14th Floor", "Westin")["level"]) == (14, "f14")
    assert ch("Concourse", "Hyatt") == ([], ["Concourse"])
    # an alias is read folded and before any rule, and names its level's rooms; a room string is never an alias
    assert ch("Conference  PIEDMONT", "Hyatt") == (["alias"], ["Piedmont"])
    assert ch("Piedmont", "Hyatt") == ([], ["Piedmont"])
    assert rc.kind(read("galleria 5", "Hilton"), rooms("Hilton")["galleria 5"]) == "exact"
    assert rc.kind(read("Conference Piedmont", "Hyatt"), None) == "alias"
    assert rc.kind(read("209-211", "Hilton"), None) == "combined"
    assert rc.kind(read("Augusta 1-2", "Westin"), None) == "shape"
    assert rc.kind(read("Concourse", "Hyatt"), None) == "none"


def test_the_report_holds_the_facts_of_a_small_schedule():
    text = rc.render(schedule(), V)
    assert "1. Events: 28, at 8 hotel values; distinct (hotel, room) strings: 28." in text
    assert "Through an alias: 1 string, 1 events (3.6%)." in text
    assert "`split_hotel(location)` gives the stored hotel and room for 26 of 28 events." in text
    assert ("Hotels in the schedule and not in the venues file: Other (1 event). In the venues file with no rooms: "
            "AmericasMart (3 events), Hardy Ivy Park (1 event), Streaming (1 event). `Unknown`: 0 events.") in text
    # a venues file that holds Unknown lists it with the other hotels that have no rooms, and names it once
    held = venues_file.check({**VENUES, "hotels": VENUES["hotels"] + [hotel("Unknown", 7, [], [], placeless=True)]})
    item = next(line for line in rc.render(schedule(), held).splitlines() if line.startswith("5. "))
    assert item.endswith("Streaming (1 event), Unknown (0 events).") and item.count("Unknown") == 1
    # exact 0, alias 1 (Conference Piedmont), combined 1 (Regency VI-VII), shape 3 (H-Piedmont, The Learning
    # Center, Hyatt), none 2 (Concourse, and Hall D, all split_hotel left of "Hyatt-Grand Hall D")
    assert "| Hyatt | yes | 2 | 4 | 7 | 7 | 0 | 1 | 1 | 3 | 2 |" in text
    assert "| `Conference  Piedmont` | 1 | - | alias → `Piedmont` | 1 of 1: Conference Center (`acc`) |" in text
    assert "- Hilton: `Galleria  5` (1), `Galleria 5` (1)" in text  # the dedupe's norm_text makes them one room
    assert "| `Steps B` | 1 | unplaced | - | - |" in text
    assert "| `Hilton-Salon` | 1 | - | hotel prefix + partitions → `Salon East`, `Salon West` | 2 of 2: Level 2 (`l2`) |" \
        in text
    assert "| `Chastain H-I-J` | 1 | - | letter run → `Chastain H`, `Chastain I`, `Chastain J` | 0 of 3; `Chastain I`, " \
           "`Chastain J` are named in the note `Chastain A … J (confirm)` |" not in text  # only whole words: J alone
    assert "`split_hotel('Courtland Grand Athens')` is `('Courtland Grand', 'Grand Athens')`." in text
    assert "- `Hyatt-Grand Hall D` (1): `('Hyatt', 'Hall D')`" in text
    assert "### Hyatt - Conference Center (`acc`)\n\n- By an exact match: none.\n- Through an alias: " \
           "`Conference  Piedmont` (1).\n- By a proposal, UNSURE: `H-Piedmont` (1).\n" in text
    assert "### Hilton - Level 1 (`l1`)" not in text  # nothing reaches it: no seen_2026 to show it for
    assert "- Westin, Chastain (`chastain`): `Chastain A … J (confirm)`" in text
    assert "In the venues file with no rooms: its levels list none." in text      # AmericasMart
    assert "Not in the venues file." in text                                        # Other
    assert "- Hotels of the venues file with no events: none." in text
    assert "- AmericasMart: `Mart2 Vendor Hall Booth 1300` (1), `Mart2 Vendor Hall booth 1300` (1)" in text
    assert "seen_2026" not in text and "registry" not in text
    assert text.endswith("\n") and "\r" not in text and "\n\n\n" not in text


def test_two_runs_under_different_hash_seeds_write_the_same_bytes_and_leave_the_inputs_alone(tmp_path):
    """Set order follows the process's hash seed; nothing in the report may. The census writes only its report."""
    events, venues = tmp_path / "events.json", tmp_path / "venues.json"
    events.write_text(json.dumps(schedule(), ensure_ascii=False), encoding="utf-8")
    venues.write_text(json.dumps(VENUES, ensure_ascii=False), encoding="utf-8")
    before = (events.read_bytes(), venues.read_bytes())
    written = []
    for seed in ("1", "2"):
        out = tmp_path / f"census-{seed}.md"
        subprocess.run([sys.executable, TOOL, "--events", str(events), "--venues", str(venues), "--out", str(out)],
                       cwd=ROOT, check=True, capture_output=True, env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(out.read_bytes())
    assert written[0] == written[1] and b"\r" not in written[0]
    assert written[0].decode("utf-8") == rc.render(schedule(), V, "events.json", "venues.json")
    assert (events.read_bytes(), venues.read_bytes()) == before
