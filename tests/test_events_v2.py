"""Tests for events_v2.py: the merge rules, the hard errors, the shape of the file, and that a build is
the same bytes every time and never touches its input. Registries, cache and events are inline
fixtures written to tmp_path, and nothing calls a model; the last test alone reads data/, to hold the
committed events.v2.json to a fresh build of the committed inputs.

Run:  python -m pytest tests/
"""
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import draft_people as dp  # noqa: E402
import events_v2 as v2  # noqa: E402
import registry  # noqa: E402
import tag_stage as ts  # noqa: E402

WORKS = [
    {"id": "castle", "name": "Castle", "aliases": [], "type": "franchise", "reviewed": True},
    {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": True},
    {"id": "star-trek", "name": "Star Trek", "aliases": [], "type": "franchise", "reviewed": True},
    {"id": "star-trek-lower-decks", "name": "Star Trek: Lower Decks", "aliases": ["Lower Decks"],
     "parent": "star-trek", "type": "franchise", "reviewed": True},
    {"id": "the-rookie", "name": "The Rookie", "aliases": [], "type": "franchise", "reviewed": False},
    {"id": "dungeons-and-dragons", "name": "Dungeons & Dragons", "aliases": ["D&D"], "type": "game",
     "family": "rpg", "terms": ["DDAL"], "reviewed": True},
]
PEOPLE = [
    {"id": "nathan-fillion", "name": "Nathan Fillion", "aliases": [], "tier": "celebrity", "reviewed": True,
     "credits": [{"work": "firefly", "reviewed": True}, {"work": "the-rookie", "reviewed": False}]},
    {"id": "seamus-dever", "name": "Seamus Dever", "aliases": [], "tier": "celebrity", "reviewed": False,
     "credits": [{"work": "castle", "reviewed": True}]},
    {"id": "gina-torres", "name": "Gina Torres", "aliases": [], "tier": "celebrity", "reviewed": True,
     "credits": [{"work": "firefly", "reviewed": True}, {"work": "star-trek", "reviewed": True}]},
    {"id": "molly-quinn", "name": "Molly Quinn", "aliases": [], "tier": "creator", "reviewed": True, "credits": []},
    {"id": "pat-henry", "name": "Pat Henry", "aliases": ["Pat Henry - President of Dragon Con"], "credits": [],
     "reviewed": True},
    {"id": "karen-henson", "name": "Karen Henson", "aliases": ["K. Henson"], "reviewed": False},
]
TRACKS = [
    {"id": "main-programming", "name": "Main Programming", "aliases": []},
    {"id": "kids-track", "name": "Kids Track", "aliases": [], "audience": "kids"},
    {"id": "filk-music", "name": "Filk Music", "aliases": [], "axes": {"medium": ["music"]}},
    {"id": "high-fantasy", "name": "High Fantasy", "aliases": [], "axes": {"genre": ["fantasy"]}},
    {"id": "board-games", "name": "Board Games", "aliases": [], "axes": {"medium": ["tabletop", "video-games"]}},
    {"id": "trek-track", "name": "Trek Track", "aliases": [], "work": "star-trek"},
]


def ev(title, description="", tracks=("Main Programming",), type="panel", speakers=(), id=None,
       start="2026-09-05T11:30", tags=True):
    tracks = list(tracks)
    out = {"id": id or title.lower().replace(" ", "-"), "type": type, "title": title, "day": start[:10],
           "start": start, "end": start, "duration_min": 60, "location": "Marriott A", "hotel": "Marriott",
           "room": "A", "description": description, "tracks": tracks, "track": tracks[0] if tracks else "",
           "speakers": [{"name": n, "role": r} for n, r in speakers], "cancelled": False}
    if tags:   # the v1 object, which the build replaces
        out["tags"] = {"fandoms": ["Castle"], "kind": "qa", "topics": ["TV"], "adult": False, "guests": "celebrity"}
    return out


def answer(kind="panel", works=(), audience="all", play=None, **axes):
    return {"kind": kind, "works": [{"name": n, "evidence": n, "type": "franchise"} for n in works],
            "medium": [], "genre": [], "craft": [], "subject": [], **axes, "audience": audience, "play": play}


def reg_with(tmp_path, works=WORKS, people=PEOPLE, tracks=TRACKS):
    d = tmp_path / "registry"
    d.mkdir(exist_ok=True)
    dp.write_json(str(d / "works.json"), [dp.in_order(w, dp.WORK_KEYS) for w in works])
    dp.write_json(str(d / "people.json"), list(people))
    dp.write_json(str(d / "tracks.json"), list(tracks))
    return registry.load(str(d))


def cache_for(pairs):
    """{key: entry} for [(event, answer)], as the tag stage writes them."""
    out = {}
    for event, a in pairs:
        inp = ts.tagger_input(event)
        out[ts.input_key(inp)] = {"key": ts.input_key(inp), "title": inp["title"], "model": "m", "answer": a}
    return out


def built_doc(tmp_path, pairs, **reg):
    """The whole v2 document for [(event, answer)], and the build's counts."""
    return v2.build({"generated_at": "2026-09-07T12:50:19+00:00", "events": [e for e, _ in pairs]},
                    reg_with(tmp_path, **reg), cache_for(pairs))


def built(tmp_path, pairs, **reg):
    """The v2 events for [(event, answer)], and the build's counts."""
    doc, stats = built_doc(tmp_path, pairs, **reg)
    return doc["events"], stats


def tags(tmp_path, event, a, **reg):
    return built(tmp_path, [(event, a)], **reg)[0][0]["tags"]


# --- works -------------------------------------------------------------------

def test_a_credit_needs_the_person_reviewed_and_the_credit_reviewed(tmp_path):
    event = ev("Castle Cast", speakers=[("Seamus Dever", "Speaker"), ("Nathan Fillion", "Speaker")])
    got = tags(tmp_path, event, answer(kind="qa"))["works"]
    # Seamus Dever is unreviewed, so his reviewed credit to Castle does not arrive; Nathan Fillion's
    # credit to The Rookie is unreviewed, so it does not arrive either.
    assert got == [{"id": "firefly", "via": "credit:nathan-fillion"}]


def test_one_row_per_work_and_the_strongest_via_wins(tmp_path):
    about = ev("Star Trek Trivia", tracks=["Trek Track"], speakers=[("Gina Torres", "Speaker")])
    assert tags(tmp_path, about, answer(works=["Star Trek"]))["works"] == [
        {"id": "star-trek", "via": "about"}, {"id": "firefly", "via": "credit:gina-torres"}]
    track = ev("Trek Track Meetup", tracks=["Trek Track"], speakers=[("Gina Torres", "Speaker")])
    assert tags(tmp_path, track, answer())["works"] == [
        {"id": "star-trek", "via": "track"}, {"id": "firefly", "via": "credit:gina-torres"}]


def test_a_descendant_beats_its_ancestor_named_alongside_it_in_about_only(tmp_path):
    both = ev("Lower Decks Q&A")
    assert tags(tmp_path, both, answer(works=["Star Trek", "Lower Decks"]))["works"] == [
        {"id": "star-trek-lower-decks", "via": "about"}]
    # a different via on the ancestor stays: the track is about Star Trek, the listing about Lower Decks
    in_track = ev("Lower Decks Q&A", tracks=["Trek Track"])
    assert tags(tmp_path, in_track, answer(works=["Star Trek: Lower Decks"]))["works"] == [
        {"id": "star-trek-lower-decks", "via": "about"}, {"id": "star-trek", "via": "track"}]


def test_among_several_credits_the_first_person_in_event_order_wins(tmp_path):
    event = ev("Big Damn Heroes", speakers=[("Gina Torres", "Speaker"), ("Nathan Fillion", "Speaker")])
    assert tags(tmp_path, event, answer())["works"] == [
        {"id": "firefly", "via": "credit:gina-torres"}, {"id": "star-trek", "via": "credit:gina-torres"}]


def test_a_work_named_by_a_registry_term_is_dropped_and_counted_not_an_error(tmp_path):
    event = ev("DDAL FR-DC-TDD-03: The Zephyr's Fold", tracks=["Main Programming"], type="gaming")
    events, stats = built(tmp_path, [(event, answer(kind="gaming", works=["DDAL", "Dungeons & Dragons"]))])
    assert events[0]["tags"]["works"] == [{"id": "dungeons-and-dragons", "via": "about"}]
    assert stats["terms"] == {"DDAL": 1}


def test_a_term_made_an_alias_later_links_with_no_model_call(tmp_path):
    event = ev("DDAL FR-DC-TDD-03: The Zephyr's Fold", type="gaming")
    pairs = [(event, answer(kind="gaming", works=["DDAL"]))]
    assert built(tmp_path, pairs)[0][0]["tags"]["works"] == []
    moved = [dict(w) for w in WORKS]
    dnd = next(w for w in moved if w["id"] == "dungeons-and-dragons")
    dnd["aliases"], dnd["terms"] = ["D&D", "DDAL"], []
    assert built(tmp_path, pairs, works=moved)[0][0]["tags"]["works"] == [{"id": "dungeons-and-dragons", "via": "about"}]


# --- axes, audience, play, guests --------------------------------------------

def test_a_track_decides_its_axes_and_the_model_the_rest(tmp_path):
    event = ev("Songs of Middle-earth", tracks=["Filk Music", "High Fantasy"])
    got = tags(tmp_path, event, answer(medium=["tv"], genre=["horror"], craft=["performance"]))
    assert (got["medium"], got["genre"], got["craft"], got["subject"]) == (["music"], ["fantasy"], ["performance"], [])
    # the tracks' values in tracks[] order, at most two
    two = ev("Game Night", tracks=["Filk Music", "Board Games"])
    assert tags(tmp_path, two, answer(medium=["tv"]))["medium"] == ["music", "tabletop"]


def test_mature_beats_kids_beats_all(tmp_path):
    marked = ev("Late Show", "Songs.(Mature Audience)", tracks=["Kids Track"])
    assert tags(tmp_path, marked, answer(audience="kids"))["audience"] == "mature"      # the parse says so
    assert tags(tmp_path, ev("After Dark"), answer(audience="mature"))["audience"] == "mature"
    assert tags(tmp_path, ev("Puppet Show", tracks=["Kids Track"]), answer())["audience"] == "kids"
    assert tags(tmp_path, ev("Storytime"), answer(audience="kids"))["audience"] == "kids"
    assert tags(tmp_path, ev("A Panel"), answer())["audience"] == "all"


def test_a_kids_track_event_the_model_called_mature_is_listed(tmp_path):
    events, stats = built(tmp_path, [(ev("Monster Mash", tracks=["Kids Track"]), answer(audience="mature"))])
    assert events[0]["tags"]["audience"] == "mature" and stats["kids_track_mature"] == ["Monster Mash"]


def test_play_is_kept_only_on_a_gaming_event(tmp_path):
    play = {"format": "tournament", "level": "any"}
    assert tags(tmp_path, ev("MTG Draft", type="gaming"), answer(kind="gaming", play=play))["play"] == play
    assert tags(tmp_path, ev("Chess Open"), answer(kind="gaming", play=play))["play"] == play       # by its kind
    assert "play" not in tags(tmp_path, ev("Chess History"), answer(kind="panel", play=play))
    assert "play" not in tags(tmp_path, ev("Open Gaming", type="gaming"), answer(kind="gaming"))


def test_guests_come_from_reviewed_tiers_only(tmp_path):
    assert "guests" not in tags(tmp_path, ev("Castle Guests", speakers=[("Seamus Dever", "Speaker")]), answer())
    assert "guests" not in tags(tmp_path, ev("Welcome", speakers=[("Pat Henry", "Speaker")]), answer())  # no tier
    assert tags(tmp_path, ev("Writing", speakers=[("Molly Quinn", "Speaker")]), answer())["guests"] == "creator"
    both = ev("Q&A", speakers=[("Molly Quinn", "Speaker"), ("Nathan Fillion", "Speaker")])
    assert tags(tmp_path, both, answer())["guests"] == "celebrity"                    # the highest tier


# --- people ------------------------------------------------------------------

def test_a_person_id_resolves_through_an_alias_even_when_unreviewed(tmp_path):
    event = ev("Judging", speakers=[("K. Henson", "Judge"), ("Primetime Steve", "Moderator")])
    people = built(tmp_path, [(event, answer())])[0][0]["people"]
    assert [p["id"] for p in people] == ["karen-henson", "primetime-steve"]
    assert people[0] == {"id": "karen-henson", "name": "K. Henson", "role": "Judge", "src": "speakers"}


def test_two_spellings_of_one_person_are_one_entry_and_the_first_stands(tmp_path):
    event = ev("Opening", speakers=[("Pat Henry - President of Dragon Con", "Speaker"), ("Pat Henry", "Moderator")])
    people = built(tmp_path, [(event, answer())])[0][0]["people"]
    assert [(p["id"], p["role"]) for p in people] == [("pat-henry", "Speaker")]


# --- what stops a build --------------------------------------------------------

def test_a_cache_miss_is_an_error_listing_the_titles(tmp_path):
    cached, missing = ev("Castle Cast"), ev("Firefly Reunion")
    with pytest.raises(v2.BuildError) as exc:
        v2.build({"events": [cached, missing]}, reg_with(tmp_path), cache_for([(cached, answer())]))
    assert "no cached answer" in str(exc.value) and "Firefly Reunion" in str(exc.value)
    assert "Castle Cast" not in str(exc.value)


def test_an_unresolved_work_name_is_an_error_naming_the_mint_command(tmp_path):
    with pytest.raises(v2.BuildError) as exc:
        built(tmp_path, [(ev("Monk Q&A"), answer(works=["Monk"]))])
    assert "'Monk'" in str(exc.value) and "python tag_stage.py --mint-only" in str(exc.value)


def test_an_unresolved_track_is_an_error(tmp_path):
    with pytest.raises(v2.BuildError) as exc:
        built(tmp_path, [(ev("A Panel", tracks=["Underwater Basket Weaving"]), answer())])
    assert "'Underwater Basket Weaving'" in str(exc.value)


def test_every_problem_is_listed_not_the_first(tmp_path):
    first, second = ev("Monk Q&A", tracks=["Nowhere"]), ev("Uncached")
    with pytest.raises(v2.BuildError) as exc:
        v2.build({"events": [first, second]}, reg_with(tmp_path), cache_for([(first, answer(works=["Monk"]))]))
    assert len(exc.value.problems) == 3


# --- the works block -----------------------------------------------------------

# Two levels under Marvel, a sibling, a work linked only by a credit or only by a track whose parent no
# event links, and a name that sorts elsewhere than its id. File order is not id order (marvel before
# avengers), so a block in file order fails, and name order is not id order either.
BLOCK_WORKS = WORKS + [
    {"id": "marvel", "name": "Marvel", "aliases": ["MCU"], "parent": None, "type": "franchise",   # null is no parent
     "reviewed": True},
    {"id": "avengers", "name": "Avengers", "parent": "marvel", "type": "franchise", "reviewed": False},  # no aliases key
    {"id": "avengers-endgame", "name": "Avengers: Endgame", "aliases": ["Endgame"], "parent": "avengers",
     "type": "franchise", "terms": ["Thanos"], "reviewed": True},
    {"id": "avengers-infinity-war", "name": "Avengers: Infinity War", "aliases": [], "parent": "avengers",
     "type": "franchise", "reviewed": True},
    {"id": "blood-of-my-blood", "name": "Outlander: Blood of My Blood", "aliases": [], "type": "franchise",
     "reviewed": True},
]
BLOCK_PEOPLE = PEOPLE + [
    {"id": "tawny-newsome", "name": "Tawny Newsome", "aliases": [], "tier": "celebrity", "reviewed": True,
     "credits": [{"work": "star-trek-lower-decks", "reviewed": True}]},
]
BLOCK_TRACKS = TRACKS + [
    {"id": "lower-decks-track", "name": "Lower Decks Track", "aliases": [], "work": "star-trek-lower-decks"},
]
BLOCK_REG = {"works": BLOCK_WORKS, "people": BLOCK_PEOPLE, "tracks": BLOCK_TRACKS}

ENDGAME = (ev("Endgame Rewatch"), answer(works=["Avengers: Endgame"]))                    # about, two levels down
TREK_TRACK = (ev("Trek Track Meetup", tracks=["Trek Track"]), answer())                   # track: star-trek
FILLION = (ev("Big Damn Heroes", speakers=[("Nathan Fillion", "Speaker")]), answer())      # credit: firefly
NEWSOME = (ev("Lower Decks Live", speakers=[("Tawny Newsome", "Speaker")]), answer())      # credit: a child
DECKS_TRACK = (ev("Decks Meetup", tracks=["Lower Decks Track"]), answer())               # track: a child
DDAL = (ev("DDAL Table", type="gaming"), answer(kind="gaming", works=["Dungeons & Dragons"]))   # a game


def block_of(tmp_path, pairs):
    doc, _ = built_doc(tmp_path, pairs, **BLOCK_REG)
    return doc


def test_every_work_an_event_links_by_any_via_is_in_the_block(tmp_path):
    doc = block_of(tmp_path, [ENDGAME, TREK_TRACK, FILLION])
    links = [w for e in doc["events"] for w in e["tags"]["works"]]
    assert {w["via"].split(":")[0] for w in links} == {"about", "track", "credit"}
    ids = {r["id"] for r in doc["works"]}
    for w in links:
        assert w["id"] in ids, f"{w['id']}, linked {w['via']}, is not in the block"


def test_every_parent_named_in_the_block_is_in_the_block(tmp_path):
    # the walk goes all the way up, and from a work linked by any via, not only about
    for case, pair, expected in [("about, two levels", ENDGAME, ["avengers", "avengers-endgame", "marvel"]),
                                 ("credit", NEWSOME, ["star-trek", "star-trek-lower-decks"]),
                                 ("track", DECKS_TRACK, ["star-trek", "star-trek-lower-decks"])]:
        rows = block_of(tmp_path, [pair])["works"]
        ids = {r["id"] for r in rows}
        for r in rows:
            if "parent" in r:
                assert r["parent"] in ids, f"{case}: {r['id']}'s parent {r['parent']} is not in the block"
        assert [r["id"] for r in rows] == expected, case


def test_the_block_is_sorted_by_id_one_row_a_work(tmp_path):
    # star-trek is linked by two events and is also Lower Decks' ancestor: still one row
    outlander = (ev("Outlander Prequel Panel"), answer(works=["Outlander: Blood of My Blood"]))
    rows = block_of(tmp_path, [ENDGAME, TREK_TRACK, (ev("Trek Track Social", tracks=["Trek Track"]), answer()),
                               NEWSOME, DDAL, outlander])["works"]
    ids, names = [r["id"] for r in rows], [r["name"] for r in rows]
    assert ids == sorted(ids)
    assert len(ids) == len(set(ids)), "a work has two rows"
    assert ids != [w["id"] for w in BLOCK_WORKS if w["id"] in ids]    # the registry's own order would fail
    assert names != sorted(names) and names != sorted(names, key=str.casefold)   # and so would name order


def test_a_work_no_event_reaches_and_no_listed_work_descends_from_is_absent(tmp_path):
    rows = block_of(tmp_path, [ENDGAME, TREK_TRACK, FILLION])["works"]
    ids = [r["id"] for r in rows]
    assert "castle" not in ids, "a work no event links is listed"
    assert "the-rookie" not in ids, ("a work only the raw registry reaches is listed (Nathan Fillion's unreviewed "
                                     "credit): the block is built from the merged events")
    assert "star-trek-lower-decks" not in ids, ("a descendant of a linked work is listed (Trek Track links "
                                                "star-trek): the walk goes up, never down")
    assert "avengers-infinity-war" not in ids, ("a sibling under a listed ancestor is listed: an ancestor brings "
                                                "none of its other descendants")
    assert ids == ["avengers", "avengers-endgame", "firefly", "marvel", "star-trek"], "nothing else"


def test_a_row_holds_the_registry_values_in_one_key_order(tmp_path):
    rows = {r["id"]: r for r in block_of(tmp_path, [ENDGAME, DDAL])["works"]}
    # not the registry's order, which puts parent before terms and reviewed; no type, no family
    assert list(rows["avengers-endgame"]) == ["id", "name", "aliases", "terms", "reviewed", "parent"]
    assert rows["avengers-endgame"] == {"id": "avengers-endgame", "name": "Avengers: Endgame", "aliases": ["Endgame"],
                                        "terms": ["Thanos"], "reviewed": True, "parent": "avengers"}
    # aliases and terms always, [] where the registry holds none; parent only where it has one
    assert rows["avengers"] == {"id": "avengers", "name": "Avengers", "aliases": [], "terms": [], "reviewed": False,
                                "parent": "marvel"}
    assert list(rows["marvel"]) == ["id", "name", "aliases", "terms", "reviewed"]
    assert rows["marvel"] == {"id": "marvel", "name": "Marvel", "aliases": ["MCU"], "terms": [], "reviewed": True}
    # a game's family stays in the registry
    assert rows["dungeons-and-dragons"] == {"id": "dungeons-and-dragons", "name": "Dungeons & Dragons",
                                            "aliases": ["D&D"], "terms": ["DDAL"], "reviewed": True}


def test_the_build_counts_the_block_and_its_ancestors_only(tmp_path):
    _, stats = built_doc(tmp_path, [ENDGAME, TREK_TRACK], **BLOCK_REG)
    assert stats["block"] == {"rows": 4, "ancestors_only": 2, "registry": len(BLOCK_WORKS)}


# --- the file ----------------------------------------------------------------

def test_the_v1_tags_object_is_gone_and_the_keys_are_in_schema_order(tmp_path):
    play = {"format": "demo", "level": "beginner"}
    events, _ = built(tmp_path, [
        (ev("Castle Cast", speakers=[("Nathan Fillion", "Speaker")]), answer(kind="qa", works=["Castle"], medium=["tv"])),
        (ev("Wingspan Demo", type="gaming", tags=False), answer(kind="gaming", play=play))])
    scraped = ["id", "type", "title", "day", "start", "end", "duration_min", "location", "hotel", "room",
               "description", "tracks", "track", "speakers", "cancelled"]
    assert [list(e) for e in events] == [scraped + ["people", "facets", "tags"]] * 2
    assert events[0]["tags"] == {"kind": "qa", "works": [{"id": "castle", "via": "about"},
                                                         {"id": "firefly", "via": "credit:nathan-fillion"}],
                                 "medium": ["tv"], "genre": [], "craft": [], "subject": [], "audience": "all",
                                 "guests": "celebrity"}
    assert list(events[0]["tags"]) == ["kind", "works", "medium", "genre", "craft", "subject", "audience", "guests"]
    assert list(events[1]["tags"]) == ["kind", "works", "medium", "genre", "craft", "subject", "audience", "play"]
    assert not {"fandoms", "topics", "adult"} & set(events[0]["tags"])


def test_every_top_level_field_is_copied_as_it_is_and_works_comes_before_events(tmp_path):
    event = ev("A Panel")
    data = {"generated_at": "2026-09-07T12:50:19+00:00", "changed_at": "2026-09-06T00:00:00+00:00",
            "source": "fixture", "count": 1, "failures": 0, "events": [event]}
    doc, _ = v2.build(data, reg_with(tmp_path), cache_for([(event, answer())]))
    assert list(doc) == ["generated_at", "changed_at", "source", "count", "failures", "works", "events"]
    assert all(doc[k] == data[k] for k in data if k != "events")


def test_a_works_key_in_the_input_gives_way_to_the_block(tmp_path):
    event = ev("Trek Track Meetup", tracks=["Trek Track"])
    block = [{"id": "star-trek", "name": "Star Trek", "aliases": [], "terms": [], "reviewed": True}]
    at = "2026-09-07T12:50:19+00:00"
    # before events or after it, the input's works is dropped; a field after events stays after it
    for data, order in [({"works": ["not the block"], "generated_at": at, "events": [event]},
                         ["generated_at", "works", "events"]),
                        ({"generated_at": at, "events": [event], "works": ["not the block"], "failures": 0},
                         ["generated_at", "works", "events", "failures"])]:
        doc, _ = v2.build(data, reg_with(tmp_path), cache_for([(event, answer())]))
        assert list(doc) == order and doc["works"] == block


def _write_inputs(tmp_path):
    pairs = [(ev("Castle Cast", "Bring your questions! Additional Panelists: Jim Wert(Moderator)",
                 speakers=[("Nathan Fillion", "Speaker"), ("Seamus Dever", "Speaker")]),
              answer(kind="qa", works=["Castle"], medium=["tv"])),
             (ev("Pokémon Trivia", "Gotta catch ’em all.(Mature Audience)", tracks=["Kids Track", "Filk Music"]),
              answer(kind="contest", audience="kids", subject=["fandom-culture"])),
             (ev("Sew a Beret - $$ 12:45p-2:45p SOLD OUT", "Bring fabric.", start="2026-09-05T12:45"),
              answer(kind="workshop", craft=["costuming"])),
             (ev("Sew a Beret - $$ 3:00-5:00p", "Bring fabric.", start="2026-09-05T15:00", id="beret-2"),
              answer(kind="workshop", craft=["costuming"]))]
    reg_with(tmp_path)
    source = tmp_path / "events.json"
    source.write_text(json.dumps({"generated_at": "2026-09-07T12:50:19+00:00", "events": [e for e, _ in pairs]}),
                      encoding="utf-8")
    ts.write_cache(str(tmp_path / "tags.cache.jsonl"), cache_for(pairs))
    return ["--events", str(source), "--registry", str(tmp_path / "registry"),
            "--cache", str(tmp_path / "tags.cache.jsonl")]


def test_two_hash_seeds_give_the_same_bytes_and_the_input_is_untouched(tmp_path):
    args = _write_inputs(tmp_path)
    source = tmp_path / "events.json"
    before = source.read_bytes()
    written = []
    for seed in ("0", "1"):
        out = tmp_path / f"events.v2-{seed}.json"
        subprocess.run([sys.executable, "events_v2.py", *args, "--out", str(out)], cwd=ROOT, check=True,
                       capture_output=True, env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(out.read_bytes())
    assert written[0] == written[1] and source.read_bytes() == before
    assert written[0].endswith(b"}\n") and b"\r" not in written[0] and "Pokémon".encode() in written[0]
    doc = json.loads(written[0])
    assert doc["events"][1]["facets"] == {"mature": True} and doc["events"][1]["tags"]["audience"] == "mature"
    assert [e["facets"].get("repeat_key") for e in doc["events"][2:]] == ["sew a beret"] * 2
    assert [p["id"] for p in doc["events"][0]["people"]] == ["nathan-fillion", "seamus-dever", "jim-wert"]


def test_check_is_1_for_a_stale_file_and_0_for_a_fresh_one(tmp_path):
    args = _write_inputs(tmp_path)
    out = str(tmp_path / "events.v2.json")
    assert v2.main(args + ["--out", out, "--check"]) == 1           # absent
    assert v2.main(args + ["--out", out]) == 0
    assert v2.main(args + ["--out", out, "--check"]) == 0
    with open(out, "ab") as f:
        f.write(b" ")
    assert v2.main(args + ["--out", out, "--check"]) == 1


def test_the_build_never_writes_over_its_input(tmp_path):
    args = _write_inputs(tmp_path)
    before = (tmp_path / "events.json").read_bytes()
    with pytest.raises(SystemExit):
        v2.main(args + ["--out", str(tmp_path / "events.json")])
    assert (tmp_path / "events.json").read_bytes() == before


# --- the committed file --------------------------------------------------------

def test_the_committed_events_v2_is_a_fresh_build():
    """data/2026/events.v2.json is exactly what the frozen schedule, the committed registries and the
    committed tag cache build today, with no model: an edit to any of them with no rebuild after it
    fails here, in CI's pipeline job, rather than shipping a stale file."""
    with open(os.path.join(ROOT, ts.EVENTS), "rb") as f:
        data = json.loads(f.read().decode("utf-8"))
    doc, _ = v2.build(data, registry.load(os.path.join(ROOT, registry.DIR)),
                      ts.load_cache(os.path.join(ROOT, ts.CACHE)))
    with open(os.path.join(ROOT, v2.OUT), "rb") as f:
        committed = f.read()
    assert v2.dumps(doc) == committed, "stale: run `python events_v2.py` and commit the result"
