#!/usr/bin/env python3
"""The venues stage (DECISIONS #21, #27, #28, #45; docs/pipeline/contract.md, `venues.json`): where each event is,
read from its location against the year's venues file.

    import venues, venues_stage
    v = venues.load("data/2027/venues.json")
    result = venues_stage.resolve(rows, v)   # the rows, each gaining hotel, room, level, rooms and place; a report

Pure: no file, no clock, no network. Build calls it (PR 6) on raw rows and on a frozen year's rows alike, since both
carry `location`; tools/room_census.py calls it to report its coverage of the 2026 schedule.

The split. A location's leading tokens are matched against every hotel's keys, longest key first, whole tokens only
and without regard to case, and the rest after a space, a comma or a hyphen is the room string. No key: Other, the
whole location the room string, counted as "hotels unknown". Empty: Unknown. The room shown is the room string, or
the whole location for a hotel whose `display` is "location" (the Mart).

The reading, the first that holds winning:
    a. alias  - the room string, folded, is an alias of one of the hotel's levels: its rooms.
    b. exact  - the room string, case-folded, is a room on one of the hotel's levels. (One of its unplaced rooms
                reads "hotel": the file knows it, but not where it is; listed apart, not counted as unresolved.)
    c. rule   - a rule of the grammar names rooms that all exist on one level. A rule whose rooms are missing, or
                span two levels, fails, and the next is tried.
    d. level  - a rule names a level and no room (the Mart's building floors and vendor halls, a floor alone), or
                the rooms a failed rule did find all sit on one level.
    e. hotel  - no reading, or the hotel alone: counted as "rooms unresolved" and listed.
    f. none   - a placeless hotel (Streaming, Other, Unknown). First its room string, less a repeat of its own key
                ("O Other Marriott, Imperial Ballroom"), is split once more against the placed hotels' keys; a match
                is read at that hotel, as the rule "re-split".

The grammar, in the order it is tried: the three Mart rules (a building's floor, a vendor hall's floor, a Building 2
room with a note); the census's eight combined-string rules; three rewrites, each read again - doubled, a leading
"The", and the hotel's own initials and a hyphen; partitions; the hotel alone; a floor alone; and a trailing note,
the longest leading room. A numeral style is an alias, never a rule (#45). Every rule is a function of the string
alone but partitions, which reads the level's rooms; the resolver checks every other rule's rooms and levels against
the file.
"""

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

from venues import folded

KINDS = ("exact", "alias", "rule", "level", "hotel", "none")
SPAN = 20  # the longest run a rule reads: "209-211" is three rooms; "1-40" is not a room string
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
         "XVII", "XVIII", "XIX", "XX"]
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
            "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
            "nineteenth", "twentieth"]
# The name before a run: one to three words, each starting with a letter. A longer lead-in is a sentence with a run in
# it ("Galleria 2-3 Hallway Just outside Galleria 2-3"), which no rule reads.
NAME = r"([A-Za-z][\w'&.]*(?:\s[A-Za-z][\w'&.]*){0,2})"


# ---------------------------------------------------------------------------
# The rules: each a function of the string alone - but partitions - giving a candidate for the resolver to check
# ---------------------------------------------------------------------------

def building_floor(s):
    """"Building 3, Floor 2": that building's floor, a level with no rooms (#45's Mart). -> the level's names."""
    m = re.fullmatch(r"Building\s+(\d+),?\s+Floor\s+(\d+)", s, re.I)
    return [f"building {int(m.group(1))}, floor {int(m.group(2))}"] if m else None


def vendor_hall(s):
    """"Vendor Hall Floor 1 The Missing Volume booth 1300": that floor of Building 2's vendor hall, a level; the
    vendor and the booth stay in the room shown (#45's Mart2). -> the level's names."""
    m = re.match(r"Vendor\s+Hall\s+Floor\s+(\d+)(?=$|[\s,-])", s, re.I)
    return [f"building 2, vendor hall floor {int(m.group(1))}"] if m else None


def mart_room(s):
    """"203D ArtCarp - booth # 1718": a Building 2 room, 20xY, the rest a note about it (#45's Mart2)."""
    m = re.fullmatch(r"(20\d[A-Z])(?:\s+\S.*)?", s)
    return [m.group(1)] if m else None


def _ascending(letters):
    return all(a < b for a, b in zip(letters, letters[1:]))


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
    """"203BC": a room number, then letters run together, in order, one room each ("203B", "203C")."""
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


def doubled(s, hotel):
    """"Crystal Ballroom Crystal Ballroom": one string, twice. -> the string to read again."""
    m = re.fullmatch(r"(.+?)\s+\1", s)
    return m.group(1) if m else None


def leading_the(s, hotel):
    """"The Learning Center": the room's name after a leading "The". -> the string to read again."""
    m = re.fullmatch(r"The\s+(.+)", s)
    return m.group(1) if m else None


def hotel_initials(s, hotel):
    """"H-Piedmont" at the Hyatt, "CG-Grand Ballroom A-F" at the Courtland Grand: the hotel's own initials and a
    hyphen, dropped; nothing else strips. -> the string to read again."""
    m = re.fullmatch(r"([A-Za-z]+)-(\S.*)", s)
    return m.group(2) if m and m.group(1).casefold() == initials(hotel).casefold() else None


def initials(hotel):
    """A hotel's initials, from its `hotel` value: "Courtland Grand" is CG."""
    return "".join(w[0] for w in hotel.split())


def partitions(s, levels):
    """"Atrium Ballroom" is Atrium Ballroom A, B, C and D: the common prefix of two or more rooms on one level, each
    the prefix and a letter, a number or a roman numeral. The one rule that reads the file. -> the rooms, or None
    where no level, or more than one, has two such rooms."""
    found = []
    for lv in levels:
        hits = [r for r in lv["rooms"] if (m := re.fullmatch(re.escape(s) + r"\s+(\S+)", r, re.I))
                and (re.fullmatch(r"[A-Z]|\d+", m.group(1)) or m.group(1) in ROMAN)]
        if len(hits) >= 2:
            found.append(hits)
    return found[0] if len(found) == 1 else None


def hotel_only(s, hotel):
    """"" after a bare key ("Hyatt"), or the hotel's own name or key again: the hotel, and no room."""
    return s == "" or s.casefold() in {hotel["hotel"].casefold()} | {k.casefold() for k in hotel["keys"]}


def floor_only(s):
    """"14th Floor", "5th", "Floor 3": a floor and no room. -> the names of the level it would be: "Fourteenth
    Floor", "Level 14"."""
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)(?:\s+floor)?", s, re.I) or re.fullmatch(r"floor\s+(\d{1,2})", s, re.I)
    if not m or not 1 <= int(m.group(1)) <= len(ORDINALS):
        return None
    k = int(m.group(1))
    return [f"{ORDINALS[k - 1]} floor", f"level {k}"]


def trailing_note(s):
    """"Grand Hall D Poole Booth 111 for more info!!": a room, then words about it. -> the heads to try, longest
    first: every leading run of whole words short of the whole string; the resolver takes the first that is a room."""
    words = s.split()
    return [" ".join(words[:k]).rstrip(",;:-") for k in range(len(words) - 1, 0, -1)]


# (name, what the rule gives, the rule): "level" names levels, "rooms" rooms, "rewrite" a string to read again,
# "partitions" rooms read from the file, "hotel" the hotel alone, "heads" room strings to try, longest first.
GRAMMAR = [
    ("mart building", "level", building_floor),
    ("mart vendor hall", "level", vendor_hall),
    ("mart room", "rooms", mart_room),
    ("numeric run", "rooms", numeric_run),
    ("roman run", "rooms", roman_run),
    ("letter run", "rooms", letter_run),
    ("number run", "rooms", number_run),
    ("letters together", "rooms", letters_together),
    ("number and letters", "rooms", number_letters),
    ("slash list", "rooms", slash_list),
    ("word pair", "rooms", word_pair),
    ("doubled", "rewrite", doubled),
    ("leading The", "rewrite", leading_the),
    ("hotel initials", "rewrite", hotel_initials),
    ("partitions", "partitions", partitions),
    ("hotel only", "hotel", hotel_only),
    ("floor only", "level", floor_only),
    ("trailing note", "heads", trailing_note),
]
RULES = ["re-split"] + [name for name, _, _ in GRAMMAR]  # the report's order


# ---------------------------------------------------------------------------
# The resolver
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Reading:
    """How a room string reads at one hotel."""
    place: str
    level: object = None       # a level id, or None
    rooms: tuple = ()
    rules: tuple = ()          # the rules that read it, in order
    why: str = ""              # for place "hotel": "hotel only", "unplaced" or "no reading"


@dataclass(frozen=True)
class Place:
    """Where one location is: the event's five fields, and how they were found."""
    hotel: str
    room: str
    level: object
    rooms: tuple
    place: str
    rules: tuple = ()
    why: str = ""
    string: str = ""           # the room string read: the split's rest, or a re-split's
    key: object = None         # the key the split matched: None for no key, or an empty location


class Resolver:
    """The venues file made ready to read locations: its keys longest first, each hotel's rooms by level. `venues`
    is venues.load()'s Venues, or its data. place() caches by location."""

    def __init__(self, venues):
        data = getattr(venues, "data", venues)
        self.hotels = sorted(data["hotels"], key=lambda h: h["order"])
        self.by_name = {h["hotel"]: h for h in self.hotels}
        for name in ("Other", "Unknown"):
            if name not in self.by_name:
                raise ValueError(f"the venues file has no {name} hotel, which the split falls back to")
        pairs = sorted(((k, h) for h in self.hotels for k in h["keys"]),
                       key=lambda kh: (-len(kh[0]), kh[0].casefold(), kh[1]["order"]))
        self.keys = [(re.compile(r"\s+".join(map(re.escape, k.split())) + r"(?=$|[\s,-])", re.I), k, h)
                     for k, h in pairs]
        self.placed_keys = [x for x in self.keys if not x[2]["placeless"]]
        self.rooms = {h["hotel"]: {r.casefold(): (lv["id"], r) for lv in h["levels"] for r in lv["rooms"]}
                      for h in self.hotels}
        self.unplaced = {h["hotel"]: {r.casefold() for r in h["unplaced"]} for h in self.hotels}
        self.cache = {}

    def split(self, location):
        """(hotel, rest, key): the hotel whose key the location begins with, longest key first, and the rest after
        a space, a comma or a hyphen. No key: Other and the whole location, key None; empty: Unknown."""
        loc = (location or "").strip()
        if not loc:
            return self.by_name["Unknown"], "", None
        hit = _match(loc, self.keys)
        if not hit:
            return self.by_name["Other"], loc, None
        end, key, hotel = hit
        return hotel, _rest(loc, end), key

    def place(self, location):
        """Where a location is: a Place."""
        loc = (location or "").strip()
        if loc not in self.cache:
            self.cache[loc] = self._place(loc)
        return self.cache[loc]

    def _place(self, loc):
        hotel, rest, key = self.split(loc)
        shown = loc if hotel["display"] == "location" else rest
        if not hotel["placeless"]:
            r = self.read(rest, hotel)
            return Place(hotel["hotel"], shown, r.level, r.rooms, r.place, r.rules, r.why, rest, key)
        s = rest
        while (own := _match(s, [x for x in self.keys if x[2] is hotel])) and key is not None:
            s = _rest(s, own[0])                    # its own key again: "O Other Marriott, Imperial Ballroom"
        hit = _match(s, self.placed_keys) if key is not None else None
        if not hit:
            return Place(hotel["hotel"], shown, None, (), "none", (), "", rest, key)
        end, key2, placed = hit
        rest2 = _rest(s, end)
        r = self.read(rest2, placed)
        return Place(placed["hotel"], s if placed["display"] == "location" else rest2, r.level, r.rooms,
                     "rule" if r.place == "exact" else r.place, ("re-split",) + r.rules, r.why, rest2, key2)

    def read(self, s, hotel):
        """How a room string reads at a placed hotel (a-e): a Reading."""
        reading, found = self._read(s, hotel)
        if reading:
            return reading
        if found:                                   # d: every rule failed, and one found rooms on one level
            return Reading("level", found[1], (), found[0])
        return Reading("hotel", why="no reading")

    def _read(self, s, hotel):
        """(the Reading that holds, or None; the first failed rule whose found rooms sit on one level, as (its
        rules, that level), or None). A rewrite's string is read again here, and its failed rules count too."""
        rooms = self.rooms[hotel["hotel"]]
        f = folded(s)
        for lv in hotel["levels"]:
            if f in lv["aliases"]:
                return Reading("alias", lv["id"], tuple(lv["aliases"][f])), None
        if s.casefold() in rooms:
            lid, room = rooms[s.casefold()]
            return Reading("exact", lid, (room,)), None
        if s.casefold() in self.unplaced[hotel["hotel"]]:
            return Reading("hotel", why="unplaced"), None
        found = None
        for name, gives, rule in GRAMMAR:
            if gives == "level":
                lid = next((self.level_named(hotel, n) for n in rule(s) or () if self.level_named(hotel, n)), None)
                if lid:
                    return Reading("level", lid, (), (name,)), None
            elif gives == "rooms":
                names = rule(s)
                if names:
                    ok, lid, got = _check(names, rooms)
                    if ok:
                        return Reading("rule", lid, got, (name,)), None
                    if found is None and got and lid is not None:
                        found = ((name,), lid)
            elif gives == "rewrite":
                again = rule(s, hotel["hotel"])
                if again and again != s:
                    r, inner = self._read(again, hotel)
                    if r and r.place in ("exact", "alias", "rule", "level"):
                        place = "rule" if r.place == "exact" else r.place
                        return Reading(place, r.level, r.rooms, (name,) + r.rules), None
                    if found is None and inner:
                        found = ((name,) + inner[0], inner[1])
            elif gives == "partitions":
                names = rule(s, hotel["levels"])
                if names:
                    ok, lid, got = _check(names, rooms)
                    return Reading("rule", lid, got, (name,)), None
            elif gives == "hotel":
                if rule(s, hotel):
                    return Reading("hotel", rules=(name,), why="hotel only"), None
            else:                                   # heads: the longest leading room
                for head in rule(s):
                    if head.casefold() in rooms:
                        lid, room = rooms[head.casefold()]
                        return Reading("rule", lid, (room,), (name,)), None
        return None, found

    def level_named(self, hotel, name):
        """The id of the hotel's level whose name is `name`, case-folded; None where it has none."""
        return next((lv["id"] for lv in hotel["levels"] if lv["name"].casefold() == name.casefold()), None)


def _match(s, keys):
    """(end, key, hotel) of the first key, of `keys`, that the string begins with as whole tokens; None."""
    for rx, key, hotel in keys:
        m = rx.match(s)
        if m:
            return m.end(), key, hotel
    return None


def _rest(s, end):
    """What follows a key, after the space, comma or hyphen that ends it."""
    return re.sub(r"^[\s,-]+", "", s[end:]).strip()


def _check(names, rooms):
    """(every room named is in the file and on one level, that level or None, the rooms found as the file writes
    them)."""
    got = [rooms.get(n.casefold()) for n in names]
    found = [g for g in got if g]
    levels = {g[0] for g in found}
    return len(found) == len(names) and len(levels) == 1, (next(iter(levels)) if len(levels) == 1 else None), \
        tuple(g[1] for g in found)


# ---------------------------------------------------------------------------
# The stage
# ---------------------------------------------------------------------------

@dataclass
class VenuesReport:
    """What a run read, for the run summary's venue counters (#44; PR 8). Every list runs by events, descending.

    places      events by place kind, every kind
    hotels      per hotel, in the file's order, events by place kind
    unresolved  {hotel, string, events, why}: place "hotel", read as "hotel only" or with "no reading" - the
                curation worklist; its events are the counter "rooms unresolved"
    unplaced    {hotel, string, events}: an unplaced room of the file - place "hotel", not unresolved
    unknown     {string, events}: a location no key begins, placed at Other; its events are "hotels unknown"
    resplit     {location, hotel, string, events}: a placeless hotel's location read again at a placed hotel
    aliases     {hotel, string, events, rooms}: the alias hits
    rules       rule -> {strings, events}: the rules that read a string, in the grammar's order, "re-split" first
    """
    places: dict = field(default_factory=lambda: {k: 0 for k in KINDS})
    hotels: dict = field(default_factory=dict)
    unresolved: list = field(default_factory=list)
    unplaced: list = field(default_factory=list)
    unknown: list = field(default_factory=list)
    resplit: list = field(default_factory=list)
    aliases: list = field(default_factory=list)
    rules: dict = field(default_factory=dict)

    @property
    def rooms_unresolved(self):
        return sum(x["events"] for x in self.unresolved)

    @property
    def hotels_unknown(self):
        return sum(x["events"] for x in self.unknown)


@dataclass
class VenuesResult:
    rows: list      # the rows as given, each a copy gaining hotel, room, level, rooms and place
    report: VenuesReport


def resolve(rows, venues):
    """Every row's place (#45) -> VenuesResult. `rows` carry `location`: raw rows, or a frozen year's events, whose
    own hotel and room this replaces. `venues` is venues.load()'s. Neither is changed."""
    resolver = Resolver(venues)
    out, seen = [], []
    for row in rows:
        p = resolver.place(row.get("location"))
        out.append({**row, "hotel": p.hotel, "room": p.room, "level": p.level, "rooms": list(p.rooms),
                    "place": p.place})
        seen.append((row.get("location"), p))
    return VenuesResult(out, report(seen, resolver))


def report(seen, resolver):
    """The report of [(location, Place)], one pair an event."""
    rep = VenuesReport()
    order = [h["hotel"] for h in resolver.hotels]
    per_hotel = defaultdict(Counter)
    tallies = {name: Counter() for name in ("unresolved", "unplaced", "unknown", "resplit", "aliases")}
    fired, fired_strings = Counter(), defaultdict(set)
    for loc, p in seen:
        rep.places[p.place] += 1
        per_hotel[p.hotel][p.place] += 1
        if p.place == "hotel":
            tallies["unplaced" if p.why == "unplaced" else "unresolved"][(p.hotel, p.string, p.why)] += 1
        if p.place == "alias":
            tallies["aliases"][(p.hotel, p.string, p.rooms)] += 1
        if p.key is None and p.hotel == "Other":
            tallies["unknown"][(p.string,)] += 1
        if p.rules[:1] == ("re-split",):
            tallies["resplit"][((loc or "").strip(), p.hotel, p.string)] += 1
        for name in dict.fromkeys(p.rules):
            fired[name] += 1
            fired_strings[name].add((p.hotel, p.string))
    rep.hotels = {h: {k: per_hotel[h][k] for k in KINDS} for h in order if h in per_hotel}
    by = lambda kv: (-kv[1], kv[0])
    rep.unresolved = [{"hotel": h, "string": s, "events": n, "why": w} for (h, s, w), n in
                      sorted(tallies["unresolved"].items(), key=by)]
    rep.unplaced = [{"hotel": h, "string": s, "events": n} for (h, s, _), n in
                    sorted(tallies["unplaced"].items(), key=by)]
    rep.unknown = [{"string": s, "events": n} for (s,), n in sorted(tallies["unknown"].items(), key=by)]
    rep.resplit = [{"location": loc, "hotel": h, "string": s, "events": n} for (loc, h, s), n in
                   sorted(tallies["resplit"].items(), key=by)]
    rep.aliases = [{"hotel": h, "string": s, "events": n, "rooms": list(r)} for (h, s, r), n in
                   sorted(tallies["aliases"].items(), key=by)]
    rep.rules = {name: {"strings": len(fired_strings[name]), "events": fired[name]} for name in RULES if fired[name]}
    return rep


def split(location, venues):
    """The split alone, for a reader that wants no reading: (hotel, rest, key), the hotel its `hotel` value."""
    hotel, rest, key = Resolver(venues).split(location)
    return hotel["hotel"], rest, key


def place(location, venues):
    """One location's Place."""
    return Resolver(venues).place(location)
