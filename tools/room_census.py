#!/usr/bin/env python3
"""The venues stage's coverage of the 2026 schedule: docs/venues/census-2026.md.

    python tools/room_census.py            # write docs/venues/census-2026.md
    python tools/room_census.py --events F --venues V --out O

The off-season coverage report of venue resolution (DECISIONS #45; ROADMAP tentpole 1): every location of the frozen
schedule read by the venues stage (venues_stage.py) against data/2026/venues.json, as build will read it. Per hotel,
each room string with its place kind, level and rooms and the rules that read it; the curation worklist, by events -
the strings read at the hotel alone, the unplaced rooms, the locations no key begins, and the placeless locations split
again; the rooms of the venues file no string reaches; and the rules' firings. It has no grammar of its own: every
reading is the stage's. It reads the frozen schedule's locations and the venues file, and writes neither (DECISIONS
#13; the venues file is hand-edited).

A record, not held fresh by CI: its preface names the venues file it read, and an edit to that file leaves it stale
until the script runs again. `venues_stage` for the reading, `venues` for the loader, and the standard library;
deterministic - two runs write the same bytes.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)

import venues as venues_file  # noqa: E402
import venues_stage  # noqa: E402

EVENTS = "data/2026/events.json"
VENUES = "data/2026/venues.json"
OUT = "docs/venues/census-2026.md"
BARE = "(hotel only)"  # how a bare key's empty room string is shown


# ---------------------------------------------------------------------------
# The census: the stage's reading of every location
# ---------------------------------------------------------------------------

def census(data, v):
    """Every event's Place, the stage's report of them, and each distinct reading with its count."""
    resolver = venues_stage.Resolver(v)
    seen = [(e.get("location"), resolver.place(e.get("location"))) for e in data["events"]]
    counts = Counter(p for _, p in seen)
    strings = [{"place": p, "events": k} for p, k in sorted(counts.items(), key=lambda pk: (
        pk[0].hotel, -pk[1], pk[0].string, pk[0].rules))]
    return {"events": data["events"], "seen": seen, "strings": strings, "hotels": resolver.hotels,
            "report": venues_stage.report(seen, resolver)}


def candidate_key(s, hotels):
    """A placed hotel whose name holds a location no key begins, as whole words: "Peachtree Plaza" is in "The Westin
    Peachtree Plaza", a candidate key for the Westin. None where no hotel's does."""
    rx = re.compile(r"(?<!\w)" + re.escape(s.casefold()) + r"(?!\w)")
    return next((h["hotel"] for h in hotels if not h["placeless"] and s and rx.search(h["name"].casefold())), None)


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def n(x):
    return f"{x:,}"


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def code(s):
    """A code span that keeps the string's own spacing; the empty room string of a bare key is shown as such."""
    s = str(s).replace("\n", " ")
    if not s:
        return BARE
    return f"`` {s} ``" if "`" in s else f"`{s}`"


def table(head, rows, align=None):
    """A GFM table; align is one letter a column, l or r (default: the first column left, the rest right). An empty
    cell shows as -."""
    align = align or "l" + "r" * (len(head) - 1)
    rule = ["---" if a == "l" else "---:" for a in align]
    body = [[(str(x) if x != "" else "-").replace("|", "\\|") for x in r] for r in rows]
    return ["| " + " | ".join(r) + " |" for r in [head, rule] + body] + [""]


def many(count, one, more=None):
    return f"{n(count)} {one if count == 1 else more or one + 's'}"


def rooms_text(p):
    return ", ".join(code(r) for r in p.rooms)


def render(data, v, events_path=EVENTS, venues_path=VENUES):
    c = census(data, v)
    rep, strings, hotels = c["report"], c["strings"], c["hotels"]
    total = len(c["events"])
    kinds = venues_stage.KINDS
    by_hotel = defaultdict(list)
    for s in strings:
        by_hotel[s["place"].hotel].append(s)
    in_file = [h["hotel"] for h in hotels]
    shown = [h for h in in_file if h in rep.hotels]
    kind_strings = Counter(s["place"].place for s in strings)
    reached = defaultdict(set)
    for s in strings:
        reached[s["place"].hotel].update(s["place"].rooms)
    file_rooms = [(h["hotel"], lv, r) for h in hotels for lv in h["levels"] for r in lv["rooms"]]
    reached_rooms = [x for x in file_rooms if x[2] in reached[x[0]]]
    unplaced_events = sum(x["events"] for x in rep.unplaced)
    level_events = rep.places["level"]

    out = ["# Room census - the 2026 schedule read by the venues stage", "",
           f"Written by `tools/room_census.py` from `{events_path}` (`generated_at` {data.get('generated_at')}) and "
           f"`{venues_path}`. Do not edit it by hand; run the script again.", "",
           "A record, not held fresh by CI: an edit to the venues file leaves it stale until the script runs again. "
           "Every location of the schedule is read by the venues stage, `venues_stage.py` (DECISIONS #45), as build "
           "will read it - its split, then an alias, an exact room, the grammar's rules, a level, the hotel alone, "
           "or no place at a placeless hotel - and this report has no reading of its own. Section 4 is the curation "
           "worklist; an alias added to the venues file moves a string out of it. Lists run by events, descending, "
           "then by string; room strings are in code spans, so that their spacing and punctuation show, and a bare "
           f"key's empty room string shows as {BARE}.", ""]

    head = [f"Events: {n(total)}, at {many(len(rep.hotels), 'hotel')}; distinct readings of a room string: "
            f"{n(len(strings))}.",
            "By place: " + "; ".join(f"`{k}` {n(rep.places[k])} ({pct(rep.places[k], total)}), "
                                     f"{many(kind_strings[k], 'string')}" for k in kinds) + ".",
            f"The run's venue counters on this schedule: rooms unresolved {n(rep.rooms_unresolved)} - the strings "
            f"read at the hotel alone (section 4); hotels unknown {n(rep.hotels_unknown)} - the locations no key "
            f"begins. Not counted: {many(unplaced_events, 'event')} at an unplaced room of the venues file, read at "
            f"its hotel, and the {many(level_events, 'event')} placed at a level, by design.",
            f"Split again: {many(sum(x['events'] for x in rep.resplit), 'event')} of a placeless hotel, read at a "
            "placed one (section 4).",
            f"Alias hits: {many(sum(x['events'] for x in rep.aliases), 'event')}, in "
            f"{many(len(rep.aliases), 'string')}.",
            f"Rooms of the venues file: {n(len(file_rooms))} on levels, and "
            f"{many(sum(len(h['unplaced']) for h in hotels), 'unplaced room')}. Reached by a reading: "
            f"{n(len(reached_rooms))}; by none: {n(len(file_rooms) - len(reached_rooms))} (section 5)."]
    out += ["## 0. Headline", ""] + [f"{k}. {x}" for k, x in enumerate(head, start=1)] + [""]

    # 1. Hotels
    rows = []
    for h in shown:
        hd = next(x for x in hotels if x["hotel"] == h)
        rows.append([h, n(len(hd["levels"])), n(sum(len(lv["rooms"]) for lv in hd["levels"])),
                     n(sum(rep.hotels[h].values())), n(len(by_hotel[h]))] + [n(rep.hotels[h][k]) for k in kinds])
    out += ["## 1. Hotels", "",
            "Events by place, per hotel as the stage reads it: `exact`, a room of the venues file; `alias`, an alias "
            "of the file; `rule`, a rule of the grammar; `level`, a level and no room; `hotel`, the hotel alone; "
            "`none`, a placeless hotel. `strings` counts distinct readings.", ""]
    out += table(["hotel", "levels", "rooms", "events", "strings"] + list(kinds), rows, "l" + "r" * (4 + len(kinds)))
    unused = [h for h in in_file if h not in rep.hotels]
    out += [f"- Hotels of the venues file with no events: {', '.join(unused) or 'none'}.", ""]

    # 2. The rules
    use = defaultdict(lambda: None)
    for s in sorted(strings, key=lambda s: (-s["events"], s["place"].hotel, s["place"].string)):
        for r in s["place"].rules:
            use[r] = use[r] or s
    rows = []
    for name in venues_stage.RULES:
        fired = rep.rules.get(name, {"strings": 0, "events": 0})
        ex = use[name]
        rows.append([name, f"{code(ex['place'].string)} ({ex['place'].hotel})" if ex else "", n(fired["strings"]),
                     n(fired["events"])])
    out += ["## 2. The rules", "",
            "Each rule of the grammar, in the order the stage tries it, with the strings and events it read: a string "
            "read by a chain of rules - a rewrite and then a rule - counts under each. The example is the rule's most "
            "frequent string.", ""]
    out += table(["rule", "example", "strings", "events"], rows, "llrr")

    # 3. Hotel by hotel
    out += ["## 3. Room strings, hotel by hotel", "",
            "The room string the stage read - the location less its hotel's key - with its place, its level and its "
            "rooms, and the rules that read it, or, at the hotel alone with none, why: an unplaced room, or no "
            "reading. The Mart shows its whole location as its room; the string here is what was read.", ""]
    for h in shown:
        ss = by_hotel[h]
        out += [f"### {h} - {many(sum(s['events'] for s in ss), 'event')}, {many(len(ss), 'string')}", ""]
        out += table(["string", "events", "place", "level", "rooms", "rules"],
                     [[code(s["place"].string), n(s["events"]), s["place"].place, s["place"].level or "",
                       rooms_text(s["place"]), " + ".join(s["place"].rules) or s["place"].why] for s in ss], "lrllll")

    # 4. The worklist
    out += ["## 4. The worklist", "",
            f"### Read at the hotel alone - rooms unresolved, {n(rep.rooms_unresolved)}", "",
            "No reading, or the hotel alone: counted by the run as rooms unresolved. An alias, a room or a key in the "
            "venues file is what moves one.", ""]
    out += table(["hotel", "string", "events", "why"],
                 [[x["hotel"], code(x["string"]), n(x["events"]), x["why"]] for x in rep.unresolved], "llrl")
    out += ["### Unplaced rooms, read at their hotel", "",
            "Rooms the venues file knows but places on no level: read at their hotel, and not counted as unresolved.",
            ""]
    out += table(["hotel", "string", "events"], [[x["hotel"], code(x["string"]), n(x["events"])]
                                                  for x in rep.unplaced], "llr") if rep.unplaced else ["None.", ""]
    out += [f"### Locations no key begins - hotels unknown, {n(rep.hotels_unknown)}", "",
            "Placed at Other, no place. Where a placed hotel's name holds the string, it is a candidate key of that "
            "hotel.", ""]
    out += table(["location", "events", "note"],
                 [[code(x["string"]), n(x["events"]),
                   f"a candidate {candidate_key(x['string'], hotels)} key" if candidate_key(x["string"], hotels)
                   else ""] for x in rep.unknown], "lrl") if rep.unknown else ["None.", ""]
    out += ["### Placeless locations split again", "",
            "A placeless hotel's room string that begins with a placed hotel's key - its own key again aside - read "
            "at that hotel: the source's habit of writing a hotel inside an offsite location.", ""]
    rows = []
    for x in rep.resplit:
        p = next(q for loc, q in c["seen"] if (loc or "").strip() == x["location"])
        rows.append([code(x["location"]), x["hotel"], code(x["string"]), p.place, n(x["events"])])
    out += table(["location", "read at", "string", "place", "events"], rows, "lllrr") if rows else ["None.", ""]

    # 5. Rooms not reached
    out += ["## 5. Rooms of the venues file no string reaches", "",
            "Per level, the rooms a reading names - exactly, by an alias or by a rule - and those none names. The "
            "notes on the levels, and the unplaced rooms, are listed after.", ""]
    rows = []
    for h in hotels:
        for lv in h["levels"]:
            if not lv["rooms"]:
                continue
            missed = [r for r in lv["rooms"] if r not in reached[h["hotel"]]]
            rows.append([h["hotel"], f"{lv['name']} (`{lv['id']}`)", n(len(lv["rooms"])),
                         n(len(lv["rooms"]) - len(missed)), ", ".join(code(r) for r in missed)])
    out += table(["hotel", "level", "rooms", "reached", "not reached"], rows, "llrrl")
    notes = [f"- {h['hotel']}, {lv['name']} (`{lv['id']}`): {code(x)}" for h in hotels for lv in h["levels"]
             for x in lv["notes"]]
    unplaced = [f"- {h['hotel']}: {code(r)} - {note}" for h in hotels for r, note in sorted(h["unplaced"].items())]
    out += ["Notes on the levels:", ""] + (notes or ["None."]) + [""]
    out += ["Unplaced rooms:", ""] + (unplaced or ["None."]) + [""]
    text = "\n".join(out)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.rstrip("\n") + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--events", default=os.path.join(ROOT, EVENTS))
    ap.add_argument("--venues", default=os.path.join(ROOT, VENUES))
    ap.add_argument("--out", default=os.path.join(ROOT, OUT))
    args = ap.parse_args(argv)
    with open(args.events, "rb") as f:
        data = json.loads(f.read().decode("utf-8"))
    v = venues_file.load(args.venues)
    root = os.path.abspath(ROOT)
    shown = lambda p: (os.path.relpath(os.path.abspath(p), root).replace(os.sep, "/")
                       if os.path.abspath(p).startswith(root + os.sep) else os.path.basename(p))
    text = render(data, v, shown(args.events), shown(args.venues))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"{shown(args.out)}: {len(data['events'])} events, {text.count(chr(10))} lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
