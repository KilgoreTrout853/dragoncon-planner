#!/usr/bin/env python3
"""The mirror job (DECISIONS #50, #54; docs/sync/contract.md, section 6): a year's committed schedule copied into the
Supabase project's schedule_events, schedule_changes and mirror_state, where the push job reads it. The pipeline never
learns Supabase exists; the mirror is off its path and off the site's.

    python mirror.py --season data/2027/season.json                      # mirror the year: SUPABASE_URL and the key
    python mirror.py --season data/2026/season.json --dry-run            # read and check the files, send nothing
    python mirror.py --season data/2027/season.json --summary "$GITHUB_STEP_SUMMARY"

It reads three files beside the season file: events.v2.json, changes.jsonl and last-run.json. A frozen season (#46)
has the first alone and mirrors its events; a live one has all three, or none of them has been written by a full run.
events.v2.json absent - a season before its first full run - is nothing to mirror, and exits 0 with a note. Every
file is read and checked before any request, so a file that cannot be read sends nothing and exits 1.

The invariant: schedule_events for the year equals the file, a null time included. The writes, in this order:

    mirror_state   read first: a watermark later than this log's last run means this commit is older than the one
                   last mirrored, and the job stops before any write rather than take the tables back
    events         every event, removed ones too, upserted on (year, id) 1,000 a request; then the year's ids read
                   back 1,000 a page, and those the file no longer holds deleted 100 a request - in a live year only
                   ids a `merged` line names, since an event leaves the file by a merge or not at all (#43, #47)
    changes        the log's lines later than the watermark, each as it is plus its year and fetch_code_changed,
                   upserted on (year, run, id, kind) 1,000 a request
    mirror_state   last: last_run the log's last run, last_sha the commit mirrored, updated_at sent

No transaction: each step is idempotent and the watermark comes last, so a run that fails partway is completed by the
next. fetch_code_changed: a line of last-run.json's own run takes its flag; a line of any earlier run not yet mirrored
is written true, fail-safe (#47), and the run is named in a warning. The lines after the watermark are always sent
together, so a run's lines carry one value, which only moves from false to true as newer runs land.

The HTTP is Rest's, over a requests.Session a test replaces. The key is SUPABASE_SERVICE_KEY: an sb_secret_ key, sent
as apikey alone, or a legacy service_role JWT, sent as apikey and as the bearer; it is never printed, and every
message is redacted of it. A request that fails for want of a connection, a 429 or a 5xx is tried three times in all,
since every one is idempotent - a DELETE tried again may count fewer rows, those an earlier try deleted before its
answer was lost; any other failure exits 1 with the status and the server's body. Exit 0: mirrored, nothing to
mirror, or a dry run. Exit 1: anything else.
"""

import argparse
import base64
import dataclasses
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
import traceback
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests

import diff_stage
from season import SeasonError, load as load_season

HERE = os.path.dirname(os.path.abspath(__file__))
URL_VAR, KEY_VAR, SHA_VAR = "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MIRROR_SHA"
BATCH = 1000      # rows a write, and ids a page: Supabase's max rows, hosted and in supabase/config.toml
DELETES = 100     # ids a DELETE: its request line about 4 KB, under the gateway's 8 KB
WAITS = (5, 15)   # seconds before the second and the third try
TIMEOUT = 60
LISTED = 20       # flagged runs a warning names; the summary names them all
TIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")   # an event's start or end, whole: local, to the minute (#42)
# The change log's twelve kinds and two causes, as schedule_changes' checks hold them (contract.md, The change log).
KINDS = ("added", "removed", "restored", "cancelled", "uncancelled", "merged", "time", "place", "title", "people",
         "tracks", "description")
CAUSES = ("source", "code")
EVENT_COLUMNS = ("year", "id", "title", "start", "end", "hotel", "room", "removed", "cancelled")
# The key's two forms, each matched whole (fullmatch): a secret key, and a JWT, its payload the middle part.
SECRET_KEY = re.compile(r"sb_secret_[A-Za-z0-9_-]+")
JWT = re.compile(r"[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+")
MERGE = "handling=strict,resolution=merge-duplicates,return=minimal,count=exact"
DELETE = "handling=strict,return=minimal,count=exact"


class MirrorError(Exception):
    """What stops the job: exit 1. Its message never holds the key."""


@dataclasses.dataclass
class Year:
    """A season's files, read and checked: `doc` None where events.v2.json is absent; `lines` and `last_run` None
    for a frozen year."""
    season: dict
    folder: str
    doc: dict = None
    lines: list = None
    last_run: dict = None


# ---------------------------------------------------------------------------
# The files
# ---------------------------------------------------------------------------

def read_year(season_path):
    """The season file and the three beside it, each read and checked -> Year. Raises MirrorError."""
    try:
        season = load_season(season_path)
    except SeasonError as exc:
        raise MirrorError(str(exc)) from None
    folder = os.path.dirname(os.path.abspath(season_path))
    year = Year(season=season, folder=folder)
    data = _bytes(_shown(folder, "events.v2.json"))
    if data is None:
        return year
    year.doc = _json(data, _shown(folder, "events.v2.json"))
    if not isinstance(year.doc, dict) or not isinstance(year.doc.get("events"), list):
        raise MirrorError(f"{_shown(folder, 'events.v2.json')} cannot be read: it is not an object holding `events`")
    if not year.doc["events"]:
        raise MirrorError(f"{_shown(folder, 'events.v2.json')} holds no events: mirroring it would delete the year")
    log, last = _bytes(_shown(folder, "changes.jsonl")), _bytes(_shown(folder, "last-run.json"))
    if season["frozen"]:
        if log is not None or last is not None:
            raise MirrorError(f"{_shown(folder, 'season.json')} is frozen, and a frozen year has no change log or "
                              "last-run.json (#46)")
        return year
    if log is None or last is None:
        raise MirrorError(f"{_shown(folder, 'changes.jsonl' if log is None else 'last-run.json')} is absent: a live "
                          "year's events.v2.json is written with its change log and last-run.json (#42, #44)")
    year.lines = parse_log(log, _shown(folder, "changes.jsonl"))
    year.last_run = _json(last, _shown(folder, "last-run.json"))
    if not (isinstance(year.last_run, dict) and _aware(year.last_run.get("stamp"))
            and isinstance(year.last_run.get("fetch_code_changed"), bool)):
        raise MirrorError(f"{_shown(folder, 'last-run.json')} cannot be read: it is not an object holding `stamp` "
                          "and `fetch_code_changed`")
    return year


def parse_log(data, path):
    """changes.jsonl's bytes -> its lines, each checked: the keys the log writes and no other, a kind and a cause of
    the database's, a run with an offset, and one line a run, id and kind. Raises MirrorError naming the line."""
    lines, seen = [], set()
    for n, text in enumerate(data.decode("utf-8").split("\n"), 1):
        if not text.strip():
            continue
        try:
            line = json.loads(text)
        except ValueError as exc:
            raise MirrorError(f"{path}, line {n}, is not JSON ({exc})") from None
        problem = _line_problem(line)
        if problem:
            raise MirrorError(f"{path}, line {n}: {problem}")
        key = (_instant(line["run"]), line["id"], line["kind"])
        if key in seen:
            raise MirrorError(f"{path}, line {n}: a second line for run {line['run']}, id {line['id']} and kind "
                              f"{line['kind']} - the log holds one line an id and kind a run (#47)")
        seen.add(key)
        lines.append(line)
    return lines


def _line_problem(line):
    if not isinstance(line, dict):
        return "it is not an object"
    unknown = [k for k in line if k not in diff_stage.LINE_KEYS]
    missing = [k for k in ("run", "sha", "id", "kind", "cause") if k not in line]
    if unknown or missing:
        return ", ".join([f"`{k}` is not a key the log writes" for k in unknown] + [f"`{k}` is missing" for k in missing])
    if not (isinstance(line["id"], str) and line["id"]) or not isinstance(line["sha"], str):
        return "its id or sha is not a string"
    if line["kind"] not in KINDS or line["cause"] not in CAUSES:
        return f"kind {line['kind']!r} or cause {line['cause']!r} is not one the log writes"
    if not _aware(line["run"]):
        return f"run {line['run']!r} is not a time with its offset"
    return None


def _bytes(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise MirrorError(f"{path} cannot be read ({exc.strerror or exc})") from None


def _json(data, path):
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError as exc:
        raise MirrorError(f"{path} cannot be read ({exc})") from None


def _shown(folder, name):
    path = os.path.join(folder, name)
    try:
        path = os.path.relpath(path)
    except ValueError:   # another drive, on Windows
        pass
    return path.replace(os.sep, "/")


def _instant(text):
    """A stamp with its offset, as a datetime to compare: the log's and PostgREST's forms of one moment are equal."""
    return dt.datetime.fromisoformat(text)


def _aware(text):
    try:
        return isinstance(text, str) and _instant(text).tzinfo is not None
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# The rows: pure
# ---------------------------------------------------------------------------

def event_rows(doc, season):
    """events.v2.json's events -> schedule_events' rows, every event with all nine columns, in the file's order.
    start and end, local to the minute, take the season's time zone and are sent with their offset; a null stays
    null (#54). removed is true only where the event carries it. Raises MirrorError listing what cannot be mirrored:
    an id missing or held twice, a time not local to the minute, a field of the wrong type, a zone that will not
    load - nothing is sent then."""
    try:
        zone = ZoneInfo(season["tz"])
    except (ZoneInfoNotFoundError, ValueError):
        raise MirrorError(f"the time zone {season['tz']} cannot be loaded here (on Windows, install tzdata): "
                          "the mirror never guesses a zone") from None
    rows, seen, problems = [], set(), []
    for n, e in enumerate(doc["events"]):
        i = e.get("id") if isinstance(e, dict) else None
        where = f"event {n + 1} ({i})" if i else f"event {n + 1}"
        if not (isinstance(i, str) and i):
            problems.append(f"{where}: no id")
            continue
        if i in seen:
            problems.append(f"{where}: its id is held twice")
        seen.add(i)
        wrong = [k for k, ok in (("title", isinstance(e.get("title"), str)),
                                 ("hotel", e.get("hotel") is None or isinstance(e.get("hotel"), str)),
                                 ("room", e.get("room") is None or isinstance(e.get("room"), str)),
                                 ("cancelled", isinstance(e.get("cancelled"), bool)),
                                 ("removed", isinstance(e.get("removed", False), bool))) if not ok]
        times = {k: e.get(k) for k in ("start", "end")}
        wrong += [k for k, v in times.items() if not (v is None or (isinstance(v, str) and TIME.fullmatch(v)))]
        if wrong:
            problems.append(f"{where}: " + ", ".join(f"{k} {e.get(k)!r}" for k in wrong))
            continue
        try:
            start, end = (_local(times[k], zone) for k in ("start", "end"))
        except ValueError as exc:
            problems.append(f"{where}: {exc}")
            continue
        rows.append({"year": season["year"], "id": i, "title": e["title"], "start": start, "end": end,
                     "hotel": e.get("hotel"), "room": e.get("room"), "removed": e.get("removed") is True,
                     "cancelled": e["cancelled"]})
    if problems:
        raise MirrorError(f"{len(problems)} event(s) cannot be mirrored: " + "; ".join(problems[:10])
                          + ("; ..." if len(problems) > 10 else ""))
    return rows


def _local(text, zone):
    """'2026-09-02T18:00' in America/New_York -> '2026-09-02T18:00:00-04:00'; None -> None."""
    if text is None:
        return None
    return dt.datetime.strptime(text, "%Y-%m-%dT%H:%M").replace(tzinfo=zone).isoformat()


def change_rows(lines, since, last_run, *, year):
    """The log's lines later than `since`, the watermark (all of them where it is None) -> (schedule_changes' rows,
    the runs flagged). Each row is the line as it is, `from` and `to` null where it has none, plus `year` and
    `fetch_code_changed`: last_run's own where the line's run is its stamp, true for a line of any earlier run - the
    fail-safe (#47) - whose run is then listed, in order. Stamps are compared as moments, not as text."""
    watermark = _instant(since) if since is not None else None
    stamp = _instant(last_run["stamp"]) if last_run else None
    rows, flagged = [], {}
    for line in lines:
        run = _instant(line["run"])
        if watermark is not None and run <= watermark:
            continue
        if stamp is not None and run == stamp:
            flag = last_run["fetch_code_changed"]
        else:
            flag = True
            flagged.setdefault(run, line["run"])
        rows.append({"year": year, "run": line["run"], "sha": line["sha"], "id": line["id"], "kind": line["kind"],
                     "from": line.get("from"), "to": line.get("to"), "cause": line["cause"],
                     "fetch_code_changed": flag})
    return rows, [flagged[run] for run in sorted(flagged)]


def ids_to_delete(in_table, in_file):
    """The ids the table holds for the year and the file does not, sorted."""
    return sorted(set(in_table) - set(in_file))


def last_run_of(lines):
    """The log's last run, as the log writes it - its latest - or None with no lines."""
    return max(lines, key=lambda line: _instant(line["run"]))["run"] if lines else None


# ---------------------------------------------------------------------------
# The key, the address and the SHA
# ---------------------------------------------------------------------------

def check_key(raw):
    """SUPABASE_SERVICE_KEY, stripped -> the key. An sb_secret_ key, or a JWT whose role is service_role; anything
    else - unset, a publishable or anon key, a character a header cannot carry - raises MirrorError naming the
    variable, never its value."""
    key = (raw or "").strip()
    if not key:
        raise MirrorError(f"{KEY_VAR} is not set")
    if SECRET_KEY.fullmatch(key):
        return key
    jwt = JWT.fullmatch(key)
    if jwt and _role(jwt.group(1)) == "service_role":
        return key
    raise MirrorError(f"{KEY_VAR} is not a secret key: it must be an sb_secret_ key or a JWT whose role is "
                      "service_role, which reaches the job tables (a publishable or anon key reaches none)")


def _role(payload):
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except ValueError:
        return None
    return claims.get("role") if isinstance(claims, dict) else None


def check_url(raw):
    """SUPABASE_URL -> the origin: https, or http on this machine (the CLI's local stack). Raises MirrorError."""
    url = (raw or "").strip()
    if not url:
        raise MirrorError(f"{URL_VAR} is not set")
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError:
        host = None
    local = host in ("localhost", "127.0.0.1")
    if (not host or not (parts.scheme == "https" or (parts.scheme == "http" and local))
            or parts.path not in ("", "/") or parts.query or parts.fragment or parts.username):
        raise MirrorError(f"{URL_VAR} is not the project's origin, https://<project>.supabase.co, or http on this "
                          f"machine: {url}")
    return f"{parts.scheme}://{parts.netloc}"


def mirror_sha():
    """The commit mirrored: MIRROR_SHA, the workflow's checkout, or else `git rev-parse HEAD` here."""
    sha = os.environ.get(SHA_VAR, "").strip()
    if sha:
        return sha
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise MirrorError(f"no SHA to record: {SHA_VAR} is unset and `git rev-parse HEAD` failed ({exc})") from None
    return out.stdout.strip()


def now():
    """The job's one read of the clock, for mirror_state's updated_at: UTC, to the second."""
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


# ---------------------------------------------------------------------------
# PostgREST
# ---------------------------------------------------------------------------

class Rest:
    """Every request the job sends, as the service role, over `session` - a requests.Session, or a test's fake with
    its request(). The apikey header always; the bearer only for a JWT - an sb_secret_ key is not one, and goes on
    apikey alone (Supabase's API keys guide). Queries are encoded by requests, never joined by hand."""

    def __init__(self, url, key, session=None, *, sleep=time.sleep):
        self.base = url.rstrip("/") + "/rest/v1/"
        self.key = key
        self.headers = {"apikey": key}
        if JWT.fullmatch(key):
            self.headers["Authorization"] = f"Bearer {key}"
        self.session = session if session is not None else requests.Session()
        self.sleep = sleep
        self.tries = 0   # the last request's tries: above 1, an earlier try may have landed before its answer was lost

    def send(self, method, table, params, *, prefer=None, body=None):
        """One request, tried up to three times where the failure is the connection's, a 429 or a 5xx -> the
        response. Raises MirrorError with the status and the server's body, or the exception's name, each redacted
        of the key before it is cut short, so no part of the key survives the cut."""
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        for attempt in range(len(WAITS) + 1):
            self.tries = attempt + 1
            try:
                response = self.session.request(method, self.base + table, params=params, headers=headers,
                                                data=data, timeout=TIMEOUT)
            except (requests.ConnectionError, requests.Timeout) as exc:
                failure, again = f"{type(exc).__name__}: {self._shown(exc)}", True
            except (requests.RequestException, ValueError) as exc:
                failure, again = f"{type(exc).__name__}: {self._shown(exc)}", False
            else:
                if 200 <= response.status_code < 300:
                    return response
                failure = f"{response.status_code} {self._shown(response.text)}"
                again = response.status_code == 429 or response.status_code >= 500
            if not again or attempt == len(WAITS):
                tries = f" (after {attempt + 1} tries)" if attempt else ""
                raise MirrorError(f"{method} /rest/v1/{table}?{_query(params)}: {failure}{tries}")
            self.sleep(WAITS[attempt])

    def _shown(self, text):
        return _clip(redact(str(text), [self.key]), 500)

    def read_state(self, year):
        """mirror_state's row for the year, or None."""
        rows = self.send("GET", "mirror_state", [("select", "last_run,last_sha"), ("year", f"eq.{year}")]).json()
        return rows[0] if rows else None

    def upsert(self, table, rows, on_conflict):
        """The rows, BATCH a request, each written whole on its key: inserted, or its row replaced -> the rows
        written, as the server counts them. A request whose count is not its rows' raises MirrorError."""
        written = 0
        for n in range(0, len(rows), BATCH):
            batch = rows[n:n + BATCH]
            response = self.send("POST", table, [("on_conflict", on_conflict)], prefer=MERGE, body=batch)
            written += _counted(response, len(batch), f"POST /rest/v1/{table}")
        return written

    def read_ids(self, year):
        """Every id schedule_events holds for the year, BATCH a page, the offset moved by the rows each returns,
        until one returns none - so a server whose max rows is under BATCH is read whole too."""
        ids, offset = [], 0
        while True:
            page = self.send("GET", "schedule_events", [("select", "id"), ("year", f"eq.{year}"),
                                                        ("order", "id.asc"), ("limit", str(BATCH)),
                                                        ("offset", str(offset))]).json()
            if not page:
                return ids
            ids += [row["id"] for row in page]
            offset += len(page)

    def delete_ids(self, table, year, ids):
        """The year's rows with these ids, DELETES a request, each id quoted as PostgREST's in-list reads it -> the
        rows deleted. A request that deletes other than its ids' count raises MirrorError: a quoting slip would
        otherwise match nothing, and say nothing. A DELETE tried again may find rows an earlier try, its answer
        lost, already deleted, so it may count fewer - never more."""
        deleted = 0
        for n in range(0, len(ids), DELETES):
            batch = ids[n:n + DELETES]
            listed = ",".join('"' + i.replace("\\", "\\\\").replace('"', '\\"') + '"' for i in batch)
            response = self.send("DELETE", table, [("year", f"eq.{year}"), ("id", f"in.({listed})")], prefer=DELETE)
            deleted += _counted(response, len(batch), f"DELETE /rest/v1/{table}", at_most=self.tries > 1)
        return deleted


def _counted(response, expected, what, *, at_most=False):
    """The rows the server counts a write affected, from Content-Range: `expected`, or, where `at_most`, no more
    than it. Raises MirrorError otherwise. An upsert tried again counts its rows again; a DELETE does not."""
    found = re.search(r"/(\d+)$", response.headers.get("Content-Range") or "")
    n = int(found.group(1)) if found else None
    if n is None or n > expected or (n < expected and not at_most):
        raise MirrorError(f"{what}: the server counts {n if found else 'nothing'} row(s) of {expected} sent "
                          f"(Content-Range {response.headers.get('Content-Range')!r})")
    return n


def _query(params):
    return _clip("&".join(f"{k}={v}" for k, v in params), 200)


def _clip(text, n):
    text = str(text)
    return text if len(text) <= n else text[:n] + f"... ({len(text):,} characters)"


# ---------------------------------------------------------------------------
# The job
# ---------------------------------------------------------------------------

def mirror(year, rows, rest, *, sha, clock, report):
    """The writes, in order (the module's docstring), filling `report` as each lands. Raises MirrorError."""
    y = year.season["year"]
    state = rest.read_state(y)
    since = state["last_run"] if state else None
    last = last_run_of(year.lines or [])
    report["watermark"] = since
    if since is not None and (last is None or _instant(since) > _instant(last)):
        raise MirrorError(f"mirror_state holds the log to {since}, and this commit's log ends "
                          f"{'at ' + last if last else 'with no line'}: the commit is older than the one last "
                          "mirrored, and mirroring it would take the tables back. Nothing was written")
    report["events"] = rest.upsert("schedule_events", rows, "year,id")
    doomed = ids_to_delete(rest.read_ids(y), [row["id"] for row in rows])
    if doomed and year.lines is not None:
        merged = {line["id"] for line in year.lines if line["kind"] == "merged"}
        stray = [i for i in doomed if i not in merged]
        if stray:
            raise MirrorError(f"schedule_events holds {len(stray)} id(s) for {y} that the file does not and no merged "
                              "line names - in a live year an event leaves the file only by a merge (#43, #47), so "
                              "the table or the file is not this year's; nothing deleted: " + ", ".join(stray[:10]))
    report["deleted"] = rest.delete_ids("schedule_events", y, doomed)
    changes, flagged = change_rows(year.lines or [], since, year.last_run, year=y)
    report["lines"] = rest.upsert("schedule_changes", changes, "year,run,id,kind")
    report["flagged"] = flagged
    rest.upsert("mirror_state", [{"year": y, "last_run": last, "last_sha": sha, "updated_at": clock().isoformat()}],
                "year")
    report.update(outcome="mirrored", watermark_now=last, sha=sha)


def markdown(report):
    """The job summary."""
    out = [f"### Mirror {report['year'] or report['season']}: {report['outcome']}"]
    if report.get("note"):
        out.append(report["note"])
    if report.get("error"):
        out.append(f"Stopped: {report['error']}")
    counts = [f"{report[k]:,} {label}" for k, label in (("events", "events upserted"), ("deleted", "rows deleted"),
                                                         ("lines", "change lines written")) if k in report]
    if counts:
        out.append(" · ".join(counts))
    if "watermark" in report:
        out.append(f"watermark {report['watermark'] or 'none'}"
                   + (f" → {report['watermark_now'] or 'none'}" if "watermark_now" in report else "")
                   + (f" · sha `{report['sha'][:7]}`" if report.get("sha") else ""))
    if report.get("flagged"):
        out.append(f"fetch_code_changed written true for {len(report['flagged'])} earlier run(s) not yet mirrored "
                   "(#47, the fail-safe): " + ", ".join(report["flagged"]))
    return "\n\n".join(out) + "\n"


def annotations(report):
    """The run's lines for Actions: one ::warning:: naming the flagged runs, and an ::error:: for a failure."""
    out = []
    flagged = report.get("flagged") or []
    if flagged:
        out.append(_annotation("warning", f"fetch_code_changed written true for {len(flagged)} earlier run(s) not "
                               "yet mirrored: " + ", ".join(flagged[:LISTED])
                               + (f" and {len(flagged) - LISTED} more" if len(flagged) > LISTED else "")))
    if report["outcome"] == "failed":
        out.append(_annotation("error", report["error"]))
    return out


def _annotation(kind, message):
    text = str(message).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    return f"::{kind} title=mirror::{text}"


def redact(text, secrets):
    """`text` with every secret replaced by ***. A value too short to be a key is not one, and is left."""
    for secret in secrets:
        if secret and len(secret) >= 16:
            text = text.replace(secret, "***")
    return text


def say(text):
    """Text to stdout as UTF-8, whatever the console's code page."""
    sys.stdout.flush()
    sys.stdout.buffer.write((text + "\n").encode("utf-8"))
    sys.stdout.buffer.flush()


def parse_args(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", required=True, help="the year's season.json, e.g. data/2027/season.json")
    ap.add_argument("--dry-run", action="store_true", help="read and check the files, print the counts, send nothing")
    ap.add_argument("--summary", metavar="PATH", help="append the job summary, as Markdown, to this file")
    return ap.parse_args(argv)


def main(argv=None, *, session=None, sleep=time.sleep, clock=now):
    args = parse_args(argv)
    report = {"season": args.season, "year": None, "outcome": None}
    secrets = [os.environ.get(KEY_VAR, "").strip()]
    try:
        year = read_year(args.season)
        report["year"] = year.season["year"]
        if year.doc is None:
            report.update(outcome="nothing to mirror",
                          note=f"{_shown(year.folder, 'events.v2.json')} is absent: a season before its first full "
                               "run has nothing to mirror.")
        else:
            rows = event_rows(year.doc, year.season)
            if args.dry_run:
                lines, _ = change_rows(year.lines or [], None, year.last_run, year=report["year"])
                report.update(outcome="dry run", note=f"{len(rows):,} events, {len(lines):,} lines")
            else:
                key = check_key(os.environ.get(KEY_VAR))
                rest = Rest(check_url(os.environ.get(URL_VAR)), key, session, sleep=sleep)
                mirror(year, rows, rest, sha=mirror_sha(), clock=clock, report=report)
    except MirrorError as exc:
        report.update(outcome="failed", error=redact(str(exc), secrets))
    except Exception:  # noqa: BLE001 - anything unforeseen fails the job, its traceback redacted
        report.update(outcome="failed", error=redact(traceback.format_exc(), secrets))
    say(report["note"] if report.get("note") else markdown(report).rstrip("\n"))
    if os.environ.get("GITHUB_ACTIONS") == "true":
        for line in annotations(report):
            say(line)
    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as f:
            f.write(markdown(report))
    return 1 if report["outcome"] == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())
