#!/usr/bin/env python3
"""A read-only census of the tags in data/2026/events.json, written to docs/discover/census-2026.md.

Evidence for the Discover design work. It states facts and decides nothing: where a call needs
judgment the candidates are listed, marked UNSURE, and left unresolved.

    python tag_census.py                          # data/2026/events.json -> docs/discover/census-2026.md
    python tag_census.py --file F --out O

Deterministic: every list is sorted (count descending, then name), no set is ever iterated unsorted
(string hashing is seeded per process), and the only timestamp is events.json's own generated_at.
Two runs, no diff. Standard library only; it reads events.json and never writes it (DECISIONS #13).
"""

import argparse
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict

from tag_events import KINDS, TOPICS, canon_fandom  # the taxonomy in use, not a copy of it

EVENTS = "data/2026/events.json"
OUT = "docs/discover/census-2026.md"
TAGGER_SAW = 600  # tag_events.build_prompt sends description[:600]; wording past it was never seen
TAG_FIELDS = ("fandoms", "kind", "topics", "adult", "guests")

# Fandom names that are a medium or a genre, not a property. The report prints this list.
GENERIC = ["Anime", "Board Games", "Books", "Card Games", "Cartoons", "Cosplay", "Film", "Games", "Gaming", "Manga",
           "Movies", "Science Fiction", "Superheroes", "Tabletop Games", "Television", "TV", "Video Games"]
STOP = set("a an and are as at be by for from how i in is it its my of on or our the this to vs we what who why "
           "with you your".split())
HONORIFICS = set("dr mr mrs ms miss prof professor capt captain col colonel rev sir lt sgt maj gen cmdr".split())
CREDENTIALS = set("jr sr ii iii iv phd md esq dds dvm mba jd edd".split())  # not "ma" or "pe": those are surnames

# 18+, 21+ and adults only, and "(Mature Audience)", which is the marker the schedule itself uses.
ADULT_RX = re.compile(r"\b(?:18|21)\s*\+|\b(?:18|21)\s*(?:and|&|or)\s*(?:up|over|older)\b|\badults?[\s-]+only\b"
                      r"|\bmature audiences?\b", re.I)
AGE_RX = re.compile(ADULT_RX.pattern + r"|\b(?:1[3-9]|2[01])\s*\+", re.I)  # section 6's table also shows 13+ to 17+
PANELISTS_RX = re.compile(r"additional panelists:", re.I)
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
STRIPPED = ("paid", "sold_out", "clock", "cancelled")  # what section 11 takes out of a title before comparing


# ---------------------------------------------------------------------------
# Pure functions: what tests/test_tag_census.py reaches
# ---------------------------------------------------------------------------

def fold(s):
    """Case, accents and curly apostrophes out of the way."""
    s = unicodedata.normalize("NFKD", str(s).replace("’", "'"))
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


def words(s):
    return re.sub(r"[^a-z0-9]+", " ", fold(s).replace("&", " and ").replace("'", "")).split()


def fandom_key(name):
    """What two spellings of one property share: case, punctuation, and/&, a leading "the"."""
    w = words(name)
    return " ".join(w[1:] if len(w) > 1 and w[0] == "the" else w)


def person_parts(name):
    """(key, what was set aside to make it). The key is a speaker's name without what varies: case,
    punctuation, (parentheticals), a "from X" or "of X" tail, honorifics, credentials, middle initials."""
    aside = []
    whole = fold(name).strip()
    bare = re.sub(r"\([^)]*(?:\)|$)", " ", whole).strip()
    head = re.split(r"\s+(?:from|of)\s+", bare)[0]
    aside += ["parenthetical"] * (bare != whole) + ["from/of tail"] * (head != bare)
    w = words(head)
    while len(w) > 1 and w[0] in HONORIFICS:
        w, aside = w[1:], aside + ["honorific"]
    while len(w) > 1 and w[-1] in CREDENTIALS:
        w, aside = w[:-1], aside + ["credential or suffix"]
    kept = [x for i, x in enumerate(w) if len(x) > 1 or i in (0, len(w) - 1)]
    aside += ["middle initial"] * (kept != w)
    return " ".join(kept) or whole, sorted(set(aside))


def person_key(name):
    return person_parts(name)[0]


def same_key_groups(names, key):
    """Lists of two or more distinct names that share a key."""
    by_key = defaultdict(list)
    for name in sorted(set(names)):
        by_key[key(name)].append(name)
    return sorted(g for g in by_key.values() if len(g) > 1)


def prefix_pairs(names, key=fandom_key):
    """(short, long) where the words of one key begin another's: "Star Trek" / "Star Trek: Lower Decks".
    Whole words, so "Star Trek" and "Stargate" do not pair."""
    keyed = sorted((key(name).split(), name) for name in set(names))
    return sorted((a, b) for ka, a in keyed for kb, b in keyed if ka and len(ka) < len(kb) and kb[:len(ka)] == ka)


def generic_reason(name, topics=TOPICS):
    """Why a fandom name reads as a category rather than a property, or None."""
    def singular(k):
        return " ".join(w[:-1] if w.endswith("s") and len(w) > 3 else w for w in k.split())
    k = fandom_key(name)
    for t in topics:
        if k == fandom_key(t):
            return f"equals the topic {t}"
    for t in topics:
        if singular(k) == singular(fandom_key(t)):
            return f"nearly equals the topic {t} (UNSURE)"
    return "in the generic list" if k in {fandom_key(g) for g in GENERIC} else None


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


def adult_wording(event):
    """Where an event says 18+, 21+ or adults only, and the words: ("title" | "description" | "past 600", text),
    or None. "description" is the first 600 characters, which is all the tagger was sent."""
    desc = event.get("description") or ""
    for where, text in (("title", event.get("title") or ""), ("description", desc[:TAGGER_SAW]),
                        ("past 600", desc[TAGGER_SAW:])):
        m = ADULT_RX.search(text)
        if m:
            return where, m.group(0)
    return None


def title_terms(titles, skip=()):
    """How many titles hold each word and each adjacent two-word phrase; stopwords, numbers and `skip` out."""
    drop = STOP | set(skip)
    word_df, phrase_df = Counter(), Counter()
    for t in titles:
        toks = [None if (w in drop or len(w) < 2 or w.isdigit()) else w for w in words(t)]
        word_df.update({w for w in toks if w})
        phrase_df.update({f"{a} {b}" for a, b in zip(toks, toks[1:]) if a and b})
    return word_df, phrase_df


def tag_differences(groups):
    """How many groups of events do not all carry the same tags: {"any": k, field: k}. An event with no tags is
    left out of its group, and the order of a list is not a difference."""
    def value(e, field):
        v = (e.get("tags") or {}).get(field)
        return json.dumps(sorted(v) if isinstance(v, list) else v)
    out = Counter()
    for evs in groups:
        differing = [f for f in TAG_FIELDS if len({value(e, f) for e in evs if e.get("tags")}) > 1]
        out.update(differing + ["any"] * bool(differing))
    return out


def histogram(values, buckets):
    """[(label, count)] for buckets of (label, lo, hi); hi is inclusive, None is no upper bound."""
    return [(label, sum(1 for v in values if v >= lo and (hi is None or v <= hi))) for label, lo, hi in buckets]


def ranked(counter):
    """Count descending, then name."""
    return sorted(counter.items(), key=lambda kv: (-kv[1], str(kv[0])))


def first(counter, at=0):
    """The top of ranked() (the bottom, with at=-1), or a stand-in when there is nothing to rank."""
    return (ranked(counter) or [("(none)", 0)])[at]


def spread(items, k=10):
    """k of the distinct items, evenly spaced through their sorted order: repeatable, and not ten neighbours."""
    items = sorted(set(items))
    return items if len(items) <= k else [items[i * len(items) // k] for i in range(k)]


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def n(x):
    return f"{x:,}"


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def code(s):
    s = " ".join(str(s).split())
    return f"`` {s} ``" if "`" in s else f"`{s}`"


def table(head, rows, left=1):
    """A GFM table: the first `left` columns left-aligned, the rest right-aligned."""
    rule = ["---"] * left + ["---:"] * (len(head) - left)
    lines = [head, rule] + [[str(c).replace("|", "\\|") for c in r] for r in rows]
    return ["| " + " | ".join(r) + " |" for r in lines] + [""]


def counted(pairs):
    return ", ".join(f"{name} ({n(k)})" for name, k in pairs)


def tags(e):
    return e.get("tags") or {}


def tag(e, field):
    return tags(e).get(field) if e.get("tags") else "(untagged)"


# ---------------------------------------------------------------------------
# Sections. Each returns its lines and leaves what sections 0 and 12 need in `facts`.
# ---------------------------------------------------------------------------

def coverage(events, facts):
    total = len(events)
    untagged = [e for e in events if not e.get("tags")]
    no_f = [e for e in events if not tags(e).get("fandoms")]
    no_t = [e for e in events if not tags(e).get("topics")]
    neither = [e for e in no_f if not tags(e).get("topics")]
    by_type, all_type = Counter(e["type"] for e in neither), Counter(e["type"] for e in events)
    by_track = Counter(t for e in neither for t in (e.get("tracks") or ["(no track)"]))
    all_track = Counter(t for e in events for t in (e.get("tracks") or ["(no track)"]))
    facts.update(total=total, tagged=total - len(untagged), untagged=len(untagged), no_f=len(no_f), no_t=len(no_t),
                 neither=len(neither), no_f_type={t: (sum(1 for e in no_f if e["type"] == t), k)
                                                  for t, k in all_type.items()},
                 untagged_track=ranked(Counter(t for e in untagged for t in (e.get("tracks") or ["(no track)"])))[:1])
    agree = "which agrees" if facts["count_field"] == total else "which DOES NOT agree"
    out = ["## 1. Coverage", "",
           f"- Events: {n(total)}. `count` in events.json says {n(facts['count_field'])}, {agree}.",
           f"- With tags: {n(total - len(untagged))}. With no `tags` object at all: {n(len(untagged))}.",
           f"- No fandom: {n(len(no_f))} ({pct(len(no_f), total)}). No topic: {n(len(no_t))} ({pct(len(no_t), total)}). "
           f"Neither: {n(len(neither))} ({pct(len(neither), total)}). "
           f"Each of the three includes the {n(len(untagged))} untagged events.", "",
           "The untagged events:", ""]
    out += [f"- {code(e['title'])} - {e['start']}, {', '.join(e.get('tracks') or ['(no track)'])}"
            for e in sorted(untagged, key=lambda e: (e["title"], e["start"], e["id"]))]
    out += ["", "Neither a fandom nor a topic, by type:", ""]
    out += table(["type", "neither", "of", "share"],
                 [(t, n(k), n(all_type[t]), pct(k, all_type[t])) for t, k in ranked(Counter({t: by_type[t] for t in all_type}))])
    out += ["Neither a fandom nor a topic, by track (top 15; an event with two tracks counts under both):", ""]
    return out + table(["track", "neither", "of", "share"],
                       [(t, n(k), n(all_track[t]), pct(k, all_track[t])) for t, k in ranked(by_track)[:15]])[:-1]


def fandoms(events, facts):
    counts = Counter(f for e in events for f in tags(e).get("fandoms", []))
    per_event = Counter(len(tags(e).get("fandoms", [])) for e in events if e.get("tags"))
    singles = sorted(f for f, k in counts.items() if k == 1)
    groups, pairs = same_key_groups(counts, fandom_key), prefix_pairs(counts)
    foldable = sorted((f, canon_fandom(f)) for f in counts if canon_fandom(f) != f)
    generic = [(f, k, generic_reason(f)) for f, k in ranked(counts) if generic_reason(f)]
    generic_events = sum(1 for e in events if any(generic_reason(f) for f in tags(e).get("fandoms", [])))
    top = ranked(counts)
    top5 = sum(k for _, k in top[:5])
    facts.update(fandoms=len(counts), assignments=sum(counts.values()), singles=len(singles), top_fandom=first(counts),
                 top5=top5, groups=len(groups), pairs=len(pairs), generic=generic, generic_events=generic_events)
    facts["appendix_a"] = [f"- {f}" for f in singles]
    out = ["## 2. Fandoms", "",
           f"- Distinct fandom names: {n(len(counts))}, over {n(sum(counts.values()))} assignments.",
           "- Tagged events by how many fandoms they have: "
           + "; ".join(f"{k}: {n(per_event[k])}" for k in sorted(per_event)) + ".",
           f"- The five largest hold {n(top5)} of the assignments ({pct(top5, sum(counts.values()))}).", "",
           "How many fandoms have how many events:", ""]
    hist = histogram(list(counts.values()), [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6-20", 6, 20), ("21+", 21, None)])
    out += table(["events", "fandoms"], [(label, n(k)) for label, k in hist])
    out += ["Top 50:", ""] + table(["fandom", "events"], [(f, n(k)) for f, k in top[:50]])
    out += [f"The {n(len(singles))} fandoms with one event are in Appendix A.", "",
            "### Near-duplicate candidates - UNSURE", "",
            "Names that are the same once case, punctuation, and/& and a leading \"the\" are set aside:", ""]
    out += [f"- UNSURE: {counted((f, counts[f]) for f in g)}" for g in groups] or ["- none"]
    out += ["", "Names whose words begin another name (whole words only):", ""]
    out += [f"- UNSURE: {a} ({n(counts[a])}) / {b} ({n(counts[b])})" for a, b in pairs] or ["- none"]
    out += ["", "Names in the data that `CANON` in tag_events.py, as it stands today, would fold into another:", ""]
    out += [f"- {a} ({n(counts[a])}) -> {b}" for a, b in foldable] or ["- none"]
    out += ["", "### Fandom names that are a topic, or generic", "",
            f"Checked against the {len(TOPICS)} `TOPICS`, against the same with plurals set aside, and against this "
            f"list: {', '.join(GENERIC)}. {n(generic_events)} events carry at least one of these names.", ""]
    out += table(["fandom", "why", "events"], [(f, why, n(k)) for f, k, why in generic], left=2) if generic else ["- none", ""]
    out += ["### Inside the ten largest", "",
            "Words and adjacent two-word phrases in the titles of each fandom's events, by how many of those events "
            "hold them: up to 20 of each, those on at least 2 events. Out: stopwords, numbers, one-letter words, and "
            "the words of the fandom's own name.", ""]
    for f, k in top[:10]:
        titles = [e["title"] for e in events if f in tags(e).get("fandoms", [])]
        word_df, phrase_df = title_terms(titles, skip=words(f))
        out += [f"**{f}** ({n(k)} events)", "",
                "- Words: " + (counted([p for p in ranked(word_df) if p[1] > 1][:20]) or "none on 2 or more events"),
                "- Phrases: " + (counted([p for p in ranked(phrase_df) if p[1] > 1][:20]) or "none on 2 or more events"), ""]
    return out[:-1]


def topics(events, facts):
    counts = Counter(t for e in events for t in tags(e).get("topics", []))
    per_event = Counter(len(tags(e).get("topics", [])) for e in events if e.get("tags"))
    unused = [t for t in TOPICS if not counts[t]]
    stray = sorted(t for t in counts if t not in TOPICS)
    facts.update(unused=unused, top_topic=first(counts))
    out = ["## 3. Topics", "",
           f"- `TOPICS` has {len(TOPICS)} entries; {len(TOPICS) - len(unused)} are used. "
           f"Unused: {', '.join(unused) or 'none'}.",
           f"- Topic values in the data that are not in `TOPICS`: {', '.join(stray) or 'none'}.",
           "- Tagged events by how many topics they have: "
           + "; ".join(f"{k}: {n(per_event[k])}" for k in sorted(per_event)) + ".", ""]
    return out + table(["topic", "events", "share of all events"],
                       [(t, n(k), pct(k, len(events))) for t, k in ranked(Counter({t: counts[t] for t in TOPICS}))])[:-1]


def kinds(events, facts):
    counts = Counter(tag(e, "kind") for e in events)
    types = [t for t, _ in ranked(Counter(e["type"] for e in events))]
    cross = Counter((tag(e, "kind"), e["type"]) for e in events)
    stray = sorted(k for k in counts if k not in KINDS and k != "(untagged)")
    facts.update(other=counts["other"], top_kind=first(counts), least_kind=first(counts, -1))
    out = ["## 4. Kind", "",
           f"- `other`: {n(counts['other'])} of {n(facts['tagged'])} tagged events ({pct(counts['other'], facts['tagged'])}). "
           "`clean_tags` also writes `other` for any kind the model returned that is not in `KINDS`; the file cannot "
           "tell the two apart.",
           f"- Kinds in `KINDS` with no events: {', '.join(k for k in KINDS if not counts[k]) or 'none'}. "
           f"Kind values not in `KINDS`: {', '.join(stray) or 'none'}.", "",
           "Distribution, and type against kind:", ""]
    return out + table(["kind", "events", "share"] + types,
                       [[k, n(c), pct(c, len(events))] + [n(cross[(k, t)]) for t in types] for k, c in ranked(counts)])[:-1]


def guests(events, facts):
    counts = Counter(tag(e, "guests") for e in events)
    unknown_kind = Counter(tag(e, "kind") for e in events if tag(e, "guests") == "unknown")
    facts.update(unknown=counts["unknown"], celebrity=counts["celebrity"], unknown_kind=first(unknown_kind))
    out = ["## 5. Guests", "",
           f"- `unknown`: {n(counts['unknown'])} of {n(facts['tagged'])} tagged events ({pct(counts['unknown'], facts['tagged'])}). "
           "As with kind, `clean_tags` writes `unknown` for any value it does not recognise.", ""]
    out += table(["guests", "events", "share"], [(g, n(c), pct(c, len(events))) for g, c in ranked(counts)])
    out += ["The `unknown` events, by kind:", ""]
    return out + table(["kind", "events"], [(k, n(c)) for k, c in ranked(unknown_kind)])[:-1]


def adult(events, facts):
    tagged = sorted((e for e in events if e.get("tags")), key=lambda e: (e["title"], e["start"], e["id"]))
    is_adult = [e for e in tagged if tags(e).get("adult")]
    says_not_tagged = [(e, adult_wording(e)) for e in tagged if not tags(e).get("adult") and adult_wording(e)]
    tagged_not_said = [e for e in is_adult if not adult_wording(e)]
    said, on = Counter(), Counter()  # events by (wording, adult), and by a wording's first word: "mature", "adult"
    for e in tagged:
        text = f"{e['title']} {e.get('description') or ''}"
        found = {re.sub(r"\s*\+", "+", " ".join(m.group(0).lower().replace("-", " ").split())) for m in AGE_RX.finditer(text)}
        said.update((wording, bool(tags(e).get("adult"))) for wording in found)
        on.update({wording.split()[0].rstrip("s") for wording in found})
    by_title = defaultdict(list)
    for e in tagged:
        by_title[title_key(e["title"])].append(e)
    split = sorted((ranked(Counter(e["title"] for e in evs))[0][0], sum(1 for e in evs if tags(e).get("adult")), len(evs))
                   for evs in by_title.values() if len({bool(tags(e).get("adult")) for e in evs}) > 1)
    facts.update(adult=len(is_adult), says_not_tagged=len(says_not_tagged), tagged_not_said=len(tagged_not_said),
                 past_600=sum(1 for _, (where, _) in says_not_tagged if where == "past 600"), adult_split=len(split),
                 mature=on["mature"])
    out = ["## 6. Adult", "",
           f"- `adult` is true on {n(len(is_adult))} events ({pct(len(is_adult), facts['tagged'])} of tagged). "
           "The untagged events are in none of the lists below.",
           f"- The wording looked for, in title and description: {code(ADULT_RX.pattern)}. That is 18+, 21+ and adults "
           "only, and also \"Mature Audience\": the schedule's own marker, which closes a description as "
           f"\"(Mature Audience)\" and is on {n(on['mature'])} events. \"Adults only\" is on {n(on['adult'])}.",
           f"- \"past {TAGGER_SAW}\" means the words sit after character {TAGGER_SAW} of the description, which the "
           "tagger was never sent.", "",
           "What the text says, by how the event is tagged (events; every `N+` from 13+ to 21+ is shown):", ""]
    wordings = ranked(Counter({w: said[(w, True)] + said[(w, False)] for w, _ in said}))
    out += table(["wording", "events", "adult true", "adult false"],
                 [(code(w), n(k), n(said[(w, True)]), n(said[(w, False)])) for w, k in wordings])
    out += [f"### Says so, tagged false: {n(len(says_not_tagged))} - UNSURE", ""]
    out += [f"- UNSURE: {code(e['title'])} - {e['start']} - in the {where}: {code(text)}"
            for e, (where, text) in says_not_tagged] or ["- none"]
    out += ["", f"### One title, tagged both ways: {n(len(split))} - UNSURE", "",
            "Titles, normalised as in section 11, whose occurrences do not agree on `adult`:", ""]
    out += [f"- UNSURE: {code(t)} - true on {n(a)} of {n(k)}" for t, a, k in split] or ["- none"]
    out += ["", f"### Tagged true, does not say so: {n(len(tagged_not_said))} - UNSURE", ""]
    out += [f"- UNSURE: {code(e['title'])} - {e['start']} - {', '.join(e.get('tracks') or ['(no track)'])}"
            for e in tagged_not_said] or ["- none"]
    return out


def people(events, facts):
    names = Counter(s["name"] for e in events for s in e.get("speakers") or [])
    roles = Counter(s.get("role") or "(none)" for e in events for s in e.get("speakers") or [])
    celeb = Counter(s["name"] for e in events if tags(e).get("guests") == "celebrity" for s in e.get("speakers") or [])
    variants = same_key_groups(names, person_key)
    carrying = [(p, ", ".join(person_parts(p)[1])) for p in sorted(names) if person_parts(p)[1]]
    initials = sum(1 for _, what in carrying if what == "middle initial")
    silent = [e for e in events if not e.get("speakers")]
    silent_kind = Counter(tag(e, "kind") for e in silent)
    more = [e for e in events if PANELISTS_RX.search(e.get("description") or "")]
    more_silent = sorted((e for e in more if not e.get("speakers")), key=lambda e: (e["title"], e["start"], e["id"]))
    facts.update(names=len(names), variants=len(variants), carrying=len(carrying) - initials, celeb_names=len(celeb), silent=len(silent),
                 more=len(more) - len(more_silent), more_silent=len(more_silent))
    facts["appendix_b"] = table(["name", "celebrity events", "all events"], [(p, n(k), n(names[p])) for p, k in ranked(celeb)])
    out = ["## 7. People", "",
           f"- Distinct speaker names: {n(len(names))}, over {n(sum(names.values()))} appearances.", "",
           "Roles:", ""]
    out += table(["role", "appearances"], [(code(r), n(k)) for r, k in ranked(roles)])
    out += ["How many names have how many appearances:", ""]
    hist = histogram(list(names.values()), [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6-10", 6, 10), ("11-20", 11, 20),
                                            ("21+", 21, None)])
    out += table(["appearances", "names"], [(label, n(k)) for label, k in hist])
    out += [f"### Variant candidates: {n(len(variants))} groups - UNSURE", "",
            "Names that are the same once case, punctuation, honorifics (Dr., Mr.), trailing credentials and "
            "suffixes (PhD, Jr., II), (parentheticals), a \"from X\" or \"of X\" tail and middle initials are set "
            "aside. With appearances:", ""]
    out += [f"- UNSURE: {counted((code(p), names[p]) for p in g)}" for g in variants] or ["- none"]
    out += ["", f"### Names carrying something besides the name: {n(len(carrying) - initials)} - UNSURE", "",
            f"Whether or not another spelling exists. Left out of the list: the {n(initials)} names whose only extra "
            "is a middle initial. With appearances, and what the key set aside:", ""]
    out += [f"- UNSURE: {code(p)} ({n(names[p])}) - {what}" for p, what in carrying if what != "middle initial"] or ["- none"]
    out += ["", "### Names on `guests: celebrity` events", "",
            f"{n(len(celeb))} distinct names appear on the {n(facts['celebrity'])} celebrity events. Everyone credited on "
            "such an event is counted, moderators included. The top 30 are here and the full list is Appendix B.", ""]
    out += table(["name", "celebrity events", "all events"], [(p, n(k), n(names[p])) for p, k in ranked(celeb)[:30]])
    out += ["### Events with no speakers", "",
            f"- {n(len(silent))} events ({pct(len(silent), len(events))}) have an empty `speakers`. By kind: "
            f"{counted(ranked(silent_kind))}.",
            f"- Of those, with \"Additional Panelists:\" in the description: {n(len(more_silent))}.",
            f"- Events that do have speakers and whose description also has \"Additional Panelists:\": "
            f"{n(len(more) - len(more_silent))}. Those names are in the description only."]
    return out + [f"  - {code(e['title'])} - {e['start']}" for e in more_silent]


def descriptions(events, facts):
    lengths = [len((e.get("description") or "").strip()) for e in events]
    short = sum(1 for k in lengths if 0 < k < 80)
    facts.update(no_desc=lengths.count(0), long_desc=sum(1 for k in lengths if k > TAGGER_SAW))
    hist = histogram(lengths, [("0", 0, 0), ("1-79", 1, 79), ("80-199", 80, 199), ("200-399", 200, 399),
                               (f"400-{TAGGER_SAW}", 400, TAGGER_SAW), (f"{TAGGER_SAW + 1}-999", TAGGER_SAW + 1, 999),
                               ("1,000+", 1000, None)])
    out = ["## 8. Descriptions", "",
           f"- Empty: {n(lengths.count(0))} ({pct(lengths.count(0), len(events))}). "
           f"Not empty and under 80 characters: {n(short)} ({pct(short, len(events))}).",
           f"- Over {TAGGER_SAW} characters: {n(facts['long_desc'])}. The tagger was sent the first {TAGGER_SAW}.",
           f"- Longest: {n(max(lengths))} characters. Median: {n(sorted(lengths)[len(lengths) // 2])}.", "",
           "Length in characters, whitespace trimmed:", ""]
    return out + table(["characters", "events", "share"], [(label, n(k), pct(k, len(events))) for label, k in hist])[:-1]


def facets(events, facts):
    in_title = {key: [e for e in events if rx.search(e["title"])] for key, _, rx in FACETS}
    in_desc = {key: sum(1 for e in events if rx.search(e.get("description") or "")) for key, _, rx in FACETS}
    facts.update(faceted=sum(1 for e in events if title_facets(e["title"])))
    flagged = sorted(e["title"] for e in events if e.get("cancelled"))
    out = ["## 9. Facets hiding in titles", "",
           f"{n(facts['faceted'])} events carry at least one of these in the title. The description column is the same "
           "pattern run over descriptions, for scale.", ""]
    out += table(["facet", "titles", "descriptions"], [(label, n(len(in_title[key])), n(in_desc[key])) for key, label, _ in FACETS])
    out += [f"- The `cancelled` field is true on {n(len(flagged))} events: {', '.join(code(t) for t in flagged) or 'none'}.",
            "- Fee wording leaves out \"Ticket to Ride\", which is a board game.",
            "- Examples are up to ten distinct titles, evenly spaced through the alphabetical list of matches.", ""]
    for key, label, rx in FACETS:
        out += [f"### {label}: {n(len(in_title[key]))}", "", f"Pattern: {code(rx.pattern)}", ""]
        out += [f"- {code(t)}" for t in spread(e["title"] for e in in_title[key])] or ["- none"]
        out += [""]
    return out[:-1]


def tracks(events, facts):
    by_track = defaultdict(list)
    for e in events:
        for t in e.get("tracks") or []:
            by_track[t].append(e)
    rows = []
    for t, evs in by_track.items():
        topic, k = first(Counter(tp for e in evs for tp in tags(e).get("topics", [])))
        rows.append((t, len(evs), topic, k))
    rows.sort(key=lambda r: (-r[1], r[0]))
    redundant = [r for r in rows if r[3] / r[1] > 0.8]
    per_event = Counter(len(e.get("tracks") or []) for e in events)
    facts.update(tracks=len(rows), redundant=len(redundant))
    out = ["## 10. Tracks vs tags", "",
           f"- Tracks: {n(len(rows))} distinct values in `tracks[]`. Events by how many tracks they have: "
           + "; ".join(f"{k}: {n(per_event[k])}" for k in sorted(per_event)) + ". An event with two counts under both.",
           "- A track's dominant topic is the topic on the most of its events; its share is those events over all the "
           "track's events, with or without topics. A tie goes to the first name alphabetically.", "",
           f"### Redundant with the topic (share over 80%): {n(len(redundant))} of {n(len(rows))}", ""]
    out += [f"- {t} ({n(k)} events): {topic}, {pct(c, k)}" for t, k, topic, c in redundant] or ["- none"]
    out += ["", "### Every track", ""]
    return out + table(["track", "dominant topic", "events", "with it", "share"],
                       [(t, topic, n(k), n(c), pct(c, k)) for t, k, topic, c in rows], left=2)[:-1]


def recurring(events, facts):
    def groups(key):
        found = defaultdict(list)
        for e in events:
            found[key(e["title"])].append(e)
        return {k: v for k, v in found.items() if len({e["start"] for e in v}) > 1}
    light, deep = groups(title_key), groups(lambda t: title_key(strip_facets(t)))
    rows = []
    for evs in deep.values():
        title = ranked(Counter(e["title"] for e in evs))[0][0]
        rows.append((title, len({e["start"] for e in evs}), len(evs), ranked(Counter(tag(e, "kind") for e in evs))[0][0]))
    rows.sort(key=lambda r: (-r[1], r[0]))
    involved = sum(r[2] for r in rows)
    by_kind = Counter(r[3] for r in rows)
    # Did the tagger give one thing the same tags each time? Once per recurring title, whose occurrences may differ
    # in description or speakers; and once per group of events that gave it the same input, which may not.
    same_input = defaultdict(list)
    for e in events:
        if e.get("tags"):
            same_input[json.dumps([e["title"], e.get("track"), e.get("type"), e.get("speakers"),
                                   (e.get("description") or "")[:TAGGER_SAW]])].append(e)
    same_input = [evs for evs in same_input.values() if len(evs) > 1]
    by_title, by_input = tag_differences(deep.values()), tag_differences(same_input)
    facts.update(recurring=len(rows), recurring_events=involved, recurring_kind=first(by_kind),
                 differs_any=by_title["any"], same_input=len(same_input), same_input_differs=by_input["any"])
    stripped = ", ".join(label for key, label, _ in FACETS if key in STRIPPED)
    out = ["## 11. Recurring", "",
           "A title is normalised by case, accents and punctuation, and counts as recurring when it occurs at more "
           "than one `start`.", "",
           f"- Recurring titles: {n(len(light))}, over {n(sum(len(v) for v in light.values()))} events.",
           f"- With these facets also taken out of the title first ({stripped}): {n(len(rows))} titles, over "
           f"{n(involved)} events ({pct(involved, len(events))} of the schedule). \"Part N\" stays in, so a series is "
           "not a recurrence. The rest of this section uses this count.",
           f"- By the title's most frequent kind: {counted(ranked(by_kind))}.", "",
           "### One thing, tagged more than once", "",
           f"- Recurring titles whose occurrences do not all carry the same tags: {n(by_title['any'])} of {n(len(rows))}. "
           "Occurrences of one title can differ in description and speakers.",
           f"- Groups of two or more tagged events with the same title, track, type, speakers and first {TAGGER_SAW} "
           f"characters of description, which is what the tagger is sent: {n(len(same_input))}, over "
           f"{n(sum(len(evs) for evs in same_input))} events. Groups whose tags are not all the same: {n(by_input['any'])} "
           f"({pct(by_input['any'], len(same_input))}).", "",
           "By field; the order of a list is not a difference, and untagged events are left out:", ""]
    out += table(["field", "recurring titles that differ", "share", "same-input groups that differ", "share"],
                 [(f"`{f}`", n(k), pct(k, len(rows)), n(by_input[f]), pct(by_input[f], len(same_input)))
                  for f, k in ranked(Counter({f: by_title[f] for f in TAG_FIELDS}))])
    out += ["Top 30 by number of start times (the title shown is the group's most frequent spelling):", ""]
    return out + table(["title", "kind", "start times", "events"],
                       [(code(t), kind, n(s), n(k)) for t, s, k, kind in rows[:30]], left=2)[:-1]


# ---------------------------------------------------------------------------
# Sections 0 and 12 are drawn from the others, so they are computed last and no number is typed by hand.
# ---------------------------------------------------------------------------

def headline(f):
    total, tagged = f["total"], f["tagged"]
    return ["## 0. Headline numbers", "",
            f"1. Events: {n(total)}, and `count` in events.json says {n(f['count_field'])}. Tagged: {n(tagged)}. "
            f"No tags at all: {n(f['untagged'])}.",
            f"2. No fandom: {n(f['no_f'])} ({pct(f['no_f'], total)}). No topic: {n(f['no_t'])} ({pct(f['no_t'], total)}). "
            f"Neither: {n(f['neither'])} ({pct(f['neither'], total)}).",
            f"3. Fandoms: {n(f['fandoms'])} distinct names over {n(f['assignments'])} assignments; {n(f['singles'])} "
            f"appear once; the largest is {f['top_fandom'][0]} ({n(f['top_fandom'][1])}).",
            f"4. Fandom names to look at (UNSURE): same-key groups {n(f['groups'])}, prefix pairs {n(f['pairs'])}. "
            f"Names that are a topic or generic: {n(len(f['generic']))}, on {n(f['generic_events'])} events.",
            f"5. Topics: {len(TOPICS) - len(f['unused'])} of {len(TOPICS)} used (unused: {', '.join(f['unused']) or 'none'}); "
            f"the largest is {f['top_topic'][0]} ({n(f['top_topic'][1])}).",
            f"6. Kind: `other` on {n(f['other'])} of {n(tagged)} tagged events ({pct(f['other'], tagged)}); the largest is "
            f"`{f['top_kind'][0]}` ({n(f['top_kind'][1])}).",
            f"7. Guests: `unknown` on {n(f['unknown'])} ({pct(f['unknown'], tagged)} of tagged); `celebrity` on "
            f"{n(f['celebrity'])}.",
            f"8. Adult: {n(f['adult'])} events. UNSURE: says 18+, 21+, adults only or \"Mature Audience\" and tagged "
            f"false, {n(f['says_not_tagged'])}; tagged true and says none of them, {n(f['tagged_not_said'])}; one title "
            f"tagged both ways, {n(f['adult_split'])}.",
            f"9. People: {n(f['names'])} distinct speaker names; UNSURE: variant groups {n(f['variants'])}, names carrying "
            f"a title, credential, parenthetical or \"from X\" tail {n(f['carrying'])}. Names on celebrity events: "
            f"{n(f['celeb_names'])}. Events with no speakers: {n(f['silent'])} ({pct(f['silent'], total)}).",
            f"10. Titles: {n(f['faceted'])} carry a facet ($, SOLD OUT, a clock time and the like); {n(f['recurring'])} "
            f"titles recur at more than one start time, over {n(f['recurring_events'])} events; {n(f['redundant'])} of "
            f"{n(f['tracks'])} tracks have one topic on over 80% of their events."]


def observations(f):
    total = f["total"]
    by_type = "; ".join(f"{pct(a, b)} of type {t} ({n(a)} of {n(b)})" for t, (a, b) in sorted(f["no_f_type"].items()))
    topical = [name for name, _, why in f["generic"] if why.startswith("equals")]
    return ["## 12. Observations", "", "Facts from the sections above; at most ten.", "",
            f"- Events with no `tags` object: {n(f['untagged'])}. The track with the most of them: "
            f"{counted(f['untagged_track']) or 'none'}.",
            f"- Events with no fandom: {by_type}.",
            f"- {n(f['singles'])} of {n(f['fandoms'])} fandom names ({pct(f['singles'], f['fandoms'])}) appear on one "
            f"event; the five largest hold {pct(f['top5'], f['assignments'])} of all fandom assignments.",
            f"- {n(len(topical))} fandom names are also entries in `TOPICS`: {', '.join(topical) or 'none'}.",
            f"- `other` is {pct(f['other'], f['tagged'])} of tagged events; the least used kind is `{f['least_kind'][0]}` "
            f"({n(f['least_kind'][1])}).",
            f"- `guests` is `unknown` on {n(f['unknown'])} events; the kind with the most of them is "
            f"`{f['unknown_kind'][0]}` ({n(f['unknown_kind'][1])}).",
            f"- \"Mature Audience\", the schedule's own marker, is in the text of {n(f['mature'])} events, and `adult` is "
            f"true on {n(f['adult'])}. Says so and tagged false: {n(f['says_not_tagged'])}, of which "
            f"{n(f['past_600'])} say it only past character {TAGGER_SAW} of the description, which the tagger never saw.",
            f"- {n(f['silent'])} events ({pct(f['silent'], total)}) have no speakers, and {n(f['more'])} events with "
            "speakers name more people in an \"Additional Panelists:\" line that `speakers` does not hold.",
            f"- {n(f['recurring'])} titles recur, over {n(f['recurring_events'])} events ({pct(f['recurring_events'], total)} "
            f"of the schedule); most often the title's kind is `{f['recurring_kind'][0]}` ({n(f['recurring_kind'][1])} titles). "
            f"Of {n(f['same_input'])} groups of events that gave the tagger the same input, {n(f['same_input_differs'])} "
            "do not all carry the same tags.",
            f"- {n(f['redundant'])} of {n(f['tracks'])} tracks have a single topic on more than 80% of their events; "
            f"{n(f['long_desc'])} descriptions run past the {TAGGER_SAW} characters the tagger was sent."]


def render(data, source=EVENTS):
    events = data["events"]
    facts = {"count_field": data.get("count")}
    body = []
    for section in (coverage, fandoms, topics, kinds, guests, adult, people, descriptions, facets, tracks, recurring):
        body += section(events, facts) + [""]
    head = ["# Tag census - the 2026 schedule", "",
            f"Written by `tag_census.py` from `{source.replace(os.sep, '/')}` (`generated_at` {data.get('generated_at')}, "
            f"source {data.get('source')}). Do not edit it by hand; run the script again.", "",
            "It states facts and recommends nothing. `UNSURE` marks a candidate that needs a person's judgment, and "
            "nothing here resolves one. Lists run by count, descending, then by name; a list with no counts runs by "
            "name. Event titles and patterns are in code spans so that their punctuation shows as written.", ""]
    tail = ["## Appendix A. Fandoms with one event", ""] + facts["appendix_a"] + [""]
    tail += ["## Appendix B. Every name on a `guests: celebrity` event", ""] + facts["appendix_b"]
    return "\n".join(head + headline(facts) + [""] + body + observations(facts) + [""] + tail)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", default=EVENTS)
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()
    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    text = render(data, args.file)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:  # LF on Windows too (.gitattributes)
        f.write(text)
    print(f"{args.out}: {len(data['events'])} events, {text.count(chr(10)) + 1} lines")


if __name__ == "__main__":
    main()
