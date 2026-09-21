#!/usr/bin/env python3
"""data/2026/events.v2.json: the frozen schedule with people, facets and tags v2 (DECISIONS #32-#34).

    python events_v2.py           # write data/2026/events.v2.json
    python events_v2.py --check   # exit 1 if a fresh build differs from the file on disk

Pure. The frozen events, the registries and the tag cache give the same bytes on every run, with no
model and no network, which is what CI runs. It never writes a registry or the cache, and it opens
data/2026/events.json for reading only (#13, #33).

In this order: the parse stage's people and facets; every person's id through the registry, reviewed
or not (resolution is spelling, and an id that changed on the day a person was approved would break
a follow); each track through tracks.json; the cached answer by input key; then the merge, below. A
cache miss is an error listing the titles, and so is a work name the registry cannot resolve - the
fix for that is `tag_stage.py --mint-only`, not a change here - but a name that is a registry term is
dropped and counted: a term leads a searcher to a work and is not a name for one.

The merge:
- works: what the event is about (a work and its ancestor both named: the descendant stays), then
  the works of its tracks (`via: track`), then the reviewed credits of its reviewed people
  (`via: credit:<person>`). One row per work, the strongest way first; among several credits, the
  first person in event order. Only the work named is listed: the walk up to its parents is the
  reader's, at read time.
- axes: where any of the event's tracks decides an axis, the tracks' values are that axis (in
  tracks[] order, at most 2); otherwise the model's.
- audience: mature where the parse, the model or a track says so; else kids where a track or the
  model says so; else all.
- play: only on a gaming event, by its scraped type or its kind.
- guests: the highest tier among the event's reviewed people; absent otherwise.
"""

import argparse
import json
import os
import sys
from collections import Counter

import parse_stage as ps
import registry
from tag_stage import AXIS_NAMES, CACHE, EVENTS, input_key, load_cache, tagger_input

OUT = os.path.join("data", "2026", "events.v2.json")
TIERS = ("celebrity", "creator")   # highest first
MINT = "python tag_stage.py --mint-only"


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
    for axis in AXIS_NAMES:
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


# ---------------------------------------------------------------------------
# The build
# ---------------------------------------------------------------------------

def build(data, reg, cache):
    """(the v2 document, what the build counted). Raises BuildError listing every problem."""
    events = data["events"]
    parsed = ps.parse_all(events)
    people_by_id, tracks_by_id = reg.by_id("people"), reg.by_id("tracks")
    parents = {w["id"]: w.get("parent") for w in reg.works}
    problems, misses, unresolved, bad_tracks = [], [], Counter(), Counter()
    stats = {"via": Counter(), "terms": Counter(), "audience": Counter(), "guests": Counter(),
             "play": 0, "kids_track_mature": [], "about_events": 0, "works_per_event": Counter()}
    out = []
    for event, p in zip(events, parsed):
        tracks = []
        for name in event.get("tracks") or []:
            tid = reg.resolve_track(name)
            if tid:
                tracks.append(tracks_by_id[tid])
            else:
                bad_tracks[name] += 1
        entry = cache.get(input_key(tagger_input(event)))
        if entry is None:
            misses.append(event.get("title") or event.get("id"))
            continue
        answer = entry["answer"]
        about = []
        for w in answer["works"]:
            wid = reg.resolve_work(w["name"])
            if wid:
                if wid not in about:
                    about.append(wid)
            elif reg.is_term(w["name"]):
                stats["terms"][w["name"]] += 1
            else:
                unresolved[w["name"]] += 1
        people = resolve_people(p["people"], reg)
        works = merge_works(about, tracks, people, people_by_id, parents)
        tags = {"kind": answer["kind"], "works": works, **merge_axes(answer, tracks),
                "audience": merge_audience(p["facets"], answer, tracks)}
        if answer.get("play") and (event.get("type") == "gaming" or answer["kind"] == "gaming"):
            tags["play"] = answer["play"]
            stats["play"] += 1
        guests = guests_for(people, people_by_id)
        if guests:
            tags["guests"] = guests
        if any(t.get("audience") == "kids" for t in tracks) and answer["audience"] == "mature":
            stats["kids_track_mature"].append(event.get("title"))
        for w in works:
            stats["via"][w["via"].split(":")[0]] += 1
        stats["about_events"] += any(w["via"] == "about" for w in works)
        stats["works_per_event"][len(works)] += 1
        stats["audience"][tags["audience"]] += 1
        stats["guests"][guests or "-"] += 1
        scraped = {k: v for k, v in event.items() if k != "tags"}   # v1's tags are replaced, not kept
        out.append({**scraped, "people": people, "facets": p["facets"], "tags": tags})

    if bad_tracks:
        problems.append(f"{len(bad_tracks)} track name(s) tracks.json does not resolve: "
                        + ", ".join(f"{n!r} ({k})" for n, k in sorted(bad_tracks.items())))
    if misses:
        problems.append(f"{len(misses)} event(s) with no cached answer - run `python tag_stage.py`: "
                        + "; ".join(misses[:50]) + (" ..." if len(misses) > 50 else ""))
    if unresolved:
        problems.append(f"{len(unresolved)} work name(s) the registry does not resolve - run `{MINT}` to add "
                        f"them, reviewed: false: " + ", ".join(f"{n!r} ({k})" for n, k in sorted(unresolved.items())))
    if problems:
        raise BuildError(problems)
    doc = {k: (out if k == "events" else v) for k, v in data.items()}   # every top-level field as it is
    return doc, stats


def dumps(doc):
    return (json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def same_file(a, b):
    try:
        return os.path.samefile(a, b)
    except OSError:
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--events", default=EVENTS)
    ap.add_argument("--registry", default=registry.DIR)
    ap.add_argument("--cache", default=CACHE)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--check", action="store_true", help="exit 1 if a fresh build differs from --out")
    args = ap.parse_args(argv)
    if same_file(args.out, args.events):
        sys.exit("events_v2.py will not write over its input: the 2026 schedule is frozen (DECISIONS #13, #33)")

    with open(args.events, "rb") as f:   # read-only
        data = json.loads(f.read().decode("utf-8"))
    try:
        doc, stats = build(data, registry.load(args.registry), load_cache(args.cache))
    except BuildError as exc:
        print(exc, file=sys.stderr)
        return 1
    body = dumps(doc)

    if args.check:
        try:
            with open(args.out, "rb") as f:
                on_disk = f.read()
        except OSError:
            on_disk = None
        if on_disk != body:
            print(f"{args.out} is not a fresh build: run `python events_v2.py`", file=sys.stderr)
            return 1
        print(f"{args.out} is a fresh build ({len(body):,} bytes)", file=sys.stderr)
        return 0

    tmp = args.out + ".tmp"
    with open(tmp, "wb") as f:
        f.write(body)
    os.replace(tmp, args.out)
    events = len(doc["events"])
    print(f"{args.out}: {events:,} events, {len(body):,} bytes", file=sys.stderr)
    print(f"  works: {stats['via']['about']:,} about on {stats['about_events']:,} events, "
          f"{stats['via']['track']:,} by track, {stats['via']['credit']:,} by credit", file=sys.stderr)
    print("  works per event: " + ", ".join(f"{n}: {k:,}" for n, k in sorted(stats["works_per_event"].items())),
          file=sys.stderr)
    print("  audience: " + ", ".join(f"{a} {n:,}" for a, n in sorted(stats["audience"].items())), file=sys.stderr)
    print(f"  guests: {sum(n for g, n in stats['guests'].items() if g != '-'):,} events "
          f"({', '.join(f'{g} {n:,}' for g, n in sorted(stats['guests'].items()) if g != '-') or 'none'}); "
          f"play on {stats['play']:,}", file=sys.stderr)
    if stats["terms"]:
        print(f"  registry terms named as works, dropped: {sum(stats['terms'].values())} - "
              + ", ".join(f"{n!r} ({k})" for n, k in sorted(stats["terms"].items())), file=sys.stderr)
    for title in stats["kids_track_mature"]:
        print(f"  a Kids Track event the model called mature: {title}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
