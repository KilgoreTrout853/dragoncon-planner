#!/usr/bin/env python3
"""The 2026 schedule's rooms against the venues registry: docs/venues/census-2026.md.

    python tools/room_census.py            # write docs/venues/census-2026.md
    python tools/room_census.py --events F --registry R --out O

Evidence for the venue-resolution stage of Pipeline shape (ROADMAP tentpole 1; DECISIONS #21, #27, #28, #37):
every room string the frozen schedule holds, hotel by hotel, and what docs/venues/registry.json makes of it. A
string matches a registry room exactly, case-folded, or it does not. For the rest the census proposes readings -
the combined strings ("Regency VI-VII", "209-211") and every other shape the resolver will meet - each UNSURE,
counted apart, and applied to nothing. It reads the frozen schedule and the registry and writes neither
(DECISIONS #13; the registry is hand-edited).

A record, not held fresh by CI: its preface names the registry version it read, and a registry edit leaves it
stale until the script runs again. `scraper` for `split_hotel` and `norm_text`, and the standard library;
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

from scraper import norm_text, split_hotel  # noqa: E402  (nothing else from the scraper)

EVENTS = "data/2026/events.json"
REGISTRY = "docs/venues/registry.json"
OUT = "docs/venues/census-2026.md"
UNPLACED = "unplaced"
ELLIPSIS = chr(0x2026)
SPAN = 20  # the longest run a rule reads: "209-211" is three rooms; "1-40" is not a room string
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
         "XVII", "XVIII", "XIX", "XX"]
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
            "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
            "nineteenth", "twentieth"]


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

def registry_rooms(reg):
    """{hotel: {case-folded room: (level id, level name, the room as written)}}. A hotel's unplaced rooms sit on a
    level of their own, "unplaced"."""
    out = {}
    for h in reg["hotels"]:
        rooms = out.setdefault(h["hotel"], {})
        for lv in h.get("levels", []):
            for r in lv.get("rooms", []):
                rooms.setdefault(r.casefold(), (lv["id"], lv["name"], r))
        for r in h.get("unplaced", []):
            rooms.setdefault(r.casefold(), (UNPLACED, UNPLACED, r))
    return out


def levels_of(reg):
    """{hotel: [(level id, level name)]}, in the registry's order."""
    return {h["hotel"]: [(lv["id"], lv["name"]) for lv in h.get("levels", [])] for h in reg["hotels"]}


def is_note(room):
    """A registry room entry that holds a note rather than one room: a parenthesis or an ellipsis."""
    return "(" in room or ELLIPSIS in room


def note_naming(part, rooms):
    """The registry entry holding a note that names this room as a whole word, if one does."""
    rx = re.compile(r"(?<!\w)" + re.escape(part) + r"(?!\w)", re.I)
    return next((e[2] for _, e in sorted(rooms.items()) if is_note(e[2]) and rx.search(e[2])), None)


# ---------------------------------------------------------------------------
# Readings. A combined-string rule turns one string into its rooms; the other shapes rewrite a string, or read it
# as something that is not one room. Every reading is UNSURE, and none is applied to anything.
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
    """A bare name that begins two or more registry rooms, as whole words: "Atrium Ballroom" is Atrium Ballroom A,
    B, C and D."""
    key = s.casefold() + " "
    hits = [entry[2] for folded, entry in sorted(rooms.items()) if folded.startswith(key) and not is_note(entry[2])]
    return hits if len(hits) >= 2 else None


def floor_only(s, levels):
    """"14th Floor", "5th": a floor and no room. (floor number, the registry level named for it or None)."""
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)(?:\s+floor)?", s, re.I)
    if not m or not 1 <= int(m.group(1)) <= len(ORDINALS):
        return None
    k = int(m.group(1))
    names = {f"{ORDINALS[k - 1]} floor", f"level {k}"}
    return k, next((lid for lid, name in levels if name.casefold() in names), None)


def trailing_note(s, rooms):
    """"Grand Hall D Poole Booth 111 for more info!!": a room - the longest leading run of whole words that is a
    registry room, or that a combined rule reads - then words about it. (rule names, rooms), or None."""
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


def resolve(s, hotel, rooms, levels):
    """How the census reads one room string: {"chain": the rules, in order; "parts": the rooms it names; "floor",
    "level": a floor with no room; "hotel_only": the hotel and no room}. No chain, and the string as its one part,
    is an exact match or no reading at all."""
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
    """exact; combined, a combined-string rule alone; shape, one of the other shapes, alone or with a combined
    rule; or none."""
    if exact and not reading["chain"]:
        return "exact"
    if not reading["chain"]:
        return "none"
    return "shape" if any(r in SHAPES for r in reading["chain"]) else "combined"


# ---------------------------------------------------------------------------
# The census
# ---------------------------------------------------------------------------

def census(data, reg):
    """Every (hotel, room string) in the schedule with its count, its exact match, its reading and the rooms the
    reading names, and how many events split_hotel still splits as stored."""
    events = data["events"]
    rooms, levels = registry_rooms(reg), levels_of(reg)
    counts = Counter((e.get("hotel") or "", e.get("room") or "") for e in events)
    strings = []
    for (hotel, s), count in sorted(counts.items(), key=lambda kv: (kv[0][0], -kv[1], kv[0][1])):
        hr = rooms.get(hotel, {})
        reading = resolve(s, hotel, hr, levels.get(hotel, []))
        strings.append({"hotel": hotel, "string": s, "events": count, "exact": hr.get(s.casefold()),
                        "reading": reading, "hits": [(p, hr.get(p.casefold())) for p in reading["parts"]],
                        "kind": kind(reading, hr.get(s.casefold()))})
    return {"events": events, "strings": strings, "rooms": rooms, "levels": levels,
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


def registry_text(item, rooms, levels):
    """What the registry holds of a string's reading - or, for a string with none, whether a registry note names
    it."""
    r = item["reading"]
    if not r["chain"]:
        if item["exact"]:
            return ""
        note = note_naming(item["string"], rooms)
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
        note = None if h else note_naming(p, rooms)
        if note:
            by_note[note].append(p)
    named = [f"{', '.join(code(p) for p in ps)} {'is' if len(ps) == 1 else 'are'} named in the note {code(x)}"
             for x, ps in by_note.items()]
    return text + (f"; {'; '.join(named)}" if named else "")


def render(data, reg, events_path=EVENTS, registry_path=REGISTRY):
    c = census(data, reg)
    strings, rooms, levels = c["strings"], c["rooms"], c["levels"]
    in_reg = [h["hotel"] for h in reg["hotels"]]
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
    reg_rooms = [(h, e) for h, hr in rooms.items() for e in hr.values() if not is_note(e[2])]
    note_rooms = [(h, e) for h, hr in rooms.items() for e in hr.values() if is_note(e[2])]
    exact_hit = {(s["hotel"], s["exact"][2]) for s in strings if s["exact"]}
    rule_hit = {(s["hotel"], h[2]) for s in strings if s["kind"] in ("combined", "shape") for _, h in s["hits"] if h}
    absent = [h for h in hotels if h not in in_reg]
    empty = [h for h in in_reg if not rooms.get(h)]
    courtland = by_hotel.get("Courtland Grand", [])
    prefixed = [s for s in courtland if s["string"].startswith("Grand ")]

    out = ["# Room census - the 2026 schedule against the venues registry", "",
           f"Written by `tools/room_census.py` from `{events_path}` (`generated_at` {data.get('generated_at')}) and "
           f"`{registry_path}` (version {reg.get('version')}). Do not edit it by hand; run the script again.", "",
           "A record, not held fresh by CI: an edit to the registry leaves it stale until the script runs again. It "
           "states facts and changes nothing. A room string matches a registry room exactly, case-folded, or it "
           "does not; every other reading here is a proposal, `UNSURE`, and applied to nothing - the registry, its "
           "`seen_2026` and the scraper are as they were. The combined-string rules and the other shapes are counted "
           "apart. Lists run by count, descending, then by string; room strings are in code spans, so that their "
           "spacing and punctuation show.", ""]

    head = [f"Events: {n(total)}, at {many(len(hotels), 'hotel value')}; distinct (hotel, room) strings: "
            f"{n(len(strings))}.",
            f"An exact registry match: {many(kinds['exact'], 'string')}, {n(kind_events['exact'])} events "
            f"({pct(kind_events['exact'], total)}).",
            f"A combined-string rule alone, UNSURE: {many(kinds['combined'], 'string')}, "
            f"{n(kind_events['combined'])} events ({pct(kind_events['combined'], total)}). One of the other shapes, "
            f"UNSURE: {many(kinds['shape'], 'string')}, {n(kind_events['shape'])} events "
            f"({pct(kind_events['shape'], total)}).",
            f"No reading: {many(kinds['none'], 'string')}, {n(kind_events['none'])} events "
            f"({pct(kind_events['none'], total)}).",
            "Hotels in the file and not in the registry: "
            + (", ".join(f"{h} ({many(hotel_events[h], 'event')})" for h in absent) or "none")
            + ". In the registry with no rooms: "
            + (", ".join(f"{h} ({many(hotel_events.get(h, 0), 'event')})" for h in empty) or "none")
            + f". `Unknown`: {n(hotel_events.get('Unknown', 0))} events.",
            f"The Courtland prefix: {n(sum(s['events'] for s in prefixed))} of "
            f"{n(sum(s['events'] for s in courtland))} Courtland Grand events, {n(len(prefixed))} of "
            f"{n(len(courtland))} strings (section 6).",
            f"Registry rooms: {n(len(reg_rooms))}, besides {many(len(note_rooms), 'entry', 'entries')} that hold a "
            f"note. Matched exactly: {n(len(exact_hit))}. Named only by a proposal: {n(len(rule_hit - exact_hit))}. "
            f"Neither: {n(len(reg_rooms) - len(exact_hit | rule_hit))}.",
            f"`split_hotel(location)` gives the stored hotel and room for {n(c['split_ok'])} of {n(total)} events."]
    out += ["## 0. Headline", ""] + [f"{k}. {x}" for k, x in enumerate(head, start=1)] + [""]

    # 1. Hotels
    rows = []
    for h in hotels:
        k = Counter()
        for s in by_hotel[h]:
            k[s["kind"]] += s["events"]
        rows.append([h, "yes" if h in in_reg else "no", n(len(levels[h])) if h in levels else "",
                     n(sum(1 for e in rooms[h].values() if not is_note(e[2]))) if h in rooms else "",
                     n(hotel_events[h]), n(len(by_hotel[h])), n(k["exact"]), n(k["combined"]), n(k["shape"]),
                     n(k["none"])])
    out += ["## 1. Hotels", "",
            "Events by how their room string reads: `exact`, an exact registry match; `combined`, a combined-string "
            "rule alone; `shape`, one of the other shapes, alone or with a combined rule; `none`, no reading. "
            "`combined` and `shape` are proposals, UNSURE.", ""]
    out += table(["hotel", "in the registry", "levels", "rooms", "events", "strings", "exact", "combined", "shape",
                  "none"], rows, "llrrrrrrrr")
    unused = [h for h in in_reg if h not in hotel_events]
    out += [f"- Registry hotels with no events: {', '.join(unused) or 'none'}. `Unknown`, the scraper's hotel for "
            f"an empty location: {n(hotel_events.get('Unknown', 0))} events.", ""]

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
            "a room the registry lacks is tried with its number written the other way (numeral style). A string "
            "counts under each rule it takes; the example is the rule's most frequent string.", ""]
    out += table(["rule", "kind", "example", "strings", "events"], rows, "lllrr")

    # 3. Hotel by hotel
    out += ["## 3. Room strings, hotel by hotel", "",
            "`exact` is the level of an exact registry match. `reading` is a proposal, UNSURE: the rules a string "
            "took and the rooms it names. `in the registry` counts those rooms in the registry, and where they are; "
            "for a string with no reading, whether a registry entry that holds a note names it.", ""]
    for h in hotels:
        ss = by_hotel[h]
        out += [f"### {h} - {many(hotel_events[h], 'event')}, {many(len(ss), 'string')}", ""]
        if h not in in_reg:
            out += ["Not in the registry.", ""]
        elif not rooms.get(h):
            out += ["In the registry with no rooms: " + ("its one level lists none." if levels.get(h)
                                                         else "it has no levels."), ""]
        rows = [[code(s["string"]), n(s["events"]), level_label(s["exact"][0], s["exact"][1]) if s["exact"] else "",
                 reading_text(s), registry_text(s, rooms.get(h, {}), levels.get(h, []))] for s in ss]
        out += table(["string", "events", "exact", "reading (UNSURE)", "in the registry"], rows, "lrlll")

    # 4. No reading
    none = sorted((s for s in strings if s["kind"] == "none"), key=lambda s: (-s["events"], s["hotel"], s["string"]))
    out += ["## 4. Strings no rule reaches", "",
            f"{many(len(none), 'string')}, {many(sum(s['events'] for s in none), 'event')}: no exact match, and no "
            "reading in section 2.", ""]
    out += table(["hotel", "string", "events", "a registry note names it"],
                 [[s["hotel"], code(s["string"]), n(s["events"]),
                   code(note_naming(s["string"], rooms.get(s["hotel"], {})))
                   if note_naming(s["string"], rooms.get(s["hotel"], {})) else ""] for s in none], "llrl")

    # 5. Registry rooms not seen
    out += ["## 5. Registry rooms not seen", "",
            "Per level, the rooms no string matches exactly: those a proposal names (UNSURE), and those nothing "
            "names. The registry's entries that hold a note are listed after; no string matches them.", ""]
    rows = []
    for hd in reg["hotels"]:
        h = hd["hotel"]
        for lid, name in levels.get(h, []) + ([(UNPLACED, UNPLACED)] if hd.get("unplaced") else []):
            entries = [e[2] for e in rooms.get(h, {}).values() if e[0] == lid and not is_note(e[2])]
            if not entries:
                continue
            unseen = [r for r in entries if (h, r) not in exact_hit]
            rows.append([h, level_label(lid, name), n(len(entries)), n(len(entries) - len(unseen)),
                         ", ".join(code(r) for r in unseen if (h, r) in rule_hit),
                         ", ".join(code(r) for r in unseen if (h, r) not in rule_hit)])
    out += table(["hotel", "level", "rooms", "matched exactly", "named only by a proposal (UNSURE)",
                  "named by nothing"], rows, "llrrll")
    out += ["Entries that hold a note:", ""]
    out += [f"- {h}, {level_label(e[0], e[1])}: {code(e[2])}" for h, e in note_rooms] + [""]

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
        r = resolve(cut, "Courtland Grand", rooms.get("Courtland Grand", {}), levels.get("Courtland Grand", []))
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

    # 7. seen_2026
    out += ["## 7. `seen_2026`, level by level", "",
            "What each level's `seen_2026` would become if it held the strings that reach the level: by an exact "
            "match, and by a proposal (UNSURE), with today's list beside them. A string whose rooms land on two "
            "levels is listed under both. Nothing here is written to the registry.", ""]
    file_strings = {(s["hotel"], s["string"]) for s in strings}
    for hd in reg["hotels"]:
        h = hd["hotel"]
        for lv in hd.get("levels", []):
            lid, today = lv["id"], lv.get("seen_2026", [])
            ex = [s for s in by_hotel.get(h, []) if s["kind"] == "exact" and s["exact"][0] == lid]
            prop = [s for s in by_hotel.get(h, []) if s["kind"] in ("combined", "shape")
                    and (lid in [x[0] for x in reached_levels(s)] or s["reading"]["level"] == lid)]
            if not (today or ex or prop):
                continue
            reached = {s["string"] for s in ex + prop}
            out += [f"### {h} - {lv['name']} (`{lid}`)", "",
                    f"- Today: {', '.join(code(x) for x in today) or 'none'}.",
                    f"- By an exact match: {listed(ex)}.",
                    f"- By a proposal, UNSURE: {listed(prop)}."]
            gone = [x for x in today if x not in reached]
            if gone:
                out.append("- Today's, reached by nothing here: " + ", ".join(
                    code(x) + ("" if (h, x) in file_strings else " (not in the file)") for x in gone) + ".")
            out.append("")

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
    ap.add_argument("--registry", default=os.path.join(ROOT, REGISTRY))
    ap.add_argument("--out", default=os.path.join(ROOT, OUT))
    args = ap.parse_args(argv)
    with open(args.events, "rb") as f:
        data = json.loads(f.read().decode("utf-8"))
    with open(args.registry, "rb") as f:
        reg = json.loads(f.read().decode("utf-8"))
    root = os.path.abspath(ROOT)
    shown = lambda p: (os.path.relpath(os.path.abspath(p), root).replace(os.sep, "/")
                       if os.path.abspath(p).startswith(root + os.sep) else os.path.basename(p))
    text = render(data, reg, shown(args.events), shown(args.registry))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"{shown(args.out)}: {len(data['events'])} events, {text.count(chr(10))} lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
