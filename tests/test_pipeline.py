"""Tests for pipeline.py, the orchestrator (DECISIONS #44, #48; docs/pipeline/contract.md, The run, as built): a live
season's runs on a fake source - scraper.fetch replaced, the real scraper.carry() carrying the rows - and a mocked
model, in a season folder and a registry under tmp_path, with the clock, the SHA and the fetch code's hash injected.
What a run writes and what it leaves, last-run.json and its counters, the change log's prefix check, the snapshot's
fatal rules, the fatal runs, --to and --from, the attribution, the two builds, the annotations, the summary and the
season window. Nothing here reads data/ or the network.

Run:  python -m pytest tests/
"""
import builtins
import datetime as dt
import hashlib
import itertools
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import draft_people as dp  # noqa: E402
import events_v2  # noqa: E402
import ids_stage  # noqa: E402
import pipeline  # noqa: E402
import registry  # noqa: E402
import scraper  # noqa: E402
import tag_key  # noqa: E402
import tag_stage  # noqa: E402
from season import load as load_season  # noqa: E402

UTC = dt.timezone.utc
T1, T2, T3, T4 = (dt.datetime(2027, 8, 14, h, 17, 5, tzinfo=UTC) for h in (13, 14, 15, 16))
S1, S2, S3, S4 = (t.isoformat() for t in (T1, T2, T3, T4))
SEASON = {"year": 2027, "slug": "dragoncon27", "source": "https://app.core-apps.com/dragoncon27", "days": ["Sep  4"],
          "con": {"first": "2027-09-01", "last": "2027-09-06"}, "tz": "America/New_York",
          "window": {"from": "2027-08-01", "to": "2027-09-07"}, "frozen": False, "prompt_version": 1,
          "thresholds": {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 1, "requests_per_run": 40}}


def level(lid, name, order, rooms):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": {}, "notes": []}


def hotel(name, order, keys, levels=(), placeless=False):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": "rest", "levels": list(levels), "unplaced": {}}


VENUES = {"walk": {"Marriott|Courtland Grand": 10}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10,
          "hotels": [hotel("Marriott", 0, ["Marriott"], [level("atrium", "Atrium Level", 0, ["A", "A707"])]),
                     hotel("Courtland Grand", 1, ["Courtland Grand"], [level("grand", "Grand Level", 0, ["Athens"])]),
                     hotel("Streaming", 2, ["Streaming"], placeless=True),
                     hotel("Other", 3, ["O", "Other"], placeless=True),
                     hotel("Unknown", 4, [], placeless=True)]}
WORKS = [{"id": "firefly", "name": "Firefly", "aliases": ["Serenity"], "type": "franchise", "reviewed": True},
         {"id": "star-trek", "name": "Star Trek", "aliases": [], "type": "franchise", "reviewed": True}]
TRACKS = [{"id": "main-programming", "name": "Main Programming", "aliases": []}]
# What the mocked model says each title is about: (the work's name, the evidence it gives). The Expanse is in no
# registry, so the first run that tags it mints it.
ABOUT = {"Firefly Reunion": ("Firefly", "Firefly"), "Trek Trivia": ("Star Trek", "Trek"),
         "The Expanse Panel": ("The Expanse", "The Expanse")}
FILES = ("source.json", "ids.jsonl", "tags.cache.jsonl", "events.v2.json", "changes.jsonl", "last-run.json")
LAST_RUN_KEYS = ["stamp", "fetched_at", "changed_at", "sha", "fetch_code_hash", "fetch_code_changed", "changes_logged",
                 "digest", "season", "elapsed"]


def raw(sid, title, location="Marriott A", description="", tracks=("Main Programming",), start="2027-09-04T11:30"):
    """A raw row (#42) as a detail page gives it."""
    return {"source_id": sid, "type": "panel", "title": title, "day": start[:10], "start": start,
            "end": start[:11] + "12:30", "duration_min": 60, "location": location, "description": description,
            "tracks": list(tracks), "speakers": []}


def first_listings():
    """The fake source's first schedule: two copies of one panel, which are one event; a panel at the Courtland; one
    whose work the registry lacks; and a listing whose detail page fails, with no row to carry."""
    return {"a1": raw("a1", "Firefly Reunion"), "b2": raw("b2", "Firefly Reunion"),
            "c3": raw("c3", "Trek Trivia", "Courtland Grand Athens"), "d4": raw("d4", "The Expanse Panel"),
            "e5": None}


def lines(data):
    return [json.loads(x) for x in data.decode("utf-8").splitlines()]


class Year:
    """A live season's folder and its registry under tmp_path, and every edge of the run patched: the source, the
    model, the clock, the SHA, the fetch code's hash, the stopwatch and the result object's path."""

    def __init__(self, tmp_path, monkeypatch, season=SEASON):
        self.folder = tmp_path / "2027"
        self.folder.mkdir()
        self.season = self.folder / "season.json"
        self.season.write_text(json.dumps(season), encoding="utf-8")
        (self.folder / "venues.json").write_text(json.dumps(VENUES), encoding="utf-8")
        (self.folder / "ids.jsonl").write_bytes(b"")
        self.registry = tmp_path / "registry"
        self.registry.mkdir()
        dp.write_json(str(self.registry / "works.json"), [dp.in_order(w, registry.WORK_KEYS) for w in WORKS])
        dp.write_json(str(self.registry / "people.json"), [])
        dp.write_json(str(self.registry / "tracks.json"), TRACKS)
        self.result_path = tmp_path / "result.json"
        self.listed = first_listings()   # the source: source id -> its row, or None where its page fails
        self.fetch_error = None
        self.fetches = 0
        self.asked = []                  # the model's requests: ("tag", titles) or ("parents", None)
        self.silent = set()              # titles the model leaves out of its reply
        self.parents_fail = False
        self.at, self.hash = T1, "h1"
        monkeypatch.setattr(scraper, "fetch", self.fetch)
        monkeypatch.setattr(tag_stage, "pick_transport",
                            lambda model=None: ("the test model", self.transport, "claude-test-1"))
        monkeypatch.setattr(pipeline, "now", lambda: self.at)
        ticks = itertools.count(0, 1.5)   # a run reads it twice: elapsed is 1.5 s
        monkeypatch.setattr(pipeline, "stopwatch", lambda: next(ticks))
        monkeypatch.setattr(pipeline, "fetch_code_hash", lambda: self.hash)
        monkeypatch.setattr(pipeline, "REGISTRY", str(self.registry))
        monkeypatch.setattr(pipeline, "RESULT", str(self.result_path))
        monkeypatch.setenv("PIPELINE_SHA", "sha-one")
        monkeypatch.delenv("GITHUB_ACTIONS", raising=False)

    def fetch(self, season, previous, *, workers=3, limit=0, delay=0.15):
        """scraper.fetch() on the fake source: the first `limit` listings, carried as the real carry() carries them."""
        self.fetches += 1
        if self.fetch_error:
            raise self.fetch_error
        ids = list(self.listed)[:limit or None]
        listed = {sid: self.listed[sid] for sid in ids}
        rows = scraper.carry(listed, previous)
        return scraper.FetchResult(
            rows=rows, failures=[{"source_id": s, "error": "404 Client Error"} for s in sorted(ids) if not listed[s]],
            repaired=0, listings=len(ids), fetched=sum(1 for s in ids if listed[s]),
            carried_stale=sum(1 for r in rows if r.get("stale")),
            carried_removed=sum(1 for r in rows if r.get("removed")), seconds=0.5)

    def transport(self, prompt, model, meta):
        """The mocked model: a tag request answered by ABOUT, a parents request with no parent."""
        meta["model"] = "claude-test-1"
        if "\nEvents:\n" in prompt:
            events = json.loads(prompt.split("\nEvents:\n", 1)[1])
            self.asked.append(("tag", [e["title"] for e in events]))
            return json.dumps([{"id": e["id"], "kind": "panel", "works": [
                {"name": ABOUT[e["title"]][0], "evidence": ABOUT[e["title"]][1], "type": "franchise"}]
                if e["title"] in ABOUT else [], "medium": [], "genre": [], "craft": [], "subject": [],
                "audience": "all", "play": None} for e in events if e["title"] not in self.silent])
        self.asked.append(("parents", None))
        if self.parents_fail:
            raise RuntimeError("the parents request failed")
        return "[]"

    def run(self, *args, at=None):
        """pipeline.py run on the season -> (the exit code, the result object)."""
        if at is not None:
            self.at = at
        code = pipeline.main(["run", "--season", str(self.season), *args])
        return code, json.loads(self.result_path.read_text(encoding="utf-8"))

    def read(self):
        """{name: bytes or None} of the season's six files and the registry's works.json."""
        out = {name: (self.folder / name).read_bytes() if (self.folder / name).exists() else None for name in FILES}
        out["works.json"] = (self.registry / "works.json").read_bytes()
        return out

    def stat(self):
        """{name: (bytes, mtime_ns)}: what a run that writes nothing must leave as it was."""
        paths = [self.folder / name for name in FILES] + [self.registry / "works.json"]
        return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) if p.exists() else None for p in paths}

    def temps(self):
        return sorted(p.name for p in list(self.folder.iterdir()) + list(self.registry.iterdir())
                      if p.name.endswith(".tmp"))


@pytest.fixture
def year(tmp_path, monkeypatch):
    return Year(tmp_path, monkeypatch)


def names(result):
    return [os.path.basename(p) for p in result["files"]]


# --- a first run, a second, a third ---------------------------------------------

def test_a_first_run_writes_every_file_with_last_run_json_and_its_counters(year):
    code, result = year.run()
    assert (code, result["outcome"]) == (0, "committed")
    assert names(result) == ["source.json", "ids.jsonl", "tags.cache.jsonl", "works.json", "events.v2.json",
                             "changes.jsonl", "last-run.json"]
    files = year.read()
    last = json.loads(files["last-run.json"])
    assert list(last) == LAST_RUN_KEYS + ["fetch", "ids", "tag", "build", "diff"]
    assert (last["stamp"], last["fetched_at"], last["changed_at"], last["sha"]) == (S1, S1, S1, "sha-one")
    assert (last["fetch_code_hash"], last["fetch_code_changed"], last["season"], last["elapsed"]) == ("h1", False,
                                                                                                    2027, 1.5)
    assert last["fetch"] == {"listings": 5, "fetched": 4, "stale": 0, "removed": 0, "failures": 1, "repaired": 0}
    assert last["ids"] == {"new": 3, "matches": 0, "merges": 0, "leavers": 0, "gone": 0, "returned": 0, "unsure": 0}
    assert last["tag"] == {"requests": 1, "sent": 3, "capped": 0, "failed": 0, "stopped": 0, "unanswered": 0,
                           "minted": 1, "mint_failed": 0}
    assert last["build"] == {"untagged": 0, "unresolved_names": 0, "unknown_tracks": 0, "rooms_unresolved": 0,
                             "hotels_unknown": 0,
                             "places": {"exact": 3, "alias": 0, "rule": 0, "level": 0, "hotel": 0, "none": 0}}
    assert last["diff"] == {"kinds": {"added": 3}, "causes": {"source": 3}}
    assert last["changes_logged"] == 3
    # the model asked once about the three inputs, then once for the minted work's parent, outside the cap
    assert year.asked == [("tag", ["Firefly Reunion", "The Expanse Panel", "Trek Trivia"]), ("parents", None)]
    doc = json.loads(files["events.v2.json"])
    assert (doc["generated_at"], doc["changed_at"], doc["digest"], doc["count"]) == (S1, S1, last["digest"], 3)
    assert doc["failures"] == [{"source_id": "e5", "error": "404 Client Error"}]
    events = {e["id"]: e for e in doc["events"]}
    assert list(events) == ["a1", "c3", "d4"]
    # the minted work resolves in the run that minted it: the build reads the registry the mint's rows passed
    assert events["d4"]["tags"]["works"] == [{"id": "the-expanse", "via": "about"}]
    works = json.loads(files["works.json"])
    assert [w for w in works if w["id"] == "the-expanse"] == [
        {"id": "the-expanse", "name": "The Expanse", "aliases": [], "type": "franchise", "reviewed": False,
         "minted": {"year": 2027, "run": S1}}]
    assert [(x["id"], x["kind"], x["run"], x["cause"]) for x in lines(files["changes.jsonl"])] == [
        ("a1", "added", S1, "source"), ("c3", "added", S1, "source"), ("d4", "added", S1, "source")]
    # the file is the build CI checks: the live front door, on the files as committed
    fresh, _ = events_v2.build_season(load_season(str(year.season)), str(year.folder), str(year.registry))
    assert events_v2.dumps(fresh) == files["events.v2.json"]
    assert year.temps() == []


def test_a_run_that_changes_nothing_writes_nothing_last_run_json_included(year):
    year.run()
    before = year.stat()
    code, result = year.run(at=T2)
    assert (code, result["outcome"], result["files"]) == (0, "nothing changed", [])
    assert year.stat() == before and year.temps() == []
    last = result["last_run"]    # the run's summary, reported and not written
    assert (last["stamp"], last["fetched_at"], last["changed_at"], last["changes_logged"]) == (S2, S2, S1, 0)
    assert last["tag"]["requests"] == 0 and len(year.asked) == 2    # every input cached; nothing minted again


def test_a_changing_run_writes_only_the_changed_files_and_appends_to_the_change_log(year):
    year.run()
    before = year.stat()
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")   # a move: the key changes, the input does not
    code, result = year.run(at=T2)
    assert (code, result["outcome"]) == (0, "committed")
    assert names(result) == ["source.json", "ids.jsonl", "events.v2.json", "changes.jsonl", "last-run.json"]
    after = year.stat()
    assert after["tags.cache.jsonl"] == before["tags.cache.jsonl"] and after["works.json"] == before["works.json"]
    old, new = before["changes.jsonl"][0], after["changes.jsonl"][0]
    assert new.startswith(old) and lines(new[len(old):]) == [
        {"run": S2, "sha": "sha-one", "id": "c3", "kind": "place",
         "from": {"hotel": "Courtland Grand", "room": "Athens"}, "to": {"hotel": "Marriott", "room": "A707"},
         "cause": "source"}]
    last = json.loads(after["last-run.json"][0])
    assert (last["fetched_at"], last["changed_at"], last["changes_logged"]) == (S2, S2, 1)
    assert last["diff"] == {"kinds": {"place": 1}, "causes": {"source": 1}}
    ledger = ids_stage.parse_ledger(after["ids.jsonl"][0], "ids.jsonl")
    assert ledger["c3"]["key"] == ["trek trivia", "2027-09-04T11:30", "marriott a707"]


def test_a_listing_gone_is_carried_removed_and_a_failed_page_stale_each_counted(year, monkeypatch, capsys):
    year.run()
    del year.listed["c3"]          # the source no longer lists c3: carried, removed
    year.listed["d4"] = None       # d4's page fails: carried, stale
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    capsys.readouterr()
    code, result = year.run(at=T2)
    assert (code, result["outcome"]) == (0, "committed")
    last = json.loads(year.read()["last-run.json"])
    assert last["fetch"] == {"listings": 4, "fetched": 2, "stale": 1, "removed": 1, "failures": 2, "repaired": 0}
    assert (last["ids"]["gone"], last["tag"]["sent"]) == (1, 0)
    events = {e["id"]: e for e in json.loads(year.read()["events.v2.json"])["events"]}
    assert (events["c3"].get("removed"), events["d4"].get("stale")) == (True, True)
    assert [(x["id"], x["kind"]) for x in lines(year.read()["changes.jsonl"]) if x["run"] == S2] == [("c3", "removed")]
    assert [x for x in capsys.readouterr().out.splitlines() if x.startswith("::")] == [
        "::warning title=pipeline::fetch.failures 2", "::warning title=pipeline::fetch.stale 1",
        "::notice title=pipeline::fetch.removed 1"]


def test_two_ids_that_come_to_share_a_key_merge_and_the_log_says_so(year, monkeypatch, capsys):
    year.run()
    year.listed["c3"] = raw("c3", "Firefly Reunion")     # c3 retitled and moved onto a1's key: one group, two ids
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    capsys.readouterr()
    code, result = year.run(at=T2)
    last = json.loads(year.read()["last-run.json"])
    assert (code, last["ids"]["merges"], last["diff"]["kinds"]) == (0, 1, {"merged": 1})
    events = {e["id"]: e for e in json.loads(year.read()["events.v2.json"])["events"]}
    assert "c3" not in events and events["a1"]["was"] == ["c3"]
    assert [(x["id"], x["kind"], x.get("to")) for x in lines(year.read()["changes.jsonl"]) if x["run"] == S2] == [
        ("c3", "merged", "a1")]
    assert "::warning title=pipeline::ids.merges 1" in capsys.readouterr().out.splitlines()
    assert result["details"]["merges"] == ["c3 into a1"]


def test_a_removed_event_is_never_sent_to_the_model(year):
    year.listed = {f"x{i:02}": raw(f"x{i:02}", f"Panel {i:02}") for i in range(26)}
    year.run("--requests", "1")    # Panel 25, last in request order, capped
    del year.listed["x25"]         # and then gone from the source: carried removed, its input still uncached
    year.run(at=T2)
    last = json.loads(year.read()["last-run.json"])
    assert (last["tag"]["requests"], last["tag"]["sent"], last["build"]["untagged"]) == (0, 0, 1)
    assert [len(titles) for kind, titles in year.asked] == [25]


def test_a_commit_writes_events_v2_json_whose_stamp_alone_moved_so_it_agrees_with_last_run_json(year):
    # the shorter description of a copy changes: source.json does, and the merged event, a1's longest, does not
    year.listed["a1"] = raw("a1", "Firefly Reunion", description="The crew of the Serenity, reunited on stage.")
    year.run()
    year.listed["b2"] = raw("b2", "Firefly Reunion", description="Short.")
    code, result = year.run(at=T2)
    assert (result["outcome"], names(result)) == ("committed", ["source.json", "events.v2.json", "last-run.json"])
    doc = json.loads(year.read()["events.v2.json"])
    last = json.loads(year.read()["last-run.json"])
    assert (doc["generated_at"], doc["changed_at"], last["fetched_at"], last["changes_logged"]) == (S2, S1, S2, 0)


# --- the change log's prefix check ----------------------------------------------

@pytest.mark.parametrize("corrupt, why", [
    (lambda text: text.replace(b'{"run":', b'{"run": ', 1), "does not begin with its committed bytes"),
    (lambda text: text[:-20] + b"\n", "is not JSON"),
])
def test_a_corrupted_change_log_fails_the_prefix_check_and_the_run_writes_nothing(year, corrupt, why):
    year.run()
    log = year.folder / "changes.jsonl"
    log.write_bytes(corrupt(log.read_bytes()))
    before = year.stat()
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")
    code, result = year.run(at=T2)
    assert (code, result["outcome"]) == (2, "fatal")
    assert result["error"].startswith("the prefix check fails") and why in result["error"]
    assert year.stat() == before and year.temps() == []


# --- fatal runs -------------------------------------------------------------------

def test_a_fatal_stage_writes_nothing_and_exits_2(year, capsys):
    year.run()
    before = year.stat()
    year.fetch_error = scraper.FetchError("the panel day list for Sep 4 failed: 503 Server Error")
    code, result = year.run(at=T2)
    assert (code, result["outcome"], result["files"]) == (2, "fatal", [])
    assert result["error"] == "FetchError: the panel day list for Sep 4 failed: 503 Server Error"
    assert year.stat() == before
    out, err = capsys.readouterr()
    assert "**Fatal:** FetchError: the panel day list" in out and "Traceback" not in err   # a stage's error: no trace


def test_new_ids_over_the_ceiling_are_fatal_and_so_is_any_other_exception(tmp_path, monkeypatch, capsys):
    year = Year(tmp_path, monkeypatch, {**SEASON, "thresholds": {**SEASON["thresholds"], "new_ids": 0.2}})
    year.listed = {f"x{i}": raw(f"x{i}", f"Panel {i}") for i in range(5)}
    assert year.run()[0] == 0
    before = year.stat()
    year.listed.update({"x5": raw("x5", "Panel 5"), "x6": raw("x6", "Panel 6")})
    code, result = year.run(at=T2)
    assert (code, result["error"]) == (2, "IdsError: 2 new ids, above new_ids 0.2 of the 5 lines before the run (1.0)")
    assert year.stat() == before
    year.fetch_error = KeyError("location")        # not a stage's error: fatal all the same (#44), with a traceback
    code, result = year.run(at=T3)
    assert (code, result["error"]) == (2, "KeyError: 'location'") and year.stat() == before
    assert "Traceback" in capsys.readouterr().err


@pytest.mark.parametrize("name, text, why", [
    ("events.v2.json", b'{"generated_at":', "events.v2.json cannot be read"),
    ("events.v2.json", b'{"events": []}\n', "not an object holding generated_at, changed_at, digest, events"),
    ("last-run.json", b"[]", "not an object holding stamp, fetched_at, changed_at, sha, fetch_code_hash"),
    ("source.json", None, "is not a source.json"),
    ("ids.jsonl", None, "is absent"),
])
def test_the_snapshot_s_fatal_rules(year, name, text, why):
    year.run()
    path = year.folder / name
    if name == "source.json":
        path.write_text(json.dumps({"source": SEASON["source"], "rows": []}), encoding="utf-8")
    elif text is None:
        path.unlink()
    else:
        path.write_bytes(text)
    before = year.stat()
    code, result = year.run(at=T2)
    assert (code, result["outcome"]) == (2, "fatal") and why in result["error"]
    assert year.stat() == before


def test_a_committed_file_with_no_source_json_behind_it_cannot_be_attributed(year, monkeypatch):
    year.run()
    (year.folder / "source.json").unlink()
    before = year.stat()
    monkeypatch.setenv("PIPELINE_SHA", "sha-two")
    code, result = year.run(at=T2)
    assert (code, result["outcome"]) == (2, "fatal") and "the attribution reads the previous run's rows" in result[
        "error"]
    assert year.stat() == before


def test_a_frozen_season_is_refused_with_force_or_without(tmp_path, monkeypatch):
    year = Year(tmp_path, monkeypatch, {**SEASON, "frozen": True, "window": None})
    for args in ((), ("--force",)):
        code, result = year.run(*args)
        assert (code, result["outcome"]) == (2, "fatal") and "frozen" in result["error"]
    assert year.fetches == 0 and year.read()["source.json"] is None


def test_a_write_that_fails_part_way_changes_no_file(year, monkeypatch):
    year.run()
    before = year.stat()
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")
    real = builtins.open

    def failing(file, mode="r", *args, **kwargs):
        if str(file).endswith("events.v2.json.tmp"):
            raise OSError(28, "No space left on device")
        return real(file, mode, *args, **kwargs)
    monkeypatch.setattr(builtins, "open", failing)
    code, result = year.run(at=T2)
    monkeypatch.setattr(builtins, "open", real)
    assert (code, result["outcome"]) == (2, "fatal") and "No space left on device" in result["error"]
    assert year.stat() == before and year.temps() == []


# --- --to and --from ------------------------------------------------------------

def test_to_ids_writes_the_source_the_ledger_and_last_run_json_with_no_tag_block(year, monkeypatch):
    code, result = year.run("--to", "ids")
    assert (code, names(result)) == (0, ["source.json", "ids.jsonl", "last-run.json"])
    files = year.read()
    assert (files["tags.cache.jsonl"], files["events.v2.json"], files["changes.jsonl"]) == (None, None, None)
    last = json.loads(files["last-run.json"])
    assert list(last) == LAST_RUN_KEYS + ["fetch", "ids"]
    assert (last["fetched_at"], last["changed_at"], last["digest"], last["changes_logged"]) == (S1, S1, None, 0)
    assert year.asked == []
    # the season's front door takes it, as the hand tag and seed read a season (contract.md, The tag stage, as built)
    rows, top, _ = events_v2.season_rows(load_season(str(year.season)), str(year.folder))
    assert sorted({r["id"] for r in rows}) == ["a1", "c3", "d4"]
    assert (top["generated_at"], top["changed_at"]) == (S1, S1)
    # the next full run has no file to diff: every event added, and a code change there has nothing to attribute
    monkeypatch.setenv("PIPELINE_SHA", "sha-two")
    code, result = year.run(at=T2)
    last = json.loads(year.read()["last-run.json"])
    assert (code, last["fetched_at"], last["changed_at"], last["diff"]) == (
        0, S2, S2, {"kinds": {"added": 3}, "causes": {"source": 3}})


def test_from_build_keeps_fetched_at_and_uses_its_own_stamp(year):
    year.run()
    venues = json.loads((year.folder / "venues.json").read_text(encoding="utf-8"))
    venues["hotels"][1]["display"] = "location"     # the Courtland shows its whole location as the room
    (year.folder / "venues.json").write_text(json.dumps(venues), encoding="utf-8")
    code, result = year.run("--from", "build", at=T2)
    assert (code, names(result)) == (0, ["events.v2.json", "changes.jsonl", "last-run.json"])
    assert year.fetches == 1 and len(year.asked) == 2          # no fetch, no ids stage, no tag stage
    files = year.read()
    last = json.loads(files["last-run.json"])
    assert list(last) == LAST_RUN_KEYS + ["build", "diff"]
    assert (last["stamp"], last["fetched_at"], last["changed_at"]) == (S2, S1, S2)
    doc = json.loads(files["events.v2.json"])
    assert (doc["generated_at"], doc["changed_at"]) == (S1, S2)
    assert [(x["run"], x["id"], x["kind"], x["to"]) for x in lines(files["changes.jsonl"])[3:]] == [
        (S2, "c3", "place", {"hotel": "Courtland Grand", "room": "Courtland Grand Athens"})]
    # --from build with nothing to change writes nothing
    assert year.run("--from", "build", at=T3)[1]["outcome"] == "nothing changed"


def test_from_tag_tags_what_the_cap_left_and_needs_the_committed_ledger_to_hold_the_rows(year):
    year.listed = {f"x{i:02}": raw(f"x{i:02}", f"Panel {i}") for i in range(30)}
    year.listed["x30"] = raw("x30", "The Expanse Panel")    # last in request order: capped, so minted in the next run
    code, result = year.run("--requests", "1")
    last = json.loads(year.read()["last-run.json"])
    assert (last["tag"]["requests"], last["tag"]["sent"], last["tag"]["capped"], last["build"]["untagged"]) == (1, 25,
                                                                                                                6, 6)
    assert "unanswered" not in result["details"]       # capped, not failed: the summary names only what failed
    digest = last["digest"]
    code, result = year.run("--from", "tag", "--to", "tag", at=T2)
    assert (code, names(result)) == (0, ["tags.cache.jsonl", "works.json", "last-run.json"])
    last = json.loads(year.read()["last-run.json"])
    assert list(last) == LAST_RUN_KEYS + ["tag"] and (last["fetched_at"], last["changed_at"]) == (S1, S1)
    assert (last["tag"]["sent"], last["tag"]["capped"], last["tag"]["minted"], last["digest"]) == (6, 0, 1, digest)
    works = json.loads(year.read()["works.json"])     # a mint records the run's fetched_at, kept by --from
    assert [w["minted"] for w in works if w["id"] == "the-expanse"] == [{"year": 2027, "run": S1}]
    # a ledger that does not hold the source's rows: the ids stage first
    source = json.loads((year.folder / "source.json").read_text(encoding="utf-8"))
    source["rows"].append(raw("x99", "A Panel No Line Holds"))
    (year.folder / "source.json").write_text(json.dumps(source), encoding="utf-8")
    code, result = year.run("--from", "build", at=T3)
    assert (code, result["outcome"]) == (2, "fatal") and "run the ids stage first" in result["error"]


def test_limit_takes_the_first_listings_in_page_order(year):
    code, result = year.run("--limit", "3")
    last = json.loads(year.read()["last-run.json"])
    assert (code, last["fetch"]["listings"], last["fetch"]["fetched"], last["ids"]["new"]) == (0, 3, 3, 2)
    assert sorted(e["id"] for e in json.loads(year.read()["events.v2.json"])["events"]) == ["a1", "c3"]


def test_from_needs_the_committed_files_and_the_flags_hold_to_their_stages(year):
    code, result = year.run("--from", "build")
    assert (code, result["outcome"]) == (2, "fatal") and result["error"].endswith("source.json is absent")
    (year.folder / "source.json").write_text(scraper.source_text(SEASON["source"], [], []), encoding="utf-8")
    code, result = year.run("--from", "build")
    assert (code, result["outcome"]) == (2, "fatal") and result["error"].endswith("last-run.json is absent")
    (year.folder / "source.json").unlink()
    for args in (["--to", "build"], ["--from", "diff"], ["--from", "build", "--to", "tag"],
                 ["--from", "ids", "--limit", "3"], ["--to", "ids", "--requests", "3"], ["--limit", "0"]):
        with pytest.raises(SystemExit) as exc:
            pipeline.main(["run", "--season", str(year.season), *args])
        assert exc.value.code == 2
    assert year.fetches == 0


# --- the stamp's partners: the SHA and the fetch code ------------------------------

def test_fetch_code_changed_flips_when_the_hash_differs_from_the_last_committed_run_s(year):
    year.run()
    year.hash = "h2"
    assert year.run(at=T2)[1]["outcome"] == "nothing changed"    # nothing written, the flag with it
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")
    year.run(at=T3)
    last = json.loads(year.read()["last-run.json"])
    assert (last["fetch_code_hash"], last["fetch_code_changed"]) == ("h2", True)
    assert "fetch code changed" in pipeline.markdown(json.loads(year.result_path.read_text(encoding="utf-8")))
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A")
    year.run(at=T4)
    assert json.loads(year.read()["last-run.json"])["fetch_code_changed"] is False


def test_the_fetch_code_hash_is_the_sha256_of_the_three_files_bytes_one_after_another():
    data = b"".join(open(os.path.join(ROOT, name), "rb").read()
                    for name in ("scraper.py", "tag_key.py", "requirements.txt"))
    assert pipeline.fetch_code_hash() == hashlib.sha256(data).hexdigest()


def test_the_attribution_runs_iff_the_sha_differs(year, monkeypatch):
    calls = []
    real = events_v2.attribution

    def spy(rows, ledger, *args, **kwargs):
        calls.append(([r["source_id"] for r in rows], sorted(ledger), ledger["d4"]["key"][0], kwargs["stamp"]))
        return real(rows, ledger, *args, **kwargs)
    monkeypatch.setattr(events_v2, "attribution", spy)
    year.run()
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")
    year.run(at=T2)                                           # the same SHA: no attribution, every line source
    assert calls == [] and lines(year.read()["changes.jsonl"])[-1]["cause"] == "source"
    monkeypatch.setenv("PIPELINE_SHA", "sha-two")
    venues = json.loads((year.folder / "venues.json").read_text(encoding="utf-8"))
    venues["hotels"][0]["display"] = "location"                 # the code's data moves the Marriott's rooms ...
    (year.folder / "venues.json").write_text(json.dumps(venues), encoding="utf-8")
    year.listed["d4"] = raw("d4", "The Expanse Panel Two")      # ... and the source retitles d4
    year.run(at=T3)
    # the previous run's rows and ledger - d4 still at its old title - and that run's fetch
    assert calls == [(["a1", "b2", "c3", "d4"], ["a1", "c3", "d4"], "the expanse panel", S2)]
    logged = [(x["id"], x["kind"], x["sha"], x["cause"]) for x in lines(year.read()["changes.jsonl"]) if x["run"] == S3]
    assert logged == [("a1", "place", "sha-two", "code"), ("c3", "place", "sha-two", "code"),
                      ("d4", "place", "sha-two", "code"), ("d4", "title", "sha-two", "source")]


def test_the_clock_is_read_in_utc_to_the_second():
    stamp = pipeline.now()
    assert stamp.tzinfo == UTC and stamp.microsecond == 0 and stamp.isoformat().endswith("+00:00")


def test_the_sha_is_pipeline_sha_else_one_git_call(monkeypatch):
    def refused(*args, **kwargs):
        raise AssertionError("git was called")
    monkeypatch.setattr(subprocess, "run", refused)
    monkeypatch.setenv("PIPELINE_SHA", "0123abc")
    assert pipeline.git_sha() == "0123abc"
    monkeypatch.delenv("PIPELINE_SHA")
    called = []

    def git(cmd, **kwargs):
        called.append((cmd, kwargs["cwd"]))
        return subprocess.CompletedProcess(cmd, 0, stdout="4567def\n")
    monkeypatch.setattr(subprocess, "run", git)
    assert pipeline.git_sha() == "4567def" and called == [(["git", "rev-parse", "HEAD"], pipeline.HERE)]

    def broken(cmd, **kwargs):
        raise subprocess.CalledProcessError(128, cmd)
    monkeypatch.setattr(subprocess, "run", broken)
    with pytest.raises(pipeline.Fatal, match="no SHA for the change log"):
        pipeline.git_sha()


# --- the two builds, and no front door --------------------------------------------

def test_the_two_builds_must_agree_byte_for_byte(year, monkeypatch):
    real = tag_key.cache_text
    monkeypatch.setattr(tag_key, "cache_text", lambda cache: real(dict(list(cache.items())[1:])))   # a writer's bug
    code, result = year.run()
    assert (code, result["outcome"]) == (2, "fatal") and "the build's two runs differ" in result["error"]
    assert year.read()["events.v2.json"] is None and year.read()["source.json"] is None


def test_no_stage_is_run_through_a_front_door_that_reads_the_season_s_files(year, monkeypatch):
    def door(*args, **kwargs):
        raise AssertionError("a front door was used")
    for module, name in ((events_v2, "season_rows"), (events_v2, "live"), (events_v2, "build_season"),
                         (tag_stage, "season_events"), (tag_stage, "main"), (tag_stage, "mint"),
                         (scraper, "read_previous"), (ids_stage, "read_ledger"), (tag_key, "load_cache")):
        monkeypatch.setattr(module, name, door)
    assert year.run()[0] == 0
    year.listed["c3"] = raw("c3", "Trek Trivia", "Marriott A707")
    assert year.run(at=T2)[0] == 0 and year.run("--from", "build", at=T3)[0] == 0


# --- the mint -------------------------------------------------------------------

def test_a_mint_whose_parents_request_fails_writes_no_work_and_counts_it(year, monkeypatch, capsys):
    year.parents_fail = True
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    code, result = year.run()
    assert code == 0 and "works.json" not in names(result)
    assert [x for x in capsys.readouterr().out.splitlines() if x.startswith("::")] == [
        "::warning title=pipeline::fetch.failures 1", "::warning title=pipeline::tag.mint_failed 1",
        "::warning title=pipeline::build.unresolved_names 1"]
    last = json.loads(year.read()["last-run.json"])
    assert (last["tag"]["minted"], last["tag"]["mint_failed"], last["build"]["unresolved_names"]) == (0, 1, 1)
    assert "minted" not in result["details"] and result["details"]["unresolved_names"] == ["The Expanse"]
    # the next run mints it, and the link comes back
    year.parents_fail = False
    code, result = year.run(at=T2)
    last = json.loads(year.read()["last-run.json"])
    assert (last["tag"]["minted"], last["build"]["unresolved_names"]) == (1, 0) and "works.json" in names(result)


# --- the annotations and the summary ------------------------------------------------

def test_warning_and_notice_lines_under_github_actions_and_none_elsewhere(year, monkeypatch, capsys):
    year.listed["f6"] = raw("f6", "Mystery Panel", "Marriott Nowhere", tracks=("Mystery Track",))
    year.run()
    assert "::" not in capsys.readouterr().out
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    year.listed["g7"] = raw("g7", "Another Mystery", "Marriott Nowhere", tracks=("Mystery Track",))
    year.run(at=T2)
    out = capsys.readouterr().out
    assert [x for x in out.splitlines() if x.startswith("::")] == [
        "::warning title=pipeline::fetch.failures 1", "::warning title=pipeline::build.unknown_tracks 1",
        "::notice title=pipeline::build.rooms_unresolved 2"]
    year.fetch_error = scraper.FetchError("no listings on the 2 day lists")
    year.run(at=T3)
    assert capsys.readouterr().out.splitlines()[-1] == (
        "::error title=pipeline::FetchError: no listings on the 2 day lists")
    assert pipeline.annotation("error", "two\nlines 100%") == "::error title=pipeline::two%0Alines 100%25"


def test_the_summary_renders_the_last_run_s_result_as_markdown(year, capsys):
    year.run("--limit", "5", "--requests", "3")
    capsys.readouterr()
    assert pipeline.main(["summary", "--format", "md"]) == 0
    digest = json.loads(year.read()["events.v2.json"])["digest"]
    season = str(year.season)
    assert capsys.readouterr().out == (
        f"### Pipeline run {S1}: committed\n"
        "\n"
        f"`{season}` (2027) · run with `--limit 5 --requests 3` · sha `sha-one` · 1.5 s · fetched_at {S1} · "
        f"changed_at {S1} · fetch code unchanged\n"
        "\n"
        "Wrote " + ", ".join(f"`{str(p).replace(os.sep, '/')}`" for p in (   # outside the repository: absolute
            year.folder / "source.json", year.folder / "ids.jsonl", year.folder / "tags.cache.jsonl",
            year.registry / "works.json", year.folder / "events.v2.json", year.folder / "changes.jsonl",
            year.folder / "last-run.json")) + f" · 3 line(s) logged · digest `{digest[:12]}`\n"
        "\n"
        "| stage | counters |\n"
        "|---|---|\n"
        "| fetch | listings 5 · fetched 4 · stale 0 · removed 0 · **failures 1** · repaired 0 |\n"
        "| ids | new 3 · matches 0 · merges 0 · leavers 0 · gone 0 · returned 0 · unsure 0 |\n"
        "| tag | requests 1 · sent 3 · capped 0 · failed 0 · stopped 0 · unanswered 0 · minted 1 · "
        "mint_failed 0 |\n"
        "| build | untagged 0 · unresolved_names 0 · unknown_tracks 0 · rooms_unresolved 0 · hotels_unknown 0 · "
        "places: exact 3, alias 0, rule 0, level 0, hotel 0, none 0 |\n"
        "| diff | added 3; source 3 |\n"
        "\n"
        "Warnings: fetch.failures 1.\n"
        "Failed pages: e5: 404 Client Error.\n"
        "Minted: the-expanse.\n")
    year.run(at=T2)
    capsys.readouterr()
    pipeline.main(["summary", "--format", "md"])
    out = capsys.readouterr().out
    assert out.startswith(f"### Pipeline run {S2}: nothing changed\n") and (
        "Nothing written: every file's bytes are the committed ones, the run's own stamp aside (DECISIONS #44).\n"
        in out)


def test_a_path_shows_from_the_repository_s_root_where_it_is_inside_it():
    assert pipeline.shown(os.path.join(pipeline.HERE, "data", "2027", "season.json")) == "data/2027/season.json"
    outside = os.path.join(os.path.dirname(pipeline.HERE), "elsewhere", "season.json")
    assert pipeline.shown(outside) == outside.replace(os.sep, "/")


def test_the_summary_lists_ten_names_behind_a_counter_and_says_where_there_are_more(year, capsys):
    year.listed = {"a1": raw("a1", "Firefly Reunion"), **{f"f{i:02}": None for i in range(11)}}
    year.silent = {"Firefly Reunion"}          # and an input the model leaves out of its reply, asked twice
    year.run()
    out = capsys.readouterr().out
    failed = next(x for x in out.splitlines() if x.startswith("Failed pages: "))
    assert failed.count("404 Client Error") == 10 and failed.endswith("f09: 404 Client Error; ....")
    assert "Not tagged: Firefly Reunion (unanswered)." in out.splitlines()
    assert json.loads(year.read()["last-run.json"])["tag"]["unanswered"] == 1
    year.listed.pop("f10")
    year.silent = set()
    year.run(at=T2)
    out = capsys.readouterr().out
    failed = next(x for x in out.splitlines() if x.startswith("Failed pages: "))
    assert failed.count("404 Client Error") == 10 and failed.endswith("f09: 404 Client Error.")
    assert json.loads(year.read()["last-run.json"])["tag"] == {
        "requests": 1, "sent": 1, "capped": 0, "failed": 0, "stopped": 0, "unanswered": 0, "minted": 0,
        "mint_failed": 0}


def test_the_summary_of_a_fatal_run_and_of_a_run_outside_the_window(year, capsys, tmp_path):
    year.fetch_error = scraper.FetchError("no listings on the 2 day lists")
    year.run()
    capsys.readouterr()
    pipeline.main(["summary", "--format", "md"])
    assert capsys.readouterr().out == (
        f"### Pipeline run {S1}: fatal\n\n`{year.season}` (2027)\n\n"
        "**Fatal:** FetchError: no listings on the 2 day lists\n\nNothing written (DECISIONS #44).\n")
    year.run(at=dt.datetime(2027, 9, 9, 12, tzinfo=UTC))
    capsys.readouterr()
    pipeline.main(["summary", "--format", "md"])
    assert capsys.readouterr().out.endswith(
        "Outside the season window (2027-08-01 to 2027-09-07, America/New_York): nothing run. A dispatch with force "
        "runs past it.\n")
    os.remove(year.result_path)
    assert pipeline.main(["summary", "--format", "md"]) == 1


# --- the window -------------------------------------------------------------------

def test_the_window_is_the_season_s_local_days_and_its_utc_fallback():
    at = dt.datetime(2027, 9, 8, 2, 0, tzinfo=UTC)    # 10 pm on Sep 7 in New York: the window's last day there
    assert pipeline.in_window(SEASON, at) == (True, None)
    assert pipeline.in_window(SEASON, T1) == (True, None)
    assert pipeline.in_window(SEASON, dt.datetime(2027, 9, 8, 12, 0, tzinfo=UTC)) == (False, None)
    assert pipeline.in_window(SEASON, dt.datetime(2027, 8, 1, 3, 0, tzinfo=UTC)) == (False, None)   # Jul 31 there
    assert pipeline.in_window(SEASON, dt.datetime(2027, 8, 1, 12, 0, tzinfo=UTC)) == (True, None)   # its first day
    assert pipeline.in_window({**SEASON, "window": None}, T1) == (False, None)
    inside, note = pipeline.in_window({**SEASON, "tz": "Nowhere/No_Such_Zone"}, at)     # read in UTC: Sep 8
    assert not inside and note == ("the time zone Nowhere/No_Such_Zone cannot be loaded here: the season window is "
                                   "compared in UTC")


def test_the_window_command_prints_in_or_out_and_a_run_outside_it_needs_force(year, monkeypatch, capsys):
    assert pipeline.main(["window", "--season", str(year.season)]) == 0
    assert capsys.readouterr().out == "in window\n"
    year.at = dt.datetime(2027, 9, 9, 12, tzinfo=UTC)
    assert pipeline.main(["window", "--season", str(year.season)]) == 0
    assert capsys.readouterr().out == "out of window\n"
    code, result = year.run()
    assert (code, result["outcome"], year.fetches) == (0, "out of window", 0)
    assert result["window"] == {"from": "2027-08-01", "to": "2027-09-07", "tz": "America/New_York"}
    assert year.read()["source.json"] is None and year.read()["last-run.json"] is None
    code, result = year.run("--force")
    assert (code, result["outcome"], year.fetches) == (0, "committed", 1)
    assert "run with `--force`" in capsys.readouterr().out
    # a zone that cannot be loaded: the window read in UTC, and the command and a run both say so
    season = json.loads(year.season.read_text(encoding="utf-8"))
    year.season.write_text(json.dumps({**season, "tz": "Nowhere/No_Such_Zone"}), encoding="utf-8")
    year.at = T1
    assert pipeline.main(["window", "--season", str(year.season)]) == 0
    out, err = capsys.readouterr()
    warning = "warning: the time zone Nowhere/No_Such_Zone cannot be loaded here: the season window is compared in UTC"
    assert out == "in window\n" and warning in err.splitlines()
    year.run()
    assert warning in capsys.readouterr().err.splitlines()
    (year.folder / "season.json").write_text("{", encoding="utf-8")
    assert pipeline.main(["window", "--season", str(year.season)]) == 2
