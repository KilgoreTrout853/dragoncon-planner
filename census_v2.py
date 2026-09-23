#!/usr/bin/env python3
"""A read-only census of data/2026/events.v2.json, written to docs/discover/census-v2-2026.md.

Census v2, Discover PR 5 (DECISIONS #35): the questions `tag_census.py` asked of v1's tags, asked of the v2 file where
they survive, and the lists the v2 design owes a reviewer - the unreviewed works, the drafted people, the people on
qa, photo and signing events the registry does not hold, and the links worth a person's look. It states facts and
decides nothing: `UNSURE` marks a person's call, and nothing here makes one.

    python census_v2.py            # -> docs/discover/census-v2-2026.md
    python census_v2.py --check    # exit 1 if the committed report is not a fresh render; writes nothing

A living report, held fresh by CI: its inputs are the registries and the tag cache, which change, so an edit to
either is followed by `python events_v2.py` and then this. It builds events.v2.json in memory with events_v2.build
first, and stops unless that is the file on disk.

It never links: only the tagger links an event to a work (#34). It reads text in four places - wrestl* in titles and
descriptions; the evidence and the cues of the resume rule; work names and aliases in titles, for the resume rule's
exclusion and the band marker; and the pilot's everyday words, counted in titles - and each only chooses rows. Where
a list comes of it, every row is UNSURE, and the fix it names is a person's: a `"model": "hand"` line in the cache.
Nothing on the tag or build path imports this file (tests/test_tag_stage.py).

No model, no network. Deterministic: every list is sorted, no set is iterated unsorted, and the only timestamp is
the schedule's own generated_at. It opens data/ read-only and writes nothing there (DECISIONS #13, #33).
"""

import argparse
import functools
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict

import draft_people as dp
import events_v2 as v2
import registry
import tag_key
import tag_stage as ts
from season import SeasonError, load as load_season
from tag_census import code, counted, first, histogram, n, pct, ranked, table  # the markdown helpers, not a copy
from venues import load as load_venues

HERE = os.path.dirname(os.path.abspath(__file__))
EVENTS = os.path.join("data", "2026", "events.json")
SEASON = os.path.join("data", "2026", "season.json")   # the build reads its prompt_version, the cache keys' `v` (#46)
EVENTS_V2 = v2.OUT
CACHE = os.path.join("data", "2026", "tags.cache.jsonl")
SIDECAR = dp.SIDECAR
VENUES = os.path.join("data", "2026", "venues.json")   # the build reads it: the place fields (#45)
OUT = os.path.join("docs", "discover", "census-v2-2026.md")
YEAR = 2026                           # the year the report is of: the files above are its
PILOT = os.path.join(HERE, "tools", "tag_pilot.py")
DATA = os.path.join(HERE, "data")

AXES = ts.AXIS_NAMES
VIAS = ("about", "track", "credit")
QPS = ("qa", "photo", "signing")      # the kinds a guest is booked for
TIER_ORDER = {"celebrity": 0, "creator": 1}
TOP_WORKS = 50
TOP_TRACKS = 15
TOP_PEOPLE = 30
MOST_PEOPLE = 5                       # Appendix C: up to five of an event's people
ONE_VALUE = 0.8                       # section 8: one value on this share of a track's events, or more
KNOWN_CASE = "Specialty Costumes"     # the resume link the pilot and the gates kept meeting (#34)

# The five v1 fandom names that are axis values in v2, not works (registry-2026.md, Coverage). Section 11 leaves
# them out of the comparison.
AXIS_FANDOMS = {"Anime": "medium: anime", "Video Games": "medium: video-games", "Comics": "medium: comics",
                "Animation": "medium: animation", "Fantasy": "genre: fantasy"}

INPUT_FIELDS = ("title", "type", "tracks", "description")        # tag_stage.tagger_input's four
BUILT_FIELDS = ("kind", "about") + AXES + ("audience", "play")   # section 9's; not credits or guests

WRESTLING = re.compile(r"wrestl", re.I)
# The resume rule: a cue that ends within CUE_REACH characters before a link's evidence, matched on folded text.
CUES = ("worked on", "work on", "credits", "credited", "known for", "such as", "including")
CUE = re.compile(r"\b(?:" + "|".join(re.escape(c) for c in CUES) + r")\b")
CUE_REACH = 60
CONTEXT = 40                          # characters of the description either side of a link's evidence
ODD = {"U+2018": chr(0x2018), "U+FFFD": chr(0xFFFD)}   # a left single quote; the replacement character


class Stale(Exception):
    """events.v2.json on disk is not what the inputs build today."""


# ---------------------------------------------------------------------------
# Pure functions: what tests/test_census_v2.py reaches
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=None)
def pilot():
    """tools/tag_pilot.py, loaded by its path and not copied: its EVERYDAY list and its word_in. The pilot is off the
    tag and build path, as this file is; its body imports and defines, and calls nothing."""
    spec = importlib.util.spec_from_file_location("tag_pilot", PILOT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def holds(folded_text, folded_name):
    """True where the folded text holds the folded name as whole words, by the pilot's word_in."""
    return bool(folded_name) and folded_name in folded_text and bool(pilot().word_in(folded_name, folded_text))


def title_holds(title, names):
    """The names among `names` that the title holds as whole words, both folded - case, accents, curly quotes,
    whitespace - by the pilot's word_in. Titles only, and only to choose rows: it links nothing."""
    folded = ts.folded(title)
    return sorted({name for name in names if holds(folded, ts.folded(name))})


def fandom_class(fid, linked_ids, parents):
    """How the event's v2 works of any via hold one of its v1 fandoms, resolved to `fid`: "same", "more specific"
    (v2 names a descendant), "less specific" (v2 names an ancestor) or "lost"."""
    if fid in linked_ids:
        return "same"
    if any(fid in v2.ancestors(w, parents) for w in linked_ids):
        return "more specific"
    if any(w in v2.ancestors(fid, parents) for w in linked_ids):
        return "less specific"
    return "lost"


def minted_after(work, year):
    """True where the tag stage minted the work in a year later than `year` (#46's `minted: {year, run}`). A work with
    no `minted` field counts for every year."""
    m = work.get("minted")
    return isinstance(m, dict) and isinstance(m.get("year"), int) and not isinstance(m["year"], bool) and m["year"] > year


def band_names(works, year):
    """Every work's name and aliases the band marker matches against titles, sorted: a work minted in a later year
    left out, and every other work kept, whether an event links it or not (links_section)."""
    return sorted({x for w in works if not minted_after(w, year) for x in [w["name"]] + list(w.get("aliases") or [])})


def work_source(wid, minted, named):
    """Where an unreviewed work came from: "drafter" when the drafter's sidecar minted it, else "tagger" when a
    cached answer names it, else "other". A row tag_stage.py minted before PR 7a carries no record of it, so "tagger"
    is inferred; one it has minted since carries `minted` (#46)."""
    if wid in minted:
        return "drafter"
    return "tagger" if wid in named else "other"


def varied(inputs):
    """The fields of the tagger's input that are not the same across `inputs`, in INPUT_FIELDS order."""
    return [f for f in INPUT_FIELDS if len({json.dumps(i[f], ensure_ascii=False) for i in inputs}) > 1]


def built(tags):
    """What section 9 compares between the occurrences of one title. Lists are compared as sets."""
    return {"kind": tags["kind"], "about": sorted(w["id"] for w in tags["works"] if w["via"] == "about"),
            **{a: sorted(tags[a]) for a in AXES}, "audience": tags["audience"], "play": tags.get("play")}


def differing(tag_list):
    """The BUILT_FIELDS whose values are not all the same across the events' tags."""
    rows = [built(t) for t in tag_list]
    return [f for f in BUILT_FIELDS if len({json.dumps(r[f], sort_keys=True) for r in rows}) > 1]


def context(description, evidence, reach=CONTEXT):
    """The description around the first place it says `evidence`, whitespace collapsed, `reach` characters each
    side. Found as written where it can be, else in the folded text, which is where the evidence check found it."""
    text = " ".join(str(description or "").split())
    words = str(evidence or "").split()
    m = re.search(r"\s+".join(re.escape(w) for w in words), text, re.I) if words else None
    if not m and words:
        text = ts.folded(description or "")
        m = re.search(re.escape(ts.folded(evidence)), text)
    if not m:
        return ""
    start, end = max(0, m.start() - reach), min(len(text), m.end() + reach)
    return ("..." if start else "") + text[start:end] + ("..." if end < len(text) else "")


def resume_flags(inp, links, names):
    """The `about` links of one input that read like a resume or a list of examples.

    `inp` is what the tagger was sent; `links` is [(work id, evidence)], the event's built `about` links with the
    phrase the model gave for each; `names` is {work id: [its name and aliases]}. A link is a candidate when its
    evidence is in the description and not in the title, and the title does not hold its work's name or an alias
    (whole words, folded). A candidate is flagged when it shares the input with another candidate, or when a cue ends
    within CUE_REACH characters before its evidence. Returns [(work id, evidence, [why], context)]."""
    title, desc = ts.folded(inp["title"]), ts.folded(inp["description"])
    candidates = []
    for wid, evidence in links:
        phrase = ts.folded(evidence)
        if not phrase or phrase not in desc or phrase in title or title_holds(inp["title"], names.get(wid, ())):
            continue
        candidates.append((wid, evidence, phrase))
    out = []
    for wid, evidence, phrase in candidates:
        why = ["shares its input with another"] if len(candidates) > 1 else []
        at = desc.find(phrase)
        start = max(0, at - CUE_REACH - max(len(c) for c in CUES))
        cues = [m for m in CUE.finditer(desc, start, at) if m.end() >= at - CUE_REACH]
        if cues:
            why.append(f"after \"{cues[-1].group(0)}\"")
        if why:
            out.append((wid, evidence, why, context(inp["description"], evidence)))
    return out


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def read_json(path):
    with open(path, "rb") as f:   # read-only
        return json.loads(f.read().decode("utf-8"))


def read_lines(path):
    """The cache as its lines, one entry each: a line count, which tag_stage.load_cache's dict cannot give."""
    with open(path, "rb") as f:
        return [json.loads(line) for line in f.read().decode("utf-8").splitlines() if line.strip()]


def shown(path):
    return str(path).replace(os.sep, "/").replace("\\", "/")


class Census:
    """Everything the sections read, loaded once: the v1 events; the v2 events built from them, the same bytes as the
    file on disk, and the build's counts; the registries; the cache as a dict and as lines, and the season's
    prompt_version, which its keys hold; and the sidecar."""

    def __init__(self, data, doc, stats, reg, cache, lines, sidecar, version):
        self.data, self.doc, self.stats, self.reg, self.cache, self.lines = data, doc, stats, reg, cache, lines
        self.sidecar = sidecar
        self.v1, self.events = data["events"], doc["events"]
        self.keys = [tag_key.input_key(tag_key.tagger_input(e), version) for e in self.v1]
        self.per_key = Counter(self.keys)
        self.inputs, self.first = {}, {}
        for i, (e, k) in enumerate(zip(self.v1, self.keys)):
            if k not in self.inputs:
                self.inputs[k], self.first[k] = tag_key.tagger_input(e), i
        self.works, self.people, self.tracks = reg.by_id("works"), reg.by_id("people"), reg.by_id("tracks")
        self.parents = {w["id"]: w.get("parent") for w in reg.works}
        self.names = {w["id"]: [w["name"]] + list(w.get("aliases") or []) for w in reg.works}
        self.track_of = {t: self.tracks[reg.resolve_track(t)] for e in self.events for t in e.get("tracks") or []}
        self.minted = set(sidecar.get("minted") or [])
        self.notes = sidecar.get("people") or {}
        self.rejected = {r["id"]: r.get("by") or "?" for r in sidecar.get("rejected") or []
                         if isinstance(r, dict) and r.get("id")}

    def tracks_of(self, e):
        return [self.track_of[t] for t in e.get("tracks") or []]

    def status(self, pid):
        """reviewed | drafted (a people.json entry either way) | rejected by model | rejected by review |
        never drafted."""
        if pid in self.people:
            return "reviewed" if self.people[pid].get("reviewed") is True else "drafted"
        if pid in self.rejected:
            return f"rejected by {self.rejected[pid]}"
        return "never drafted"


def load(events=EVENTS, events_v2=EVENTS_V2, cache=CACHE, registry_dir=registry.DIR, sidecar=SIDECAR, venues=VENUES,
         season=SEASON):
    """A Census of the inputs. Raises Stale unless events.v2.json on disk is what they build today, through the
    frozen year's front door with the season's prompt_version (#46); events_v2.BuildError where they build nothing,
    and season.SeasonError where the season file does not load."""
    data = read_json(events)
    reg = registry.load(registry_dir)
    answers = tag_key.load_cache(cache)
    version = load_season(season)["prompt_version"]
    doc, stats = v2.build(*v2.frozen(data), reg, answers, load_venues(venues), version=version)
    try:
        with open(events_v2, "rb") as f:
            on_disk = f.read()
    except OSError:
        on_disk = None
    if on_disk != v2.dumps(doc):
        raise Stale(f"{shown(events_v2)} is not a fresh build of its inputs: run `python events_v2.py` first")
    return Census(data, doc, stats, reg, answers, read_lines(cache), read_json(sidecar), version)


# ---------------------------------------------------------------------------
# Small readers
# ---------------------------------------------------------------------------

def kind(e):
    return e["tags"]["kind"]


def about(e):
    return [w["id"] for w in e["tags"]["works"] if w["via"] == "about"]


def linked(e):
    return [w["id"] for w in e["tags"]["works"]]


def via_of(w):
    return w["via"].split(":")[0]


def v1_tags(e):
    return e.get("tags") or {}


def track_list(e):
    return e.get("tracks") or ["(no track)"]


def listing(e):
    """An event as a list line: title, start, tracks."""
    return f"{code(e['title'])} - {e.get('start') or ''} - {', '.join(track_list(e))}"


def by_title(events):
    return sorted(events, key=lambda e: (e["title"], e.get("start") or "", e["id"]))


def share_label(x):
    return f"{100 * x:.0f}%"


def grid(head, rows, right):
    """tag_census.table, with the columns whose heading is in `right` right-aligned and every other column left: its
    `left` counts leading columns only, and some tables here put text after a number. "- none" where there are no
    rows."""
    if not rows:
        return ["- none", ""]
    lines = table(head, rows, left=len(head))
    lines[1] = "| " + " | ".join("---:" if h in right else "---" for h in head) + " |"
    return lines


def tabled(head, rows, left=1):
    """tag_census.table, or "- none" where there are no rows."""
    return table(head, rows, left=left) if rows else ["- none", ""]


# ---------------------------------------------------------------------------
# Sections. Each returns its lines and leaves what the headline, the observations and the appendices need in `f`.
# ---------------------------------------------------------------------------

def coverage(c, f):
    total = len(c.events)
    per_line = Counter(line["key"] for line in c.lines)
    none, twice = sum(1 for k in c.keys if not per_line[k]), sum(1 for m in per_line.values() if m > 1)
    bare = [e for e in c.events if not e["tags"]["works"] and not any(e["tags"][a] for a in AXES)]
    all_kind, by_kind = Counter(kind(e) for e in c.events), Counter(kind(e) for e in bare)
    all_track = Counter(t for e in c.events for t in track_list(e))
    by_track = Counter(t for e in bare for t in track_list(e))
    f.update(total=total, inputs=len(c.inputs), lines=len(c.lines), bare=len(bare), bare_kind=first(by_kind),
             bare_track=first(by_track), one_line=not none and not twice)
    agree = "which agrees" if c.data.get("count") == total else "which DOES NOT agree"
    if f["one_line"]:
        rule = (f"- Every event has exactly one cache line: the {n(total)} events send {n(len(c.inputs))} distinct "
                f"inputs, and each input's key is on exactly one of the cache's {n(len(c.lines))} lines.")
    else:
        rule = (f"- Every event should have exactly one cache line, and that DOES NOT hold: {n(none)} events' inputs "
                f"have no line, and {n(twice)} keys are on more than one.")
    out = ["## 1. Coverage", "",
           f"- Events: {n(total)}. `count` in the file says {n(c.data.get('count') or 0)}, {agree}.", rule,
           f"- No work, by any via, and no axis value: {n(len(bare))} ({pct(len(bare), total)}).", "",
           "No work and no axis value, by kind:", ""]
    out += tabled(["kind", "events", "of", "share"],
                  [(f"`{k}`", n(m), n(all_kind[k]), pct(m, all_kind[k])) for k, m in ranked(by_kind)])
    out += [f"No work and no axis value, by track (top {TOP_TRACKS}; an event with two tracks counts under both):", ""]
    return out + tabled(["track", "events", "of", "share"],
                        [(t, n(m), n(all_track[t]), pct(m, all_track[t])) for t, m in ranked(by_track)[:TOP_TRACKS]])


def works_section(c, f):
    links = [(i, w["id"], via_of(w)) for i, e in enumerate(c.events) for w in e["tags"]["works"]]
    per_work = Counter(w for e in c.events for w in set(linked(e)))
    alone = Counter(w for e in c.events for w in set(about(e)))
    rolled = Counter()
    for e in c.events:
        hit = set()
        for w in about(e):
            hit |= {w} | v2.ancestors(w, c.parents)
        rolled.update(hit)
    vias = {v: (len({w for _, w, x in links if x == v}), sum(1 for _, _, x in links if x == v),
                len({i for i, _, x in links if x == v})) for v in VIAS}
    f.update(linked_works=len(per_work), links=len(links), vias=vias, singles=sum(1 for m in per_work.values() if m == 1),
             top_work=first(rolled))
    out = ["## 2. Works", "",
           f"- Distinct works linked: {n(len(per_work))}, by {n(len(links))} links. A work linked more than one way "
           "on one event is listed once, under its strongest via: about, then track, then credit (#32).", ""]
    out += table(["via", "works", "links", "events"], [(f"`{v}`", n(w), n(k), n(e)) for v, (w, k, e) in vias.items()])
    out += ["How many works have how many events, by any via:", ""]
    hist = histogram(list(per_work.values()), [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6-20", 6, 20),
                                               ("21+", 21, None)])
    out += table(["events", "works"], [(label, n(k)) for label, k in hist])
    out += [f"### Top {TOP_WORKS}", "",
            "By events rolled up through descendants: an event counts for a work when it links that work, or a work "
            "below it, `about`. \"About it\" counts the work's own `about` links alone.", ""]
    rows = []
    for wid, k in ranked(rolled)[:TOP_WORKS]:
        w = c.works[wid]
        rows.append((code(wid), code(w["name"]), code(w["parent"]) if w.get("parent") else "", n(alone[wid]), n(k),
                     ", ".join(code(a) for a in w.get("aliases") or []),
                     ", ".join(code(t) for t in w.get("terms") or [])))
    out += grid(["id", "name", "parent", "about it", "rolled up", "aliases", "terms"], rows, {"about it", "rolled up"})
    terms = c.stats["terms"]
    out += ["### Registry terms the build dropped", "",
            "A cached work name that is a term on a registry work links nothing: `events_v2.py` drops it and counts "
            "it until a person makes it an alias (#34).", ""]
    out += tabled(["term", "events"], [(code(t), n(k)) for t, k in ranked(terms)])
    return out + everyday(c, per_work) + unreviewed(c, f, per_work)


def everyday(c, per_work):
    titles = [ts.folded(e["title"]) for e in c.events]
    rows = []
    for wid, word, _, _ in pilot().EVERYDAY:
        want = ts.folded(word)
        rows.append((per_work[wid], sum(1 for t in titles if holds(t, want)), wid, word))
    rows.sort(key=lambda r: (-r[0], -r[1], r[2]))
    out = ["### The pilot's everyday words", "",
           f"The {n(len(rows))} works of `tools/tag_pilot.py`'s `EVERYDAY`: registry works whose name, or an alias, "
           "the 2026 text uses in its ordinary sense. The events that link each, by any via, and the event titles "
           "that hold the word, whole words, folded, by the pilot's `word_in`: a count only, because a title that "
           "holds the word is not a link.", ""]
    return out + table(["work", "the word", "events linking it", "titles with the word"],
                       [(code(wid), code(word), n(k), n(t)) for k, t, wid, word in rows], left=2)


def unreviewed(c, f, per_work):
    named = {wid for entry in c.cache.values() for w in entry["answer"]["works"]
             for wid in [c.reg.resolve_work(w["name"])] if wid}
    # Over the works block - the works the year's events link and their ancestors (#38) - never the whole registry:
    # a count across the registry is no fact about one year, and another year's mint would move it (#46).
    block = c.doc["works"]
    ids = sorted(w["id"] for w in block if w.get("reviewed") is not True)
    source = {wid: work_source(wid, c.minted, named) for wid in ids}
    event_works = [set(linked(e)) for e in c.events]
    rows, all_linked = [], set()
    for s in ("drafter", "tagger", "other"):
        mine = [w for w in ids if source[w] == s]
        hit = {w for w in mine if per_work[w]}
        all_linked |= hit
        rows.append((s, len(mine), len(hit), sum(1 for ws in event_works if hit & ws)))
    events = sum(1 for ws in event_works if all_linked & ws)
    f.update(works_total=len(block), unreviewed=len(ids), unreviewed_linked=len(all_linked),
             unreviewed_events=events, sources={s: (k, h, e) for s, k, h, e in rows})
    appendix = []
    for wid in sorted(all_linked, key=lambda w: (-per_work[w], w)):
        w = c.works[wid]
        titles = sorted({e["title"] for e, ws in zip(c.events, event_works) if wid in ws})
        type_of = w["type"] + (f" / {w['family']}" if w.get("family") else "")
        appendix.append((code(wid), code(w["name"]), source[wid], type_of, code(w["parent"]) if w.get("parent") else "",
                         n(per_work[wid]), ", ".join(code(t) for t in titles[:3]) + (" ..." if len(titles) > 3 else "")))
    f["appendix_a"] = grid(["id", "name", "source", "type", "parent", "events", "titles, up to 3"], appendix, {"events"})
    out = ["### Unreviewed works", "",
           f"- {n(len(ids))} of the {n(len(block))} works in the block are `reviewed: false`, and events link "
           f"{n(len(all_linked))} of them, on {n(events)} events. The block is `events.v2.json`'s works: those the "
           "year's events link, and their ancestors (#38).",
           "- By where they came from: the drafter, when the sidecar's `minted` holds the id; the tagger, when a cached "
           "answer names it otherwise - inferred, since a row `tag_stage.py` minted before PR 7a carries no record of "
           "it, and only one minted since carries `minted` (#46); other, neither.", ""]
    out += table(["source", "works", "linked", "on events"],
                 [(s, n(k), n(h), n(e)) for s, k, h, e in rows] + [("all", n(len(ids)), n(len(all_linked)), n(events))])
    return out + [f"Linked by events: {n(len(all_linked))}, listed in Appendix A. Linked by none: "
                  f"{n(len(ids) - len(all_linked))}, counted here and not listed."]


def axes_section(c, f):
    total = len(c.events)
    per_event = Counter(sum(len(e["tags"][a]) for a in AXES) for e in c.events)
    rows, used = [], {}
    for a in AXES:
        counts = Counter(v for e in c.events for v in e["tags"][a])
        used[a] = sum(1 for v in registry.AXES[a] if counts[v])
        rows += [(f"`{a}`", v, n(k), pct(k, total))
                 for v, k in ranked(Counter({v: counts[v] for v in registry.AXES[a]}))]
    out = ["## 3. Axes", "",
           "As built: where a track in `tracks.json` decides an axis, its values are the event's on that axis, and "
           "otherwise the model's are.", "",
           "- Values used: " + "; ".join(f"`{a}` {used[a]} of {len(registry.AXES[a])}" for a in AXES) + ".",
           "- Events by how many axis values they carry, the four axes together: "
           + "; ".join(f"{k}: {n(per_event[k])}" for k in sorted(per_event)) + ".", ""]
    return out + table(["axis", "value", "events", "share of all events"], rows, left=2)


def kinds_section(c, f):
    total = len(c.events)
    counts = Counter(kind(e) for e in c.events)
    types = [t for t, _ in ranked(Counter(e["type"] for e in c.events))]
    cross = Counter((kind(e), e["type"]) for e in c.events)
    tagged = [(a, b) for a, b in zip(c.v1, c.events) if a.get("tags")]
    kept = sum(1 for a, b in tagged if v1_tags(a).get("kind") == kind(b))
    pairs = Counter((v1_tags(a).get("kind") if a.get("tags") else "(untagged)", kind(b))
                    for a, b in zip(c.v1, c.events))
    changed = [(p, k) for p, k in ranked(pairs) if p[0] != p[1]]
    wrestling = by_title(e for e in c.events if WRESTLING.search(f"{e['title']}\n{e.get('description') or ''}"))
    f.update(top_kind=first(counts), v1_tagged=len(tagged), kind_kept=kept, kind_changed=sum(k for _, k in changed),
             kind_pairs=len(changed), top_change=changed[0] if changed else (("(none)", "(none)"), 0),
             wrestling=len(wrestling))
    empty = ", ".join(f"`{k}`" for k in ts.KINDS if not counts[k]) or "none"
    out = ["## 4. Kind", "",
           f"- The largest kind is `{f['top_kind'][0]}` ({n(f['top_kind'][1])}); `other` is on {n(counts['other'])} "
           f"({pct(counts['other'], total)}). Kinds in the list with no events: {empty}.", "",
           "Kind against type:", ""]
    out += table(["kind", "events", "share"] + types,
                 [[f"`{k}`", n(m), pct(m, total)] + [n(cross[(k, t)]) for t in types] for k, m in ranked(counts)])
    untagged = sum(1 for a in c.v1 if not a.get("tags"))
    out += ["### v1 kind to v2 kind", "",
            f"- Of the {n(len(tagged))} events v1 tagged, {n(kept)} keep their kind and {n(len(tagged) - kept)} "
            f"change. Events v1 left untagged, which have a kind now: {n(untagged)}.",
            f"- The pairs that differ: {n(len(changed))}, over {n(sum(k for _, k in changed))} events.", ""]
    out += tabled(["v1 kind", "v2 kind", "events"],
                  [(a if a == "(untagged)" else f"`{a}`", f"`{b}`", n(k)) for (a, b), k in changed], left=2)
    out += [f"### Wrestling: {n(len(wrestling))} - UNSURE", "",
            "Every event whose title or description says wrestl*, with its kind. The kind is the tagger's answer, "
            "given the glosses in `tag_stage.KIND_GLOSSES`; the text match only chooses the rows. Each is a person's "
            "call, and where a kind is wrong the fix is a `\"model\": \"hand\"` line in the cache.", ""]
    rows = []
    for e in wrestling:
        where = " and ".join(part for part, text in (("title", e["title"]), ("description", e.get("description") or ""))
                             if WRESTLING.search(text))
        rows.append(f"- UNSURE: {listing(e)} - `{kind(e)}` - in the {where}")
    return out + (rows or ["- none"])


def audience_section(c, f):
    total = len(c.events)
    dist = Counter(e["tags"]["audience"] for e in c.events)
    columns = ("all", "kids", "mature")
    cross = Counter(("(untagged)" if not a.get("tags") else str(bool(v1_tags(a).get("adult"))).lower(),
                     b["tags"]["audience"]) for a, b in zip(c.v1, c.events))
    sources, differs = Counter(), []
    for i, e in enumerate(c.events):
        answer = c.cache[c.keys[i]]["answer"]
        said = [who for who, yes in (("the parse", e["facets"].get("mature")),
                                      ("the model", answer["audience"] == "mature"),
                                      ("a track", any(t.get("audience") == "mature" for t in c.tracks_of(e)))) if yes]
        if e["tags"]["audience"] == "mature":
            sources[" and ".join(said)] += 1
        for t in c.tracks_of(e):
            if t.get("audience") and t["audience"] != e["tags"]["audience"]:
                age = f" (`min_age` {e['facets']['min_age']})" if "min_age" in e["facets"] else ""
                why = " and ".join(s + (age if s == "the parse" else "") for s in said) or "the build's merge"
                differs.append(f"- {listing(e)} - {t['name']} says `{t['audience']}`, and the event is "
                               f"`{e['tags']['audience']}`: {why}")
    ages = Counter((e["facets"].get("min_age"), e["tags"]["audience"]) for e in c.events)
    order = sorted({a for a, _ in ages if a is not None}) + [None]
    disagree = sum(k for (adult, aud), k in cross.items()
                   if adult in ("true", "false") and (adult == "true") != (aud == "mature"))
    mature_tracks = sorted(t["name"] for t in c.reg.tracks if t.get("audience") == "mature")
    f.update(audience=dist, adult_disagree=disagree, mature_sources=sources)
    out = ["## 5. Audience", ""]
    out += table(["audience", "events", "share"], [(f"`{a}`", n(k), pct(k, total)) for a, k in ranked(dist)])
    out += ["v1 `adult` against v2 `audience`:", ""]
    out += table(["v1 adult"] + [f"`{a}`" for a in columns],
                 [[label] + [n(cross[(label, a)]) for a in columns] for label in ("false", "true", "(untagged)")
                  if any(cross[(label, a)] for a in columns)])
    out += ["### Where each `mature` came from", "",
            "The build makes an event mature where the parse (`facets.mature`), the model or a track says so, and "
            f"nothing takes it away (#32). Tracks whose `audience` is mature: {', '.join(mature_tracks) or 'none'}.", ""]
    out += tabled(["said by", "events"], [(s or "(nobody)", n(k)) for s, k in ranked(sources)])
    out += [f"### Audience against a track: {n(len(differs))}", "",
            "Every event whose audience is not what one of its tracks says, with the reason.", ""]
    out += (differs or ["- none"]) + ["", "### `min_age` against audience", ""]
    return out + table(["min_age"] + [f"`{a}`" for a in columns],
                       [["(none)" if age is None else str(age)] + [n(ages[(age, a)]) for a in columns]
                        for age in order])


def play_section(c, f):
    gaming = [i for i, e in enumerate(c.events) if e["type"] == "gaming" or kind(e) == "gaming"]
    is_gaming = set(gaming)
    by_type = sum(1 for i in gaming if c.events[i]["type"] == "gaming")
    played = [c.events[i]["tags"]["play"] for i in gaming if "play" in c.events[i]["tags"]]
    missing = [c.events[i] for i in gaming if "play" not in c.events[i]["tags"]]
    elsewhere = [e for i, e in enumerate(c.events) if "play" in e["tags"] and i not in is_gaming]
    pairs = Counter((p["format"], p["level"]) for p in played)
    formats = Counter(p["format"] for p in played)
    missing_kind = Counter(kind(e) for e in missing)
    f.update(gaming=len(gaming), played=len(played), no_play=len(missing), play_elsewhere=len(elsewhere),
             no_play_kind=first(missing_kind))
    out = ["## 6. Play", "",
           "A gaming event is one whose scraped type or whose kind is `gaming`, and `play` is kept on those alone "
           "(`events_v2.py`).", "",
           f"- Gaming events: {n(len(gaming))}: {n(by_type)} by type, and {n(len(gaming) - by_type)} more by kind. "
           f"With `play`: {n(len(played))}. Without: {n(len(missing))}.",
           f"- `play` on any other event: {n(len(elsewhere))}."]
    out += [f"  - {listing(e)}" for e in by_title(elsewhere)]
    out += ["", f"Format against level, on the {n(len(played))}:", ""]
    out += table(["format"] + [f"`{lv}`" for lv in ts.PLAY_LEVELS] + ["events"],
                 [[f"`{fm}`"] + [n(pairs[(fm, lv)]) for lv in ts.PLAY_LEVELS] + [n(formats[fm])]
                  for fm, _ in ranked(Counter({fm: formats[fm] for fm in ts.PLAY_FORMATS}))])
    titles = Counter((e["title"], kind(e)) for e in missing)
    out += [f"### Gaming events with no play: {n(len(missing))}", "",
            f"By kind: {counted((f'`{k}`', m) for k, m in ranked(missing_kind)) or 'none'}. By title:", ""]
    return out + tabled(["title", "kind", "events"], [(code(t), f"`{k}`", n(m)) for (t, k), m in ranked(titles)],
                        left=2)


def people_section(c, f):
    total = len(c.events)
    guests = Counter(e["tags"].get("guests", "(absent)") for e in c.events)
    v2_columns = ("celebrity", "creator", "(absent)")
    v1_of = [v1_tags(a).get("guests") if a.get("tags") else "(untagged)" for a in c.v1]
    cross = Counter((g, b["tags"].get("guests", "(absent)")) for g, b in zip(v1_of, c.events))
    lost_badge = by_title(b for g, b in zip(v1_of, c.events) if g == "celebrity" and b["tags"].get("guests") != "celebrity")
    f["appendix_c"] = [f"- {listing(e)} - " + (", ".join(code(p["name"]) for p in e["people"][:MOST_PEOPLE])
                                               + (f", and {n(len(e['people']) - MOST_PEOPLE)} more"
                                                  if len(e["people"]) > MOST_PEOPLE else "") or "no people")
                       for e in lost_badge]

    appearances = [(e, p) for e in c.events for p in e["people"]]
    ids = sorted({p["id"] for _, p in appearances})
    name_of = {}
    for _, p in sorted(appearances, key=lambda ep: (ep[1]["id"], ep[1]["name"])):
        name_of.setdefault(p["id"], p["name"])
    src_ids = {s: len({p["id"] for _, p in appearances if p["src"] == s}) for s in ("speakers", "description")}
    src_apps = Counter(p["src"] for _, p in appearances)
    kinds_of = defaultdict(Counter)
    for e, p in appearances:
        kinds_of[p["id"]][kind(e)] += 1
    on_qps = {pid for pid in ids if any(kinds_of[pid][k] for k in QPS)}
    status = {pid: c.status(pid) for pid in ids}
    overall, qps = Counter(status.values()), Counter(status[pid] for pid in on_qps)
    order = ["never drafted", "drafted", "rejected by model", "rejected by review", "reviewed"]
    order += sorted(s for s in overall if s not in order)

    drafted = [p for p in c.reg.people if p.get("reviewed") is not True]
    credits = [cr for p in drafted for cr in p.get("credits") or []]
    rows = []
    for p in sorted(drafted, key=lambda p: (TIER_ORDER.get(p.get("tier"), len(TIER_ORDER)),
                                            -sum(kinds_of[p["id"]].values()), p["id"])):
        k = kinds_of[p["id"]]
        credit = ", ".join(f"{code(cr['work'])} "
                           f"({'reviewed' if c.works.get(cr['work'], {}).get('reviewed') is True else 'unreviewed'})"
                           for cr in p.get("credits") or [])
        rows.append((code(p["id"]), code(p["name"]), p.get("tier") or "", (c.notes.get(p["id"]) or {}).get("confidence", ""),
                     n(sum(k.values())), n(k["qa"]), n(k["photo"]), n(k["signing"]),
                     n(sum(m for kk, m in k.items() if kk not in QPS)), credit or "none"))

    outside = sorted((pid for pid in on_qps if pid not in c.people),
                     key=lambda pid: (-sum(kinds_of[pid][k] for k in QPS), -sum(kinds_of[pid].values()), name_of[pid], pid))
    unlisted = [(code(name_of[pid]), code(pid), status[pid], n(kinds_of[pid]["qa"]), n(kinds_of[pid]["photo"]),
                 n(kinds_of[pid]["signing"]), n(sum(kinds_of[pid].values()))) for pid in outside]
    head = ["name", "id", "status", "qa", "photo", "signing", "all events"]
    f["appendix_b"] = tabled(head, unlisted, left=3)
    f.update(v2_guests=sum(k for g, k in guests.items() if g != "(absent)"), v1_celebrity=v1_of.count("celebrity"),
             person_ids=len(ids), registered=len(c.reg.people),
             reviewed_people=sum(1 for p in c.reg.people if p.get("reviewed") is True),
             reviewed_credits=sum(1 for p in c.reg.people for cr in p.get("credits") or [] if cr.get("reviewed") is True),
             outside=len(outside), outside_status=Counter(status[pid] for pid in outside))

    out = ["## 7. Guests and people", "", "### `guests`", "",
           "The highest tier among an event's reviewed people, else absent (#32, #34). This report is its baseline.", ""]
    out += table(["guests", "events", "share"], [(g if g == "(absent)" else f"`{g}`", n(k), pct(k, total))
                                                 for g, k in ranked(guests)])
    out += ["### The Celebrity badge", "", "v1 `guests` against v2 `guests`:", ""]
    out += table(["v1 guests"] + [g if g == "(absent)" else f"`{g}`" for g in v2_columns],
                 [[g if g == "(untagged)" else f"`{g}`"] + [n(cross[(g, x)]) for x in v2_columns]
                  for g, _ in ranked(Counter(v1_of))])
    out += [f"The {n(len(lost_badge))} events v1 called `celebrity` that v2 does not are in Appendix C, with up to "
            f"{MOST_PEOPLE} of their people each.", "",
            "### People", "",
            f"- Distinct ids: {n(len(ids))}, over {n(len(appearances))} appearances. An id is the registry's where it "
            "resolves the name, reviewed or not, and otherwise the name's slug (#34).", ""]
    out += table(["src", "ids", "appearances"], [(f"`{s}`", n(src_ids[s]), n(src_apps[s])) for s in ("speakers", "description")])
    out += ["Status, by person: reviewed and drafted are `people.json` entries, `reviewed` true and false; rejected is "
            "the sidecar's `rejected`, by the drafter's model or by review; never drafted is everyone else.", ""]
    out += table(["status", "people", "on qa, photo or signing events"],
                 [(s, n(overall[s]), n(qps[s])) for s in order] + [("all", n(len(ids)), n(len(on_qps)))])
    out += [f"### Drafted people: {n(len(drafted))}", "",
            "Every `people.json` entry with `reviewed: false`: celebrities first, then by events, then by id. "
            "Confidence is the drafter's, from the sidecar. Each credit shows its work's own reviewed state; "
            f"{n(sum(1 for cr in credits if cr.get('reviewed') is True))} of the {n(len(credits))} credits are "
            "reviewed themselves.", ""]
    out += grid(["id", "name", "tier", "confidence", "events", "qa", "photo", "signing", "other", "credits"], rows,
                {"events", "qa", "photo", "signing", "other"})
    out += [f"### Not in `people.json`, on qa, photo or signing events: {n(len(outside))}", "",
            f"The top {TOP_PEOPLE} by those events; all {n(len(outside))} are in Appendix B.", ""]
    return out + tabled(head, unlisted[:TOP_PEOPLE], left=3)


def tracks_section(c, f):
    by_track = defaultdict(list)
    for e in c.events:
        for t in e.get("tracks") or []:
            by_track[t].append(e)
    rows, unsure = [], []
    for name, evs in sorted(by_track.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        entry = c.track_of[name]
        cells = []
        for a in AXES:
            value, k = first(Counter(v for e in evs for v in e["tags"][a]))
            decided = a in (entry.get("axes") or {})
            cells.append(f"{value} {pct(k, len(evs))}" + (" (tracks.json)" if decided else "") if k else "-")
            if k and not decided and k / len(evs) >= ONE_VALUE:
                unsure.append((name, len(evs), a, value, k))
        by_it = sum(1 for e in evs for w in e["tags"]["works"] if w["via"] == "track" and w["id"] == entry.get("work"))
        rows.append([name, n(len(evs))] + cells + [f"{n(by_it)} (`{entry['work']}`)" if entry.get("work") else ""])
    f["one_value"] = len(unsure)
    out = ["## 8. Tracks", "",
           "Per track: its events; on each axis, the value on the most of them and its share of all of them, a tie "
           "going to the first value alphabetically, and \"(tracks.json)\" where `tracks.json` decides that axis; and "
           "the `via: track` links its work makes. An event with two tracks counts under both.", ""]
    out += grid(["track", "events"] + [f"`{a}`" for a in AXES] + ["`via: track`"], rows, {"events"})
    out += [f"### One value on {share_label(ONE_VALUE)} or more, on an axis `tracks.json` does not decide: "
            f"{n(len(unsure))} - UNSURE", ""]
    return out + ([f"- UNSURE: {name} - `{a}`: {value}, on {n(k)} of its {n(k_all)} events ({pct(k, k_all)})"
                   for name, k_all, a, value, k in unsure] or ["- none"])


def show_value(field, value):
    if field == "play":
        return f"{value['format']} / {value['level']}" if value else "none"
    if isinstance(value, list):
        return ", ".join(value) or "none"
    return str(value)


def recurring_section(c, f):
    per_line = Counter(line["key"] for line in c.lines)
    unused = sorted(set(per_line) - set(c.keys))
    models = Counter(line["model"] for line in c.lines)
    hand = sorted(line["title"] for line in c.lines if line["model"] == "hand")
    groups = defaultdict(list)
    for i, e in enumerate(c.events):
        if e["facets"].get("repeat_key"):
            groups[e["facets"]["repeat_key"]].append(i)
    several = {rk: idx for rk, idx in groups.items() if len({c.keys[i] for i in idx}) > 1}
    fields, diffs = Counter(), {}
    for rk, idx in several.items():
        fields.update(varied([c.inputs[k] for k in sorted({c.keys[i] for i in idx})]))
        diffs[rk] = differing([c.events[i]["tags"] for i in idx])
    built_counts = Counter(x for d in diffs.values() for x in d)
    listed = [rk for rk in sorted(diffs) if diffs[rk]]
    f.update(hand=len(hand), repeat_groups=len(groups), several=len(several), built_differ=len(listed))
    out = ["## 9. Recurring", "", "### The cache", "",
           f"- Events: {n(len(c.events))}. Distinct inputs: {n(len(c.inputs))}. Cache lines: {n(len(c.lines))}. "
           f"Lines no event uses: {n(len(unused))}.",
           f"- The model on each line: {counted((code(m), k) for m, k in ranked(models)) or 'none'}.",
           f"- Lines corrected by hand, `\"model\": \"hand\"`: {n(len(hand))}. DECISIONS #34 has an overrides file "
           f"designed here once they pass a handful; at {n(len(hand))}, nothing is designed."]
    out += [f"  - {code(t)}" for t in hand]
    out += ["", "### One title, more than one input", "",
            f"- `repeat_key` groups: {n(len(groups))}, over {n(sum(len(v) for v in groups.values()))} events. "
            "Groups whose occurrences "
            f"sent the tagger more than one distinct input: {n(len(several))}.", "",
            "Which field of the input varied, by groups; a group counts under each field that varied:", ""]
    out += table(["field", "groups"], [(f"`{x}`", n(fields[x])) for x in INPUT_FIELDS])
    out += ["Which built tags differ, by groups: kind, the `about` works, each axis, audience and play. Credits and "
            "guests are left out, because they change with who is on stage.", ""]
    out += table(["field", "groups"], [(f"`{x}`", n(built_counts[x])) for x in BUILT_FIELDS])
    out += [f"### The groups whose built tags differ: {n(len(listed))}", "",
            "Each with the title its occurrences use most, the fields of the input that varied, and every built field "
            "that differs, with its values and how many occurrences carry each.", ""]
    for rk in listed:
        idx = groups[rk]
        title = ranked(Counter(c.events[i]["title"] for i in idx))[0][0]
        rows = [built(c.events[i]["tags"]) for i in idx]
        parts = [f"`{x}` " + ", ".join(f"{v} ({n(k)})" for v, k in ranked(Counter(show_value(x, r[x]) for r in rows)))
                 for x in diffs[rk]]
        keys = sorted({c.keys[i] for i in idx})
        out.append(f"- {code(title)} - {n(len(idx))} events, {n(len(keys))} inputs, which differ in "
                   f"{', '.join(f'`{x}`' for x in varied([c.inputs[k] for k in keys]))} - " + "; ".join(parts))
    return out + ([] if listed else ["- none"])


def links_section(c, f):
    rows = []
    for k in sorted(c.inputs, key=lambda k: (c.inputs[k]["title"], k)):
        e = c.events[c.first[k]]
        evidence = {}
        for w in c.cache[k]["answer"]["works"]:
            wid = c.reg.resolve_work(w["name"])
            if wid and wid not in evidence:
                evidence[wid] = w["evidence"]
        links = [(wid, evidence[wid]) for wid in about(e) if wid in evidence]
        rows += [(k, c.inputs[k]["title"], c.per_key[k], wid, ev, why, ctx)
                 for wid, ev, why, ctx in resume_flags(c.inputs[k], links, c.names)]
    flagged = {r[0]: r[2] for r in rows}
    known = sorted(k for k in c.inputs if c.inputs[k]["title"] == KNOWN_CASE)
    if not known:
        known_line = f"- {code(KNOWN_CASE)}, the known case: no input is titled so."
    else:
        named = sorted({w["name"] for k in known for w in c.cache[k]["answer"]["works"]})
        among = any(k in flagged for k in known)
        known_line = (f"- {code(KNOWN_CASE)}, the known case, is {'among them' if among else 'not among them'}: its "
                      f"cached answer names {', '.join(code(x) for x in named) if named else 'no work'}.")

    music = [e for e in c.events if "music" in e["tags"]["medium"]]
    band_rows = []
    for wid in sorted({w for e in music for w in about(e)}):
        kinds = Counter(kind(e) for e in c.events if wid in about(e))
        band_rows.append((sum(1 for e in music if wid in about(e)), sum(kinds.values()), wid, kinds))
    band_rows.sort(key=lambda r: (-r[0], -r[1], r[2]))
    bare = by_title(e for e in music if kind(e) == "performance" and not about(e))
    # Every work's name and aliases, whether an event links it or not - the list is for a work no event links - but
    # not a work minted in a later year. The tag stage's mint in another season is the one writer that touches
    # works.json with no person re-rendering this report in the same PR, so the report must not move with it (#46).
    names = [(name, ts.folded(name)) for name in band_names(c.reg.works, YEAR)]
    marked = [(e, [name for name, folded in names if holds(ts.folded(e["title"]), folded)]) for e in bare]
    f.update(resume=len(rows), resume_inputs=len(flagged), band_bare=len(bare),
             band_marked=sum(1 for _, hits in marked if hits))
    out = ["## 10. Links to check - UNSURE", "",
           "`about` links a person may want to look at. Nothing here finds that a link is wrong: every row below that "
           "says UNSURE is a person's call, and where a link is wrong the fix is a person's, a `\"model\": \"hand\"` "
           "line in `tags.cache.jsonl` (#34). Track and credit links are not asked about here.", "",
           f"### Resume mentions: {n(len(rows))}", "",
           "The model's own `about` links, as built, each with the evidence it gave. A link is a candidate when its "
           "evidence is in the description the model was sent and not in the title, and the title does not hold the "
           "work's name or an alias, whole words, folded, by the pilot's `word_in` - a match that only chooses rows. "
           "A candidate is listed when it shares its input with another candidate, or when one of these ends within "
           f"{CUE_REACH} characters before its evidence: {', '.join(CUES)}. One row a link, with the events that sent "
           f"its input and about {2 * CONTEXT} characters of the description around the evidence.", "", known_line]
    out += [f"- UNSURE: {code(title)} ({n(m)} {'event' if m == 1 else 'events'}) - {code(wid)}, evidence {code(ev)} - "
            f"{', '.join(why)} - {code(ctx)}" for _, title, m, wid, ev, why, ctx in rows] or ["- none"]
    out += ["", f"### Bands (a): works linked from music events: {n(len(band_rows))}", "",
            "Every work an event with `medium: music` links `about`: how many of those events link it, and every "
            "event that links it `about`, by kind.", ""]
    out += grid(["work", "music events", "its `about` events, by kind"],
                [(code(wid), n(m), counted((f"`{k}`", x) for k, x in ranked(kinds))) for m, _, wid, kinds in band_rows],
                {"music events"})
    out += [f"### Bands (b): music performances with no work: {n(len(bare))}", "",
            "Every `performance` event with `medium: music` and no `about` work. A row is marked UNSURE where its title "
            "holds a registry work's name or alias, whole words, folded: the only list that matches work names, and it "
            "reads titles only.", ""]
    for e, hits in marked:
        where = (" - the title holds " + ", ".join(f"{code(h)} ({code(c.reg.resolve_work(h))})" for h in hits)) if hits else ""
        out.append(f"- {'UNSURE: ' if hits else ''}{listing(e)}{where}")
    return out + ([] if bare else ["- none"])


def against_v1(c, f):
    classes, unresolved, left = Counter(), Counter(), 0
    lost_by_fandom, lost_kind = defaultdict(Counter), Counter()
    for a, b in zip(c.v1, c.events):
        held = set(linked(b))
        for name in v1_tags(a).get("fandoms") or []:
            if name in AXIS_FANDOMS:
                left += 1
                continue
            fid = c.reg.resolve_work(name)
            if not fid:
                unresolved[name] += 1
                continue
            cls = fandom_class(fid, held, c.parents)
            classes[cls] += 1
            if cls == "lost":
                lost_by_fandom[name][b["title"]] += 1
                lost_kind[kind(b)] += 1
    compared = sum(classes.values())
    no_fandom = Counter(kind(b) for a, b in zip(c.v1, c.events) if not v1_tags(a).get("fandoms") for _ in about(b))
    f.update(compared=compared, classes=classes,
             lost_top=first(Counter({k: sum(v.values()) for k, v in lost_by_fandom.items()})))
    out = ["## 11. v1 against v2", "",
           "Each of v1's fandom assignments, resolved through `works.json`, against the event's v2 works of any via, "
           "walking parents: the same work; more specific, where v2 names a descendant; less specific, where v2 names "
           "an ancestor; or lost. Left out: the five fandom names that are axis values in v2 - "
           + ", ".join(f"{name} ({home})" for name, home in sorted(AXIS_FANDOMS.items()))
           + f". Their assignments: {n(left)}. v1 names no work resolves: {n(sum(unresolved.values()))}"
           + (f" ({counted(ranked(unresolved))})" if unresolved else "") + ".", ""]
    out += tabled(["class", "assignments", "share"], [(k, n(m), pct(m, compared)) for k, m in ranked(classes)])
    out += ["The lost, by the event's v2 kind:", ""]
    out += tabled(["kind", "assignments"], [(f"`{k}`", n(m)) for k, m in ranked(lost_kind)])
    out += [f"v2 `about` links on the events v1 gave no fandom: {n(sum(no_fandom.values()))}. By kind:", ""]
    out += tabled(["kind", "links"], [(f"`{k}`", n(m)) for k, m in ranked(no_fandom)])
    out += [f"### Lost, by fandom: {n(classes['lost'])}", "", f"Fandoms: {n(len(lost_by_fandom))}.", ""]
    for name, titles in sorted(lost_by_fandom.items(), key=lambda kv: (-sum(kv[1].values()), kv[0])):
        out += [f"**{name}** ({n(sum(titles.values()))})", ""]
        out += [f"- {code(t)}" + (f" ({n(k)})" if k > 1 else "") for t, k in ranked(titles)] + [""]
    return out


def all_strings(x):
    """Every string in a JSON value, its keys too."""
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for k, value in x.items():
            yield k
            yield from all_strings(value)
    elif isinstance(x, list):
        for value in x:
            yield from all_strings(value)


def text_section(c, f):
    mangled = by_title(e for e in c.events if dp.looks_double_encoded(e["title"])
                       or dp.looks_double_encoded(e.get("description") or ""))
    cached_names = sorted({w["name"] for line in c.lines for w in line["answer"]["works"]})
    cached_evidence = sorted({w["evidence"] for line in c.lines for w in line["answer"]["works"]})
    # The block's work names and aliases (#38), not the registry's: another year's mint must leave the report as it is.
    block_names = sorted({w["name"] for w in c.doc["works"]})
    model = [("work names", block_names, " in the block"), ("cached work names", cached_names, ""),
             ("cached evidence", cached_evidence, "")]
    model_hits = [s for _, strings, _ in model for s in strings if dp.looks_double_encoded(s)]
    places = [("titles", sorted({e["title"] for e in c.events})),
              ("descriptions", sorted({e.get("description") or "" for e in c.events})),
              ("people's names on events", sorted({p["name"] for e in c.events for p in e["people"]})),
              ("`people.json` names and aliases",
               sorted({x for p in c.reg.people for x in [p["name"]] + list(p.get("aliases") or [])})),
              ("work names and aliases in the block",
               sorted({x for w in c.doc["works"] for x in [w["name"]] + list(w.get("aliases") or [])})),
              ("cached work names", cached_names), ("cached evidence", cached_evidence),
              ("the sidecar's strings", sorted(set(all_strings(c.sidecar))))]
    found = []
    for place, strings in places:
        for label, ch in ODD.items():
            if place == "descriptions":
                found += [(label, f"the description of {code(e['title'])}")
                          for e in by_title(e for e in c.events if ch in (e.get("description") or ""))]
            else:
                found += [(label, f"{place}: {code(s)}") for s in strings if ch in s]
    over = sum(1 for e in c.v1 if ts.over_cap(e))
    by_track = Counter(t for e in mangled for t in track_list(e))
    f.update(mangled=len(mangled), model_mangled=len(model_hits), over_cap=over,
             odd={label: sum(1 for _, strings in places for s in strings if ch in s) for label, ch in ODD.items()})
    out = ["## 12. Text", "",
           f"### Double-encoded events: {n(len(mangled))}", "",
           "Text that was UTF-8 read as cp1252 before it reached the frozen file, by `draft_people.looks_double_encoded` "
           "over title and description (ROADMAP, Pipeline shape). `events.v2.json` copies the scraped fields as they "
           "are. By track:", ""]
    out += tabled(["track", "events"], [(t, n(k)) for t, k in ranked(by_track)])
    out += [f"- {listing(e)}" for e in mangled] or ["- none"]
    out += ["", "### What the model returned", "",
            "Strings the model wrote that look double-encoded, as a transport that decoded its reply wrongly would "
            "leave them: " + "; ".join(f"{label} {n(sum(1 for s in strings if dp.looks_double_encoded(s)))} of "
                                       f"{n(len(strings))}{where}" for label, strings, where in model) + "."]
    out += [f"  - {code(s)}" for s in model_hits]
    out += ["", "### Two characters", "",
            "U+2018 is a left single quote, which `parse_stage.fold` does not fold and `tag_stage.folded` does. U+FFFD "
            "is the replacement character, which a decoder leaves where it met bytes it could not read. Each place's "
            "distinct strings:", ""]
    out += table(["where", "strings"] + list(ODD),
                 [(place, n(len(strings))) + tuple(n(sum(1 for s in strings if ch in s)) for ch in ODD.values())
                  for place, strings in places])
    out += [f"- {label} in {where}" for label, where in found] or ["- none"]
    return out + ["", "### Descriptions over the cap", "",
                  f"- Events whose description, without its panelist line, runs past the {n(tag_key.DESCRIPTION_CAP)} "
                  f"characters the tagger is sent: {n(over)}."]


# ---------------------------------------------------------------------------
# The headline and the observations are drawn from the sections, so no number in them is typed by hand.
# ---------------------------------------------------------------------------

def headline(f):
    total, via, aud, classes, src = f["total"], f["vias"], f["audience"], f["classes"], f["sources"]
    one = (f"Every event has exactly one cache line: {n(f['lines'])} lines for {n(f['inputs'])} distinct inputs."
           if f["one_line"] else f"Every event should have exactly one cache line, and that DOES NOT hold: "
                                 f"{n(f['lines'])} lines for {n(f['inputs'])} distinct inputs.")
    return ["## 0. Headline", "",
            f"1. Events: {n(total)} in `events.v2.json`, a fresh build. {one}",
            f"2. Works linked: {n(f['linked_works'])}, by {n(f['links'])} links - `about` {n(via['about'][1])} on "
            f"{n(via['about'][2])} events, `track` {n(via['track'][1])}, `credit` {n(via['credit'][1])}. Events with "
            f"no work and no axis value: {n(f['bare'])} ({pct(f['bare'], total)}).",
            f"3. Unreviewed works: {n(f['unreviewed'])} of {n(f['works_total'])} in the block - the drafter's "
            f"{n(src['drafter'][0])}, the tagger's {n(src['tagger'][0])}, other {n(src['other'][0])}. Linked by "
            f"events: {n(f['unreviewed_linked'])}, on {n(f['unreviewed_events'])} events (Appendix A).",
            f"4. Kind: of the {n(f['v1_tagged'])} events v1 tagged, {n(f['kind_kept'])} keep their kind; the pairs "
            f"that differ: {n(f['kind_pairs'])}, over {n(f['kind_changed'])} events. The largest kind: "
            f"`{f['top_kind'][0]}` ({n(f['top_kind'][1])}). Events that say wrestl*: {n(f['wrestling'])}, each UNSURE.",
            f"5. Audience: `all` {n(aud['all'])}, `mature` {n(aud['mature'])}, `kids` {n(aud['kids'])}. Events where "
            f"v1's `adult` and v2's `mature` disagree: {n(f['adult_disagree'])}.",
            f"6. Play: on {n(f['played'])} of {n(f['gaming'])} gaming events; on other events: {n(f['play_elsewhere'])}.",
            f"7. Guests: on {n(f['v2_guests'])} events; v1 called {n(f['v1_celebrity'])} `celebrity`. People: "
            f"{n(f['person_ids'])} ids; `people.json` holds {n(f['registered'])}, reviewed {n(f['reviewed_people'])}. "
            f"On qa, photo and signing events and not in `people.json`: {n(f['outside'])} (Appendix B).",
            f"8. Tracks: track and axis pairs where one value is on {share_label(ONE_VALUE)} or more of the track's "
            f"events and `tracks.json` does not decide: {n(f['one_value'])} (UNSURE).",
            f"9. Recurring: repeat groups that sent more than one input: {n(f['several'])} of {n(f['repeat_groups'])}; "
            f"of those, building different tags: {n(f['built_differ'])}. Hand lines in the cache: {n(f['hand'])}.",
            f"10. Links to check (UNSURE): resume mentions: {n(f['resume'])}, on {n(f['resume_inputs'])} inputs. Music "
            f"performances with no work: {n(f['band_bare'])}; with a registry work's name in the title: "
            f"{n(f['band_marked'])}.",
            f"11. v1 fandoms: {n(f['compared'])} assignments compared - same {n(classes['same'])}, more specific "
            f"{n(classes['more specific'])}, less specific {n(classes['less specific'])}, lost {n(classes['lost'])}.",
            f"12. Text: double-encoded events: {n(f['mangled'])}; model strings that look double-encoded: "
            f"{n(f['model_mangled'])}. Strings holding U+2018: {n(f['odd']['U+2018'])}; U+FFFD: "
            f"{n(f['odd']['U+FFFD'])}. Descriptions over the cap: {n(f['over_cap'])}."]


def observations(f):
    src, aud, ms, classes = f["sources"], f["audience"], f["mature_sources"], f["classes"]
    return ["## 13. Observations", "", "Facts from the sections above; at most ten.", "",
            f"- Events with no work and no axis value: {n(f['bare'])} ({pct(f['bare'], f['total'])}); the kind with "
            f"the most of them is `{f['bare_kind'][0]}` ({n(f['bare_kind'][1])}), and the track {f['bare_track'][0]} "
            f"({n(f['bare_track'][1])}).",
            f"- Works linked by one event: {n(f['singles'])} of the {n(f['linked_works'])} linked; the most, rolled up "
            f"through descendants, is `{f['top_work'][0]}` ({n(f['top_work'][1])}).",
            f"- Unreviewed works that events link: {n(f['unreviewed_linked'])}, on {n(f['unreviewed_events'])} "
            f"events - the drafter's {n(src['drafter'][1])} and the tagger's {n(src['tagger'][1])}.",
            f"- Events whose kind changed from v1: {n(f['kind_changed'])}; the largest change is "
            f"`{f['top_change'][0][0]}` to `{f['top_change'][0][1]}` ({n(f['top_change'][1])}).",
            f"- `mature` events: {n(aud['mature'])}; made mature by the model alone {n(ms['the model'])}, by the parse "
            f"alone {n(ms['the parse'])}.",
            f"- Gaming events with no `play`: {n(f['no_play'])} of {n(f['gaming'])}; the kind with the most of them is "
            f"`{f['no_play_kind'][0]}` ({n(f['no_play_kind'][1])}).",
            f"- Events with `guests`: {n(f['v2_guests'])}. Reviewed people in `people.json`: {n(f['reviewed_people'])}; "
            f"reviewed credits: {n(f['reviewed_credits'])}. Events v1 called `celebrity`: {n(f['v1_celebrity'])}.",
            f"- People on qa, photo and signing events who are not in `people.json`: {n(f['outside'])} - "
            f"{counted(ranked(f['outside_status'])) or 'none'}.",
            f"- Repeat groups that sent more than one input: {n(f['several'])} of {n(f['repeat_groups'])}; of those, "
            f"building different tags: {n(f['built_differ'])}.",
            f"- v1 fandom assignments lost in v2: {n(classes['lost'])} of {n(f['compared'])}; the fandom with the most "
            f"is {f['lost_top'][0]} ({n(f['lost_top'][1])})."]


def render(c, sources=None):
    """The report as text: LF, one newline at the end. `sources` names the inputs in the header; by default, the
    paths as the defaults spell them."""
    s = sources or {"events": EVENTS, "v2": EVENTS_V2, "cache": CACHE, "registry": registry.DIR, "sidecar": SIDECAR,
                    "venues": VENUES, "season": SEASON}
    s = {k: shown(v) for k, v in s.items()}
    facts, body = {}, []
    for section in (coverage, works_section, axes_section, kinds_section, audience_section, play_section,
                    people_section, tracks_section, recurring_section, links_section, against_v1, text_section):
        body += section(c, facts) + [""]
    head = ["# Tag census v2 - the 2026 schedule", "",
            f"Written by `census_v2.py` from `{s['v2']}` (`generated_at` {c.doc.get('generated_at')}, source "
            f"{c.doc.get('source')}), which it first builds afresh from `{s['events']}`, `{s['season']}`, "
            f"`{s['registry'].rstrip('/')}/`, `{s['venues']}` and `{s['cache']}`, and stops unless the two are "
            f"the same; beside them, the drafter's sidecar, `{s['sidecar']}`. Do not edit it by hand; run the script "
            f"again. CI fails when it is stale (DECISIONS #35).",
            "",
            "It states facts and recommends nothing. `UNSURE` marks a candidate that needs a person's judgment, and "
            "nothing here resolves one. Lists run by count, descending, then by name; a list with no counts runs by "
            "name. Event titles and the names of works and people are in code spans, so that their punctuation shows "
            "as written.", "",
            "It asks the questions of `census-2026.md` of the v2 file where they survive. Not asked again: v1's "
            f"section 8, descriptions, since the tagger is now sent {n(tag_key.DESCRIPTION_CAP)} characters and "
            "section 12 counts the descriptions past them; and v1's section 9, facets in titles, which the parse "
            "stage reads (`parse-2026.md`).", "",
            "It never links: only the tagger links an event to a work (#34). Where a list here comes of matching text, "
            "every row is UNSURE, and the fix it names is a person's: a `\"model\": \"hand\"` line in the cache.", ""]
    tail = ["## Appendix A. Unreviewed works that events link", ""] + facts["appendix_a"]
    tail += ["## Appendix B. People on qa, photo and signing events who are not in `people.json`", ""] + facts["appendix_b"]
    tail += ["## Appendix C. Events v1 called `celebrity` that v2 does not", ""] + facts["appendix_c"]
    text = "\n".join(head + headline(facts) + [""] + body + observations(facts) + [""] + tail)
    return re.sub(r"\n{3,}", "\n\n", text).rstrip("\n") + "\n"


def under(path, directory):
    try:
        path, directory = os.path.normcase(os.path.realpath(path)), os.path.normcase(os.path.realpath(directory))
        return os.path.commonpath([path, directory]) == directory
    except ValueError:   # two drives
        return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--events", default=EVENTS, help="the frozen schedule, for v1's tags")
    ap.add_argument("--v2", default=EVENTS_V2, help="events.v2.json, which must be what the inputs build today")
    ap.add_argument("--cache", default=CACHE)
    ap.add_argument("--registry", default=registry.DIR, help="the directory of works.json, people.json and tracks.json")
    ap.add_argument("--sidecar", default=SIDECAR)
    ap.add_argument("--venues", default=VENUES, help="the venues file the build reads")
    ap.add_argument("--season", default=SEASON, help="the season file, whose prompt_version the cache's keys hold")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--check", action="store_true", help="exit 1 if --out is not a fresh render; write nothing")
    args = ap.parse_args(argv)
    if not args.check and under(args.out, DATA):
        print("census_v2.py writes nothing under data/ (DECISIONS #13, #33)", file=sys.stderr)
        return 1
    try:
        census = load(args.events, args.v2, args.cache, args.registry, args.sidecar, args.venues, args.season)
    except (Stale, v2.BuildError, SeasonError) as exc:
        print(exc, file=sys.stderr)
        return 1
    body = render(census, {"events": args.events, "v2": args.v2, "cache": args.cache, "registry": args.registry,
                           "sidecar": args.sidecar, "venues": args.venues, "season": args.season}).encode("utf-8")
    if args.check:
        try:
            with open(args.out, "rb") as f:
                on_disk = f.read()
        except OSError:
            on_disk = None
        if on_disk != body:
            print(f"{shown(args.out)} is not a fresh render: run `python census_v2.py`", file=sys.stderr)
            return 1
        print(f"{shown(args.out)} is a fresh render ({len(body):,} bytes)", file=sys.stderr)
        return 0
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(body)
    lines = body.count(b"\n")
    print(f"{shown(args.out)}: {len(census.events):,} events, {lines:,} lines, {len(body):,} bytes", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
