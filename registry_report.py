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

# A phrase with no v2 home at all. Short, and each says why.
DROPPED = {
    "symphony": "an ensemble; no work, no axis value",
    "orchestra": "an ensemble; no work, no axis value",
    "philharmonic": "an ensemble; no work, no axis value",
    "wrestling": "the schedule has wrestling events; no axis has a value for them",
    "wrestlers": "the schedule has wrestling events; no axis has a value for them",
    "wrestle": "the schedule has wrestling events; no axis has a value for them",
    "karaoke": "an activity with no v2 home",
    "sing-along": "an activity with no v2 home",
    "singalong": "an activity with no v2 home",
    "sing along": "an activity with no v2 home",
    "dance": "an activity with no v2 home",
    "dancing": "an activity with no v2 home",
    "ball": "an activity with no v2 home, and too common a word to be a term",
    "romance": "no romance value on any of the four axes",
    "romantasy": "no romance value on any of the four axes",
    "paranormal romance": "`subject: paranormal` is about the paranormal, not the genre of romance",
}

# What a person has to settle. Nothing here is guessed quietly.
UNSURE = [
    ("pokemon", "Typed `franchise`. It is equally a video-game series and a collectible card game; "
                "one entry cannot be both, and `type` decides which shelf it sits on."),
    ("yu-gi-oh", "Typed `game`/`ccg` after the card game the schedule plays. It is also an anime "
                 "franchise."),
    ("fallout", "Typed `game`/`video`. It now has a television series, which makes it a franchise too."),
    ("halo", "Typed `game`/`video`. Novels and a television series make the same argument."),
    ("the-last-of-us", "Typed `game`/`video`. Its television series is what most people mean by the name."),
    ("battletech", "Typed `game`/`miniatures`. It also has novels and video games."),
    ("warhammer-40000", "`Warhammer` is seeded as an alias, following `CANON`. Warhammer is really the "
                        "parent: Warhammer Fantasy and Warhammer 40,000 are two works under it."),
    ("angel", "Seeded as a child of Buffy the Vampire Slayer. A bare \"Angel\" is an ambiguous name to "
              "resolve, and this is the only entry whose name is an everyday word."),
    ("dragon-ball-z", "Seeded as a child of Dragon Ball rather than merged with it. The census flags the "
                      "two as a prefix pair (section 2); they are one v1 name each."),
    ("ponies", "The v1 fandom name, kept as the schedule writes it. Presumably My Little Pony, but the "
               "schedule never says so, and a rename later keeps this as an alias."),
    ("predator", "Seeded on two 2026 mentions, of which one is `D&D 5.5E: Crowning The Apex Predator` - "
                 "not the film. The other, `Predator: The Hunt Re-Imagined`, is."),
    ("critical-role", "Typed `franchise`, not `game`: it is an actual-play show about a game, and its "
                      "events are panels and photo sessions."),
]
CHARACTER_LED = ["batman", "superman", "wonder-woman", "justice-league", "spider-man", "x-men",
                 "the-avengers", "wolverine", "deadpool", "daredevil"]

# Calls made, not open questions.
DECIDED = [
    ("Collectible Card Games, Board Games, Werewolf Games", "`medium: tabletop`",
     "their dominant topic is Gaming, which has no single v2 home; all three are played at a table"),
    ("Artemis Spaceship Bridge Simulator", "`medium: video-games`",
     "also Gaming-dominant, but it is a video game played on networked screens"),
    ("Live-Action Roleplaying Games", "no axes",
     "its dominant topic is Tabletop, and a LARP is not played at a table; no medium fits, and the "
     "track is itself the facet"),
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
           "resolve), **elsewhere** a v2 home that is not a work, and **dropped** the rest.", "",
           f"- {counted((f'**{lab}**', k) for lab, k in ranked(by_label))}.", ""]
    for label in ("work", "alias", "child", "term", "elsewhere", "dropped", "UNACCOUNTED"):
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
    out += ["### Calls made", "",
            "Decided here, not left open. Each is a track whose dominant topic has no single v2 home.", ""]
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
            f"- Phrases labelled: {n(facts['phrases'])}. UNSURE: {n(facts['unsure'])}. Dropped: "
            f"{n(len(DROPPED))}.",
            f"- Coverage: {n(facts['unresolved'])} unresolved fandom names, {n(facts['missing'])} "
            f"unresolved tracks, {n(len(facts['unaccounted']))} unlabelled phrases.", ""]
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
