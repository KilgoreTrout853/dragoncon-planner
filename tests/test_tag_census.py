"""Tests for tag_census.py's pure functions, on a small inline fixture. Nothing here reads data/.

Run:  python -m pytest tests/
"""
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import tag_census as tc  # noqa: E402


def ev(id, title, start, **kw):
    tags = kw.pop("tags", {"fandoms": [], "kind": "panel", "topics": [], "adult": False, "guests": "fan"})
    base = {"id": id, "type": "panel", "title": title, "day": start[:10], "start": start, "description": "",
            "tracks": ["Trek Track"], "track": "Trek Track", "speakers": [], "cancelled": False}
    return {**base, **kw, **({"tags": tags} if tags else {})}


def tagged(fandoms=(), topics=(), kind="panel", adult=False, guests="fan"):
    return {"fandoms": list(fandoms), "kind": kind, "topics": list(topics), "adult": adult, "guests": guests}


FIXTURE = {
    "generated_at": "2026-09-07T12:50:19+00:00", "source": "fixture", "count": 8,
    "events": [
        ev("a1", "Star Trek: Lower Decks Q&A", "2026-09-04T10:00", tags=tagged(["Star Trek"], ["TV"], "qa", guests="celebrity"),
           speakers=[{"name": "Dr. Ada Quill", "role": "Speaker"}, {"name": "Tom Reed(Judge)", "role": "Moderator"}]),
        ev("a2", "Lower Decks Duo", "2026-09-04T13:00", tags=tagged(["Star Trek: Lower Decks"], ["TV"], "photo"),
           speakers=[{"name": "Ada Quill", "role": "Speaker"}]),
        ev("a3", "Wheel Talk", "2026-09-05T10:00", tags=tagged(["The Wheel of Time"], ["Fantasy", "Literature"])),
        ev("a4", "Wheel Talk", "2026-09-06T10:00", tags=tagged(["Wheel of Time"], ["Literature", "Fantasy"])),
        ev("a5", "Sew a Beret - $$ 12:45p-2:45p SOLD OUT", "2026-09-05T12:45", tags=tagged(["Anime"], kind="workshop"),
           tracks=["Costuming"], description="Bring scissors. **EXTRA FEE**"),
        ev("a6", "Sew a Beret - $$ 3:00-5:00p", "2026-09-05T15:00", tags=tagged(kind="workshop"), tracks=["Costuming"]),
        ev("a7", "Villains After Dark", "2026-09-05T22:00", tags=tagged(topics=["Horror"]),
           description="x" * 650 + " (Mature Audience) Additional Panelists: Tom Reed"),
        ev("a8", "Photo Session: Nobody", "2026-09-06T12:00", tags=None, tracks=[]),
    ],
}


# --- names -----------------------------------------------------------------

def test_fandom_key_sets_aside_case_punctuation_a_leading_the_and_the_ampersand():
    assert tc.fandom_key("The Wheel of Time") == tc.fandom_key("wheel of time") == "wheel of time"
    assert tc.fandom_key("Rick & Morty") == tc.fandom_key("Rick and Morty")
    assert tc.fandom_key("Pokémon") == tc.fandom_key("POKEMON")
    assert tc.fandom_key("Pee-wee’s Playhouse") == tc.fandom_key("Pee Wee's Playhouse")
    assert tc.fandom_key("The") == "the"  # a name that is only "the" keeps it
    assert tc.fandom_key("Star Trek") != tc.fandom_key("Star Wars")


def test_person_key_sets_aside_what_varies_in_a_speaker_name():
    same = ["Ada Quill", "Dr. Ada Quill", "ADA QUILL, PhD", "Ada Q. Quill", "Ada Quill (501st)", "Ada Quill(Judge)",
            "Ada Quill from Quillworks - booth 12", "Prof Ada Quill Jr."]
    assert {tc.person_key(name) for name in same} == {"ada quill"}
    assert tc.person_key("K. E. Deyarmin") == tc.person_key("K.E. Deyarmin")  # a leading initial is not a middle one
    assert tc.person_key("Mary-Jane O'Neil") == tc.person_key("Mary Jane ONeil")
    assert tc.person_key("Dr") == "dr" and tc.person_key("Yo-Yo Ma") == "yo yo ma"  # never stripped to nothing
    assert tc.person_key("Ada Quill") != tc.person_key("Ada Quinn")


def test_person_parts_says_what_it_set_aside():
    assert tc.person_parts("Ada Quill") == ("ada quill", [])
    assert tc.person_parts("Dr. Ada Q. Quill, PhD")[1] == ["credential or suffix", "honorific", "middle initial"]
    assert tc.person_parts("Tom Reed(Judge)")[1] == ["parenthetical"]
    assert tc.person_parts("Meg from Megs Mashables") == ("meg", ["from/of tail"])


# --- near-duplicates -------------------------------------------------------

def test_same_key_groups_finds_spellings_of_one_name_and_nothing_else():
    names = ["The Wheel of Time", "Wheel of Time", "wheel of time!", "Star Trek", "Star Wars"]
    assert tc.same_key_groups(names, tc.fandom_key) == [["The Wheel of Time", "Wheel of Time", "wheel of time!"]]
    assert tc.same_key_groups(["Star Trek", "Star Trek"], tc.fandom_key) == []  # one name twice is one name


def test_prefix_pairs_are_whole_words():
    names = ["Star Trek", "Star Trek: Lower Decks", "Stargate", "Star Wars", "Dragon Ball", "Dragon Ball Z", "Alien", "Aliens"]
    assert tc.prefix_pairs(names) == [("Dragon Ball", "Dragon Ball Z"), ("Star Trek", "Star Trek: Lower Decks")]


def test_generic_reason_names_topics_near_topics_and_the_generic_list():
    assert tc.generic_reason("Anime") == "equals the topic Anime"
    assert tc.generic_reason("props and making") == "equals the topic Props & Making"
    assert tc.generic_reason("Comic") == "nearly equals the topic Comics (UNSURE)"
    assert tc.generic_reason("Video Games") == "in the generic list"
    assert tc.generic_reason("Star Trek") is None


# --- title facets ----------------------------------------------------------

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
    assert {title: tc.title_facets(title) for title in found} == found


def test_title_facets_not_found():
    for title in ["Hopes, Dreams, & Cancellations: The Festivus Panel",  # not CANCELLED
                  "Rose Tatu Productions Presents: Ticket to Ride",      # a board game, not a ticket
                  "TADC Fan Panel: The Last Encore", "Party Games", "Partial Eclipse", "Part of Your World",
                  "Starfinder 1-16/1-17", "21 Years of Twilight", "BARELY COPING? Play the Game! (17+)",
                  "Free Comic Book Day", "Coffee with the Cast", "US$ and Them", "5e for Beginners"]:
        assert tc.title_facets(title) == [], title


def test_strip_facets_leaves_the_title_two_sessions_share():
    a = tc.title_key(tc.strip_facets("Sew a Beret - $$ 12:45p-2:45p SOLD OUT"))
    assert a == tc.title_key(tc.strip_facets("Sew a Beret - $$ 3:00-5:00p")) == "sew a beret"
    assert tc.title_key(tc.strip_facets("Liminal Spaces, Part 2")) == "liminal spaces part 2"  # a series is not a repeat
    assert tc.title_key(tc.strip_facets("2:00 and Counting")) == "and counting"  # the "a" of "and" is not a.m.


# --- adult wording, tag differences, counting ------------------------------

def test_adult_wording_says_where_and_what():
    at = {e["id"]: tc.adult_wording(e) for e in FIXTURE["events"]}
    assert at["a7"] == ("past 600", "Mature Audience") and at["a1"] is None
    assert tc.adult_wording({"title": "Tropes (18+)", "description": "Adults only."}) == ("title", "18+")
    assert tc.adult_wording({"title": "Tropes", "description": "This event is 21 and over."}) == ("description", "21 and over")
    assert tc.adult_wording({"title": "Adult Swim Trivia", "description": "A game for players 17+."}) is None


def test_tag_differences_ignores_list_order_and_untagged_events():
    wheel = [e for e in FIXTURE["events"] if e["title"] == "Wheel Talk"]
    assert tc.tag_differences([wheel]) == {"fandoms": 1, "any": 1}  # topics differ only in order
    assert tc.tag_differences([[FIXTURE["events"][0], FIXTURE["events"][7]]]) == {}  # the second has no tags


def test_histogram_ranked_spread_and_title_terms():
    buckets = [("1", 1, 1), ("2-3", 2, 3), ("4+", 4, None)]
    assert tc.histogram([1, 1, 2, 3, 4, 99], buckets) == [("1", 2), ("2-3", 2), ("4+", 2)]
    assert tc.ranked({"b": 2, "a": 2, "c": 5}) == [("c", 5), ("a", 2), ("b", 2)]  # count descending, then name
    assert tc.spread("abcdefghijklmnopqrst", 4) == ["a", "f", "k", "p"] and tc.spread("ba", 4) == ["a", "b"]
    word_df, phrase_df = tc.title_terms(["Star Trek: Lower Decks Duo", "Lower Decks and the Lower Decks 2"], skip=["star", "trek"])
    assert word_df == {"lower": 2, "decks": 2, "duo": 1}  # once per title; stopwords, numbers and the skip list out
    assert phrase_df == {"lower decks": 2, "decks duo": 1}  # "decks and" and "the lower" are not phrases


# --- the report ------------------------------------------------------------

def test_render_counts_the_fixture_and_lists_what_it_should():
    text = tc.render(FIXTURE, "fixture.json")
    assert "1. Events: 8, and `count` in events.json says 8. Tagged: 7. No tags at all: 1." in text
    assert "- UNSURE: The Wheel of Time (1), Wheel of Time (1)" in text
    assert "- UNSURE: Star Trek (1) / Star Trek: Lower Decks (1)" in text
    assert "| Anime | equals the topic Anime | 1 |" in text
    assert "- UNSURE: `Ada Quill` (1), `Dr. Ada Quill` (1)" in text
    assert "- UNSURE: `Villains After Dark` - 2026-09-05T22:00 - in the past 600: `Mature Audience`" in text
    assert "| `Sew a Beret - $$ 12:45p-2:45p SOLD OUT` | workshop | 2 | 2 |" in text  # recurs once its facets are out
    assert "- Costuming (2 events): (none), 0.0%" not in text and "- Trek Track (5 events)" not in text
    assert text.endswith("|\n") and "\r" not in text and "\n\n\n" not in text


def test_two_runs_under_different_hash_seeds_write_the_same_bytes(tmp_path):
    """Set order follows the process's hash seed; nothing in the report may."""
    source = tmp_path / "events.json"
    source.write_text(json.dumps(FIXTURE), encoding="utf-8")
    written = []
    for seed in ("1", "2"):
        out = tmp_path / f"census-{seed}.md"
        subprocess.run([sys.executable, "tag_census.py", "--file", str(source), "--out", str(out)], cwd=ROOT, check=True,
                       capture_output=True, env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(out.read_bytes())
    assert written[0] == written[1] and b"\r" not in written[0]
    assert written[0].decode("utf-8") == tc.render(FIXTURE, str(source))
