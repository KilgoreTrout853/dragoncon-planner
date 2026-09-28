#!/usr/bin/env python3
"""2026's change log rebuilt from git history, for a rehearsal of the push job's pick-changed on a real season
(DECISIONS #55; docs/sync/contract.md, section 7): tools/out/changes-2026.jsonl, and with --load a project's
schedule_changes.

    python tools/replay_changes_2026.py                   # write tools/out/changes-2026.jsonl, print the runs
    python tools/replay_changes_2026.py --load            # and upsert the lines into the project's schedule_changes
    python tools/replay_changes_2026.py --ref REF --out PATH

Every version of the 2026 schedule on the ref is replayed as tools/replay_2026.py replays it - read from git by
schedule_history.gather(), made raw rows, carried and given ids by replay_2026.replay() - then built by
events_v2.build() on 2026's registries, tag cache, venues file and prompt_version, and diffed by diff_stage.diff()
against the version before: v1 against nothing, a season's first run, its every event `added`. A version's lines
carry its generated_at as their run and its commit's SHA, and are written as changes.jsonl holds them. A run is
flagged fetch_code_changed where a scraper.py commit on the ref's first-parent line comes after the previous
version's commit and at or before its own: v5, v9, v12 and v34 on main (docs/sync/recon.md, section 8). v1's own
commit is one, and a season's first run records false (docs/pipeline/contract.md, last-run.json). Every version is
built by today's code, so every line is `source`: 2026's code changes were the fetch's, in the rows themselves, and
the flag is what stands for them.

With --load the lines go into the project's schedule_changes for 2026, each with its run's flag, over PostgREST as
the service role: SUPABASE_URL and SUPABASE_SERVICE_KEY, the names mirror.py reads, checked, sent and redacted by
mirror.py's own helpers. Upserted with merge-duplicates on (year, run, id, kind), 1,000 a request, so a second load
writes the same rows again. The year's events must be there first - a dispatch of Mirror for data/2026/season.json -
or it refuses and sends no line. It writes nothing else: not schedule_events, not mirror_state. The mirror never
meets the loaded lines: it reads no change log for a frozen season, and writes and deletes none. Then it reports how
many lines name an id schedule_events does not hold for the year: 45 on main, on 21 ids - the two James Callis
sessions, whose ids the replay keeps from before their gap (docs/pipeline/replay-2026.md, section 1), and 19 events
the source dropped and never listed again, which the replay carries removed all season (#42) and the frozen file,
v34's own listing, does not hold. A pick on one of them is never due.

A tool run by hand from a clone with main's history, not held by CI: a shallow checkout has no history. Its output
is gitignored, tools/out/, and the replay's ledger goes to a temp folder, never under data/. Deterministic: two runs
write the same bytes. Exit 0, or 1 for a failure, whose message never holds the key.
"""

import argparse
import os
import sys
import tempfile
import time
import traceback
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

import diff_stage  # noqa: E402
import events_v2  # noqa: E402
import mirror  # noqa: E402  (its PostgREST client, the key and address checks, redact and say)
import registry  # noqa: E402
import replay_2026  # noqa: E402
import schedule_history  # noqa: E402
from season import load as load_season  # noqa: E402
from tag_key import load_cache  # noqa: E402
from venues import load as load_venues  # noqa: E402

YEAR = 2026
FOLDER = os.path.join("data", "2026")
OUT = os.path.join("tools", "out", "changes-2026.jsonl")
# The kinds a pick-changed push tells (#55), for the summary: which runs a rehearsal can use.
PUSHWORTHY = ("cancelled", "uncancelled", "removed", "restored", "time", "place")


class ReplayError(Exception):
    """What stops the tool: exit 1."""


def flags(h):
    """Each version's fetch_code_changed, oldest first: true where a scraper.py commit on the ref's first-parent line
    comes after the previous version's commit and at or before its own; false for v1, a season's first run."""
    position = {sha: n for n, sha in enumerate(h["line"])}
    missing = [c["sha"] for c in h["commits"] if c["sha"] not in position]
    if missing:
        raise ReplayError(f"{len(missing)} schedule commit(s) are not on the ref's first-parent line: {missing[0][:7]}")
    touched = [position[c["sha"]] for c in h["scraper"] if c["sha"] in position]
    out = []
    for v, commit in enumerate(h["commits"]):
        low = position[h["commits"][v - 1]["sha"]] if v else None
        out.append(v > 0 and any(low < p <= position[commit["sha"]] for p in touched))
    return out


def rebuild(h, steps, reg, cache, venues, *, version):
    """The replay's steps, each built and diffed against the version before -> one run a version, oldest first:
    {version, sha, stamp, flag, lines}, the lines as diff_stage.diff() returns them. Raises ReplayError where the
    ids stage stopped the replay: a change log with a hole in it rehearses nothing."""
    fatal = next((s["fatal"] for s in steps if "fatal" in s), None)
    if fatal or len(steps) != len(h["versions"]):
        raise ReplayError(f"the replay stopped after {sum('result' in s for s in steps)} of {len(h['versions'])} "
                          f"versions: {fatal}")
    flagged = flags(h)
    previous, runs = None, []
    for v, (step, doc, commit) in enumerate(zip(steps, h["versions"], h["commits"])):
        result = step["result"]
        current, _ = events_v2.build(result.rows, {"generated_at": doc["generated_at"]}, reg, cache, venues,
                                     result.ledger, version=version)
        found = diff_stage.diff(previous, current, stamp=doc["generated_at"], sha=commit["sha"])
        current["changed_at"] = found.changed_at
        runs.append({"version": v + 1, "sha": commit["sha"], "stamp": doc["generated_at"], "flag": flagged[v],
                     "lines": found.lines})
        previous = current
    return runs


def lines_of(runs):
    """Every run's lines, by run, id and kind, as the log sorts them."""
    return sorted((line for run in runs for line in run["lines"]), key=lambda x: (x["run"], x["id"], x["kind"]))


def change_rows(runs, year=YEAR):
    """schedule_changes' rows, as the mirror writes a line: the line as it is, `from` and `to` null where it has none,
    plus `year` and its run's fetch_code_changed, every row with all nine keys. Raises ReplayError where two versions
    stamped alike log one run, id and kind twice, or give one run's lines two flags: a run carries one (#54)."""
    rows, seen, flag_of = [], set(), {}
    for run in runs:
        for line in run["lines"]:
            key = (line["run"], line["id"], line["kind"])
            if key in seen:
                raise ReplayError(f"run {line['run']}, id {line['id']} and kind {line['kind']} logged twice")
            seen.add(key)
            if flag_of.setdefault(line["run"], run["flag"]) != run["flag"]:
                raise ReplayError(f"run {line['run']}'s lines would carry two fetch_code_changed flags")
            rows.append({"year": year, "run": line["run"], "sha": line["sha"], "id": line["id"], "kind": line["kind"],
                         "from": line.get("from"), "to": line.get("to"), "cause": line["cause"],
                         "fetch_code_changed": run["flag"]})
    return sorted(rows, key=lambda r: (r["run"], r["id"], r["kind"]))


def summary(h, runs, out):
    """What the run found, for the terminal: the lines and their kinds, the flagged runs, and each run with lines a
    push tells."""
    lines = lines_of(runs)
    kinds = Counter(line["kind"] for line in lines)
    causes = Counter(line["cause"] for line in lines)
    text = [f"2026's change log from {h['ref']} at {h['head'][:7]}: {len(runs)} versions, {len(lines):,} lines in "
            f"{len({line['run'] for line in lines})} runs, "
            + ", ".join(f"{n:,} {cause}" for cause, n in sorted(causes.items())) + f"; written to {out}",
            "by kind: " + ", ".join(f"{kind} {n:,}" for kind, n in kinds.most_common()),
            "flagged fetch_code_changed, a scraper.py commit before the run: "
            + (", ".join(f"v{r['version']} ({len(r['lines']):,} lines)" for r in runs if r["flag"]) or "none"),
            "the runs with lines a push tells:"]
    for r in runs:
        told = Counter(line["kind"] for line in r["lines"] if line["kind"] in PUSHWORTHY)
        if told:
            text.append(f"  v{r['version']} {r['sha'][:7]} {r['stamp']}: "
                        + ", ".join(f"{kind} {n}" for kind, n in sorted(told.items()))
                        + (" - flagged" if r["flag"] else ""))
    return "\n".join(text)


def load(rows, rest, year=YEAR):
    """The rows into schedule_changes, over `rest` (mirror.Rest) -> (rows written, the ids they name that
    schedule_events does not hold for the year, and the count of rows naming one). The year's events are read first,
    and none is a refusal: the mirror has not run for the year, and nothing is sent. Raises mirror.MirrorError."""
    held = set(rest.read_ids(year))
    if not held:
        raise mirror.MirrorError(f"schedule_events holds no events for {year}: dispatch Mirror for "
                                 f"data/{year}/season.json first. No line was sent")
    written = rest.upsert("schedule_changes", rows, "year,run,id,kind")
    absent = [r["id"] for r in rows if r["id"] not in held]
    return written, sorted(set(absent)), len(absent)


def inputs():
    """2026's season, registries, tag cache and venues file, loaded once, each from the repository whatever the
    folder the tool is run from."""
    return (load_season(os.path.join(ROOT, FOLDER, "season.json")), registry.load(os.path.join(ROOT, registry.DIR)),
            load_cache(os.path.join(ROOT, FOLDER, "tags.cache.jsonl")),
            load_venues(os.path.join(ROOT, FOLDER, "venues.json")))


def shown(path):
    """A path as the summary names it: from the repository's root where it is inside it, else whole."""
    path, root = os.path.abspath(path), os.path.abspath(ROOT)
    try:
        inside = os.path.commonpath([path, root]) == root
    except ValueError:   # another drive, on Windows
        inside = False
    return (os.path.relpath(path, root) if inside else path).replace(os.sep, "/")


def replay_changes(h, season, reg, cache, venues):
    """The history replayed, its ledger in a temp folder, and rebuilt as runs of change lines."""
    with tempfile.TemporaryDirectory() as folder:
        steps = replay_2026.replay(h["versions"], season["thresholds"], folder)
    return rebuild(h, steps, reg, cache, venues, version=season["prompt_version"])


def main(argv=None, *, session=None, sleep=time.sleep, gather=schedule_history.gather, load_inputs=inputs):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", default="main", help="the branch whose history is read (default: main)")
    ap.add_argument("--out", default=os.path.join(ROOT, OUT), help=f"where the log is written (default: {OUT})")
    ap.add_argument("--load", action="store_true",
                    help="upsert the lines into schedule_changes for 2026: SUPABASE_URL and SUPABASE_SERVICE_KEY")
    args = ap.parse_args(argv)
    secrets = [os.environ.get(mirror.KEY_VAR, "").strip()]
    try:
        h = gather(args.ref, with_runs=False)
        runs = replay_changes(h, *load_inputs())
        rows = change_rows(runs)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8", newline="\n") as f:
            f.write(diff_stage.render(lines_of(runs)))
        mirror.say(summary(h, runs, shown(args.out)))
        if args.load:
            rest = mirror.Rest(mirror.check_url(os.environ.get(mirror.URL_VAR)),
                               mirror.check_key(os.environ.get(mirror.KEY_VAR)), session, sleep=sleep)
            written, ids, naming = load(rows, rest)
            mirror.say(f"loaded {written:,} lines into schedule_changes for {YEAR}; {naming:,} of them name an id "
                       f"schedule_events does not hold for {YEAR}, on {len(ids)} id{'' if len(ids) == 1 else 's'}"
                       + (": " + ", ".join(ids) if ids else ""))
    except (ReplayError, mirror.MirrorError) as exc:
        mirror.say(f"failed: {mirror.redact(str(exc), secrets)}")
        return 1
    except Exception:  # noqa: BLE001 - anything unforeseen fails the run, its traceback redacted
        mirror.say(f"failed: {mirror.redact(traceback.format_exc(), secrets)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
