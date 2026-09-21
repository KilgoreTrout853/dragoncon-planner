#!/usr/bin/env python3
"""The parse stage of tags v2 (DECISIONS #32): what the schedule states, read without a model.

Two things are parsed out of an event and added beside it, `people` and `facets`
(`docs/discover/schema-v2.md`). Nothing here calls a model, asks the network or writes under
`data/`: the frozen 2026 file is the input and stays frozen (#13, #33).

    python parse_stage.py --out PATH   # the events with people and facets added, for inspection
    python parse_stage.py              # parse everything and print one line of counts

The report that goes with this stage is `parse_report.py`, which writes
`docs/discover/parse-2026.md`. `tag_census.py` imports the facet patterns, the title key and the
splitter from here, so there is one owner of each.

Standard library only, and every function is pure: the same event gives the same answer in any
process, with any hash seed.
"""

import argparse
import json
import re
import unicodedata
from collections import defaultdict

EVENTS = "data/2026/events.json"

# What a name carries that is not the name. `person_slug` drops these; `tag_census.person_parts`
# uses the same two sets to find variant spellings.
HONORIFICS = set("dr mr mrs ms miss prof professor capt captain col colonel rev sir lt sgt maj gen cmdr".split())
CREDENTIALS = set("jr sr ii iii iv phd md esq dds dvm mba jd edd".split())  # not "ma" or "pe": those are surnames

# The roles the schedule writes in a trailing parenthetical, lowercase -> as it is stored.
# "Moderator" is 556 of the 564 in the 981 lines, "Judge" 13, "Virtual" 1; "Host" and "Panelist"
# come from scraper.extract_panelists' own list and do not occur in 2026.
ROLES = {"moderator": "Moderator", "judge": "Judge", "virtual": "Virtual", "host": "Host",
         "panelist": "Panelist", "speaker": "Speaker", "dj": "DJ"}
PANELIST_ROLE = "Panelist"  # what a name on the line carries when it names no role
# A role field that says no more than "there is a person here". A role parenthetical in the name
# beats one of these and loses to anything else.
GENERIC_ROLES = {"", "speaker", "panelist"}

# The line, as the source writes it: "Additional Panelists: A, B(Moderator), C". It closes the
# description on all 981 events that carry one and never holds a newline.
PANELIST_MARKER = re.compile(r"additional panelists?\s*:", re.I)
ROLE_SUFFIX = re.compile(r"\(\s*([^()]*?)\s*\)\s*$")
SUFFIX_ONLY = re.compile(r"^(?:" + "|".join(sorted(CREDENTIALS)) + r")\.?$", re.I)
# A bracketed marker where a name should be: "(Mature Audience)", "(18+)". None of the 981 lines
# ends in one, but the marker closes 71 descriptions, so a line that gains one is not a name.
MARKER_ONLY = re.compile(r"^[(\[]?\s*(?:mature\s+audiences?|adults?[\s-]+only|(?:age\s+)?\d{2}\s*\+)\s*[)\]]?$", re.I)

# (key, label, pattern), in report order. "Ticket to Ride" is a board game, not a ticket.
FACETS = [
    ("paid", "$ / $$", re.compile(r"(?<![\w$])\${1,3}(?![\w$])")),
    ("sold_out", "SOLD OUT", re.compile(r"\bsold[\s-]*out\b", re.I)),
    ("age", "18+ / 21+", re.compile(r"\b(?:18|21)\s*\+")),
    ("clock", "a clock time", re.compile(
        r"\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]\.?m?\.?(?![a-z]))?|\b(?:1[0-2]|0?[1-9])\s*[ap]\.?m\b\.?", re.I)),
    ("cancelled", "CANCELLED", re.compile(r"\bcancell?ed\b", re.I)),
    ("part", "Part N / Repeat", re.compile(
        r"\bpart\s+(?:\d+|[ivx]+|one|two|three|four|five)\b|\bpart\d+\b|\bpt\.?\s*\d+\b|\brepeat\b", re.I)),
    ("fee", "fee / ticket / pre-registration", re.compile(
        r"\bfees?\b|\bticket(?:s|ed)?\b(?!\s+to\s+ride)|\bpre-?\s?reg(?:ist\w*)?\b|\bregistration\b|\$\d", re.I)),
]
STRIPPED = ("paid", "sold_out", "clock", "cancelled")  # what a repeat key takes out of a title first

# The wording each facet is read from. Narrower than FACETS, which is the census's net: these
# decide a value, so precision beats recall and doubt sets nothing (see `facets_for`).
MATURE_WORDS = re.compile(r"\bmature\s+audiences?\b|\badults?[\s-]+only\b", re.I)
AGE_WORDS = re.compile(r"\b(1[3-9]|2[01])\s*\+|\b(1[3-9]|2[01])\s*(?:and|&|or)\s*(?:up|over|older)\b", re.I)
SOLD_OUT_WORDS = re.compile(r"\bsold[\s-]*out\b", re.I)
EXTRA_FEE_WORDS = re.compile(r"\bextra\s+fee\b", re.I)
# An amount of money. The lookahead sits after the first digit so that it sees the whole number:
# "$630 billion" and "$3 trillion" are a panel about the space economy, not a price, and "$0" is
# not a fee. No 2026 event states a zero or free price.
MONEY = re.compile(r"\$\s?(?!0(?![.,]?[1-9]))\d(?![\d,.]*\s*(?:trillion|billion|million|thousand|k\b))[\d,.]*", re.I)
SIGNUP_WORDS = re.compile(r"\bpre-?\s?reg(?:\w*)\b|\badvanced?\s+registration\b|\bregistration\s+required\b"
                          r"|\bmust\s+(?:pre-?\s?)?register\b|\bsign[\s-]?ups?\s+(?:is\s+|are\s+)?required\b"
                          r"|\breserve\s+(?:a\s+|your\s+)?(?:seat|spot|space)\b|\brsvp\b", re.I)
# Where the listing says the opposite. "Feel free to join us" is on 188 events and is not one of
# these, which is why "free" alone is not in the pattern.
NEGATED = re.compile(r"\bno\s+(?:additional\s+|extra\s+)?(?:fee|cost|charge|registration|ticket)\w*\b"
                     r"|\bfree\s+of\s+charge\b|\bfees?\s+(?:are\s+|is\s+)?waived\b"
                     r"|\bprice\s*:?\s*(?:free|none)\b", re.I)
PART_WORDS = re.compile(r"\bpart\s+(\d+|one|two|three|four|five)\b|\bpart(\d+)\b|\bpt\.?\s*(\d+)\b", re.I)
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}


# ---------------------------------------------------------------------------
# Strings
# ---------------------------------------------------------------------------

def fold(s):
    """Case, accents and curly apostrophes out of the way."""
    s = unicodedata.normalize("NFKD", str(s).replace("’", "'"))
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


def words(s):
    return re.sub(r"[^a-z0-9]+", " ", fold(s).replace("&", " and ").replace("'", "")).split()


def title_facets(title):
    """The keys of the FACETS a title carries, in FACETS order."""
    return [key for key, _, rx in FACETS if rx.search(title)]


def strip_facets(title):
    out = title
    for key, _, rx in FACETS:
        if key in STRIPPED:
            out = rx.sub(" ", out)
    return out


def title_key(title):
    return " ".join(words(title))


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------

def split_role(text):
    """Trailing role parentheticals off a fragment -> (name, role or None).

    "Jim Wert(Moderator)" is a moderator; "Kei (tophat_tiara)" is a name, because the
    parenthetical is not a role. "Daniel Eisenhauer(Judge)(Moderator)" is the schedule's own
    spelling of his name with the line's role after it, so the outer one is the role."""
    name, role = " ".join(str(text or "").split()), None
    while True:
        m = ROLE_SUFFIX.search(name)
        found = ROLES.get(fold(m.group(1)).strip()) if m else None
        if not found:
            return name, role
        name, role = name[:m.start()].strip(), role or found


def person_slug(name):
    """A name's id: deterministic, and forever (#31). Case, accents, punctuation and whitespace
    fold; an honorific and a trailing credential go; a trailing role parenthetical is the role,
    not the name. A middle initial and a "from X" tail stay: two spellings of one person are the
    registry's to merge with an alias, and an id that moves is a follow that breaks.

    An honorific goes only where two or more words are left without it, and a credential the
    same. In "Mr. Corporate", "Ms. Leisure" and "Dr. Craz" the honorific is the name, and PR 3
    seeds the registry from these slugs: `corporate` is the wrong id to make permanent."""
    bare, _ = split_role(name)
    w = words(bare)
    while len(w) > 2 and w[0] in HONORIFICS:
        w = w[1:]
    while len(w) > 2 and w[-1] in CREDENTIALS:
        w = w[:-1]
    return "-".join(w)


def split_panelists(description):
    """The "Additional Panelists:" line -> [{name, role, raw}], in the order it names them.

    Commas separate, and nothing else does: no line uses a semicolon or "and". A fragment that is
    only a suffix rejoins the one before it ("Mark NeCamp, Jr."), and a fragment that is a marker
    rather than a name ("(Mature Audience)") is left to `facets_for`. Neither happens in 2026.

    What it does not do, because the line does not say: split "Ryan & Nicole Cadaver" into two
    people, or take " - Black Phoenix Alchemy Lab" off a name, which would also cut "Theda
    Daniels - Race" in half. Both are listed UNSURE by the report."""
    m = PANELIST_MARKER.search(description or "")
    if not m:
        return []
    out = []
    # One description says "Additional Panelists:" twice, the second time repeating the first
    # list. A later marker is a separator like any other; `people_for` drops the repeat by slug.
    for chunk in PANELIST_MARKER.split(description[m.end():]):
        for raw in re.split(r",\s*", chunk.strip().rstrip(".")):
            raw = " ".join(raw.split())
            if not raw or MARKER_ONLY.match(raw):
                continue
            if SUFFIX_ONLY.match(raw) and out:
                last = out[-1]
                last["name"], last["raw"] = f"{last['name']}, {raw}", f"{last['raw']}, {raw}"
                continue
            name, role = split_role(raw)
            out.append({"name": name, "role": role or PANELIST_ROLE, "raw": raw})
    return out


def strip_panelists(description):
    """The description without its "Additional Panelists:" line. The line closes the description
    on all 981 events that carry one and never holds a newline, so it is everything from the first
    marker on, the one description that says it twice included. The tag stage sends the rest, so
    that who is on a listing never reaches the model."""
    text = description or ""
    m = PANELIST_MARKER.search(text)
    return text[:m.start()] if m else text


def speaker_role(speaker):
    """A speaker's role. A role parenthetical the schedule wrote into the name itself is better
    than a role field that only says a person is present: "Karen Henson(Judge)" with the role
    `Panelist` is a judge. A field that names a specific role stands."""
    field = " ".join(str(speaker.get("role") or "").split())
    _, in_name = split_role(speaker.get("name") or "")
    return in_name if in_name and fold(field) in GENERIC_ROLES else field


def legacy_panelists(description):
    """A copy of scraper.extract_panelists as it stands, kept here so that this module is
    standard library only. `tests/test_parse_stage.py` asserts the two agree."""
    m = re.search(r"Additional Panelists?\s*:\s*(.+)$", description or "", re.IGNORECASE | re.DOTALL)
    if not m:
        return []
    names = []
    for raw in re.split(r",\s*", m.group(1).strip().rstrip(".")):
        raw = re.sub(r"\s+", " ", raw or "").strip()
        if not raw:
            continue
        role = re.search(r"\((moderator|virtual|host|panelist)\)", raw, re.IGNORECASE)
        name = re.sub(r"\s*\((moderator|virtual|host|panelist)\)\s*", " ", raw, flags=re.IGNORECASE).strip()
        names.append({"name": name, "role": role.group(1).title() if role else "Panelist"})
    return names


def scraper_derived_speakers(event):
    """True where `speakers` is nothing but scraper.extract_panelists' older reading of this
    event's own line, so that `people_for` reads the line again instead of inheriting it.

    scraper.py fills `speakers` from the description when the detail page's Speakers section is
    empty (`speakers = detail["speakers"] or extract_panelists(description)`), and that parse has
    two faults this one does not: it takes "(Judge)" for part of a name, and on the one
    description that says "Additional Panelists:" twice it reads to the end of the string, making
    the name "Eric Holloway . Additional Panelists: Carter Alexander". It holds for 375 of the 981
    events. The test pins this copy against the scraper's own function; both go when the 2027
    scraper stops deriving speakers from the line, or uses `split_panelists` instead (ROADMAP,
    Pipeline shape), and then this returns False everywhere and can be deleted."""
    speakers = event.get("speakers") or []
    return bool(speakers) and speakers == legacy_panelists(event.get("description") or "")


def people_for(event):
    """Everyone the event names: [{id, name, role, src}].

    `speakers` first, in its order, then everyone the description's line names that `speakers`
    lacks, matched by slug. An id appears once - a person already in `speakers` is not repeated,
    and `speakers`' role wins. `speakers` and `description` are not touched.

    The exception is an event whose `speakers` is only the scraper's own reading of that same line
    (`scraper_derived_speakers`): there `speakers` is not a second source, so the line is read
    once, here, and everyone on it is `src: description`."""
    out, seen = [], set()

    def add(name, role, src):
        pid = person_slug(name)
        if not pid or pid in seen:
            return
        seen.add(pid)
        out.append({"id": pid, "name": split_role(name)[0], "role": role, "src": src})

    if not scraper_derived_speakers(event):
        for s in event.get("speakers") or []:
            add(s.get("name") or "", speaker_role(s), "speakers")
    for p in split_panelists(event.get("description") or ""):
        add(p["name"], p["role"], "description")
    return out


# ---------------------------------------------------------------------------
# Facets
# ---------------------------------------------------------------------------

def repeat_keys(events):
    """The title keys that occur at more than one start. `repeat_key` is present only on an event
    whose key is one of these, so the whole schedule decides it, not the event."""
    starts = defaultdict(set)
    for e in events:
        starts[title_key(strip_facets(e.get("title") or ""))].add(e.get("start"))
    return frozenset(k for k, when in starts.items() if k and len(when) > 1)


def stated_ages(text):
    """Every minimum age the text states, 13+ to 21+."""
    return [int(m.group(1) or m.group(2)) for m in AGE_WORDS.finditer(text)]


def cost_wording(event):
    """What `facets_for` sees before it decides `cost` and `signup`: (a price, pre-registration wording, a statement
    that there is none), each a match or None. The report reads this to list what was left unset."""
    title = event.get("title") or ""
    text = f"{title}\n{event.get('description') or ''}"
    return (FACETS[0][2].search(title) or EXTRA_FEE_WORDS.search(text) or MONEY.search(text),
            SIGNUP_WORDS.search(text), NEGATED.search(text))


def facets_for(event, repeats=frozenset()):
    """What the listing states, per schema-v2.md's Facets table. A key is present only where the
    source says so; an absent key means the listing states nothing, not "free" or "open".

    `cost` and `signup` are the two a reader would be angry to see wrong, so they are read from a
    price, an "EXTRA FEE" or a title's $ mark and from pre-registration wording, and from nothing
    else; where the same text also says there is no fee, neither is set. `parse_report.py` lists
    every event whose wording was left unset."""
    title = event.get("title") or ""
    text = f"{title}\n{event.get('description') or ''}"
    out = {}

    ages = stated_ages(text)
    if ages:
        out["min_age"] = max(ages)  # one event says both 18+ and 21+; the higher one is the gate
    if MATURE_WORDS.search(text) or any(age >= 18 for age in ages):
        out["mature"] = True
    if SOLD_OUT_WORDS.search(text):
        out["sold_out"] = True

    cost, signup, says_none = cost_wording(event)
    if not says_none:
        if cost:
            out["cost"] = "extra"
        if signup:
            out["signup"] = True

    m = PART_WORDS.search(title)  # the title, where a series says which part it is
    if m:
        part = m.group(1) or m.group(2) or m.group(3)
        out["part"] = int(part) if part.isdigit() else NUMBER_WORDS[part.lower()]

    key = title_key(strip_facets(title))
    if key in repeats:
        out["repeat_key"] = key
    return out


def parse_event(event, repeats=frozenset()):
    """The event with `people` and `facets` beside its scraped fields. Nothing scraped changes."""
    return {**event, "people": people_for(event), "facets": facets_for(event, repeats)}


def parse_all(events):
    repeats = repeat_keys(events)
    return [parse_event(e, repeats) for e in events]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", default=EVENTS)
    ap.add_argument("--out", help="write the parsed events here. For inspection: never committed, "
                                  "and never under data/, which is frozen (DECISIONS #13, #33).")
    args = ap.parse_args()
    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    events = parse_all(data["events"])
    people = sum(len(e["people"]) for e in events)
    keys = sum(len(e["facets"]) for e in events)
    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="\n") as f:
            json.dump({**data, "events": events}, f, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    print(f"{args.file}: {len(events)} events, {people} people, {keys} facet keys"
          + (f" -> {args.out}" if args.out else ""))


if __name__ == "__main__":
    main()
