"""Tests for tag_stage.py with the model mocked, and for tag_key.py, which holds what the tag stage sends and caches:
the input and its key, the prompt, the checks an answer passes before it is cached, the cache, a season read through
the build's front door and the merge, the request cap, seed, the frozen refusal, and mint with its `minted` record.
Nothing here calls a model or the network. Two tests read data/: the 2026 key test, and mint's rewrite of the
committed works.json, which changes no line.

Run:  python -m pytest tests/
"""
import ast
import hashlib
import inspect
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import draft_people as dp  # noqa: E402
import ids_stage  # noqa: E402
import merge_stage  # noqa: E402
import registry  # noqa: E402
import tag_key  # noqa: E402
import tag_stage as ts  # noqa: E402
from season import load as load_season  # noqa: E402

FIREFLY = {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": True}
TREK = {"id": "star-trek", "name": "Star Trek", "aliases": ["Trek"], "type": "franchise", "reviewed": True}
DND = {"id": "dungeons-and-dragons", "name": "Dungeons & Dragons", "aliases": ["D&D"], "type": "game",
       "family": "rpg", "terms": ["DDAL", "Adventurers League"], "reviewed": True}
VERSION = 1   # the fixture seasons' prompt_version, as 2026's and 2027's have it (#46)
SEASON_2026 = {"year": 2026, "slug": "dragoncon26", "source": "https://app.core-apps.com/dragoncon26",
               "days": ["Sep  5"], "con": {"first": "2026-09-02", "last": "2026-09-07"}, "tz": "America/New_York",
               "window": None, "frozen": True, "prompt_version": VERSION,
               "thresholds": {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}}
SEASON_2027 = {**SEASON_2026, "year": 2027, "slug": "dragoncon27", "source": "https://app.core-apps.com/dragoncon27",
               "days": ["Sep  4"], "con": {"first": "2027-09-01", "last": "2027-09-06"},
               "window": {"from": "2027-08-01", "to": "2027-09-07"}, "frozen": False}
T1, T2 = "2027-08-01T10:00:00+00:00", "2027-08-02T10:00:00+00:00"


def ev(title, description="", tracks=("Main Programming",), type="panel", speakers=(), id="e1",
       start="2026-09-05T11:30"):
    """A frozen year's event, with v1's track and cancelled beside the ten raw fields."""
    tracks = list(tracks)
    return {"id": id, "type": type, "title": title, "day": start[:10], "start": start, "end": start,
            "duration_min": 60, "location": "Marriott A", "description": description, "tracks": tracks,
            "track": tracks[0] if tracks else "", "speakers": [{"name": n, "role": r} for n, r in speakers],
            "cancelled": False}


def raw(sid, title, description="", tracks=("Main Programming",), type="panel", start="2027-09-04T11:30", **flags):
    """A live year's raw row (#42), `stale` or `removed` where given true."""
    out = {"source_id": sid, "type": type, "title": title, "day": start[:10], "start": start, "end": start,
           "duration_min": 60, "location": "Marriott A", "description": description, "tracks": list(tracks),
           "speakers": []}
    return {**out, **{k: True for k, on in flags.items() if on}}


def key(event, version=VERSION):
    return tag_key.input_key(tag_key.tagger_input(event), version)


def registry_at(path, works=(FIREFLY, TREK, DND), people=(), tracks=()):
    os.makedirs(path, exist_ok=True)
    for name, rows in (("works.json", list(works)), ("people.json", list(people)), ("tracks.json", list(tracks))):
        dp.write_json(os.path.join(path, name), [dp.in_order(r, registry.WORK_KEYS) if name == "works.json" else r
                                                 for r in rows])
    return registry.load(str(path))


def row(**fields):
    """A model row with every field, as the prompt asks for it; any field can be replaced."""
    out = {"kind": "panel", "works": [], "medium": [], "genre": [], "craft": [], "subject": [],
           "audience": "all", "play": None}
    out.update(fields)
    return out


def work(name, evidence=None, type="franchise", **more):
    return {"name": name, "evidence": name if evidence is None else evidence, "type": type, **more}


def entry(event, version=VERSION, model="test-model", **answer):
    """A cache entry for an event, as the tag stage would have written it."""
    inp = tag_key.tagger_input(event)
    return {"key": key(event, version), "title": inp["title"], "model": model,
            "answer": ts.validate(row(**answer), inp, ts.new_tally())}


def scripted(answer):
    """A mocked transport. It reads the events out of the prompt it is sent and answers each with
    answer(event, call number) - a row, or None to leave the event out."""
    calls = []

    def transport(prompt, model, meta):
        events = json.loads(prompt.split("\nEvents:\n", 1)[1])
        calls.append([e["title"] for e in events])
        meta["model"] = "claude-test-1"
        rows = [{"id": e["id"], **r} for e in events for r in [answer(e, len(calls))] if r is not None]
        return "Here you go:\n" + json.dumps(rows)
    transport.calls = calls
    return transport


def refusing(prompt, model, meta):
    raise AssertionError("a model was asked")


INP = {"title": "Castle Cast", "type": "panel", "tracks": ["Main Programming"],
       "description": "Bring your questions for our guests from the crime drama Castle!"}


# --- the fixture years -------------------------------------------------------

def frozen_year(tmp_path, events, works=(FIREFLY, TREK, DND)):
    """A frozen year's folder - season.json and the raw events.json - and the registry beside it. -> main()'s
    arguments; the cache goes beside the season file."""
    folder = tmp_path / "2026"
    folder.mkdir(parents=True)
    (folder / "season.json").write_text(json.dumps(SEASON_2026), encoding="utf-8")
    (folder / "events.json").write_text(json.dumps({"generated_at": "2026-09-07T12:50:19+00:00", "events": events}),
                                        encoding="utf-8")
    registry_at(tmp_path / "registry", works=works)
    return ["--season", str(folder / "season.json"), "--registry", str(tmp_path / "registry")]


def live_year(tmp_path, first, second=None, *, run=True, season=SEASON_2027, works=(FIREFLY, TREK, DND)):
    """A live year's folder after its runs - the first saw the rows `first`, and the second, where given, `second`,
    which are then source.json's: season.json, source.json, the ledger the ids stage wrote over the runs, and, where
    `run`, last-run.json with the last run's fetched_at, T1 or T2 - and the registry beside it. -> main()'s
    arguments."""
    folder = tmp_path / str(season["year"])
    folder.mkdir(parents=True)
    (folder / "season.json").write_text(json.dumps(season), encoding="utf-8")
    ledger = ids_stage.assign(first, {}, T1, season["thresholds"]).ledger
    rows, stamp = first, T1
    if second is not None:
        ledger = ids_stage.assign(second, ledger, T2, season["thresholds"]).ledger
        rows, stamp = second, T2
    (folder / "source.json").write_text(json.dumps({"source": season["source"], "failures": [], "rows": rows}),
                                        encoding="utf-8")
    ids_stage.write_ledger(str(folder / "ids.jsonl"), ledger)
    if run:
        (folder / "last-run.json").write_text(json.dumps({"fetched_at": stamp, "changed_at": T1}), encoding="utf-8")
    registry_at(tmp_path / "registry", works=works)
    return ["--season", str(folder / "season.json"), "--registry", str(tmp_path / "registry")]


def cache_of(args):
    """The cache beside the season file main()'s arguments name."""
    return os.path.join(os.path.dirname(args[1]), "tags.cache.jsonl")


def events_of(args):
    """(the season's events, the stamp) as the tag stage reads them."""
    return ts.season_events(load_season(args[1]), os.path.dirname(os.path.abspath(args[1])))


# The live year's two runs: a1 and b2 are one listing twice (one key: one event, a1); c3's listing goes after the
# first run, carried removed; d4's page fails on the second, carried stale.
FIRST = [raw("a1", "Castle Cast", "Q&A."),
         raw("b2", "Castle Cast", "Q&A with the cast of Castle, the crime drama.", tracks=["Main Programming",
                                                                                           "Video Room"]),
         raw("c3", "Firefly Reunion", "Serenity!"),
         raw("d4", "Trek Trivia", "Name that starship.")]
SECOND = FIRST[:2] + [raw("c3", "Firefly Reunion", "Serenity!", removed=True),
                      raw("d4", "Trek Trivia", "Name that starship.", stale=True)]


# --- what is sent, and the key: tag_key.py -----------------------------------

def test_the_input_is_four_fields_and_no_people():
    event = ev("Castle Cast", "Bring questions! Additional Panelists: Jim Wert(Moderator)",
               speakers=[("Nathan Fillion", "Speaker")])
    assert tag_key.tagger_input(event) == {"title": "Castle Cast", "type": "panel", "tracks": ["Main Programming"],
                                           "description": "Bring questions!"}


def test_the_key_is_the_same_whatever_order_the_input_is_in():
    inp = tag_key.tagger_input(ev("Castle Cast", "Q&A."))
    assert tag_key.input_key(inp, VERSION) == tag_key.input_key(dict(reversed(list(inp.items()))), VERSION)
    assert len(tag_key.input_key(inp, VERSION)) == 64 and int(tag_key.input_key(inp, VERSION), 16) >= 0


def test_the_key_is_the_same_under_two_hash_seeds():
    event = json.dumps(ev("Pokémon: Master Quest", "Our heroes go to the Whirl Cup.", tracks=["Anime/Manga", "Kids Track"]))
    code = ("import json, sys; sys.path.insert(0, sys.argv[1]); import tag_key; "
            "print(tag_key.input_key(tag_key.tagger_input(json.loads(sys.argv[2])), 1))")
    keys = {subprocess.run([sys.executable, "-c", code, ROOT, event], capture_output=True, text=True, check=True,
                           env={**os.environ, "PYTHONHASHSEED": seed}).stdout.strip() for seed in ("0", "1")}
    assert len(keys) == 1 and len(keys.pop()) == 64


def test_speakers_do_not_change_the_key():
    one = ev("Castle Cast", "Q&A.", speakers=[("Nathan Fillion", "Speaker")])
    two = ev("Castle Cast", "Q&A.", speakers=[("Seamus Dever", "Speaker"), ("Primetime Steve", "Moderator")])
    assert key(one) == key(two) == key(ev("Castle Cast", "Q&A."))


def test_the_registry_and_tracks_json_change_the_prompt_and_not_the_key(tmp_path):
    event = ev("Castle Cast", "Q&A.")
    before = key(event)
    small = registry_at(tmp_path / "a", works=[FIREFLY])
    large = registry_at(tmp_path / "b", works=[FIREFLY, TREK],
                        tracks=[{"id": "main-programming", "name": "Main Programming", "aliases": [],
                                 "axes": {"subject": ["community"]}}])
    batch = [(before, tag_key.tagger_input(event))]
    assert ts.build_prompt(batch, ts.works_guide(small.works))[0] != ts.build_prompt(batch, ts.works_guide(large.works))[0]
    assert key(event) == before


def test_the_key_changes_with_the_version_the_title_the_type_the_tracks_and_the_description():
    base = ev("Castle Cast", "Q&A.", tracks=["Main Programming"])
    variants = [ev("Castle Cast Two", "Q&A."), ev("castle cast", "Q&A."), ev("Castle Cast", "Q&A.", type="gaming"),
                ev("Castle Cast", "Q&A.", tracks=["Video Room"]),
                ev("Castle Cast", "Q&A.", tracks=["Main Programming", "BritTrack"]),
                ev("Castle Cast", "Q&A!")]
    assert len({key(base)} | {key(v) for v in variants}) == 1 + len(variants)
    assert key(base, 2) != key(base, 1)
    # the key's bytes: the sha256 of the canonical {"v": version, "input": ...}, as PR 4 made it (#34)
    inp = tag_key.tagger_input(base)
    canonical = json.dumps({"v": 1, "input": inp}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    assert key(base, 1) == hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def test_sessions_that_differ_only_in_a_price_a_clock_time_or_sold_out_share_a_key():
    beret = ["Sew a Beret - $$ 12:45p-2:45p SOLD OUT", "Sew a Beret - $$ 3:00-5:00p", "Sew a Beret"]
    assert len({key(ev(t, "Bring fabric.")) for t in beret}) == 1
    # a facet after a separator: strip_facets leaves "Matt Dinniman - Signing -", and the separators are trimmed
    assert key(ev("Matt Dinniman - Signing - SOLD OUT")) == key(ev("Matt Dinniman - Signing"))
    title = lambda t: tag_key.tagger_input(ev(t))["title"]  # noqa: E731
    assert title("CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue") == \
        "Dragon Con Burlesque: A Glamour Geek Revue"
    assert title("  Photo  Session:   Castle Duo ") == "Photo Session: Castle Duo"   # case kept


def test_the_panelist_line_is_not_sent():
    a = ev("Castle Cast", "Bring questions! Additional Panelists: Jim Wert(Moderator), Alli Martin")
    b = ev("Castle Cast", "Bring questions! Additional Panelists: Sarah Rose(Moderator)")
    assert key(a) == key(b) == key(ev("Castle Cast", "Bring questions!"))
    prompt = ts.build_prompt([(key(a), tag_key.tagger_input(a))], "")[0]
    assert "Jim Wert" not in prompt and "Additional Panelists" not in prompt


def test_the_description_is_trimmed_and_capped():
    long = ev("T", "  " + "x" * (tag_key.DESCRIPTION_CAP + 500) + "\n ")
    assert tag_key.tagger_input(long)["description"] == "x" * tag_key.DESCRIPTION_CAP
    assert ts.over_cap(long) and not ts.over_cap(ev("T", "short"))


def test_the_key_and_the_cache_are_a_leaf_that_neither_stage_is_imported_by():
    """tag_key.py holds the input, the key and the cache's file - its reader and writer, and their text halves, which
    the orchestrator calls - and nothing else; events_v2.py imports it, not the tag stage, so the tag stage imports
    the build with no cycle."""
    def imported(name):
        tree = ast.parse(open(os.path.join(ROOT, name), encoding="utf-8").read())
        return {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names} | \
               {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
    assert imported("tag_key.py") <= {"hashlib", "json", "os", "parse_stage", "registry"}
    assert "tag_key" in imported("events_v2.py") and "tag_stage" not in imported("events_v2.py")
    assert {"tag_key", "events_v2", "merge_stage"} <= imported("tag_stage.py")
    public = {n for n, v in vars(tag_key).items() if not n.startswith("_") and not inspect.ismodule(v)}
    assert public == {"tagger_input", "input_key", "DESCRIPTION_CAP", "load_cache", "write_cache", "parse_cache",
                      "cache_text"}
    code = "import sys; sys.path.insert(0, sys.argv[1]); import tag_stage; print('ok')"
    assert subprocess.run([sys.executable, "-c", code, ROOT], capture_output=True, text=True,
                          check=True).stdout.strip() == "ok"


# --- the prompt --------------------------------------------------------------

def test_the_prompt_lists_every_work_name_children_under_parents_with_no_ids_or_aliases():
    works = [TREK, FIREFLY,
             {"id": "star-trek-voyager", "name": "Star Trek: Voyager", "aliases": ["Voyager"], "parent": "star-trek",
              "type": "franchise", "reviewed": True},
             {"id": "the-delta-flyers", "name": "The Delta Flyers", "aliases": [], "parent": "star-trek-voyager",
              "type": "franchise", "reviewed": False}]
    guide = ts.works_guide(works)
    assert guide.split("\n") == ["Firefly", "Star Trek", "  Star Trek: Voyager", "    The Delta Flyers"]
    prompt = ts.build_prompt([], guide)[0]
    assert guide in prompt
    for absent in ("Serenity", "star-trek-voyager", "the-delta-flyers", '"firefly"'):
        assert absent not in prompt


def test_the_prompt_states_every_rule():
    prompt = ts.build_prompt([("k", INP)], "Castle")[0]
    for said in [", ".join(ts.KINDS), "at most 3 works", "never because of who is", "is not a work",
                 "a company or a brand is not a work unless it is in the list below",
                 "An event this convention puts on", "in passing, or in a list of examples",
                 "A scenario, module, adventure or session is not a work; the published game",
                 "A campaign setting or game world is named only when it is in the list below; otherwise "
                 "name the game system it is played in, and if the listing does not say which system, name nothing.",
                 "A traditional game with no publisher - chess, poker, bingo - is not a work.",
                 "A work named only to say what a presenter has worked on, or as one example among several, "
                 "is not what the listing is about. If the work's name could be removed and the listing would "
                 "still describe the same event, do not link it.",
                 "the shortest phrase of the title or the description that shows it, copied exactly",
                 '"game" for a work that began as a game', "rpg, ccg, board, miniatures, video",
                 '"kids"', '"mature"', '"all"', "null otherwise"] + [", ".join(v) for v in registry.AXES.values()]:
        assert said in " ".join(prompt.split()), said


def test_every_kind_format_and_level_has_its_gloss_in_the_prompt():
    assert list(ts.KIND_GLOSSES) == ts.KINDS
    assert set(ts.PLAY_FORMAT_GLOSSES) == set(ts.PLAY_FORMATS) and set(ts.PLAY_LEVEL_GLOSSES) == set(ts.PLAY_LEVELS)
    assert ts.PLAY_FORMATS == ("demo", "learn-to-play", "organized-play", "tournament", "open-play", "one-shot")
    assert ts.PLAY_LEVELS == ("beginner", "any")        # campaign and experienced struck after the gate
    prompt = " ".join(ts.build_prompt([], "")[0].split())
    assert "campaign =" not in prompt and "experienced" not in prompt
    assert "or a sporting or combat match that people watch." in prompt
    for table in (ts.KIND_GLOSSES, ts.PLAY_FORMAT_GLOSSES, ts.PLAY_LEVEL_GLOSSES):
        for value, gloss in table.items():
            assert (f"{value} = {gloss}." if gloss else f" {value}.") in prompt, value
    assert "workshop = hands-on: the attendees make, practise or do the thing in the session." in prompt
    assert "reading = an author reading their own work." in prompt
    assert "one-shot = a scheduled, self-contained session of a game, none of the above." in prompt


def test_the_tag_stage_names_a_model_by_its_full_id():
    """An alias moves with the CLI: `sonnet` was claude-sonnet-4-6 on the day the pilot ran."""
    assert ts.CODE_MODEL == ts.API_MODEL == "claude-sonnet-5"


def test_requests_go_in_first_track_then_title_order_25_to_a_request_under_short_ids():
    events = [ev(f"Title {i:02d}", tracks=[track]) for i, track in
              ((i, ["Video Room", "Anime/Manga", ""][i % 3]) for i in range(60))]
    inputs, _ = ts.distinct_inputs(events, VERSION)
    todo = ts.to_ask(inputs, {})
    assert [(inp["tracks"] or [""])[0] for _, inp in todo[:3]] == ["", "", ""]   # no track sorts first
    batches = ts.batches_of(todo, ts.PER_REQUEST)
    assert [len(b) for b in batches] == [25, 25, 10]
    prompt, ids = ts.build_prompt(batches[0], "")
    assert list(ids) == [f"e{i}" for i in range(1, 26)] and list(ids.values()) == [k for k, _ in batches[0]]
    assert not any(k in prompt for k in ids.values())


# --- the checks before an answer is cached -----------------------------------

def test_a_kind_outside_the_list_rejects_the_row():
    tally = ts.new_tally()
    assert ts.validate(row(kind="keynote"), INP, tally) is None
    assert ts.validate(row(kind=None), INP, tally) is None
    assert [r["kind"] for r in tally["kind_rejected"]] == ["keynote", None]
    assert ts.validate(row(kind=" QA "), INP, tally)["kind"] == "qa"


def test_axis_values_outside_the_lists_are_dropped_and_each_axis_is_capped_at_two():
    tally = ts.new_tally()
    got = ts.validate(row(medium=["tv", "Film", "radio", "books", "tv"], genre="sci-fi", subject=["Space"]), INP, tally)
    assert got["medium"] == ["tv", "film"] and got["genre"] == [] and got["subject"] == ["space"]
    assert tally["axis_dropped"] == {"medium: radio": 1} and tally["axis_capped"] == 1


def test_an_audience_outside_the_list_is_all():
    tally = ts.new_tally()
    assert ts.validate(row(audience="adults"), INP, tally)["audience"] == "all"
    assert ts.validate(row(audience="Mature"), INP, tally)["audience"] == "mature"
    assert tally["audience_defaulted"] == {"adults": 1}


def test_a_play_outside_its_lists_is_null():
    tally = ts.new_tally()
    assert ts.validate(row(play={"format": "Tournament", "level": "any"}), INP, tally)["play"] == \
        {"format": "tournament", "level": "any"}
    assert ts.validate(row(play={"format": "one-shot", "level": "beginner"}), INP, tally)["play"] == \
        {"format": "one-shot", "level": "beginner"}
    assert ts.validate(row(play={"format": "league", "level": "any"}), INP, tally)["play"] is None
    assert ts.validate(row(play={"format": "demo"}), INP, tally)["play"] is None
    assert ts.validate(row(play="demo"), INP, tally)["play"] is None
    assert ts.validate(row(play={"format": "campaign", "level": "any"}), INP, tally)["play"] is None
    assert ts.validate(row(play={"format": "demo", "level": "experienced"}), INP, tally)["play"] is None
    assert ts.validate(row(play=None), INP, tally)["play"] is None
    assert sum(tally["play_nulled"].values()) == 5


def test_a_work_whose_evidence_is_not_in_the_text_sent_is_dropped_and_counted():
    tally = ts.new_tally()
    got = ts.validate(row(works=[work("Castle", "crime drama Castle"), work("Firefly", "Serenity"),
                                 work("The Rookie", "")]), INP, tally)
    assert got["works"] == [{"name": "Castle", "evidence": "crime drama Castle", "type": "franchise"}]
    assert [(d["name"], d["evidence"]) for d in tally["evidence_dropped"]] == [("Firefly", "Serenity"), ("The Rookie", "")]


def test_the_evidence_check_folds_case_accents_curly_apostrophes_and_whitespace():
    inp = {"title": "Pokémon: Master Quest", "type": "panel", "tracks": [],
           "description": "The Hitchhiker’s Guide  to the Galaxy returns."}
    assert ts.evidence_holds("Pokemon", inp) and ts.evidence_holds("POKÉMON: master", inp)
    assert ts.evidence_holds("Hitchhiker's Guide to", inp)         # straight in the answer, curly in the text
    straight = {**inp, "description": "The Hitchhiker's Guide to the Galaxy returns."}
    assert ts.evidence_holds("Hitchhiker’s   Guide", straight)     # and the other way, whitespace collapsed
    assert not ts.evidence_holds("Pokémon Go", inp) and not ts.evidence_holds("   ", inp)
    assert not ts.evidence_holds(None, inp)


def test_the_evidence_check_folds_a_left_single_quote_too_and_person_ids_do_not_move():
    """The text of "Building a Campaign for the Long Haul" opens a quote with U+2018; the model
    answered with a straight one, and the link was dropped. The tag stage folds it now;
    parse_stage.fold does not, because it makes person ids."""
    inp = {"title": "Building a Campaign for the Long Haul", "type": "panel", "tracks": [],
           "description": "Paris Arrowsmith, Creator of the popular Cyberpunk Red Podcast ‘No Latency,' dives in."}
    assert ts.evidence_holds("Cyberpunk Red Podcast 'No Latency", inp)
    assert ts.evidence_holds("Podcast ‘No Latency", {**inp, "description": "Podcast 'No Latency' dives in."})
    import parse_stage as ps
    assert ps.fold("‘") == "‘"      # parse_stage.fold is unchanged, so no person id moves


def test_works_are_capped_at_three_the_overflow_counted_and_one_work_is_one_spelling():
    tally = ts.new_tally()
    inp = {**INP, "description": "Castle, Firefly, Buffy, Angel and The Rookie."}
    got = ts.validate(row(works=[work("Castle"), work("The Castle", "Castle"), work("Firefly"), work("Buffy"),
                                 work("Angel"), work("The Rookie")]), inp, tally)
    assert [w["name"] for w in got["works"]] == ["Castle", "Firefly", "Buffy"]
    assert tally["works_over_cap"] == [{"key": None, "title": "Castle Cast", "dropped": ["Angel", "The Rookie"]}]


def test_a_type_or_family_outside_its_list_is_null_and_family_is_only_on_a_game():
    tally = ts.new_tally()
    inp = {**INP, "description": "Castle and Wingspan and Hollow Knight."}
    got = ts.validate(row(works=[work("Castle", type="tv-show"), work("Wingspan", type="game", family="Board"),
                                 work("Hollow Knight", type="game", family="metroidvania"),
                                 work("Castle", type="franchise", family="video")]), inp, tally)
    assert got["works"] == [{"name": "Castle", "evidence": "Castle", "type": None},
                            {"name": "Wingspan", "evidence": "Wingspan", "type": "game", "family": "board"},
                            {"name": "Hollow Knight", "evidence": "Hollow Knight", "type": "game", "family": None}]
    assert tally["type_invalid"] == 1 and tally["family_invalid"] == 1


def test_a_work_named_by_a_registry_term_survives_validation():
    """The cache holds what the model said: validation reads no registry."""
    inp = {**INP, "title": "DDAL FR-DC-TDD-03: The Zephyr's Fold"}
    got = ts.validate(row(kind="gaming", works=[work("DDAL", type="game", family="rpg")]), inp, ts.new_tally())
    assert got["works"] == [{"name": "DDAL", "evidence": "DDAL", "type": "game", "family": "rpg"}]


# --- the requests and the cap --------------------------------------------------

def test_missing_and_rejected_rows_are_asked_once_more_then_left_uncached_and_reported():
    events = [ev("A Panel", id="a"), ev("B Panel", id="b"), ev("C Panel", id="c")]
    inputs, _ = ts.distinct_inputs(events, VERSION)

    def answer(e, call):
        if e["title"] == "A Panel":
            return row()
        if e["title"] == "B Panel":
            return row(kind="keynote") if call == 1 else row(kind="qa")
        return None                                   # C is never answered

    transport, cache = scripted(answer), {}
    result = ts.tag(inputs, cache, "", transport, "m", lambda c: None, cap=40)
    assert transport.calls == [["A Panel", "B Panel", "C Panel"], ["B Panel", "C Panel"]]
    assert result.uncached == {key(events[2]): "unanswered"}
    assert (result.sent, result.requests, result.unanswered) == (3, 2, 1)
    assert (result.cached_before, result.cached_after) == (0, 2)
    assert sorted(e["title"] for e in cache.values()) == ["A Panel", "B Panel"]
    assert cache[key(events[1])]["answer"]["kind"] == "qa" and len(result.tally["kind_rejected"]) == 1
    assert {e["model"] for e in cache.values()} == {"claude-test-1"}   # the model that answered, not the alias
    assert result.model == "m"                                          # the model asked for


def test_three_failed_requests_in_a_row_stop_the_run():
    events = [ev(f"Panel {i}", id=str(i)) for i in range(5)]
    inputs = ts.distinct_inputs(events, VERSION)[0]
    calls = []

    def down(prompt, model, meta):
        calls.append(1)
        raise RuntimeError("rate limited")
    result = ts.tag(inputs, {}, "", down, "m", lambda c: None, cap=40, per_request=1)
    assert len(calls) == ts.STOP_AFTER_FAILURES == result.requests
    assert (result.failed, result.stopped, result.capped, result.sent) == (3, 2, 0, 3)


def test_capped_stopped_failed_and_unanswered_are_told_apart():
    """Eight inputs, one a request, a cap of six (#46): three requests fail and stop the run, the three the cap allowed
    after them are stopped, and the two past the cap are capped - not sent, and not failed."""
    events = [ev(f"Panel {c}", id=c) for c in "ABCDEFGH"]
    inputs = ts.distinct_inputs(events, VERSION)[0]
    calls = []

    def down(prompt, model, meta):
        calls.append(json.loads(prompt.split("\nEvents:\n", 1)[1])[0]["title"])
        raise RuntimeError("overloaded")
    result = ts.tag(inputs, {}, "", down, "m", lambda c: None, cap=6, per_request=1)
    assert calls == ["Panel A", "Panel B", "Panel C"] and result.requests == 3
    ways = {inputs[k]["title"][-1]: way for k, way in result.uncached.items()}
    assert ways == {"A": "failed", "B": "failed", "C": "failed", "D": "stopped", "E": "stopped", "F": "stopped",
                    "G": "capped", "H": "capped"}
    assert (result.failed, result.stopped, result.capped, result.unanswered, result.sent) == (3, 3, 2, 0, 3)


def test_an_input_the_retry_cannot_reach_keeps_its_first_way():
    """Seven inputs, one a request: every other one fails, never three in a row, so the run goes on. The retry of the
    four that failed fails three in a row and stops; the fourth, which the stop leaves unsent, was sent once, so it is
    still failed, not stopped."""
    events = [ev(f"Panel {c}", id=c) for c in "ABCDEFG"]
    inputs = ts.distinct_inputs(events, VERSION)[0]
    calls = []

    def every_other(prompt, model, meta):
        title = json.loads(prompt.split("\nEvents:\n", 1)[1])[0]["title"]
        calls.append(title)
        if title[-1] in "ACEG":
            raise RuntimeError("overloaded")
        return json.dumps([{"id": "e1", **row()}])
    result = ts.tag(inputs, {}, "", every_other, "m", lambda c: None, cap=40, per_request=1)
    assert calls == [f"Panel {c}" for c in "ABCDEFG"] + ["Panel A", "Panel C", "Panel E"]
    assert {inputs[k]["title"][-1]: way for k, way in result.uncached.items()} == {c: "failed" for c in "ACEG"}
    assert (result.failed, result.stopped, result.requests, result.sent) == (4, 0, 10, 7)


def test_a_run_sends_at_most_the_cap_the_retry_among_them():
    """A and B go in the cap's two requests; B's row is missing, and with no room left it is unanswered, not retried;
    C and D wait for a later run. With room in the cap after the first pass, B is asked again, and answered."""
    events = [ev(f"Panel {c}", id=c) for c in "ABCD"]
    inputs = ts.distinct_inputs(events, VERSION)[0]
    first_ask = lambda e, call: row() if e["title"] != "Panel B" or call > 2 else None  # noqa: E731

    transport, cache = scripted(first_ask), {}
    result = ts.tag(inputs, cache, "", transport, "m", lambda c: None, cap=2, per_request=1)
    assert transport.calls == [["Panel A"], ["Panel B"]] and result.requests == 2
    assert (result.sent, result.unanswered, result.capped, result.cached_after) == (2, 1, 2, 1)
    # every input asked about ends one way: answered, or capped, stopped, failed or unanswered
    assert result.sent == (result.cached_after - result.cached_before) + result.failed + result.unanswered
    assert len(ts.to_ask(inputs, {})) == result.sent + result.capped + result.stopped

    transport, cache = scripted(lambda e, call: row() if e["title"] != "Panel B" or call > 4 else None), {}
    result = ts.tag(inputs, cache, "", transport, "m", lambda c: None, cap=5, per_request=1)
    assert transport.calls == [["Panel A"], ["Panel B"], ["Panel C"], ["Panel D"], ["Panel B"]]
    assert (result.requests, result.unanswered, result.capped, result.cached_after) == (5, 0, 0, 4)


# --- the cache: tag_key.py ------------------------------------------------------

def test_the_cache_round_trips_sorted_lf_one_entry_a_line_fields_in_order(tmp_path):
    entries = [entry(ev(t), kind="qa", works=[work("Castle", "Castle")] if "Castle" in t else [])
               for t in ("Castle Cast", "Opening Ceremonies", "Pokémon Trivia")]
    scrambled = {e["key"]: {"answer": dict(reversed(list(e["answer"].items()))), "model": e["model"],
                            "title": e["title"], "key": e["key"]} for e in entries}
    path = str(tmp_path / "tags.cache.jsonl")
    tag_key.write_cache(path, scrambled)
    raw_bytes = open(path, "rb").read()
    assert b"\r" not in raw_bytes and raw_bytes.endswith(b"\n") and "Pokémon".encode() in raw_bytes
    lines = raw_bytes.decode("utf-8").splitlines()
    assert len(lines) == 3 and [json.loads(line)["key"] for line in lines] == sorted(scrambled)
    assert all(list(json.loads(line)) == ["key", "title", "model", "answer"] for line in lines)
    assert all(list(json.loads(line)["answer"]) == ["kind", "works", "medium", "genre", "craft", "subject",
                                                    "audience", "play"] for line in lines)
    back = tag_key.load_cache(path)
    assert {k: e["answer"] for k, e in back.items()} == {e["key"]: e["answer"] for e in entries}
    tag_key.write_cache(path, back)
    assert open(path, "rb").read() == raw_bytes
    assert tag_key.load_cache(str(tmp_path / "absent.jsonl")) == {}


def test_cache_text_and_parse_cache_are_the_writer_s_and_the_reader_s_halves(tmp_path):
    # the orchestrator (pipeline.py) reads and writes the file itself, through these
    cache = {e["key"]: e for e in (entry(ev("Castle Cast"), works=[work("Castle")]), entry(ev("Opening Ceremonies")))}
    path = str(tmp_path / "tags.cache.jsonl")
    tag_key.write_cache(path, cache)
    text = open(path, "rb").read().decode("utf-8")
    assert text == tag_key.cache_text(cache)
    assert tag_key.parse_cache(text, path) == tag_key.load_cache(path) == cache
    # lines break as a file read as text breaks them, a blank line skipped, a bad one named by its number
    assert tag_key.parse_cache(text.replace("\n", "\r\n") + "\r\n", path) == cache
    assert tag_key.parse_cache(text.replace("\n", "\r"), path) == cache
    with pytest.raises(ValueError, match=r"x:3: not a cache entry"):
        tag_key.parse_cache(text + '{"key": "k"}\n', "x")


def test_a_line_that_is_not_an_entry_is_an_error(tmp_path):
    path = tmp_path / "tags.cache.jsonl"
    path.write_text('{"key": "k", "answer": {}}\n', encoding="utf-8")
    with pytest.raises(ValueError):
        tag_key.load_cache(str(path))


# --- a season: the build's front door and the merge -------------------------

def test_a_frozen_year_is_read_through_the_frozen_door_and_the_merge(tmp_path):
    """The frozen door drops v1's fields and gives each event its source id as its id; the merge gives a group of one
    back as it was, so every input is the raw event's."""
    events = [{**ev("Castle Cast", "Q&A.", id="a"), "hotel": "Marriott", "room": "A", "tags": {"kind": "qa"}},
              ev("Firefly Reunion", "Serenity!", id="b", start="2026-09-05T14:00")]
    args = frozen_year(tmp_path, events)
    got, stamp = events_of(args)
    assert stamp is None and [e["id"] for e in got] == ["a", "b"] and [e["source_id"] for e in got] == ["a", "b"]
    assert all(set(e) == {"id", "source_id", *merge_stage.FIELDS} for e in got)
    assert [tag_key.tagger_input(e) for e in got] == [tag_key.tagger_input(e) for e in events]


def test_a_live_year_is_read_merged_and_its_removed_events_are_not_sent(tmp_path, monkeypatch):
    args = live_year(tmp_path, FIRST, SECOND)
    got, stamp = events_of(args)
    assert stamp == T2 and [e["id"] for e in got] == ["a1", "d4"] and got[1]["stale"] is True
    # a1 and b2 are one event: the smaller row's title, the tracks' union and the longer description
    assert tag_key.tagger_input(got[0]) == {"title": "Castle Cast", "type": "panel",
                                            "tracks": ["Main Programming", "Video Room"],
                                            "description": "Q&A with the cast of Castle, the crime drama."}
    transport = scripted(lambda e, call: row(kind="qa"))
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint"]) == 0
    assert transport.calls == [["Castle Cast", "Trek Trivia"]]              # c3, removed, is not sent
    assert sorted(e["title"] for e in tag_key.load_cache(cache_of(args)).values()) == ["Castle Cast", "Trek Trivia"]


def test_a_live_year_refuses_as_the_build_does_and_writes_nothing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", refusing, "m"))
    no_run = live_year(tmp_path / "a", FIRST, run=False)
    assert ts.main(no_run) == 1 and "a live year needs a run" in capsys.readouterr().err
    retitled = live_year(tmp_path / "b", FIRST, SECOND)                      # d4 retitled after the ids stage ran
    source = json.loads(open(os.path.join(os.path.dirname(retitled[1]), "source.json"), encoding="utf-8").read())
    source["rows"] = [dict(r, title="Trek Trivia Night") if r["source_id"] == "d4" else r for r in source["rows"]]
    with open(os.path.join(os.path.dirname(retitled[1]), "source.json"), "w", encoding="utf-8") as f:
        json.dump(source, f)
    assert ts.main(retitled) == 1 and "run the ids stage first" in capsys.readouterr().err
    other = live_year(tmp_path / "c", FIRST, season={**SEASON_2027, "source": "https://example.test/other"})
    with open(os.path.join(os.path.dirname(other[1]), "source.json"), "w", encoding="utf-8") as f:
        json.dump({"source": SEASON_2027["source"], "failures": [], "rows": FIRST}, f)
    assert ts.main(other) == 1 and "not the season's" in capsys.readouterr().err
    absent = live_year(tmp_path / "d", FIRST)
    os.remove(os.path.join(os.path.dirname(absent[1]), "source.json"))
    assert ts.main(absent) == 1 and "source.json cannot be read" in capsys.readouterr().err
    assert not any(os.path.exists(cache_of(a)) for a in (no_run, retitled, other, absent))


def test_every_2026_event_s_key_is_still_in_the_cache():
    """The key's bytes are unchanged: every 2026 event, read through the frozen door and the merge with the season's
    prompt_version, gives the key the frozen file's own event gave, and the committed cache holds it."""
    path = os.path.join(ROOT, "data", "2026", "season.json")
    season = load_season(path)
    events, stamp = ts.season_events(season, os.path.dirname(path))
    with open(os.path.join(ROOT, "data", "2026", "events.json"), "rb") as f:
        frozen = json.loads(f.read().decode("utf-8"))["events"]
    assert stamp is None and season["prompt_version"] == 1 and [e["id"] for e in events] == [e["id"] for e in frozen]
    keys = [tag_key.input_key(tag_key.tagger_input(e), season["prompt_version"]) for e in events]
    assert keys == [tag_key.input_key(tag_key.tagger_input(e), 1) for e in frozen]
    assert set(keys) <= set(tag_key.load_cache(os.path.join(ROOT, "data", "2026", "tags.cache.jsonl")))


# --- seed ------------------------------------------------------------------------

def _seeding(tmp_path, source_version=VERSION):
    """A frozen 2026 beside a live 2027: 2026's cache answers a1's merged input, d4's, and one no 2027 event sends;
    2027's already answers d4's, its own way, and nobody answers e5's."""
    target = live_year(tmp_path, FIRST[:2] + [raw("d4", "Trek Trivia", "Name that starship."),
                                              raw("e5", "Sew a Beret", "Bring fabric.")])
    events = {e["id"]: e for e in events_of(target)[0]}
    folder = tmp_path / "2026"
    folder.mkdir()
    (folder / "season.json").write_text(json.dumps({**SEASON_2026, "prompt_version": source_version}),
                                        encoding="utf-8")
    unused = ev("A Panel 2027 Never Holds")
    tag_key.write_cache(str(folder / "tags.cache.jsonl"),
                        {key(events["a1"]): entry(events["a1"], kind="qa", model="hand"),
                         key(events["d4"]): entry(events["d4"], kind="panel"), key(unused): entry(unused)})
    tag_key.write_cache(cache_of(target), {key(events["d4"]): entry(events["d4"], kind="contest")})
    return target, events, folder / "tags.cache.jsonl"


def test_seed_copies_the_lines_the_season_needs_as_they_are(tmp_path, capsys):
    target, events, source = _seeding(tmp_path)
    assert ts.main(["seed", "--season", target[1], "--from", "2026"]) == 0
    assert "3 inputs" in (err := capsys.readouterr().err) and "1 copied, 1 already present, 1 skipped" in err
    lines = open(cache_of(target), encoding="utf-8").read().splitlines()
    source_lines = open(source, encoding="utf-8").read().splitlines()
    copied = [line for line in lines if json.loads(line)["key"] == key(events["a1"])]
    assert copied and copied[0] in source_lines                                 # the source's line, byte for byte
    assert {json.loads(line)["key"] for line in lines} == {key(events["a1"]), key(events["d4"])}
    assert tag_key.load_cache(cache_of(target))[key(events["d4"])]["answer"]["kind"] == "contest"   # its own kept
    before = open(cache_of(target), "rb").read()
    assert ts.main(["seed", "--season", target[1], "--from", "2026"]) == 0     # a second seed copies nothing new
    assert "0 copied, 2 already present, 1 skipped" in capsys.readouterr().err
    assert open(cache_of(target), "rb").read() == before


def test_seed_copies_nothing_when_the_versions_differ(tmp_path, capsys):
    """The source's cache here holds a line under the target's key; its season names another prompt_version, so it
    is not read, and nothing is copied or written."""
    target, events, source = _seeding(tmp_path, source_version=VERSION + 1)
    os.remove(cache_of(target))
    assert ts.main(["seed", "--season", target[1], "--from", "2026"]) == 0
    err = capsys.readouterr().err
    assert "prompt_version differs - 2026's is 2, 2027's 1" in err and "0 copied, 0 already present, 3 skipped" in err
    assert not os.path.exists(cache_of(target))


def test_seed_writes_the_season_s_cache_only_when_it_copies(tmp_path, capsys):
    target, events, source = _seeding(tmp_path)
    os.remove(cache_of(target))
    tag_key.write_cache(str(source), {})                                      # 2026 answers nothing 2027 sends
    assert ts.main(["seed", "--season", target[1], "--from", "2026"]) == 0
    assert "0 copied, 0 already present, 3 skipped" in capsys.readouterr().err
    assert not os.path.exists(cache_of(target))


def test_seed_refuses_a_frozen_season_one_with_no_source_json_and_a_source_with_no_cache(tmp_path, capsys):
    target, events, source = _seeding(tmp_path)
    with pytest.raises(SystemExit) as exc:
        ts.main(["seed", "--season", str(tmp_path / "2026" / "season.json"), "--from", "2026"])
    assert "is frozen (`frozen: true`" in str(exc.value.code) and "--dry-run" in str(exc.value.code)
    os.remove(source)
    with pytest.raises(SystemExit) as exc:
        ts.main(["seed", "--season", target[1], "--from", "2026"])
    assert "tags.cache.jsonl is absent: 2026 has no answers to copy" in str(exc.value.code)
    assert ts.main(["seed", "--season", target[1], "--from", "2025"]) == 1        # no such season
    assert "cannot be read" in capsys.readouterr().err
    os.remove(os.path.join(os.path.dirname(target[1]), "source.json"))
    with pytest.raises(SystemExit) as exc:
        ts.main(["seed", "--season", target[1], "--from", "2026"])
    assert "source.json is absent" in str(exc.value.code)


# --- a frozen year -------------------------------------------------------------

def test_a_frozen_year_runs_the_dry_run_and_nothing_else(tmp_path, monkeypatch, capsys):
    """2026 is frozen (#46): no request, no cache write and no mint - --dry-run --mint-only included, which minted
    before PR 7a - and the refusal names the flag."""
    event = ev("Star Trek: Prodigy Q&A", "Prodigy cast.")
    uncached = ev("A Panel No One Asked About", id="e2", start="2026-09-05T14:00")
    args = frozen_year(tmp_path, [event, uncached])
    tag_key.write_cache(cache_of(args), {key(event): entry(event, kind="qa", works=[work("Star Trek: Prodigy")])})
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", refusing, "m"))
    works = tmp_path / "registry" / "works.json"
    before = (open(cache_of(args), "rb").read(), works.read_bytes())
    for more in ([], ["--mint-only"], ["--no-mint"], ["--no-parents"]):
        with pytest.raises(SystemExit) as exc:
            ts.main(args + more)
        assert "is frozen (`frozen: true`, DECISIONS #46)" in str(exc.value.code), more
        assert "--dry-run only" in str(exc.value.code), more
    assert ts.main(args + ["--dry-run"]) == 0
    assert "1 to send in 1 request(s)" in capsys.readouterr().err
    assert ts.main(args + ["--dry-run", "--mint-only"]) == 0
    assert "would mint: star-trek-prodigy" in capsys.readouterr().err
    assert (open(cache_of(args), "rb").read(), works.read_bytes()) == before


# --- mint --------------------------------------------------------------------

def test_a_name_the_registry_misses_is_minted_unreviewed(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("The Rookie Cast", "Q&A.")
    plan = ts.mint_plan([event], {key(event): entry(event, works=[work("The Rookie")])}, reg, VERSION)
    assert plan["works"] == [{"id": "the-rookie", "name": "The Rookie", "aliases": [], "type": "franchise",
                              "reviewed": False}]
    assert plan["details"][0]["events"] == 1 and plan["details"][0]["evidence"] == ["The Rookie"]


def test_a_name_the_registry_holds_mints_nothing(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("Serenity Sing-along", "Firefly!")
    cache = {key(event): entry(event, works=[work("Serenity"), work("FIREFLY", "Firefly")])}
    assert ts.mint_plan([event], cache, reg, VERSION)["works"] == []


def test_the_x_and_x_are_one_work_named_by_the_most_used_spelling(tmp_path):
    reg = registry_at(tmp_path)
    events = [ev("The Rookie Cast", "Q&A.", id="a"), ev("The Rookie Cast", "Q&A.", id="b"),
              ev("Rookie Fans", "A fan panel.", id="c")]
    cache = {key(events[0]): entry(events[0], works=[work("The Rookie")]),
             key(events[2]): entry(events[2], works=[work("Rookie")])}
    plan = ts.mint_plan(events, cache, reg, VERSION)
    assert [(w["id"], w["name"]) for w in plan["works"]] == [("the-rookie", "The Rookie")]
    assert plan["details"][0]["events"] == 3 and plan["details"][0]["spellings"] == {"The Rookie": 2, "Rookie": 1}


def test_a_slug_that_is_already_an_id_is_reported_not_minted(tmp_path):
    castle = {"id": "castle", "name": "Castle (TV)", "aliases": [], "type": "franchise", "reviewed": True}
    reg = registry_at(tmp_path, works=[castle])
    event = ev("A Castle", "A castle.")
    plan = ts.mint_plan([event], {key(event): entry(event, works=[work("Castle")])}, reg, VERSION)
    assert plan["works"] == [] and [(c["name"], c["id"]) for c in plan["collisions"]] == [("Castle", "castle")]


def test_a_work_named_by_a_registry_term_is_skipped_by_mint_and_reported(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("DDAL FR-DC-TDD-03: The Zephyr's Fold", "Betrayed!", tracks=["Role-Playing Games (Non-Campaign)"],
               type="gaming")
    plan = ts.mint_plan([event], {key(event): entry(event, kind="gaming", works=[work("DDAL", type="game")])}, reg,
                        VERSION)
    assert plan["works"] == [] and [(t["name"], t["events"]) for t in plan["terms"]] == [("DDAL", 1)]


def test_only_the_entries_the_events_use_are_minted_from(tmp_path):
    reg = registry_at(tmp_path)
    used, gone = ev("The Rookie Cast", "Q&A."), ev("A panel that is not on the schedule", "Stale.")
    cache = {key(used): entry(used, works=[work("The Rookie")]), key(gone): entry(gone, works=[work("Stale", "Stale")])}
    assert [w["id"] for w in ts.mint_plan([used], cache, reg, VERSION)["works"]] == ["the-rookie"]
    assert ts.mint_plan([used], cache, reg, VERSION + 1)["works"] == []   # the season's version is the key's


def test_type_and_family_the_most_common_wins_and_ties_conflicts_and_defaults_are_reported(tmp_path):
    reg = registry_at(tmp_path)
    events = [ev(f"Hollow Knight {i}", "Hollow Knight, Some Show, Some Game, Tied.", id=str(i)) for i in range(4)]
    answers = [[work("Hollow Knight", type="game", family="video"), work("Tied", type="franchise")],
               [work("Hollow Knight", type="game", family="video"), work("Tied", type="game", family="board")],
               [work("Hollow Knight", type="game", family="board"), work("Some Show", type="show")],
               [work("Some Game", type="game", family="handheld")]]
    cache = {key(e): entry(e, works=a) for e, a in zip(events, answers)}
    plan = ts.mint_plan(events, cache, reg, VERSION)
    made = {w["id"]: w for w in plan["works"]}
    assert (made["hollow-knight"]["type"], made["hollow-knight"]["family"]) == ("game", "video")
    assert made["tied"]["type"] == "franchise" and "family" not in made["tied"]   # a tie goes to the first by name
    assert made["some-show"]["type"] == "franchise" and made["some-game"]["family"] == "video"
    assert plan["defaulted"] == [{"id": "some-game", "field": "family", "value": "video"},
                                 {"id": "some-show", "field": "type", "value": "franchise"}]
    assert [(t["id"], t["field"]) for t in plan["ties"]] == [("tied", "type")]
    assert [(c["id"], c["field"]) for c in plan["conflicts"]] == [("hollow-knight", "family")]


def test_parents_are_asked_for_the_planned_works_only_from_a_closed_list(tmp_path):
    older = {"id": "left-alone", "name": "Left Alone", "aliases": [], "type": "franchise", "reviewed": False}
    reg = registry_at(tmp_path, works=[FIREFLY, TREK, older])
    new = [{"id": "star-trek-prodigy", "name": "Star Trek: Prodigy", "aliases": [], "type": "franchise",
            "reviewed": False},
           {"id": "prodigy-comics", "name": "Prodigy Comics", "aliases": [], "type": "franchise", "reviewed": False}]
    sent = []

    def transport(prompt, model, meta):
        sent.append(prompt)
        return json.dumps([{"id": "star-trek-prodigy", "parent": "star-trek"},
                           {"id": "prodigy-comics", "parent": "star-trek-prodigy"},   # a planned work may be a parent
                           {"id": "left-alone", "parent": "star-trek"},              # not planned: not re-asked
                           {"id": "star-trek-prodigy", "parent": "not-an-id"}])
    placed = ts.place_parents(new, reg, transport, "m")
    assert placed == {"star-trek-prodigy": "star-trek", "prodigy-comics": "star-trek-prodigy"}
    asked = sent[0].split("works:\n", 1)[1]
    assert "star-trek-prodigy" in asked and "left-alone" not in asked


def test_a_parent_that_would_make_a_cycle_is_not_applied():
    assert ts.acyclic({"a": "b", "b": "a"}, {}) == {"a": "b"}
    assert ts.acyclic({"a": "a"}, {}) == {}
    assert ts.acyclic({"x": "star-trek"}, {"star-trek": None}) == {"x": "star-trek"}


def _minting(tmp_path, monkeypatch, parents_fail=False, run=True):
    """A live year of one event whose cached answer names a work the registry lacks, after one run (T1)."""
    xmen = {"id": "x-men", "name": "X-Men", "aliases": [], "type": "franchise", "reviewed": True}
    first = [raw("p1", "Star Trek: Prodigy Q&A", "Prodigy cast.", tracks=["Trek Track"])]
    args = live_year(tmp_path, first, works=(FIREFLY, TREK, DND, xmen))   # the new row is not the last line
    event = {**first[0], "id": "p1"}
    tag_key.write_cache(cache_of(args), {key(event): entry(event, kind="qa", works=[work("Star Trek: Prodigy")])})
    if not run:
        os.remove(os.path.join(os.path.dirname(args[1]), "last-run.json"))
    calls = []

    def transport(prompt, model, meta):
        calls.append(prompt)
        if parents_fail:
            raise RuntimeError("overloaded")
        return json.dumps([{"id": "star-trek-prodigy", "parent": "star-trek"}])
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    return args, calls


def test_mint_writes_added_rows_only_each_carrying_minted_and_the_registry_still_loads(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch)
    path = tmp_path / "registry" / "works.json"
    before = path.read_text(encoding="utf-8").splitlines()
    assert ts.main(args) == 0
    after = path.read_text(encoding="utf-8").splitlines()
    assert [line for line in after if line not in before] == [
        '  {"id": "star-trek-prodigy", "name": "Star Trek: Prodigy", "aliases": [], "type": "franchise", '
        '"parent": "star-trek", "reviewed": false, "minted": {"year": 2027, "run": "2027-08-01T10:00:00+00:00"}},']
    assert [line for line in before if line not in after] == []   # nothing removed or changed: no row gains minted
    reg = registry.load(str(tmp_path / "registry"))
    assert reg.resolve_work("Star Trek: Prodigy") == "star-trek-prodigy" and len(calls) == 1   # the parents request
    assert sum("minted" in w for w in reg.works) == 1


def test_mint_works_is_the_mint_with_no_file_and_works_rows_what_mint_writes(tmp_path):
    # the orchestrator (pipeline.py) mints through mint_works and writes works_rows itself, after registry.check
    reg = registry_at(tmp_path / "registry")
    event = ev("The Expanse Panel")
    cache = {key(event): entry(event, works=[work("The Expanse")])}
    files = {name: (tmp_path / "registry" / name).read_bytes() for name in registry.FILES}
    result = ts.TagResult(model="m")
    plan = ts.mint_works(result, [event], cache, reg, VERSION, refusing, "m", minted={"year": 2027, "run": T1},
                         parents=False)
    assert [(w["id"], w["minted"]) for w in plan["works"]] == [("the-expanse", {"year": 2027, "run": T1})]
    assert result.minted == []                                        # the caller's, once the rows are written
    assert {name: (tmp_path / "registry" / name).read_bytes() for name in registry.FILES} == files
    rows = ts.works_rows(reg, plan["works"])
    assert [w["id"] for w in rows] == ["dungeons-and-dragons", "firefly", "star-trek", "the-expanse"]
    assert list(rows[-1]) == ["id", "name", "aliases", "type", "reviewed", "minted"]
    ts.mint(ts.TagResult(model="m"), [event], cache, reg, VERSION, str(tmp_path / "registry"), refusing, "m",
            minted={"year": 2027, "run": T1}, parents=False)
    assert (tmp_path / "registry" / "works.json").read_text(encoding="utf-8") == dp.json_text(rows)


def test_a_failed_parents_request_writes_nothing(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch, parents_fail=True)
    path = tmp_path / "registry" / "works.json"
    before = path.read_bytes()
    assert ts.main(args) == 1 and path.read_bytes() == before
    assert ts.main(args + ["--no-parents"]) == 0
    assert registry.load(str(tmp_path / "registry")).resolve_work("Star Trek: Prodigy") == "star-trek-prodigy"


def test_the_result_counts_the_mint_its_parents_requests_and_a_mint_that_failed(tmp_path, monkeypatch):
    args, _ = _minting(tmp_path, monkeypatch, parents_fail=True)
    events, stamp = events_of(args)
    reg = registry.load(str(tmp_path / "registry"))
    cache = tag_key.load_cache(cache_of(args))
    minted = {"year": 2027, "run": stamp}

    def mint(transport, parents=True):
        result = ts.TagResult(model="m")
        plan = ts.mint(result, events, cache, reg, VERSION, str(tmp_path / "registry"), transport, "m",
                       minted=minted, parents=parents)
        return result, plan

    def down(prompt, model, meta):
        raise RuntimeError("overloaded")

    result, plan = mint(down)
    assert (result.minted, result.mint_failed, result.parents_requests) == ([], ["star-trek-prodigy"], 1)
    assert "parents_failed" in plan
    result, plan = mint(refusing, parents=False)
    assert (result.minted, result.mint_failed, result.parents_requests) == (["star-trek-prodigy"], [], 0)


def test_mint_only_calls_no_model(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch)
    assert ts.main(args + ["--mint-only"]) == 0 and calls == []
    prodigy = registry.load(str(tmp_path / "registry")).by_id()["star-trek-prodigy"]
    assert "parent" not in prodigy and prodigy["reviewed"] is False
    assert prodigy["minted"] == {"year": 2027, "run": T1}


def test_a_live_year_with_no_last_run_cannot_mint(tmp_path, monkeypatch, capsys):
    args, calls = _minting(tmp_path, monkeypatch, run=False)
    before = (tmp_path / "registry" / "works.json").read_bytes()
    assert ts.main(args + ["--mint-only"]) == 1 and calls == []
    assert "a live year needs a run" in capsys.readouterr().err
    assert (tmp_path / "registry" / "works.json").read_bytes() == before


def test_rewriting_the_committed_works_json_changes_no_line():
    """Mint writes the whole file; every row it did not add must come out as it went in."""
    path = os.path.join(ROOT, registry.DIR, "works.json")
    reg = registry.load(os.path.join(ROOT, registry.DIR))
    rows = [dp.in_order(w, registry.WORK_KEYS) for w in sorted(reg.works, key=lambda w: w["id"])]
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        dp.write_json(os.path.join(tmp, "works.json"), rows)
        assert open(os.path.join(tmp, "works.json"), "rb").read() == open(path, "rb").read()


# --- the command -------------------------------------------------------------

def test_a_second_run_sends_nothing(tmp_path, monkeypatch):
    # two listings of one input, at two times, and another
    args = live_year(tmp_path, [raw("a1", "Castle Cast", "Q&A."),
                                raw("b2", "Castle Cast", "Q&A.", start="2027-09-04T15:00"),
                                raw("c3", "Firefly Reunion", "Serenity!")])
    transport = scripted(lambda e, call: row(kind="qa"))
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint"]) == 0
    assert transport.calls == [["Castle Cast", "Firefly Reunion"]]      # three events, two inputs
    first = open(cache_of(args), "rb").read()
    assert ts.main(args + ["--no-mint"]) == 0
    assert len(transport.calls) == 1 and open(cache_of(args), "rb").read() == first


def test_the_cache_is_on_disk_after_every_request(tmp_path, monkeypatch):
    args = live_year(tmp_path, [raw("a1", "A Panel"), raw("b2", "B Panel")])

    def answer(prompt, model, meta):
        if '"B Panel"' in prompt:
            raise RuntimeError("the connection dropped")
        return json.dumps([{"id": "e1", **row()}])
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", answer, "m"))
    assert ts.main(args + ["--no-mint", "--per-request", "1"]) == 1          # B failed
    assert [e["title"] for e in tag_key.load_cache(cache_of(args)).values()] == ["A Panel"]


def test_the_cap_is_the_season_s_and_requests_overrides_it(tmp_path, monkeypatch, capsys):
    """A season whose cap is one request: the first run sends one and leaves two capped, exiting 0 since a later run
    takes them; --requests lets a hand run past it, as a season's first full tag is run."""
    season = {**SEASON_2027, "thresholds": {**SEASON_2027["thresholds"], "requests_per_run": 1}}
    args = live_year(tmp_path, [raw(s, f"Panel {s}") for s in ("a1", "b2", "c3")], season=season)
    transport = scripted(lambda e, call: row())
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint", "--per-request", "1"]) == 0
    assert transport.calls == [["Panel a1"]] and "capped: 2 input(s)" in capsys.readouterr().err
    assert ts.main(args + ["--no-mint", "--per-request", "1", "--requests", "5"]) == 0
    assert transport.calls[1:] == [["Panel b2"], ["Panel c3"]] and len(tag_key.load_cache(cache_of(args))) == 3
    with pytest.raises(SystemExit):
        ts.main(args + ["--requests", "0"])


def test_only_asks_about_the_inputs_of_the_events_it_names(tmp_path, monkeypatch):
    """--only, a file of event ids - our ids - one a line, as the pilot writes it."""
    args = live_year(tmp_path, [raw("a1", "A Panel"), raw("b2", "B Panel"), raw("c3", "C Panel")])
    (tmp_path / "ids.txt").write_text("b2\nnot-an-id\n", encoding="utf-8")
    transport = scripted(lambda e, call: row())
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint", "--only", str(tmp_path / "ids.txt")]) == 0
    assert transport.calls == [["B Panel"]]


def test_a_hand_run_exits_1_when_an_input_goes_unanswered(tmp_path, monkeypatch):
    args = live_year(tmp_path, [raw("a1", "A Panel")])
    transport = scripted(lambda e, call: None)                                   # the reply never holds it
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint"]) == 1 and len(transport.calls) == 2    # asked, and asked again


def test_the_tag_stage_keys_the_cache_by_the_season_s_prompt_version(tmp_path, monkeypatch):
    """A season of prompt_version 2 whose cache already answers one input under 2: only the other is sent."""
    args = live_year(tmp_path, [raw("a1", "A Panel"), raw("b2", "B Panel")],
                     season={**SEASON_2027, "prompt_version": 2})
    done = {**raw("a1", "A Panel"), "id": "a1"}
    tag_key.write_cache(cache_of(args), {key(done, 2): entry(done, version=2)})
    transport = scripted(lambda e, call: row())
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args + ["--no-mint"]) == 0 and transport.calls == [["B Panel"]]


# --- the pilot and the census stay off the tag and build path -----------------

def test_neither_tag_stage_nor_events_v2_imports_the_pilot_or_the_census():
    """tools/tag_pilot.py string-matches work names against event text to choose test events, and
    census_v2.py matches text to choose the rows it lists. Only a model's answer may link an event to a
    work, so nothing on the tag or build path may import either - the merge and the key's module included."""
    for name in ("tag_stage.py", "events_v2.py", "merge_stage.py", "tag_key.py"):
        tree = ast.parse(open(os.path.join(ROOT, name), encoding="utf-8").read())
        imported = {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names} | \
                   {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
        assert not any("pilot" in (m or "") or "census_v2" in (m or "") or (m or "").startswith("tools")
                       for m in imported), name
    code = "import sys; sys.path.insert(0, sys.argv[1]); import tag_stage, events_v2; " \
           "print(sorted(m for m in sys.modules if 'pilot' in m or 'census_v2' in m))"
    out = subprocess.run([sys.executable, "-c", code, ROOT], capture_output=True, text=True, check=True).stdout
    assert out.strip() == "[]"
