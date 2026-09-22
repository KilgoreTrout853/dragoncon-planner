"""Tests for tools/schedule_history.py: classifying commits, diffing versions, matching content by the dedupe's
key, the returns across a history, the cron's slots and the runs, and a render under two hash seeds - all on
inline fixtures. Nothing here reads data/, runs git or calls gh.

Run:  python -m pytest tests/
"""
import datetime as dt
import importlib.util
import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..")
TOOL = os.path.join(ROOT, "tools", "schedule_history.py")
spec = importlib.util.spec_from_file_location("schedule_history", TOOL)
sh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sh)

A, B, C, D, E, F, G, H = (f"{k:032x}" for k in range(1, 9))  # A < B < ... < H as strings, as min() compares ids


def ev(i, title="Panel", start="2026-09-04T10:00", room="Galleria 5", hotel="Hilton", **kw):
    e = {"id": i, "type": "panel", "title": title, "day": start[:10], "start": start, "end": start, "duration_min": 60,
         "location": f"{hotel} {room}", "hotel": hotel, "room": room, "description": "", "tracks": [], "track": "",
         "speakers": [], "cancelled": False}
    e.update(kw)
    return e


def utc(s):
    return dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc)


def test_commits_are_classed_by_author_and_message():
    assert sh.classify("schedule-bot", "Refresh schedule 2026-09-02T16:56Z") == "scrape"
    assert sh.classify("KilgoreTrout853", "Tag the 86 events added since the last pass") == "tag"
    assert sh.classify("KilgoreTrout853", "Dragon Con 2026 planner: schedule data, tagging, and refresh hardening") == "other"
    assert sh.classify("KilgoreTrout853", "Merge dedupe: collapse duplicate events in the scraper") == "other"
    assert sh.classify("KilgoreTrout853", "Refresh schedule by hand") == "other"  # a scrape is the bot's


def test_new_york_is_utc_minus_four_inside_2026_daylight_saving_and_refused_outside_it():
    assert sh.new_york(utc("2026-09-03T04:00:02")) == dt.datetime(2026, 9, 3, 0, 0, 2)
    assert sh.new_york(utc("2026-03-08T07:00:00")) == dt.datetime(2026, 3, 8, 3, 0)
    assert sh.new_york(utc("2026-11-01T05:59:59")) == dt.datetime(2026, 11, 1, 1, 59, 59)
    for outside in ("2026-03-08T06:59:59", "2026-11-01T06:00:00", "2027-09-03T12:00:00", "2025-09-01T12:00:00"):
        with pytest.raises(ValueError, match="daylight-saving window"):
            sh.new_york(utc(outside))


def test_utc_reads_git_gh_and_schedule_times_alike():
    assert sh.utc("2026-09-01T16:56:09-04:00") == sh.utc("2026-09-01T20:56:09Z") == sh.utc("2026-09-01T20:56:09+00:00")


def test_a_diff_counts_each_field_and_keeps_an_order_only_change_apart():
    prev = [ev(A, tracks=["X", "Y"], speakers=[{"name": "P", "role": "Panelist"}, {"name": "Q", "role": "Host"}]),
            ev(B, title="Old", cancelled=False),
            ev(C, start="2026-09-04T10:00", room="Galleria 5", tracks=["X"]),
            ev(D, description="short", tags={"kind": "panel"})]
    new = [ev(A, tracks=["Y", "X"], speakers=[{"name": "Q", "role": "Host"}, {"name": "P", "role": "Panelist"}]),
           ev(B, title="CANCELLED: Old", cancelled=True),
           ev(C, start="2026-09-05T10:00", day="2026-09-05", room="Galleria 6", tracks=["X", "Z"]),
           ev(D, description="longer", tags={"kind": "qa"}, type="gaming")]
    d = sh.diff(prev, new)
    assert (d["before"], d["after"], d["added"], d["removed"], d["common"]) == (4, 4, [], [], 4)
    assert d["order_only"] == {"tracks": 1, "speakers": 1} and d["reorders"] == {"speakers": [A], "tracks": [A]}
    assert dict(d["fields"]) == {"title": 1, "cancelled": 1, "start": 1, "end": 1, "room": 1, "location": 1,
                                 "tracks": 1, "description": 1}  # the fixture's end follows its start
    assert dict(d["other"]) == {"day": 1, "tags": 1, "type": 1}
    assert d["changed"] == [B, C, D]  # A's lists only moved
    assert d["starts"] == [("Panel", "2026-09-04T10:00", "2026-09-05T10:00", C)]
    assert d["rooms"] == [("Panel", "Hilton / Galleria 5", "Hilton / Galleria 6", C)]
    assert d["titles"] == [("Old", "CANCELLED: Old", True, B)]
    assert d["flips"] == [("CANCELLED: Old", False, True, B)]


def test_a_role_change_is_a_change_of_what_speakers_hold_not_of_their_order():
    prev = [ev(A, speakers=[{"name": "P", "role": "Panelist"}, {"name": "Q", "role": "Host"}])]
    new = [ev(A, speakers=[{"name": "Q", "role": "Moderator"}, {"name": "P", "role": "Panelist"}])]
    d = sh.diff(prev, new)
    assert d["fields"]["speakers"] == 1 and not d["order_only"]


def test_removed_ids_are_binned_by_where_their_content_went_through_the_dedupe_key():
    prev = [ev(C, title="Flip Down"), ev(D, title="Flip Up"), ev(E, title="Collapsed"), ev(F, title="Kept"),
            ev(G, title="Gone")]
    new = [ev(A, title="flip down."),  # the dupe_key folds case and trailing punctuation, so this is C's content
           ev(H, title="Flip Up"), ev(F, title="Kept"), ev(B, title="Collapsed", room="galleria  5")]
    d = sh.diff(prev, new)
    assert d["added"] == [A, B, H] and d["removed"] == [C, D, E, G]
    assert d["bins"][C] == ("added", [A]) and sh.sorts_before(A, C)       # a smaller id: a survivor flip, or not
    assert d["bins"][D] == ("added", [H]) and not sh.sorts_before(H, D)   # a larger id: never the dedupe's choice
    assert d["bins"][E] == ("added", [B])
    assert d["bins"][G] == ("gone", [])
    kept = sh.diff([ev(C, title="Twice"), ev(E, title="Twice")], [ev(C, title="Twice")])
    assert kept["bins"][E] == ("kept", [C])  # the dedupe collapsing E into C, which both versions hold


def test_same_title_matches_for_content_that_went_nowhere_are_new_start_new_room_or_both():
    prev = [ev(A, title="Talk", start="2026-09-04T10:00", room="Galleria 5"), ev(B, title="Other")]
    new = [ev(C, title="Talk", start="2026-09-04T11:00", room="Galleria 5"),
           ev(D, title="TALK", start="2026-09-04T10:00", room="Galleria 6"),
           ev(E, title="Talk", start="2026-09-05T10:00", room="Galleria 7"),
           ev(F, title="Another talk", start="2026-09-04T10:00", room="Galleria 5")]
    d = sh.diff(prev, new)
    assert d["bins"][A] == ("gone", []) and d["bins"][B] == ("gone", [])
    assert d["loose"] == [("both", A, E), ("new room", A, D), ("new start", A, C)]


def test_a_rename_says_whether_a_dedupe_group_gained_or_lost_a_member():
    prev = [ev(A, title="Photo Session: Photo session: X"), ev(B, title="Photo Session: Photo session: X"),
            ev(C, title="Photo Session: Photo session: Y", start="2026-09-05T10:00"),
            ev(D, title="Photo Session: Z", start="2026-09-06T10:00"),
            ev(E, title="Photo Session: Photo session: Z", start="2026-09-06T10:00")]
    new = [ev(A, title="Photo Session: X"),                                        # its copy B kept the old title
           ev(B, title="Photo Session: Photo session: X"),
           ev(C, title="Photo Session: Y", start="2026-09-05T10:00"),              # alone, as before
           ev(D, title="Photo Session: Z", start="2026-09-06T10:00"),
           ev(E, title="Photo Session: Z", start="2026-09-06T10:00")]             # joins D's key
    renames = {r["id"]: r for r in sh.diff(prev, new)["renames"]}
    assert renames[A] == {"id": A, "left": [B], "joined": [], "near": []}
    assert renames[C] == {"id": C, "left": [], "joined": [], "near": []}
    assert renames[E] == {"id": E, "left": [], "joined": [D], "near": []}
    moved = sh.diff([ev(A, title="Old name")], [ev(A, title="New name"), ev(B, title="Newcomer")])["renames"]
    assert moved == [{"id": A, "left": [], "joined": [], "near": [B]}]  # an id added at the renamed event's slot


def test_a_title_change_that_keeps_the_dupe_key_is_no_rename():
    d = sh.diff([ev(A, title="Photo session: Smallville")], [ev(A, title="Photo Session: Smallville")])
    assert d["titles"] == [("Photo session: Smallville", "Photo Session: Smallville", False, A)] and d["renames"] == []


def test_ids_that_leave_and_return_and_content_that_returns_under_another_id():
    assert sh.returns_by_id([[A, B], [B], [B], [A, B], [C]]) == {A: [1, 2]}
    versions = [[ev(A, title="Callis"), ev(B, title="Stays"), ev(C, title="Back")],
                [ev(B, title="Stays")],
                [ev(E, title="Callis"), ev(B, title="Stays"), ev(C, title="Back")]]
    out = sh.returns_by_key(versions)
    assert [(key[0], a, b, before, after) for key, a, b, before, after in out] == [("callis", 0, 2, [A], [E])]
    assert sh.returns_by_id([[e["id"] for e in v] for v in versions]) == {C: [1]}


def test_the_last_version_with_shared_keys_and_the_groups_whose_copies_tie():
    v0 = [ev(A, title="Tied"), ev(B, title="Tied"), ev(C, title="Loose."), ev(D, title="loose"), ev(E, title="Alone")]
    v1 = [ev(A, title="Tied"), ev(C, title="Loose.")]
    at, groups = sh.last_groups([v0, v1])
    assert at == 0 and sorted(groups.values()) == [[A, B], [C, D]]
    tied = sh.tied(v0, groups)
    assert [groups[k] for k in tied] == [[A, B]]  # C and D share a dupe_key, but not their exact titles
    assert sh.last_groups([v1]) == (None, {})


def test_a_daily_cron_is_read_and_anything_else_refused():
    assert sh.cron_hours("17 */3 * * *") == (17, [0, 3, 6, 9, 12, 15, 18, 21])
    assert sh.cron_hours("0 5,17 * * *") == (0, [5, 17])
    assert sh.cron_hours("30 * * * *") == (30, list(range(24)))
    for bad in ("17 3 * * 1", "*/5 * * * *", "17 3-6 * * *", "17 */3 * *"):
        with pytest.raises(ValueError):
            sh.cron_hours(bad)
    got = sh.slots("17 */3 * * *", utc("2026-09-01T20:56:09"), utc("2026-09-02T03:17:00"))
    assert got == [utc("2026-09-01T21:17:00"), utc("2026-09-02T00:17:00")]  # strictly inside the span


def test_the_cron_s_life_in_the_workflow_and_where_its_concurrency_group_arrived():
    cron = 'on:\n  schedule:\n    - cron: "17 */3 * * *"  # every 3 hours\n'
    workflow = [{"sha": "a" * 40, "committed": "2026-09-01T20:56:09Z", "text": cron},
                {"sha": "b" * 40, "committed": "2026-09-02T20:50:40Z", "text": cron},
                {"sha": "c" * 40, "committed": "2026-09-03T02:42:06Z", "text": cron + "concurrency:\n  group: x\n"},
                {"sha": "d" * 40, "committed": "2026-09-07T17:25:27Z", "text": "on:\n  workflow_dispatch:\nconcurrency:\n"}]
    stretches, conc = sh.cron_life(workflow)
    assert stretches == [("17 */3 * * *", "a" * 40, "2026-09-01T20:56:09Z", "d" * 40, "2026-09-07T17:25:27Z")]
    assert conc["sha"] == "c" * 40


def run(no, event, conclusion, created, updated, head="0" * 40):
    return {"number": no, "databaseId": no, "event": event, "conclusion": conclusion, "createdAt": created,
            "startedAt": created, "updatedAt": updated, "headSha": head, "attempt": 1,
            "jobs": [{"name": "scrape", "startedAt": created, "completedAt": updated,
                      "failed": ["Commit"] if conclusion == "failure" else []}]}


def test_a_scheduled_run_counts_for_the_last_slot_before_it_and_manual_runs_for_none():
    ts = [utc("2026-09-02T00:17:00"), utc("2026-09-02T03:17:00"), utc("2026-09-02T06:17:00")]
    runs = [run(1, "schedule", "success", "2026-09-02T04:30:41Z", "2026-09-02T04:54:45Z"),
            run(2, "schedule", "success", "2026-09-02T03:10:00Z", "2026-09-02T03:30:00Z"),
            run(3, "workflow_dispatch", "success", "2026-09-02T06:30:00Z", "2026-09-02T06:50:00Z")]
    assert dict(sh.attribute(runs, ts)) == {ts[0]: [2], ts[1]: [1]}  # 06:17 produced no run


def test_a_scrape_commit_joins_the_run_that_made_it_the_successful_one_where_two_overlap():
    commits = [{"sha": "1" * 40, "author": "schedule-bot", "subject": "Refresh schedule 2026-09-02T21:16Z",
                "authored": "2026-09-02T21:16:20Z"},
               {"sha": "2" * 40, "author": "schedule-bot", "subject": "Refresh schedule 2026-09-03T09:00Z",
                "authored": "2026-09-03T09:00:00Z"},
               {"sha": "3" * 40, "author": "KilgoreTrout853", "subject": "Tag the 5 events",
                "authored": "2026-09-02T21:10:00Z"}]
    runs = [run(6, "workflow_dispatch", "success", "2026-09-02T20:51:11Z", "2026-09-02T21:16:32Z"),
            run(7, "schedule", "failure", "2026-09-02T21:01:25Z", "2026-09-02T21:26:36Z"),
            run(8, "schedule", "success", "2026-09-02T23:18:11Z", "2026-09-02T23:40:44Z")]
    assert sh.join_runs(runs, commits) == {"1" * 40: 6, "2" * 40: None}  # the tag commit is no run's
    assert sh.join_runs(runs[::-1], commits) == {"1" * 40: 6, "2" * 40: None}  # not whichever run is listed first
    assert sh.overlaps(runs) == [(6, 7)]


def test_the_scraper_s_warning_is_kept_without_the_log_s_prefix():
    log = ("scrape\tScrape\t2026-09-03T21:24:59.2853261Z Wrote 3457 events to events.json (2626 KB) in 1445s\r\n"
           "scrape\tScrape\t2026-09-03T21:24:59.2856603Z WARNING: 1 detail pages failed, e.g. 404 Client Error: "
           f"Not Found for url: https://example.invalid/event/{A}\r\n")
    assert sh.failure_lines(log) == [f"WARNING: 1 detail pages failed, e.g. 404 Client Error: Not Found for url: "
                                     f"https://example.invalid/event/{A}"]
    assert sh.failure_lines("nothing failed\n") == []


def history(runs=True):
    """A five-commit history: the import, a scrape, a tag pass, a scrape with a failure, and a move."""
    shas = [c * 40 for c in "12345"]
    commits = [
        {"sha": shas[0], "parents": [], "author": "KilgoreTrout853", "authored": "2026-09-01T20:56:09Z",
         "committed": "2026-09-01T20:56:09Z", "subject": "The planner, with its schedule", "status": "A",
         "path": "events.json"},
        {"sha": shas[1], "parents": [shas[0]], "author": "schedule-bot", "authored": "2026-09-01T21:33:33Z",
         "committed": "2026-09-01T21:33:35Z", "subject": "Refresh schedule 2026-09-01T21:33Z", "status": "M",
         "path": "events.json"},
        {"sha": shas[2], "parents": [shas[1]], "author": "KilgoreTrout853", "authored": "2026-09-02T04:18:50Z",
         "committed": "2026-09-02T04:18:50Z", "subject": "Tag the 2 events added since the last pass", "status": "M",
         "path": "events.json"},
        {"sha": shas[3], "parents": [shas[2]], "author": "schedule-bot", "authored": "2026-09-03T21:24:59Z",
         "committed": "2026-09-03T21:24:59Z", "subject": "Refresh schedule 2026-09-03T21:24Z", "status": "M",
         "path": "events.json"},
        {"sha": shas[4], "parents": [shas[3], "9" * 40], "author": "KilgoreTrout853",
         "authored": "2026-09-07T17:25:27Z", "committed": "2026-09-07T17:25:27Z", "subject": "Merge archive",
         "status": "R100", "path": "data/2026/events.json"}]
    e1 = [ev(A, title="Talk", tracks=["X", "Y"]), ev(B, title="Photo Session: Photo session: Z",
                                                     start="2026-09-05T12:00"),
          ev(C, title="Callis", start="2026-09-04T13:50")]
    e2 = [ev(A, title="Talk", tracks=["Y", "X"]), ev(B, title="Photo Session: Z", start="2026-09-05T12:00"),
          ev(D, title="New", start="2026-09-02T18:00")]
    e3 = [dict(e, tags={"kind": "panel"}) for e in e2]
    e4 = [dict(e3[0], tracks=["X", "Y"]), e3[2], ev(E, title="Callis", start="2026-09-04T13:50", cancelled=True)]
    versions = [{"generated_at": t, "changed_at": t, "source": "x", "count": len(evs), "failures": f, "events": evs}
                for t, f, evs in (("2026-09-01T18:29:46+00:00", 3, e1), ("2026-09-01T21:33:33+00:00", 0, e2),
                                  ("2026-09-01T21:33:33+00:00", 0, e3), ("2026-09-03T21:24:59+00:00", 1, e4),
                                  ("2026-09-03T21:24:59+00:00", 1, e4))]
    cron = '    - cron: "17 */3 * * *"\n'
    h = {"ref": "main", "head": shas[4], "line": [shas[0], shas[1], shas[2], "8" * 40, shas[3], shas[4]],
         "commits": commits, "versions": versions,
         "scraper": [{"sha": "8" * 40, "committed": "2026-09-03T03:06:35Z", "subject": "Merge cancelled-flag"}],
         "workflow": [{"sha": shas[0], "committed": "2026-09-01T20:56:09Z", "text": cron},
                      {"sha": "8" * 40, "committed": "2026-09-03T03:06:35Z", "text": cron + "concurrency:\n"},
                      {"sha": shas[4], "committed": "2026-09-07T17:25:27Z", "text": "concurrency:\n"}],
         "frozen": "f" * 40, "last_blob": "f" * 40, "runs": None}
    if runs:
        h["runs"] = {"runs": [run(1, "workflow_dispatch", "success", "2026-09-01T21:11:45Z", "2026-09-01T21:33:37Z"),
                              run(2, "schedule", "failure", "2026-09-02T04:30:41Z", "2026-09-02T04:54:45Z"),
                              run(3, "schedule", "success", "2026-09-03T21:00:40Z", "2026-09-03T21:25:04Z",
                                  head="8" * 40)],
                     "logs": {"3": [f"WARNING: 1 detail pages failed, e.g. 404 Client Error: Not Found for url: "
                                    f"https://example.invalid/event/{B}"]}}
    return h


def test_the_report_holds_the_facts_of_a_small_history():
    text = sh.render(history())
    assert "1. Commits: 5 touched the schedule: 2 scrape, 1 tag, 2 other; 4 consecutive pairs." in text
    assert "`count` equals the number of events in 5 of 5 versions; `changed_at` equals `generated_at` in 5." in text
    assert (f"Run #3's log: `WARNING: 1 detail pages failed, e.g. 404 Client Error: Not Found for url: "
            f"https://example.invalid/event/{B}`. It names `{B}`, an id this version lacks and the one before held."
            in text)
    assert "- v1 `1111111`: `failures` 3. No scrape.yml run made this version" in text  # named nowhere
    assert "- `scraper.py` changed in between: `8888888` Merge cancelled-flag." in text  # run #3 checked it out
    assert (f"`Callis` - 2026-09-04T13:50 - Hilton / Galleria 5: held by `{C}` to v1, absent v2-v3, back in v4 under "
            f"`{E}`; `{E}` sorts after `{C}`.") in text
    assert "- `5555555` moved the file to `data/2026/events.json` (R100: the same bytes)." in text
    assert "The last version's blob, `fffffff`, is the frozen" in text
    assert "| #2 | 2026-09-02 04:30:41 | schedule | `0000000` | Commit | - |" in text
    assert "Successful runs that committed nothing - no-op runs: 0." in text
    assert ("`17 */3 * * *` was in scrape.yml from `1111111` (2026-09-01 20:56:09 UTC) to `5555555` "
            "(2026-09-07 17:25:27 UTC), by commit time: 47 slots.") in text
    assert "- v4 `4444444`: `CANCELLED` " not in text and "`Callis`: false → true" not in text  # E is new, not flipped
    assert text.endswith("\n") and "\r" not in text and "\n\n\n" not in text


def test_a_parser_change_not_yet_checked_out_by_the_run_says_so():
    h = history()
    h["runs"]["runs"][2]["headSha"] = h["line"][2]  # the run checked out main before the scraper commit landed
    assert "`8888888` Merge cancelled-flag (not yet on `main` when run #3 checked it out)." in sh.render(h)


def test_the_report_says_when_it_read_no_runs():
    assert "Not read: the report was written with `--no-runs`." in sh.render(history(runs=False))
    h = history()
    h["runs"] = {"error": "`gh` is not installed"}
    assert "Unavailable: `gh` is not installed." in sh.render(h)


def test_two_runs_under_different_hash_seeds_write_the_same_bytes(tmp_path):
    """Set order follows the process's hash seed; nothing in the report may."""
    source = tmp_path / "history.json"
    source.write_text(json.dumps(history()), encoding="utf-8")
    code = ("import importlib.util, json, sys\n"
            f"spec = importlib.util.spec_from_file_location('sh', {TOOL!r})\n"
            "sh = importlib.util.module_from_spec(spec); spec.loader.exec_module(sh)\n"
            "h = json.loads(open(sys.argv[1], encoding='utf-8').read())\n"
            "sys.stdout.buffer.write(sh.render(h).encode('utf-8'))\n")
    written = [subprocess.run([sys.executable, "-c", code, str(source)], cwd=ROOT, check=True, capture_output=True,
                              env={**os.environ, "PYTHONHASHSEED": seed}).stdout for seed in ("1", "2")]
    assert written[0] == written[1] and written[0].decode("utf-8") == sh.render(history())
