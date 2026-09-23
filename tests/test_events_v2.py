"""Tests for events_v2.py: the works and axes merge, what the build tolerates and counts and what still stops it, the
frozen and live front doors, the file's shape, its digest and its lines, and that a build is the same bytes every time
and never touches its input. Registries, venues, seasons, ledgers, caches and events are inline fixtures written to
tmp_path, and nothing calls a model; the last test alone reads data/, to hold the committed events.v2.json to a fresh
build of the committed inputs.

Run:  python -m pytest tests/
"""
import copy
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import draft_people as dp  # noqa: E402
import events_v2 as v2  # noqa: E402
import ids_stage  # noqa: E402
import merge_stage  # noqa: E402
import registry  # noqa: E402
import tag_key  # noqa: E402
import venues  # noqa: E402
from season import load as load_season  # noqa: E402

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


def level(lid, name, order, rooms):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": {}, "notes": []}


def hotel(name, order, keys, levels=(), placeless=False):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": "rest", "levels": list(levels), "unplaced": {}}


VENUES_DATA = {"walk": {"Marriott|Courtland Grand": 10}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10,
               "hotels": [hotel("Marriott", 0, ["Marriott"], [level("atrium", "Atrium Level", 0, ["A", "A707"])]),
                          hotel("Courtland Grand", 1, ["Courtland Grand", "Courtland"],
                                [level("grand", "Grand Level", 0, ["Athens"])]),
                          hotel("Streaming", 2, ["Streaming"], placeless=True),
                          hotel("Other", 3, ["O", "Other"], placeless=True),
                          hotel("Unknown", 4, [], placeless=True)]}
VENUES = venues.check(VENUES_DATA)
AT = "2026-09-07T12:50:19+00:00"
VERSION = 1   # the fixtures' prompt_version, as 2026's season has it (#46)
PLACED = list(merge_stage.FIELDS) + ["id", "source_id", "hotel", "room", "level", "rooms", "place", "track",
                                     "cancelled", "people", "facets"]


def ev(title, description="", tracks=("Main Programming",), type="panel", speakers=(), id=None,
       start="2026-09-05T11:30", tags=True, location="Marriott A"):
    tracks = list(tracks)
    out = {"id": id or title.lower().replace(" ", "-"), "type": type, "title": title, "day": start[:10],
           "start": start, "end": start, "duration_min": 60, "location": location, "hotel": "Marriott",
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
    dp.write_json(str(d / "works.json"), [dp.in_order(w, registry.WORK_KEYS) for w in works])
    dp.write_json(str(d / "people.json"), list(people))
    dp.write_json(str(d / "tracks.json"), list(tracks))
    return registry.load(str(d))


def cache_for(pairs, version=VERSION):
    """{key: entry} for [(event, answer)], as the tag stage writes them, keyed under `version`."""
    out = {}
    for event, a in pairs:
        inp = tag_key.tagger_input(event)
        key = tag_key.input_key(inp, version)
        out[key] = {"key": key, "title": inp["title"], "model": "m", "answer": a}
    return out


def built_doc(tmp_path, pairs, **reg):
    """The whole v2 document for [(event, answer)], through the frozen front door, and the build's report."""
    rows, top = v2.frozen({"generated_at": AT, "events": [e for e, _ in pairs]})
    return v2.build(rows, top, reg_with(tmp_path, **reg), cache_for(pairs), VENUES, version=VERSION)


def built(tmp_path, pairs, **reg):
    """The v2 events for [(event, answer)], and the build's report."""
    doc, report = built_doc(tmp_path, pairs, **reg)
    return doc["events"], report


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
    events, report = built(tmp_path, [(event, answer(kind="gaming", works=["DDAL", "Dungeons & Dragons"]))])
    assert events[0]["tags"]["works"] == [{"id": "dungeons-and-dragons", "via": "about"}]
    assert report["terms"] == {"DDAL": 1} and report["unresolved_names"] == {}


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
    events, report = built(tmp_path, [(ev("Monster Mash", tracks=["Kids Track"]), answer(audience="mature"))])
    assert events[0]["tags"]["audience"] == "mature" and report["kids_track_mature"] == ["Monster Mash"]


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


# --- what the build tolerates, and counts --------------------------------------

def test_a_cache_miss_ships_the_event_untagged_and_counts_it(tmp_path):
    cached, missing = ev("Castle Cast"), ev("Firefly Reunion", tracks=["Trek Track"])
    rows, top = v2.frozen({"generated_at": AT, "events": [cached, missing]})
    doc, report = v2.build(rows, top, reg_with(tmp_path), cache_for([(cached, answer(works=["Castle"]))]), VENUES,
                           version=VERSION)
    got = {e["title"]: e for e in doc["events"]}
    assert "tags" not in got["Firefly Reunion"], "an untagged event carries no tags key at all (#46)"
    assert list(got["Firefly Reunion"]) == PLACED and got["Firefly Reunion"]["place"] == "exact"   # the rest is built
    assert got["Castle Cast"]["tags"]["works"] == [{"id": "castle", "via": "about"}]
    assert report["untagged"] == ["Firefly Reunion"]
    # the block is the tagged events' works: the untagged event's track work, star-trek, is not in it
    assert [w["id"] for w in doc["works"]] == ["castle"]


def test_an_unresolved_work_name_drops_its_link_and_is_counted_by_links(tmp_path):
    events, report = built(tmp_path, [(ev("Monk Q&A"), answer(works=["Monk", "Castle"])),
                                      (ev("Monk Reunion"), answer(works=["Monk"]))])
    assert [e["tags"]["works"] for e in events] == [[{"id": "castle", "via": "about"}], []]
    assert report["unresolved_names"] == {"Monk": 2} and report["untagged"] == []


def test_an_unknown_track_keeps_its_name_with_no_axes_and_no_work(tmp_path):
    event = ev("Weaving Circle", tracks=["Underwater Basket Weaving", "Filk Music"])
    events, report = built(tmp_path, [(event, answer(medium=["tv"], genre=["horror"]))])
    got = events[0]
    assert (got["tracks"], got["track"]) == (["Underwater Basket Weaving", "Filk Music"], "Underwater Basket Weaving")
    # Filk Music decides the medium; the unknown track decides nothing, so the model's genre stands
    assert (got["tags"]["medium"], got["tags"]["genre"], got["tags"]["works"]) == (["music"], ["horror"], [])
    assert report["unknown_tracks"] == {"Underwater Basket Weaving": 1}


def test_every_degradation_is_counted_in_one_build(tmp_path):
    first, second = ev("Monk Q&A", tracks=["Nowhere"]), ev("Uncached", tracks=["Nowhere", "Elsewhere"])
    rows, top = v2.frozen({"generated_at": AT, "events": [first, second]})
    doc, report = v2.build(rows, top, reg_with(tmp_path), cache_for([(first, answer(works=["Monk"]))]), VENUES,
                           version=VERSION)
    assert [e["title"] for e in doc["events"]] == ["Monk Q&A", "Uncached"]
    assert (report["untagged"], report["unresolved_names"], report["unknown_tracks"]) == (
        ["Uncached"], {"Monk": 1}, {"Elsewhere": 1, "Nowhere": 2})
    assert (report["rooms_unresolved"], report["hotels_unknown"], report["places"]["exact"]) == (0, 0, 2)


# --- what stops a build ----------------------------------------------------------

def test_a_row_with_no_id_stops_the_build(tmp_path):
    rows, top = v2.frozen({"generated_at": AT, "events": [ev("Castle Cast"), ev("Firefly Reunion")]})
    del rows[1]["id"]
    with pytest.raises(v2.BuildError) as exc:
        v2.build(rows, top, reg_with(tmp_path), {}, VENUES, version=VERSION)
    assert "1 row(s) with no id" in str(exc.value) and "firefly-reunion" in str(exc.value)


def test_a_registry_a_venues_file_or_a_cache_that_fails_to_load_stops_the_build(tmp_path):
    args = frozen_folder(tmp_path)
    season, folder, reg = load_season(args[1]), os.path.dirname(args[1]), args[3]
    assert v2.build_season(season, folder, reg)[0]["events"]
    for path, broken, prefix in [(tmp_path / "registry" / "works.json", "[]x", "the registries: "),
                                 (tmp_path / "2026" / "venues.json", json.dumps({**VENUES_DATA, "extra": 1}),
                                  "the venues file: "),
                                 (tmp_path / "2026" / "tags.cache.jsonl", '{"not": "an entry"}\n', "the tag cache: ")]:
        good = path.read_bytes()
        path.write_text(broken, encoding="utf-8")
        with pytest.raises(v2.BuildError) as exc:
            v2.build_season(season, folder, reg)
        assert prefix in str(exc.value), prefix
        path.write_bytes(good)


# --- the frozen front door -----------------------------------------------------------

def test_the_frozen_front_door_makes_each_event_a_raw_row_its_id_its_source_id(tmp_path):
    cancelled = ev("CANCELLED: Trek Trivia", tracks=["Trek Track", "Filk Music"], location="Courtland Grand Athens")
    data = {"generated_at": AT, "changed_at": "2026-09-06T00:00:00+00:00", "source": "fixture", "count": 2,
            "failures": 0, "events": [cancelled, {**ev("Trek Trivia Night", tracks=[]), "cancelled": True}]}
    before = copy.deepcopy(data)
    rows, top = v2.frozen(data)
    assert data == before
    assert top == {k: data[k] for k in ("generated_at", "changed_at", "source", "count", "failures")}  # a count
    assert [r["source_id"] for r in rows] == [r["id"] for r in rows] == ["cancelled:-trek-trivia", "trek-trivia-night"]
    for r, e in zip(rows, data["events"]):
        assert set(r) == {"source_id", "id", *merge_stage.FIELDS}      # v1's hotel, room, track, cancelled, tags gone
        assert {k: r[k] for k in merge_stage.FIELDS} == {k: e[k] for k in merge_stage.FIELDS}
    doc, _ = v2.build(rows, top, reg_with(tmp_path), cache_for([(e, answer()) for e in data["events"]]), VENUES,
                      version=VERSION)
    first, second = doc["events"]
    # the place is the venues step's reading of the location, not v1's hotel and room
    assert {k: first[k] for k in v2.PLACE} == {"hotel": "Courtland Grand", "room": "Athens", "level": "grand",
                                              "rooms": ["Athens"], "place": "exact"}
    assert (first["track"], first["cancelled"]) == ("Trek Track", True)       # the rule reads the title
    assert (second["track"], second["cancelled"]) == (None, False)            # no tracks; v1's flag is not read
    assert (second["hotel"], second["room"], second["level"], second["place"]) == ("Marriott", "A", "atrium", "exact")


def test_the_v1_tags_object_is_gone_and_the_keys_are_in_the_file_s_order(tmp_path):
    play = {"format": "demo", "level": "beginner"}
    events, _ = built(tmp_path, [
        (ev("Castle Cast", speakers=[("Nathan Fillion", "Speaker")]), answer(kind="qa", works=["Castle"], medium=["tv"])),
        (ev("Wingspan Demo", type="gaming", tags=False), answer(kind="gaming", play=play))])
    assert [list(e) for e in events] == [PLACED + ["tags"]] * 2
    assert events[0]["tags"] == {"kind": "qa", "works": [{"id": "castle", "via": "about"},
                                                         {"id": "firefly", "via": "credit:nathan-fillion"}],
                                 "medium": ["tv"], "genre": [], "craft": [], "subject": [], "audience": "all",
                                 "guests": "celebrity"}
    assert list(events[0]["tags"]) == ["kind", "works", "medium", "genre", "craft", "subject", "audience", "guests"]
    assert list(events[1]["tags"]) == ["kind", "works", "medium", "genre", "craft", "subject", "audience", "play"]
    assert not {"fandoms", "topics", "adult"} & set(events[0]["tags"])


def test_every_top_level_field_is_copied_as_it_is_then_the_digest_the_works_and_the_events(tmp_path):
    event = ev("A Panel")
    data = {"generated_at": AT, "changed_at": "2026-09-06T00:00:00+00:00", "source": "fixture", "count": 1,
            "failures": 0, "events": [event]}
    doc, _ = v2.build(*v2.frozen(data), reg_with(tmp_path), cache_for([(event, answer())]), VENUES, version=VERSION)
    assert list(doc) == ["generated_at", "changed_at", "source", "count", "failures", "digest", "works", "events"]
    assert all(doc[k] == data[k] for k in data if k != "events")


def test_a_works_key_or_a_digest_in_the_input_gives_way_to_the_build_s(tmp_path):
    event = ev("Trek Track Meetup", tracks=["Trek Track"])
    block = [{"id": "star-trek", "name": "Star Trek", "aliases": [], "terms": [], "reviewed": True}]
    # before events or after them, the input's works and digest are dropped; every other field keeps its place
    for data, order in [({"works": ["not the block"], "generated_at": AT, "events": [event]},
                         ["generated_at", "digest", "works", "events"]),
                        ({"generated_at": AT, "events": [event], "works": ["not the block"], "failures": 0,
                          "digest": "not ours"}, ["generated_at", "failures", "digest", "works", "events"])]:
        assert not {"works", "digest", "events"} & set(v2.frozen(data)[1])
        doc, _ = v2.build(*v2.frozen(data), reg_with(tmp_path), cache_for([(event, answer())]), VENUES,
                          version=VERSION)
        assert list(doc) == order and doc["works"] == block and doc["digest"] != "not ours"


# --- the digest and the lines ------------------------------------------------------

def test_the_digest_is_the_works_and_the_events_as_the_file_writes_them(tmp_path):
    doc, _ = built_doc(tmp_path, [ENDGAME, TREK_TRACK, FILLION], **BLOCK_REG)
    text = v2.dumps(doc).decode("utf-8")
    written = text[text.index('"works":'):-len("}\n")]     # the file's own text of the two lists
    assert doc["digest"] == hashlib.sha256(("{" + written + "}").encode("utf-8")).hexdigest()
    assert len(doc["digest"]) == 64 and set(doc["digest"]) <= set("0123456789abcdef")


def test_the_digest_changes_if_and_only_if_the_works_or_the_events_do(tmp_path):
    pairs = [ENDGAME, TREK_TRACK]
    doc, _ = built_doc(tmp_path, pairs, **BLOCK_REG)
    # the stamps, the source, the count and the failures are not in it
    other = {"generated_at": "2027-01-01T00:00:00+00:00", "changed_at": "2027-01-02T00:00:00+00:00",
             "source": "elsewhere", "count": 99, "failures": 3, "events": [e for e, _ in pairs]}
    again, _ = v2.build(*v2.frozen(other), reg_with(tmp_path, **BLOCK_REG), cache_for(pairs), VENUES, version=VERSION)
    assert again["events"] == doc["events"] and again["digest"] == doc["digest"]
    # an event changes: another digest
    retitled = [(dict(ENDGAME[0], title="Endgame Rewatch, Again"), ENDGAME[1]), TREK_TRACK]
    assert built_doc(tmp_path, retitled, **BLOCK_REG)[0]["digest"] != doc["digest"]
    # a works row changes and no event does - an alias on an ancestor: another digest
    works = [dict(w, aliases=["MCU", "Marvel Comics"]) if w["id"] == "marvel" else w for w in BLOCK_WORKS]
    edited, _ = built_doc(tmp_path, pairs, works=works, people=BLOCK_PEOPLE, tracks=BLOCK_TRACKS)
    assert edited["events"] == doc["events"] and edited["works"] != doc["works"] and edited["digest"] != doc["digest"]


def test_the_file_is_compact_with_one_works_row_and_one_event_a_line(tmp_path):
    doc, _ = built_doc(tmp_path, [ENDGAME, TREK_TRACK, FILLION], **BLOCK_REG)
    body = v2.dumps(doc)
    assert body.endswith(b"]}\n") and b"\r" not in body and json.loads(body) == doc
    assert body.replace(b"\n", b"") == json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    lines = body.decode("utf-8").split("\n")
    works, events = len(doc["works"]), len(doc["events"])
    assert len(lines) == 1 + works + events + 1 and lines[-1] == ""
    assert lines[0].startswith('{"generated_at":') and lines[0].endswith(',"works":[')
    assert all(line.startswith('{"id":') for line in lines[1:1 + works])
    assert lines[works].endswith('}],"events":[')
    assert all(line.startswith('{"type":') for line in lines[1 + works:-1])
    assert v2.dumps({"works": [], "events": []}) == b'{"works":[],"events":[]}\n'


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
    _, report = built_doc(tmp_path, [ENDGAME, TREK_TRACK], **BLOCK_REG)
    assert report["block"] == {"rows": 4, "ancestors_only": 2, "registry": len(BLOCK_WORKS)}


# --- the live front door -------------------------------------------------------

SEASON_2026 = {"year": 2026, "slug": "dragoncon26", "source": "https://app.core-apps.com/dragoncon26",
               "days": ["Sep  5"], "con": {"first": "2026-09-02", "last": "2026-09-07"}, "tz": "America/New_York",
               "window": None, "frozen": True, "prompt_version": 1,
               "thresholds": {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}}
SEASON_2027 = {**SEASON_2026, "year": 2027, "slug": "dragoncon27", "source": "https://app.core-apps.com/dragoncon27",
               "days": ["Sep  4"], "con": {"first": "2027-09-01", "last": "2027-09-06"},
               "window": {"from": "2027-08-01", "to": "2027-09-07"}, "frozen": False}
T1, T2 = "2027-08-01T10:00:00+00:00", "2027-08-02T10:00:00+00:00"


def raw(sid, title="Castle Cast", location="Marriott A", **flags):
    """A raw row (#42), with `stale` or `removed` where given true."""
    out = {"source_id": sid, "type": "panel", "title": title, "day": "2027-09-04", "start": "2027-09-04T11:30",
           "end": "2027-09-04T12:30", "duration_min": 60, "location": location, "description": "",
           "tracks": ["Main Programming"], "speakers": []}
    return {**out, **{k: True for k, on in flags.items() if on}}


def live_folder(tmp_path, fetched=lambda rows: rows, run=True):
    """A live year after its second run. The first saw a1, b2, c3 and d4; by the second, b2 had moved into a1's room,
    so b2's id merged into a1's; c3's listing was gone, carried removed; d4's page failed, carried stale; and e5's page
    failed with no row to carry. The ledger is the ids stage's after both runs, the cache answers Castle Cast alone,
    and last-run.json holds the second run's fetched_at and the first's changed_at. `fetched` makes source.json's rows
    from the second run's: a fetch the ids stage has not yet seen. -> the season file's path."""
    folder = tmp_path / "2027"
    folder.mkdir(parents=True)
    first = [raw("a1"), raw("b2", location="Marriott A707"), raw("c3", "Firefly Reunion"), raw("d4", "Trek Trivia")]
    second = [raw("a1"), raw("b2"), raw("c3", "Firefly Reunion", removed=True), raw("d4", "Trek Trivia", stale=True)]
    ledger = ids_stage.assign(first, {}, T1, SEASON_2027["thresholds"]).ledger
    ledger = ids_stage.assign(second, ledger, T2, SEASON_2027["thresholds"]).ledger
    (folder / "season.json").write_text(json.dumps(SEASON_2027), encoding="utf-8")
    (folder / "venues.json").write_text(json.dumps(VENUES_DATA), encoding="utf-8")
    source = {"source": SEASON_2027["source"], "failures": [{"source_id": "e5", "error": "404 Client Error"}],
              "rows": fetched(second)}
    (folder / "source.json").write_text(json.dumps(source), encoding="utf-8")
    ids_stage.write_ledger(str(folder / "ids.jsonl"), ledger)
    if run:
        (folder / "last-run.json").write_text(json.dumps({"fetched_at": T2, "changed_at": T1}), encoding="utf-8")
    castle = {**raw("a1"), "id": "a1"}
    tag_key.write_cache(str(folder / "tags.cache.jsonl"), cache_for([(castle, answer(works=["Castle"]))]))
    reg_with(tmp_path)
    return folder / "season.json"


def build_live(tmp_path, season):
    return v2.build_season(load_season(str(season)), str(season.parent), str(tmp_path / "registry"))


def test_a_live_year_builds_from_source_json_the_ledger_and_last_run(tmp_path):
    doc, report = build_live(tmp_path, live_folder(tmp_path))
    assert list(doc) == ["generated_at", "changed_at", "source", "count", "failures", "digest", "works", "events"]
    assert (doc["generated_at"], doc["changed_at"], doc["source"]) == (T2, T1, SEASON_2027["source"])
    assert doc["failures"] == [{"source_id": "e5", "error": "404 Client Error"}]
    events = {e["id"]: e for e in doc["events"]}
    assert list(events) == ["a1", "c3", "d4"] and doc["count"] == 3        # the removed event is counted
    # a1 holds b2's row now, and carries b2's id in was; c3 is removed and d4 stale, each flag last
    assert (events["a1"]["source_id"], events["a1"]["was"]) == ("a1", ["b2"])
    assert list(events["a1"]) == PLACED + ["tags", "was"] and events["a1"]["tags"]["works"] == [
        {"id": "castle", "via": "about"}]
    assert list(events["c3"]) == PLACED + ["removed"] and events["c3"]["removed"] is True
    assert list(events["d4"]) == PLACED + ["stale"] and events["d4"]["stale"] is True
    assert report["untagged"] == ["Firefly Reunion", "Trek Trivia"]


def test_an_event_s_flags_come_last_removed_or_stale_then_was(tmp_path):
    # a row carries one flag at most (#42); was can join either
    rows = [{**raw("a1", removed=True), "id": "a1"}, {**raw("c3", "Trek Trivia", stale=True), "id": "c3"}]
    ledger = {"a1": {}, "b2": {"merged_into": "a1"}, "c3": {}, "d4": {"merged_into": "c3"}}
    doc, _ = v2.build(rows, {"generated_at": T2}, reg_with(tmp_path), {}, VENUES, ledger, version=VERSION)
    assert [list(e)[len(PLACED):] for e in doc["events"]] == [["removed", "was"], ["stale", "was"]]
    assert [e["was"] for e in doc["events"]] == [["b2"], ["d4"]]


def test_a_live_year_whose_ledger_would_change_refuses_run_the_ids_stage_first(tmp_path):
    # d4 retitled at the source: its line's key would move, with no new id
    retitled = live_folder(tmp_path / "retitled", lambda rows: [
        dict(r, title="Trek Trivia Night") if r["source_id"] == "d4" else r for r in rows])
    with pytest.raises(v2.BuildError, match="run the ids stage first"):
        build_live(tmp_path / "retitled", retitled)
    # a listing no line holds: here, one new id of four lines, the ids stage's own ceiling refuses it first
    added = live_folder(tmp_path / "added", lambda rows: rows + [raw("f6", "A Panel No Ledger Holds")])
    with pytest.raises(v2.BuildError, match="the ids stage refuses these rows: 1 new id"):
        build_live(tmp_path / "added", added)


def test_a_live_year_needs_a_run(tmp_path):
    season = live_folder(tmp_path, run=False)
    with pytest.raises(v2.BuildError, match="a live year needs a run"):
        build_live(tmp_path, season)


def test_a_live_year_refuses_another_source_s_rows_and_a_run_with_no_stamps(tmp_path):
    season = live_folder(tmp_path)
    source = json.loads((season.parent / "source.json").read_text(encoding="utf-8"))
    (season.parent / "source.json").write_text(json.dumps({**source, "source": "https://example.test/other"}),
                                               encoding="utf-8")
    with pytest.raises(v2.BuildError, match="not the season's"):
        build_live(tmp_path, season)
    (season.parent / "source.json").write_text(json.dumps(source), encoding="utf-8")
    (season.parent / "last-run.json").write_text(json.dumps({"fetched_at": T2}), encoding="utf-8")
    with pytest.raises(v2.BuildError, match="holds no fetched_at and changed_at"):
        build_live(tmp_path, season)


def test_a_live_year_is_checked_here_and_written_only_outside_its_folder(tmp_path, capsys):
    season = live_folder(tmp_path)
    args = ["--season", str(season), "--registry", str(tmp_path / "registry")]
    with pytest.raises(SystemExit) as exc:
        v2.main(args)
    assert "the orchestrator's to write" in str(exc.value.code) and not (season.parent / "events.v2.json").exists()
    assert v2.main(args + ["--check"]) == 1                                # nothing there yet, and nothing written
    assert "the orchestrator writes it" in capsys.readouterr().err and not (season.parent / "events.v2.json").exists()
    copy_path = tmp_path / "look" / "events.v2.json"
    copy_path.parent.mkdir()
    assert v2.main(args + ["--out", str(copy_path)]) == 0 and copy_path.exists()
    (season.parent / "events.v2.json").write_bytes(copy_path.read_bytes())   # as the orchestrator would write it
    assert v2.main(args + ["--check"]) == 0


# --- the command -----------------------------------------------------------------

def frozen_folder(tmp_path):
    """A frozen year's folder - season.json, the raw events.json, venues.json and the tag cache - and the registry
    beside it. -> main()'s arguments."""
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
    folder = tmp_path / "2026"
    folder.mkdir()
    (folder / "season.json").write_text(json.dumps(SEASON_2026), encoding="utf-8")
    (folder / "venues.json").write_text(json.dumps(VENUES_DATA), encoding="utf-8")
    (folder / "events.json").write_text(json.dumps({"generated_at": AT, "events": [e for e, _ in pairs]}),
                                        encoding="utf-8")
    tag_key.write_cache(str(folder / "tags.cache.jsonl"), cache_for(pairs))
    return ["--season", str(folder / "season.json"), "--registry", str(tmp_path / "registry")]


def test_two_hash_seeds_give_the_same_bytes_and_the_input_is_untouched(tmp_path):
    args = frozen_folder(tmp_path)
    source = tmp_path / "2026" / "events.json"
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
    args = frozen_folder(tmp_path)
    out = tmp_path / "2026" / "events.v2.json"                            # beside the season, by default
    assert v2.main(args + ["--check"]) == 1 and not out.exists()          # absent
    assert v2.main(args) == 0
    assert v2.main(args + ["--check"]) == 0
    with open(out, "ab") as f:
        f.write(b" ")
    assert v2.main(args + ["--check"]) == 1


def test_the_build_never_writes_over_its_input(tmp_path):
    args = frozen_folder(tmp_path)
    folder = tmp_path / "2026"
    for name in ("events.json", "season.json", "venues.json", "tags.cache.jsonl"):
        before = (folder / name).read_bytes()
        with pytest.raises(SystemExit):
            v2.main(args + ["--out", str(folder / name)])
        assert (folder / name).read_bytes() == before, name


def test_the_hints_name_the_season_the_tag_stage_runs_on():
    """The default season, 2026's, is frozen and the tag stage refuses it (#46): a hint names the season file."""
    report = {"places": {}, "rooms_unresolved": 0, "hotels_unknown": 0, "untagged": ["Castle Cast"],
              "unresolved_names": {"The Rookie": 1}, "unknown_tracks": {}}
    lines = v2.degradations(report, "data/2027/season.json")
    assert "  untagged - run `python tag_stage.py --season data/2027/season.json`: Castle Cast" in lines
    assert ("  work names unresolved - run `python tag_stage.py --season data/2027/season.json --mint-only`: "
            "'The Rookie' (1)") in lines


def test_the_cache_is_read_by_the_season_s_prompt_version(tmp_path):
    """The key holds the season's prompt_version (#46): a cache keyed under another answers no event."""
    frozen_folder(tmp_path)
    folder = tmp_path / "2026"
    events = json.loads((folder / "events.json").read_text(encoding="utf-8"))["events"]

    def build(version):
        (folder / "season.json").write_text(json.dumps({**SEASON_2026, "prompt_version": version}), encoding="utf-8")
        return v2.build_season(load_season(str(folder / "season.json")), str(folder), str(tmp_path / "registry"))

    assert build(VERSION)[1]["untagged"] == []
    doc, report = build(2)                                          # the cache holds version 1's keys alone
    assert len(report["untagged"]) == 4 and not any("tags" in e for e in doc["events"])
    tag_key.write_cache(str(folder / "tags.cache.jsonl"), cache_for([(e, answer()) for e in events], version=2))
    assert build(2)[1]["untagged"] == [] and build(VERSION)[1]["untagged"] != []


# --- the committed file --------------------------------------------------------

def test_the_committed_events_v2_is_a_fresh_build():
    """data/2026/events.v2.json is exactly what the frozen schedule, the committed registries, venues file and tag cache
    build today, with no model: an edit to any of them with no rebuild after it fails here, in CI's pipeline job,
    rather than shipping a stale file."""
    path = os.path.join(ROOT, v2.SEASON)
    doc, _ = v2.build_season(load_season(path), os.path.dirname(path), os.path.join(ROOT, registry.DIR))
    with open(os.path.join(ROOT, v2.OUT), "rb") as f:
        committed = f.read()
    assert v2.dumps(doc) == committed, "stale: run `python events_v2.py` and commit the result"
