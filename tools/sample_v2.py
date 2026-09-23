#!/usr/bin/env python3
"""tests/sample-events.json: the page tests' fixture in the v2 shape, made from tests/sample-events.v1.json.

    python tools/sample_v2.py           # write tests/sample-events.json
    python tools/sample_v2.py --check   # exit 1 if the committed fixture is not what this builds

The v1 sample is tests/make_sample.py's: 558 synthetic events, five of them tagged the way v1's tagger
tagged. The client reads events.v2.json since DECISIONS #39, so its tests boot a sample in that shape.
This is not events_v2.py - the sample has no cache entry, and five of its track names are not in
tracks.json - but it builds what events_v2.py would, from the same pieces:

- every event in the file's shape (events_v2.event_fields): its ten raw fields, its id, which is also
  its source id, as a frozen year's are, the five place fields the venues step reads from its location
  against data/2026/venues.json, track (the first of its tracks), cancelled by the parse step's rule,
  people and facets;
- people and facets on every event, from parse_stage, each person's id through the registry
  (events_v2.resolve_people);
- on the five events v1 tagged: kind as it was; each fandom a work, via about, by the registry where
  the name resolves and otherwise a row of the fixture's own (id the work slug, reviewed); topics the
  four axes by schema-v2.md's table, From TOPICS to v2; adult as audience mature; guests celebrity and
  creator kept, v2 having retired fan;
- one parent chain, so a work rolls up: the sample's titles are made from a fixed list of names, and
  those that name Andor are about andor, which is under star-wars; and a track whose work tracks.json
  gives links its events via track, as events_v2's merge does (the Star Wars track);
- no credits, so no cast group: the one registry person on the sample is on events with no kind;
- the works block by events_v2.works_block.

An event v1 left untagged stays untagged, unless it gets works here, and then its tags hold works only.
The top-level fields are the v1 file's, with no digest. The file is written as events_v2.dumps writes
events.v2.json, a line break before each works row and each event. No model, no network, no clock: the
same input gives the same bytes.
"""

import argparse
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)

import events_v2 as v2  # noqa: E402
import parse_stage as ps  # noqa: E402
import registry  # noqa: E402
import venues_stage  # noqa: E402
from venues import load as load_venues  # noqa: E402

V1 = os.path.join(ROOT, "tests", "sample-events.v1.json")
OUT = os.path.join(ROOT, "tests", "sample-events.json")
VENUES = os.path.join(ROOT, "data", "2026", "venues.json")   # the sample is 2026's shape, so 2026's venues file

# schema-v2.md, From TOPICS to v2. Gaming has no single home and Kids is an audience, not an axis.
TOPIC_AXES = {
    "Space": ("subject", "space"), "Science": ("subject", "science"), "Writing": ("craft", "writing"),
    "Costuming": ("craft", "costuming"), "Props & Making": ("craft", "props-making"),
    "Comics": ("medium", "comics"), "Animation": ("medium", "animation"), "Anime": ("medium", "anime"),
    "Film": ("medium", "film"), "TV": ("medium", "tv"), "Literature": ("medium", "books"),
    "Music": ("medium", "music"), "Comedy": ("genre", "comedy"), "History": ("subject", "history"),
    "Tech": ("subject", "tech"), "Horror": ("genre", "horror"), "Fantasy": ("genre", "fantasy"),
    "Sci-Fi": ("genre", "sci-fi"), "Tabletop": ("medium", "tabletop"), "Fitness": ("subject", "fitness"),
    "Food": ("subject", "food"), "Podcasting": ("medium", "podcast-web"), "Art": ("craft", "art"),
    "Community": ("subject", "community"), "Politics": ("subject", "politics"),
    "Fandom Culture": ("subject", "fandom-culture"), "Puppetry": ("craft", "puppetry"),
    "Cosplay Photography": ("craft", "photography"), "Skepticism": ("subject", "skepticism"),
    "Paranormal": ("subject", "paranormal"),
}
TIERS = ("celebrity", "creator")
# The generated names whose titles make an event about the work: one parent chain, andor under star-wars.
ABOUT_BY_TITLE = ("Andor",)


def v2_tags(tags, about, tracks, parents):
    """v2 tags for an event v1 tagged."""
    axes = {a: [] for a in registry.AXES}
    for topic in tags.get("topics") or []:
        home = TOPIC_AXES.get(topic)
        if home and home[1] not in axes[home[0]] and len(axes[home[0]]) < registry.MAX_AXIS_VALUES:
            axes[home[0]].append(home[1])
    audience = "mature" if tags.get("adult") else "kids" if "Kids" in (tags.get("topics") or []) else "all"
    out = {"kind": tags["kind"], "works": v2.merge_works(about, tracks, [], {}, parents), **axes, "audience": audience}
    if tags.get("guests") in TIERS:
        out["guests"] = tags["guests"]
    return out


def build(data, reg, venues):
    works_by_id = dict(reg.by_id("works"))
    own = {}                                     # the fixture's own block rows, by id
    parents = {w["id"]: w.get("parent") for w in reg.works}
    tracks_by_id = reg.by_id("tracks")
    placed = venues_stage.resolve(v2.frozen(data)[0], venues).rows   # each a raw row, its id its source id, placed
    parsed = ps.parse_all(placed)
    out = []
    for event, row, p in zip(data["events"], placed, parsed):
        tracks = [tracks_by_id[t] for t in (reg.resolve_track(n) for n in event.get("tracks") or []) if t]
        v1 = event.get("tags")
        about = []
        if v1:
            for name in v1.get("fandoms") or []:
                wid = reg.resolve_work(name)
                if not wid:
                    wid = registry.work_slug(name)
                    if wid in works_by_id and wid not in own:
                        raise SystemExit(f"{name!r}: its slug {wid!r} is a registry work of another name")
                    own[wid] = works_by_id[wid] = {"id": wid, "name": name, "aliases": [], "reviewed": True}
                    parents[wid] = None
                if wid not in about:
                    about.append(wid)
        for name in ABOUT_BY_TITLE:
            if re.search(rf"\b{re.escape(name)}\b", event["title"]):
                wid = reg.resolve_work(name)
                if not wid:
                    raise SystemExit(f"{name!r} no longer resolves in the registry: pick another name for the chain")
                if wid not in about:
                    about.append(wid)
        written = v2.event_fields(row, v2.resolve_people(p["people"], reg), p["facets"])
        if v1:
            written["tags"] = v2_tags(v1, about, tracks, parents)
        else:
            works = v2.merge_works(about, tracks, [], {}, parents)
            if works:
                written["tags"] = {"works": works}
        out.append(written)
    block = v2.works_block([e for e in out if "tags" in e], works_by_id, parents)
    doc = {k: v for k, v in data.items() if k not in ("events", "works")}
    doc["works"], doc["events"] = block, out
    return doc


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="exit 1 if the committed fixture is not a fresh build")
    args = ap.parse_args(argv)
    with open(V1, "rb") as f:
        data = json.loads(f.read().decode("utf-8"))
    body = v2.dumps(build(data, registry.load(os.path.join(ROOT, registry.DIR)), load_venues(VENUES)))
    if args.check:
        try:
            with open(OUT, "rb") as f:
                fresh = f.read() == body
        except OSError:
            fresh = False
        print(f"tests/sample-events.json is {'a fresh build' if fresh else 'stale: run `python tools/sample_v2.py`'}",
              file=sys.stderr)
        return 0 if fresh else 1
    with open(OUT, "wb") as f:
        f.write(body)
    print(f"tests/sample-events.json: {len(json.loads(body)['events'])} events, {len(body):,} bytes", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
