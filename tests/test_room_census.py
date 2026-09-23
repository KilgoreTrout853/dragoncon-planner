"""Tests for tools/room_census.py, the venues stage's coverage report: the facts it renders of a small schedule - the
headline and its counters, the hotels by place, the rules' firings, a hotel's strings, the worklist with its
candidate key, the rooms no string reaches - that it keeps no grammar of its own, and a render under two hash seeds
that leaves both inputs as they were. All on inline fixtures; nothing here reads data/ or docs/venues/.

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

TOOL = os.path.join(ROOT, "tools", "room_census.py")
spec = importlib.util.spec_from_file_location("room_census", TOOL)
rc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rc)


def level(lid, name, order, rooms, notes=(), aliases=None):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": aliases or {},
            "notes": list(notes)}


def hotel(name, order, levels, keys, unplaced=None, placeless=False, display="rest", full=None):
    return {"hotel": name, "name": full or name, "keys": keys, "short": name, "group": name, "var": name,
            "order": order, "placeless": placeless, "display": display, "levels": levels, "unplaced": unplaced or {}}


VENUES = {"walk": {}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10, "hotels": [
    hotel("Hilton", 0, [level("galleria", "Galleria", 0, ["Galleria 2", "Galleria 3", "Galleria 5"]),
                        level("l2", "Level 2", 1, ["209", "210", "211", "Salon East", "Salon West"],
                              notes=["Salon East and West are the Salon's halves"])],
          ["Hilton"], unplaced={"Steps B": "a Dragon Con name; level unknown"}),
    hotel("Hyatt", 1, [level("ballroom", "Ballroom Level", 0, ["Regency VI", "Regency VII", "Learning Center"]),
                       level("acc", "Conference Center", 1, ["Piedmont"],
                             aliases={"conference piedmont": ["Piedmont"]})],
          ["Hyatt"]),
    hotel("Westin", 2, [level("f7", "Seventh Floor", 0, ["Augusta I", "Augusta II", "Augusta III"]),
                        level("f14", "Fourteenth Floor", 1, ["1401"])], ["Westin"], full="The Westin Peachtree Plaza"),
    hotel("Courtland Grand", 3, [level("unknown", "levels unknown", 0, ["Athens"])], ["Courtland Grand", "Courtland"]),
    hotel("AmericasMart", 4, [level("b3f2", "Building 3, Floor 2", 0, []),
                              level("b2-rooms", "Building 2, meeting rooms", 1, ["203A"])],
          ["AmericasMart", "Mart2", "Mart"], display="location"),
    hotel("Hardy Ivy Park", 5, [], ["Hardy"]),
    hotel("Streaming", 6, [], ["Streaming"], placeless=True),
    hotel("Other", 7, [], ["O", "Other"], placeless=True),
    hotel("Unknown", 8, [], [], placeless=True),
]}
V = venues_file.check(VENUES)

LOCATIONS = ["Hilton Galleria 5", "Hilton Galleria 5", "Hilton 209-211", "Hilton-Salon", "Hilton Steps B",
             "Hilton Steps B", "Hilton Steps A", "Hilton 5th", "Hyatt Regency VI-VII", "Hyatt H-Piedmont",
             "Hyatt The Learning Center", "Hyatt", "Hyatt Concourse", "Hyatt Conference  Piedmont",
             "Westin Augusta 1-2", "Westin 14th Floor", "Courtland Grand Athens", "Mart Building 3, Floor 2",
             "Mart2 203A", "Hardy Ivy Structure", "Streaming STRM_FBL", "O Joystick Gamebar", "O Other Hilton 210",
             "Peachtree Plaza", "Walton Spring Park"]


def schedule():
    events = [{"id": f"{k:032x}", "title": f"Event {k}", "start": "2026-09-04T10:00", "location": loc}
              for k, loc in enumerate(LOCATIONS)]
    return {"generated_at": "2026-09-07T12:50:19+00:00", "count": len(events), "events": events}


def test_the_report_holds_the_facts_of_a_small_schedule():
    text = rc.render(schedule(), V)
    assert text.startswith("# Room census - the 2026 schedule read by the venues stage\n")
    assert "1. Events: 25, at 8 hotels; distinct readings of a room string: 23." in text
    assert ("2. By place: `exact` 4 (16.0%), 3 strings; `alias` 1 (4.0%), 1 string; `rule` 5 (20.0%), 5 strings; "
            "`level` 2 (8.0%), 2 strings; `hotel` 9 (36.0%), 8 strings; `none` 4 (16.0%), 4 strings.") in text
    assert ("3. The run's venue counters on this schedule: rooms unresolved 7 - the strings read at the hotel alone "
            "(section 4); hotels unknown 2 - the locations no key begins. Not counted: 2 events at an unplaced room "
            "of the venues file, read at its hotel, and the 2 events placed at a level, by design.") in text
    assert "4. Split again: 1 event of a placeless hotel, read at a placed one (section 4)." in text
    assert "5. Alias hits: 1 event, in 1 string." in text
    # the hotels, as the stage reads them: "O Other Hilton 210" is the Hilton's
    assert "| Hilton | 2 | 8 | 9 | 7 | 2 | 0 | 2 | 0 | 5 | 0 |" in text
    assert "- Hotels of the venues file with no events: Unknown." in text
    # the rules, in the grammar's order
    assert "| re-split | `210` (Hilton) | 1 | 1 |" in text
    assert "| hotel initials | `H-Piedmont` (Hyatt) | 1 | 1 |" in text
    assert "| slash list | - | 0 | 0 |" in text
    # a hotel's strings, with the rules or why
    assert "| `209-211` | 1 | rule | l2 | `209`, `210`, `211` | numeric run |" in text
    assert "| `Steps B` | 2 | hotel | - | - | unplaced |" in text
    assert "| `Salon` | 1 | hotel | - | - | no reading |" in text           # partitions are lettered or numbered
    assert "| `Conference  Piedmont` | 1 | alias | acc | `Piedmont` | - |" in text
    assert "| `Building 3, Floor 2` | 1 | level | b3f2 | - | mart building |" in text
    # the worklist
    assert "### Read at the hotel alone - rooms unresolved, 7" in text
    assert "| Hyatt | (hotel only) | 1 | hotel only |" in text
    assert "| Westin | `Augusta 1-2` | 1 | no reading |" in text           # a numeral style waits for an alias
    assert "| Hilton | `Steps B` | 2 |" in text
    assert "| `Peachtree Plaza` | 1 | a candidate Westin key |" in text
    assert "| `Walton Spring Park` | 1 | - |" in text
    assert "| `O Other Hilton 210` | Hilton | `210` | rule | 1 |" in text
    # the rooms no string reaches, and the notes
    assert "| Hilton | Level 2 (`l2`) | 5 | 3 | `Salon East`, `Salon West` |" in text
    assert "| Westin | Seventh Floor (`f7`) | 3 | 0 | `Augusta I`, `Augusta II`, `Augusta III` |" in text
    assert "- Hilton, Level 2 (`l2`): `Salon East and West are the Salon's halves`" in text
    assert "- Hilton: `Steps B` - a Dragon Con name; level unknown" in text
    assert "split_hotel" not in text and "UNSURE" not in text
    assert text.endswith("\n") and "\r" not in text and "\n\n\n" not in text


def test_the_census_keeps_no_grammar_of_its_own():
    # every reading is the stage's: the tool defines no rule, and imports no scraper
    source = open(TOOL, encoding="utf-8").read()
    for gone in ("def numeric_run", "def partitions", "def resolve", "def trailing_note", "split_hotel", "scraper"):
        assert gone not in source, gone
    assert rc.candidate_key("Peachtree Plaza", V.hotels()) == "Westin"
    assert rc.candidate_key("Peachtree", V.hotels()) == "Westin" and rc.candidate_key("Plaza Hotel", V.hotels()) is None


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
