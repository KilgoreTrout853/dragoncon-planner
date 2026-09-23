#!/usr/bin/env python3
"""The ids stage (DECISIONS #43; docs/pipeline/contract.md, The ledger): our id for every raw row, kept in the year's
ledger, data/<year>/ids.jsonl.

    from ids_stage import assign, read_ledger, write_ledger
    ledger = read_ledger("data/2027/ids.jsonl")         # IdsError where it is absent or a line is malformed
    result = assign(rows, ledger, stamp, season["thresholds"])
    write_ledger("data/2027/ids.jsonl", result.ledger)

An event's id is its source id at first sight, forever. A run's live rows - stale ones among them - group by
dupe_key, the normalised title, the start and the normalised location, and each group is one event. assign() gives
every group an id by these rules, in this order:

    a. A removed row never groups by key: it stays with the line its source id maps to.
    b. A group's id is the id its members map to, and every member's source id maps to it. Where they map to two or
       more, the smallest survives: the others' lines get merged_into, and their source ids move to the survivor,
       each move recorded in the losing line's `left`.
    c. A group with no id whose key equals a gone line's key - every source id of that line on a removed row, and
       the line not merged away - takes that line's id: the match, exact on the key, and nothing looser. Where two
       gone lines hold the key, the smaller id takes it.
    d. Otherwise the group is new, and its id is its smallest source id.
    e. A split - two or more groups claiming one id - goes by membership: the larger group keeps the id; on a tie,
       the group whose key is the line's key at last sight; on a tie again, the smaller smallest source id. Each
       other group leaves, under its smallest source id, or <source_id>.<n> where that is already an id, n counting
       up from 1; its source ids move to its new line, recorded in the old line's `left`.
    f. A line's key is its group's at last sight. A line is gone when every source id it holds sits on a removed
       row: gone_since is the stamp of the first such run, and clears when a source id is live again. first_seen
       is the stamp of the run that made the line.

Fatal, as IdsError, and the caller writes nothing: the ledger absent, or a line of it malformed; a removed row whose
source id no line holds; a source id in two lines' source_ids; new ids - the new groups' and the leavers' - above
thresholds["new_ids"] x the lines before the run, skipped when the ledger was empty.

The report's UNSURE pairs - a line gone this run against an id new this run, agreeing on two of the key's three
parts - read the location with a space, a comma and a hyphen alike (`folded`); the match and dupe_key never do.

dupe_key and norm_text live here, as the 2026 dedupe had them; scraper.py imports them back for dedupe(). A frozen
year has no ledger and no ids stage (#46). Standard library; nothing here reads the network or the clock, and there
is no command: PR 8's orchestrator runs it after the fetch, and tools/replay_2026.py over the 2026 history.
"""

import json
import os
import re
from dataclasses import dataclass, field
from decimal import Decimal

# A ledger line's keys, in the order they are written; `left`, `gone_since` and `merged_into` only where set.
LINE_KEYS = ("id", "source_ids", "left", "key", "first_seen", "gone_since", "merged_into")
REQUIRED = ("id", "source_ids", "key", "first_seen")
PARTS = ("title", "start", "location")  # a key's three parts, in dupe_key's order


class IdsError(Exception):
    """A fatal ids stage (#43, #44), its numbers in the message. The caller writes nothing."""


@dataclass
class IdsReport:
    """What a run did, for the run summary (#44; PR 8). Every list is sorted.

    new       the ids new this run by rule d
    matched   {id, source_ids}: a group that took a gone line's id by rule c
    merged    {id, into}: a line merged away in a collision (rule b)
    leavers   {id, left, source_ids}: a group that left the line `left` in a split, under a new id (rule e)
    gone      the lines gone this run, those merged away aside
    returned  the lines gone before this run and live after it, whichever rule brought them back
    unsure    {gone, new, differs}: a line gone this run and an id new this run whose keys agree on two parts at
              least, the location read `folded`; `differs` names the part that does not
    """
    new: list = field(default_factory=list)
    matched: list = field(default_factory=list)
    merged: list = field(default_factory=list)
    leavers: list = field(default_factory=list)
    gone: list = field(default_factory=list)
    returned: list = field(default_factory=list)
    unsure: list = field(default_factory=list)


@dataclass
class IdsResult:
    """What assign() returns (contract.md, The ledger)."""
    rows: list       # the rows as given, each a copy carrying `id`
    groups: dict     # id -> the source ids of this run's rows that resolve to it, removed ones among them; by id
    ledger: dict     # the new ledger: id -> line, sorted by id
    report: IdsReport


# ---------------------------------------------------------------------------
# The key. A raw row has no room, so dupe_key reads its location; a 2026 event has a room, the location less its
# hotel, and the dedupe read that.
# ---------------------------------------------------------------------------

def norm_text(s):
    """Lowercase, collapse whitespace, drop trailing punctuation."""
    return re.sub(r"\s+", " ", str(s or "")).strip().lower().rstrip(".,;:!?-–— ")


def dupe_key(e):
    return (norm_text(e.get("title")), e.get("start"), norm_text(e.get("room") or e.get("location")))


def folded(location):
    """A key's location with a space, a comma and a hyphen read alike, for the report's UNSURE pairs only: the fold
    the venues stage applies at a hotel key's boundary (#45), where the source wrote "Hilton Salon" and later
    "Hilton-Salon" (history-2026.md, section 4, v6 -> v7). The ids stage reads no hotel keys, so it reads the three
    alike wherever they fall. The match (rule c) and dupe_key never fold."""
    return re.sub(r"[\s,-]+", " ", location or "").strip()


# ---------------------------------------------------------------------------
# The rules
# ---------------------------------------------------------------------------

def assign(rows, ledger, stamp, thresholds):
    """Our id for every row of a run (#43; the module's docstring has the rules, a-f) -> IdsResult.

    `rows` are the run's raw rows (#42), removed ones among them, each source id once. `ledger` is read_ledger()'s,
    and is left as it is: the result holds the new one. `stamp` is the run's, written as first_seen and gone_since.
    `thresholds` is season.json's, of which new_ids is read. Raises IdsError where a fatal rule trips.
    """
    lines = {i: _copy(ledger[i]) for i in sorted(ledger)}
    before = len(lines)
    owner = {}
    for i, line in lines.items():
        for sid in line["source_ids"]:
            if sid in owner:
                raise IdsError(f"source id {sid} is in two lines' source_ids, {owner[sid]}'s and {i}'s")
            owner[sid] = i

    live, seen = {}, set()
    for row in rows:
        sid = row["source_id"]
        if sid in seen:
            raise IdsError(f"source id {sid} is on two rows")
        seen.add(sid)
        if not row.get("removed"):
            live[sid] = row
        elif sid not in owner:
            raise IdsError(f"the removed row {sid} is in no line's source_ids: the ledger does not hold the rows it "
                           "was written for")
    report = IdsReport()

    # a. The live rows group by key, each group's source ids sorted; the groups go in order of their smallest.
    groups = {}
    for sid in sorted(live):
        groups.setdefault(dupe_key(live[sid]), []).append(sid)
    keys = sorted(groups, key=lambda k: groups[k][0])

    # b. The id the members map to; where they map to two or more, the smallest survives.
    for k in keys:
        ids = sorted({owner[sid] for sid in groups[k] if sid in owner})
        for other in ids[1:]:
            _move(lines, owner, other, ids[0], list(lines[other]["source_ids"]))
            lines[other]["merged_into"] = ids[0]
            report.merged.append({"id": other, "into": ids[0]})
    # A merge moves every source id of a line, so each group's members now map to one id at most.
    claim = {k: next((owner[sid] for sid in groups[k] if sid in owner), None) for k in keys}

    # c. The match: a group with no id takes a gone line's id where their keys are equal.
    gone_by_key = {}
    for i, line in lines.items():
        if not line.get("merged_into") and not any(sid in live for sid in line["source_ids"]):
            gone_by_key.setdefault(tuple(line["key"]), []).append(i)
    for k in keys:
        if claim[k] is None and k in gone_by_key:
            claim[k] = gone_by_key[k][0]  # the lines are in id order, so the smaller id
            report.matched.append({"id": claim[k], "source_ids": list(groups[k])})

    # d. New: the smallest source id.
    for k in keys:
        if claim[k] is None:
            i = groups[k][0]
            if i in lines:
                raise IdsError(f"the new group of {i} would take an id the ledger already holds")
            lines[i] = {"id": i, "source_ids": [], "key": list(k), "first_seen": stamp}
            claim[k] = i
            report.new.append(i)

    # e. A split: membership, then the key at last sight, then the smaller smallest source id.
    holders = {}
    for k in keys:
        holders.setdefault(claim[k], []).append(k)
    for i in sorted(holders):
        last = tuple(lines[i]["key"])
        ranked = sorted(holders[i], key=lambda k: (-len(groups[k]), k != last, groups[k][0]))
        for k in ranked[1:]:
            new = groups[k][0]
            if new in lines:
                n = 1
                while f"{new}.{n}" in lines:
                    n += 1
                new = f"{new}.{n}"
            lines[new] = {"id": new, "source_ids": [], "key": list(k), "first_seen": stamp}
            _move(lines, owner, i, new, [sid for sid in groups[k] if owner.get(sid) == i])
            claim[k] = new
            report.leavers.append({"id": new, "left": i, "source_ids": list(groups[k])})

    # Every member maps to its group's id, and the id's key is the group's (f).
    for k in keys:
        for sid in groups[k]:
            if sid not in owner:
                owner[sid] = claim[k]
                lines[claim[k]]["source_ids"].append(sid)
        lines[claim[k]]["key"] = list(k)

    # f. Gone and returned: only this rule sets gone_since, so a line that holds one was gone before this run.
    for i, line in lines.items():
        line["source_ids"].sort()
        if any(sid in live for sid in line["source_ids"]):
            if line.pop("gone_since", None) is not None:
                report.returned.append(i)
        elif not line.get("gone_since"):
            line["gone_since"] = stamp
            if not line.get("merged_into"):
                report.gone.append(i)

    # Fatal after assignment: a source id in two lines; too many new ids.
    holder = {}
    for i, line in lines.items():
        for sid in line["source_ids"]:
            if sid in holder:
                raise IdsError(f"source id {sid} is in two lines' source_ids, {holder[sid]}'s and {i}'s")
            holder[sid] = i
    fresh = len(report.new) + len(report.leavers)
    if before and fresh > share(thresholds["new_ids"], before):
        raise IdsError(f"{fresh} new id{'' if fresh == 1 else 's'}, above new_ids {thresholds['new_ids']} of the "
                       f"{before} lines before the run ({share(thresholds['new_ids'], before)})")

    # UNSURE: a line gone this run against an id new this run, two of the three parts agreeing.
    newcomers = sorted(report.new + [x["id"] for x in report.leavers])
    for g in sorted(report.gone):
        for n in newcomers:
            differs = differing(lines[g]["key"], lines[n]["key"])
            if len(differs) <= 1:
                report.unsure.append({"gone": g, "new": n, "differs": differs})

    out = {i: _ordered(lines[i]) for i in sorted(lines)}
    for field in ("new", "gone", "returned"):
        getattr(report, field).sort()
    for field in ("matched", "merged", "leavers"):
        getattr(report, field).sort(key=lambda x: x["id"])
    groups_out = {}
    for i, line in out.items():
        on = [sid for sid in line["source_ids"] if sid in seen]
        if on:
            groups_out[i] = on
    return IdsResult(rows=[{**row, "id": holder[row["source_id"]]} for row in rows], groups=groups_out, ledger=out,
                     report=report)


def differing(a, b):
    """The parts of two keys that differ, the location compared `folded` (UNSURE only)."""
    return [part for part, x, y in zip(PARTS, a, b)
            if (folded(x) != folded(y) if part == "location" else x != y)]


def share(fraction, n):
    """`fraction` of `n`, exact to the fraction as the season file writes it: as scraper.share, which this module
    cannot import - scraper imports it."""
    return Decimal(str(fraction)) * n


def _move(lines, owner, src, dst, sids):
    """Source ids from one line to another, each move recorded in the losing line's `left`."""
    for sid in sids:
        lines[src]["source_ids"].remove(sid)
        lines[dst]["source_ids"].append(sid)
        lines[src].setdefault("left", []).append({"source_id": sid, "to": dst})
        owner[sid] = dst


def _copy(line):
    out = dict(line)
    out["source_ids"] = list(line["source_ids"])
    out["key"] = list(line["key"])
    if "left" in line:
        out["left"] = [dict(x) for x in line["left"]]
    return out


def _ordered(line):
    """A line's keys in LINE_KEYS order; `left`, `gone_since` and `merged_into` only where set."""
    return {k: line[k] for k in LINE_KEYS if k in line and (k in REQUIRED or line[k])}


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def read_ledger(path):
    """The ledger at `path`: {id: line}. IdsError where the file is absent - it exists, empty, from the season's
    first commit (#43) - or cannot be read, or a line is malformed, the line's number in the message."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        raise IdsError(f"the ledger {path} is absent: it exists, empty, from the season's first commit (#43)") from None
    except OSError as exc:
        raise IdsError(f"the ledger {path} cannot be read ({exc.strerror or exc})") from None
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise IdsError(f"the ledger {path} is not UTF-8 ({exc})") from None
    texts = text.split("\n")
    if texts[-1] == "":
        texts.pop()  # the line break after the last line
    ledger = {}
    for n, raw in enumerate(texts, start=1):
        try:
            line = json.loads(raw)
        except ValueError as exc:
            raise IdsError(f"the ledger {path}, line {n}: not JSON ({exc})") from None
        problem = malformed(line)
        if problem:
            raise IdsError(f"the ledger {path}, line {n}: {problem}")
        if line["id"] in ledger:
            raise IdsError(f"the ledger {path}, line {n}: the id {line['id']} is on an earlier line too")
        ledger[line["id"]] = line
    return ledger


def malformed(line):
    """What is wrong with a parsed ledger line, or None."""
    if not isinstance(line, dict):
        return "not a JSON object"
    missing = [k for k in REQUIRED if k not in line]
    if missing:
        return f"no {', '.join(missing)}"
    unknown = [k for k in line if k not in LINE_KEYS]
    if unknown:
        return f"{', '.join(map(repr, unknown))}: not a key the ledger knows"
    key = line["key"]
    checks = [
        (_text(line["id"]), "id is not a non-empty string"),
        (isinstance(line["source_ids"], list) and all(_text(s) for s in line["source_ids"]),
         "source_ids is not a list of source ids"),
        (isinstance(key, list) and len(key) == 3 and isinstance(key[0], str)
         and (key[1] is None or isinstance(key[1], str)) and isinstance(key[2], str),
         "key is not [title, start, location]"),
        (_text(line["first_seen"]), "first_seen is not a stamp"),
        ("left" not in line or (isinstance(line["left"], list) and all(
            isinstance(x, dict) and set(x) == {"source_id", "to"} and _text(x["source_id"]) and _text(x["to"])
            for x in line["left"])), "left is not a list of {source_id, to}"),
        ("gone_since" not in line or _text(line["gone_since"]), "gone_since is not a stamp"),
        ("merged_into" not in line or _text(line["merged_into"]), "merged_into is not an id"),
    ]
    return next((problem for ok, problem in checks if not ok), None)


def _text(value):
    return isinstance(value, str) and bool(value)


def write_ledger(path, ledger):
    """ids.jsonl (#43): a line per id, sorted by id, its keys in LINE_KEYS order - `left`, `gone_since` and
    `merged_into` only where set - compact UTF-8 with LF line ends and a line break after each line, so an empty
    ledger is an empty file. Written beside the file and swapped in, as source.json is, so a run that dies part-way
    leaves the last file whole."""
    text = "".join(json.dumps(_ordered(ledger[i]), ensure_ascii=False, separators=(",", ":")) + "\n"
                   for i in sorted(ledger))
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(text.encode("utf-8"))
    os.replace(tmp, path)
