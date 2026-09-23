#!/usr/bin/env python3
"""The ids stage replayed over the 2026 schedule on `main`: docs/pipeline/replay-2026.md.

    python tools/replay_2026.py                     # write docs/pipeline/replay-2026.md
    python tools/replay_2026.py --ref REF --out PATH

DECISIONS #43's verification. Every version of the 2026 schedule on the ref, read from git as
tools/schedule_history.py reads it (its gather()), is converted to raw rows - each event's id its source_id, the ten
fields as they are - and carried against the version before as the fetch carries them (scraper.carry); then
ids_stage.assign() gives the rows ids, with the version's generated_at as the stamp and 2026's thresholds, the ledger
threaded from version to version through ids.jsonl in a temp folder, never under data/. The report sets the result
against the history: the frozen file's ids against ours, the named cases of #43, and each version's counts.

A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. The standard
library and git, and scraper, ids_stage, season and schedule_history for their functions; it writes nothing but the
report. Deterministic - two runs write the same bytes, and the only times in it are the versions' own.
"""

import argparse
import os
import sys
import tempfile
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

import ids_stage  # noqa: E402
import schedule_history  # noqa: E402  (its git reading, and its markdown helpers)
import scraper  # noqa: E402  (carry and ROW_FIELDS)
from season import load as load_season  # noqa: E402

OUT = "docs/pipeline/replay-2026.md"
SEASON = "data/2026/season.json"

# The named cases of DECISIONS #43's verification, from docs/pipeline/history-2026.md.
CASES = {
    # section 5, "Content that returns under another id": gone after v1, back in v9 under new source ids
    "matched": {"1e3995157984a4c0e6515a2ed63a1127": "e7a143f7f9a04b9580c1b55cffd71723",
                "1e3995157984a4c0e6515a2ed636a1d6": "f1a3341fc863c0a3f635d819c7ac9d19"},
    # section 5, "Ids that leave and later return"
    "returned": ["1e3995157984a4c0e6515a2ed632d105", "4f5d40b3cfde6b85b4ccbfe2be9a09bf",
                 "c32d19e7750818e0eb903f152ac55882"],
    # section 4, v6 -> v7: the two Hilton listings in the Salon, and the two that arrived at their starts
    "unsure": {"6ecc75745a676d39f230055623a24fa5": "a3b6e0b83be4882de2e8a2170733de54",
               "6ecc75745a676d39f230055623a25d94": "e69d501c2d69b4f93b5313149141b03e"},
}

n, code, table, short, many = (schedule_history.n, schedule_history.code, schedule_history.table,
                               schedule_history.short, schedule_history.many)


# ---------------------------------------------------------------------------
# The replay
# ---------------------------------------------------------------------------

def to_raw(event):
    """A committed 2026 event as a raw row (#42): its id the source_id, and the ten fields as they are."""
    return {"source_id": event["id"], **{k: event[k] for k in scraper.ROW_FIELDS[1:]}}


def replay(versions, thresholds, folder):
    """The ids stage over the versions, oldest first -> one step a version replayed: {rows, result}, or {rows,
    fatal} for the version whose IdsError stopped the replay. The ledger is written to `folder`/ids.jsonl, empty at
    first as a season's first commit holds it, and read back for every version, as a run reads it."""
    path = os.path.join(folder, "ids.jsonl")
    ids_stage.write_ledger(path, {})
    previous, steps = {}, []
    for doc in versions:
        rows = scraper.carry({e["id"]: to_raw(e) for e in doc["events"]}, previous)
        try:
            result = ids_stage.assign(rows, ids_stage.read_ledger(path), doc["generated_at"], thresholds)
        except ids_stage.IdsError as exc:
            steps.append({"rows": rows, "fatal": str(exc)})
            break
        ids_stage.write_ledger(path, result.ledger)
        steps.append({"rows": rows, "result": result})
        previous = {r["source_id"]: r for r in rows}
    return steps


# ---------------------------------------------------------------------------
# The facts
# ---------------------------------------------------------------------------

def copies(rows, keyf):
    """The groups of two or more among the live rows, by `keyf`: {key: sorted source ids}."""
    groups = defaultdict(list)
    for r in rows:
        if not r.get("removed"):
            groups[keyf(r)].append(r["source_id"])
    return {k: sorted(v) for k, v in groups.items() if len(v) > 1}


def analyse(h, steps):
    """What the sections render, from the history and the replay."""
    versions = h["versions"]
    f = {"steps": steps, "done": [s for s in steps if "result" in s]}
    f["fatal"] = next(((k, s["fatal"]) for k, s in enumerate(steps, start=1) if "fatal" in s), None)
    f["reports"] = [s["result"].report for s in f["done"]]
    f["final"] = f["done"][-1]["result"].ledger if f["done"] else {}
    f["events"] = {}                     # source id -> its event at last sight
    for doc in versions:
        for e in doc["events"]:
            f["events"][e["id"]] = e
    f["first_version"] = {}              # stamp -> the first version stamped with it
    for v, doc in enumerate(versions, start=1):
        f["first_version"].setdefault(doc["generated_at"], v)
    f["timeline"] = defaultdict(list)    # source id -> [(version, id)] where it has a row
    for v, s in enumerate(f["done"], start=1):
        for i, sids in s["result"].groups.items():
            for sid in sids:
                f["timeline"][sid].append((v, i))
    f["went_gone"], f["came_back"] = defaultdict(list), defaultdict(list)
    for v, rep in enumerate(f["reports"], start=1):
        for i in rep.gone:
            f["went_gone"][i].append(v)
        for i in rep.returned:
            f["came_back"][i].append(v)
    f["final_of"] = {sid: i for i, line in f["final"].items() for sid in line["source_ids"]}
    f["copies"] = [copies(s["rows"], ids_stage.dupe_key) for s in steps]
    f["rows_at"] = [{r["source_id"]: r for r in s["rows"]} for s in steps]
    f["frozen"] = versions[-1]["events"]
    f["differ"] = [e for e in f["frozen"] if f["final_of"].get(e["id"], e["id"]) != e["id"]]
    return f


def describe(e):
    return f"{code(e['title'])} - {e['start']} - {code(e['location'])}"


def label(f, sid):
    """A source id's event at last sight."""
    return describe(f["events"][sid]) if sid in f["events"] else code(sid)


def label_at(f, v, i):
    """A line's event as version v holds it, by its first source id with a row there; "" for a line with none."""
    line = f["done"][v - 1]["result"].ledger[i]
    sid = next((s for s in line["source_ids"] if s in f["rows_at"][v - 1]), None)
    return " " + describe(f["rows_at"][v - 1][sid]) if sid else ""


def life(f, i, v):
    """A line's life before version v: when it was made, and when it last went gone."""
    made = f["first_version"].get(f["final"].get(i, {}).get("first_seen"))
    gone = [g for g in f["went_gone"].get(i, []) if g < v]
    return (f"first seen in v{made}" if made else "first seen before") + (
        f", gone since v{gone[-1]}" if gone else ", its own source ids removed in the same version")


def why(f, sid):
    """How a source id came by the id the final ledger gives it: the rule at its first sight, and at each change."""
    out, prev = [], None
    for v, i in f["timeline"].get(sid, []):
        if i == prev:
            continue
        rep = f["reports"][v - 1]
        if prev is None:
            if any(x["id"] == i and sid in x["source_ids"] for x in rep.matched):
                out.append(f"v{v}: rule c matched it to the line of {code(i)}, {life(f, i, v)}, on an equal key")
            elif i != sid:
                out.append(f"v{v}: it joined the group of {code(i)}")
        elif any(x["id"] == prev and x["into"] == i for x in rep.merged):
            out.append(f"v{v}: {code(prev)} was merged into {code(i)}")
        elif any(x["id"] == i and x["left"] == prev for x in rep.leavers):
            out.append(f"v{v}: it left {code(prev)} in a split, as {code(i)}")
        else:
            out.append(f"v{v}: it moved from {code(prev)} to {code(i)}, by no rule the report names")
        prev = i
    return "; ".join(out) or "unexplained"


def ids_of(f, sid):
    return sorted({i for _, i in f["timeline"].get(sid, [])})


def checks(f, cases):
    """The named checks of #43's verification: [(title, ok, detail lines)]."""
    out = []

    lines, ok = [], True
    for old, new in sorted(cases["matched"].items()):
        v = next((k for k, rep in enumerate(f["reports"], start=1)
                  if any(x["id"] == old and new in x["source_ids"] for x in rep.matched)), None)
        good = v is not None and any(g < v for g in f["went_gone"].get(old, [])) and f["final_of"].get(new) == old
        ok &= good
        held = f"resolves to {code(f['final_of'][new])}" if new in f["final_of"] else "is in no line"
        lines.append(f"{label(f, new)}: " + (f"{code(new)} took {code(old)} in v{v}, {life(f, old, v)}" if good else
                                              f"{code(new)} {held}, "
                                              f"{'matched in v' + str(v) if v else 'never matched by rule c'}"))
    out.append(("Matched across the gap by rule c", ok, lines))

    lines, ok = [], True
    for i in sorted(cases["returned"]):
        gone, back = f["went_gone"].get(i, []), f["came_back"].get(i, [])
        good = (bool(gone) and any(b > gone[0] for b in back) and ids_of(f, i) == [i]
                and i in f["final"] and "gone_since" not in f["final"][i])
        ok &= good
        lines.append(f"{label(f, i)}: gone in {', '.join(f'v{g}' for g in gone) or 'no version'}, back in "
                     f"{', '.join(f'v{b}' for b in back) or 'no version'}, under "
                     f"{', '.join(code(x) for x in ids_of(f, i))} throughout")
    out.append(("Kept their ids through their absences, and returned", ok, lines))

    lines, ok = [], True
    for old, new in sorted(cases["unsure"].items()):
        v = next((k for k, rep in enumerate(f["reports"], start=1) if new in rep.new), None)
        pairs = f["reports"][v - 1].unsure if v else []
        pair = next((x for x in pairs if x["gone"] == old and x["new"] == new), None)
        good = (v is not None and old in f["reports"][v - 1].gone and pair is not None and ids_of(f, new) == [new]
                and f["final"].get(old, {}).get("source_ids") == [old])
        ok &= good
        said = f"UNSURE, {differs(f, v, pair)}" if pair else "no UNSURE line"
        lines.append(f"{label(f, old)} → {label(f, new)}: " + (f"new in v{v}, as {code(old)} went; {said}" if v else
                                                                  f"{code(new)} is not new in any version"))
    out.append(("New at both appearances, with an UNSURE line naming the part that differs", ok, lines))

    last = max((k for k, groups in enumerate(f["copies"], start=1) if groups), default=None)
    if last is None:
        out.append(("The copy groups hold one id each from their first appearance", True, ["No version holds copies."]))
    else:
        groups = f["copies"][last - 1]
        bad = [sids for sids in groups.values() if any(ids_of(f, sid) != [sids[0]] for sid in sids)]
        after = f["reports"][last] if last < len(f["reports"]) else None
        quiet = after is not None and not any((after.new, after.matched, after.merged, after.leavers, after.gone,
                                               after.returned))
        lines = [f"v{last}: {many(len(groups), 'group')}, "
                 f"{many(sum(len(g) - 1 for g in groups.values()), 'collapse')}; "
                 + (f"{many(len(bad), 'group')} did not hold one id, the smallest source id, from the first "
                    f"appearance: " + ", ".join(code(g[0]) for g in bad[:10]) if bad else
                    "every group held one id, its smallest source id, from its first appearance")]
        if quiet:
            lines.append(f"v{last + 1}, which holds no copies, moves no id and reports nothing")
        elif after:
            lines.append(f"v{last + 1} reports a change")
        else:
            lines.append(f"no version after v{last} was " + ("replayed" if f["fatal"] else "read"))
        out.append((f"The copy groups of v{last} hold one id each from their first appearance, so v{last + 1} "
                    "changes nothing", not bad and quiet, lines))

    merges = sum(len(r.merged) for r in f["reports"])
    leavers = sum(len(r.leavers) for r in f["reports"])
    lines = [f"Merges {n(merges)}, leavers {n(leavers)}; "
             + (f"fatal in v{f['fatal'][0]}: {code(f['fatal'][1])}" if f["fatal"] else "no fatal rule tripped") + "."]
    out.append(("No merge, no leaver, no fatal rule in any version", not merges and not leavers and not f["fatal"],
                lines))

    held = [e["id"] for e in f["frozen"] if e["id"] in f["final_of"]]
    out.append(("Every id of the frozen file is in the final ledger", len(held) == len(f["frozen"]),
                [f"{n(len(held))} of {n(len(f['frozen']))} are in a line's `source_ids`."]))
    return out


def differs(f, v, pair):
    """What an UNSURE pair of version v differs in, by the keys that version's ledger holds."""
    parts = pair["differs"]
    ledger = f["done"][v - 1]["result"].ledger
    gone, new = ledger[pair["gone"]]["key"], ledger[pair["new"]]["key"]
    said = (f"the {' and the '.join(parts)} differ{'s' if len(parts) == 1 else ''}" if parts else
            "nothing differs")
    if gone[2] != new[2] and "location" not in parts:
        said += (f", the locations ({code(gone[2])}, {code(new[2])}) agreeing once space, comma and hyphen are read "
                 "alike")
    return said


# ---------------------------------------------------------------------------
# The report
# ---------------------------------------------------------------------------

def render(h, steps, cases):
    f = analyse(h, steps)
    versions, commits = h["versions"], h["commits"]
    named = checks(f, cases)
    last = max((k for k, groups in enumerate(f["copies"], start=1) if groups), default=None)
    frozen_v = len(versions)
    body = ["# Replay - the ids stage over the 2026 schedule on `main`", "",
            f"Written by `tools/replay_2026.py` from `{h['ref']}` at `{h['head'][:7]}`: the ids stage "
            f"(`ids_stage.assign`, DECISIONS #43, `docs/pipeline/contract.md`, The ledger) run over every version of "
            f"the 2026 schedule that `tools/schedule_history.py` reads, oldest first. Do not edit it by hand; run the "
            f"script again.", "",
            "A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. "
            "Each version's events become raw rows - `id` the `source_id`, the ten fields as they are - and are "
            "carried against the version before as the fetch carries them (`scraper.carry`): an event a version no "
            "longer holds is carried with `removed: true`, all season. The version's `generated_at` is the run's "
            "stamp, the thresholds are `data/2026/season.json`'s, and the ledger is threaded from version to version "
            "through `ids.jsonl` in a temp folder, never under `data/`. Ids are compared as strings, as the ledger "
            "sorts them.", ""]
    if last is None:
        body += ["No version holds copies: two live rows with one key.", ""]
    else:
        groups = f["copies"][last - 1]
        # the dedupe read an event's room, where it has one: dupe_key on the committed events themselves
        room = copies([dict(e, source_id=e["id"]) for e in versions[last - 1]["events"]], ids_stage.dupe_key)
        same = sorted(map(tuple, groups.values())) == sorted(map(tuple, room.values()))
        read = len(steps)
        if last < read:
            tail = (f": the frozen file, v{frozen_v}, holds none, nor does any version from v{last + 1} on"
                    if read == frozen_v else f": none from v{last + 1} to v{read}, where the replay stopped, holds one")
        else:
            tail = ", the last version read" + ("" if read == frozen_v else ", where the replay stopped")
        collapses = sum(len(g) - 1 for g in groups.values())
        body += [f"The copy groups are counted on v{last}'s rows, the last version that holds copies{tail}. Grouped "
                 f"as the ids stage groups raw rows, by the title, the start and the location, v{last} holds "
                 f"{many(len(groups), 'group')} and {many(collapses, 'collapse')} - "
                 + ("the same groups the room-keyed dedupe made of its events." if same else
                    "not the groups the room-keyed dedupe made of its events."), ""]
    body += ["## 0. Headline", ""]
    rows_last = steps[-1]["rows"]
    head = [f"Versions: {n(len(f['done']))} of {n(len(versions))} replayed"
            + (f"; v{f['fatal'][0]} tripped a fatal rule and the replay stopped there." if f["fatal"] else ".")
            + f" The last version read holds {many(len(rows_last), 'row')}, "
              f"{n(sum(1 for r in rows_last if r.get('removed')))} of them carried removed.",
            f"The frozen file's ids against ours: {n(len(f['differ']))} of {n(len(f['frozen']))} differ (section 1).",
            f"Named checks: {sum(1 for _, ok, _ in named if ok)} of {len(named)} pass (section 2).",
            f"Across the versions: {many(sum(len(r.new) for r in f['reports']), 'new id')}, "
            f"{n(len(f['reports'][0].new) if f['reports'] else 0)} of them in v1; "
            f"{many(sum(len(r.matched) for r in f['reports']), 'match', 'matches')} by rule c; "
            f"{many(sum(len(r.merged) for r in f['reports']), 'merge')}; "
            f"{many(sum(len(r.leavers) for r in f['reports']), 'leaver')}; "
            f"{many(sum(len(r.gone) for r in f['reports']), 'line')} gone and "
            f"{n(sum(len(r.returned) for r in f['reports']))} returned; "
            f"{many(sum(len(r.unsure) for r in f['reports']), 'UNSURE pair')} (sections 3 and 4).",
            f"The final ledger: {n(len(f['final']))} lines, "
            f"{n(sum(1 for line in f['final'].values() if 'gone_since' in line))} of them gone (section 5)."]
    body += [f"{k}. {line}" for k, line in enumerate(head, start=1)] + [""]

    body += ["## 1. The frozen file's ids against ours", "",
             f"Every event of the frozen file, v{frozen_v}, whose id the final ledger gives differently: its id there, "
             "which is its source id, then ours, and how it came by ours.", ""]
    if f["differ"]:
        body += table(["frozen id", "event", "ours", "how"],
                      [[code(e["id"]), label(f, e["id"]), code(f["final_of"][e["id"]]), why(f, e["id"])]
                       for e in f["differ"]], "llll")
    else:
        body += ["None.", ""]
    expected = {new: old for old, new in cases["matched"].items()}
    got = {e["id"]: f["final_of"][e["id"]] for e in f["differ"]}
    body += [f"Expected: exactly the sessions matched across their gap (section 2, check 1), ours keeping the earlier "
             f"ids - **{'pass' if got == expected else 'fail'}**.", ""]

    body += ["## 2. Named checks", "",
             "DECISIONS #43's verification, each case named from `docs/pipeline/history-2026.md` (sections 4 and 5).",
             ""]
    for k, (title, ok, details) in enumerate(named, start=1):
        body.append(f"{k}. **{'Pass' if ok else 'Fail'}.** {title}.")
        body += [f"   - {line}" for line in details]
    body.append("")

    body += ["## 3. Version by version", "",
             "`rows` is the version's raw rows, the removed ones carried among them; `groups` its live groups; the "
             "rest is the ids stage's report for the run, and `lines` the ledger after it.", ""]
    rows = []
    for v, s in enumerate(steps, start=1):
        c = commits[v - 1]
        cls = schedule_history.classify(c.get("author", ""), c.get("subject", ""))
        live = {ids_stage.dupe_key(r) for r in s["rows"] if not r.get("removed")}
        base = [f"v{v}", short(c["sha"]), cls, versions[v - 1]["generated_at"], n(len(s["rows"])),
                n(sum(1 for r in s["rows"] if r.get("removed"))), n(len(live))]
        if "fatal" in s:
            rows.append(base + ["fatal"] + [""] * 7)
            continue
        rep, ledger = s["result"].report, s["result"].ledger
        rows.append(base + [n(len(x)) for x in (rep.new, rep.matched, rep.merged, rep.leavers, rep.gone, rep.returned,
                                                rep.unsure)] + [n(len(ledger))])
    body += table(["v", "commit", "class", "stamp", "rows", "removed", "groups", "new", "matched", "merged", "leavers",
                   "gone", "returned", "UNSURE", "lines"], rows, "llll" + "r" * 11)
    if f["fatal"]:
        body += [f"v{f['fatal'][0]} is fatal: {code(f['fatal'][1])}. No version after it was replayed.", ""]

    body += ["## 4. UNSURE pairs", "",
             "A line gone in a run against an id new in it, their keys agreeing on two of the three parts at least, "
             "the location read with a space, a comma and a hyphen alike (`contract.md`, The ledger). The match "
             "never reads it so.", ""]
    pairs = [(v, x) for v, rep in enumerate(f["reports"], start=1) for x in rep.unsure]
    for v, x in pairs:
        body.append(f"- v{v} {short(commits[v - 1]['sha'])}: gone {code(x['gone'])}{label_at(f, v, x['gone'])}; new "
                    f"{code(x['new'])}{label_at(f, v, x['new'])}: {differs(f, v, x)}.")
    body += (["None."] if not pairs else []) + [""]

    body += ["## 5. The final ledger", ""]
    final = f["final"]
    gone = [i for i in final if "gone_since" in final[i]]
    merged = [i for i in final if "merged_into" in final[i]]
    body += [f"{n(len(final))} lines: {n(len(final) - len(gone))} live, {n(len(gone))} gone, "
             f"{n(len(merged))} of those merged away. Ids that are not a bare source id: "
             f"{n(sum(1 for i in final if '.' in i))}. Lines with a `left` record: "
             f"{n(sum(1 for line in final.values() if 'left' in line))}.", ""]
    if gone:
        body += ["The lines gone at the end, each with the version it went in:", ""]
        body += [f"- {code(i)}{label_at(f, len(f['done']), i)}: gone since "
                 f"v{f['first_version'][final[i]['gone_since']]}" + (f", merged into {code(final[i]['merged_into'])}"
                                                                     if "merged_into" in final[i] else "")
                 for i in gone]
        body.append("")
    text = "\n".join(body)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.rstrip("\n") + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", default="main", help="the branch whose history is read (default: main)")
    ap.add_argument("--out", default=os.path.join(ROOT, OUT))
    args = ap.parse_args(argv)
    h = schedule_history.gather(args.ref, with_runs=False)
    thresholds = load_season(os.path.join(ROOT, SEASON))["thresholds"]
    with tempfile.TemporaryDirectory() as folder:
        steps = replay(h["versions"], thresholds, folder)
    text = render(h, steps, CASES)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"{os.path.relpath(args.out, ROOT).replace(os.sep, '/')}: {len(steps)} of {len(h['versions'])} versions "
          f"replayed, {text.count(chr(10))} lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
