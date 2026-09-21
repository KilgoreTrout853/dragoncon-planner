#!/usr/bin/env python3
"""The tag stage's pilot (Discover PR 4): about 150 of the schedule's distinct inputs, asked of a model
into scratch caches, and a report comparing the runs. Evidence for the design chat, not a stage.

NOT ON THE TAG OR BUILD PATH. The everyday-word stratum below was chosen by matching work names
against event text, and `sample` checks each choice the same way. The tagger must never do that -
only a model's answer links an event to a work - so it is done here, and only to CHOOSE test events.
tag_stage.py and events_v2.py never import this file; tests/test_tag_stage.py checks that they do not.
It reads data/ and writes nothing there, nor anywhere in the repo.

    python tools/tag_pilot.py sample DIR        # DIR/ids.txt and DIR/sample.json
    python tag_stage.py --only DIR/ids.txt --cache DIR/RUN.jsonl --report DIR/RUN.json --no-mint --model M
    python tools/tag_pilot.py compare DIR RUN RUN ...     # DIR/report.md; the first RUN is the reference
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import events_v2 as v2  # noqa: E402
import parse_stage as ps  # noqa: E402
import registry  # noqa: E402
import tag_stage as ts  # noqa: E402

EVENTS = os.path.join(ROOT, ts.EVENTS)
REGISTRY = os.path.join(ROOT, registry.DIR)
TARGET = 150

# Every registry work whose name - or, last three, an alias - the 2026 text uses in its ordinary sense,
# found by a whole-word scan of the text the tagger is sent, each hit read by hand (2026-09-21):
# (work id, the word as the text has it, an ordinary use, the stratum's event or None).
EVERYDAY = [
    ("300", "300", "Aged 30 - 300; a 300-year-old Samurai text",
     "Photoshoot: Over30cosplay- For Cosplayers Aged 30 - 300"),
    ("alien", "Alien", "The Alien in Science Fiction; an alien invasion fleet; battles aliens from the 8th dimension",
     "The Alien in Science Fiction"),
    ("castle", "Castle", "Stone Golem Castle; a collapsed castle; a treasure-filled flying castle",
     "D&D 5E: Stone Golem Castle"),
    ("companion", "companion", "a friendly animal companion", None),
    ("destiny", "Destiny", "Defying Destiny!; shape your own destiny", "Defying Destiny!"),
    ("dinosaurs", "dinosaurs", "iconic dinosaurs from video games; coexist with dinosaurs today",
     "What's that Dinosaur?!?"),
    ("fallout", "fallout", "fallout risks; long-term ecological fallout", "When the Bombs Fall: A Nuclear Survival Guide"),
    ("labyrinth", "Labyrinth", "Into the Labyrinth; a sprawling labyrinth of tunnels", "AD&D 1E: Into the Labyrinth"),
    ("loki", "Loki", "the Norse god, in Kobold Press's Northlands adventures", "KBLD Northlands-1: Down the Wolf Barrow"),
    ("lucifer", "Lucifer", "a foe the Winchesters faced, in Supernatural", "Supernatural Showdown: Formidable Foes Edition"),
    ("marvel", "marvel", "marvel at, the verb", "Water Is Weird! Strange Science of H2O"),
    ("nurses", "Nurses", "Three Nurses & an Engineer walk into the apocalypse",
     "So, Three Nurses & an Engineer Walk into the Apocalypse..."),
    ("one-piece", "one piece", "acquire it... in one piece (DDAL FR-DC-TDD-01)", None),
    ("persona", "persona", "the person behind the persona", None),
    ("portal", "portal", "an extra-dimensional portal; the Yawning Portal inn", None),
    ("predator", "Predator", "Crowning The Apex Predator", "D&D 5.5E: Crowning The Apex Predator"),
    ("rent", "rent", "the low-rent to the highbrow", None),
    ("saw", "saw", "when you saw Carl Sagan's cameo; stories that saw print", "Gaming with Science / Wingspan Effect"),
    ("suits", "suits", "superhero suits; whichever suits you", "Specialty Costumes"),
    ("the-choice", "Choice", "Judge's Choice awards; a quilt of your choice", "The Video Game Costume Contest"),
    ("the-closer", "closer", "a closer look; closer to reality", None),
    ("the-league", "League", "Convention League; Free League Publishing; Adventurers League", "Convention League"),
    ("the-rookie", "rookie", "rookie mistakes", None),
    ("titans", "titans", "two titans of the puppetry and cosplay world", "Kirk and Kendall Have a Panel"),
    ("twilight", "twilight", "twilight, dusk, and gloom", None),
    ("wednesday", "Wednesday", "Onesie Wednesday; Wednesday 6pm to 4am", "Onesie Wednesday"),
    ("what-if", "What if", "What if villains from classic movies and TV fought each other?",
     "Just the Worst: A Tournament of Villains"),
    ("star-trek-voyager", "Voyager", "the Voyager space probes (an alias of Star Trek: Voyager)",
     "Voyager Begins Her 50th Year! Humankind's 1st Messenger Still Talks to Us"),
    ("game-of-thrones", "GoT", "got, the verb, in 25 descriptions (an alias of Game of Thrones)", None),
    ("dc-comics", "DC", "FR-DC-..., Dragon Con's code in the DDAL titles (an alias of DC Comics)", None),
]
# Checked and not in the list: every use in the text is the work itself or another name.
CHECKED = {"angel": "the show; inside Alita: Battle Angel; a character in Rent",
           "arrow": "Green Arrow, a DC character", "halo": "the game and the series", "hades": "the game",
           "upload": "the series", "vikings": "a group photoshoot's theme, ambiguous", "reaper": "the series",
           "scream": "the Scream films", "the-boys": "the series; the Detective Boys"}
# Not registry works, all everyday words, all shows: a name the tagger could mint.
NOT_IN_REGISTRY = ("supernatural", "heroes", "lost", "community", "grimm", "haven", "chuck", "house")
NOT_IN_REGISTRY_EVENTS = [
    ("heroes", "Dungeon Crawl Classics: Sailors on the Starless Sea"),
    ("supernatural", "Folklore, Monsters, Cryptids, & the Paranormal: A Skeptic's Role"),
    ("community", "Dragon Con History: How to Have 365 Days of Dragon Con"),
    ("lost", "Limbo... The Land of the Dead"),
    ("house", "Call of Cthulhu 7E: The Haunting"),
]
QUOTAS = [("gaming", 25), ("main programming", 15), ("photo or signing", 15), ("performance", 10)]


def word_in(word, text):
    return re.search(r"(?<![\w'])" + r"\s+".join(map(re.escape, word.split())) + r"(?![\w'])", text, re.I)


def load():
    with open(EVENTS, "rb") as f:
        events = json.loads(f.read().decode("utf-8"))["events"]
    return events, registry.load(REGISTRY)


# ---------------------------------------------------------------------------
# sample
# ---------------------------------------------------------------------------

def sample(events):
    """[(key, stratum, note)], about TARGET distinct inputs, the same every run: within a stratum the
    order is the key's, a hash, so the pick is spread and repeatable."""
    inputs, keys = ts.distinct_inputs(events)
    first = {}
    for e, k in zip(events, keys):
        first.setdefault(k, e)
    chosen = {}

    def by_title(title):
        found = sorted(k for e, k in zip(events, keys) if e["title"] == title)
        if not found:
            raise SystemExit(f"no event is titled {title!r}")
        return found[0]

    for wid, word, _, title in EVERYDAY:
        if title:
            k = by_title(title)
            inp = inputs[k]
            if not word_in(word, f"{inp['title']}\n{inp['description']}"):
                raise SystemExit(f"{title!r} does not say {word!r}")
            chosen[k] = ("everyday", wid)
    for word, title in NOT_IN_REGISTRY_EVENTS:
        k = by_title(title)
        if not word_in(word, f"{inputs[k]['title']}\n{inputs[k]['description']}"):
            raise SystemExit(f"{title!r} does not say {word!r}")
        chosen.setdefault(k, ("not in the registry", word))
    for k in sorted(inputs):
        if "DDAL" in first[k]["title"]:
            chosen.setdefault(k, ("DDAL", ""))

    def v1_kind(k):
        return (first[k].get("tags") or {}).get("kind")

    test = {"gaming": lambda k: inputs[k]["type"] == "gaming",
            "main programming": lambda k: "Main Programming" in inputs[k]["tracks"],
            "photo or signing": lambda k: v1_kind(k) in ("photo", "signing"),
            "performance": lambda k: v1_kind(k) == "performance"}
    for stratum, n in QUOTAS:
        fits = [k for k in sorted(inputs) if test[stratum](k) and k not in chosen]
        for k in round_robin(fits, inputs)[:n]:
            chosen[k] = (stratum, "")
    rest = round_robin([k for k in sorted(inputs) if k not in chosen], inputs)
    for k in rest[:max(0, TARGET - len(chosen))]:
        chosen[k] = ("spread", "")
    return [(k, s, note) for k, (s, note) in chosen.items()], inputs, first


def round_robin(candidates, inputs):
    """One from each first track in turn, so a stratum is spread over the tracks it can reach."""
    by_track = defaultdict(list)
    for k in candidates:
        by_track[(inputs[k]["tracks"] or [""])[0]].append(k)
    out, depth = [], 0
    while len(out) < len(candidates):
        for track in sorted(by_track):
            if depth < len(by_track[track]):
                out.append(by_track[track][depth])
        depth += 1
    return out


def cmd_sample(out_dir):
    events, _ = load()
    chosen, inputs, first = sample(events)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "ids.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.writelines(first[k]["id"] + "\n" for k, _, _ in chosen)
    rows = [{"key": k, "stratum": s, "note": note, "id": first[k]["id"], **inputs[k]} for k, s, note in chosen]
    with open(os.path.join(out_dir, "sample.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    strata = Counter(s for _, s, _ in chosen)
    tracks = Counter((inputs[k]["tracks"] or [""])[0] for k, _, _ in chosen)
    print(f"{len(chosen)} inputs: " + ", ".join(f"{s} {n}" for s, n in strata.items()))
    print(f"  over {len(tracks)} first tracks; gaming {sum(1 for k, _, _ in chosen if inputs[k]['type'] == 'gaming')}")


# ---------------------------------------------------------------------------
# compare
# ---------------------------------------------------------------------------

FIELDS = ("kind", "works") + ts.AXIS_NAMES + ("audience", "play")


def works_set(answer, reg):
    return frozenset(reg.resolve_work(w["name"]) or "new:" + registry.resolve_key(w["name"]) for w in answer["works"])


def field(answer, name, reg):
    if name == "works":
        return works_set(answer, reg)
    if name in ts.AXIS_NAMES:
        return frozenset(answer[name])
    return json.dumps(answer[name], sort_keys=True)


def as_built(answer, event, reg):
    """The axes, audience and play as events_v2 writes them for this event: tracks.json decides the
    axes it has, the parse can make an event mature, and play stays only on a gaming event."""
    tracks = [reg.by_id("tracks")[t] for t in (reg.resolve_track(n) for n in event.get("tracks") or []) if t]
    out = {axis: frozenset(v) for axis, v in v2.merge_axes(answer, tracks).items()}
    out["audience"] = v2.merge_audience(ps.facets_for(event), answer, tracks)
    gaming = event.get("type") == "gaming" or answer["kind"] == "gaming"
    out["play"] = json.dumps(answer["play"] if gaming else None, sort_keys=True)
    return out


def describe_works(answer, reg):
    out = []
    for w in answer["works"]:
        wid = reg.resolve_work(w["name"])
        where = wid if wid else ("a term" if reg.is_term(w["name"]) else "new")
        out.append(f"{w['name']} ({where}; \"{w['evidence']}\")")
    return "; ".join(out) or "-"


def md_escape(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def table(head, rows):
    out = ["| " + " | ".join(head) + " |", "| " + " | ".join("---" for _ in head) + " |"]
    out += ["| " + " | ".join(md_escape(c) for c in r) + " |" for r in rows]
    return out


def cmd_compare(out_dir, runs, pairs):
    events, reg = load()
    with open(os.path.join(out_dir, "sample.json"), encoding="utf-8") as f:
        sample_rows = json.load(f)
    strata = {r["key"]: (r["stratum"], r["note"]) for r in sample_rows}
    inputs = {r["key"]: {k: r[k] for k in ("title", "type", "tracks", "description")} for r in sample_rows}
    caches = {r: ts.load_cache(os.path.join(out_dir, f"{r}.jsonl")) for r in runs}
    reports = {}
    for r in runs:
        with open(os.path.join(out_dir, f"{r}.json"), encoding="utf-8") as f:
            reports[r] = json.load(f)
    ref = runs[0]
    keys_of = [ts.input_key(ts.tagger_input(e)) for e in events]
    sample_events = [(e, k) for e, k in zip(events, keys_of) if k in strata]
    L = [f"# Tag stage pilot: {len(sample_rows)} inputs, {len(runs)} runs", ""]

    # --- runs -----------------------------------------------------------------------------------
    L += ["## The runs", ""]
    rows = []
    for r in runs:
        reqs = [q for q in reports[r].get("requests", []) if "error" not in q]
        fails = [q for q in reports[r].get("requests", []) if "error" in q]
        secs = [q["seconds"] for q in reqs]
        tin = sum(sum((q.get("usage") or {}).get(x, 0) or 0 for x in ("input_tokens", "cache_creation_input_tokens",
                                                                        "cache_read_input_tokens")) for q in reqs)
        tout = sum((q.get("usage") or {}).get("output_tokens", 0) or 0 for q in reqs)
        answered = len(caches[r])
        models = Counter(q["model"] for q in reqs)
        chars = sum(q.get("reply_chars", 0) for q in reqs)
        rows.append([r, reports[r]["transport"], reports[r]["model"], ", ".join(f"{m} ({n})" for m, n in models.items()),
                     f"{len(reqs)} ok, {len(fails)} failed", f"{answered}/{len(sample_rows)}",
                     f"{sum(secs) / len(secs):.0f} s (max {max(secs):.0f})" if secs else "-",
                     f"{tin:,} / {tout:,}", f"{tout / answered:.0f}" if answered else "-",
                     f"{chars / answered:.0f}" if answered else "-"])
    L += table(["run", "transport", "asked for", "model that answered (requests)", "requests", "answered",
                "seconds a request", "tokens in / out", "out tokens an answer", "reply characters an answer"],
               rows) + [""]
    cmd = ts.claude_code_command(reports[ref]["model"], isolated=True)
    L += [f"Command line: `{' '.join(a if a else chr(34) * 2 for a in cmd)}`, the prompt on stdin, run in an empty "
          f"directory of its own. Tokens are Claude Code's own count: in includes its ~6,100 tokens of context, and "
          f"out includes the model's thinking, which is why it is several times the reply itself (about 4 "
          f"characters a token).", ""]

    # --- consistency ----------------------------------------------------------------------------
    L += ["## Same input, same answer?", "",
          "Per field, the inputs two runs answered differently, over the inputs both answered. A list's order "
          "is not a difference; works are compared as the ids they resolve to, or the name a new work would get.", ""]
    head = ["field"] + [f"{a} vs {b}" for a, b in pairs]
    diffs = {p: {f: [] for f in FIELDS} for p in pairs}
    for p in pairs:
        a, b = p
        for k in strata:
            if k in caches[a] and k in caches[b]:
                for f in FIELDS:
                    if field(caches[a][k]["answer"], f, reg) != field(caches[b][k]["answer"], f, reg):
                        diffs[p][f].append(k)
    both = {p: sum(1 for k in strata if k in caches[p[0]] and k in caches[p[1]]) for p in pairs}
    L += table(head, [[f] + [f"{len(diffs[p][f])} of {both[p]} ({100 * len(diffs[p][f]) / max(both[p], 1):.1f}%)"
                             for p in pairs] for f in FIELDS]
               + [["any field"] + [str(len({k for f in FIELDS for k in diffs[p][f]})) for p in pairs]]) + [""]
    first_event = {}
    for e, k in zip(events, keys_of):
        first_event.setdefault(k, e)
    built = {p: Counter() for p in pairs}
    for p in pairs:
        a, b = p
        for k in strata:
            if k in caches[a] and k in caches[b]:
                x = as_built(caches[a][k]["answer"], first_event[k], reg)
                y = as_built(caches[b][k]["answer"], first_event[k], reg)
                for f in x:
                    built[p][f] += x[f] != y[f]
                built[p]["any field"] += (x != y) or any(
                    field(caches[a][k]["answer"], f, reg) != field(caches[b][k]["answer"], f, reg) for f in ("kind", "works"))
    L += ["The same, as events_v2 writes them: tracks.json decides the axes it has, the parse can make an event "
          "mature, and play stays only on a gaming event. Kind and works are as above.", ""]
    L += table(head, [[f] + [f"{built[p][f]} of {both[p]} ({100 * built[p][f] / max(both[p], 1):.1f}%)" for p in pairs]
                      for f in ts.AXIS_NAMES + ("audience", "play")]
               + [["any field"] + [str(built[p]["any field"]) for p in pairs]]) + [""]
    for p in pairs:
        a, b = p
        for f in ("works", "kind"):
            if diffs[p][f]:
                L += [f"### {f}: {a} and {b} differ on {len(diffs[p][f])}", ""]
                L += table(["title", a, b], [[inputs[k]["title"],
                                              describe_works(caches[a][k]["answer"], reg) if f == "works" else caches[a][k]["answer"]["kind"],
                                              describe_works(caches[b][k]["answer"], reg) if f == "works" else caches[b][k]["answer"]["kind"]]
                                             for k in sorted(diffs[p][f], key=lambda k: inputs[k]["title"])]) + [""]

    # --- against v1 -----------------------------------------------------------------------------
    L += [f"## {ref} against the frozen v1 tags", "",
          f"Over the {len(sample_events)} events that use the sampled inputs.", ""]
    kinds = Counter()
    for e, k in sample_events:
        if k in caches[ref]:
            kinds[((e.get("tags") or {}).get("kind") or "(none)", caches[ref][k]["answer"]["kind"])] += 1
    same = sum(n for (a, b), n in kinds.items() if a == b)
    keep = []
    for r in runs:
        pairs_r = [((e.get("tags") or {}).get("kind"), caches[r][k]["answer"]["kind"]) for e, k in sample_events
                   if k in caches[r]]
        keep.append(f"{r} {sum(1 for a, b in pairs_r if a == b)} of {len(pairs_r)}")
    L += ["Events keeping their v1 kind, by run: " + "; ".join(keep) + ".", ""]
    L += [f"kind: {same} of {sum(kinds.values())} events keep their v1 kind in {ref}. The changes:", ""]
    L += table(["v1 kind", "v2 kind", "events"], [[a, b, n] for (a, b), n in sorted(kinds.items(), key=lambda kv: -kv[1])
                                                  if a != b]) + [""]
    mature = Counter()
    for e, k in sample_events:
        if k in caches[ref]:
            model = caches[ref][k]["answer"]["audience"] == "mature"
            final = model or bool(ps.facets_for(e).get("mature"))
            mature[(bool((e.get("tags") or {}).get("adult")), model, final)] += 1
    L += ["mature: v1 `adult` against the model's `audience: mature` and against the build's (the model, or "
          "the parsed marker):", ""]
    L += table(["v1 adult", "model mature", "build mature", "events"],
               [[a, m, f, n] for (a, m, f), n in sorted(mature.items(), key=lambda kv: -kv[1])]) + [""]
    lost = [(e["title"], ", ".join((e.get("tags") or {}).get("fandoms", []))) for e, k in sample_events
            if k in caches[ref] and (e.get("tags") or {}).get("fandoms") and not caches[ref][k]["answer"]["works"]]
    L += [f"Events with a v1 fandom and no v2 work in {ref}: {len(lost)} events, {len(set(lost))} titles.", ""]
    L += table(["title", "v1 fandoms"], sorted(set(lost))) + [""]

    # --- works per event --------------------------------------------------------------------------
    L += ["## Works per event", ""]
    rows = []
    for r in runs:
        per_input = Counter(len(caches[r][k]["answer"]["works"]) for k in strata if k in caches[r])
        per_event = Counter(len(caches[r][k]["answer"]["works"]) for _, k in sample_events if k in caches[r])
        rows.append([r] + [f"{per_input[n]} / {per_event[n]}" for n in range(4)])
    L += ["Inputs / events with 0, 1, 2 and 3 works.", ""] + table(["run", "0", "1", "2", "3"], rows) + [""]

    # --- mint -------------------------------------------------------------------------------------
    everything, _ = ts.distinct_inputs(events)
    population = Counter(inp["type"] for inp in everything.values())
    L += ["## What would be minted", "",
          "A rough scale for a full run: the share of sampled inputs, by scraped type, that name a work the "
          "registry lacks, times the schedule's inputs of that type. The sample over-represents gaming (a third "
          "of it, against 13.5% of the schedule) and holds hand-picked strata, so this is a scale, not a forecast; "
          "distinct works would be fewer, because one work recurs across inputs.", ""]
    rows = []
    for r in runs:
        naming = Counter()
        for k in strata:
            if k in caches[r] and any(not reg.resolve_work(w["name"]) and not reg.is_term(w["name"])
                                      for w in caches[r][k]["answer"]["works"]):
                naming[inputs[k]["type"]] += 1
        per_type = Counter(inputs[k]["type"] for k in strata)
        scaled = sum(naming[t] / per_type[t] * population[t] for t in per_type if per_type[t])
        rows.append([r, f"{naming['gaming']} of {per_type['gaming']}", f"{naming['panel']} of {per_type['panel']}",
                     f"~{scaled:.0f} of {len(everything):,}"])
    L += table(["run", "gaming inputs naming a new work", "panel inputs naming a new work",
                "inputs naming one, scaled to the schedule"], rows) + [""]
    for r in runs:
        plan = ts.mint_plan(events, caches[r], reg)
        L += [f"### {r}: {len(plan['works'])} new works, {len(plan['collisions'])} collisions, "
              f"{len(plan['terms'])} term names", ""]
        if plan["defaulted"]:
            L += ["Defaulted, first:", ""] + [f"- `{d['id']}` {d['field']} = {d['value']}" for d in plan["defaulted"]] + [""]
        groups = {"gaming": [], "performance": [], "the rest": []}
        for d in plan["details"]:
            top = max(d["kinds"], key=lambda k: (d["kinds"][k], k))
            groups["gaming" if top == "gaming" else "performance" if top == "performance" else "the rest"].append(d)
        for g, ds in groups.items():
            L += [f"**{g}** ({len(ds)})", ""]
            L += table(["id", "name", "type", "events", "evidence", "titles"],
                       [[d["id"], d["name"], d["type"] + (f"/{d['family']}" if d["family"] else ""), d["events"],
                         "; ".join(d["evidence"]), "; ".join(sorted(set(d["titles"])))[:160]] for d in ds]) + [""]
        for c in plan["collisions"]:
            L += [f"- collision: `{c['name']}` -> `{c['id']}`: {c['why']}"]
        for t in plan["ties"] + plan["conflicts"]:
            L += [f"- {'tie' if t in plan['ties'] else 'conflict'}: `{t['id']}` {t['field']} {t['counts']}"]
        L += [""]

    # --- evidence ---------------------------------------------------------------------------------
    L += ["## Links dropped by the evidence check", ""]
    for r in runs:
        dropped = reports[r].get("tally", {}).get("evidence_dropped", [])
        L += [f"### {r}: {len(dropped)}", ""]
        L += table(["title", "work", "evidence given"], [[d["title"], d["name"], d["evidence"]] for d in dropped]) + [""]

    # --- terms and DDAL -----------------------------------------------------------------------------
    L += ["## Registry terms named as works, and what the DDAL titles got", ""]
    for r in runs:
        named = Counter(w["name"] for k in strata if k in caches[r] for w in caches[r][k]["answer"]["works"]
                        if not reg.resolve_work(w["name"]) and reg.is_term(w["name"]))
        L += [f"- {r}: " + (", ".join(f"`{n}` ({c})" for n, c in named.items()) or "none")]
    L += [""]
    ddal = sorted((k for k, (s, _) in strata.items() if s == "DDAL"), key=lambda k: inputs[k]["title"])
    L += table(["DDAL title"] + list(runs), [[inputs[k]["title"]] + [describe_works(caches[r][k]["answer"], reg)
                                                                      if k in caches[r] else "(unanswered)" for r in runs]
                                             for k in ddal]) + [""]

    # --- everyday ---------------------------------------------------------------------------------
    L += ["## The everyday-word stratum", "",
          "Every link made on these events, by any run; expected none of the stratum's work.", ""]
    rows = []
    for k, (s, wid) in sorted(strata.items(), key=lambda kv: kv[1][1]):
        if s != "everyday":
            continue
        cells = []
        for r in runs:
            a = caches[r].get(k)
            if not a:
                cells.append("(unanswered)")
                continue
            ids = works_set(a["answer"], reg)
            cells.append(("TRAP: " if wid in ids else "") + describe_works(a["answer"], reg))
        rows.append([wid, inputs[k]["title"]] + cells)
    L += table(["work", "title"] + list(runs), rows) + [""]
    L += ["Show names that are everyday words and are not registry works, named anywhere in the pilot:", ""]
    for r in runs:
        hits = [(inputs[k]["title"], w["name"]) for k in strata if k in caches[r] for w in caches[r][k]["answer"]["works"]
                if registry.resolve_key(w["name"]) in NOT_IN_REGISTRY]
        L += [f"- {r}: " + ("; ".join(f"`{n}` on {t}" for t, n in hits) or "none")]
    L += [""]
    for k, (s, word) in strata.items():
        if s == "not in the registry":
            L += [f"- `{word}` in its ordinary sense: {inputs[k]['title']} -> " + ", ".join(
                f"{r}: {describe_works(caches[r][k]['answer'], reg) if k in caches[r] else '(unanswered)'}" for r in runs)]
    L += [""]
    L += ["### The full list", "",
          "Every registry work whose name, or (last three) an alias, the 2026 text uses in its ordinary sense. "
          "The stratum takes one event each from 20 of them, title-case first.", ""]
    L += table(["work", "the word", "an ordinary use", "stratum event"],
               [[wid, word, use, title or "-"] for wid, word, use, title in EVERYDAY]) + [""]
    L += ["Checked, and not in the list: " + "; ".join(f"`{w}` ({why})" for w, why in CHECKED.items()) + ".",
          "Not registry works at all: " + ", ".join(f"`{w}`" for w in NOT_IN_REGISTRY) + ".", ""]

    # --- validation -------------------------------------------------------------------------------
    L += ["## What validation set aside", ""]
    rows = []
    for r in runs:
        t = reports[r].get("tally", {})
        rows.append([r, len(t.get("kind_rejected", [])), sum(len(x["dropped"]) for x in t.get("works_over_cap", [])),
                     t.get("works_malformed", 0), t.get("type_invalid", 0), t.get("family_invalid", 0),
                     ", ".join(f"{v} ({n})" for v, n in (t.get("axis_dropped") or {}).items()) or "-",
                     t.get("axis_capped", 0), ", ".join(f"{v} ({n})" for v, n in (t.get("audience_defaulted") or {}).items()) or "-",
                     sum((t.get("play_nulled") or {}).values()), len(reports[r].get("unanswered", []))])
    L += table(["run", "kind rejected", "works over 3", "works malformed", "type invalid", "family invalid",
                "axis values dropped", "axis values over 2", "audience defaulted", "play nulled", "unanswered"], rows) + [""]

    # --- whole answers ----------------------------------------------------------------------------
    L += [f"## Fifteen whole answers ({ref})", ""]
    picks, seen = [], Counter()
    order = ["everyday", "DDAL", "gaming", "main programming", "photo or signing", "performance", "spread",
             "not in the registry"]
    for s in order:
        for k in sorted(k for k, (st, _) in strata.items() if st == s):
            if seen[s] < 2 and k in caches[ref] and len(picks) < 15:
                picks.append(k)
                seen[s] += 1
    for k in picks:
        L += [f"**{inputs[k]['title']}** ({strata[k][0]})", "", "```json",
              json.dumps(inputs[k], ensure_ascii=False), json.dumps(caches[ref][k]["answer"], ensure_ascii=False), "```", ""]

    path = os.path.join(out_dir, "report.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sample")
    s.add_argument("dir")
    c = sub.add_parser("compare")
    c.add_argument("dir")
    c.add_argument("runs", nargs="+", help="the runs, the reference first")
    c.add_argument("--pairs", nargs="+", default=[], metavar="A:B",
                   help="the runs to compare field by field; default: the first two")
    args = ap.parse_args()
    if args.cmd == "sample":
        cmd_sample(args.dir)
    else:
        pairs = [tuple(p.split(":", 1)) for p in args.pairs] or [(args.runs[0], args.runs[1])]
        cmd_compare(args.dir, args.runs, pairs)


if __name__ == "__main__":
    main()
