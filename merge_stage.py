#!/usr/bin/env python3
"""The merge (DECISIONS #43, #44; docs/pipeline/contract.md, The merge): the one place a group of raw rows becomes an
event.

    from merge_stage import merge
    events = merge(rows, ledger)   # one event per id, in the order of each id's first row

`rows` are raw rows (#42), each carrying our id (#43): a live year's as ids_stage.assign() returns them, a frozen
year's with its id its source id. The rows of one id are one event. Existence is the group's and content a row's.
The group's rows sort by source id, in string order - the fix history-2026.md proposes (section 6) - and then:

    removed      only where every row of the group is removed.
    supplying    the smallest row not removed, or the smallest of all where every row is. It supplies every scalar,
                 source_id and stale among them, but one: type is panel where any row not removed is panel (every
                 row read only where every row is removed), as 2026's merge put panel over gaming.
    tracks,      the unions of the rows not removed (of every row, only where every row is), taken in that order:
    speakers     each row's list in turn, less the entries a row before it already has. A speaker is its whole
                 {name, role} entry, so a person listed twice in two roles stays twice - one event in 2026 does it -
                 and the parse step's people still hold one entry an id.
    description  the longest of those same rows, a tie going to the first in that order.
    was          the ids merged into this one, directly or through another id merged into it: the ledger's
                 merged_into lines, followed to the id that survived. Sorted, and only where there are any.

A frozen year's rows are groups of one, and the merge is the identity on them: each comes back as it was. Pure: the
inputs are not changed, and nothing it returns is one of their objects. Standard library, and nothing of ours is
imported: build calls it (events_v2.py), and the tag stage will (PR 7), so neither imports the other for it.
"""

import copy
import json

# The ten fields of a raw row after its source_id, in the order the row writes them (scraper.ROW_FIELDS).
FIELDS = ("type", "title", "day", "start", "end", "duration_min", "location", "description", "tracks", "speakers")


def merge(rows, ledger):
    """One event per id -> [event], in the order each id's first row comes in `rows`. `rows` carry `id`; `ledger` is
    ids_stage.read_ledger()'s, read for `was` alone, and None or {} for a frozen year, which has none. An event is its
    id, its source_id, the ten fields, and stale, removed and was where set."""
    groups = {}
    for row in rows:
        groups.setdefault(row["id"], []).append(row)
    was = merged_into_each(ledger or {})
    return [_event(eid, sorted(group, key=lambda r: r["source_id"]), was.get(eid)) for eid, group in groups.items()]


def merged_into_each(ledger):
    """{id: [every id merged into it, directly or through another merged id]}, each list sorted. A merge moves every
    source id of a line (#43), so an id merged away holds no rows, and its own merged_into names where they went: A
    into B and B into C puts A and B on C's event, where a pick on A lands."""
    into = {i: line["merged_into"] for i, line in ledger.items() if line.get("merged_into")}
    out = {}
    for i in into:
        at, seen = into[i], {i}
        while at in into and at not in seen:   # a cycle cannot arise from the ids stage; stop rather than loop
            seen.add(at)
            at = into[at]
        out.setdefault(at, []).append(i)
    return {k: sorted(v) for k, v in out.items()}


def _event(eid, group, was):
    """One id's rows, sorted by source id, as one event."""
    live = [r for r in group if not r.get("removed")]
    reading = live or group
    supplying = reading[0]
    event = {"id": eid, "source_id": supplying["source_id"]}
    for field in FIELDS:
        event[field] = copy.deepcopy(supplying[field])
    if any(r["type"] == "panel" for r in reading):
        event["type"] = "panel"
    event["tracks"] = _union(r["tracks"] for r in reading)
    event["speakers"] = _union(r["speakers"] for r in reading)
    event["description"] = max((r["description"] for r in reading), key=lambda d: len(d or ""))
    if supplying.get("stale"):
        event["stale"] = True
    if not live:
        event["removed"] = True
    if was:
        event["was"] = list(was)
    return event


def _union(lists):
    """The lists joined in order, each less the entries an earlier list already has: an entry is its whole value, and
    a list's own repeats are its own, so one list comes back as it was."""
    out, seen = [], set()
    for items in lists:
        before = set(seen)
        for item in items or []:
            key = json.dumps(item, sort_keys=True, ensure_ascii=False)
            if key not in before:
                out.append(copy.deepcopy(item))
                seen.add(key)
    return out
