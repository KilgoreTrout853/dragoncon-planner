#!/usr/bin/env python3
"""The orchestrator (DECISIONS #44, #48; docs/pipeline/contract.md, The run, as built): a season's five stages in one
run, one stamp handed down, and every file the run changed written together at the end, or none.

    python pipeline.py run --season data/2027/season.json                # fetch, ids, tag, build and the diff
    python pipeline.py run --season data/2027/season.json --to ids       # a season's first run: its source and ids
    python pipeline.py run --season data/2027/season.json --from build   # after a registry edit: rebuild and diff
    python pipeline.py window --season data/2027/season.json             # "in window" or "out of window"; exit 0
    python pipeline.py summary --format md                               # the last run's result, as Markdown

The stages, in order: fetch (scraper.fetch) gives source.json; ids (ids_stage.assign), ids.jsonl; tag (tag_stage.tag
and the mint), tags.cache.jsonl and data/registry/works.json; build (events_v2.build), events.v2.json; and the diff
(diff_stage.diff), changes.jsonl's new lines and changed_at. --to stops after fetch, ids or tag and writes what exists
so far: the build's file goes only with the diff's lines (#42, #47). --from starts at ids, tag or build, reads what it
skips from the committed files and keeps the committed fetched_at; its own stamp goes on its lines and changed_at.
--limit is the fetch's, --requests the tag stage's cap for this run, and --force runs outside the season window,
where a run otherwise stops before it starts, writing nothing (#48). No run targets a frozen season, --force or not
(#46).

The edges, each in one place. The clock is read once, as the run starts (now(): UTC, whole seconds), and that is the
run's stamp, and a fetch's fetched_at. The code's SHA is PIPELINE_SHA where the workflow sets it, its checkout's
commit, and otherwise one `git rev-parse HEAD` (git_sha()). The files are read before the first stage - the season,
the venues file, the registries, and the snapshot: the previous source.json, ids.jsonl, tags.cache.jsonl,
events.v2.json, changes.jsonl and last-run.json, as bytes, each None where absent - and written after the last
(write()). No stage reads a file, the clock or git: each is called with rows, ledgers and stamps as arguments, and the
front doors that read a season's files (events_v2.season_rows, tag_stage.py's main) are not used.

The writes (#44), all or nothing. A run commits when a file's bytes change, events.v2.json's compared with its
generated_at held at the committed one - the run's own stamp aside - and then writes each file whose bytes differ
from the committed ones: each to a temp file beside it, every temp before any is moved over its file, last-run.json
last. changes.jsonl is the committed log, re-rendered, with the new lines after it, and it must begin with the
committed bytes, or the run is fatal. The build runs twice: on the stages' rows, and through the live front door
(events_v2.live_inputs) on the texts about to be written, the build CI checks; the two must agree byte for byte. A run
that changes nothing writes nothing, last-run.json included.

Fatal (#44), writing nothing and exiting 2: a frozen season; an input that does not load, the snapshot's among them;
a stage's error - the fetch's, the ids stage's, the build's, the diff's, a registry the mint's rows break - and any
other exception; the change log's prefix check; the two builds differing. A degraded run commits, each degradation a
counter in last-run.json. On Actions a fault counter above zero prints a ::warning:: line, and a curation counter a
::notice:: line, so that the rooms still to curate, every hour, do not drown a fault.

Every run leaves its result object - the outcome, the error, the files written, last-run.json's fields, and the names
behind the counters - in pipeline-result.json in the system's temp folder, never in the tree, and `summary --format
md` renders it: the job summary, the pull request's body and the commit's (.github/workflows/scrape.yml).
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import diff_stage
import draft_people as dp
import events_v2
import ids_stage
import merge_stage
import registry
import scraper
import tag_key
import tag_stage
from season import SeasonError, load as load_season
from venues import VenuesError, load as load_venues

HERE = os.path.dirname(os.path.abspath(__file__))
STAGES = ("fetch", "ids", "tag", "build", "diff")
TO = ("fetch", "ids", "tag")      # not build: the build's file goes only with the diff's lines and changed_at
FROM = ("ids", "tag", "build")    # not the diff: it compares this run's build with the committed file
REGISTRY = os.path.join(HERE, registry.DIR)
FETCH_CODE = ("scraper.py", "tag_key.py", "requirements.txt")   # the code the attribution cannot see (#47)
RESULT = os.path.join(tempfile.gettempdir(), "pipeline-result.json")
# The snapshot (#44), read as bytes before any stage, each None where absent.
SNAPSHOT = ("source.json", "ids.jsonl", "tags.cache.jsonl", "events.v2.json", "changes.jsonl", "last-run.json")
LAST_RUN = ("stamp", "fetched_at", "changed_at", "sha", "fetch_code_hash")   # what a run reads of the last one
DOC = ("generated_at", "changed_at", "digest", "events")                   # and of the committed events.v2.json
# last-run.json's counters, by stage, in the order written; a stage's block is there only where the stage ran.
COUNTERS = {
    "fetch": ("listings", "fetched", "stale", "removed", "failures", "repaired"),
    "ids": ("new", "matches", "merges", "leavers", "gone", "returned", "unsure"),
    "tag": ("requests", "sent", "capped", "failed", "stopped", "unanswered", "minted", "mint_failed"),
    "build": ("untagged", "unresolved_names", "unknown_tracks", "rooms_unresolved", "hotels_unknown", "places"),
    "diff": ("kinds", "causes"),
}
# Above zero on Actions (#44, #48): a fault is a ::warning::, a curation counter a ::notice::. Listings gone and
# removed rows are carried all season, and the repair runs on every page, so neither is a fault of the run.
FAULTS = {"fetch": ("failures", "stale"), "ids": ("merges", "unsure"),
          "tag": ("capped", "failed", "stopped", "unanswered", "mint_failed"),
          "build": ("untagged", "unresolved_names", "unknown_tracks", "hotels_unknown")}
CURATION = {"fetch": ("removed", "repaired"), "build": ("rooms_unresolved",)}
LISTED = 10   # the names the summary lists behind a counter, at most; the result keeps one more, to say so
STAGE_ERRORS = (SeasonError, VenuesError, registry.RegistryError, scraper.FetchError, ids_stage.IdsError,
                events_v2.BuildError, diff_stage.DiffError)


class Fatal(Exception):
    """What stops a run that is not a stage's own error (#44). Nothing is written, and the run exits 2."""


# ---------------------------------------------------------------------------
# The edges
# ---------------------------------------------------------------------------

def now():
    """The run's one read of the clock: UTC, to the second (#44). Its isoformat() is the run's stamp."""
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def stopwatch():
    """A monotonic clock, for last-run.json's `elapsed` alone: never a stamp."""
    return time.monotonic()


def git_sha():
    """The SHA of the code that runs, for the change log's lines and last-run.json: PIPELINE_SHA where the workflow
    sets it - its checkout's commit - and otherwise one `git rev-parse HEAD`, in this file's checkout."""
    sha = os.environ.get("PIPELINE_SHA")
    if sha:
        return sha
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise Fatal(f"no SHA for the change log: PIPELINE_SHA is unset and `git rev-parse HEAD` failed ({exc})") \
            from None
    return out.stdout.strip()


def fetch_code_hash():
    """The sha256 of scraper.py, tag_key.py and requirements.txt, their bytes one after another: the fetch's code,
    which the attribution cannot see (#47; contract.md, `last-run.json`). A run whose hash is not the last committed
    run's sets fetch_code_changed."""
    h = hashlib.sha256()
    for name in FETCH_CODE:
        with open(os.path.join(HERE, name), "rb") as f:
            h.update(f.read())
    return h.hexdigest()


def read_snapshot(folder):
    """The previous files of a season's folder, as bytes, each None where absent (#44): read once, before any
    stage."""
    out = {}
    for name in SNAPSHOT:
        try:
            with open(os.path.join(folder, name), "rb") as f:
                out[name] = f.read()
        except FileNotFoundError:
            out[name] = None
    return out


def write(files):
    """{path: bytes}, each through a temp file beside it: every temp written before any is moved over its file, then
    each moved in the order given, last-run.json last (#44). A temp that cannot be written leaves no file changed."""
    temps = []
    try:
        for path, data in files.items():
            temps.append((path + ".tmp", path))
            with open(temps[-1][0], "wb") as f:
                f.write(data)
    except OSError:
        for tmp, _ in temps:
            if os.path.exists(tmp):
                os.remove(tmp)
        raise
    for tmp, path in temps:
        os.replace(tmp, path)


def say(msg):
    print(msg, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# The window
# ---------------------------------------------------------------------------

def in_window(season, stamp):
    """(whether the season's window holds `stamp`, a note or None). The window's two dates are local days in the
    season's time zone, read through zoneinfo; where that zone cannot be loaded - a Windows machine without tzdata -
    the day is the UTC one, and the note says so. A season with no window, a frozen year's, is always out (#48)."""
    window = season["window"]
    if window is None:
        return False, None
    try:
        day, note = stamp.astimezone(ZoneInfo(season["tz"])).date(), None
    except (ZoneInfoNotFoundError, ValueError):
        day = stamp.date()
        note = f"the time zone {season['tz']} cannot be loaded here: the season window is compared in UTC"
    return dt.date.fromisoformat(window["from"]) <= day <= dt.date.fromisoformat(window["to"]), note


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------

def previous_json(snapshot, name, folder, keys):
    """A snapshot's JSON file, parsed, or None where it is absent. Fatal where it is there and cannot be read, or
    lacks one of `keys`: a committed file the run cannot read does not make a first run (#44)."""
    data = snapshot[name]
    if data is None:
        return None
    path = os.path.join(folder, name)
    try:
        doc = json.loads(data.decode("utf-8"))
    except ValueError as exc:
        raise Fatal(f"{path} cannot be read ({exc})") from None
    if not isinstance(doc, dict) or not all(k in doc for k in keys):
        raise Fatal(f"{path} cannot be read: it is not an object holding {', '.join(keys)}")
    return doc


def change_log(old, lines, path):
    """changes.jsonl after this run (#47): the committed log's lines, re-rendered, then the new ones. It must begin
    with the committed bytes - the log only grows, by render()'s lines - or the run is fatal: the prefix check, made
    where the old bytes are. `old` is the committed bytes, None where there is no log yet."""
    old = old or b""
    kept = []
    for n, line in enumerate(old.decode("utf-8").split("\n"), 1):
        if not line:
            continue
        try:
            kept.append(json.loads(line))
        except ValueError as exc:
            raise Fatal(f"the prefix check fails: {path}, line {n}, is not JSON ({exc})") from None
    new = diff_stage.render(kept + lines).encode("utf-8")
    if not new.startswith(old):
        raise Fatal(f"the prefix check fails: {path}, re-rendered with this run's lines, does not begin with its "
                    "committed bytes - the log was edited, or is not render()'s (#47)")
    return new


def run(args, stamp, started, result):
    """One run (the module's docstring), filling `result`, the run's result object, as it goes -> the files to
    write, {path: bytes}, in the order they are written, or {} where the run writes nothing. Raises Fatal or a stage's
    error before anything is written."""
    season = load_season(args.season)
    folder = os.path.dirname(os.path.abspath(args.season))
    result["year"] = season["year"]
    if season["frozen"]:
        raise Fatal(f"{args.season} is frozen (DECISIONS #46): no run targets a frozen year")
    inside, note = in_window(season, stamp)
    if note:
        say(f"warning: {note}")
    if not inside and not args.force:
        result.update(outcome="out of window", window=season["window"] and {**season["window"], "tz": season["tz"]})
        return {}

    stamp_s = stamp.isoformat()
    sha = git_sha()
    code_hash = fetch_code_hash()
    venues = load_venues(os.path.join(folder, "venues.json"))
    reg = registry.load(REGISTRY)
    snapshot = read_snapshot(folder)

    def path(name):
        return os.path.join(folder, name)
    cache = (tag_key.parse_cache(snapshot["tags.cache.jsonl"].decode("utf-8"), path("tags.cache.jsonl"))
             if snapshot["tags.cache.jsonl"] is not None else {})
    ledger = ids_stage.parse_ledger(snapshot["ids.jsonl"], path("ids.jsonl"))
    before = (scraper.parse_source(snapshot["source.json"], path("source.json"), season["source"])
              if snapshot["source.json"] is not None else None)
    last = previous_json(snapshot, "last-run.json", folder, LAST_RUN)
    committed = previous_json(snapshot, "events.v2.json", folder, DOC)
    ran = STAGES[STAGES.index(args.from_stage or "fetch"):STAGES.index(args.to or "diff") + 1]
    version = season["prompt_version"]
    counters, details, files, works_text = {}, {}, {}, None

    # fetch: the source's rows, the previous file's carried; or, from a later stage, the committed file's
    if "fetch" in ran:
        previous = {row["source_id"]: row for row in before["rows"]} if before else {}
        fetched = scraper.fetch(season, previous, limit=args.limit or 0)
        rows, failures, fetched_at = fetched.rows, fetched.failures, stamp_s
        counters["fetch"] = {"listings": fetched.listings, "fetched": fetched.fetched, "stale": fetched.carried_stale,
                             "removed": fetched.carried_removed, "failures": len(fetched.failures),
                             "repaired": fetched.repaired}
        details["failures"] = [f"{x['source_id']}: {x['error']}" for x in fetched.failures[:LISTED + 1]]
        say(f"fetch: {len(rows):,} rows, {fetched.fetched:,} fetched of {fetched.listings:,} listings, "
            f"{len(failures):,} failed, {fetched.seconds:.1f}s")
    else:
        if before is None or last is None:
            raise Fatal(f"--from {args.from_stage} reads the committed source.json and keeps last-run.json's "
                        f"fetched_at, and {path('source.json' if before is None else 'last-run.json')} is absent")
        rows, failures, fetched_at = before["rows"], before["failures"], last["fetched_at"]

    # ids: our id on every row, and the new ledger; or, where the stage is skipped, the committed ledger's ids
    if "ids" in ran:
        assigned = ids_stage.assign(rows, ledger, stamp_s, season["thresholds"])
        id_rows, new_ledger, rep = assigned.rows, assigned.ledger, assigned.report
        counters["ids"] = {"new": len(rep.new), "matches": len(rep.matched), "merges": len(rep.merged),
                           "leavers": len(rep.leavers), "gone": len(rep.gone), "returned": len(rep.returned),
                           "unsure": len(rep.unsure)}
        details["merges"] = [f"{x['id']} into {x['into']}" for x in rep.merged[:LISTED + 1]]
        details["unsure"] = [f"{x['gone']} gone, {x['new']} new, differing in {', '.join(x['differs']) or 'nothing'}"
                             for x in rep.unsure[:LISTED + 1]]
        say(f"ids: {len(new_ledger):,} lines, {len(rep.new):,} new, {len(rep.unsure):,} unsure")
    elif "tag" in ran or "build" in ran:
        id_rows, _, new_ledger = events_v2.live_inputs(before, last, ledger, season, folder)

    # tag: the uncached inputs, up to the cap; then the mint, its rows checked with the registry before the build
    if "tag" in ran:
        events = [e for e in merge_stage.merge(id_rows, new_ledger) if not e.get("removed")]
        inputs, _ = tag_stage.distinct_inputs(events, version)
        label, transport, model = tag_stage.pick_transport()
        cap = args.requests or season["thresholds"]["requests_per_run"]
        say(f"tag: {len(inputs):,} inputs, {sum(1 for k in inputs if k in cache):,} cached, via {label} ({model}), "
            f"at most {cap} request(s)")
        tagged = tag_stage.tag(inputs, cache, tag_stage.works_guide(reg.works), transport, model, lambda c: None,
                               cap=cap, log=say)
        plan = tag_stage.mint_works(tagged, events, cache, reg, version, transport, model,
                                    minted={"year": season["year"], "run": fetched_at}, log=say)
        if plan["works"] and "parents_failed" not in plan:
            works_text = dp.json_text(tag_stage.works_rows(reg, plan["works"]))
            reg = registry.check(json.loads(works_text), reg.people, reg.tracks)
            tagged.minted = sorted(w["id"] for w in plan["works"])
        counters["tag"] = {"requests": tagged.requests, "sent": tagged.sent, "capped": tagged.capped,
                           "failed": tagged.failed, "stopped": tagged.stopped, "unanswered": tagged.unanswered,
                           "minted": len(tagged.minted), "mint_failed": len(tagged.mint_failed)}
        details["unanswered"] = [f"{inputs[k]['title']} ({way})" for k, way in tagged.uncached.items()
                                 if way != "capped"][:LISTED + 1]
        details["minted"] = tagged.minted[:LISTED + 1]

    # build and the diff: the file, its change lines and changed_at
    if "build" in ran:
        top = events_v2.live_top(season, failures, id_rows, fetched_at, last["changed_at"] if last else stamp_s)
        doc, report = events_v2.build(id_rows, top, reg, cache, venues, new_ledger, version=version)
        counters["build"] = {"untagged": len(report["untagged"]),
                             "unresolved_names": sum(report["unresolved_names"].values()),
                             "unknown_tracks": len(report["unknown_tracks"]),
                             "rooms_unresolved": report["rooms_unresolved"], "hotels_unknown": report["hotels_unknown"],
                             "places": dict(report["places"])}
        details["untagged"] = report["untagged"][:LISTED + 1]
        details["unresolved_names"] = list(report["unresolved_names"])[:LISTED + 1]
        details["unknown_tracks"] = list(report["unknown_tracks"])[:LISTED + 1]
        attribution = None
        if committed is not None and last is not None and last["sha"] != sha:
            if before is None:
                raise Fatal(f"{path('events.v2.json')} is committed and {path('source.json')} is not: the attribution "
                            "reads the previous run's rows (#47)")
            attribution = events_v2.attribution(before["rows"], ledger, reg, cache, venues, version=version,
                                                thresholds=season["thresholds"], stamp=last["fetched_at"])
        diffed = diff_stage.diff(committed, doc, stamp=stamp_s, sha=sha, attribution=attribution)
        doc["changed_at"] = diffed.changed_at
        counters["diff"] = {"kinds": dict(sorted(diffed.kinds.items())), "causes": dict(sorted(diffed.causes.items()))}
        say(f"build and diff: {len(doc['events']):,} events, digest {doc['digest'][:12]}, "
            f"{diffed.changes_logged:,} line(s)" + (", attributed" if attribution is not None else ""))

    # The texts, in the order they are written
    if "fetch" in ran:
        files[path("source.json")] = scraper.source_text(season["source"], failures, rows).encode("utf-8")
    if "ids" in ran:
        files[path("ids.jsonl")] = ids_stage.ledger_text(new_ledger).encode("utf-8")
    if "tag" in ran:
        files[path("tags.cache.jsonl")] = tag_key.cache_text(cache).encode("utf-8")
        if works_text is not None:
            files[os.path.join(REGISTRY, "works.json")] = works_text.encode("utf-8")
    if "build" in ran:
        files[path("events.v2.json")] = events_v2.dumps(doc)
        files[path("changes.jsonl")] = change_log(snapshot["changes.jsonl"], diffed.lines, path("changes.jsonl"))

    def committed_bytes(p):
        name = os.path.basename(p)
        return snapshot[name] if os.path.dirname(p) == folder and name in snapshot else None
    changed = {p: data for p, data in files.items() if data != committed_bytes(p)}
    events_path = path("events.v2.json")
    moved = [p for p in changed if p != events_path]
    if events_path in changed and (committed is None or events_v2.dumps(
            {**doc, "generated_at": committed["generated_at"]}) != snapshot["events.v2.json"]):
        moved.append(events_path)

    last_run = {"stamp": stamp_s, "fetched_at": fetched_at,
                "changed_at": diffed.changed_at if "build" in ran else (last["changed_at"] if last else stamp_s),
                "sha": sha, "fetch_code_hash": code_hash,
                "fetch_code_changed": last is not None and last["fetch_code_hash"] != code_hash,
                "changes_logged": diffed.changes_logged if "build" in ran else 0,
                "digest": doc["digest"] if "build" in ran else (committed["digest"] if committed else None),
                "season": season["year"], "elapsed": round(stopwatch() - started, 1), **counters}
    result.update(last_run=last_run, details={k: v for k, v in details.items() if v})
    if not moved:
        result["outcome"] = "nothing changed"
        return {}

    changed[path("last-run.json")] = (json.dumps(last_run, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if "build" in ran:
        second_build(files, snapshot, changed[path("last-run.json")], season, folder, reg, venues)
    result.update(outcome="committed", files=[shown(p) for p in changed])
    return changed


def second_build(files, snapshot, last_run, season, folder, reg, venues):
    """The build again, through the live front door (events_v2.live_inputs) on the texts about to be written -
    source.json, the ledger, the cache and last-run.json, each the run's or the committed one - which is the build CI
    checks (#42): its file must be the run's, byte for byte, or the run is fatal (#44)."""
    def text(name):
        p = os.path.join(folder, name)
        return files[p] if p in files else snapshot[name]
    source = scraper.parse_source(text("source.json"), os.path.join(folder, "source.json"), season["source"])
    ledger = ids_stage.parse_ledger(text("ids.jsonl"), os.path.join(folder, "ids.jsonl"))
    cached = text("tags.cache.jsonl")
    cache = tag_key.parse_cache(cached.decode("utf-8"), os.path.join(folder, "tags.cache.jsonl")) if cached else {}
    rows, top, ledger = events_v2.live_inputs(source, json.loads(last_run.decode("utf-8")), ledger, season, folder)
    doc, _ = events_v2.build(rows, top, reg, cache, venues, ledger, version=season["prompt_version"])
    if events_v2.dumps(doc) != files[os.path.join(folder, "events.v2.json")]:
        raise Fatal("the build's two runs differ: the file built from the texts about to be written, through the live "
                    "front door, is not the one the stages built (#44)")


def shown(path):
    """A path as the summary shows it: from the repository's root where it is inside it, with forward slashes."""
    rel = os.path.relpath(path, HERE) if os.path.splitdrive(path)[0] == os.path.splitdrive(HERE)[0] else path
    return (path if rel.startswith("..") else rel).replace(os.sep, "/")


# ---------------------------------------------------------------------------
# The summary and the annotations
# ---------------------------------------------------------------------------

def given(run_args):
    """The flags a run was given, as a command line would give them."""
    out = []
    for flag in ("to", "from", "limit", "requests"):
        if run_args.get(flag):
            out.append(f"--{flag} {run_args[flag]}")
    if run_args.get("force"):
        out.append("--force")
    return " ".join(out)


def flagged(last_run):
    """([(stage.counter, n)] of the faults above zero, [...] of the curation counters above zero)."""
    def above(table):
        return [(f"{stage}.{name}", last_run[stage][name]) for stage, names in table.items() if stage in last_run
                for name in names if last_run[stage][name]]
    return above(FAULTS), above(CURATION)


def cell(stage, block):
    """One stage's counters as the summary's table shows them: a fault or curation counter above zero in bold."""
    if stage == "diff":
        kinds = " · ".join(f"{k} {n:,}" for k, n in block["kinds"].items())
        causes = " · ".join(f"{k} {n:,}" for k, n in block["causes"].items())
        return f"{kinds}; {causes}" if kinds else "no lines"
    marked = set(FAULTS.get(stage, ())) | set(CURATION.get(stage, ()))
    out = []
    for name in COUNTERS[stage]:
        if name == "places":
            out.append("places: " + ", ".join(f"{k} {n:,}" for k, n in block[name].items()))
        elif name in marked and block[name]:
            out.append(f"**{name} {block[name]:,}**")
        else:
            out.append(f"{name} {block[name]:,}")
    return " · ".join(out)


DETAILS = (("failures", "Failed pages"), ("merges", "Merged"), ("unsure", "UNSURE"), ("unanswered", "Not tagged"),
           ("minted", "Minted"), ("untagged", "Untagged"), ("unresolved_names", "Work names unresolved"),
           ("unknown_tracks", "Tracks unknown"))


def markdown(result):
    """The run's result object as Markdown: the job summary, the pull request's body and the commit's body."""
    last_run = result.get("last_run") or {}
    head = [f"`{result['season']}`" + (f" ({result['year']})" if result.get("year") else "")]
    if given(result["args"]):
        head.append(f"run with `{given(result['args'])}`")
    if last_run:
        head += [f"sha `{last_run['sha'][:7]}`", f"{last_run['elapsed']} s", f"fetched_at {last_run['fetched_at']}",
                 f"changed_at {last_run['changed_at']}",
                 "fetch code changed" if last_run["fetch_code_changed"] else "fetch code unchanged"]
    out = [f"### Pipeline run {result['stamp']}: {result['outcome']}", "", " · ".join(head), ""]
    if result["outcome"] == "fatal":
        return "\n".join(out + [f"**Fatal:** {result['error']}", "", "Nothing written (DECISIONS #44)."]) + "\n"
    if result["outcome"] == "out of window":
        window = result.get("window")
        where = f"{window['from']} to {window['to']}, {window['tz']}" if window else "the season has none"
        return "\n".join(out + [f"Outside the season window ({where}): nothing run. A dispatch with force runs past "
                                "it."]) + "\n"
    if result["outcome"] == "committed":
        out.append("Wrote " + ", ".join(f"`{p}`" for p in result["files"])
                   + f" · {last_run['changes_logged']:,} line(s) logged"
                   + (f" · digest `{last_run['digest'][:12]}`" if last_run["digest"] else ""))
    else:
        out.append("Nothing written: every file's bytes are the committed ones, the run's own stamp aside "
                   "(DECISIONS #44).")
    out += ["", "| stage | counters |", "|---|---|"]
    out += [f"| {stage} | {cell(stage, last_run[stage])} |" for stage in STAGES if stage in last_run]
    faults, curation = flagged(last_run)
    notes = []
    if faults:
        notes.append("Warnings: " + ", ".join(f"{name} {n:,}" for name, n in faults) + ".")
    if curation:
        notes.append("Notices: " + ", ".join(f"{name} {n:,}" for name, n in curation) + ".")
    for key, label in DETAILS:
        names = result.get("details", {}).get(key)
        if names:
            notes.append(f"{label}: " + "; ".join(names[:LISTED]) + ("; ..." if len(names) > LISTED else "") + ".")
    return "\n".join(out + ([""] + notes if notes else [])) + "\n"


def annotation(kind, message):
    """A workflow command, its message escaped as the runner reads it."""
    text = str(message).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    return f"::{kind} title=pipeline::{text}"


def annotations(result):
    """The run's lines for Actions: a ::warning:: a fault above zero, a ::notice:: a curation counter, an ::error::
    a fatal run."""
    if result["outcome"] == "fatal":
        return [annotation("error", result["error"])]
    faults, curation = flagged(result.get("last_run") or {})
    return ([annotation("warning", f"{name} {n:,}") for name, n in faults]
            + [annotation("notice", f"{name} {n:,}") for name, n in curation])


def emit(text):
    """Text to stdout as UTF-8, whatever the console's code page."""
    sys.stdout.flush()
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.flush()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def positive(value):
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError(f"{value} is not a whole number of 1 or more")
    return n


def parse_args(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run", help="run the stages and write what changed, all or nothing")
    r.add_argument("--season", required=True, help="the year's season.json, e.g. data/2027/season.json")
    r.add_argument("--to", choices=TO, help="stop after this stage, and write what exists so far")
    r.add_argument("--from", dest="from_stage", choices=FROM,
                   help="start at this stage, reading what it skips from the committed files")
    r.add_argument("--limit", type=positive, help="the fetch's: only the first N listings, in page order")
    r.add_argument("--requests", type=positive, help="the tag stage's request cap for this run")
    r.add_argument("--force", action="store_true", help="run outside the season window")
    w = sub.add_parser("window", help='print "in window" or "out of window", and exit 0')
    w.add_argument("--season", required=True, help="the year's season.json")
    s = sub.add_parser("summary", help="the last run's result object, rendered")
    s.add_argument("--format", choices=("md",), required=True)
    args = ap.parse_args(argv)
    if args.command == "run":
        first = STAGES.index(args.from_stage or "fetch")
        if args.to and STAGES.index(args.to) < first:
            r.error(f"--from {args.from_stage} starts after --to {args.to}")
        if args.limit and first > 0:
            r.error(f"--limit is the fetch's, and --from {args.from_stage} skips the fetch")
        if args.requests and not first <= STAGES.index("tag") <= STAGES.index(args.to or "diff"):
            r.error("--requests is the tag stage's, and this run skips it")
    return args


def run_command(args):
    stamp, started = now(), stopwatch()
    result = {"outcome": None, "season": args.season, "year": None, "stamp": stamp.isoformat(),
              "args": {"to": args.to, "from": args.from_stage, "limit": args.limit, "requests": args.requests,
                       "force": args.force},
              "files": []}
    try:
        files = run(args, stamp, started, result)
        if files:
            write(files)
    except Exception as exc:  # noqa: BLE001 - what #44 does not enumerate as a degradation is fatal
        if not isinstance(exc, (Fatal,) + STAGE_ERRORS):
            traceback.print_exc()
        result.update(outcome="fatal", error=str(exc) if isinstance(exc, Fatal) else f"{type(exc).__name__}: {exc}",
                      files=[])
    try:
        with open(RESULT, "wb") as f:
            f.write(json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"))
    except OSError as exc:
        say(f"warning: the result object was not saved to {RESULT} ({exc})")
    emit(markdown(result))
    if os.environ.get("GITHUB_ACTIONS") == "true":
        emit("".join(line + "\n" for line in annotations(result)))
    return 2 if result["outcome"] == "fatal" else 0


def window_command(args):
    try:
        season = load_season(args.season)
    except SeasonError as exc:
        say(str(exc))
        return 2
    inside, note = in_window(season, now())
    if note:
        say(f"warning: {note}")
    emit("in window\n" if inside else "out of window\n")
    return 0


def summary_command(args):
    try:
        with open(RESULT, "rb") as f:
            result = json.loads(f.read().decode("utf-8"))
    except FileNotFoundError:
        say(f"no run has left a result object at {RESULT}")
        return 1
    emit(markdown(result))
    return 0


def main(argv=None):
    args = parse_args(argv)
    if args.command == "window":
        return window_command(args)
    if args.command == "summary":
        return summary_command(args)
    return run_command(args)


if __name__ == "__main__":
    sys.exit(main())
