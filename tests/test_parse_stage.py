"""Tests for parse_stage.py, on inline fixtures built from real lines and titles. Nothing here reads data/.

Every line and title quoted below is one the 2026 schedule actually carries, or the shape the census
found in it; the counts are in docs/discover/parse-2026.md.

Run:  python -m pytest tests/
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import parse_stage as ps  # noqa: E402
import scraper  # noqa: E402


def ev(title, description="", speakers=(), start="2026-09-05T11:30", id="e1"):
    return {"id": id, "type": "panel", "title": title, "day": start[:10], "start": start,
            "description": description, "tracks": ["Main Programming"], "track": "Main Programming",
            "speakers": [dict(s) for s in speakers], "cancelled": False}


def sp(name, role="Speaker"):
    return {"name": name, "role": role}


def line(names):
    return f"Bring your questions for our guests! Additional Panelists: {names}"


# --- the splitter ----------------------------------------------------------

def test_the_line_splits_on_commas_and_reads_a_trailing_role():
    got = ps.split_panelists(line("Alli Martin, Calvin Watts III, Jim Wert(Moderator), Sarah Rose (Moderator)"))
    assert [(p["name"], p["role"]) for p in got] == [
        ("Alli Martin", "Panelist"), ("Calvin Watts III", "Panelist"),
        ("Jim Wert", "Moderator"), ("Sarah Rose", "Moderator")]


def test_a_parenthetical_that_is_not_a_role_stays_in_the_name():
    got = ps.split_panelists(line("Kei (tophat_tiara), Matthew (Wally) Wallace, Amy Bray (501st)"))
    assert [p["name"] for p in got] == ["Kei (tophat_tiara)", "Matthew (Wally) Wallace", "Amy Bray (501st)"]
    assert {p["role"] for p in got} == {"Panelist"}


def test_the_schedules_own_judge_names_read_as_a_name_and_a_role():
    # "Daniel Eisenhauer(Judge)" is how the Speakers section spells him; the line adds the role.
    assert ps.split_panelists(line("Daniel Eisenhauer(Judge)(Moderator), Karen Henson(Judge)")) == [
        {"name": "Daniel Eisenhauer", "role": "Moderator", "raw": "Daniel Eisenhauer(Judge)(Moderator)"},
        {"name": "Karen Henson", "role": "Judge", "raw": "Karen Henson(Judge)"}]


def test_a_second_marker_on_one_line_is_another_separator():
    # One 2026 description says it twice, the second time repeating the first list.
    got = ps.split_panelists("Dragon Con Sober is a casual meetup. Additional Panelists: Carter Alexander "
                             "(Moderator), Eric Holloway (Moderator). Additional Panelists: Carter "
                             "Alexander(Moderator), Eric Holloway(Moderator)")
    assert [p["name"] for p in got] == ["Carter Alexander", "Eric Holloway", "Carter Alexander", "Eric Holloway"]


def test_a_doubled_or_trailing_comma_makes_no_empty_name():
    assert [p["name"] for p in ps.split_panelists(line("Glenn Paris,, Naomi VanDoren,"))] == \
        ["Glenn Paris", "Naomi VanDoren"]


def test_a_suffix_after_a_comma_rejoins_the_name_before_it():
    # No 2026 line does this; "Mark NeCamp, Jr." and "Jotham R Austin, II" are real speaker names.
    got = ps.split_panelists(line("Mark NeCamp, Jr., Jotham R Austin, II, Alli Martin"))
    assert [p["name"] for p in got] == ["Mark NeCamp, Jr.", "Jotham R Austin, II", "Alli Martin"]
    assert ps.person_slug(got[0]["name"]) == "mark-necamp"


def test_a_marker_after_the_list_is_not_a_name():
    # No 2026 line ends in one; "(Mature Audience)" closes 71 descriptions, before the line.
    assert [p["name"] for p in ps.split_panelists(line("Alli Martin, (Mature Audience)"))] == ["Alli Martin"]
    assert [p["name"] for p in ps.split_panelists(line("Alli Martin, (Age 18+)"))] == ["Alli Martin"]


def test_what_the_splitter_leaves_whole_on_purpose():
    # "&" may join two people or name one act, and " - " is an affiliation on one line and a
    # surname on the next. Both are listed UNSURE rather than guessed at.
    whole = ["Ryan & Nicole Cadaver", "Theda Daniels - Race", "Tom Bloom - Black Phoenix Alchemy Lab",
             "Toni from Quiltoni - booth 3230", "Maddy with Cut/Sew"]
    assert [p["name"] for p in ps.split_panelists(line(", ".join(whole)))] == whole


def test_no_line_no_names():
    assert ps.split_panelists("A panel with no line at all.") == []
    assert ps.split_panelists("") == [] and ps.split_panelists(None) == []


# --- the slug --------------------------------------------------------------

def test_person_slug_folds_case_accents_punctuation_and_whitespace():
    assert ps.person_slug("Nathan Fillion") == "nathan-fillion"
    assert ps.person_slug("  NATHAN   FILLION  ") == "nathan-fillion"
    assert ps.person_slug("François Custardy") == "francois-custardy"
    assert ps.person_slug("Ra'Neith") == "raneith"
    assert ps.person_slug("Morgan “Wulf”") == "morgan-wulf"
    assert ps.person_slug("Elizabeth Murphy-Spivey") == ps.person_slug("Elizabeth Murphy Spivey")


def test_person_slug_drops_honorifics_and_trailing_credentials():
    assert ps.person_slug("Dr. Nicole Gugliucci") == "nicole-gugliucci"
    assert ps.person_slug("Theda Daniels-Race PhD") == ps.person_slug("Theda Daniels - Race") == "theda-daniels-race"
    assert ps.person_slug("Calvin Watts III") == ps.person_slug("Calvin Watts") == "calvin-watts"
    # The honorific goes even where it is the stage name: "Mr. Corporate" and "Ms. Leisure" are real.
    assert ps.person_slug("Mr. Corporate") == "corporate"
    assert ps.person_slug("Dr. Craz") == "craz"
    assert ps.person_slug("Dr.") == "dr"  # an honorific that is the whole name stays


def test_person_slug_keeps_middle_initials_and_a_from_or_of_tail():
    # An id is forever; merging "Laura J. Schroeder" with "Laura Schroeder" is the registry's job.
    assert ps.person_slug("Laura J. Schroeder") == "laura-j-schroeder" != ps.person_slug("Laura Schroeder")
    assert ps.person_slug("Madison May from Cut/Sew") == "madison-may-from-cut-sew"
    assert ps.person_slug("Pro of Pros and Cons Cosplay") == ps.person_slug("Pro of Pros & Cons Cosplay")


def test_person_slug_takes_a_role_parenthetical_off_but_not_any_other():
    assert ps.person_slug("Karen Henson(Judge)") == ps.person_slug("Karen Henson") == "karen-henson"
    assert ps.person_slug("Kei (tophat_tiara)") == "kei-tophat-tiara"


# --- roles -----------------------------------------------------------------

def test_a_role_in_the_name_beats_a_generic_field_and_loses_to_a_specific_one():
    assert ps.speaker_role(sp("Karen Henson(Judge)", "Panelist")) == "Judge"
    assert ps.speaker_role(sp("Karen Henson(Judge)", "Speaker")) == "Judge"
    assert ps.speaker_role(sp("Karen Henson(Judge)", "")) == "Judge"
    assert ps.speaker_role(sp("Daniel Eisenhauer(Judge)", "Moderator")) == "Moderator"
    assert ps.speaker_role(sp("Kei (tophat_tiara)", "Panelist")) == "Panelist"  # not a role


# --- people ----------------------------------------------------------------

def test_people_begin_with_speakers_in_order_then_what_the_line_adds():
    event = ev("Castle Cast", line("Jim Wert(Moderator), Nathan Fillion"),
               [sp("Primetime Steve", "Moderator"), sp("Nathan Fillion")])
    assert ps.people_for(event) == [
        {"id": "primetime-steve", "name": "Primetime Steve", "role": "Moderator", "src": "speakers"},
        {"id": "nathan-fillion", "name": "Nathan Fillion", "role": "Speaker", "src": "speakers"},
        {"id": "jim-wert", "name": "Jim Wert", "role": "Moderator", "src": "description"}]


def test_a_person_in_speakers_is_not_repeated_and_speakers_role_wins():
    event = ev("Panel", line("Dr. Ada Quill(Moderator)"), [sp("Ada Quill", "Speaker"), sp("Ada Q. Quill")])
    assert [(p["id"], p["role"], p["src"]) for p in ps.people_for(event)] == [
        ("ada-quill", "Speaker", "speakers"), ("ada-q-quill", "Speaker", "speakers")]


def test_one_id_per_event_even_when_speakers_names_someone_twice():
    # "Ultimate Puppet Ninja Warrior: Finals" lists Christine Papalexis as Judge and again as Speaker.
    event = ev("Finals", "", [sp("Christine Papalexis", "Judge"), sp("Robin Amico"), sp("Christine Papalexis")])
    assert [(p["id"], p["role"]) for p in ps.people_for(event)] == [
        ("christine-papalexis", "Judge"), ("robin-amico", "Speaker")]


def test_speakers_and_description_are_not_touched():
    event = ev("Panel", line("Jim Wert(Moderator)"), [sp("Karen Henson(Judge)", "Panelist")])
    before = (list(event["speakers"]), event["description"])
    ps.parse_event(event)
    assert (event["speakers"], event["description"]) == before
    assert ps.parse_event(event)["speakers"] == [{"name": "Karen Henson(Judge)", "role": "Panelist"}]


# --- the scraper's own older parse of the same line -------------------------

def test_the_copy_of_extract_panelists_agrees_with_the_scrapers():
    for names in ["Jim Wert(Moderator), Alli Martin", "Daniel Eisenhauer(Judge)(Moderator)", "Glenn Paris,, Naomi V,",
                  "Kei (tophat_tiara), Amy Bray (501st)", "Mark NeCamp, Jr., Alli Martin", "Ryan & Nicole Cadaver"]:
        assert ps.legacy_panelists(line(names)) == scraper.extract_panelists(line(names)), names
    doubled = ("Meetup. Additional Panelists: Carter Alexander (Moderator), Eric Holloway (Moderator). "
               "Additional Panelists: Carter Alexander(Moderator), Eric Holloway(Moderator)")
    assert ps.legacy_panelists(doubled) == scraper.extract_panelists(doubled)
    assert ps.legacy_panelists("no line here") == scraper.extract_panelists("no line here") == []


def test_speakers_the_scraper_built_from_the_line_are_read_again():
    # The Speakers section was empty, so scraper.py filled speakers from the line - and read
    # "(Judge)" as part of a name. people_for reads the line itself instead.
    description = line("Karen Henson(Judge), Alli Martin(Moderator)")
    event = ev("MSFM Onesie Mixer", description, scraper.extract_panelists(description))
    assert event["speakers"] == [{"name": "Karen Henson(Judge)", "role": "Panelist"},
                                 {"name": "Alli Martin", "role": "Moderator"}]
    assert ps.scraper_derived_speakers(event)
    assert ps.people_for(event) == [
        {"id": "karen-henson", "name": "Karen Henson", "role": "Judge", "src": "description"},
        {"id": "alli-martin", "name": "Alli Martin", "role": "Moderator", "src": "description"}]


def test_a_speakers_list_the_scraper_did_not_build_is_left_alone():
    event = ev("Panel", line("Alli Martin"), [sp("Alli Martin"), sp("Jim Wert", "Moderator")])
    assert not ps.scraper_derived_speakers(event)
    assert [(p["name"], p["src"]) for p in ps.people_for(event)] == [
        ("Alli Martin", "speakers"), ("Jim Wert", "speakers")]
    assert not ps.scraper_derived_speakers(ev("Panel", line("Alli Martin"), []))  # no speakers at all


# --- title facets and the title key (moved here from tests/test_tag_census.py) ---------------

def test_title_facets_found():
    found = {
        "Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT": ["paid", "sold_out", "clock"],
        "Learn Watercolor Basics -$- 5:00-6:30 sold-out": ["paid", "sold_out", "clock"],
        "Battle of the Tropes 2: Late-Night Edition (18+)": ["age"],
        "Highlander CCG sealed deck - Friday 11am": ["clock"],
        "FREE Arcade Games!!! 10 a.m. to 4AM": ["clock"],
        "CANCELLED: Dragon Con Burlesque": ["cancelled"],
        "Canceled - The Temporal Formal": ["cancelled"],
        "Liminal Spaces, Part 2": ["part"], "Wicked - Part Two": ["part"], "Fallout Universe: Pt 2!": ["part"],
        "Puppet Slam (Repeat)": ["part"],
        "Plotting: **EXTRA FEE WORKSHOP**": ["fee"], "Champagne Ball - Ticketed Event": ["fee"],
        "Pre-Registration Required: Armor 101": ["fee"], "Intro Sculpting Part 1 - **$50": ["part", "fee"],
    }
    assert {title: ps.title_facets(title) for title in found} == found


def test_title_facets_not_found():
    for title in ["Hopes, Dreams, & Cancellations: The Festivus Panel",  # not CANCELLED
                  "Rose Tatu Productions Presents: Ticket to Ride",      # a board game, not a ticket
                  "TADC Fan Panel: The Last Encore", "Party Games", "Partial Eclipse", "Part of Your World",
                  "Starfinder 1-16/1-17", "21 Years of Twilight", "BARELY COPING? Play the Game! (17+)",
                  "Free Comic Book Day", "Coffee with the Cast", "US$ and Them", "5e for Beginners"]:
        assert ps.title_facets(title) == [], title


def test_strip_facets_leaves_the_title_two_sessions_share():
    a = ps.title_key(ps.strip_facets("Sew a Beret - $$ 12:45p-2:45p SOLD OUT"))
    assert a == ps.title_key(ps.strip_facets("Sew a Beret - $$ 3:00-5:00p")) == "sew a beret"
    assert ps.title_key(ps.strip_facets("Liminal Spaces, Part 2")) == "liminal spaces part 2"  # a series is not a repeat
    assert ps.title_key(ps.strip_facets("2:00 and Counting")) == "and counting"  # the "a" of "and" is not a.m.


# --- facets ----------------------------------------------------------------

def test_mature_comes_from_the_marker_from_adults_only_or_from_a_stated_age():
    assert ps.facets_for(ev("Panel", "It is late.(Mature Audience)")) == {"mature": True}
    assert ps.facets_for(ev("Puppetry and Burlesque", "Adults only, please.")) == {"mature": True}
    # schema-v2.md's first worked example. The "2" is part of the title, not a "Part 2".
    assert ps.facets_for(ev("Battle of the Tropes 2: Late-Night Edition (18+)", "Closes (Age 18+)(Mature Audience)")) \
        == {"mature": True, "min_age": 18}
    assert ps.facets_for(ev("A Kids Panel", "All ages welcome.")) == {}


def test_min_age_takes_the_highest_stated_and_only_13_to_21():
    assert ps.facets_for(ev("Spectrum: The Rainbow Flag Party", "18+ to enter, 21+ to drink")) == \
        {"min_age": 21, "mature": True}
    assert ps.facets_for(ev("BARELY COPING? Play the Game! (17+)")) == {"min_age": 17}
    assert ps.facets_for(ev("Panel", "Ages 12+ welcome")) == {}  # under 13: the table stops there
    assert ps.facets_for(ev("Panel", "Founded in 1963, it ran 26+ years")) == {}  # not an age gate


def test_cost_comes_from_a_title_mark_an_extra_fee_or_a_price():
    assert ps.facets_for(ev("Sew Your Own Beret - $$ 12:45p-2:45p SOLD OUT")) == {"cost": "extra", "sold_out": True}
    assert ps.facets_for(ev("101 Ideas in an Hour **EXTRA FEE WORKSHOP**")) == {"cost": "extra"}
    assert ps.facets_for(ev("MTG Chaos Mini Master", "Price: $8\nGet 1 Random booster")) == {"cost": "extra"}
    assert ps.facets_for(ev("P&T: Speed Paints", "$5 cash donation @ Paint & Take to reserve seat.")) == \
        {"cost": "extra", "signup": True}


def test_cost_is_not_set_by_a_number_that_is_not_a_price_or_by_a_zero():
    assert ps.facets_for(ev("Charting 2050 & a $3 Trillion Space Economy",
                            "Valued over $630 billion in 2025, investment in space is growing")) == {}
    # No 2026 event states a zero or free price; one that did would set nothing.
    assert ps.facets_for(ev("Adult Origami", "Price: $0")) == {}
    assert ps.facets_for(ev("Adult Origami", "Price: Free")) == {}
    assert ps.facets_for(ev("Board Game Pass", "Price: $0.50")) == {"cost": "extra"}


def test_cost_and_signup_are_not_set_where_the_listing_says_there_is_none():
    photoshoot = "Feel free to join us for another great photoshoot. There is no charge to participate."
    assert ps.facets_for(ev("Photoshoot: The Muppets", photoshoot)) == {}
    assert ps.facets_for(ev("LotR TCG Cube Draft", "Simply draft a deck and play! No fee to enter.")) == {}
    assert ps.cost_wording(ev("A workshop", "Pre-reg online. No fee to enter."))[2] is not None


def test_signup_reads_pre_registration_wording_and_not_a_ticket():
    assert ps.facets_for(ev("Mirror Embroidery", "Advanced registration required. Classes are full.")) == \
        {"signup": True}
    assert ps.facets_for(ev("Rose Tatu Presents: Caverna", "Rules taught. Pre-reg Online to insure a seat.")) == \
        {"signup": True}
    assert ps.facets_for(ev("MTG ODE: CLUE Pod", "Play 1 round. 500 tickets each and a random prize card.")) == {}


def test_sold_out_and_part_read_the_title():
    assert ps.facets_for(ev("Matt Dinniman - Signing - SOLD OUT")) == {"sold_out": True}
    assert ps.facets_for(ev("Changed for Good: Celebrating Wicked – Part Two")) == {"part": 2}
    assert ps.facets_for(ev("Surviving the Fallout Universe: Pt 2!")) == {"part": 2}
    assert ps.facets_for(ev("Intro Sculpting Workshop Part 1: Building a Small Dragon Armature - **$50")) == \
        {"part": 1, "cost": "extra"}
    assert "part" not in ps.facets_for(ev("Author Signing - Repeat"))  # "Repeat" gives no number


def test_repeat_key_is_the_title_without_the_facets_and_only_where_it_recurs():
    events = [ev("Sew a Beret - $$ 12:45p-2:45p SOLD OUT", start="2026-09-05T12:45", id="a"),
              ev("Sew a Beret - $$ 3:00-5:00p", start="2026-09-05T15:00", id="b"),
              ev("Opening Ceremonies", start="2026-09-04T10:00", id="c")]
    repeats = ps.repeat_keys(events)
    assert repeats == frozenset({"sew a beret"})
    assert [ps.facets_for(e, repeats).get("repeat_key") for e in events] == ["sew a beret", "sew a beret", None]
    # Two listings at one start are one thing listed twice, not a repeat.
    assert ps.repeat_keys([ev("Author Signing", id="a"), ev("Author Signing", id="b")]) == frozenset()


def test_part_n_stays_in_a_repeat_key_so_a_series_is_not_a_recurrence():
    events = [ev("Liminal Spaces, Part 2", start="2026-09-05T10:00", id="a"),
              ev("Liminal Spaces, Part 3", start="2026-09-06T10:00", id="b")]
    assert ps.repeat_keys(events) == frozenset()


# --- the whole stage -------------------------------------------------------

def test_parse_event_adds_two_keys_and_changes_nothing_else():
    event = ev("Sew a Beret - $$ 12:45p-2:45p SOLD OUT", line("Jim Wert(Moderator)"), [sp("Ada Quill")])
    out = ps.parse_event(event)
    assert set(out) - set(event) == {"people", "facets"}
    assert all(out[k] == event[k] for k in event)
    assert out["facets"] == {"cost": "extra", "sold_out": True}
    assert [p["id"] for p in out["people"]] == ["ada-quill", "jim-wert"]


def test_two_runs_under_different_hash_seeds_parse_the_same_bytes(tmp_path):
    import json
    import subprocess
    source = tmp_path / "events.json"
    fixture = {"generated_at": "2026-09-07T12:50:19+00:00", "source": "fixture", "count": 3, "events": [
        ev("Sew a Beret - $$ 12:45p-2:45p SOLD OUT", line("Jim Wert(Moderator), Alli Martin"), [sp("Ada Quill")],
           start="2026-09-05T12:45", id="a"),
        ev("Sew a Beret - $$ 3:00-5:00p", "", [sp("Dr. Ada Quill", "Moderator")], start="2026-09-05T15:00", id="b"),
        ev("Battle of the Tropes 2 (18+)", "Closes (Age 18+)(Mature Audience)", start="2026-09-06T22:00", id="c")]}
    source.write_text(json.dumps(fixture), encoding="utf-8")
    written = []
    for seed in ("0", "1"):
        out = tmp_path / f"parsed-{seed}.json"
        subprocess.run([sys.executable, "parse_stage.py", "--file", str(source), "--out", str(out)], cwd=ROOT,
                       check=True, env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(out.read_bytes())
    assert written[0] == written[1]
    parsed = json.loads(written[0])["events"]
    assert [p["id"] for p in parsed[0]["people"]] == ["ada-quill", "jim-wert", "alli-martin"]
    assert parsed[0]["facets"] == {"cost": "extra", "sold_out": True, "repeat_key": "sew a beret"}
    assert parsed[2]["facets"] == {"mature": True, "min_age": 18}
