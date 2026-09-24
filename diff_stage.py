#!/usr/bin/env python3
"""The diff stage (DECISIONS #47; docs/pipeline/contract.md, The change log): what changed between the previous
events.v2.json and this run's, one line per event and kind, and the file's changed_at.

    from diff_stage import diff, render
    result = diff(previous, current, stamp=stamp, sha=sha, attribution=attribution)
    text = render(result.lines)                     # the caller appends it to changes.jsonl

`previous` and `current` are v2 documents as events_v2.build() returns them; `previous` is None on a season's first
run. `attribution` is a third document, the previous run's rows through the current code, which the caller builds
with events_v2.attribution(); None when the commit is unchanged. Pure: no file, no git, no clock - the stamp and the
sha are arguments, and nothing given is changed.

The kinds, one line per (id, kind):

    added        an id previous does not hold: its only line, even where current carries it removed
    removed      removed in current and not in previous; restored, the reverse
    cancelled    cancelled in current and not in previous; uncancelled, the reverse
    time         start or end changed: from and to {start, end}
    place        hotel or room changed: from and to {hotel, room}
    title        from and to the titles
    people       the sets of person ids differ: from and to the sorted ids
    tracks       the sets of tracks differ: from and to the sorted tracks. The file keeps the merge's order, and the
                 log compares sets, so an order alone is no change
    description  it changed: no from or to
    merged       an id previous holds and current does not, which a current event's `was` names: `to` the survivor.
                 `was` holds every id merged into its event all season, so an id previous never held was logged in
                 the run it left, and is not logged again

Never tags, stale, was, source_id, or the venues step's level, rooms and place: a retag, a stale carry-forward, a
change of group membership and a reading that keeps the hotel and the room make no line.

The cause (#47). With attribution, a line is "source" where attribution and current differ on its kind - an event
attribution lacks differs on every kind, and a merged id agrees only where attribution merges it into the same
survivor - and "code" where they agree: the previous rows, read by the current code, already change it. Where the code and the source both changed a kind, the line is "source", its from and to the
whole change. Without attribution every line is "source". from and to are always previous to current. Attribution
sees the build's code and data - the registries, the venues file, the cache and the version - not the fetch's: a
change to the fetch's parsing or its repair reaches the raw rows themselves, and reads as source (last-run.json's
fetch_code_changed, PR 8's, says when).

A line is {run, sha, id, kind, from, to, cause}, in that order: from and to only where the kind has them, `to` alone
for merged. Lines sort by run, id and kind, in string order. changed_at is the stamp when current's digest differs
from previous's, or previous is None, and previous's changed_at otherwise; changes_logged is the count of lines.

Fatal, as DiffError, naming the ids: an id previous holds that current does not and that no current event's `was`
names. The ledger deletes no line in season (#43), so an event leaves the file by a merge or not at all: the input is
corrupt, which is not a degradation (#44). Standard library, and nothing of ours is imported.
"""

import json
from collections import Counter
from dataclasses import dataclass, field

LINE_KEYS = ("run", "sha", "id", "kind", "from", "to", "cause")
FROM_TO = ("time", "place", "title", "people", "tracks")     # the kinds that carry from and to; merged carries `to`
# What a kind compares of an event, which is also its from and to where it has them.
VALUES = {
    "time": lambda e: {"start": e["start"], "end": e["end"]},
    "place": lambda e: {"hotel": e["hotel"], "room": e["room"]},
    "title": lambda e: e["title"],
    "people": lambda e: sorted({p["id"] for p in e.get("people") or []}),
    "tracks": lambda e: sorted(e.get("tracks") or []),
    "description": lambda e: e.get("description"),
}
FLAGS = {"removed": "removed", "restored": "removed", "cancelled": "cancelled", "uncancelled": "cancelled"}


class DiffError(Exception):
    """A fatal diff (#44): the input is corrupt. The caller writes nothing."""


@dataclass
class DiffResult:
    """What diff() returns (contract.md, The change log): the run summary reads the counts (#44; PR 8)."""
    lines: list                                        # the change lines, sorted by run, id and kind
    changed_at: str                                    # the file's changed_at after this run
    changes_logged: int                                # the count of lines
    kinds: Counter = field(default_factory=Counter)    # lines by kind
    causes: Counter = field(default_factory=Counter)   # lines by cause: source, code


def diff(previous, current, *, stamp, sha, attribution=None):
    """previous -> current, as change lines (the module's docstring has the kinds and the cause) -> DiffResult.
    Raises DiffError where an event left the file by no merge."""
    before = _by_id(previous) if previous is not None else {}
    after = _by_id(current)
    into = _survivors(current)
    vanished = sorted(i for i in before if i not in after and i not in into)
    if vanished:
        raise DiffError(f"{len(vanished)} event(s) left events.v2.json by no merge - no current event's `was` names "
                        "them, and the ledger deletes no line in season (#43): " + ", ".join(vanished))
    seen = _by_id(attribution) if attribution is not None else None
    seen_into = _survivors(attribution) if attribution is not None else {}

    found = []   # (id, kind, from, to, whether attribution agrees with current on the kind)
    for i, event in after.items():
        if i not in before:
            found.append((i, "added", None, None, seen is not None and i in seen))
            continue
        for kind, old, new in _changes(before[i], event):
            found.append((i, kind, old, new, seen is not None and _agrees(kind, seen.get(i), event)))
    for i in before:
        if i not in after:   # merged: attribution agrees where it merges the id into the same survivor
            found.append((i, "merged", None, into[i], seen is not None and seen_into.get(i) == into[i]))

    lines = sorted((_line(stamp, sha, i, kind, old, new, "code" if agrees else "source")
                    for i, kind, old, new, agrees in found), key=lambda x: (x["run"], x["id"], x["kind"]))
    moved = previous is None or previous.get("digest") != current.get("digest")
    return DiffResult(lines=lines, changed_at=stamp if moved else previous["changed_at"], changes_logged=len(lines),
                      kinds=Counter(x["kind"] for x in lines), causes=Counter(x["cause"] for x in lines))


def render(lines):
    """The lines as changes.jsonl holds them: one JSON object a line, compact, UTF-8 as written, LF after each."""
    return "".join(json.dumps(line, ensure_ascii=False, separators=(",", ":")) + "\n" for line in lines)


def _by_id(doc):
    return {e["id"]: e for e in doc["events"]}


def _survivors(doc):
    """{id: the event whose `was` names it}: every id merged into an event, directly or through another merged id."""
    return {w: e["id"] for e in doc["events"] for w in e.get("was") or []}


def _changes(old, new):
    """The kinds on which an event both documents hold changed: [(kind, from, to)], from and to None where the kind
    has none."""
    out = []
    if bool(old.get("removed")) != bool(new.get("removed")):
        out.append(("removed" if new.get("removed") else "restored", None, None))
    if bool(old.get("cancelled")) != bool(new.get("cancelled")):
        out.append(("cancelled" if new.get("cancelled") else "uncancelled", None, None))
    for kind, value in VALUES.items():
        a, b = value(old), value(new)
        if a != b:
            out.append((kind, a, b) if kind in FROM_TO else (kind, None, None))
    return out


def _agrees(kind, seen, event):
    """Whether attribution's event and current's agree on a kind's fields; an event attribution lacks does not."""
    if seen is None:
        return False
    if kind in FLAGS:
        return bool(seen.get(FLAGS[kind])) == bool(event.get(FLAGS[kind]))
    return VALUES[kind](seen) == VALUES[kind](event)


def _line(run, sha, i, kind, old, new, cause):
    line = {"run": run, "sha": sha, "id": i, "kind": kind}
    if kind in FROM_TO:
        line["from"], line["to"] = old, new
    elif kind == "merged":
        line["to"] = new
    line["cause"] = cause
    return line
