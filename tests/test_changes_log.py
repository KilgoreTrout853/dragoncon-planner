"""The committed change log's check (DECISIONS #47, as amended; contract.md, What CI holds). For a live year whose
first run has committed: the log's last stamp against last-run.json - its changed_at when the run logged lines, no
later when it logged none - every id the log names in events.v2.json, removed or not, or the id of a merged line, and
the lines sorted by run, id and kind. The prefix check - each commit's log beginning with the last commit's, byte for
byte - is PR 8's workflow step, where the old bytes exist: CI's checkout is shallow.

The check on the committed files is skipped until data/2027/last-run.json exists; the fixture test runs the same
check on every run of the suite.

Run:  python -m pytest tests/
"""
import datetime as dt
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import diff_stage  # noqa: E402

LIVE = os.path.join(ROOT, "data", "2027")


def problems(log_text, last_run, doc):
    """What is wrong with a change log beside its last-run.json and events.v2.json: [] when nothing."""
    out = []
    lines = [json.loads(text) for text in log_text.splitlines() if text.strip()]
    if lines != sorted(lines, key=lambda x: (x["run"], x["id"], x["kind"])):
        out.append("the lines are not sorted by run, id and kind")
    if lines:
        last, changed = dt.datetime.fromisoformat(lines[-1]["run"]), dt.datetime.fromisoformat(last_run["changed_at"])
        if last_run["changes_logged"] > 0 and last != changed:
            out.append(f"the log's last stamp, {lines[-1]['run']}, is not last-run.json's changed_at, "
                       f"{last_run['changed_at']}, though the last run logged {last_run['changes_logged']} line(s)")
        if last_run["changes_logged"] == 0 and last > changed:
            out.append(f"the log's last stamp, {lines[-1]['run']}, is later than last-run.json's changed_at, "
                       f"{last_run['changed_at']}, though the last run logged none")
    elif last_run["changes_logged"] > 0:
        out.append(f"the log is empty, though the last run logged {last_run['changes_logged']} line(s)")
    held = {e["id"] for e in doc["events"]} | {x["id"] for x in lines if x["kind"] == "merged"}
    stray = sorted({x["id"] for x in lines} - held)
    if stray:
        out.append("ids the log names that events.v2.json does not hold and no merged line names: " + ", ".join(stray))
    return out


@pytest.mark.skipif(not os.path.exists(os.path.join(LIVE, "last-run.json")),
                    reason="data/2027/last-run.json does not exist: no live run has committed yet (PR 8)")
def test_the_committed_change_log_agrees_with_last_run_and_events_v2():
    texts = {}
    for name in ("changes.jsonl", "last-run.json", "events.v2.json"):
        with open(os.path.join(LIVE, name), "rb") as f:
            texts[name] = f.read().decode("utf-8")
    assert problems(texts["changes.jsonl"], json.loads(texts["last-run.json"]),
                    json.loads(texts["events.v2.json"])) == []


def test_the_check_finds_what_it_is_there_to_find():
    t1, t2, t3 = "2027-08-01T10:00:00+00:00", "2027-08-02T10:00:00+00:00", "2027-08-03T10:00:00+00:00"

    def line(run, i, kind, **more):
        return {"run": run, "sha": "abc", "id": i, "kind": kind, **more, "cause": "source"}
    log = diff_stage.render([line(t1, "a1", "added"), line(t1, "c3", "added"), line(t1, "m2", "added"),
                             line(t2, "c3", "removed"), line(t2, "m2", "merged", to="a1")])
    doc = {"events": [{"id": "a1"}, {"id": "c3", "removed": True}]}   # m2 merged away: named by its merged line
    assert problems(log, {"changed_at": t2, "changes_logged": 2}, doc) == []
    assert problems(log, {"changed_at": t3, "changes_logged": 0}, doc) == []    # a retag moved changed_at since
    assert problems("", {"changed_at": t1, "changes_logged": 0}, {"events": []}) == []
    assert problems(log, {"changed_at": t3, "changes_logged": 1}, doc) == [
        f"the log's last stamp, {t2}, is not last-run.json's changed_at, {t3}, though the last run logged 1 line(s)"]
    assert problems(log, {"changed_at": t1, "changes_logged": 0}, doc) == [
        f"the log's last stamp, {t2}, is later than last-run.json's changed_at, {t1}, though the last run logged none"]
    assert problems("", {"changed_at": t1, "changes_logged": 3}, {"events": []}) == [
        "the log is empty, though the last run logged 3 line(s)"]
    stray = log + diff_stage.render([line(t2, "zz", "title", **{"from": "A", "to": "B"})])
    assert problems(stray, {"changed_at": t2, "changes_logged": 3}, doc) == [
        "ids the log names that events.v2.json does not hold and no merged line names: zz"]
    unsorted = diff_stage.render([line(t2, "c3", "removed"), line(t1, "a1", "added")])
    assert problems(unsorted, {"changed_at": t1, "changes_logged": 1}, doc) == [
        "the lines are not sorted by run, id and kind"]
