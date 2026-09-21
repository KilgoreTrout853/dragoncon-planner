"""Tests for tag_stage.py with the model mocked: the input and its key, the prompt, the checks an answer
passes before it is cached, the cache, and mint. Nothing here calls a model or the network; the one
test that reads data/ checks that mint's rewrite of works.json changes no committed line.

Run:  python -m pytest tests/
"""
import ast
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import draft_people as dp  # noqa: E402
import registry  # noqa: E402
import tag_stage as ts  # noqa: E402

FIREFLY = {"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": True}
TREK = {"id": "star-trek", "name": "Star Trek", "aliases": ["Trek"], "type": "franchise", "reviewed": True}
DND = {"id": "dungeons-and-dragons", "name": "Dungeons & Dragons", "aliases": ["D&D"], "type": "game",
       "family": "rpg", "terms": ["DDAL", "Adventurers League"], "reviewed": True}


def ev(title, description="", tracks=("Main Programming",), type="panel", speakers=(), id="e1",
       start="2026-09-05T11:30"):
    tracks = list(tracks)
    return {"id": id, "type": type, "title": title, "day": start[:10], "start": start, "description": description,
            "tracks": tracks, "track": tracks[0] if tracks else "",
            "speakers": [{"name": n, "role": r} for n, r in speakers], "cancelled": False}


def key(event):
    return ts.input_key(ts.tagger_input(event))


def registry_at(path, works=(FIREFLY, TREK, DND), people=(), tracks=()):
    os.makedirs(path, exist_ok=True)
    for name, rows in (("works.json", list(works)), ("people.json", list(people)), ("tracks.json", list(tracks))):
        dp.write_json(os.path.join(path, name), [dp.in_order(r, dp.WORK_KEYS) if name == "works.json" else r
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


def entry(event, **answer):
    """A cache entry for an event, as the tag stage would have written it."""
    inp = ts.tagger_input(event)
    return {"key": ts.input_key(inp), "title": inp["title"], "model": "test-model",
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


INP = {"title": "Castle Cast", "type": "panel", "tracks": ["Main Programming"],
       "description": "Bring your questions for our guests from the crime drama Castle!"}


# --- what is sent, and the key ---------------------------------------------

def test_the_input_is_four_fields_and_no_people():
    event = ev("Castle Cast", "Bring questions! Additional Panelists: Jim Wert(Moderator)",
               speakers=[("Nathan Fillion", "Speaker")])
    assert ts.tagger_input(event) == {"title": "Castle Cast", "type": "panel", "tracks": ["Main Programming"],
                                      "description": "Bring questions!"}


def test_the_key_is_the_same_whatever_order_the_input_is_in():
    inp = ts.tagger_input(ev("Castle Cast", "Q&A."))
    assert ts.input_key(inp) == ts.input_key(dict(reversed(list(inp.items()))))
    assert len(ts.input_key(inp)) == 64 and int(ts.input_key(inp), 16) >= 0


def test_the_key_is_the_same_under_two_hash_seeds():
    event = json.dumps(ev("Pokémon: Master Quest", "Our heroes go to the Whirl Cup.", tracks=["Anime/Manga", "Kids Track"]))
    code = ("import json, sys; sys.path.insert(0, sys.argv[1]); import tag_stage as ts; "
            "print(ts.input_key(ts.tagger_input(json.loads(sys.argv[2]))))")
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
    batch = [(before, ts.tagger_input(event))]
    assert ts.build_prompt(batch, ts.works_guide(small.works))[0] != ts.build_prompt(batch, ts.works_guide(large.works))[0]
    assert key(event) == before


def test_the_key_changes_with_the_version_the_title_the_type_the_tracks_and_the_description(monkeypatch):
    base = ev("Castle Cast", "Q&A.", tracks=["Main Programming"])
    variants = [ev("Castle Cast Two", "Q&A."), ev("castle cast", "Q&A."), ev("Castle Cast", "Q&A.", type="gaming"),
                ev("Castle Cast", "Q&A.", tracks=["Video Room"]),
                ev("Castle Cast", "Q&A.", tracks=["Main Programming", "BritTrack"]),
                ev("Castle Cast", "Q&A!")]
    assert len({key(base)} | {key(v) for v in variants}) == 1 + len(variants)
    before = key(base)
    monkeypatch.setattr(ts, "PROMPT_VERSION", ts.PROMPT_VERSION + 1)
    assert key(base) != before


def test_sessions_that_differ_only_in_a_price_a_clock_time_or_sold_out_share_a_key():
    beret = ["Sew a Beret - $$ 12:45p-2:45p SOLD OUT", "Sew a Beret - $$ 3:00-5:00p", "Sew a Beret"]
    assert len({key(ev(t, "Bring fabric.")) for t in beret}) == 1
    # a facet after a separator: strip_facets leaves "Matt Dinniman - Signing -", and clean_title trims it
    assert key(ev("Matt Dinniman - Signing - SOLD OUT")) == key(ev("Matt Dinniman - Signing"))
    assert ts.clean_title("CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue") == \
        "Dragon Con Burlesque: A Glamour Geek Revue"
    assert ts.clean_title("  Photo  Session:   Castle Duo ") == "Photo Session: Castle Duo"   # case kept


def test_the_panelist_line_is_not_sent():
    a = ev("Castle Cast", "Bring questions! Additional Panelists: Jim Wert(Moderator), Alli Martin")
    b = ev("Castle Cast", "Bring questions! Additional Panelists: Sarah Rose(Moderator)")
    assert key(a) == key(b) == key(ev("Castle Cast", "Bring questions!"))
    prompt = ts.build_prompt([(key(a), ts.tagger_input(a))], "")[0]
    assert "Jim Wert" not in prompt and "Additional Panelists" not in prompt


def test_the_description_is_trimmed_and_capped():
    long = ev("T", "  " + "x" * (ts.DESCRIPTION_CAP + 500) + "\n ")
    assert ts.tagger_input(long)["description"] == "x" * ts.DESCRIPTION_CAP
    assert ts.over_cap(long) and not ts.over_cap(ev("T", "short"))


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
    inputs, _ = ts.distinct_inputs(events)
    todo = sorted(inputs.items(), key=ts.request_order)
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


def test_missing_and_rejected_rows_are_asked_once_more_then_left_uncached_and_reported():
    events = [ev("A Panel", id="a"), ev("B Panel", id="b"), ev("C Panel", id="c")]
    inputs, _ = ts.distinct_inputs(events)
    todo = sorted(inputs.items(), key=ts.request_order)

    def answer(e, call):
        if e["title"] == "A Panel":
            return row()
        if e["title"] == "B Panel":
            return row(kind="keynote") if call == 1 else row(kind="qa")
        return None                                   # C is never answered

    transport, cache = scripted(answer), {}
    missing, tally, requests, stopped = ts.tag(todo, "", transport, "m", cache, lambda c: None)
    assert transport.calls == [["A Panel", "B Panel", "C Panel"], ["B Panel", "C Panel"]]
    assert [inputs[k]["title"] for k in missing] == ["C Panel"] and not stopped
    assert sorted(e["title"] for e in cache.values()) == ["A Panel", "B Panel"]
    assert cache[key(events[1])]["answer"]["kind"] == "qa" and len(tally["kind_rejected"]) == 1
    assert {e["model"] for e in cache.values()} == {"claude-test-1"}   # the model that answered, not the alias


def test_three_failed_requests_in_a_row_stop_the_run():
    events = [ev(f"Panel {i}", id=str(i)) for i in range(5)]
    todo = sorted(ts.distinct_inputs(events)[0].items(), key=ts.request_order)
    calls = []

    def down(prompt, model, meta):
        calls.append(1)
        raise RuntimeError("rate limited")
    missing, _, requests, stopped = ts.tag(todo, "", down, "m", {}, lambda c: None, per_request=1)
    assert stopped and len(calls) == ts.STOP_AFTER_FAILURES and len(missing) == 5


# --- the cache ---------------------------------------------------------------

def test_the_cache_round_trips_sorted_lf_one_entry_a_line_fields_in_order(tmp_path):
    entries = [entry(ev(t), kind="qa", works=[work("Castle", "Castle")] if "Castle" in t else [])
               for t in ("Castle Cast", "Opening Ceremonies", "Pokémon Trivia")]
    scrambled = {e["key"]: {"answer": dict(reversed(list(e["answer"].items()))), "model": e["model"],
                            "title": e["title"], "key": e["key"]} for e in entries}
    path = str(tmp_path / "tags.cache.jsonl")
    ts.write_cache(path, scrambled)
    raw = open(path, "rb").read()
    assert b"\r" not in raw and raw.endswith(b"\n") and "Pokémon".encode() in raw
    lines = raw.decode("utf-8").splitlines()
    assert len(lines) == 3 and [json.loads(line)["key"] for line in lines] == sorted(scrambled)
    assert all(list(json.loads(line)) == list(ts.CACHE_FIELDS) for line in lines)
    assert all(list(json.loads(line)["answer"]) == list(ts.ANSWER_FIELDS) for line in lines)
    back = ts.load_cache(path)
    assert {k: e["answer"] for k, e in back.items()} == {e["key"]: e["answer"] for e in entries}
    ts.write_cache(path, back)
    assert open(path, "rb").read() == raw
    assert ts.load_cache(str(tmp_path / "absent.jsonl")) == {}


def test_a_line_that_is_not_an_entry_is_an_error(tmp_path):
    path = tmp_path / "tags.cache.jsonl"
    path.write_text('{"key": "k", "answer": {}}\n', encoding="utf-8")
    with pytest.raises(ValueError):
        ts.load_cache(str(path))


def _files(tmp_path, events, works=(FIREFLY, TREK, DND)):
    (tmp_path / "events.json").write_text(json.dumps({"generated_at": "2026-09-07", "events": events}),
                                          encoding="utf-8")
    registry_at(tmp_path / "registry", works=works)
    return ["--events", str(tmp_path / "events.json"), "--registry", str(tmp_path / "registry"),
            "--cache", str(tmp_path / "tags.cache.jsonl")]


def test_a_second_run_sends_nothing(tmp_path, monkeypatch):
    events = [ev("Castle Cast", "Q&A.", speakers=[("Nathan Fillion", "Speaker")], id="a"),
              ev("Castle Cast", "Q&A.", speakers=[("Seamus Dever", "Speaker")], id="b"),
              ev("Firefly Reunion", "Serenity!", id="c")]
    args = _files(tmp_path, events) + ["--no-mint"]
    transport = scripted(lambda e, call: row(kind="qa"))
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    assert ts.main(args) == 0
    assert transport.calls == [["Castle Cast", "Firefly Reunion"]]      # two events, one input
    first = open(tmp_path / "tags.cache.jsonl", "rb").read()
    assert ts.main(args) == 0
    assert len(transport.calls) == 1 and open(tmp_path / "tags.cache.jsonl", "rb").read() == first


def test_the_cache_is_on_disk_after_every_request(tmp_path, monkeypatch):
    events = [ev("A Panel", id="a"), ev("B Panel", id="b")]
    args = _files(tmp_path, events) + ["--no-mint", "--per-request", "1"]

    def answer(prompt, model, meta):
        if '"B Panel"' in prompt:
            raise RuntimeError("the connection dropped")
        return json.dumps([{"id": "e1", **row()}])
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", answer, "m"))
    assert ts.main(args) == 1                                                # B is unanswered
    assert [e["title"] for e in ts.load_cache(str(tmp_path / "tags.cache.jsonl")).values()] == ["A Panel"]


# --- mint --------------------------------------------------------------------

def test_a_name_the_registry_misses_is_minted_unreviewed(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("The Rookie Cast", "Q&A.")
    plan = ts.mint_plan([event], {key(event): entry(event, works=[work("The Rookie")])}, reg)
    assert plan["works"] == [{"id": "the-rookie", "name": "The Rookie", "aliases": [], "type": "franchise",
                              "reviewed": False}]
    assert plan["details"][0]["events"] == 1 and plan["details"][0]["evidence"] == ["The Rookie"]


def test_a_name_the_registry_holds_mints_nothing(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("Serenity Sing-along", "Firefly!")
    cache = {key(event): entry(event, works=[work("Serenity"), work("FIREFLY", "Firefly")])}
    assert ts.mint_plan([event], cache, reg)["works"] == []


def test_the_x_and_x_are_one_work_named_by_the_most_used_spelling(tmp_path):
    reg = registry_at(tmp_path)
    events = [ev("The Rookie Cast", "Q&A.", id="a"), ev("The Rookie Cast", "Q&A.", id="b"),
              ev("Rookie Fans", "A fan panel.", id="c")]
    cache = {key(events[0]): entry(events[0], works=[work("The Rookie")]),
             key(events[2]): entry(events[2], works=[work("Rookie")])}
    plan = ts.mint_plan(events, cache, reg)
    assert [(w["id"], w["name"]) for w in plan["works"]] == [("the-rookie", "The Rookie")]
    assert plan["details"][0]["events"] == 3 and plan["details"][0]["spellings"] == {"The Rookie": 2, "Rookie": 1}


def test_a_slug_that_is_already_an_id_is_reported_not_minted(tmp_path):
    castle = {"id": "castle", "name": "Castle (TV)", "aliases": [], "type": "franchise", "reviewed": True}
    reg = registry_at(tmp_path, works=[castle])
    event = ev("A Castle", "A castle.")
    plan = ts.mint_plan([event], {key(event): entry(event, works=[work("Castle")])}, reg)
    assert plan["works"] == [] and [(c["name"], c["id"]) for c in plan["collisions"]] == [("Castle", "castle")]


def test_a_work_named_by_a_registry_term_is_skipped_by_mint_and_reported(tmp_path):
    reg = registry_at(tmp_path)
    event = ev("DDAL FR-DC-TDD-03: The Zephyr's Fold", "Betrayed!", tracks=["Role-Playing Games (Non-Campaign)"],
               type="gaming")
    plan = ts.mint_plan([event], {key(event): entry(event, kind="gaming", works=[work("DDAL", type="game")])}, reg)
    assert plan["works"] == [] and [(t["name"], t["events"]) for t in plan["terms"]] == [("DDAL", 1)]


def test_only_the_entries_the_events_use_are_minted_from(tmp_path):
    reg = registry_at(tmp_path)
    used, gone = ev("The Rookie Cast", "Q&A."), ev("A panel that is not on the schedule", "Stale.")
    cache = {key(used): entry(used, works=[work("The Rookie")]), key(gone): entry(gone, works=[work("Stale", "Stale")])}
    assert [w["id"] for w in ts.mint_plan([used], cache, reg)["works"]] == ["the-rookie"]


def test_type_and_family_the_most_common_wins_and_ties_conflicts_and_defaults_are_reported(tmp_path):
    reg = registry_at(tmp_path)
    events = [ev(f"Hollow Knight {i}", "Hollow Knight, Some Show, Some Game, Tied.", id=str(i)) for i in range(4)]
    answers = [[work("Hollow Knight", type="game", family="video"), work("Tied", type="franchise")],
               [work("Hollow Knight", type="game", family="video"), work("Tied", type="game", family="board")],
               [work("Hollow Knight", type="game", family="board"), work("Some Show", type="show")],
               [work("Some Game", type="game", family="handheld")]]
    cache = {key(e): entry(e, works=a) for e, a in zip(events, answers)}
    plan = ts.mint_plan(events, cache, reg)
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


def _minting(tmp_path, monkeypatch, parents_fail=False):
    event = ev("Star Trek: Prodigy Q&A", "Prodigy cast.", tracks=["Trek Track"])
    xmen = {"id": "x-men", "name": "X-Men", "aliases": [], "type": "franchise", "reviewed": True}
    args = _files(tmp_path, [event], works=(FIREFLY, TREK, DND, xmen))   # the new row is not the last line
    ts.write_cache(args[5], {key(event): entry(event, kind="qa", works=[work("Star Trek: Prodigy")])})
    calls = []

    def transport(prompt, model, meta):
        calls.append(prompt)
        if parents_fail:
            raise RuntimeError("overloaded")
        return json.dumps([{"id": "star-trek-prodigy", "parent": "star-trek"}])
    monkeypatch.setattr(ts, "pick_transport", lambda model=None: ("test", transport, "m"))
    return args, calls


def test_mint_writes_added_rows_only_and_the_registry_still_loads(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch)
    path = tmp_path / "registry" / "works.json"
    before = path.read_text(encoding="utf-8").splitlines()
    assert ts.main(args) == 0
    after = path.read_text(encoding="utf-8").splitlines()
    assert [line for line in after if line not in before] == [
        '  {"id": "star-trek-prodigy", "name": "Star Trek: Prodigy", "aliases": [], "type": "franchise", '
        '"parent": "star-trek", "reviewed": false},']
    assert [line for line in before if line not in after] == []   # nothing removed or changed
    reg = registry.load(str(tmp_path / "registry"))
    assert reg.resolve_work("Star Trek: Prodigy") == "star-trek-prodigy" and len(calls) == 1   # the parents request


def test_a_failed_parents_request_writes_nothing(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch, parents_fail=True)
    path = tmp_path / "registry" / "works.json"
    before = path.read_bytes()
    assert ts.main(args) == 1 and path.read_bytes() == before
    assert ts.main(args + ["--no-parents"]) == 0
    assert registry.load(str(tmp_path / "registry")).resolve_work("Star Trek: Prodigy") == "star-trek-prodigy"


def test_mint_only_calls_no_model(tmp_path, monkeypatch):
    args, calls = _minting(tmp_path, monkeypatch)
    assert ts.main(args + ["--mint-only"]) == 0 and calls == []
    prodigy = registry.load(str(tmp_path / "registry")).by_id()["star-trek-prodigy"]
    assert "parent" not in prodigy and prodigy["reviewed"] is False


def test_rewriting_the_committed_works_json_changes_no_line():
    """Mint writes the whole file; every row it did not add must come out as it went in."""
    path = os.path.join(ROOT, registry.DIR, "works.json")
    reg = registry.load(os.path.join(ROOT, registry.DIR))
    rows = [dp.in_order(w, dp.WORK_KEYS) for w in sorted(reg.works, key=lambda w: w["id"])]
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        dp.write_json(os.path.join(tmp, "works.json"), rows)
        assert open(os.path.join(tmp, "works.json"), "rb").read() == open(path, "rb").read()


# --- the pilot stays off the tag and build path -------------------------------

def test_neither_tag_stage_nor_events_v2_imports_the_pilot():
    """tools/tag_pilot.py string-matches work names against event text to choose test events. Only a
    model's answer may link an event to a work, so nothing on the tag or build path may import it."""
    for name in ("tag_stage.py", "events_v2.py"):
        tree = ast.parse(open(os.path.join(ROOT, name), encoding="utf-8").read())
        imported = {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names} | \
                   {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
        assert not any("pilot" in (m or "") or (m or "").startswith("tools") for m in imported), name
    code = "import sys; sys.path.insert(0, sys.argv[1]); import tag_stage, events_v2; " \
           "print(sorted(m for m in sys.modules if 'pilot' in m))"
    out = subprocess.run([sys.executable, "-c", code, ROOT], capture_output=True, text=True, check=True).stdout
    assert out.strip() == "[]"
