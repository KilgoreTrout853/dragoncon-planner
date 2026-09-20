"""Tests for registry.py: one failing fixture per rule, the slug and resolve functions, and the real files.

The fixtures are inline and written to pytest's tmp_path. The last test loads the committed
`data/registry/` and expects it to be valid, so that CI checks every later edit to it.

Run:  python -m pytest tests/
"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import registry  # noqa: E402

WORK = {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": False}
TRACK = {"id": "filk-music", "name": "Filk Music", "aliases": ["Filk"], "axes": {"medium": ["music"]}}
PERSON = {"id": "nathan-fillion", "name": "Nathan Fillion", "aliases": [], "tier": "celebrity",
          "credits": [{"work": "firefly", "reviewed": True}]}


def write(tmp_path, works=None, people=None, tracks=None):
    """Three registries on disk. Anything not given is the smallest valid file."""
    for name, data in (("works.json", works if works is not None else [WORK]),
                       ("people.json", people if people is not None else []),
                       ("tracks.json", tracks if tracks is not None else [])):
        (tmp_path / name).write_text(json.dumps(data), encoding="utf-8")
    return str(tmp_path)


def problems(tmp_path, **files):
    """The problems `load` raises, or [] when it is happy."""
    try:
        registry.load(write(tmp_path, **files))
        return []
    except registry.RegistryError as exc:
        return exc.problems


def only(tmp_path, **files):
    """The one problem this fixture is built to produce."""
    found = problems(tmp_path, **files)
    assert len(found) == 1, found
    return found[0]


# --- the smallest valid registry -------------------------------------------

def test_three_valid_files_load(tmp_path):
    reg = registry.load(write(tmp_path, works=[WORK], people=[PERSON], tracks=[TRACK]))
    assert [w["id"] for w in reg.works] == ["firefly"]
    assert [t["id"] for t in reg.tracks] == ["filk-music"]
    assert [p["id"] for p in reg.people] == ["nathan-fillion"]


def test_an_empty_people_file_is_valid(tmp_path):
    assert registry.load(write(tmp_path, people=[])).people == []


# --- ids, names and keys ---------------------------------------------------

def test_an_id_must_be_a_slug(tmp_path):
    assert "is not a slug" in only(tmp_path, works=[{**WORK, "id": "Firefly"}])
    assert "is not a slug" in only(tmp_path, works=[{**WORK, "id": "fire--fly"}])
    assert "is not a slug" in only(tmp_path, works=[{**WORK, "id": "-firefly"}])


def test_an_id_is_unique_in_its_file(tmp_path):
    found = problems(tmp_path, works=[WORK, {**WORK, "name": "Serenity the Film", "aliases": []}])
    assert any("is already used at index 0" in p for p in found)


def test_a_name_is_required(tmp_path):
    assert "is missing or empty" in only(tmp_path, works=[{**WORK, "name": "  "}])


def test_no_two_entries_in_a_file_share_a_key(tmp_path):
    other = {"id": "serenity", "name": "Serenity", "type": "franchise", "reviewed": False}
    found = problems(tmp_path, works=[WORK, other])          # "Serenity" is Firefly's alias
    assert any("resolves to more than one entry" in p for p in found)


def test_a_leading_the_is_not_a_difference(tmp_path):
    wheel = {"id": "the-wheel-of-time", "name": "The Wheel of Time", "type": "franchise", "reviewed": False}
    other = {"id": "wheel-of-time", "name": "Wheel of Time", "type": "franchise", "reviewed": False}
    assert any("resolves to more than one entry" in p for p in problems(tmp_path, works=[wheel, other]))


# --- works -----------------------------------------------------------------

def test_a_works_type_is_franchise_or_game(tmp_path):
    assert "is not one of franchise, game" in only(tmp_path, works=[{**WORK, "type": "show"}])


def test_a_game_needs_a_family_and_only_a_game_has_one(tmp_path):
    assert "a game needs a family" in only(tmp_path, works=[{**WORK, "type": "game"}])
    assert "a game needs a family" in only(tmp_path, works=[{**WORK, "type": "game", "family": "cards"}])
    assert "is for a game" in only(tmp_path, works=[{**WORK, "family": "rpg"}])


def test_reviewed_is_a_bool(tmp_path):
    assert "is not true or false" in only(tmp_path, works=[{**WORK, "reviewed": "no"}])
    assert "is not true or false" in only(tmp_path, works=[{k: v for k, v in WORK.items() if k != "reviewed"}])


def test_a_parent_must_exist(tmp_path):
    assert "is not a work" in only(tmp_path, works=[{**WORK, "parent": "whedonverse"}])


def test_a_parent_cycle_is_found(tmp_path):
    a = {"id": "a", "name": "A", "type": "franchise", "reviewed": False, "parent": "b"}
    b = {"id": "b", "name": "B", "type": "franchise", "reviewed": False, "parent": "a"}
    assert "is a parent cycle" in only(tmp_path, works=[a, b])
    self_parent = {**WORK, "parent": "firefly"}
    assert "is a parent cycle" in only(tmp_path, works=[self_parent])


def test_a_term_may_not_also_be_a_name_or_an_alias(tmp_path):
    assert "is also the name or alias of" in only(tmp_path, works=[{**WORK, "terms": ["Serenity"]}])
    trek = {"id": "star-trek", "name": "Star Trek", "type": "franchise", "reviewed": False}
    found = problems(tmp_path, works=[{**WORK, "terms": ["Star Trek"]}, trek])
    assert any("is also the name or alias of" in p for p in found)


def test_a_term_need_not_be_unique(tmp_path):
    """One term may sit on several works: "whedon" is on Firefly, Buffy and Angel."""
    buffy = {"id": "buffy", "name": "Buffy", "type": "franchise", "reviewed": False, "terms": ["Whedon"]}
    reg = registry.load(write(tmp_path, works=[{**WORK, "terms": ["Whedon"]}, buffy]))
    assert reg.resolve_work("Whedon") is None      # and a term never resolves


# --- tracks ----------------------------------------------------------------

def test_a_tracks_axes_come_from_the_four_closed_lists(tmp_path):
    assert "is not an axis" in only(tmp_path, tracks=[{**TRACK, "axes": {"mood": ["music"]}}])
    assert "is not a value of medium" in only(tmp_path, tracks=[{**TRACK, "axes": {"medium": ["opera"]}}])
    assert "is not a value of subject" in only(tmp_path, tracks=[{**TRACK, "axes": {"subject": ["music"]}}])


def test_an_axis_holds_at_most_two_values(tmp_path):
    three = {**TRACK, "axes": {"medium": ["music", "tv", "film"]}}
    assert "at most 2" in only(tmp_path, tracks=[three])


def test_a_tracks_audience_is_kids_or_mature(tmp_path):
    assert "is not one of kids, mature" in only(tmp_path, tracks=[{**TRACK, "audience": "all"}])
    registry.load(write(tmp_path, tracks=[{**TRACK, "audience": "kids"}]))


def test_a_tracks_work_must_exist(tmp_path):
    assert "is not a work" in only(tmp_path, tracks=[{**TRACK, "work": "serenity"}])
    registry.load(write(tmp_path, tracks=[{**TRACK, "work": "firefly"}]))


# --- people ----------------------------------------------------------------

def test_a_tier_is_optional_and_closed(tmp_path):
    assert "is not one of celebrity, creator" in only(tmp_path, people=[{**PERSON, "tier": "fan"}])
    # An entry with no tier exists to carry aliases.
    reg = registry.load(write(tmp_path, people=[{"id": "ada-quill", "name": "Ada Quill", "aliases": ["A Quill"]}]))
    assert reg.resolve_person("Dr. A Quill") == "ada-quill"


def test_at_most_five_credits_each_pointing_at_a_work(tmp_path):
    six = {**PERSON, "credits": [{"work": "firefly", "reviewed": True}] * 6}
    assert "at most 5" in only(tmp_path, people=[six])
    assert "is not a work" in only(tmp_path, people=[{**PERSON, "credits": [{"work": "castle", "reviewed": True}]}])
    assert "is not {work, reviewed}" in only(tmp_path, people=[{**PERSON, "credits": [{"work": "firefly"}]}])
    assert "is not true or false" in only(
        tmp_path, people=[{**PERSON, "credits": [{"work": "firefly", "reviewed": "yes"}]}])


# --- one error, every problem ----------------------------------------------

def test_load_raises_once_and_lists_every_problem(tmp_path):
    found = problems(tmp_path,
                     works=[{"id": "Bad Id", "name": "", "type": "show", "reviewed": "no"}],
                     tracks=[{**TRACK, "work": "nowhere", "audience": "all"}],
                     people=[{**PERSON, "tier": "fan"}])
    assert len(found) >= 7, found
    assert found == sorted(found)                       # deterministic order
    with pytest.raises(registry.RegistryError) as exc:
        registry.load(str(tmp_path))
    assert str(len(found)) in str(exc.value) and "works.json" in str(exc.value)


def test_a_missing_or_broken_file_is_a_problem_not_a_crash(tmp_path):
    def broken(text):
        """The three files, then tracks.json replaced by something that is not a registry."""
        write(tmp_path)
        if text is None:
            os.remove(tmp_path / "tracks.json")
        else:
            (tmp_path / "tracks.json").write_text(text, encoding="utf-8")
        with pytest.raises(registry.RegistryError) as exc:
            registry.load(str(tmp_path))
        return exc.value.problems

    assert problems(tmp_path) == []
    assert any("is not JSON" in p for p in broken("{not json"))
    assert any("not a list of entries" in p for p in broken('{"filk": {}}'))
    assert any("cannot be read" in p for p in broken(None))


# --- slugs and resolution --------------------------------------------------

def test_work_slug_folds_to_hyphens_and_keeps_a_leading_the():
    assert registry.work_slug("The Expanse") == "the-expanse"
    assert registry.work_slug("Dungeons & Dragons") == "dungeons-and-dragons"
    assert registry.work_slug("Magic: The Gathering") == "magic-the-gathering"
    assert registry.work_slug("Warhammer 40,000") == "warhammer-40000"   # a comma in a number is not a separator
    assert registry.work_slug("Yu-Gi-Oh!") == "yu-gi-oh"
    assert registry.work_slug("Pokémon") == "pokemon"
    assert registry.work_slug("Pee Wee's Playhouse") == "pee-wees-playhouse"


def test_resolve_key_is_the_slug_without_a_leading_the():
    assert registry.resolve_key("The Wheel of Time") == registry.resolve_key("Wheel of Time") == "wheel-of-time"
    assert registry.resolve_key("Dungeons and Dragons") == registry.resolve_key("Dungeons & Dragons")
    assert registry.resolve_key("The") == "the"          # a name that is only "the" keeps it


def test_resolve_finds_a_name_or_an_alias_and_nothing_else(tmp_path):
    reg = registry.load(write(tmp_path, works=[WORK], tracks=[TRACK], people=[PERSON]))
    assert reg.resolve_work("firefly") == reg.resolve_work("FIREFLY") == "firefly"
    assert reg.resolve_work("Serenity") == "firefly"
    assert reg.resolve_work("The Firefly") == "firefly"  # the key sets a leading "the" aside
    assert reg.resolve_work("Serenity the Film") is None
    assert reg.resolve_track("Filk") == reg.resolve_track("filk music") == "filk-music"
    assert reg.resolve_person("Nathan Fillion") == "nathan-fillion"
    assert reg.resolve_person("Mr. Nathan Fillion") == "nathan-fillion"   # a person's key is person_slug
    assert reg.resolve_work("Doctor Who") is None and reg.resolve_track("Horror") is None


# --- the committed registries ----------------------------------------------

def test_the_real_registry_is_valid():
    """The seed in data/registry/, so that CI checks every later edit to it."""
    reg = registry.load(os.path.join(ROOT, registry.DIR))
    assert len(reg.works) > 100 and len(reg.tracks) == 54
    assert all(w["reviewed"] is False for w in reg.works)   # PR 3a seeds nothing as reviewed
    assert reg.resolve_work("d&d") == "dungeons-and-dragons"
    assert reg.resolve_work("Wheel of Time") == reg.resolve_work("The Wheel of Time")
    assert reg.resolve_track("Trek Track") == "trek-track"
    assert reg.by_id()["trek-track" and "star-trek"]["name"] == "Star Trek"
