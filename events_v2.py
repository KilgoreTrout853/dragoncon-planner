#!/usr/bin/env python3
"""events.v2.json: a year's schedule with its places, people, facets and tags v2, and the works its events link
(DECISIONS #32-#34, #38, #42-#46; docs/pipeline/contract.md, The v2 file).

    python events_v2.py                                          # 2026, frozen: rebuild data/2026/events.v2.json
    python events_v2.py --season data/2026/season.json --check   # exit 1 if the file on disk is not a fresh build
    python events_v2.py --season data/2027/season.json --check   # a live year: the orchestrator writes it

Pure: a year's committed inputs give the same bytes on every run, with no model and no network, which is what CI
runs. It never writes a registry, the cache or a year's raw file, and never reads its own previous output (#42).

The front doors. A frozen season (#46) reads events.json beside it, the year's raw file, which nothing writes (#13):
each event becomes a raw row whose id is its source id (#43), v1's hotel, room, track, cancelled and tags dropped and
its location kept, and the file's top-level fields are copied as they are - failures stays a count - with the digest
added. `python events_v2.py`, with no --season, is that rebuild for 2026: the explicit command a frozen year's derived
file is rebuilt by. A live season reads source.json and ids.jsonl beside it: ids_stage.assign() with the committed
ledger and the season's thresholds must leave the ledger as it is, or the build refuses - run the ids stage first -
and last-run.json gives generated_at (its fetched_at) and changed_at, and its absence refuses the build: a live year
needs a run. The top-level fields are then generated_at, changed_at, the season's source, count (every event, the
removed ones among them), source.json's failures and the digest. A live year's file is the orchestrator's to write,
with changes.jsonl and last-run.json (#42, #44), so main() checks it, and writes only to an --out outside the year's
folder. season_rows() is both doors, and the tag stage reads a season through it too (#44, #46).

build(), in order: the merge (merge_stage.py); the venues step (venues_stage.py); the parse step - people, facets and
cancelled; the cached answer, by the input key (tag_key.py) under the season's prompt_version (#46); the works and axes
merge, below; the works block; the digest. An event is the ten raw fields, then id, source_id, hotel, room, level,
rooms, place, track (the first of its tracks, or null), cancelled, people, facets and tags, and last removed, stale and
was, each only where set.

Tolerance (#44). A cache miss ships the event untagged, with no tags key at all (#46); a work name the registry cannot
resolve drops that link; a track tracks.json lacks keeps its name, with no axes and no track work. Each is counted in
the report with its names - untagged, unresolved_names, unknown_tracks - and tests/test_zero_hold.py holds all three at
zero on 2026. A name that is a registry term is dropped and counted too (terms): a term leads a searcher to a work and
is not a name for one. The fix for an unresolved name is `tag_stage.py --season <season> --mint-only`, not a change
here. What stops a build is ours to fix before any run, as BuildError: a registry, a venues file or a cache that fails
to load, a row with no id, and a live year's refusals.

The works and axes merge:
- works: what the event is about (a work and its ancestor both named: the descendant stays), then the works of its
  tracks (`via: track`), then the reviewed credits of its reviewed people (`via: credit:<person>`). One row per work,
  the strongest way first; among several credits, the first person in event order. Only the work named is listed on
  the event: its ancestors are rows of the works block, and the walk up to them is the reader's, at read time.
- axes: where any of the event's tracks decides an axis, the tracks' values are that axis (in tracks[] order, at most
  2); otherwise the model's.
- audience: mature where the parse, the model or a track says so; else kids where a track or the model says so; else
  all.
- play: only on a gaming event, by its scraped type or its kind.
- guests: the highest tier among the event's reviewed people; absent otherwise.

The works block, the file's `works`, just before `events` (#38): one row per work that any tagged event's tags.works
names, by any via, and every ancestor of those; nothing else; sorted by id. A row is {id, name, aliases, terms,
reviewed, parent}, in that order, with values as the registry holds them: aliases and terms always, [] where the
registry holds none; parent only where it has one; no type or family. It is built from the merged events, not the
registry, so every id in it has resolved.

The file (#42): the top-level fields, then digest, works and events; compact UTF-8, a line break before each works
row and each event, LF, and one at the end. The digest is the sha256 of the works and the events written exactly so:
one serialisation, dumps()'s, with no stamp and no failures in it.
"""

import argparse
import hashlib
import json
import os
import sys
from collections import Counter

import ids_stage
import merge_stage
import parse_stage as ps
import registry
import venues_stage
from season import SeasonError, load as load_season
from tag_key import input_key, load_cache, tagger_input
from venues import VenuesError, load as load_venues

SEASON = os.path.join("data", "2026", "season.json")
OUT = os.path.join("data", "2026", "events.v2.json")
TIERS = ("celebrity", "creator")   # highest first
TAG = "python tag_stage.py --season {season}"   # the hints name the season file: the default, 2026's, is frozen
DROPPED = ("hotel", "room", "track", "cancelled", "tags")   # a frozen event's v1 fields: each is a stage's here
PLACE = ("hotel", "room", "level", "rooms", "place")        # the venues step's (#45)
FLAGS = ("removed", "stale", "was")                         # the merge's, each only where set
LISTED = ("works", "events")                                # the file's two lists: a line break before each item


class BuildError(Exception):
    """Everything that stops a build, not the first thing. `problems` is the list."""

    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__(f"{len(self.problems)} problem(s) building events.v2.json:\n  "
                         + "\n  ".join(self.problems))


# ---------------------------------------------------------------------------
# The parts of an event
# ---------------------------------------------------------------------------

def resolve_people(people, reg):
    """The parse stage's people with the registry's ids, reviewed or not; a person the registry
    does not know keeps the slug. One entry an id, the first standing, so speakers' role wins."""
    out, seen = [], set()
    for p in people:
        pid = reg.resolve_person(p["name"]) or p["id"]
        if pid in seen:
            continue
        seen.add(pid)
        out.append({"id": pid, "name": p["name"], "role": p["role"], "src": p["src"]})
    return out


def ancestors(wid, parents):
    out, at = set(), parents.get(wid)
    while at is not None and at not in out:
        out.add(at)
        at = parents.get(at)
    return out


def merge_works(about, tracks, people, people_by_id, parents):
    """[{id, via}]: `about` (resolved ids, in the answer's order), the tracks' works, the credits."""
    above = set().union(*(ancestors(w, parents) for w in about)) if about else set()
    rows, seen = [], set()

    def add(wid, via):
        if wid not in seen:
            seen.add(wid)
            rows.append({"id": wid, "via": via})

    for wid in about:
        if wid not in above:        # a work and its ancestor both named: the descendant stays
            add(wid, "about")
    for t in tracks:
        if t.get("work"):
            add(t["work"], "track")
    for p in people:                # an unreviewed person gives no credits
        entry = people_by_id.get(p["id"])
        if not entry or entry.get("reviewed") is not True:
            continue
        for c in entry.get("credits") or []:
            if c.get("reviewed") is True:
                add(c["work"], f"credit:{p['id']}")
    return rows


def merge_axes(answer, tracks):
    out = {}
    for axis in registry.AXES:
        deciding = [t for t in tracks if axis in (t.get("axes") or {})]
        if deciding:
            values = []
            for t in deciding:
                values += [v for v in t["axes"][axis] if v not in values]
            out[axis] = values[:registry.MAX_AXIS_VALUES]
        else:
            out[axis] = list(answer[axis])
    return out


def merge_audience(facets, answer, tracks):
    said = {t.get("audience") for t in tracks}
    if facets.get("mature") or answer["audience"] == "mature" or "mature" in said:
        return "mature"
    if "kids" in said or answer["audience"] == "kids":
        return "kids"
    return "all"


def guests_for(people, people_by_id):
    """The highest tier among the event's reviewed people, or None. An unreviewed person gives no tier."""
    tiers = {people_by_id[p["id"]].get("tier") for p in people
             if p["id"] in people_by_id and people_by_id[p["id"]].get("reviewed") is True}
    return next((t for t in TIERS if t in tiers), None)


def works_block(events, works_by_id, parents):
    """The file's `works`: every work the merged events link, by any via, and every ancestor of those, one
    row each, sorted by id. Keys in one order; aliases and terms always, parent only where the registry
    has one."""
    linked = {w["id"] for e in events for w in e["tags"]["works"]}
    ids = linked.union(*(ancestors(w, parents) for w in linked))
    rows = []
    for wid in sorted(ids):
        entry = works_by_id[wid]
        row = {"id": wid, "name": entry["name"], "aliases": list(entry.get("aliases") or []),
               "terms": list(entry.get("terms") or []), "reviewed": entry["reviewed"]}
        if entry.get("parent") is not None:
            row["parent"] = entry["parent"]
        rows.append(row)
    return rows


def event_fields(event, people, facets):
    """An event as the file writes it, but for its tags and its flags: the ten raw fields, id, source_id, the five
    place fields, track - the first of its tracks, or null - cancelled, people and facets. tools/sample_v2.py writes
    the page tests' fixture with it too."""
    out = {k: event[k] for k in merge_stage.FIELDS}
    out["id"], out["source_id"] = event["id"], event["source_id"]
    for k in PLACE:
        out[k] = event[k]
    out["track"] = event["tracks"][0] if event["tracks"] else None
    out["cancelled"] = ps.is_cancelled(event["title"], event["description"])
    out["people"], out["facets"] = people, facets
    return out


# ---------------------------------------------------------------------------
# The build
# ---------------------------------------------------------------------------

def build(rows, top, reg, cache, venues, ledger=None, *, version):
    """(the v2 document, the report) for a year's raw rows (#42), each carrying our id (#43).

    `top` is the top-level fields written before the digest; `reg` is registry.load()'s, `cache`
    tag_key.load_cache()'s, `venues` venues.load()'s, and `ledger` ids_stage.read_ledger()'s - a frozen year has
    none. `version` is the season's prompt_version, which the cache's keys hold (#46). Raises BuildError for a row
    with no id; every other gap is counted in the report and the build goes on.

    The report: untagged (the titles of the events with no cached answer, in file order), unresolved_names ({name:
    links dropped}) and unknown_tracks ({name: events}); terms (registry terms named as works and dropped); the venues
    step's places and its two counters, rooms_unresolved and hotels_unknown; and what the merge of tags counted."""
    missing = [r.get("source_id") for r in rows if not isinstance(r.get("id"), str) or not r["id"]]
    if missing:
        raise BuildError([f"{len(missing)} row(s) with no id - the ids stage gives every row one: "
                          + ", ".join(str(s) for s in missing[:20]) + (" ..." if len(missing) > 20 else "")])
    placed = venues_stage.resolve(merge_stage.merge(rows, ledger), venues)
    parsed = ps.parse_all(placed.rows)
    people_by_id, tracks_by_id = reg.by_id("people"), reg.by_id("tracks")
    parents = {w["id"]: w.get("parent") for w in reg.works}
    untagged, unresolved, unknown = [], Counter(), Counter()
    report = {"untagged": untagged, "unresolved_names": unresolved, "unknown_tracks": unknown, "terms": Counter(),
              "via": Counter(), "audience": Counter(), "guests": Counter(), "play": 0, "kids_track_mature": [],
              "about_events": 0, "works_per_event": Counter()}
    out = []
    for event, p in zip(placed.rows, parsed):
        tracks = []
        for name in event["tracks"]:
            tid = reg.resolve_track(name)
            if tid:
                tracks.append(tracks_by_id[tid])
            else:
                unknown[name] += 1          # the name stays on the event; no axes, no track work
        people = resolve_people(p["people"], reg)
        row = event_fields(event, people, p["facets"])
        entry = cache.get(input_key(tagger_input(event), version))
        if entry is None:
            untagged.append(event["title"] or event["id"])   # untagged is a state: no tags key (#46)
        else:
            answer = entry["answer"]
            about = []
            for w in answer["works"]:
                wid = reg.resolve_work(w["name"])
                if wid:
                    if wid not in about:
                        about.append(wid)
                elif reg.is_term(w["name"]):
                    report["terms"][w["name"]] += 1
                else:
                    unresolved[w["name"]] += 1      # the link drops for this build
            works = merge_works(about, tracks, people, people_by_id, parents)
            tags = {"kind": answer["kind"], "works": works, **merge_axes(answer, tracks),
                    "audience": merge_audience(p["facets"], answer, tracks)}
            if answer.get("play") and (event["type"] == "gaming" or answer["kind"] == "gaming"):
                tags["play"] = answer["play"]
                report["play"] += 1
            guests = guests_for(people, people_by_id)
            if guests:
                tags["guests"] = guests
            if any(t.get("audience") == "kids" for t in tracks) and answer["audience"] == "mature":
                report["kids_track_mature"].append(event["title"])
            for w in works:
                report["via"][w["via"].split(":")[0]] += 1
            report["about_events"] += any(w["via"] == "about" for w in works)
            report["works_per_event"][len(works)] += 1
            report["audience"][tags["audience"]] += 1
            report["guests"][guests or "-"] += 1
            row["tags"] = tags
        for flag in FLAGS:
            if event.get(flag):
                row[flag] = event[flag]
        out.append(row)

    tagged = [e for e in out if "tags" in e]
    block = works_block(tagged, reg.by_id("works"), parents)
    linked = {w["id"] for e in tagged for w in e["tags"]["works"]}
    report.update(unresolved_names=dict(sorted(unresolved.items())), unknown_tracks=dict(sorted(unknown.items())),
                  places=dict(placed.report.places), rooms_unresolved=placed.report.rooms_unresolved,
                  hotels_unknown=placed.report.hotels_unknown,
                  block={"rows": len(block), "ancestors_only": sum(1 for r in block if r["id"] not in linked),
                         "registry": len(reg.works)})
    doc = {k: v for k, v in top.items() if k not in ("digest",) + LISTED}   # the block and the digest are the build's
    doc["digest"] = digest(block, out)
    doc["works"], doc["events"] = block, out
    return doc, report


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def _compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _text(doc):
    """doc as the file writes it: compact, with a line break before each works row and each event."""
    return "{" + ",".join(_compact(k) + ":" + ("[" + ",".join("\n" + _compact(x) for x in v) + "]" if k in LISTED
                                               else _compact(v)) for k, v in doc.items()) + "}"


def digest(works, events):
    """The sha256 hex of the works and the events written exactly as the file writes them (#42): the one
    serialisation, dumps()'s, of {"works": ..., "events": ...} - no stamp, no failures."""
    return hashlib.sha256(_text({"works": works, "events": events}).encode("utf-8")).hexdigest()


def dumps(doc):
    """The file's bytes: compact UTF-8, a line break before each works row and each event, LF, and one at the end."""
    return (_text(doc) + "\n").encode("utf-8")


# ---------------------------------------------------------------------------
# The front doors
# ---------------------------------------------------------------------------

def frozen(data):
    """A frozen year's raw file (#13, #46) as build()'s input -> (rows, top). Each event is a raw row whose id is also
    its source id - a frozen year's ids are its source ids (#43) - with v1's hotel, room, track, cancelled and tags
    dropped and its location kept. `top` is every other top-level field, as it is: failures stays a count."""
    rows = [{"source_id": e.get("id"), **{k: v for k, v in e.items() if k not in DROPPED}} for e in data["events"]]
    return rows, {k: v for k, v in data.items() if k not in ("digest",) + LISTED}


def live(folder, season):
    """A live year's inputs (#42) -> (rows, top, ledger): source.json's rows with our ids, the top-level fields, and
    the committed ledger. BuildError where source.json is absent, unreadable or another source's; where last-run.json
    is absent - a live year needs a run - or holds no stamps; where the ids stage refuses the rows; and where
    assigning them would change the ledger: run the ids stage first."""
    path = os.path.join(folder, "source.json")
    source = _read(path)
    if not isinstance(source, dict) or set(source) != {"source", "failures", "rows"}:
        raise BuildError([f"{path} is not a source.json: an object of source, failures and rows"])
    if source["source"] != season["source"]:
        raise BuildError([f"{path} is {source['source']}'s, not the season's {season['source']}"])
    path = os.path.join(folder, "last-run.json")
    if not os.path.exists(path):
        raise BuildError([f"{path} is absent: a live year needs a run, whose fetched_at and changed_at are the file's "
                          "generated_at and changed_at (DECISIONS #42, #44)"])
    run = _read(path)
    if not isinstance(run, dict) or not all(isinstance(run.get(k), str) and run[k]
                                            for k in ("fetched_at", "changed_at")):
        raise BuildError([f"{path} holds no fetched_at and changed_at"])
    try:
        ledger = ids_stage.read_ledger(os.path.join(folder, "ids.jsonl"))
        result = ids_stage.assign(source["rows"], ledger, run["fetched_at"], season["thresholds"])
    except ids_stage.IdsError as exc:
        raise BuildError([f"the ids stage refuses these rows: {exc}"]) from None
    if result.ledger != ledger:
        raise BuildError([f"{os.path.join(folder, 'ids.jsonl')} does not hold the ids of source.json's rows: run the "
                          "ids stage first"])
    top = {"generated_at": run["fetched_at"], "changed_at": run["changed_at"], "source": season["source"],
           "count": len({r["id"] for r in result.rows}), "failures": source["failures"]}
    return result.rows, top, ledger


def _read(path):
    try:
        with open(path, "rb") as f:   # read-only: nothing here writes an input
            return json.loads(f.read().decode("utf-8"))
    except OSError as exc:
        raise BuildError([f"{path} cannot be read ({exc.strerror or exc})"]) from None
    except ValueError as exc:
        raise BuildError([f"{path} is not JSON ({exc})"]) from None


def season_rows(season, folder):
    """(rows, top, ledger): a season's raw rows, each carrying our id, through its front door - a frozen year's
    events.json by frozen(), with no ledger, and a live year's source.json, ids.jsonl and last-run.json by live(),
    with its refusals. `season` is season.load()'s and `folder` the folder it is in. The build reads a season this way,
    and so does the tag stage, which merges the rows as the build does (#44)."""
    if season["frozen"]:
        rows, top = frozen(_read(os.path.join(folder, "events.json")))
        return rows, top, None
    return live(folder, season)


def build_season(season, folder, registry_dir=registry.DIR, cache=None):
    """(doc, report): a season's file as a fresh build makes it, through its front door. `season` is season.load()'s
    and `folder` the folder it is in; `cache` is the tag cache's path, tags.cache.jsonl there by default, whose keys
    hold the season's prompt_version (#46). BuildError where the registries, the venues file, the cache or the year's
    raw file fails to load, or a live year's front door refuses."""
    try:
        reg = registry.load(registry_dir)
    except registry.RegistryError as exc:
        raise BuildError([f"the registries: {p}" for p in exc.problems]) from None
    try:
        venues = load_venues(os.path.join(folder, "venues.json"))
    except VenuesError as exc:
        raise BuildError([f"the venues file: {p}" for p in exc.problems]) from None
    try:
        answers = load_cache(cache or os.path.join(folder, "tags.cache.jsonl"))
    except ValueError as exc:
        raise BuildError([f"the tag cache: {exc}"]) from None
    rows, top, ledger = season_rows(season, folder)
    return build(rows, top, reg, answers, venues, ledger, version=season["prompt_version"])


def same_file(a, b):
    try:
        return os.path.samefile(a, b)
    except OSError:
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))


def inside(path, folder):
    """True where `path` is `folder` or anything under it."""
    path, folder = (os.path.normcase(os.path.realpath(p)) for p in (path, folder))
    try:
        return os.path.commonpath([path, folder]) == folder
    except ValueError:  # another drive
        return False


def degradations(report, season):
    """The run summary's build counters (contract.md, `last-run.json`), one line, the names after it. `season` is the
    season file's path, which the hints name."""
    tag = TAG.format(season=season)
    lines = ["  places: " + ", ".join(f"{k} {n:,}" for k, n in report["places"].items())
             + f"; rooms unresolved {report['rooms_unresolved']:,}, hotels unknown {report['hotels_unknown']:,}",
             f"  events untagged {len(report['untagged']):,}, work names unresolved "
             f"{sum(report['unresolved_names'].values()):,}, tracks unknown {len(report['unknown_tracks']):,}"]
    if report["untagged"]:
        lines.append(f"  untagged - run `{tag}`: " + "; ".join(report["untagged"][:50])
                     + (" ..." if len(report["untagged"]) > 50 else ""))
    if report["unresolved_names"]:
        lines.append(f"  work names unresolved - run `{tag} --mint-only`: "
                     + ", ".join(f"{n!r} ({k})" for n, k in report["unresolved_names"].items()))
    if report["unknown_tracks"]:
        lines.append("  tracks unknown - owed to tracks.json: "
                     + ", ".join(f"{n!r} ({k})" for n, k in report["unknown_tracks"].items()))
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", default=SEASON, help="the year's season.json; default 2026's, which is frozen")
    ap.add_argument("--out", help="where events.v2.json goes; default: beside the season file")
    ap.add_argument("--registry", default=registry.DIR)
    ap.add_argument("--cache", help="the tag cache; default: tags.cache.jsonl beside the season file")
    ap.add_argument("--check", action="store_true", help="exit 1 if a fresh build differs from --out; write nothing")
    args = ap.parse_args(argv)
    try:
        season = load_season(args.season)
    except SeasonError as exc:
        print(exc, file=sys.stderr)
        return 1
    here = os.path.dirname(args.season)
    folder = os.path.dirname(os.path.abspath(args.season))
    out = args.out or os.path.join(here, "events.v2.json")
    cache = args.cache or os.path.join(here, "tags.cache.jsonl")
    raw = ("events.json",) if season["frozen"] else ("source.json", "ids.jsonl", "last-run.json")
    if any(same_file(out, p) for p in [args.season, os.path.join(here, "venues.json"), cache]
           + [os.path.join(here, name) for name in raw]):
        sys.exit(f"events_v2.py will not write over its input, {out} (DECISIONS #13, #42)")
    if not season["frozen"] and not args.check and inside(out, folder):
        sys.exit(f"{args.season} is a live year: its events.v2.json is the orchestrator's to write, with "
                 "changes.jsonl and last-run.json (DECISIONS #42, #44). --check checks it here, and an --out outside "
                 f"{here or '.'} writes a copy to look at.")

    try:
        doc, report = build_season(season, folder, args.registry, cache)
    except BuildError as exc:
        print(exc, file=sys.stderr)
        return 1
    body = dumps(doc)

    if args.check:
        try:
            with open(out, "rb") as f:
                on_disk = f.read()
        except OSError:
            on_disk = None
        if on_disk != body:
            fix = ("the orchestrator writes it (DECISIONS #44)" if not season["frozen"] else
                   "run `python events_v2.py" + ("" if same_file(args.season, SEASON) else f" --season {args.season}")
                   + "`")
            print(f"{out} is not a fresh build: {fix}", file=sys.stderr)
            return 1
        print(f"{out} is a fresh build ({len(body):,} bytes, digest {doc['digest'][:12]})", file=sys.stderr)
        for line in degradations(report, args.season):
            print(line, file=sys.stderr)
        return 0

    tmp = out + ".tmp"
    with open(tmp, "wb") as f:
        f.write(body)
    os.replace(tmp, out)
    events = len(doc["events"])
    print(f"{out}: {events:,} events, {len(body):,} bytes, digest {doc['digest'][:12]}", file=sys.stderr)
    print(f"  works: {report['via']['about']:,} about on {report['about_events']:,} events, "
          f"{report['via']['track']:,} by track, {report['via']['credit']:,} by credit", file=sys.stderr)
    block = report["block"]
    print(f"  works block: {block['rows']:,} of the registry's {block['registry']:,} works, "
          f"{block['ancestors_only']:,} of them ancestors only", file=sys.stderr)
    print("  works per event: " + ", ".join(f"{n}: {k:,}" for n, k in sorted(report["works_per_event"].items())),
          file=sys.stderr)
    print("  audience: " + ", ".join(f"{a} {n:,}" for a, n in sorted(report["audience"].items())), file=sys.stderr)
    print(f"  guests: {sum(n for g, n in report['guests'].items() if g != '-'):,} events "
          f"({', '.join(f'{g} {n:,}' for g, n in sorted(report['guests'].items()) if g != '-') or 'none'}); "
          f"play on {report['play']:,}", file=sys.stderr)
    for line in degradations(report, args.season):
        print(line, file=sys.stderr)
    if report["terms"]:
        print(f"  registry terms named as works, dropped: {sum(report['terms'].values())} - "
              + ", ".join(f"{n!r} ({k})" for n, k in sorted(report["terms"].items())), file=sys.stderr)
    for title in report["kids_track_mature"]:
        print(f"  a Kids Track event the model called mature: {title}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
