#!/usr/bin/env python3
"""The seeded registries, written to docs/discover/registry-2026.md for review.

PR 3a of the Discover sequence (DECISIONS #31, `docs/discover/schema-v2.md`). Every work is
`reviewed: false` until a person says otherwise, and this is what that person reads: the works and
tracks as seeded, where every phrase of `tag_events.CANON` and `src/search.js`'s `SYNONYMS` went,
what was left out, and what needs a judgment.

    python registry_report.py                     # -> docs/discover/registry-2026.md
    python registry_report.py --file F --out O

Deterministic: every list is sorted, no set is iterated unsorted, and the only timestamp is
events.json's own generated_at. Two runs, no diff. It reads the registries, `events.json`,
`tag_events.py` and `src/search.js`, and writes one file. Report code stays out of `registry.py`.
"""

import argparse
import json
import os
import re
from collections import Counter, defaultdict

import registry
from tag_census import code, counted, n, ranked, table
from tag_events import CANON

EVENTS = os.path.join("data", "2026", "events.json")
SEARCH = os.path.join("src", "search.js")
OUT = os.path.join("docs", "discover", "registry-2026.md")

# The five fandom names the census flags as a category rather than a property (section 2). In v2
# each is an axis value, so none of them is a work.
LEFT_OUT = {"Anime": "medium: anime", "Video Games": "medium: video-games", "Comics": "medium: comics",
            "Animation": "medium: animation", "Fantasy": "genre: fantasy"}

# A phrase that is not a work and has a v2 home: an axis value, a facet, a kind, or a track.
ELSEWHERE = {
    "ttrpg": "medium: tabletop", "tabletop rpg": "medium: tabletop", "role-playing": "medium: tabletop",
    "roleplaying": "medium: tabletop", "board game": "medium: tabletop", "boardgame": "medium: tabletop",
    "tabletop": "medium: tabletop", "card game": "medium: tabletop", "deck-building": "medium: tabletop",
    "miniatures": "medium: tabletop, and the game family `miniatures`",
    "minis": "medium: tabletop, and the game family `miniatures`",
    "wargame": "medium: tabletop, and the game family `miniatures`",
    "wargaming": "medium: tabletop, and the game family `miniatures`",
    "anime": "medium: anime", "manga": "medium: anime", "shonen": "medium: anime", "otaku": "medium: anime",
    "video game": "medium: video-games", "video games": "medium: video-games",
    "videogame": "medium: video-games", "videogames": "medium: video-games", "esports": "medium: video-games",
    "arcade": "medium: video-games", "console": "medium: video-games", "gamer": "medium: video-games",
    "playstation": "medium: video-games", "xbox": "medium: video-games", "steam": "medium: video-games",
    "comics": "medium: comics", "comic book": "medium: comics", "comic books": "medium: comics",
    "graphic novel": "medium: comics",
    "music": "medium: music", "band": "medium: music", "live music": "medium: music",
    "dj": "medium: music, and a role the schedule writes in `speakers`",
    "musicians": "medium: music", "classical music": "medium: music", "folk music": "medium: music",
    "podcast": "medium: podcast-web", "podcasting": "medium: podcast-web", "podcasters": "medium: podcast-web",
    "fantasy": "genre: fantasy", "epic fantasy": "genre: fantasy",
    "scary": "genre: horror", "slasher": "genre: horror", "zombie": "genre: horror",
    "zombies": "genre: horror", "haunted": "genre: horror",
    "writing": "craft: writing", "writers": "craft: writing", "writer": "craft: writing",
    "author": "craft: writing", "authors": "craft: writing", "novel": "craft: writing",
    "publishing": "craft: writing", "manuscript": "craft: writing", "worldbuilding": "craft: writing",
    "cosplay": "craft: costuming", "costume": "craft: costuming", "costumer": "craft: costuming",
    "masquerade": "craft: costuming",
    "puppet": "craft: puppetry", "puppets": "craft: puppetry", "puppet slam": "craft: puppetry",
    "nasa": "subject: space", "astronomy": "subject: space", "astronaut": "subject: space",
    "rocket": "subject: space", "planetary": "subject: space", "spaceflight": "subject: space",
    "jpl": "subject: space", "telescope": "subject: space", "exoplanet": "subject: space",
    "orbit": "subject: space", "mars": "subject: space", "moon landing": "subject: space",
    "physics": "subject: science", "biology": "subject: science", "chemistry": "subject: science",
    "stem": "subject: science", "scientist": "subject: science",
    "kids": "audience: kids", "children": "audience: kids", "family": "audience: kids",
    "all ages": "audience: kids", "young": "audience: kids",
    "burlesque": "the `mature` facet and audience: mature", "18+": "the `min_age` facet",
    "adults only": "the `mature` facet", "after dark": "the `mature` facet",
    "late night": "the `mature` facet", "adult": "the `mature` facet",
    "signing": "the kind `signing`", "autograph": "the kind `signing`", "autographs": "the kind `signing`",
    "photo op": "the kind `photo`", "photo session": "the kind `photo`", "photos with": "the kind `photo`",
    "concert": "the kind `performance`", "dance party": "the kind `party`", "rave": "the kind `party`",
    "contest": "the kind `contest`", "competition": "the kind `contest`",
    "championship": "the kind `contest`", "tournament": "play.format: tournament",
}

# A phrase the registries have no home for. It is not wrong and it is not dropped: it stays in
# `src/search.js`, which is where it came from and where it still earns its place. The counts
# beside these are 2026 events whose title or description says the word (`MENTIONS`).
SEARCH_ONLY = {
    "symphony": "an ensemble, not a work",
    "orchestra": "an ensemble, not a work",
    "philharmonic": "an ensemble, not a work",
    "wrestling": "no axis has a value for it", "wrestlers": "no axis has a value for it",
    "wrestle": "no axis has a value for it",
    "karaoke": "an activity no axis names", "sing-along": "an activity no axis names",
    "singalong": "an activity no axis names", "sing along": "an activity no axis names",
    "dance": "an activity no axis names", "dancing": "an activity no axis names",
    "ball": "an activity no axis names, and too common a word to be a term",
    "romance": "no romance value on any of the four axes",
    "romantasy": "no romance value on any of the four axes",
    "paranormal romance": "`subject: paranormal` is about the paranormal, not the genre of romance",
}

# A phrase that is wrong - one that would send a reader somewhere the schedule does not go.
# There are none: every phrase in CANON and SYNONYMS is either a work, a v2 value, or vocabulary
# worth keeping.
DROPPED = {}

# What the schedule says, for the vocabulary the axes have no home for: 2026 events whose title or
# description holds the word. The axis lists are schema-v2.md's and this report does not change them.
MENTIONS = [
    ("romance, romantasy", r"\bromance\b|\bromantasy\b"),
    ("wrestling", r"\bwrestl\w*\b"),
    ("karaoke, sing-along", r"\bkaraoke\b|\bsing[\s-]?alongs?\b"),
    ("dance, dancing", r"\bdanc\w*\b"),
]

# A v1 topic's v2 home, from schema-v2.md's "From TOPICS to v2" table. `Kids` goes to `audience`,
# which is not an axis, and `Gaming` has no single home: it is the medium the track plays in.
TOPIC_V2 = {
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
VIDEO_TRACKS = ("Video Gaming", "Artemis Spaceship Bridge Simulator")
AXIS_SHARE = 0.8
# Where the rule offers a value and the seed declines it: the track is the facet, and an axis
# would say less than its own name already does.
DECLINED = {"group-cosplay-photoshoot": "186 cosplay meetups are not \"the craft of photography\"",
            "live-action-roleplaying-games": "a LARP is not played at a table"}

# What a person has to settle. Nothing here is guessed quietly.
UNSURE = [
    ("angel", "Seeded as a child of Buffy the Vampire Slayer. A bare \"Angel\" is an ambiguous name to "
              "resolve, and this is the only entry whose name is an everyday word."),
    ("dragon-ball-z", "Seeded as a child of Dragon Ball rather than merged with it. The census flags the "
                      "two as a prefix pair (section 2); they are one v1 name each."),
    ("predator", "Seeded on two 2026 mentions, of which one is `D&D 5.5E: Crowning The Apex Predator` - "
                 "not the film. The other, `Predator: The Hunt Re-Imagined`, is."),
]
CHARACTER_LED = ["batman", "superman", "wonder-woman", "justice-league", "spider-man", "x-men",
                 "avengers", "wolverine", "deadpool", "daredevil"]

# Calls made, not open questions.
DECIDED = [
    ("`type`", "where the work started",
     "it picks a shelf and nothing more, so a work that grew into something else keeps the type it "
     "began with: `pokemon` is `game`/`video` and `yu-gi-oh` a `franchise`, because one began on a Game "
     "Boy and the other as a manga. `fallout`, `halo`, `the-last-of-us`, `battletech` and "
     "`critical-role` keep the type they were drafted with for the same reason"),
    ("`warhammer`", "a work of its own, the parent of `warhammer-40000`",
     "`CANON` folds \"warhammer\" into 40,000; it is really the parent, and Warhammer Fantasy is its "
     "other child. \"Warhammer\" is no longer an alias of the child"),
    ("`ponies`", "kept as the schedule writes it",
     "not My Little Pony: its one event calls it \"the Peacock show Ponies\" and talks about Moscow and "
     "a season 2, so the id is `ponies` and no other name is minted"),
    ("`avengers`", "id `avengers`, name \"Avengers\"",
     "BritTrack has its own The Avengers, and an id is forever; `the-avengers` would have claimed the "
     "name before anyone chose which one gets it"),
    ("Group Cosplay Photoshoot, Live-Action Roleplaying Games", "no axes",
     "the rule offers each one a value and each declines it: the track is the facet, and an axis would "
     "say less than the track's own name"),
    ("Kids Track", "`audience: kids`, no axes",
     "schema-v2.md sends the topic Kids to `audience`, which is not one of the four axes"),
]


def synonyms(path=SEARCH):
    """The SYNONYMS groups of src/search.js, as lists of phrases. The client owns that list; this
    report only asks where each phrase went."""
    src = open(path, encoding="utf-8").read()
    body = re.search(r"const SYNONYMS = \[(.*?)\n\];", src, re.S).group(1)
    return [re.findall(r'"([^"]*)"', group) for group in re.findall(r"\[([^\]]*)\]", body)]


def label_for(reg, phrase, terms):
    """Where one phrase of CANON or SYNONYMS went: (label, where)."""
    wid = reg.resolve_work(phrase)
    if wid:
        work = reg.by_id()[wid]
        if registry.resolve_key(work["name"]) != registry.resolve_key(phrase):
            return "alias", wid
        return ("child", f"{wid} under {work['parent']}") if work.get("parent") else ("work", wid)
    tid = reg.resolve_track(phrase)
    if tid:
        return "elsewhere", f"the track {tid}"
    if registry.resolve_key(phrase) in terms:
        return "term", ", ".join(sorted(terms[registry.resolve_key(phrase)]))
    if phrase in ELSEWHERE:
        return "elsewhere", ELSEWHERE[phrase]
    if phrase in SEARCH_ONLY:
        return "search-only", SEARCH_ONLY[phrase]
    if phrase in DROPPED:
        return "dropped", DROPPED[phrase]
    return "UNACCOUNTED", ""


def phrases_section(reg, facts):
    terms = defaultdict(set)
    for w in reg.works:
        for t in w.get("terms") or []:
            terms[registry.resolve_key(t)].add(w["id"])
    groups = synonyms()
    seen, rows = {}, []
    for phrase in list(CANON) + [p for g in groups for p in g]:
        if phrase in seen:
            continue
        seen[phrase] = True
        label, where = label_for(reg, phrase, terms)
        rows.append((phrase, label, where))
    by_label = Counter(label for _, label, _ in rows)
    # A group that names no work is search vocabulary and nothing else; src/search.js keeps it.
    concept = [g for g in groups
               if g and not any(label_for(reg, p, terms)[0] in ("work", "alias", "child") for p in g)]
    facts.update(phrases=len(rows), labels=by_label, concept=len(concept),
                 unaccounted=[p for p, lab, _ in rows if lab == "UNACCOUNTED"])

    out = ["## 3. Every phrase of CANON and SYNONYMS", "",
           f"`tag_events.CANON` and `src/search.js`'s `SYNONYMS` are associations, not identities, so "
           f"each of their {n(len(rows))} distinct phrases carries one label. A **work** is the seeded "
           "entry's own name, an **alias** another name for it, a **child** a work with a parent, a "
           "**term** a word that should lead a searcher to a work but is not a name for it (terms never "
           "resolve), **elsewhere** a v2 home that is not a work, **search-only** a phrase the "
           "registries have no home for that stays in `src/search.js`, and **dropped** a phrase that is "
           "wrong. Nothing is dropped for lacking a registry home.", "",
           f"- {counted((f'**{lab}**', k) for lab, k in ranked(by_label))}.", ""]
    for label in ("work", "alias", "child", "term", "elsewhere", "search-only", "dropped", "UNACCOUNTED"):
        here = [(p, w) for p, lab, w in rows if lab == label]
        if not here:
            continue
        out += [f"### {label}: {n(len(here))}", ""]
        out += table(["phrase", "where it went"], [(code(p), w) for p, w in sorted(here)], left=2)
    out += [f"### Groups that name no work: {n(len(concept))}", "",
            "Search vocabulary and nothing else, so `src/search.js` keeps them; the registries have "
            "nothing to say about them.", ""]
    out += [f"- {', '.join(code(p) for p in g)}" for g in concept]
    return out


def works_section(reg, events, facts):
    fandoms = Counter(f for e in events for f in (e.get("tags") or {}).get("fandoms", []))
    by_work = Counter()
    for name, k in fandoms.items():
        wid = reg.resolve_work(name)
        if wid:
            by_work[wid] += k
    facts.update(works=len(reg.works), with_events=sum(1 for w in reg.works if by_work[w["id"]]))
    out = ["## 1. Works", "",
           f"{n(len(reg.works))} entries, every one `reviewed: false`. {n(facts['with_events'])} carry "
           f"events under a 2026 fandom name and {n(len(reg.works) - facts['with_events'])} carry none - "
           "a child is seeded whether or not 2026 names it, because the parent link is worth having "
           "either way. Rows with events come first; a row with none is marked `-`.", ""]
    for kind in ("franchise", "game"):
        here = [w for w in reg.works if w.get("type") == kind]
        here.sort(key=lambda w: (-by_work[w["id"]], w["id"]))
        out += [f"### {kind}: {n(len(here))}", ""]
        out += table(["id", "name", "parent", "family", "aliases", "terms", "events"],
                     [(f"`{w['id']}`", w["name"], f"`{w['parent']}`" if w.get("parent") else "",
                       w.get("family", ""), ", ".join(code(a) for a in w.get("aliases") or []),
                       ", ".join(code(t) for t in w.get("terms") or []),
                       n(by_work[w["id"]]) if by_work[w["id"]] else "-") for w in here], left=6)
    return out


def axis_evidence(reg, events):
    """Per track: its tagged events, and the best v2 value on each axis with the share of those
    events carrying it. A track takes a value where one value covers AXIS_SHARE of them."""
    by_track = defaultdict(list)
    for e in events:
        for name in e.get("tracks") or []:
            by_track[name].append(e)
    out = {}
    for t in reg.tracks:
        tagged = [e for e in by_track.get(t["name"], []) if e.get("tags")]
        hits = Counter()
        for e in tagged:
            seen = set()
            for topic in e["tags"].get("topics") or []:
                v2 = (("medium", "video-games" if t["name"] in VIDEO_TRACKS else "tabletop")
                      if topic == "Gaming" else TOPIC_V2.get(topic))
                if v2 and v2 not in seen:
                    seen.add(v2)
                    hits[v2] += 1
        best = {}
        for (axis, value), k in sorted(hits.items(), key=lambda kv: (-kv[1], kv[0])):
            best.setdefault(axis, (value, k / len(tagged) if tagged else 0))
        out[t["id"]] = (len(tagged), best)
    return out


def evidence_section(reg, events, facts):
    ev = axis_evidence(reg, events)
    rows, disagree = [], []
    for t in sorted(reg.tracks, key=lambda t: t["id"]):
        tagged, best = ev[t["id"]]
        rule = {a: (v, s) for a, (v, s) in best.items() if s >= AXIS_SHARE}
        held = {a: vs[0] for a, vs in (t.get("axes") or {}).items()}
        taken = {a: v for a, (v, _) in rule.items()}
        note = DECLINED.get(t["id"], "")
        if held != taken and not note:
            disagree.append(t["id"])
        rows.append((t, tagged, best, rule, held, note))
    facts.update(declined=len(DECLINED), disagree=disagree,
                 cleared=sum(1 for _, _, _, rule, _, _ in rows if rule))
    out = ["### The evidence for a track's axes", "",
           f"A track takes a value on an axis where that one value covers at least "
           f"{AXIS_SHARE:.0%} of its **tagged** events, after each v1 topic is mapped to its v2 home "
           "(schema-v2.md's TOPICS table). `Gaming` has no single home, so on a track it is the medium "
           f"that track plays in: `video-games` on {' and '.join(VIDEO_TRACKS)}, `tabletop` elsewhere. "
           "The best candidate on each axis is shown whether or not it clears, so that a track that "
           "takes nothing shows how far off it was.", ""]
    out += table(["track", "tagged", "best candidate per axis", "at " + f"{AXIS_SHARE:.0%}", "held"],
                 [(f"`{t['id']}`", n(tagged),
                   ", ".join(f"{a}: {v} {s:.0%}" for a, (v, s) in sorted(best.items(), key=lambda x: -x[1][1])[:3]) or "no topics",
                   ", ".join(f"`{a}: {v}`" for a, (v, _) in sorted(rule.items())) + (f" - declined, {note}" if note else "") or "-",
                   ", ".join(f"`{a}: {v}`" for a, v in sorted(held.items())) or "-")
                  for t, tagged, best, rule, held, note in rows], left=3)
    out += [f"- Tracks the rule gives a value: {n(facts['cleared'])}; of those, {n(len(DECLINED))} "
            "decline it, below. Tracks where the file and the rule disagree: "
            f"**{n(len(disagree))}**{': ' + ', '.join(f'`{i}`' for i in disagree) if disagree else '.'}", ""]
    return out


def mentions_section(events, facts):
    """What the schedule says about the vocabulary the axes have no value for."""
    counts = []
    for label, pattern in MENTIONS:
        rx = re.compile(pattern, re.I)
        counts.append((label, sum(1 for e in events
                                  if rx.search(e["title"]) or rx.search(e.get("description") or "")),
                       sum(1 for e in events if rx.search(e["title"]))))
    facts["mentions"] = counts
    return ["### What the schedule says about the search-only words", "",
            "Events whose title or description holds the word. The axis lists are schema-v2.md's and "
            "nothing here changes them; this is the count a decision about them would rest on.", ""] + \
        table(["words", "events", "of those, in the title"],
              [(code(label), n(k), n(t)) for label, k, t in counts], left=1)[:-1]


def tracks_section(reg, facts):
    axes = sum(1 for t in reg.tracks if t.get("axes"))
    facts.update(tracks=len(reg.tracks), track_axes=axes)
    out = ["## 2. Tracks", "",
           f"All {n(len(reg.tracks))} tracks of the 2026 schedule. {n(axes)} carry axes - the "
           "single-topic tracks of census section 10, through schema-v2.md's TOPICS table - and the rest "
           "carry none, because the model is asked for axes only where a track does not decide them.", ""]
    out += table(["id", "name", "aliases", "axes", "audience", "work"],
                 [(f"`{t['id']}`", t["name"], ", ".join(code(a) for a in t.get("aliases") or []),
                   "; ".join(f"{axis}: {', '.join(v)}" for axis, v in sorted((t.get("axes") or {}).items())),
                   t.get("audience", ""), f"`{t['work']}`" if t.get("work") else "")
                  for t in sorted(reg.tracks, key=lambda t: t["id"])], left=6)
    out += ["### Calls made", "", "Decided here, not left open.", ""]
    return out + [f"- {who} -> {what}: {why}." for who, what, why in DECIDED]


def unsure_section(reg, facts):
    by_id = reg.by_id()
    facts["unsure"] = len(UNSURE) + 1
    out = ["## 4. UNSURE", "",
           f"{n(len(UNSURE) + 1)} judgments a person has to make. Nothing here is resolved, and every "
           "work is `reviewed: false` until one is.", ""]
    out += [f"- UNSURE: `{wid}` ({by_id[wid]['name'] if wid in by_id else '?'}) - {why}" for wid, why in UNSURE]
    out += [f"- UNSURE: character-led children ({', '.join(f'`{w}`' for w in CHARACTER_LED)}) - seeded as "
            "child works, following the brief's own \"batman under dc-comics\". A character is not a "
            "franchise, and a reviewer may want some of them folded into the parent instead."]
    return out


def coverage_section(reg, events, facts):
    fandoms = Counter(f for e in events for f in (e.get("tags") or {}).get("fandoms", []))
    unresolved = sorted(f for f in fandoms if not reg.resolve_work(f) and f not in LEFT_OUT)
    tracks = Counter(t for e in events for t in e.get("tracks") or [])
    missing = sorted(t for t in tracks if not reg.resolve_track(t))
    facts.update(fandoms=len(fandoms), unresolved=len(unresolved), track_values=len(tracks),
                 missing=len(missing))
    out = ["## 5. Coverage", "",
           f"- Of the {n(len(fandoms))} fandom names in the frozen file, {n(len(fandoms) - len(LEFT_OUT) - len(unresolved))} "
           f"resolve to a work and {n(len(LEFT_OUT))} are left out on purpose. Unresolved: "
           f"**{n(len(unresolved))}**{': ' + ', '.join(code(f) for f in unresolved) if unresolved else '.'}",
           f"- Of the {n(len(tracks))} distinct values in `tracks[]`, all but **{n(len(missing))}** resolve "
           f"to a track{': ' + ', '.join(code(t) for t in missing) if missing else '.'}",
           f"- Phrases of CANON and SYNONYMS with no label: **{n(len(facts['unaccounted']))}**"
           f"{': ' + ', '.join(code(p) for p in facts['unaccounted']) if facts['unaccounted'] else '.'}", "",
           "The five names left out, each an axis value in v2 rather than a work:", ""]
    return out + table(["fandom name", "events", "its v2 home"],
                       [(code(f), n(fandoms[f]), home) for f, home in sorted(LEFT_OUT.items())], left=1)[:-1]


def render(reg, data, source=EVENTS):
    events = data["events"]
    facts = {}
    body = works_section(reg, events, facts) + [""]
    body += tracks_section(reg, facts) + [""]
    body += evidence_section(reg, events, facts) + [""]
    body += mentions_section(events, facts) + [""]
    body += phrases_section(reg, facts) + [""]
    body += unsure_section(reg, facts) + [""]
    body += coverage_section(reg, events, facts)
    head = ["# The registries - seeded, and not yet reviewed", "",
            f"Written by `registry_report.py` from `data/registry/` and "
            f"`{source.replace(os.sep, '/')}` (`generated_at` {data.get('generated_at')}). Do not edit it "
            "by hand; run the script again.", "",
            "What PR 3a seeded into `works.json` and `tracks.json` (DECISIONS #31), for the review that "
            "flips a row to `reviewed: true`. It states what was seeded and why, and resolves nothing: "
            "`UNSURE` marks a judgment that is a person's to make.", "",
            f"- Works: {n(facts['works'])}, all `reviewed: false`. Tracks: {n(facts['tracks'])}, "
            f"{n(facts['track_axes'])} with axes. People: {n(len(reg.people))} - PR 3b.",
            f"- Phrases labelled: {n(facts['phrases'])}. UNSURE: {n(facts['unsure'])}. Kept in "
            f"`src/search.js`: {n(len(SEARCH_ONLY))}. Dropped: {n(len(DROPPED))}.",
            f"- Coverage: {n(facts['unresolved'])} unresolved fandom names, {n(facts['missing'])} "
            f"unresolved tracks, {n(len(facts['unaccounted']))} unlabelled phrases, "
            f"{n(len(facts['disagree']))} tracks whose axes the evidence does not support.", ""]
    return "\n".join(head + body)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", default=EVENTS)
    ap.add_argument("--registry", default=registry.DIR)
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()
    reg = registry.load(args.registry)
    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    text = render(reg, data, args.file)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:  # LF on Windows too (.gitattributes)
        f.write(text)
    print(f"{args.out}: {len(reg.works)} works, {len(reg.tracks)} tracks, {text.count(chr(10)) + 1} lines")


if __name__ == "__main__":
    main()
