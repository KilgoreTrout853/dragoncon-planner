"""Tests for mirror.py (DECISIONS #54; docs/sync/contract.md, section 6). The rows it makes of the three files - the
times in the season's zone, a null kept, a removed event, the watermark, the flag with two runs unmirrored, the delete
set - and the job against a fake PostgREST that answers as 14.5 does, every request recorded: mirror_state read first
and written last, batching at 1,000, idempotence, the regress guard, the deletes a merge allows and their quoting, the
flag moving to true on a re-send, the key's two forms and its hygiene, retries, the strict Prefer, the frozen year,
the absent file, what is refused before anything is sent, the dry run and the summary; and the committed 2026 file,
converted whole. Nothing reaches a network or runs git.

Run:  python -m pytest tests/
"""
import base64
import collections
import copy
import datetime as dt
import json
import os
import shutil
import sys
from urllib.parse import parse_qsl, urlsplit

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402
import requests  # noqa: E402
from requests.structures import CaseInsensitiveDict  # noqa: E402

import diff_stage  # noqa: E402
import mirror  # noqa: E402
from season import load as load_season  # noqa: E402

URL = "https://project.supabase.test"
SECRET = "sb_secret_" + "K3y-v4lue_" * 4


def jwt(role):
    part = lambda obj: base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")  # noqa: E731
    return f"{part({'alg': 'HS256', 'typ': 'JWT'})}.{part({'role': role, 'iss': 'supabase'})}.c2lnbmF0dXJlLW9mLXRlc3Q"


SERVICE_JWT = jwt("service_role")
STAMPS = [f"2027-08-0{d}T{h:02}:17:00+00:00" for d in (1, 2) for h in (10, 11, 12, 13)]
CLOCK = dt.datetime(2027, 8, 3, 9, 0, 0, tzinfo=dt.timezone.utc)
SEASON_2026 = os.path.join(ROOT, "data", "2026", "season.json")
SEASON_2027 = os.path.join(ROOT, "data", "2027", "season.json")


# --- a fake PostgREST ----------------------------------------------------------------

Sent = collections.namedtuple("Sent", "method path query headers body")
TABLES = {
    "schedule_events": {"key": ("year", "id"), "times": ("start", "end"),
                        "columns": ("year", "id", "title", "start", "end", "hotel", "room", "removed", "cancelled"),
                        "not_null": ("year", "id", "title", "removed", "cancelled")},
    "schedule_changes": {"key": ("year", "run", "id", "kind"), "times": ("run",),
                         "columns": ("year", "run", "sha", "id", "kind", "from", "to", "cause", "fetch_code_changed"),
                         "not_null": ("year", "run", "sha", "id", "kind", "cause", "fetch_code_changed")},
    "mirror_state": {"key": ("year",), "times": ("last_run", "updated_at"),
                     "columns": ("year", "last_run", "last_sha", "updated_at"), "not_null": ("year", "updated_at")},
}
PREFERENCES = {"handling": ("strict", "lenient"), "resolution": ("merge-duplicates", "ignore-duplicates"),
               "return": ("minimal", "representation", "headers-only"), "count": ("exact", "planned", "estimated"),
               "missing": ("default",)}


class Answer:
    def __init__(self, status, body=None, headers=None):
        self.status_code = status
        self.text = "" if body is None else body if isinstance(body, str) else json.dumps(body)
        self.headers = CaseInsensitiveDict(headers or {})

    def json(self):
        return json.loads(self.text)


def fail(status, code, message):
    """PostgREST's error, as it answers every one."""
    return Answer(status, {"code": code, "details": None, "hint": None, "message": message})


class FakePostgrest:
    """A requests.Session as PostgREST 14.5 behind Supabase's gateway answers the mirror job, checked against the real
    one on the CLI's local stack (contract, section 6, as built). The three job tables, keyed as the migrations key
    them, start and end nullable (the third migration). The upsert: on_conflict the key, every object's keys alike
    (else 400 PGRST102) and each a column (else PGRST204), the not-null columns and the change log's checks held, a key
    twice in one merge batch a 500 (21000); merge-duplicates replaces the payload's columns, ignore-duplicates keeps the
    first, and neither is a 409; 201 when a row went in, else 200 for a merge; count=exact's Content-Range. The reads
    and the paged ids, at most max_rows a page; the delete, its in-list read as leniently as PostgREST reads it, a
    delete with no filter refused (pg-safeupdate); a Prefer PostgREST does not know refused under handling=strict and
    ignored otherwise. The key as Supabase's guide sends it: apikey always, the bearer a JWT's alone. Anything it was
    not built to answer throws. `sent` holds every request, the key's value written <key>; `wire` every URL and body
    as they left; `fail(sent)` answers a request first, with an Answer or an exception."""

    def __init__(self, key=SECRET, max_rows=1000):
        self.key, self.max_rows = key, max_rows
        self.tables = {name: {} for name in TABLES}
        self.sent, self.wire, self.fail = [], [], None

    # what a test reads of it
    def rows(self, table):
        return [self._shown(table, row) for _, row in sorted(self.tables[table].items(), key=lambda kv: kv[0])]

    def seed(self, table, rows):
        for row in rows:
            full = {c: row.get(c) for c in TABLES[table]["columns"]}
            self.tables[table][self._key(table, full)] = self._stored(table, full)

    def to(self, method, table):
        return [s for s in self.sent if s.method == method and s.path == f"/rest/v1/{table}"]

    # the wire
    def request(self, method, url, params=None, headers=None, data=None, timeout=None):
        assert timeout, "every request carries a timeout"
        prepared = requests.Request(method, url, params=params).prepare()
        parts = urlsplit(prepared.url)
        body = json.loads(data.decode("utf-8")) if data is not None else None
        self.wire.append(prepared.url + "\n" + (data.decode("utf-8") if data is not None else ""))
        sent = Sent(method, parts.path, parse_qsl(parts.query, keep_blank_values=True),
                    {k: v.replace(self.key, "<key>") for k, v in headers.items()}, body)
        self.sent.append(sent)
        if self.fail:
            outcome = self.fail(sent)
            if isinstance(outcome, BaseException):
                raise outcome
            if outcome is not None:
                return outcome
        if headers.get("apikey") != self.key:
            return Answer(401, {"message": "Invalid API key"})
        bearer = headers.get("Authorization")
        if mirror.JWT.fullmatch(self.key) and bearer != f"Bearer {self.key}":
            return fail(401, "42501", "permission denied: a JWT in apikey alone is anon")
        if not mirror.JWT.fullmatch(self.key) and bearer is not None:
            raise AssertionError("an sb_secret_ key goes on apikey alone, never as the bearer")
        table = parts.path[len("/rest/v1/"):]
        if not parts.path.startswith("/rest/v1/") or table not in TABLES:
            raise AssertionError(f"nothing answers {method} {parts.path}")
        prefer, refused = self._prefer(headers.get("Prefer", ""))
        if refused:
            return refused
        query = sent.query
        if method == "POST":
            return self._upsert(table, query, prefer, body)
        if method == "GET":
            return self._read(table, query)
        if method == "DELETE":
            return self._delete(table, query, prefer)
        raise AssertionError(f"nothing answers {method} {parts.path}")

    def _prefer(self, text):
        prefs = dict(p.strip().split("=", 1) if "=" in p else (p.strip(), "") for p in text.split(",") if p.strip())
        bad = [k for k, v in prefs.items() if v not in PREFERENCES.get(k, ())]
        if bad and prefs.get("handling") == "strict":
            return prefs, fail(400, "PGRST122", "Invalid preferences given with handling=strict")
        return prefs, None

    def _upsert(self, table, query, prefer, rows):
        spec = TABLES[table]
        if query != [("on_conflict", ",".join(spec["key"]))]:
            raise AssertionError(f"nothing answers POST /rest/v1/{table} with {query}")
        assert isinstance(rows, list) and rows, "a batch is a non-empty array"
        keys = set(rows[0])
        if any(set(r) != keys for r in rows):
            return fail(400, "PGRST102", "All object keys must match")
        for k in sorted(keys - set(spec["columns"])):
            return fail(400, "PGRST204", f"Could not find the '{k}' column of '{table}' in the schema cache")
        batch = {}
        for r in rows:
            full = {c: r.get(c) for c in spec["columns"]}
            for c in spec["not_null"]:
                if full[c] is None:
                    return fail(400, "23502", f'null value in column "{c}" of relation "{table}" violates not-null '
                                              "constraint")
            if table == "schedule_changes" and (full["kind"] not in mirror.KINDS or full["cause"] not in mirror.CAUSES):
                return fail(400, "23514", 'new row for relation "schedule_changes" violates check constraint')
            try:
                stored = self._stored(table, full)
            except ValueError as exc:
                return fail(400, "22007", f"invalid input syntax for type timestamp with time zone: {exc}")
            key = self._key(table, stored)
            if key in batch and prefer.get("resolution") == "merge-duplicates":
                return fail(500, "21000", "ON CONFLICT DO UPDATE command cannot affect row a second time")
            batch.setdefault(key, (stored, set(r)))
        held = self.tables[table]
        if prefer.get("resolution") is None and any(k in held for k in batch):
            return fail(409, "23505", f'duplicate key value violates unique constraint "{table}_pkey"')
        inserted = affected = 0
        for key, (stored, given) in batch.items():
            if key not in held:
                held[key] = stored
                inserted += 1
                affected += 1
            elif prefer.get("resolution") == "merge-duplicates":
                held[key].update({c: stored[c] for c in given})
                affected += 1
        status = 201 if inserted or prefer.get("resolution") != "merge-duplicates" else 200
        return Answer(status, None, {"Content-Range": f"*/{affected}" if prefer.get("count") == "exact" else "*/*"})

    def _read(self, table, query):
        params = dict(query)
        year = int(params["year"][len("eq."):])
        if table == "mirror_state" and query == [("select", "last_run,last_sha"), ("year", f"eq.{year}")]:
            return Answer(200, [{c: self._shown(table, r)[c] for c in ("last_run", "last_sha")}
                                for r in self.tables[table].values() if r["year"] == year])
        if table == "schedule_events" and [k for k, _ in query] == ["select", "year", "order", "limit", "offset"] \
                and params["select"] == "id" and params["order"] == "id.asc":
            ids = sorted(r["id"] for r in self.tables[table].values() if r["year"] == year)
            offset, limit = int(params["offset"]), min(int(params["limit"]), self.max_rows)
            return Answer(200, [{"id": i} for i in ids[offset:offset + limit]])
        raise AssertionError(f"nothing answers GET /rest/v1/{table} with {query}")

    def _delete(self, table, query, prefer):
        if not query:
            return fail(400, "21000", "DELETE requires a WHERE clause")
        params = dict(query)
        if table != "schedule_events" or [k for k, _ in query] != ["year", "id"] or not params["id"].startswith("in.("):
            raise AssertionError(f"nothing answers DELETE /rest/v1/{table} with {query}")
        year, ids = int(params["year"][len("eq."):]), set(in_list(params["id"][len("in."):]))
        doomed = [k for k, r in self.tables[table].items() if r["year"] == year and r["id"] in ids]
        for k in doomed:
            del self.tables[table][k]
        return Answer(204, None, {"Content-Range": f"*/{len(doomed)}" if prefer.get("count") == "exact" else "*/*"})

    # rows as the database holds and shows them
    def _key(self, table, row):
        return tuple(row[c] for c in TABLES[table]["key"])

    def _stored(self, table, row):
        out = dict(row)
        for c in TABLES[table]["times"]:
            if out[c] is not None:
                moment = dt.datetime.fromisoformat(out[c])
                out[c] = moment if moment.tzinfo else moment.replace(tzinfo=dt.timezone.utc)   # the server's zone, UTC
        return out

    def _shown(self, table, row):
        out = dict(row)
        for c in TABLES[table]["times"]:
            if out[c] is not None:
                out[c] = out[c].astimezone(dt.timezone.utc).isoformat()
        return out


def in_list(text):
    """PostgREST 14.5's reading of `(a,"b,c","d\\"e")` (QueryParams.hs, pListVal): a quoted value with its backslash
    escapes where a comma or the closing parenthesis follows it, and anything else taken as it stands up to the next
    comma or parenthesis. A parenthesis in a value not quoted ends the list there, and the rest is dropped with no
    error: a slip deletes fewer rows, and says so only in its count."""
    assert text.startswith("(")
    out, n = [], 1

    def stop(at):
        ends = [i for i in (text.find(",", at), text.find(")", at)) if i >= 0]
        return min(ends) if ends else len(text)
    while True:
        end = None
        if text[n:n + 1] == '"':
            value, m = "", n + 1
            while m < len(text) and text[m] != '"':
                if text[m] == "\\" and m + 1 < len(text):
                    m += 1
                value += text[m]
                m += 1
            if m < len(text) and text[m + 1:m + 2] in (",", ")"):
                out.append(value)
                end = m + 1
        if end is None:
            end = stop(n)
            out.append(text[n:end])
        if end >= len(text) or text[end] == ")":
            return out
        n = end + 1


# --- the files ------------------------------------------------------------------------

def ev(i, **fields):
    """An event as events.v2.json holds one, with the fields the mirror and the diff read."""
    out = {"id": i, "title": f"Event {i}", "start": "2027-09-04T11:30", "end": "2027-09-04T12:30",
           "hotel": "Marriott", "room": "A601", "track": "Main Programming", "cancelled": False, "people": [],
           "tracks": ["Main Programming"], "description": f"About {i}."}
    out.update(fields)
    return out


def live_year(folder, versions, flag=False):
    """A live season's folder as the orchestrator leaves it after one run per version: events.v2.json the last
    version, changes.jsonl every run's lines by the real diff, last-run.json the last run's with `flag` as its
    fetch_code_changed. Run n is stamped STAMPS[n]."""
    os.makedirs(folder, exist_ok=True)
    shutil.copy(SEASON_2027, os.path.join(folder, "season.json"))
    log, previous = "", None
    for n, events in enumerate(versions):
        current = {"digest": f"d{n}", "changed_at": None, "events": copy.deepcopy(events)}
        result = diff_stage.diff(previous, current, stamp=STAMPS[n], sha=f"sha{n}")
        current["changed_at"] = result.changed_at
        log += diff_stage.render(result.lines)
        previous = current
    last = len(versions) - 1
    doc = {"generated_at": STAMPS[last], "changed_at": previous["changed_at"], "source": "https://example.test",
           "count": len(previous["events"]), "failures": [], "digest": previous["digest"], "works": [],
           "events": previous["events"]}
    last_run = {"stamp": STAMPS[last], "fetched_at": STAMPS[last], "changed_at": previous["changed_at"],
                "sha": f"sha{last}", "fetch_code_hash": "h", "fetch_code_changed": flag,
                "changes_logged": len(result.lines), "digest": previous["digest"], "season": 2027, "elapsed": 1.0}
    write(folder, "events.v2.json", json.dumps(doc))
    write(folder, "changes.jsonl", log)
    write(folder, "last-run.json", json.dumps(last_run, indent=2) + "\n")
    return os.path.join(folder, "season.json")


def frozen_year(folder, events):
    os.makedirs(folder, exist_ok=True)
    shutil.copy(SEASON_2026, os.path.join(folder, "season.json"))
    write(folder, "events.v2.json", json.dumps({"digest": "d", "events": events}))
    return os.path.join(folder, "season.json")


def write(folder, name, text):
    with open(os.path.join(folder, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def lines_of(season_path):
    with open(os.path.join(os.path.dirname(season_path), "changes.jsonl"), encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


@pytest.fixture
def env(monkeypatch):
    """The job's environment as the workflow sets it, off Actions."""
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", SECRET)
    monkeypatch.setenv("MIRROR_SHA", "f00dcafe" * 5)
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    return monkeypatch


def run(season, fake, *more, sleeps=None):
    """main() against the fake, the clock fixed and the waits recorded -> exit code."""
    waits = [] if sleeps is None else sleeps
    return mirror.main(["--season", season, *more], session=fake, sleep=waits.append, clock=lambda: CLOCK)


def shape(fake):
    """(method, table, the query's keys) of each request, in order."""
    return [(s.method, s.path[len("/rest/v1/"):], [k for k, _ in s.query]) for s in fake.sent]


# --- the rows -------------------------------------------------------------------------

def test_an_event_row_has_the_nine_columns_and_its_times_in_the_seasons_zone():
    season = load_season(SEASON_2027)
    rows = mirror.event_rows({"events": [ev("a"), ev("w", start="2027-01-10T09:00", end="2027-01-11T01:15")]}, season)
    assert [list(r) for r in rows] == [list(mirror.EVENT_COLUMNS)] * 2
    assert rows[0] == {"year": 2027, "id": "a", "title": "Event a", "start": "2027-09-04T11:30:00-04:00",
                       "end": "2027-09-04T12:30:00-04:00", "hotel": "Marriott", "room": "A601", "removed": False,
                       "cancelled": False}
    # the zone, not a fixed offset: January is standard time
    assert (rows[1]["start"], rows[1]["end"]) == ("2027-01-10T09:00:00-05:00", "2027-01-11T01:15:00-05:00")


def test_a_removed_event_a_null_time_and_an_empty_title_are_mirrored_as_the_file_has_them():
    season = load_season(SEASON_2027)
    rows = mirror.event_rows({"events": [ev("r", removed=True, cancelled=True), ev("n", start=None, end=None),
                                         ev("e", end=None, title="", room=""), ev("h", hotel=None)]}, season)
    assert [(r["id"], r["removed"], r["cancelled"]) for r in rows] == [
        ("r", True, True), ("n", False, False), ("e", False, False), ("h", False, False)]
    assert (rows[1]["start"], rows[1]["end"]) == (None, None)
    assert (rows[2]["start"], rows[2]["end"], rows[2]["title"], rows[2]["room"]) == (
        "2027-09-04T11:30:00-04:00", None, "", "")
    assert rows[3]["hotel"] is None


def test_what_event_rows_cannot_mirror_is_named_event_by_event():
    season = load_season(SEASON_2027)
    bad = [ev("a"), ev("a"), ev("s", start="2027-09-04T11:30:00"), ev("d", start="2027-09-04"),
           ev("o", end="2027-09-04T12:30-04:00"), ev("m", start="2027-02-30T10:00"), ev("c", cancelled="no"),
           ev("x", removed=1), {"title": "no id"}]
    with pytest.raises(mirror.MirrorError) as caught:
        mirror.event_rows({"events": bad}, season)
    text = str(caught.value)
    assert text.startswith("8 event(s) cannot be mirrored")
    for part in ("event 2 (a): its id is held twice", "event 3 (s): start '2027-09-04T11:30:00'",
                 "event 4 (d): start '2027-09-04'", "event 5 (o): end '2027-09-04T12:30-04:00'", "event 6 (m):",
                 "event 7 (c): cancelled 'no'", "event 8 (x): removed 1", "event 9: no id"):
        assert part in text


def test_a_zone_that_will_not_load_is_refused_never_guessed():
    with pytest.raises(mirror.MirrorError, match="Mars/Olympus_Mons cannot be loaded"):
        mirror.event_rows({"events": [ev("a")]}, {"year": 2027, "tz": "Mars/Olympus_Mons"})


def test_change_rows_takes_the_lines_after_the_watermark_as_they_are_compared_as_moments():
    lines = [{"run": STAMPS[0], "sha": "s0", "id": "a", "kind": "added", "cause": "source"},
             {"run": STAMPS[1], "sha": "s1", "id": "a", "kind": "merged", "to": "b", "cause": "source"},
             {"run": STAMPS[1], "sha": "s1", "id": "b", "kind": "time", "from": {"start": "x", "end": None},
              "to": {"start": "y", "end": None}, "cause": "code"}]
    last_run = {"stamp": STAMPS[1], "fetch_code_changed": False}
    rows, flagged = mirror.change_rows(lines, None, last_run, year=2027)
    assert [list(r) for r in rows] == [["year", "run", "sha", "id", "kind", "from", "to", "cause",
                                        "fetch_code_changed"]] * 3
    assert rows[1] == {"year": 2027, "run": STAMPS[1], "sha": "s1", "id": "a", "kind": "merged", "from": None,
                       "to": "b", "cause": "source", "fetch_code_changed": False}
    assert rows[2]["from"] == {"start": "x", "end": None} and rows[2]["cause"] == "code"
    assert flagged == [STAMPS[0]]
    # the watermark as PostgREST returns it, or in any other offset: the same moment
    same = dt.datetime.fromisoformat(STAMPS[0]).astimezone(dt.timezone(dt.timedelta(hours=-4))).isoformat()
    later, flagged = mirror.change_rows(lines, same, last_run, year=2027)
    assert [r["run"] for r in later] == [STAMPS[1], STAMPS[1]] and flagged == []
    assert mirror.change_rows(lines, STAMPS[1], last_run, year=2027) == ([], [])


def test_the_flag_with_two_runs_unmirrored_is_true_for_the_earlier_and_last_runs_own_for_its_lines():
    lines = [{"run": STAMPS[n], "sha": f"s{n}", "id": i, "kind": "added", "cause": "source"}
             for n in (0, 1, 2) for i in ("a", "b")]
    rows, flagged = mirror.change_rows(lines, STAMPS[0], {"stamp": STAMPS[2], "fetch_code_changed": False}, year=2027)
    assert [(r["run"], r["fetch_code_changed"]) for r in rows] == [(STAMPS[1], True), (STAMPS[1], True),
                                                                   (STAMPS[2], False), (STAMPS[2], False)]
    assert flagged == [STAMPS[1]]
    rows, flagged = mirror.change_rows(lines, None, {"stamp": STAMPS[2], "fetch_code_changed": True}, year=2027)
    assert {r["run"]: r["fetch_code_changed"] for r in rows} == {STAMPS[0]: True, STAMPS[1]: True, STAMPS[2]: True}
    assert flagged == [STAMPS[0], STAMPS[1]]


def test_ids_to_delete_are_those_the_table_holds_and_the_file_does_not():
    assert mirror.ids_to_delete(["c", "a", "b.1", "d"], ["a", "d", "e"]) == ["b.1", "c"]
    assert mirror.ids_to_delete([], ["a"]) == [] and mirror.ids_to_delete(["a"], ["a"]) == []


def test_the_kinds_are_every_one_the_diff_writes():
    assert set(mirror.KINDS) == {"added", "merged"} | set(diff_stage.FLAGS) | set(diff_stage.VALUES)


def test_a_log_line_that_cannot_be_mirrored_is_named_by_its_line():
    good = {"run": STAMPS[0], "sha": "s", "id": "a", "kind": "added", "cause": "source"}
    cases = [({**good, "tags": 1}, "`tags` is not a key the log writes"),
             ({k: v for k, v in good.items() if k != "cause"}, "`cause` is missing"),
             ({**good, "kind": "retagged"}, "kind 'retagged'"),
             ({**good, "run": "2027-08-01T10:17:00"}, "run '2027-08-01T10:17:00' is not a time with its offset"),
             ({**good, "id": ""}, "its id or sha is not a string")]
    for line, message in cases:
        with pytest.raises(mirror.MirrorError, match="changes.jsonl, line 2: " + message.replace("(", r"\(")):
            mirror.parse_log((json.dumps(good) + "\n" + json.dumps(line) + "\n").encode(), "changes.jsonl")
    twice = json.dumps(good) + "\n" + json.dumps({**good, "run": "2027-08-01T06:17:00-04:00"}) + "\n"
    with pytest.raises(mirror.MirrorError, match="line 2: a second line for run"):
        mirror.parse_log(twice.encode(), "changes.jsonl")
    with pytest.raises(mirror.MirrorError, match="line 1, is not JSON"):
        mirror.parse_log(b"{not json\n", "changes.jsonl")


# --- the committed 2026 file ----------------------------------------------------------

def test_the_committed_2026_file_converts_whole_every_time_with_its_offset(env, capsys):
    season = load_season(SEASON_2026)
    with open(os.path.join(ROOT, "data", "2026", "events.v2.json"), encoding="utf-8") as f:
        rows = mirror.event_rows(json.load(f), season)
    assert len(rows) == 3459
    assert all(r["year"] == 2026 for r in rows)
    times = [r[k] for r in rows for k in ("start", "end")]
    assert all(t is not None and dt.datetime.fromisoformat(t).utcoffset() == dt.timedelta(hours=-4) for t in times)
    fake = FakePostgrest()
    assert run(SEASON_2026, fake, "--dry-run") == 0
    assert capsys.readouterr().out == "3,459 events, 0 lines\n"
    assert fake.sent == []


# --- the job --------------------------------------------------------------------------

def test_a_first_mirror_reads_the_watermark_first_and_writes_it_last(env, tmp_path, capsys):
    season = live_year(tmp_path / "2027", [[ev("a"), ev("b", cancelled=True)], [ev("a", title="A, renamed"),
                                                                                ev("b", cancelled=True), ev("c")]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert shape(fake) == [("GET", "mirror_state", ["select", "year"]),
                           ("POST", "schedule_events", ["on_conflict"]),
                           ("GET", "schedule_events", ["select", "year", "order", "limit", "offset"]),
                           ("GET", "schedule_events", ["select", "year", "order", "limit", "offset"]),
                           ("POST", "schedule_changes", ["on_conflict"]),
                           ("POST", "mirror_state", ["on_conflict"])]
    get_state, events, page, _, changes, state = fake.sent
    assert get_state.query == [("select", "last_run,last_sha"), ("year", "eq.2027")]
    assert events.query == [("on_conflict", "year,id")] and changes.query == [("on_conflict", "year,run,id,kind")]
    assert state.query == [("on_conflict", "year")]
    assert page.query == [("select", "id"), ("year", "eq.2027"), ("order", "id.asc"), ("limit", "1000"),
                          ("offset", "0")]
    assert fake.sent[3].query[-1] == ("offset", "3")
    merge = "handling=strict,resolution=merge-duplicates,return=minimal,count=exact"
    assert [s.headers.get("Prefer") for s in fake.sent] == [None, merge, None, None, merge, merge]
    assert state.body == [{"year": 2027, "last_run": STAMPS[1], "last_sha": "f00dcafe" * 5,
                           "updated_at": "2027-08-03T09:00:00+00:00"}]
    assert [r["id"] for r in fake.rows("schedule_events")] == ["a", "b", "c"]
    assert fake.rows("schedule_events")[0]["title"] == "A, renamed"
    assert [(r["run"], r["id"], r["kind"], r["fetch_code_changed"]) for r in fake.rows("schedule_changes")] == [
        (STAMPS[0], "a", "added", True), (STAMPS[0], "b", "added", True),
        (STAMPS[1], "a", "title", False), (STAMPS[1], "c", "added", False)]
    out = capsys.readouterr().out
    assert "3 events upserted · 0 rows deleted · 4 change lines written" in out
    assert f"watermark none → {STAMPS[1]}" in out


def test_writes_go_1000_rows_a_request_and_the_ids_are_read_1000_a_page(env, tmp_path):
    season = live_year(tmp_path / "2027", [[ev(f"e{n:04}") for n in range(2500)]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert [len(s.body) for s in fake.to("POST", "schedule_events")] == [1000, 1000, 500]
    assert [len(s.body) for s in fake.to("POST", "schedule_changes")] == [1000, 1000, 500]
    assert [dict(s.query)["offset"] for s in fake.to("GET", "schedule_events")] == ["0", "1000", "2000", "2500"]
    assert len(fake.rows("schedule_events")) == 2500 and len(fake.rows("schedule_changes")) == 2500


def test_the_ids_are_read_whole_where_the_server_pages_under_1000(env, tmp_path):
    season = frozen_year(tmp_path / "2026", [ev(f"e{n:03}") for n in range(5)])
    fake = FakePostgrest(max_rows=2)
    fake.seed("schedule_events", [{**mirror.event_rows({"events": [ev("stale")]}, load_season(SEASON_2026))[0]}])
    assert run(season, fake) == 0
    assert [dict(s.query)["offset"] for s in fake.to("GET", "schedule_events")] == ["0", "2", "4", "6"]
    assert [r["id"] for r in fake.rows("schedule_events")] == [f"e{n:03}" for n in range(5)]


def test_a_second_run_sends_no_change_lines_and_leaves_the_tables_as_they_were(env, tmp_path):
    season = live_year(tmp_path / "2027", [[ev("a")], [ev("a", room="A602"), ev("b")]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    tables = {t: fake.rows(t) for t in TABLES}
    fake.sent.clear()
    assert run(season, fake) == 0
    assert fake.to("POST", "schedule_changes") == [] and fake.to("DELETE", "schedule_events") == []
    assert {t: fake.rows(t) for t in TABLES} == tables


def test_a_merged_event_leaves_the_table_and_its_line_arrives(env, tmp_path):
    folder = tmp_path / "2027"
    fake = FakePostgrest()
    assert run(live_year(folder, [[ev("m1"), ev("m2"), ev("x")]]), fake) == 0
    fake.sent.clear()
    assert run(live_year(folder, [[ev("m1"), ev("m2"), ev("x")], [ev("m1", was=["m2"]), ev("x")]]), fake) == 0
    [delete] = fake.to("DELETE", "schedule_events")
    assert delete.query == [("year", "eq.2027"), ("id", 'in.("m2")')]
    assert delete.headers["Prefer"] == "handling=strict,return=minimal,count=exact"
    assert [r["id"] for r in fake.rows("schedule_events")] == ["m1", "x"]
    assert [(r["id"], r["kind"], r["to"]) for r in fake.rows("schedule_changes") if r["run"] == STAMPS[1]] == [
        ("m2", "merged", "m1")]


def test_an_id_the_table_holds_that_no_merged_line_names_is_never_deleted(env, tmp_path, capsys):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake = FakePostgrest()
    fake.seed("schedule_events", mirror.event_rows({"events": [ev("stray")]}, load_season(SEASON_2027)))
    assert run(season, fake) == 1
    assert fake.to("DELETE", "schedule_events") == [] and fake.to("POST", "mirror_state") == []
    assert "that the file does not and no merged line names" in capsys.readouterr().out
    assert [r["id"] for r in fake.rows("schedule_events")] == ["a", "stray"]


def test_ids_with_a_dot_a_quote_or_a_backslash_are_deleted_exactly_and_100_a_request(env, tmp_path):
    season = frozen_year(tmp_path / "2026", [ev("keep")])
    odd = ["a.1", 'q"x', "b\\c", "c,d", "(p)", "sp ace", "pl+us"]
    many = [f"{n:04}-" + "x" * 32 for n in range(150)]
    fake = FakePostgrest()
    fake.seed("schedule_events", mirror.event_rows({"events": [ev(i) for i in odd + many + ["keep"]]},
                                                   load_season(SEASON_2026)))
    assert run(season, fake) == 0
    assert [r["id"] for r in fake.rows("schedule_events")] == ["keep"]
    deletes = fake.to("DELETE", "schedule_events")
    assert [len(in_list(dict(d.query)["id"][len("in."):])) for d in deletes] == [100, 57]
    assert max(len(w.split("\n")[0]) for w in fake.wire if w.startswith(URL) and "in.%28" in w) < 8000


def test_the_fake_reads_an_in_list_as_postgrest_does():
    assert in_list('("a.1","q\\"x","b\\\\c","c,d")') == ["a.1", 'q"x', "b\\c", "c,d"]
    assert in_list("(a,b.1)") == ["a", "b.1"]
    # a parenthesis not quoted ends the list, and the rest is dropped: fewer rows, no error
    assert in_list('(a,(p),"c")') == ["a", "(p"]


@pytest.mark.parametrize("lost", [requests.ConnectionError("connection reset"), requests.ReadTimeout("read timed out"),
                                  Answer(504, "gateway timeout")])
def test_a_delete_tried_again_after_its_first_try_landed_counts_fewer_and_the_job_goes_on(env, tmp_path, lost):
    season = frozen_year(tmp_path / "2026", [ev("keep")])
    fake, waits = FakePostgrest(), []
    fake.seed("schedule_events", mirror.event_rows({"events": [ev("gone"), ev("also"), ev("keep")]},
                                                   load_season(SEASON_2026)))

    def landed_then_lost(sent):
        if sent.method == "DELETE" and len(fake.to("DELETE", "schedule_events")) == 1:
            fake._delete("schedule_events", sent.query, {"count": "exact"})   # the first try lands; its answer is lost
            return lost
        return None
    fake.fail = landed_then_lost
    assert run(season, fake, sleeps=waits) == 0
    assert waits == [5] and len(fake.to("DELETE", "schedule_events")) == 2
    assert [r["id"] for r in fake.rows("schedule_events")] == ["keep"] and len(fake.rows("mirror_state")) == 1


def test_a_delete_the_server_counts_short_stops_the_job(env, tmp_path, capsys):
    season = frozen_year(tmp_path / "2026", [ev("keep")])
    fake = FakePostgrest()
    fake.seed("schedule_events", mirror.event_rows({"events": [ev("gone"), ev("keep")]}, load_season(SEASON_2026)))
    fake.fail = lambda s: Answer(204, None, {"Content-Range": "*/0"}) if s.method == "DELETE" else None
    assert run(season, fake) == 1
    assert "the server counts 0 row(s) of 1 sent" in capsys.readouterr().out
    assert fake.to("POST", "mirror_state") == []


@pytest.mark.parametrize("table", ["schedule_events", "schedule_changes"])
@pytest.mark.parametrize("answer, counted", [(Answer(201, None, {"Content-Range": "*/0"}), "0"),
                                             (Answer(201, None, {"Content-Range": "*/2"}), "2"),
                                             (Answer(201, None, {}), "nothing")])
def test_an_upsert_the_server_counts_otherwise_than_its_rows_stops_the_job(env, tmp_path, capsys, table, answer,
                                                                          counted):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake = FakePostgrest()
    fake.fail = lambda s: answer if s.method == "POST" and s.path.endswith(table) else None
    assert run(season, fake) == 1
    assert f"POST /rest/v1/{table}: the server counts {counted} row(s) of 1 sent" in capsys.readouterr().out
    assert fake.to("POST", "mirror_state") == []


def test_a_commit_older_than_the_one_mirrored_writes_nothing(env, tmp_path, capsys):
    season = live_year(tmp_path / "2027", [[ev("a")], [ev("a"), ev("b")]])
    fake = FakePostgrest()
    fake.seed("mirror_state", [{"year": 2027, "last_run": STAMPS[3], "last_sha": "newer",
                                "updated_at": CLOCK.isoformat()}])
    assert run(season, fake) == 1
    assert shape(fake) == [("GET", "mirror_state", ["select", "year"])]
    out = capsys.readouterr().out
    assert f"mirror_state holds the log to {STAMPS[3]}, and this commit's log ends at {STAMPS[1]}" in out


def test_lines_re_sent_after_a_newer_run_landed_all_take_true_one_value_a_run(env, tmp_path, monkeypatch, capsys):
    folder, fake = tmp_path / "2027", FakePostgrest()
    first = [[ev(f"e{n:04}") for n in range(1500)]]
    # the first mirror writes its lines, false, and fails before the watermark
    fake.fail = lambda s: fail(400, "23514", "refused") if s.path.endswith("mirror_state") and s.method == "POST" \
        else None
    assert run(live_year(folder, first), fake) == 1
    assert {r["fetch_code_changed"] for r in fake.rows("schedule_changes")} == {False}
    # the next run lands before it is mirrored again: the first run's lines are re-sent, and now read true
    fake.fail, fake.sent[:] = None, []
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    assert run(live_year(folder, first + [first[0] + [ev("new")]]), fake) == 0
    by_run = collections.defaultdict(set)
    for r in fake.rows("schedule_changes"):
        by_run[r["run"]].add(r["fetch_code_changed"])
    assert by_run == {STAMPS[0]: {True}, STAMPS[1]: {False}}
    assert f"::warning title=mirror::fetch_code_changed written true for 1 earlier run(s) not yet mirrored: " \
           f"{STAMPS[0]}" in capsys.readouterr().out


def test_the_frozen_year_mirrors_its_events_alone_and_a_watermark_of_none(env, tmp_path):
    season = frozen_year(tmp_path / "2026", [ev("a", start="2026-09-04T11:30", end="2026-09-04T12:30")])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert shape(fake) == [("GET", "mirror_state", ["select", "year"]), ("POST", "schedule_events", ["on_conflict"]),
                           ("GET", "schedule_events", ["select", "year", "order", "limit", "offset"]),
                           ("GET", "schedule_events", ["select", "year", "order", "limit", "offset"]),
                           ("POST", "mirror_state", ["on_conflict"])]
    assert fake.rows("schedule_events")[0]["start"] == "2026-09-04T15:30:00+00:00"
    assert fake.rows("mirror_state") == [{"year": 2026, "last_run": None, "last_sha": "f00dcafe" * 5,
                                          "updated_at": "2027-08-03T09:00:00+00:00"}]


def test_null_times_reach_the_table_as_null(env, tmp_path):
    season = live_year(tmp_path / "2027", [[ev("a", start=None, end=None), ev("b", end=None)]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert [(r["id"], r["start"], r["end"]) for r in fake.rows("schedule_events")] == [
        ("a", None, None), ("b", "2027-09-04T15:30:00+00:00", None)]


def test_a_season_before_its_first_full_run_exits_0_and_asks_for_nothing(env, tmp_path, capsys, monkeypatch):
    folder = tmp_path / "2027"
    os.makedirs(folder)
    shutil.copy(SEASON_2027, folder / "season.json")
    write(folder, "ids.jsonl", "")
    monkeypatch.delenv("SUPABASE_SERVICE_KEY")
    fake, summary = FakePostgrest(), tmp_path / "summary.md"
    assert run(str(folder / "season.json"), fake, "--summary", str(summary)) == 0
    assert fake.sent == []
    assert "events.v2.json is absent: a season before its first full run has nothing to mirror." in \
        capsys.readouterr().out
    assert summary.read_text(encoding="utf-8").startswith("### Mirror 2027: nothing to mirror\n")


@pytest.mark.parametrize("damage, message", [
    ({"changes.jsonl": None}, "changes.jsonl is absent: a live year's events.v2.json is written with its change log"),
    ({"last-run.json": None}, "last-run.json is absent"),
    ({"last-run.json": '{"stamp": "2027-08-01T10:17:00+00:00"}'}, "it is not an object holding `stamp` and "),
    ({"last-run.json": '{"stamp": "2027-08-01T10:17:00", "fetch_code_changed": false}'}, "holding `stamp` and "),
    ({"events.v2.json": '{"events": []}'}, "holds no events: mirroring it would delete the year"),
    ({"events.v2.json": "{not json"}, "events.v2.json cannot be read"),
    ({"changes.jsonl": '{"run": 1}\n'}, "changes.jsonl, line 1: `sha` is missing"),
])
def test_a_file_that_cannot_be_read_sends_nothing_and_exits_1(env, tmp_path, capsys, damage, message):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    for name, text in damage.items():
        path = tmp_path / "2027" / name
        if text is None:
            path.unlink()
        else:
            path.write_text(text, encoding="utf-8")
    fake = FakePostgrest()
    assert run(season, fake) == 1
    assert fake.sent == []
    assert message in capsys.readouterr().out


def test_a_frozen_year_with_a_change_log_is_refused(env, tmp_path, capsys):
    season = frozen_year(tmp_path / "2026", [ev("a")])
    write(tmp_path / "2026", "changes.jsonl", "")
    fake = FakePostgrest()
    assert run(season, fake) == 1 and fake.sent == []
    assert "a frozen year has no change log or last-run.json" in capsys.readouterr().out


def test_a_dry_run_reads_everything_counts_every_line_and_needs_no_key(env, tmp_path, capsys, monkeypatch):
    season = live_year(tmp_path / "2027", [[ev("a"), ev("b")], [ev("a"), ev("b", title="B2")]])
    monkeypatch.delenv("SUPABASE_URL")
    monkeypatch.delenv("SUPABASE_SERVICE_KEY")
    fake = FakePostgrest()
    assert run(season, fake, "--dry-run") == 0
    assert capsys.readouterr().out == "2 events, 3 lines\n" and fake.sent == []


# --- the key and the address -----------------------------------------------------------

def test_an_sb_secret_key_goes_on_apikey_alone_and_a_jwt_as_the_bearer_too(env, tmp_path):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert {tuple(sorted(s.headers)) for s in fake.sent} == {("apikey",), ("Content-Type", "Prefer", "apikey")}
    assert {s.headers["apikey"] for s in fake.sent} == {"<key>"}
    env.setenv("SUPABASE_SERVICE_KEY", SERVICE_JWT)
    fake = FakePostgrest(key=SERVICE_JWT)
    assert run(season, fake) == 0
    assert {(s.headers["apikey"], s.headers["Authorization"]) for s in fake.sent} == {("<key>", "Bearer <key>")}


@pytest.mark.parametrize("value", ["", "   ", "sb_publishable_abcdefghijklmnopqrstuvwxyz", jwt("anon"),
                                   "sb_secret_has a space in it", "sb_secret_line\nbreak_inside", "eyJ.not.a-jwt"])
def test_a_key_that_is_not_a_secret_key_is_refused_by_its_name_alone(env, tmp_path, capsys, value):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    env.setenv("SUPABASE_SERVICE_KEY", value)
    fake = FakePostgrest()
    assert run(season, fake) == 1 and fake.sent == []
    out = capsys.readouterr().out
    assert "SUPABASE_SERVICE_KEY is not" in out
    assert value.strip() == "" or value.strip() not in out


def test_a_key_pasted_with_a_trailing_newline_is_sent_stripped(env, tmp_path):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    env.setenv("SUPABASE_SERVICE_KEY", SECRET + "\r\n")
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert {s.headers["apikey"] for s in fake.sent} == {"<key>"}


def test_the_key_is_in_no_url_no_body_and_no_output_even_when_the_server_echoes_it(env, tmp_path, capsys,
                                                                                    monkeypatch):
    season = live_year(tmp_path / "2027", [[ev("a")], [ev("a"), ev("b")]])
    fake = FakePostgrest()
    assert run(season, fake) == 0
    assert fake.wire and all(SECRET not in w for w in fake.wire)
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    fake = FakePostgrest()
    fake.fail = lambda s: fail(400, "XX000", f"no such key {SECRET}") if s.method == "POST" else None
    summary = tmp_path / "summary.md"
    assert run(season, fake, "--summary", str(summary)) == 1
    out, text = capsys.readouterr().out, summary.read_text(encoding="utf-8")
    assert SECRET not in out and SECRET not in text
    assert "no such key ***" in out and "::error title=mirror::" in out


@pytest.mark.parametrize("value, ok", [(URL, True), (URL + "/", True), ("http://127.0.0.1:54321", True),
                                       ("http://localhost:54321", True), ("http://project.supabase.test", False),
                                       (URL + "/rest/v1", False), (URL + "?x=1", False), ("", False),
                                       ("project.supabase.test", False)])
def test_the_address_is_an_https_origin_or_http_on_this_machine(value, ok):
    if ok:
        assert mirror.check_url(value) == value.rstrip("/")
    else:
        with pytest.raises(mirror.MirrorError, match="SUPABASE_URL is not"):
            mirror.check_url(value)


# --- failures -----------------------------------------------------------------------------

@pytest.mark.parametrize("status", [429, 503])
def test_a_429_or_a_5xx_is_tried_again_after_5_and_15_seconds_and_a_400_is_not(env, tmp_path, capsys, status):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake, answers, waits = FakePostgrest(), iter([Answer(status, "busy"), Answer(status, "busy")]), []
    fake.fail = lambda s: next(answers, None) if s.path.endswith("schedule_events") and s.method == "POST" else None
    assert run(season, fake, sleeps=waits) == 0
    assert waits == [5, 15] and len(fake.to("POST", "schedule_events")) == 3
    fake, waits = FakePostgrest(), []
    fake.fail = lambda s: fail(400, "23502", "null value") if s.path.endswith("schedule_events") else None
    assert run(season, fake, sleeps=waits) == 1
    assert waits == [] and len(fake.to("POST", "schedule_events")) == 1
    assert "POST /rest/v1/schedule_events?on_conflict=year,id: 400 " in capsys.readouterr().out


@pytest.mark.parametrize("lost", [requests.ConnectionError("connection reset"), requests.ReadTimeout("read timed out")])
def test_a_connection_lost_three_times_stops_the_job_and_names_the_request(env, tmp_path, capsys, lost):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake, waits = FakePostgrest(), []
    fake.fail = lambda s: lost
    assert run(season, fake, sleeps=waits) == 1
    assert waits == [5, 15] and len(fake.sent) == 3
    assert f"GET /rest/v1/mirror_state?select=last_run,last_sha&year=eq.2027: {type(lost).__name__}: {lost} " \
           "(after 3 tries)" in capsys.readouterr().out


@pytest.mark.parametrize("at", [455, 470, 490])   # the cut at 500 leaves 35, 20 and 0 of its secret part
def test_a_key_the_server_echoes_across_the_cut_leaves_no_part_of_itself(env, tmp_path, capsys, at):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake, summary = FakePostgrest(), tmp_path / "summary.md"
    fake.fail = lambda s: Answer(400, "x" * at + SECRET + " and more") if s.method == "POST" else None
    assert run(season, fake, "--summary", str(summary)) == 1
    shown = capsys.readouterr().out + summary.read_text(encoding="utf-8")
    assert not [SECRET[i:i + 12] for i in range(10, len(SECRET) - 11) if SECRET[i:i + 12] in shown]


def test_an_error_nobody_foresaw_is_reported_redacted(env, tmp_path, capsys):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    fake = FakePostgrest()
    fake.fail = lambda s: RuntimeError(f"the session broke holding {SECRET}")
    assert run(season, fake) == 1
    out = capsys.readouterr().out
    assert "RuntimeError: the session broke holding ***" in out and SECRET not in out


def test_a_prefer_the_server_does_not_know_fails_rather_than_degrades(env, tmp_path, monkeypatch, capsys):
    season = live_year(tmp_path / "2027", [[ev("a")]])
    monkeypatch.setattr(mirror, "MERGE", mirror.MERGE.replace("merge-duplicates", "merge-duplicate"))
    fake = FakePostgrest()
    assert run(season, fake) == 1
    assert "PGRST122" in capsys.readouterr().out
    assert fake.rows("schedule_events") == []


def test_the_summary_says_what_was_written_and_what_was_flagged(env, tmp_path):
    folder, fake = tmp_path / "2027", FakePostgrest()
    runs = [[ev("a")], [ev("a"), ev("b")], [ev("a"), ev("b"), ev("c")]]
    assert run(live_year(folder, runs[:1]), fake) == 0
    summary = tmp_path / "summary.md"
    assert run(live_year(folder, runs), fake, "--summary", str(summary)) == 0
    assert summary.read_text(encoding="utf-8") == (
        "### Mirror 2027: mirrored\n\n"
        "3 events upserted · 0 rows deleted · 2 change lines written\n\n"
        f"watermark {STAMPS[0]} → {STAMPS[2]} · sha `f00dcaf`\n\n"
        f"fetch_code_changed written true for 1 earlier run(s) not yet mirrored (#47, the fail-safe): {STAMPS[1]}\n")
