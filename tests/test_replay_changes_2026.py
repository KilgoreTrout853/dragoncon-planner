"""Tests for tools/replay_changes_2026.py: 2026's change log rebuilt, here from the five-version mini-history of
tests/mini_history.py - each version's lines, v1 a season's first run, a run flagged where a scraper.py commit comes
before it, the rows a load sends and what refuses them - and --load against a fake PostgREST: the year's ids read
first, 1,000 lines a request with merge-duplicates, the lines whose id the table lacks counted, no line sent where
the table holds no event, and the key in no output. The same bytes under two hash seeds. Nothing here runs git or
reads data/.

Run:  python -m pytest tests/
"""
import importlib.util
import json
import os
import subprocess
import sys
from urllib.parse import parse_qsl, urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
TOOL = os.path.join(ROOT, "tools", "replay_changes_2026.py")
sys.path.insert(0, HERE)
sys.path.insert(0, ROOT)
spec = importlib.util.spec_from_file_location("replay_changes_2026", TOOL)
rc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rc)

import pytest  # noqa: E402
import requests  # noqa: E402
from requests.structures import CaseInsensitiveDict  # noqa: E402

import diff_stage  # noqa: E402
import mini_history as mini  # noqa: E402
import registry  # noqa: E402
import venues  # noqa: E402

THRESHOLDS = {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}  # 2026's
SEASON = {"year": 2026, "prompt_version": 1, "thresholds": THRESHOLDS}
REG = registry.Registry([], [], [])
URL = "https://project.supabase.test"
SECRET = "sb_secret_" + "R3pl4y-k3y_" * 4
C = [f"{k}" * 40 for k in range(1, 6)]       # the five versions' commits
X, S1, S2 = "e" * 40, "a" * 40, "b" * 40      # a commit touching neither; two scraper.py commits


def hotel(name, order, keys, placeless=False):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": "rest", "levels": [], "unplaced": {}}


VENUES = venues.check({"walk": {}, "same_venue_min": 5, "unknown_pair_min": 12, "slack_min": 10,
                       "hotels": [hotel("Marriott", 0, ["Marriott"]), hotel("Westin", 1, ["Westin"]),
                                  hotel("Hilton", 2, ["Hilton"]), hotel("Other", 3, ["O", "Other"], placeless=True),
                                  hotel("Unknown", 4, [], placeless=True)]})


def history(scraper=(C[0], S1, C[4])):
    """The mini-history as schedule_history.gather() hands it over: v1's own commit, one between v2 and v3 and v5's
    own touch scraper.py, so v3 and v5 are flagged and v1, a season's first run, is not."""
    return {"ref": "main", "head": "abcdef0" + "0" * 33,
            "line": [C[0], X, C[1], S1, C[2], C[3], S2, C[4]],
            "commits": [{"sha": sha, "author": "schedule-bot", "subject": f"Refresh schedule {k}"}
                        for k, sha in enumerate(C, start=1)],
            "scraper": [{"sha": sha, "committed": "", "subject": ""} for sha in scraper],
            "versions": mini.versions()}


def runs_of(h=None):
    return rc.replay_changes(h or history(), SEASON, REG, {}, VENUES)


# --- the log ---------------------------------------------------------------------------------

def test_a_run_is_flagged_where_a_scraper_commit_comes_before_it_but_a_seasons_first_is_not():
    assert rc.flags(history()) == [False, False, True, False, True]
    assert rc.flags(history(scraper=(S2,))) == [False, False, False, False, True]      # after v4, at or before v5
    assert rc.flags(history(scraper=())) == [False] * 5
    assert rc.flags(history(scraper=("f" * 40,))) == [False] * 5                        # not on the line
    h = history()
    h["line"].remove(C[3])
    with pytest.raises(rc.ReplayError, match="not on the ref's first-parent line: 4444444"):
        rc.flags(h)


def test_the_mini_history_rebuilt_version_by_version():
    runs = runs_of()
    assert [[(x["id"], x["kind"]) + ((x["to"],) if x["kind"] == "merged" else ()) for x in r["lines"]] for r in runs] == [
        [("c1", "added"), ("m1", "added"), ("m2", "added"), ("s1", "added"), ("t1", "added"), ("u1", "added"),
         ("w1", "added")],
        [("c1", "removed"), ("u1", "removed"), ("u2", "added"), ("w1", "removed")],
        [("s3", "added"), ("w1", "restored")],
        [("c1", "restored"), ("m2", "merged", "m1"), ("t1.1", "added")],
        []]
    assert [(r["version"], r["sha"], r["stamp"], r["flag"]) for r in runs] == [
        (k, C[k - 1], mini.STAMPS[k - 1], k in (3, 5)) for k in range(1, 6)]
    for r in runs:     # each version's lines stamped with its generated_at and its commit, every one source
        assert {(x["run"], x["sha"], x["cause"]) for x in r["lines"]} <= {(r["stamp"], r["sha"], "source")}


def test_the_rows_a_load_sends_are_the_lines_with_their_year_and_their_runs_flag():
    rows = rc.change_rows(runs_of())
    assert len(rows) == 16
    assert {tuple(r) for r in rows} == {("year", "run", "sha", "id", "kind", "from", "to", "cause",
                                         "fetch_code_changed")}
    assert [(r["id"], r["kind"], r["fetch_code_changed"]) for r in rows if r["run"] == mini.STAMPS[2]] == [
        ("s3", "added", True), ("w1", "restored", True)]
    assert {r["fetch_code_changed"] for r in rows if r["run"] != mini.STAMPS[2]} == {False}
    merged = next(r for r in rows if r["kind"] == "merged")
    assert (merged["year"], merged["from"], merged["to"], merged["sha"]) == (2026, None, "m1", C[3])
    assert rows == sorted(rows, key=lambda r: (r["run"], r["id"], r["kind"]))
    moved = {"run": mini.STAMPS[1], "sha": C[1], "id": "t1", "kind": "time", "from": {"start": "a", "end": "b"},
             "to": {"start": "c", "end": None}, "cause": "source"}
    assert rc.change_rows([{"flag": False, "lines": [moved]}]) == [
        {"year": 2026, "run": mini.STAMPS[1], "sha": C[1], "id": "t1", "kind": "time", "from": {"start": "a", "end": "b"},
         "to": {"start": "c", "end": None}, "cause": "source", "fetch_code_changed": False}]


def test_two_versions_stamped_alike_may_not_log_one_line_twice_nor_give_a_run_two_flags():
    line = {"run": mini.STAMPS[0], "sha": C[0], "id": "a", "kind": "title", "from": "A", "to": "B", "cause": "source"}
    other = dict(line, id="b")
    with pytest.raises(rc.ReplayError, match="logged twice"):
        rc.change_rows([{"flag": False, "lines": [line]}, {"flag": False, "lines": [dict(line)]}])
    with pytest.raises(rc.ReplayError, match="two fetch_code_changed flags"):
        rc.change_rows([{"flag": False, "lines": [line]}, {"flag": True, "lines": [other]}])
    assert len(rc.change_rows([{"flag": True, "lines": [line]}, {"flag": True, "lines": [other]}])) == 2


def test_a_replay_a_fatal_rule_stopped_rebuilds_nothing():
    h = history()
    with pytest.raises(rc.ReplayError, match="the replay stopped after 1 of 5 versions: 1 new id"):
        rc.replay_changes(h, dict(SEASON, thresholds=dict(THRESHOLDS, new_ids=0.1)), REG, {}, VENUES)


# --- a fake PostgREST ----------------------------------------------------------------------------

class Answer:
    def __init__(self, status, body=None, headers=None):
        self.status_code = status
        self.text = "" if body is None else body if isinstance(body, str) else json.dumps(body)
        self.headers = CaseInsensitiveDict(headers or {})

    def json(self):
        return json.loads(self.text)


class Fake:
    """A requests.Session as PostgREST 14.5 answers the two requests a load makes: the year's ids, a page at a time,
    and the upsert of change lines, counted. `held` is the ids schedule_events holds for the year; `echo` answers the
    upsert with the key in its error, as a server might."""

    def __init__(self, held, echo=False):
        self.held, self.echo = sorted(held), echo
        self.sent, self.rows = [], {}

    def request(self, method, url, params=None, headers=None, data=None, timeout=None):
        assert timeout and headers["apikey"] == SECRET and "Authorization" not in headers
        prepared = requests.Request(method, url, params=params).prepare()
        parts = urlsplit(prepared.url)
        query = parse_qsl(parts.query)
        body = json.loads(data.decode("utf-8")) if data is not None else None
        self.sent.append((method, parts.path, query, headers.get("Prefer"), body))
        if method == "GET" and parts.path == "/rest/v1/schedule_events":
            assert dict(query)["year"] == "eq.2026" and dict(query)["select"] == "id"
            offset, limit = int(dict(query)["offset"]), int(dict(query)["limit"])
            return Answer(200, [{"id": i} for i in self.held[offset:offset + limit]])
        if method == "POST" and parts.path == "/rest/v1/schedule_changes":
            if self.echo:
                return Answer(400, {"message": f"no such key {SECRET}"})
            assert query == [("on_conflict", "year,run,id,kind")]
            for row in body:
                self.rows[(row["year"], row["run"], row["id"], row["kind"])] = row
            return Answer(201, None, {"Content-Range": f"*/{len(body)}"})
        raise AssertionError(f"nothing answers {method} {parts.path}")


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", SECRET)
    return monkeypatch


def run(tmp_path, *more, fake=None, h=None):
    """main() with the history, the inputs and the session faked -> exit code; the log to tmp_path."""
    return rc.main(["--out", str(tmp_path / "out" / "changes.jsonl"), *more], session=fake, sleep=lambda s: None,
                   gather=lambda ref, with_runs: h or history(), load_inputs=lambda: (SEASON, REG, {}, VENUES))


# --- the command ------------------------------------------------------------------------------------

def test_it_writes_the_log_as_changes_jsonl_holds_it_and_says_what_it_found(env, tmp_path, capsys):
    assert run(tmp_path) == 0
    text = (tmp_path / "out" / "changes.jsonl").read_bytes().decode("utf-8")
    runs = runs_of()
    assert text == diff_stage.render([line for r in runs for line in r["lines"]])   # run by run, as a log grows
    assert text.count("\n") == 16 and "\r" not in text
    out = capsys.readouterr().out
    assert out.startswith("2026's change log from main at abcdef0: 5 versions, 16 lines in 4 runs, 16 source; "
                          "written to ")
    assert "by kind: added 10, removed 3, restored 2, merged 1\n" in out
    assert "flagged fetch_code_changed, a scraper.py commit before the run: v3 (2 lines), v5 (0 lines)\n" in out
    assert (f"  v2 {C[1][:7]} {mini.STAMPS[1]}: removed 3\n  v3 {C[2][:7]} {mini.STAMPS[2]}: restored 1 - flagged\n"
            f"  v4 {C[3][:7]} {mini.STAMPS[3]}: restored 1\n") in out


def test_load_reads_the_years_ids_then_upserts_every_line_and_counts_those_the_table_lacks(env, tmp_path, capsys):
    fake = Fake(held={"c1", "m1", "s1", "t1", "u1", "u2", "w1", "s3", "t1.1"})     # not m2, merged away
    assert run(tmp_path, "--load", fake=fake) == 0
    assert [(m, p, [k for k, _ in q]) for m, p, q, _, _ in fake.sent] == [
        ("GET", "/rest/v1/schedule_events", ["select", "year", "order", "limit", "offset"]),
        ("GET", "/rest/v1/schedule_events", ["select", "year", "order", "limit", "offset"]),
        ("POST", "/rest/v1/schedule_changes", ["on_conflict"])]
    assert fake.sent[2][3] == "handling=strict,resolution=merge-duplicates,return=minimal,count=exact"
    assert fake.sent[2][4] == rc.change_rows(runs_of())
    assert len(fake.rows) == 16
    assert capsys.readouterr().out.endswith(
        "loaded 16 lines into schedule_changes for 2026; 2 of them name an id schedule_events does not hold for "
        "2026, on 1 id: m2\n")
    # a second load writes the same rows again
    assert run(tmp_path, "--load", fake=fake) == 0 and len(fake.rows) == 16


def test_load_sends_1000_lines_a_request(env):
    fake = Fake(held={"a"})
    rows = [{"year": 2026, "run": mini.STAMPS[0], "sha": C[0], "id": f"e{n:04}", "kind": "added", "from": None,
             "to": None, "cause": "source", "fetch_code_changed": False} for n in range(2500)]
    rest = rc.mirror.Rest(URL, SECRET, fake, sleep=lambda s: None)
    assert rc.load(rows, rest) == (2500, [f"e{n:04}" for n in range(2500)], 2500)
    assert [len(body) for m, _, _, _, body in fake.sent if m == "POST"] == [1000, 1000, 500]


def test_load_refuses_a_year_the_mirror_has_not_run_for_and_sends_no_line(env, tmp_path, capsys):
    fake = Fake(held=set())
    assert run(tmp_path, "--load", fake=fake) == 1
    assert [m for m, *_ in fake.sent] == ["GET"]
    assert ("failed: schedule_events holds no events for 2026: dispatch Mirror for data/2026/season.json first. No "
            "line was sent\n") in capsys.readouterr().out
    assert (tmp_path / "out" / "changes.jsonl").exists()      # the log is still written


def test_the_key_is_checked_before_any_request_and_is_in_no_output(env, tmp_path, capsys):
    env.setenv("SUPABASE_SERVICE_KEY", "sb_publishable_" + "x" * 30)
    fake = Fake(held={"c1"})
    assert run(tmp_path, "--load", fake=fake) == 1 and fake.sent == []
    assert "failed: SUPABASE_SERVICE_KEY is not a secret key" in capsys.readouterr().out
    env.setenv("SUPABASE_SERVICE_KEY", SECRET)
    fake = Fake(held={"c1"}, echo=True)
    assert run(tmp_path, "--load", fake=fake) == 1
    out = capsys.readouterr().out
    assert "no such key ***" in out and SECRET not in out


def test_an_error_nobody_foresaw_is_reported_with_the_key_redacted(env, tmp_path, capsys):
    class Broken(Fake):
        def request(self, *args, **kwargs):
            raise RuntimeError(f"the session broke holding {SECRET}")
    assert run(tmp_path, "--load", fake=Broken(held={"c1"})) == 1
    out = capsys.readouterr().out
    assert "RuntimeError: the session broke holding ***" in out and SECRET not in out


def test_without_load_it_needs_no_key_and_sends_nothing(env, tmp_path):
    env.delenv("SUPABASE_URL")
    env.delenv("SUPABASE_SERVICE_KEY")
    fake = Fake(held={"c1"})
    assert run(tmp_path, fake=fake) == 0 and fake.sent == []


def test_the_summary_names_a_path_in_the_repository_from_its_root_and_any_other_whole(tmp_path):
    assert rc.shown(os.path.join(ROOT, "tools", "out", "changes-2026.jsonl")) == "tools/out/changes-2026.jsonl"
    outside = str(tmp_path / "changes.jsonl")
    assert rc.shown(outside) == os.path.abspath(outside).replace(os.sep, "/")


def test_its_inputs_are_the_repositorys_whatever_folder_it_is_run_from(monkeypatch, tmp_path):
    read = []
    for name in ("load_season", "load_cache", "load_venues"):
        monkeypatch.setattr(rc, name, lambda path, name=name: read.append((name, path)))
    monkeypatch.setattr(rc.registry, "load", lambda path: read.append(("registry", path)))
    monkeypatch.chdir(tmp_path)
    rc.inputs()
    root = os.path.realpath(ROOT)
    assert [(name, os.path.relpath(os.path.realpath(path), root).replace(os.sep, "/")) for name, path in read] == [
        ("load_season", "data/2026/season.json"), ("registry", "data/registry"),
        ("load_cache", "data/2026/tags.cache.jsonl"), ("load_venues", "data/2026/venues.json")]


def test_two_runs_under_different_hash_seeds_write_the_same_bytes(tmp_path):
    """Set order follows the process's hash seed; nothing in the log may."""
    code = ("import importlib.util, sys\n"
            f"sys.path.insert(0, {HERE!r})\n"
            "import test_replay_changes_2026 as t\n"
            "sys.stdout.buffer.write(t.diff_stage.render(t.rc.lines_of(t.runs_of())).encode('utf-8'))\n")
    written = [subprocess.run([sys.executable, "-c", code], cwd=ROOT, check=True, capture_output=True,
                              env={**os.environ, "PYTHONHASHSEED": seed}).stdout for seed in ("1", "2")]
    assert written[0] == written[1] and written[0].decode("utf-8") == diff_stage.render(rc.lines_of(runs_of()))
