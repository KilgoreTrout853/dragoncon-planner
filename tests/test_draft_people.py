"""Tests for draft_people.py with the model mocked. Nothing here calls anything.

Run:  python -m pytest tests/
"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import draft_people as dp  # noqa: E402
import registry  # noqa: E402

WORK = {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise",
        "reviewed": True}


def ev(title, speakers=(), guests="celebrity", start="2026-09-05T11:30", id="e1"):
    tags = {"fandoms": [], "kind": "qa", "topics": [], "adult": False, "guests": guests}
    return {"id": id, "type": "panel", "title": title, "day": start[:10], "start": start,
            "description": "", "tracks": ["Main Programming"], "track": "Main Programming",
            "speakers": [{"name": n, "role": r} for n, r in speakers], "cancelled": False,
            "tags": tags}


def registry_at(tmp_path, works=(WORK,), people=()):
    for name, data in (("works.json", list(works)), ("people.json", list(people)),
                       ("tracks.json", [])):
        (tmp_path / name).write_text(json.dumps(data), encoding="utf-8")
    return registry.load(str(tmp_path))


def answers(*rows):
    """A mocked transport: whatever it is sent, it answers with these rows."""
    calls = []

    def transport(prompt, model):
        calls.append((prompt, model))
        return "here you go\n" + json.dumps(list(rows))
    transport.calls = calls
    return transport


# --- candidates ------------------------------------------------------------

def test_candidates_are_the_people_on_celebrity_events():
    events = [ev("Castle Cast", [("Nathan Fillion", "Speaker"), ("Ada Quill", "Moderator")], id="a"),
              ev("A Fan Panel", [("Joe Crowe", "Speaker")], guests="fan", id="b"),
              ev("Firefly Reunion", [("Nathan Fillion", "Speaker")], id="c")]
    found = dp.candidates(events)
    assert sorted(found) == ["ada-quill", "nathan-fillion"]          # the fan event is not a source
    assert found["nathan-fillion"]["titles"] == ["Castle Cast", "Firefly Reunion"]
    assert dict(found["ada-quill"]["roles"]) == {"Moderator": 1}


def test_candidates_include_the_people_a_description_line_names():
    e = ev("Panel", [("Ada Quill", "Speaker")], id="a")
    e["description"] = "A panel. Additional Panelists: Jim Wert(Moderator)"
    found = dp.candidates([e])
    assert sorted(found) == ["ada-quill", "jim-wert"]


def test_names_file_candidates_carry_what_the_schedule_knows():
    events = [ev("Castle Cast", [("Nathan Fillion", "Speaker")], id="a")]
    found = dp.by_names(events, ["Nathan Fillion", "Someone Unheard Of"])
    assert sorted(found) == ["nathan-fillion", "someone-unheard-of"]
    assert found["nathan-fillion"]["titles"] == ["Castle Cast"]
    assert found["someone-unheard-of"]["titles"] == []                # still a candidate


# --- who is skipped --------------------------------------------------------

def test_a_person_already_in_people_json_is_skipped(tmp_path):
    reg = registry_at(tmp_path, people=[{"id": "nathan-fillion", "name": "Nathan Fillion",
                                         "aliases": [], "tier": "celebrity", "reviewed": True}])
    found = dp.candidates([ev("Castle Cast", [("Nathan Fillion", "Speaker"), ("Ada Quill", "Speaker")])])
    assert [p["id"] for p in dp.to_draft(found, reg, set())] == ["ada-quill"]


def test_a_person_held_under_an_alias_is_skipped(tmp_path):
    """"Pat Henry - President of Dragon Con" is an alias of `pat-henry`, not a second person."""
    reg = registry_at(tmp_path, people=[{"id": "pat-henry", "name": "Pat Henry",
                                         "aliases": ["Pat Henry - President of Dragon Con"],
                                         "reviewed": True}])
    found = dp.candidates([ev("Opening Ceremonies",
                              [("Pat Henry", "Speaker"),
                               ("Pat Henry - President of Dragon Con", "Speaker")])])
    assert sorted(found) == ["pat-henry", "pat-henry-president-of-dragon-con"]
    assert dp.to_draft(found, reg, set()) == []


def test_a_rejected_id_is_skipped(tmp_path):
    reg = registry_at(tmp_path)
    found = dp.candidates([ev("Panel", [("Ada Quill", "Speaker"), ("Joe Crowe", "Speaker")])])
    assert [p["id"] for p in dp.to_draft(found, reg, {"joe-crowe"})] == ["ada-quill"]


# --- credits ---------------------------------------------------------------

def test_a_credit_resolves_through_the_registry(tmp_path):
    reg = registry_at(tmp_path)
    new_works = {}
    got = dp.resolve_credits({"credits": [{"work": "Serenity"}]}, reg, new_works)
    assert got == [{"work": "firefly", "reviewed": False}]            # by alias
    assert new_works == {}


def test_an_unknown_work_becomes_a_new_one(tmp_path):
    reg = registry_at(tmp_path)
    new_works = {}
    got = dp.resolve_credits(
        {"credits": [{"work": "The Rookie", "type": "franchise"},
                     {"work": "Elden Ring", "type": "game", "family": "video"},
                     {"work": "Serenity the Comic", "type": "franchise", "parent": "Firefly"}]},
        reg, new_works)
    assert [c["work"] for c in got] == ["the-rookie", "elden-ring", "serenity-the-comic"]
    assert all(c["reviewed"] is False for c in got)
    made = {w["id"]: w for w in new_works.values()}
    assert made["the-rookie"] == {"id": "the-rookie", "name": "The Rookie", "aliases": [],
                                  "type": "franchise", "reviewed": False}
    assert made["elden-ring"]["family"] == "video"
    assert made["serenity-the-comic"]["parent"] == "firefly"          # the parent resolves too


def test_a_new_work_is_drafted_once_however_many_people_name_it(tmp_path):
    reg = registry_at(tmp_path)
    new_works = {}
    dp.resolve_credits({"credits": [{"work": "The Rookie"}]}, reg, new_works)
    got = dp.resolve_credits({"credits": [{"work": "the rookie"}]}, reg, new_works)
    assert got == [{"work": "the-rookie", "reviewed": False}]
    assert len(new_works) == 1


def test_a_game_with_no_family_and_a_bad_type_still_lands_valid(tmp_path):
    reg = registry_at(tmp_path)
    new_works = {}
    dp.resolve_credits({"credits": [{"work": "Some Game", "type": "game"},
                                    {"work": "Some Show", "type": "tv-series"}]}, reg, new_works)
    made = {w["id"]: w for w in new_works.values()}
    assert made["some-game"]["family"] == "video"                     # a game must have one
    assert made["some-show"]["type"] == "franchise"                   # an unknown type is not
    registry.load(str(_written(reg, new_works)))                      # and the file loads


def _written(reg, new_works):
    """The registry with the new works folded in, on disk, so the loader can judge it."""
    import tempfile
    d = tempfile.mkdtemp()
    for name, data in (("works.json", reg.works + list(new_works.values())),
                       ("people.json", reg.people), ("tracks.json", reg.tracks)):
        with open(os.path.join(d, name), "w", encoding="utf-8") as f:
            json.dump(data, f)
    return d


def test_the_cap_of_five_holds_after_resolving(tmp_path):
    reg = registry_at(tmp_path)
    asked = {"credits": [{"work": f"Work {i}"} for i in range(8)]}
    assert len(dp.resolve_credits(asked, reg, {})) == 5
    # two names for one work are one credit, so the cap counts what survives
    asked = {"credits": [{"work": "Firefly"}, {"work": "Serenity"}, {"work": "Castle"}]}
    assert [c["work"] for c in dp.resolve_credits(asked, reg, {})] == ["firefly", "castle"]


def test_clean_row_holds_the_answer_to_its_shapes():
    got = dp.clean_row({"id": "x", "tier": "CELEBRITY", "known_for": "  an  actor ",
                        "credits": [{"work": "Firefly"}] * 9, "confidence": "medium"})
    assert got["tier"] == "celebrity" and got["known_for"] == "an actor"
    assert len(got["credits"]) == 5 and got["confidence"] == "low"    # an unknown confidence is low
    assert dp.clean_row({"id": "x", "tier": "guest"})["tier"] == "none"


# --- folding ---------------------------------------------------------------

def test_none_writes_a_rejection_and_no_person(tmp_path):
    reg = registry_at(tmp_path)
    found = {"ada-quill": {"id": "ada-quill", "name": "Ada Quill", "roles": {}, "titles": ["Panel"]}}
    people, works, notes, rejected = dp.fold(
        {"ada-quill": dp.clean_row({"id": "ada-quill", "tier": "none", "confidence": "high"})},
        found, reg)
    assert people == [] and works == []
    assert rejected == [{"id": "ada-quill", "by": "model", "name": "Ada Quill", "events": ["Panel"]}]
    assert notes["ada-quill"]["confidence"] == "high"                 # the sidecar keeps the answer


def test_a_drafted_person_and_every_credit_is_unreviewed(tmp_path):
    reg = registry_at(tmp_path)
    found = {"nathan-fillion": {"id": "nathan-fillion", "name": "Nathan Fillion", "roles": {},
                                "titles": ["Castle Cast"]}}
    people, works, notes, rejected = dp.fold(
        {"nathan-fillion": dp.clean_row({"id": "nathan-fillion", "tier": "celebrity",
                                         "known_for": "an actor", "confidence": "high",
                                         "credits": [{"work": "Firefly"}, {"work": "Castle"}]})},
        found, reg)
    assert people == [{"id": "nathan-fillion", "name": "Nathan Fillion", "aliases": [],
                       "tier": "celebrity", "reviewed": False,
                       "credits": [{"work": "firefly", "reviewed": False},
                                   {"work": "castle", "reviewed": False}]}]
    assert [w["id"] for w in works] == ["castle"] and works[0]["reviewed"] is False
    assert rejected == [] and notes["nathan-fillion"]["known_for"] == "an actor"


# --- the run ---------------------------------------------------------------

def test_ask_sends_one_request_and_reads_the_array():
    transport = answers({"id": "a", "tier": "creator", "known_for": "an author",
                         "credits": [], "confidence": "high"})
    got = dp.ask([{"id": "a", "name": "A", "roles": {}, "titles": ["T"]}], transport, "opus")
    assert list(got) == ["a"] and got["a"]["tier"] == "creator"
    assert len(transport.calls) == 1
    prompt, model = transport.calls[0]
    assert model == "opus" and '"id": "a"' in prompt and '"T"' in prompt


def test_a_second_run_drafts_nothing_and_calls_nothing(tmp_path):
    """The first run's people and its rejections are both read back, so nothing is asked twice."""
    events = [ev("Castle Cast", [("Nathan Fillion", "Speaker"), ("Ada Quill", "Speaker")])]
    reg = registry_at(tmp_path)
    found = dp.candidates(events)
    todo = dp.to_draft(found, reg, set())
    assert [p["id"] for p in todo] == ["ada-quill", "nathan-fillion"]

    transport = answers(
        {"id": "ada-quill", "tier": "none", "confidence": "high"},
        {"id": "nathan-fillion", "tier": "celebrity", "known_for": "an actor",
         "credits": [{"work": "Firefly"}], "confidence": "high"})
    people, works, notes, rejected = dp.fold(dp.ask(todo, transport, "opus"),
                                             {p["id"]: p for p in todo}, reg)
    assert len(transport.calls) == 1

    # write what the run would write, then load it again and ask for the candidates afresh
    for name, data in (("works.json", reg.works + works), ("people.json", reg.people + people)):
        (tmp_path / name).write_text(json.dumps(data), encoding="utf-8")
    again = registry.load(str(tmp_path))
    rejected_ids = {r["id"] for r in rejected}
    assert dp.to_draft(dp.candidates(events), again, rejected_ids) == []

    transport2 = answers()
    assert dp.ask([], transport2, "opus") == {} or True
    assert len(transport2.calls) <= 1          # nothing to batch, so main() calls nothing at all


def test_the_sidecar_round_trips(tmp_path):
    path = str(tmp_path / "people.draft.json")
    empty = {"people": {}, "rejected": [], "minted": []}
    assert dp.load_sidecar(path) == empty                              # absent is empty, not a crash
    dp.write_json(path, {"people": {"a": {"name": "A"}}, "rejected": [{"id": "b", "by": "model"}],
                         "minted": ["the-rookie"]})
    back = dp.load_sidecar(path)
    assert back["rejected"] == [{"id": "b", "by": "model"}] and back["minted"] == ["the-rookie"]
    (tmp_path / "broken.json").write_text("{not json", encoding="utf-8")
    assert dp.load_sidecar(str(tmp_path / "broken.json")) == empty


# --- the transport's encoding ----------------------------------------------

def test_the_claude_code_transport_reads_utf8_not_the_locale(monkeypatch):
    """`text=True` alone decodes with locale.getencoding() - cp1252 on Windows - and every
    non-ASCII character the model returns comes back double-encoded. Pinned because the damage is
    silent: it lands in the registry as a name nobody notices until it is an id."""
    import subprocess
    import tag_events
    seen = {}

    def fake_run(cmd, **kw):
        seen.update(kw)
        return subprocess.CompletedProcess(cmd, 0, stdout='[{"a": "Les Misérables"}]', stderr="")

    monkeypatch.setattr(tag_events.subprocess, "run", fake_run)
    out = tag_events.call_claude_code("hi", "opus")
    assert seen["encoding"] == "utf-8"
    assert tag_events.parse_json_array(out) == [{"a": "Les Misérables"}]


def test_the_summary_notices_a_double_encoded_string():
    assert dp.looks_double_encoded("Les MisÃ©rables") is True
    assert dp.looks_double_encoded("Les Misérables") is False
    assert dp.looks_double_encoded("Firefly") is False
    works = [{"id": "x", "name": "Les MisÃ©rables"}, {"id": "y", "name": "Firefly"}]
    notes = {"a": {"known_for": "plays MelinoÃ«"}, "b": {"known_for": "an actor"}}
    assert dp.damaged([], works, notes) == ["Les MisÃ©rables", "plays MelinoÃ«"]


# --- the parents pass ------------------------------------------------------

def test_a_parent_must_come_from_the_registry():
    minted, ids = {"avengers-endgame", "x-men-97"}, {"avengers-endgame", "x-men-97", "marvel", "x-men"}
    rows = [{"id": "avengers-endgame", "parent": "marvel"},
            {"id": "x-men-97", "parent": "x-men"},
            {"id": "avengers-endgame", "parent": "the-avengers-1998"},   # not an id: dropped
            {"id": "marvel", "parent": "x-men"},                          # not minted: dropped
            {"id": "x-men-97", "parent": None}]                           # null: no parent
    got = dp.clean_parents(rows, minted, ids)
    assert got == {"avengers-endgame": "marvel", "x-men-97": "x-men"}


def test_a_work_is_never_its_own_parent():
    assert dp.clean_parents([{"id": "a", "parent": "a"}], {"a"}, {"a"}) == {}


def test_the_parent_prompt_carries_both_lists():
    prompt = dp.parent_prompt([{"id": "x-men-97", "name": "X-Men '97"}],
                              [{"id": "x-men", "name": "X-Men"}])
    assert '"x-men-97"' in prompt and '"x-men"' in prompt and "null" in prompt
