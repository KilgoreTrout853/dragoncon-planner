"""Tests for tools/replay_2026.py: a committed 2026 event made a raw row and back, and the report rendered on the
five-version mini-history of tests/mini_history.py - how each id that differs came by ours, the named checks passing
and failing, a version that trips a fatal rule, and the same bytes under two hash seeds. Nothing here runs git or
reads data/.

Run:  python -m pytest tests/
"""
import importlib.util
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
TOOL = os.path.join(ROOT, "tools", "replay_2026.py")
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("replay_2026", TOOL)
rp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rp)

import mini_history as mini  # noqa: E402

THRESHOLDS = {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}  # 2026's
TEN = ["type", "title", "day", "start", "end", "duration_min", "location", "description", "tracks", "speakers"]
CASES = {"matched": {"c1": "c9"}, "returned": ["w1"], "unsure": {"u1": "u2"}}  # the mini-history's named cases
T2 = mini.STAMPS[1]


def history():
    """The mini-history as schedule_history.gather() hands the tool a history: the ref, its head, the commits and
    the versions."""
    return {"ref": "main", "head": "abcdef0" + "0" * 33,
            "commits": [{"sha": f"{k}" * 40, "author": "schedule-bot", "subject": f"Refresh schedule {k}"}
                        for k in range(1, 6)],
            "versions": mini.versions()}


def report(folder, thresholds=THRESHOLDS):
    h = history()
    return rp.render(h, rp.replay(h["versions"], thresholds, str(folder)), CASES)


def test_a_committed_event_becomes_a_raw_row_and_back_on_the_ten_fields():
    event = {"id": "a1", "type": "gaming", "title": "Board Game Round Up", "day": "2026-09-06",
             "start": "2026-09-06T10:00", "end": "2026-09-06T11:00", "duration_min": 60,
             "location": "Westin Augusta 1-2", "hotel": "Westin", "room": "Augusta 1-2", "description": "Line one.\nTwo.",
             "tracks": ["Board Games", "Table Top Gaming"], "track": "Board Games",
             "speakers": [{"name": "Ann Lee", "role": "Moderator"}], "cancelled": False, "tags": {"kind": "game"}}
    raw = rp.to_raw(event)
    assert list(raw) == ["source_id"] + TEN == list(rp.scraper.ROW_FIELDS)   # no hotel, room, track, cancelled or tags
    assert raw["source_id"] == "a1" and all(raw[k] is event[k] for k in TEN)
    assert {"id": raw["source_id"], **{k: raw[k] for k in TEN}} == {k: event[k] for k in ["id"] + TEN}


def test_the_report_on_the_mini_history(tmp_path):
    text = report(tmp_path)
    assert text.startswith("# Replay - the ids stage over the 2026 schedule on `main`\n\nWritten by "
                           "`tools/replay_2026.py` from `main` at `abcdef0`:")
    assert ("The copy groups are counted on v5's rows, the last version that holds copies, the last version read. "
            "Grouped as the ids stage groups raw rows, by the title, the start and the location, v5 holds 1 group and "
            "1 collapse - the same groups the room-keyed dedupe made of its events.") in text
    assert "1. Versions: 5 of 5 replayed. The last version read holds 12 rows, 3 of them carried removed." in text
    assert "2. The frozen file's ids against ours: 4 of 9 differ (section 1)." in text
    assert "3. Named checks: 4 of 6 pass (section 2)." in text
    assert ("4. Across the versions: 8 new ids, 7 of them in v1; 1 match by rule c; 1 merge; 2 leavers; 3 lines gone "
            "and 2 returned; 1 UNSURE pair (sections 3 and 4).") in text
    assert "5. The final ledger: 10 lines, 2 of them gone (section 5)." in text
    # each id that differs from the last version's, and how it came by ours
    assert ("| `c9` | `Photo Session: James Callis Solo` - 2026-09-04T13:50 - `Marriott International Hall South` | "
            "`c1` | v4: rule c matched it to the line of `c1`, first seen in v1, gone since v2, on an equal key |"
            in text)
    assert "| `t1.1` | v4: it left `t1` in a split, as `t1.1` |" in text
    assert "| `t1` | v1: it joined the group of `t1` |" in text       # t2: the mini's last version still has copies
    assert "| `m1` | v4: `m2` was merged into `m1` |" in text
    assert "ours keeping the earlier ids - **fail**." in text        # more differ than the one matched
    # the named checks, passing and failing
    assert ("1. **Pass.** Matched across the gap by rule c.\n   - `Photo Session: James Callis Solo` - "
            "2026-09-04T13:50 - `Marriott International Hall South`: `c9` took `c1` in v4, first seen in v1, gone "
            "since v2\n") in text
    assert ("2. **Pass.** Kept their ids through their absences, and returned.\n   - `Photo Session: Tom Welling Solo` "
            "- 2026-09-06T14:50 - `Marriott International Hall South`: gone in v2, back in v3, under `w1` "
            "throughout\n") in text
    assert ("3. **Pass.** New at both appearances, with an UNSURE line naming the part that differs.\n   - `Hazbin "
            "Hotel Cast` - 2026-09-06T16:00 - `Hilton Salon` → `Meet the Hellaverse Cast` - 2026-09-06T16:00 - "
            "`Hilton-Salon`: new in v2, as `u1` went; UNSURE, the title differs, the locations (`hilton salon`, "
            "`hilton-salon`) agreeing once space, comma and hyphen are read alike\n") in text
    assert ("4. **Fail.** The copy groups of v5 hold one id each from their first appearance, so v6 changes nothing.\n"
            "   - v5: 1 group, 1 collapse; 1 group did not hold one id, the smallest source id, from the first "
            "appearance: `m1`\n   - no version after v5 was read\n") in text
    assert "5. **Fail.** No merge, no leaver, no fatal rule in any version.\n   - Merges 1, leavers 2; no fatal" in text
    assert "6. **Pass.** Every id of the frozen file is in the final ledger.\n   - 9 of 9 are in a line's" in text
    # a version's counts, its UNSURE pair in full, and the ledger at the end
    assert ("| v4 | `4444444` | scrape | 2026-09-02T03:00:00+00:00 | 12 | 2 | 8 | 0 | 1 | 1 | 1 | 0 | 1 | 0 | 10 |"
            in text)
    assert ("- v2 `2222222`: gone `u1` `Hazbin Hotel Cast` - 2026-09-06T16:00 - `Hilton Salon`; new `u2` `Meet the "
            "Hellaverse Cast` - 2026-09-06T16:00 - `Hilton-Salon`: the title differs, the locations (`hilton salon`, "
            "`hilton-salon`) agreeing once space, comma and hyphen are read alike.") in text
    assert ("10 lines: 8 live, 2 gone, 1 of those merged away. Ids that are not a bare source id: 1. Lines with a "
            "`left` record: 3.") in text
    assert "- `m2`: gone since v4, merged into `m1`\n- `u1` `Hazbin Hotel Cast`" in text
    assert text.endswith("\n") and "\r" not in text and "\n\n\n" not in text
    assert os.listdir(tmp_path) == ["ids.jsonl"]                    # the ledger went to the folder it was given


def test_a_fatal_rule_stops_the_replay_and_the_report_says_where(tmp_path):
    text = report(tmp_path, {**THRESHOLDS, "new_ids": 0.1})       # v2's one new id is above 0.1 of v1's 7 lines
    assert ("1. Versions: 1 of 5 replayed; v2 tripped a fatal rule and the replay stopped there. The last version "
            "read holds 11 rows, 3 of them carried removed.") in text
    assert "| v2 | `2222222` | scrape | " + T2 + " | 11 | 3 | 5 | fatal |" in text
    assert "counted on v2's rows, the last version that holds copies, the last version read, where the replay" in text
    # every named check fails: what they need came after the version that stopped the replay
    assert "3. Named checks: 0 of 6 pass (section 2)." in text
    assert "Hall South`: `c9` is in no line, never matched by rule c\n" in text
    assert "gone in no version, back in no version, under `w1` throughout\n" in text
    assert "`Hilton-Salon`: `u2` is not new in any version\n" in text
    assert "   - no version after v2 was replayed\n" in text
    assert ("5. **Fail.** No merge, no leaver, no fatal rule in any version.\n   - Merges 0, leavers 0; fatal in v2: "
            "`1 new id, above new_ids 0.1 of the 7 lines before the run (0.7)`.") in text
    assert "6. **Fail.** Every id of the frozen file is in the final ledger.\n   - 7 of 9 are in a line's" in text


def test_two_runs_under_different_hash_seeds_write_the_same_bytes(tmp_path):
    """Set order follows the process's hash seed; nothing in the report may."""
    source = tmp_path / "history.json"
    source.write_text(json.dumps({"h": history(), "cases": CASES, "thresholds": THRESHOLDS}), encoding="utf-8")
    code = ("import importlib.util, json, sys, tempfile\n"
            f"spec = importlib.util.spec_from_file_location('rp', {TOOL!r})\n"
            "rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)\n"
            "d = json.loads(open(sys.argv[1], encoding='utf-8').read())\n"
            "with tempfile.TemporaryDirectory() as folder:\n"
            "    steps = rp.replay(d['h']['versions'], d['thresholds'], folder)\n"
            "sys.stdout.buffer.write(rp.render(d['h'], steps, d['cases']).encode('utf-8'))\n")
    written = [subprocess.run([sys.executable, "-c", code, str(source)], cwd=ROOT, check=True, capture_output=True,
                              env={**os.environ, "PYTHONHASHSEED": seed}).stdout for seed in ("1", "2")]
    (tmp_path / "here").mkdir()
    assert written[0] == written[1] and written[0].decode("utf-8") == report(tmp_path / "here")
