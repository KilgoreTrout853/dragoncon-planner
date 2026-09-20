#!/usr/bin/env python3
"""What `parse_stage.py` reads out of data/2026/events.json, written to docs/discover/parse-2026.md.

The report for PR 2 of the Discover sequence (`docs/discover/schema-v2.md`). It states facts and
decides nothing: every count beside a facet is the census's own figure for the same thing,
computed here with the census's own pattern rather than typed, and a gap between the two is
explained. `UNSURE` marks wording or a name that needs a person's judgment.

    python parse_report.py                        # data/2026/events.json -> docs/discover/parse-2026.md
    python parse_report.py --file F --out O

Deterministic: every list is sorted, no set is iterated unsorted, and the only timestamp is
events.json's own generated_at. Two runs, no diff. It reads events.json and never writes it
(DECISIONS #13). Standard library, plus `parse_stage` and the census's markdown helpers.
"""

import argparse
import json
import os
import re
from collections import Counter, defaultdict

import parse_stage as ps
from tag_census import code, counted, n, pct, ranked, spread, table

EVENTS = "data/2026/events.json"
OUT = "docs/discover/parse-2026.md"
EXAMPLES = 10
BUSIEST = 20

# A fragment the splitter kept whole where a person might disagree: (reason, pattern).
UNCLEAN = [
    ("two names joined by \"&\"", re.compile(r"\s&\s")),
    ("a \" - \" that is either an affiliation or a surname", re.compile(r"\s-\s")),
    ("a \"with X\" tail", re.compile(r"\bwith\b", re.I)),
]
TAIL = re.compile(r"\s+(?:from|of|with)\s+", re.I)
NOT_A_ROLE = re.compile(r"\(([^()]*)\)")


def census_hits(events, key, where="title"):
    """How many events the census's own FACETS pattern matches, in its own scope."""
    rx = dict((k, rx) for k, _, rx in ps.FACETS)[key]
    return sum(1 for e in events if rx.search(e["title"] if where == "title" else e.get("description") or ""))


def facet_section(events, parsed, facts):
    """Per facet: what the parse set, what the census counted, and the gap."""
    got = defaultdict(list)
    for e in parsed:
        for key in e["facets"]:
            got[key].append(e)
    mature_words = sum(1 for e in events if re.search(r"\bmature audiences?\b", f"{e['title']} {e.get('description') or ''}", re.I))
    marker = sum(1 for e in events if re.search(r"\(\s*mature audiences?\s*\)", f"{e['title']} {e.get('description') or ''}", re.I))
    only_adults = sum(1 for e in events if re.search(r"\badults?[\s-]+only\b", f"{e['title']} {e.get('description') or ''}", re.I))
    either = sum(1 for e in events if ps.MATURE_WORDS.search(f"{e['title']}\n{e.get('description') or ''}"))
    ages = Counter()
    for e in events:
        for age in set(ps.stated_ages(f"{e['title']}\n{e.get('description') or ''}")):
            ages[age] += 1
    age_events = sum(1 for e in events if ps.stated_ages(f"{e['title']}\n{e.get('description') or ''}"))
    paid_titles, fee_titles = census_hits(events, "paid"), census_hits(events, "fee")
    fee_descs, part_titles = census_hits(events, "fee", "description"), census_hits(events, "part")
    sold_titles = census_hits(events, "sold_out")
    repeats = ps.repeat_keys(events)
    says_none = [e for e in events if ps.NEGATED.search(f"{e['title']}\n{e.get('description') or ''}")]
    no_charge = sum(1 for e in says_none
                    if re.search(r"\bno charge\b", f"{e['title']}\n{e.get('description') or ''}", re.I))
    facts.update(facets={k: len(v) for k, v in got.items()}, mature_marker=marker, repeats=len(repeats),
                 says_none=len(says_none))

    rows = [
        ("mature", len(got["mature"]),
         f"section 6: {n(mature_words)} events whose text says \"Mature Audience\"",
         f"{n(marker)} of those write it as the marker \"(Mature Audience)\" and {n(mature_words - marker)} without "
         f"the brackets. \"Adults only\" is on {n(only_adults)} and brings {n(either - mature_words)} more; a stated "
         f"18+ or over adds the last {n(len(got['mature']) - either)}."),
        ("min_age", len(got["min_age"]),
         f"section 6: a 13+ to 21+ wording on {n(age_events)} events",
         "None. The section 6 table's rows sum to " + n(sum(ages.values())) + " because one event states two ages; "
         "the higher is the gate: " + counted((f"{age}+", k) for age, k in sorted(ages.items())) + "."),
        ("cost", len(got["cost"]),
         f"section 9: {n(paid_titles)} titles carry $ or $$, {n(fee_titles)} fee or ticket wording",
         f"The census read titles; a price is usually in the description ({n(fee_descs)} carry fee wording there), "
         "and most of the difference is gaming's \"Price: $N\". No event states a zero or free price."),
        ("sold_out", len(got["sold_out"]), f"section 9: {n(sold_titles)} titles say SOLD OUT",
         "None. Two descriptions say it as well, and both belong to events whose title already does."),
        ("signup", len(got["signup"]),
         f"section 9: fee, ticket or pre-registration wording in {n(fee_titles)} titles and {n(fee_descs)} descriptions",
         "The census's net catches every \"ticket\" and \"fee\"; this reads pre-registration wording only, so a "
         "gaming prize \"500 tickets\" and a panel about a $3 trillion space economy set nothing."),
        ("part", len(got["part"]), f"section 9: Part N or Repeat in {n(part_titles)} titles",
         "None. \"Repeat\" alone gives no number, and no title carries it without a Part N."),
        ("repeat_key", len(got["repeat_key"]),
         f"section 11: {n(len(repeats))} titles recur, over {n(len(got['repeat_key']))} events",
         "None. It is the same key and the same rule: the title with $, SOLD OUT, a clock time and CANCELLED taken "
         "out, present only where that key occurs at more than one start."),
    ]
    out = ["## 1. Facets", "",
           f"What `facets_for` set, against the census's count of the same wording. A key is present only where the "
           f"listing states it; an absent key means the listing says nothing, not \"free\" or \"open\". "
           f"{n(facts['faceted'])} of {n(len(events))} events ({pct(facts['faceted'], len(events))}) carry at least "
           "one key other than `repeat_key`.", ""]
    out += table(["key", "events", "the census, for comparison", "the gap"],
                 [(f"`{key}`", n(k), census, gap) for key, k, census, gap in rows], left=3)
    out += [f"- {n(len(says_none))} events say there is no fee or charge, {n(no_charge)} of them the photoshoot "
            "listings' \"There is no charge to participate\". `cost` is absent on every one, which is what an absent "
            "key means; none of them also carries a price, so no trigger was suppressed.",
            f"- Examples are up to {EXAMPLES} distinct titles, evenly spaced through the alphabetical list, as the "
            "census does it.", ""]
    for key, k, _, _ in rows:
        out += [f"### `{key}`: {n(k)}", ""]
        if key in ("min_age", "part"):
            values = {e["title"]: e["facets"][key] for e in sorted(got[key], key=lambda e: e["title"])}
            out += [f"- {code(t)} - `{values[t]}`" for t in spread(values, EXAMPLES)] or ["- none"]
        elif key == "repeat_key":
            top = ranked(Counter(e["facets"]["repeat_key"] for e in got[key]))[:EXAMPLES]
            out += [f"- {code(t)} - {n(k)} events" for t, k in top] or ["- none"]
        else:
            out += [f"- {code(t)}" for t in spread((e["title"] for e in got[key]), EXAMPLES)] or ["- none"]
        out += [""]
    return out[:-1]


def people_section(events, parsed, facts):
    people = [(e, p) for e in parsed for p in e["people"]]
    ids = {p["id"] for _, p in people}
    from_desc = {p["id"] for _, p in people if p["src"] == "description"}
    only_desc = from_desc - {p["id"] for _, p in people if p["src"] == "speakers"}
    busiest = Counter(p["id"] for _, p in people if p["id"] in only_desc)
    shown = {p["id"]: p["name"] for _, p in sorted(people, key=lambda x: (x[1]["id"], x[1]["name"]))}
    roles = Counter(p["role"] or "(none)" for _, p in people)
    with_line = [e for e in parsed if ps.split_panelists(e.get("description") or "")]
    derived = [e for e in parsed if ps.scraper_derived_speakers(e)]
    facts.update(ids=len(ids), only_desc=len(only_desc), derived=len(derived), with_line=len(with_line),
                 people=len(people))

    out = ["## 2. People", "",
           f"- Distinct ids: {n(len(ids))}, over {n(len(people))} appearances on {n(len(events))} events. An id "
           "appears once in an event, and an event's list begins with its `speakers`, in order, except on the "
           "events at the end of this section, where `speakers` is not read.",
           f"- Ids that reach an event from a description: {n(len(from_desc))}. Ids that reach one no other way - "
           f"never `src: speakers` anywhere: {n(len(only_desc))}. That is larger than the census's count of the "
           "people a line names and `speakers` lacks, because on the events below `speakers` is not read at all, so "
           "everyone on them is `src: description`.",
           f"- Events carrying an \"Additional Panelists:\" line: {n(len(with_line))}.", "",
           "Roles, over all appearances:", ""]
    out += table(["role", "appearances"], [(code(r), n(k)) for r, k in ranked(roles)])
    out += [f"### The {n(BUSIEST)} busiest people who are only ever in a description", "",
            "Nobody here is ever read from an event's `speakers`, so the registry (#31) would not meet them through "
            "one. Some are in a `speakers` the scraper built from the line itself, which is the same thing.", ""]
    out += table(["name", "events"], [(shown[pid], n(k)) for pid, k in ranked(busiest)[:BUSIEST]])
    return out + derived_section(parsed, derived, facts) + roles_section(parsed, facts)


def derived_section(parsed, derived, facts):
    """The events whose `speakers` is only the scraper's own older reading of the same line."""
    pairs, added = Counter(), Counter()
    for e in derived:
        old = [p["name"] for p in ps.legacy_panelists(e.get("description") or "")]
        new = [p["name"] for p in e["people"]]
        by_slug = defaultdict(list)
        for name in new:
            by_slug[ps.person_slug(name)].append(name)
        for name in old:
            if name in new:
                continue
            same = [x for x in by_slug[ps.person_slug(name)] if x != name]
            pairs[(name, same[0] if same else "(dropped: it is not one name)")] += 1
        for name in new:
            if name not in old and not any(ps.person_slug(name) == ps.person_slug(o) for o in old):
                added[name] += 1
    facts["reread"] = len(pairs)
    return ["### Events whose `speakers` the scraper built from this same line", "",
            f"- {n(len(derived))} of the {n(facts['with_line'])} ({pct(len(derived), facts['with_line'])}). "
            "`scraper.py` fills `speakers` from the description "
            "when the detail page has no Speakers section, so on these events `speakers` is not a second source - it "
            "is an older parse of the line. `people` is built from the line again, and everyone on it is "
            "`src: description`.",
            f"- Names the two parsers read differently: {n(len(pairs))}, over {n(sum(pairs.values()))} appearances. "
            f"Names the newer parse adds that the older one never named: {n(len(added))}.", ""] + \
        table(["scraper.extract_panelists", "split_panelists", "appearances"],
              [(code(old), code(new), n(k)) for (old, new), k in sorted(pairs.items())], left=2)[:-1]


def roles_section(parsed, facts):
    """Where two readings of one person's role disagree."""
    in_name, across, in_name_used = Counter(), Counter(), 0
    for e in parsed:
        derived = ps.scraper_derived_speakers(e)
        for s in e.get("speakers") or []:
            field = " ".join(str(s.get("role") or "").split())
            _, marked = ps.split_role(s.get("name") or "")
            if marked and marked != field:
                in_name[(field or "(none)", marked, ps.speaker_role(s), "no" if derived else "yes")] += 1
                in_name_used += not derived
        if derived:  # `speakers` is the line, so it cannot disagree with it
            continue
        by_slug = {ps.person_slug(s.get("name") or ""): ps.speaker_role(s) for s in e.get("speakers") or []}
        for p in ps.split_panelists(e.get("description") or ""):
            slug = ps.person_slug(p["name"])
            if slug in by_slug and by_slug[slug] != p["role"]:
                across[(by_slug[slug], p["role"])] += 1
    facts.update(role_in_name=sum(in_name.values()), role_used=in_name_used, role_across=sum(across.values()))
    out = ["", "### Roles that disagree", "",
           "A role parenthetical the schedule wrote into the name itself beats a role field that only says a person "
           f"is present (`Speaker`, `Panelist`, or none); a field naming a specific role stands. The schedule does "
           f"that on {n(sum(in_name.values()))} appearances, and on {n(in_name_used)} of them the `speakers` entry "
           "is the one `people` uses - every other one is on an event whose `speakers` the scraper built from the "
           "line, where the line is read again instead.", ""]
    out += table(["the `role` field", "in the name", "kept", "`speakers` used", "appearances"],
                 [(code(field), code(marked), code(kept), used, n(k))
                  for (field, marked, kept, used), k in sorted(in_name.items())], left=4) if in_name else ["- none", ""]
    out += [f"Between `speakers` and the line, `speakers` wins. Events where both are read and they disagree: "
            f"{n(sum(across.values()))} appearances.", ""]
    return out + (table(["`speakers` says", "the line says", "appearances"],
                        [(code(a), code(b), n(k)) for (a, b), k in sorted(across.items())], left=2)[:-1]
                  if across else ["- none"])


def unsure_section(events, parsed, facts):
    """Four lists, none of them resolved here."""
    broad = dict((k, rx) for k, _, rx in ps.FACETS)["fee"]
    unset = Counter()
    for e in parsed:
        text = f"{e['title']}\n{e.get('description') or ''}"
        cost, signup, negated = ps.cost_wording(e)
        wording = broad.search(text)
        if negated and (cost or signup):  # a price and "no fee" in one listing: neither key is set
            unset[(e["title"], negated.group(0).strip(), "the same text says there is none")] += 1
        elif not (cost or signup) and wording:
            unset[(e["title"], wording.group(0).strip(), "wording not acted on")] += 1

    frags, lines = Counter(), []
    for e in sorted(parsed, key=lambda e: (e["title"], e["start"] or "", e["id"])):
        desc = e.get("description") or ""
        if not ps.PANELIST_MARKER.search(desc):
            continue
        tail = desc[ps.PANELIST_MARKER.search(desc).end():]
        if len(ps.PANELIST_MARKER.findall(desc)) > 1:
            lines.append((e["title"], "the line's own marker occurs twice in the description"))
        if re.search(r",\s*,|,\s*$", tail.strip()):
            lines.append((e["title"], "a doubled or trailing comma, so one fragment is empty"))
        for p in ps.split_panelists(desc):
            why = [reason for reason, rx in UNCLEAN if rx.search(p["name"])]
            why += ["a parenthetical that is not a role"] * bool(NOT_A_ROLE.search(p["name"]))
            if why:
                frags[(p["name"], "; ".join(sorted(set(why))))] += 1

    names = defaultdict(set)
    for e in parsed:
        for p in e["people"]:
            names[p["id"]].add(p["name"])
    shared = sorted((slug, sorted(spellings)) for slug, spellings in names.items() if len(spellings) > 1)
    tails = sorted({p["name"] for e in parsed for p in e["people"] if TAIL.search(p["name"])})
    facts.update(unset=sum(unset.values()), unclean=len(frags) + len(lines), shared=len(shared), tails=len(tails))

    out = ["## 3. UNSURE", "", "Nothing below is resolved here.", "",
           f"### Wording left unset: {n(sum(unset.values()))}", "",
           "An event whose text carries the census's fee, ticket or registration net and whose `cost` and `signup` "
           "are both absent, or whose listing states a price and that there is none. Precision over recall: in "
           "doubt the parse sets nothing. With the events that hold each.", ""]
    out += [f"- UNSURE: {code(t)} ({n(k)}) - {code(what)} - {why}"
            for (t, what, why), k in sorted(unset.items())] or ["- none"]
    out += ["", f"### Lines that did not split cleanly: {n(len(frags) + len(lines))}", "",
            "A fragment the splitter kept whole where a person might read two names, a name and an affiliation, or a "
            "name and a handle; and a line whose punctuation is its own problem. With the lines that hold each.", ""]
    out += [f"- UNSURE: {code(name)} ({n(k)}) - {why}" for (name, why), k in sorted(frags.items())]
    out += [f"- UNSURE: {code(t)} - {why}" for t, why in sorted(set(lines))]
    out += ["", f"### One slug, two or more spellings: {n(len(shared))}", "",
            "The slug is the id and an id is forever (#31), so these are one person to a follow whether or not they "
            "are one person. Merging or separating them is the registry's, with an alias.", ""]
    out += [f"- UNSURE: `{slug}` - {', '.join(code(s) for s in spellings)}" for slug, spellings in shared] or ["- none"]
    out += ["", f"### Names carrying a \"from X\" or \"of X\" tail: {n(len(tails))}", "",
            "Kept, tail and all: the tail is how the schedule names the person, and an id that moves later is a "
            "follow that breaks.", ""]
    return out + ([f"- UNSURE: {code(t)}" for t in tails] or ["- none"])


def headline(f):
    return ["## 0. Headline", "",
            f"1. Events parsed: {n(f['total'])}. Facet keys set: {n(sum(f['facets'].values()))}, on "
            f"{n(f['faceted'])} events besides `repeat_key`'s {n(f['facets'].get('repeat_key', 0))}.",
            f"2. Facets, by how many events carry one: "
            f"{counted((f'`{k}`', v) for k, v in ranked(Counter(f['facets'])))}.",
            f"3. People: {n(f['ids'])} distinct ids over {n(f['people'])} appearances. {n(f['only_desc'])} of them "
            "only ever reach an event through a description line.",
            f"4. Of the {n(f['with_line'])} events with an \"Additional Panelists:\" line, {n(f['derived'])} have a "
            f"`speakers` the scraper built from that same line; the two parsers read {n(f['reread'])} names "
            "differently.",
            f"5. Roles: a parenthetical in the name beats a generic field on {n(f['role_in_name'])} appearances, "
            f"{n(f['role_used'])} of them on an event whose `speakers` is read; `speakers` and the line disagree on "
            f"{n(f['role_across'])}.",
            f"6. UNSURE: wording left unset {n(f['unset'])}, lines that did not split cleanly {n(f['unclean'])}, one "
            f"slug with two or more spellings {n(f['shared'])}, names carrying a from/of tail {n(f['tails'])}."]


def render(data, source=EVENTS):
    events = data["events"]
    parsed = ps.parse_all(events)
    facts = {"total": len(events),
             "faceted": sum(1 for e in parsed if set(e["facets"]) - {"repeat_key"})}
    body = facet_section(events, parsed, facts) + [""]
    body += people_section(events, parsed, facts) + [""]
    body += unsure_section(events, parsed, facts)
    head = ["# Parse stage - the 2026 schedule", "",
            f"Written by `parse_report.py` from `{source.replace(os.sep, '/')}` (`generated_at` "
            f"{data.get('generated_at')}, source {data.get('source')}). Do not edit it by hand; run the script again.",
            "",
            "What `parse_stage.py` reads out of the frozen schedule with no model: `people` and `facets` "
            "(DECISIONS #32, `schema-v2.md`). It states facts and recommends nothing. Each facet is shown beside the "
            "census's count of the same wording (`census-2026.md`), computed here with the census's own pattern, and "
            "any difference is explained. `UNSURE` marks what needs a person's judgment. Titles and names are in "
            "code spans so that their punctuation shows as written.", ""]
    return "\n".join(head + headline(facts) + [""] + body)


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
