#!/usr/bin/env python3
"""The 2026 schedule's rooms against the venues file: docs/venues/census-2026.md.

    python tools/room_census.py            # write docs/venues/census-2026.md
    python tools/room_census.py --events F --venues V --out O

The off-season coverage report for venue resolution (DECISIONS #45; ROADMAP tentpole 1): every room string the frozen
schedule holds, hotel by hotel, and what data/2026/venues.json makes of it. A string matches a room of the venues file
exactly, case-folded, or an alias of the file names it - a confirmed mapping - or neither. For the rest the census
proposes readings - the combined strings ("Regency VI-VII", "209-211") and every other shape the resolver will meet -
each UNSURE, counted apart, and applied to nothing. The hotel split is still scraper.split_hotel's, until PR 5 builds
the venues step. It reads the frozen schedule and the venues file and writes neither (DECISIONS #13; the venues file is
hand-edited).

A record, not held fresh by CI: its preface names the venues file it read, and an edit to that file leaves it stale
until the script runs again. `scraper` for `split_hotel` and `norm_text`, `venues` for the loader, and the standard
library; deterministic - two runs write the same bytes.
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
from scraper import norm_text, split_hotel  # noqa: E402  (nothing else from the scraper)

EVENTS = "data/2026/events.json"
VENUES = "data/2026/venues.json"
OUT = "docs/venues/census-2026.md"
UNPLACED = "unplaced"
SPAN = 20  # the longest run a rule reads: "209-211" is three rooms; "1-40" is not a room string
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
         "XVII", "XVIII", "XIX", "XX"]
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
            "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
            "nineteenth", "twentieth"]


# ---------------------------------------------------------------------------
# The venues file
# ---------------------------------------------------------------------------

def venue_rooms(hotels):
    """{hotel: {case-folded room: (level id, level name, the room as written)}}. A hotel's unplaced rooms sit on a
    level of their own, "unplaced"."""
    out = {}
    for h in hotels:
        rooms = out.setdefault(h["hotel"], {})
        for lv in h["levels"]:
            for r in lv["rooms"]:
                rooms.setdefault(r.casefold(), (lv["id"], lv["name"], r))
        for r in sorted(h["unplaced"]):
            rooms.setdefault(r.casefold(), (UNPLACED, UNPLACED, r))
    return out


def levels_of(hotels):
    """{hotel: [(level id, level name)]}, in the file's order."""
    return {h["hotel"]: [(lv["id"], lv["name"]) for lv in h["levels"]] for h in hotels}


def notes_of(hotels):
    """{hotel: [(level id, level name, note)]}: every note on the hotel's levels, in the file's order."""
    return {h["hotel"]: [(lv["id"], lv["name"], note) for lv in h["levels"] for note in lv["notes"]] for h in hotels}


def aliases_of(hotels):
    """{hotel: {alias: (level id, level name, [room ids])}}. An alias is written folded (venues.py)."""
    return {h["hotel"]: {a: (lv["id"], lv["name"], list(rooms)) for lv in h["levels"]
                         for a, rooms in sorted(lv["aliases"].items())} for h in hotels}


def note_naming(part, notes):
    """The note on one of the hotel's levels that names this room as a whole word, if one does."""
    rx = re.compile(r"(?<!\w)" + re.escape(part) + r"(?!\w)", re.I)
    return next((note for note in sorted(n[2] for n in notes) if rx.search(note)), None)


# ---------------------------------------------------------------------------
# Readings. A combined-string rule turns one string into its rooms; the other shapes rewrite a string, or read it
# as something that is not one room. Every reading is UNSURE, and none is applied to anything - but an alias's, which
# the venues file confirms.
# ---------------------------------------------------------------------------

def _ascending(letters):
    return all(a < b for a, b in zip(letters, letters[1:]))


# The name before a run: one to three words, each starting with a letter. A longer lead-in is a sentence with a
# run in it ("Galleria 2-3 Hallway Just outside Galleria 2-3"), which the trailing-note reading takes instead.
NAME = r"([A-Za-z][\w'&.]*(?:\s[A-Za-z][\w'&.]*){0,2})"


def numeric_run(s):
    """"209-211", "A601-A602": numbers, with one prefix letter the same on both ends or none."""
    m = re.fullmatch(r"([A-Za-z]?)(\d+)\s*-\s*\1(\d+)", s)
    if not m or len(m.group(2)) != len(m.group(3)):
        return None
    a, b = int(m.group(2)), int(m.group(3))
    return [f"{m.group(1)}{x:0{len(m.group(2))}d}" for x in range(a, b + 1)] if a < b <= a + SPAN else None


def roman_run(s):
    """"Regency VI-VII", "Centennial II-IV": a name, then a run of roman numerals."""
    m = re.fullmatch(NAME + r"\s+([IVX]+)\s*-\s*([IVX]+)", s)
    if not m or m.group(2) not in ROMAN or m.group(3) not in ROMAN:
        return None
    a, b = ROMAN.index(m.group(2)), ROMAN.index(m.group(3))
    return [f"{m.group(1)} {ROMAN[x]}" for x in range(a, b + 1)] if a < b else None


def letter_run(s):
    """"Hanover C-E", "Chastain H-I-J": a name, then capital letters joined by hyphens - two ends a range, more a
    list."""
    m = re.fullmatch(NAME + r"\s+([A-Z](?:\s*-\s*[A-Z])+)", s)
    if not m:
        return None
    letters = [x.strip() for x in m.group(2).split("-")]
    if len(letters) == 2:
        if not letters[0] < letters[1]:
            return None
        letters = [chr(x) for x in range(ord(letters[0]), ord(letters[1]) + 1)]
    return [f"{m.group(1)} {x}" for x in letters] if _ascending(letters) else None


def number_run(s):
    """"Galleria 2-3", "Chastain 1-2": a name, then a run of numbers."""
    m = re.fullmatch(NAME + r"\s+(\d+)\s*-\s*(\d+)", s)
    if not m:
        return None
    a, b = int(m.group(2)), int(m.group(3))
    return [f"{m.group(1)} {x}" for x in range(a, b + 1)] if a < b <= a + SPAN else None


def letters_together(s):
    """"Embassy AB", "Hanover FG": a name, then capital letters run together, in order, one room each."""
    m = re.fullmatch(NAME + r"\s+([A-Z]{2,})", s)
    return [f"{m.group(1)} {x}" for x in m.group(2)] if m and _ascending(m.group(2)) else None


def number_letters(s):
    """"Mart2 203BC": a room number, then letters run together, in order, one room each ("203B", "203C")."""
    m = re.fullmatch(r"(?:" + NAME + r"\s)?(\d+)([A-Z]{2,})", s)
    lead = f"{m.group(1)} " if m and m.group(1) else ""
    return [f"{lead}{m.group(2)}{x}" for x in m.group(3)] if m and _ascending(m.group(3)) else None


def slash_list(s):
    """"Savannah Ballroom B/C": a name, then letters or numbers split by slashes."""
    m = re.fullmatch(NAME + r"\s+([A-Z0-9]+(?:/[A-Z0-9]+)+)", s)
    return [f"{m.group(1)} {x}" for x in m.group(2).split("/")] if m else None


def word_pair(s):
    """"International North-South": a name, then two words joined by a hyphen, one room each."""
    m = re.fullmatch(NAME + r"\s+([A-Z][a-z]+)-([A-Z][a-z]+)", s)
    return [f"{m.group(1)} {m.group(2)}", f"{m.group(1)} {m.group(3)}"] if m else None


COMBINED = [("numeric run", numeric_run), ("roman run", roman_run), ("letter run", letter_run),
            ("number run", number_run), ("letters together", letters_together), ("number and letters", number_letters),
            ("slash list", slash_list), ("word pair", word_pair)]


def initials(hotel):
    return "".join(w[0] for w in hotel.split())


def courtland_prefix(s, hotel):
    """"Grand Athens" at the Courtland Grand is Athens: split_hotel cut only the hotel's first word (section 6)."""
    return s[len("Grand "):] if hotel == "Courtland Grand" and s.startswith("Grand ") else None


def doubled(s, hotel):
    """"Crystal Ballroom Crystal Ballroom": one string, twice."""
    m = re.fullmatch(r"(.+?)\s+\1", s)
    return m.group(1) if m else None


def hotel_prefix(s, hotel):
    """"Hilton-Salon", "Marriott-A703", "H-Piedmont": the hotel's name or initials and a hyphen, then the room."""
    m = re.fullmatch(r"([A-Za-z]+)-(\S.*)", s)
    return m.group(2) if m and m.group(1).casefold() in (hotel.casefold(), initials(hotel).casefold()) else None


def leading_the(s, hotel):
    """"The Learning Center": the room's name after a leading "The"."""
    m = re.fullmatch(r"The\s+(.+)", s)
    return m.group(1) if m else None


REWRITES = [("Courtland prefix", courtland_prefix), ("doubled", doubled), ("hotel prefix", hotel_prefix),
            ("leading The", leading_the)]


def partitions(s, rooms):
    """A bare name that begins two or more rooms of the venues file, as whole words: "Atrium Ballroom" is Atrium
    Ballroom A, B, C and D."""
    key = s.casefold() + " "
    hits = [entry[2] for folded, entry in sorted(rooms.items()) if folded.startswith(key)]
    return hits if len(hits) >= 2 else None


def floor_only(s, levels):
    """"14th Floor", "5th": a floor and no room. (floor number, the level named for it or None)."""
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)(?:\s+floor)?", s, re.I)
    if not m or not 1 <= int(m.group(1)) <= len(ORDINALS):
        return None
    k = int(m.group(1))
    names = {f"{ORDINALS[k - 1]} floor", f"level {k}"}
    return k, next((lid for lid, name in levels if name.casefold() in names), None)


def trailing_note(s, rooms):
    """"Grand Hall D Poole Booth 111 for more info!!": a room - the longest leading run of whole words that is a
    room of the venues file, or that a combined rule reads - then words about it. (rule names, rooms), or None."""
    words = s.split()
    for k in range(len(words) - 1, 0, -1):
        head = " ".join(words[:k]).rstrip(",;:-")
        if head.casefold() in rooms:
            return ["trailing note"], [head]
        for name, rule in COMBINED:
            parts = rule(head)
            if parts:
                return ["trailing note", name], parts
    return None


def numeral_swap(room):
    """"Augusta 3" with its number as a roman numeral: "Augusta III". One way only - a lone I after a name is as
    often a letter ("Chastain H-I-J") as a numeral."""
    m = re.fullmatch(r"(.*\S)\s+(\d+)", room)
    return f"{m.group(1)} {ROMAN[int(m.group(2)) - 1]}" if m and 1 <= int(m.group(2)) <= len(ROMAN) else None


def resolve(s, hotel, rooms, levels, aliases=None):
    """How the census reads one room string: {"chain": the rules, in order; "parts": the rooms it names; "floor",
    "level": a floor with no room; "hotel_only": the hotel and no room}. No chain, and the string as its one part,
    is an exact match or no reading at all. An alias of the venues file - the string folded, as venues.py writes
    one - is read before any rule, and its chain is ["alias"]: #45's aliases beat the grammar."""
    folded = venues_file.folded(s)
    if s.casefold() not in rooms and folded in (aliases or {}):
        return {"chain": ["alias"], "parts": list(aliases[folded][2]), "floor": None, "level": None,
                "hotel_only": False}
    chain, cur = [], s
    for name, rewrite in REWRITES:
        new = rewrite(cur, hotel)
        if new:
            chain.append(name)
            cur = new
    out = {"chain": chain, "parts": [cur], "floor": None, "level": None, "hotel_only": False}
    if cur.casefold() not in rooms:
        for name, rule in COMBINED:
            parts = rule(cur)
            if parts:
                out = {**out, "chain": chain + [name], "parts": parts}
                break
        else:
            parts = partitions(cur, rooms)
            floor = floor_only(cur, levels)
            note = trailing_note(cur, rooms)
            if parts:
                out = {**out, "chain": chain + ["partitions"], "parts": parts}
            elif cur.casefold() == hotel.casefold():
                return {**out, "chain": chain + ["hotel only"], "parts": [], "hotel_only": True}
            elif floor:
                return {**out, "chain": chain + ["floor only"], "parts": [], "floor": floor[0], "level": floor[1]}
            elif note:
                out = {**out, "chain": chain + note[0], "parts": note[1]}
    swapped = [numeral_swap(p) if p.casefold() not in rooms and (numeral_swap(p) or "").casefold() in rooms else p
               for p in out["parts"]]
    if swapped != out["parts"]:
        out = {**out, "chain": out["chain"] + ["numeral style"], "parts": swapped}
    return out


SHAPES = [name for name, _ in REWRITES] + ["partitions", "hotel only", "floor only", "trailing note", "numeral style"]
COMBINED_NAMES = [name for name, _ in COMBINED]


def kind(reading, exact):
    """exact; alias, a confirmed mapping of the venues file; combined, a combined-string rule alone; shape, one of the
    other shapes, alone or with a combined rule; or none."""
    if exact and not reading["chain"]:
        return "exact"
    if reading["chain"] == ["alias"]:
        return "alias"
    if not reading["chain"]:
        return "none"
    return "shape" if any(r in SHAPES for r in reading["chain"]) else "combined"


# ---------------------------------------------------------------------------
# The census
# ---------------------------------------------------------------------------

def census(data, v):
    """Every (hotel, room string) in the schedule with its count, its exact match, its reading and the rooms the
    reading names, and how many events split_hotel still splits as stored."""
    events = data["events"]
    hotels = v.hotels()
    rooms, levels, notes, aliases = venue_rooms(hotels), levels_of(hotels), notes_of(hotels), aliases_of(hotels)
    counts = Counter((e.get("hotel") or "", e.get("room") or "") for e in events)
    strings = []
    for (hotel, s), count in sorted(counts.items(), key=lambda kv: (kv[0][0], -kv[1], kv[0][1])):
        hr = rooms.get(hotel, {})
        reading = resolve(s, hotel, hr, levels.get(hotel, []), aliases.get(hotel, {}))
        strings.append({"hotel": hotel, "string": s, "events": count, "exact": hr.get(s.casefold()),
                        "reading": reading, "hits": [(p, hr.get(p.casefold())) for p in reading["parts"]],
                        "kind": kind(reading, hr.get(s.casefold()))})
    return {"events": events, "strings": strings, "hotels": hotels, "rooms": rooms, "levels": levels, "notes": notes,
            "aliases": aliases,
            "split_ok": sum(1 for e in events if split_hotel(e.get("location")) == (e.get("hotel"), e.get("room")))}


def reached_levels(item):
    """The levels a string's rooms land on, in first-seen order: [(level id, level name)]."""
    out = []
    for _, hit in item["hits"]:
        if hit and (hit[0], hit[1]) not in out:
            out.append((hit[0], hit[1]))
    return out


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def n(x):
    return f"{x:,}"


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def code(s):
    """A code span that keeps the string's own spacing, so "Galleria  5" shows its two spaces."""
    s = str(s).replace("\n", " ")
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


def listed(items):
    return ", ".join(f"{code(s['string'])} ({n(s['events'])})" for s in items) or "none"


def level_label(lid, name):
    return "unplaced" if lid == UNPLACED else f"{name} (`{lid}`)"


def reading_text(item):
    r = item["reading"]
    if not r["chain"]:
        return ""
    head = " + ".join(r["chain"])
    if r["hotel_only"]:
        return f"{head}: the hotel, no room"
    if r["floor"] is not None:
        return f"{head}: floor {r['floor']}, no room"
    return f"{head} → {', '.join(code(p) for p in r['parts'])}"


def venue_text(item, notes, levels):
    """What the venues file holds of a string's reading - or, for a string with none, whether a note on one of the
    hotel's levels names it."""
    r = item["reading"]
    if not r["chain"]:
        if item["exact"]:
            return ""
        note = note_naming(item["string"], notes)
        return f"named in the note {code(note)}" if note else ""
    if r["hotel_only"]:
        return "the hotel"
    if r["floor"] is not None:
        return level_label(r["level"], dict(levels)[r["level"]]) if r["level"] else "no level named for it"
    found = sum(1 for _, h in item["hits"] if h)
    text = f"{n(found)} of {n(len(item['hits']))}"
    where = reached_levels(item)
    if where:
        text += ": " + ", ".join(level_label(*x) for x in where)
    by_note = defaultdict(list)
    for p, h in item["hits"]:
        note = None if h else note_naming(p, notes)
        if note:
            by_note[note].append(p)
    named = [f"{', '.join(code(p) for p in ps)} {'is' if len(ps) == 1 else 'are'} named in the note {code(x)}"
             for x, ps in by_note.items()]
    return text + (f"; {'; '.join(named)}" if named else "")


def render(data, v, events_path=EVENTS, venues_path=VENUES):
    c = census(data, v)
    strings, rooms, levels, notes = c["strings"], c["rooms"], c["levels"], c["notes"]
    in_file = [h["hotel"] for h in c["hotels"]]
    by_hotel = defaultdict(list)
    for s in strings:
        by_hotel[s["hotel"]].append(s)
    hotel_events = Counter(e.get("hotel") or "" for e in c["events"])
    hotels = sorted(hotel_events, key=lambda h: (-hotel_events[h], h))
    total = len(c["events"])
    kinds, kind_events = Counter(), Counter()
    for s in strings:
        kinds[s["kind"]] += 1
        kind_events[s["kind"]] += s["events"]
    file_rooms = [(h, e) for h, hr in rooms.items() for e in hr.values()]
    all_notes = [(h, x) for h, xs in notes.items() for x in xs]
    exact_hit = {(s["hotel"], s["exact"][2]) for s in strings if s["exact"]}
    alias_hit = {(s["hotel"], h[2]) for s in strings if s["kind"] == "alias" for _, h in s["hits"] if h}
    rule_hit = {(s["hotel"], h[2]) for s in strings if s["kind"] in ("combined", "shape") for _, h in s["hits"] if h}
    absent = [h for h in hotels if h not in in_file]
    empty = [h for h in in_file if not rooms.get(h)]
    courtland = by_hotel.get("Courtland Grand", [])
    prefixed = [s for s in courtland if s["string"].startswith("Grand ")]

    out = ["# Room census - the 2026 schedule against the venues file", "",
           f"Written by `tools/room_census.py` from `{events_path}` (`generated_at` {data.get('generated_at')}) and "
           f"`{venues_path}`. Do not edit it by hand; run the script again.", "",
           "A record, not held fresh by CI: an edit to the venues file leaves it stale until the script runs again. "
           "It states facts and changes nothing. A room string matches a room of the venues file exactly, "
           "case-folded, or an alias of the file names it - a confirmed mapping - or neither; every other reading "
           "here is a proposal, `UNSURE`, and applied to nothing - the venues file and the scraper are as they were. "
           "The combined-string rules and the other shapes are counted apart. Lists run by count, descending, then by "
           "string; room strings are in code spans, so that their spacing and punctuation show.", ""]

    head = [f"Events: {n(total)}, at {many(len(hotels), 'hotel value')}; distinct (hotel, room) strings: "
            f"{n(len(strings))}.",
            f"An exact match to a room of the venues file: {many(kinds['exact'], 'string')}, "
            f"{n(kind_events['exact'])} events ({pct(kind_events['exact'], total)}). Through an alias: "
            f"{many(kinds['alias'], 'string')}, {n(kind_events['alias'])} events "
            f"({pct(kind_events['alias'], total)}).",
            f"A combined-string rule alone, UNSURE: {many(kinds['combined'], 'string')}, "
            f"{n(kind_events['combined'])} events ({pct(kind_events['combined'], total)}). One of the other shapes, "
            f"UNSURE: {many(kinds['shape'], 'string')}, {n(kind_events['shape'])} events "
            f"({pct(kind_events['shape'], total)}).",
            f"No reading: {many(kinds['none'], 'string')}, {n(kind_events['none'])} events "
            f"({pct(kind_events['none'], total)}).",
            "Hotels in the schedule and not in the venues file: "
            + (", ".join(f"{h} ({many(hotel_events[h], 'event')})" for h in absent) or "none")
            + ". In the venues file with no rooms: "
            + (", ".join(f"{h} ({many(hotel_events.get(h, 0), 'event')})" for h in empty) or "none")
            + "."
            + ("" if "Unknown" in absent or "Unknown" in empty
               else f" `Unknown`: {n(hotel_events.get('Unknown', 0))} events."),
            f"The Courtland prefix: {n(sum(s['events'] for s in prefixed))} of "
            f"{n(sum(s['events'] for s in courtland))} Courtland Grand events, {n(len(prefixed))} of "
            f"{n(len(courtland))} strings (section 6).",
            f"Rooms of the venues file: {n(len(file_rooms))}, and {many(len(all_notes), 'note')} on its levels. "
            f"Matched exactly: {n(len(exact_hit))}. Through an alias: {n(len(alias_hit - exact_hit))}. Named only by "
            f"a proposal: {n(len(rule_hit - exact_hit - alias_hit))}. Neither: "
            f"{n(len(file_rooms) - len(exact_hit | alias_hit | rule_hit))}.",
            f"`split_hotel(location)` gives the stored hotel and room for {n(c['split_ok'])} of {n(total)} events."]
    out += ["## 0. Headline", ""] + [f"{k}. {x}" for k, x in enumerate(head, start=1)] + [""]

    # 1. Hotels
    rows = []
    for h in hotels:
        k = Counter()
        for s in by_hotel[h]:
            k[s["kind"]] += s["events"]
        rows.append([h, "yes" if h in in_file else "no", n(len(levels[h])) if h in levels else "",
                     n(len(rooms[h])) if h in rooms else "", n(hotel_events[h]), n(len(by_hotel[h])),
                     n(k["exact"]), n(k["alias"]), n(k["combined"]), n(k["shape"]), n(k["none"])])
    out += ["## 1. Hotels", "",
            "Events by how their room string reads: `exact`, an exact match to a room of the venues file; `alias`, an "
            "alias of the file, a confirmed mapping; `combined`, a combined-string rule alone; `shape`, one of the "
            "other shapes, alone or with a combined rule; `none`, no reading. `combined` and `shape` are proposals, "
            "UNSURE.", ""]
    out += table(["hotel", "in the venues file", "levels", "rooms", "events", "strings", "exact", "alias", "combined",
                  "shape", "none"], rows, "llrrrrrrrrr")
    unused = [h for h in in_file if h not in hotel_events]
    out += [f"- Hotels of the venues file with no events: {', '.join(unused) or 'none'}. `Unknown`, the scraper's "
            f"hotel for an empty location: {n(hotel_events.get('Unknown', 0))} events.", ""]

    # 2. The readings
    use = defaultdict(lambda: [0, 0, None])
    for s in sorted(strings, key=lambda s: (-s["events"], s["hotel"], s["string"])):
        for r in s["reading"]["chain"]:
            use[r][0] += 1
            use[r][1] += s["events"]
            use[r][2] = use[r][2] or s
    rows = []
    for name in COMBINED_NAMES + SHAPES:
        cnt, ev, ex = use.get(name, [0, 0, None])
        rows.append([name, "combined string" if name in COMBINED_NAMES else "other shape",
                     f"{code(ex['string'])} ({ex['hotel']})" if ex else "", n(cnt), n(ev)])
    out += ["## 2. The readings", "",
            "Every reading is UNSURE. A string takes each rewrite that fits it - the Courtland prefix, a doubled "
            "string, a hotel prefix, a leading \"The\", in that order - and then one reading: an exact match, a "
            "combined-string rule, partitions, the hotel alone, a floor alone, or a room and a trailing note. Last, "
            "a room the venues file lacks is tried with its number written the other way (numeral style). A string "
            "counts under each rule it takes; the example is the rule's most frequent string. An alias is read "
            "before all of these, and is no proposal.", ""]
    out += table(["rule", "kind", "example", "strings", "events"], rows, "lllrr")

    # 3. Hotel by hotel
    out += ["## 3. Room strings, hotel by hotel", "",
            "`exact` is the level of an exact match to a room of the venues file. `reading` is a proposal, UNSURE - "
            "but an alias's, which the file confirms: the rules a string took and the rooms it names. `in the venues "
            "file` counts those rooms in the file, and where they are; for a string with no reading, whether a note "
            "on one of the hotel's levels names it.", ""]
    for h in hotels:
        ss = by_hotel[h]
        out += [f"### {h} - {many(hotel_events[h], 'event')}, {many(len(ss), 'string')}", ""]
        if h not in in_file:
            out += ["Not in the venues file.", ""]
        elif not rooms.get(h):
            out += ["In the venues file with no rooms: " + ("its levels list none." if levels.get(h)
                                                            else "it has no levels."), ""]
        rows = [[code(s["string"]), n(s["events"]), level_label(s["exact"][0], s["exact"][1]) if s["exact"] else "",
                 reading_text(s), venue_text(s, notes.get(h, []), levels.get(h, []))] for s in ss]
        out += table(["string", "events", "exact", "reading", "in the venues file"], rows, "lrlll")

    # 4. No reading
    none = sorted((s for s in strings if s["kind"] == "none"), key=lambda s: (-s["events"], s["hotel"], s["string"]))
    out += ["## 4. Strings no rule reaches", "",
            f"{many(len(none), 'string')}, {many(sum(s['events'] for s in none), 'event')}: no exact match, no alias, "
            "and no reading in section 2.", ""]
    out += table(["hotel", "string", "events", "a note names it"],
                 [[s["hotel"], code(s["string"]), n(s["events"]),
                   code(note_naming(s["string"], notes.get(s["hotel"], [])))
                   if note_naming(s["string"], notes.get(s["hotel"], [])) else ""] for s in none], "llrl")

    # 5. Rooms not seen
    out += ["## 5. Rooms of the venues file not seen", "",
            "Per level, the rooms no string matches exactly or through an alias: those a proposal names (UNSURE), and "
            "those nothing names. The notes on the levels are listed after.", ""]
    rows = []
    for hd in c["hotels"]:
        h = hd["hotel"]
        for lid, name in levels.get(h, []) + ([(UNPLACED, UNPLACED)] if hd["unplaced"] else []):
            entries = [e[2] for e in rooms.get(h, {}).values() if e[0] == lid]
            if not entries:
                continue
            unseen = [r for r in entries if (h, r) not in exact_hit and (h, r) not in alias_hit]
            rows.append([h, level_label(lid, name), n(len(entries)), n(len(entries) - len(unseen)),
                         ", ".join(code(r) for r in unseen if (h, r) in rule_hit),
                         ", ".join(code(r) for r in unseen if (h, r) not in rule_hit)])
    out += table(["hotel", "level", "rooms", "matched exactly or by an alias", "named only by a proposal (UNSURE)",
                  "named by nothing"], rows, "llrrll")
    out += ["Notes on the levels:", ""]
    out += [f"- {h}, {level_label(lid, name)}: {code(x)}" for h, (lid, name, x) in all_notes] + [""]

    # 6. split_hotel
    ct = [e for e in c["events"] if e.get("hotel") == "Courtland Grand"]
    whole = [e for e in ct if (e.get("location") or "").startswith("Courtland Grand ")]
    hyph = Counter(e.get("location") for e in c["events"]
                   if "-" in re.split(r"[\s,]", e.get("location") or "", maxsplit=1)[0]
                   and e.get("hotel") not in ("Other", "Unknown"))
    out += ["## 6. `split_hotel`: the Courtland prefix and hyphenated locations", "",
            "`split_hotel` takes the location's first word - up to a space or a comma - as the hotel, and the rest "
            "as the room.", "",
            f"The Courtland prefix: {n(len(whole))} of the {n(len(ct))} Courtland Grand events have a location that "
            "begins \"Courtland Grand \". The first word matches `courtland`, only that word is cut, and the room "
            "keeps \"Grand \""
            + (f": `split_hotel({whole[0]['location']!r})` is `{split_hotel(whole[0]['location'])!r}`." if whole
               else "."), "",
            "With \"Grand \" cut, UNSURE:", ""]
    rows = []
    for s in courtland:
        if not s["string"].startswith("Grand "):
            rows.append([code(s["string"]), n(s["events"]), "", ""])
            continue
        cut = s["string"][len("Grand "):]
        r = resolve(cut, "Courtland Grand", rooms.get("Courtland Grand", {}), levels.get("Courtland Grand", []),
                    c["aliases"].get("Courtland Grand", {}))
        exact = not r["chain"] and cut.casefold() in rooms.get("Courtland Grand", {})
        rows.append([code(s["string"]), n(s["events"]), code(cut),
                     "an exact match" if exact else " + ".join(r["chain"]) if r["chain"] else "no reading"])
    out += table(["string", "events", "cut", "then"], rows, "lrll")
    out += [f"Hyphenated locations: {many(sum(hyph.values()), 'event')} at a hotel `split_hotel` recognised have a "
            "location whose first word joins the hotel to what follows with a hyphen. With nothing after that word "
            "the room is the whole location; with words after it, the word after the hyphen is lost:", ""]
    out += [f"- {code(loc)} ({n(k)}): `{split_hotel(loc)!r}`" for loc, k in sorted(hyph.items(),
                                                                                   key=lambda kv: (-kv[1], kv[0]))]
    out += ["", "The 2027 fix, proposed and applied to nothing: match the venue's name as the source writes it, "
            "longest first, and cut all of it - \"Courtland Grand\" before \"Courtland\" - splitting at a hyphen as "
            "well as at a space or a comma. \"Courtland Grand Athens\" would give (\"Courtland Grand\", \"Athens\"), "
            "\"Hilton-Salon\" (\"Hilton\", \"Salon\") and \"Hyatt-Grand Hall D\" (\"Hyatt\", \"Grand Hall D\"). The "
            "frozen file keeps the rooms it has (DECISIONS #13).", ""]

    # 7. The strings that reach each level
    out += ["## 7. Strings that reach each level", "",
            "Each level with the strings that reach it: by an exact match, through an alias, and by a proposal "
            "(UNSURE). A string whose rooms land on two levels is listed under both. Nothing here is written to the "
            "venues file.", ""]
    for hd in c["hotels"]:
        h = hd["hotel"]
        for lid, name in levels.get(h, []):
            ex = [s for s in by_hotel.get(h, []) if s["kind"] == "exact" and s["exact"][0] == lid]
            al = [s for s in by_hotel.get(h, []) if s["kind"] == "alias" and lid in [x[0] for x in reached_levels(s)]]
            prop = [s for s in by_hotel.get(h, []) if s["kind"] in ("combined", "shape")
                    and (lid in [x[0] for x in reached_levels(s)] or s["reading"]["level"] == lid)]
            if not (ex or al or prop):
                continue
            out += [f"### {h} - {name} (`{lid}`)", "", f"- By an exact match: {listed(ex)}."]
            if al:
                out.append(f"- Through an alias: {listed(al)}.")
            out += [f"- By a proposal, UNSURE: {listed(prop)}.", ""]

    # 8. norm_text
    groups = defaultdict(list)
    for s in strings:
        groups[(s["hotel"], norm_text(s["string"]))].append(s)
    folded = sorted((k, v) for k, v in groups.items() if len(v) > 1)
    out += ["## 8. Strings the dedupe reads as one room", "",
            "Distinct strings at one hotel that `norm_text` - the dedupe's rule: case, spacing and trailing "
            f"punctuation - makes one: {many(len(folded), 'group')}.", ""]
    out += [f"- {h}: {listed(v)}" for (h, _), v in folded]
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
