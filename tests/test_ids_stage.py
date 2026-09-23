"""Tests for the ids stage, ids_stage.py (DECISIONS #43; contract.md, The ledger), and for scraper.carry(), the
carrying fetch() does, which hands the stage its rows: a fixture for each rule, a-f, and each fatal one; the report
and its UNSURE pairs; the ledger's file; and the five-version mini-history of tests/mini_history.py, run end to end.
Nothing here reads data/ or the network. Non-ASCII text is built with chr(), so a line of the test holds what it says.

Run:  python -m pytest tests/
"""
import copy
import os
import random
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

import ids_stage  # noqa: E402
import mini_history as mini  # noqa: E402
import scraper  # noqa: E402

T1, T2, T3, T4, T5 = mini.STAMPS
THRESHOLDS = {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}  # 2026's
RAW = list(scraper.ROW_FIELDS)
DASH = chr(0x2013)  # "–"


def row(sid, title="Panel", start="2026-09-05T10:00", location="Hilton 202", **flags):
    """A raw row (#42), with whichever flag is true."""
    out = {"source_id": sid, "type": "panel", "title": title, "day": start[:10], "start": start, "end": start,
           "duration_min": 60, "location": location, "description": "", "tracks": [], "speakers": []}
    return {**out, **{flag: True for flag, on in flags.items() if on}}


def key(title="Panel", start="2026-09-05T10:00", location="Hilton 202"):
    """The ledger's `key` for a row made by row()."""
    return list(ids_stage.dupe_key(row("x", title, start, location)))


KEY = key()


def assign(rows, ledger=None, stamp=T1, **thresholds):
    """assign() on a rule's fixture. The fixtures are small, so their new_ids is 1, every line before the run; the
    threshold's own test and the mini-history use 2026's."""
    return ids_stage.assign(rows, ledger or {}, stamp, {**THRESHOLDS, "new_ids": 1, **thresholds})


def ids(result):
    """source_id -> id, as the result's rows carry them."""
    return {r["source_id"]: r["id"] for r in result.rows}


def raw(event):
    """A frozen-file event as a raw row: its id the source id, and the ten fields."""
    return {"source_id": event["id"], **{k: event[k] for k in RAW[1:]}}


def run_mini(folder=None):
    """The mini-history through carry() and assign(), at 2026's thresholds -> [(rows, result)], one a version. With
    `folder`, the ledger is threaded through ids.jsonl there, written empty first, as a season's first commit is."""
    path = os.path.join(folder, "ids.jsonl") if folder else None
    if path:
        ids_stage.write_ledger(path, {})
    ledger, previous, out = {}, {}, []
    for version in mini.versions():
        rows = scraper.carry({e["id"]: raw(e) for e in version["events"]}, previous)
        if path:
            ledger = ids_stage.read_ledger(path)
        result = ids_stage.assign(rows, ledger, version["generated_at"], THRESHOLDS)
        if path:
            ids_stage.write_ledger(path, result.ledger)
        ledger, previous = result.ledger, {r["source_id"]: r for r in rows}
        out.append((rows, result))
    return out


# ---------------------------------------------------------------------------
# The key, moved here, and carry()
# ---------------------------------------------------------------------------

def test_dupe_key_and_norm_text_live_here():
    # a raw row has no room, so the key reads its location; a 2026 event's room is read where it has one
    assert ids_stage.dupe_key(row("a1", title=" Quick &  Easy Board Games. ", location="Hyatt  A707 ")) == (
        "quick & easy board games", "2026-09-05T10:00", "hyatt a707")
    assert ids_stage.dupe_key({"title": "X", "start": "s", "room": "A707", "location": "Hyatt A707"})[2] == "a707"
    # the key folds no hyphen: the match stays exact
    assert key(location="Hilton-Salon") != key(location="Hilton Salon")


def test_carry_keeps_fresh_rows_and_carries_the_previous_file_s_with_one_flag():
    previous = {"b2": row("b2", title="Old b2"), "d4": row("d4", title="Old d4", removed=True),
                "e5": row("e5", title="Old e5"), "f6": row("f6", title="Old f6", stale=True),
                "g7": row("g7", title="Old g7", stale=True)}
    listed = {"a1": row("a1"), "b2": None, "c3": None, "d4": row("d4", title="Back"), "g7": None}
    before = copy.deepcopy((listed, previous))
    rows = scraper.carry(listed, previous)
    assert [r["source_id"] for r in rows] == ["a1", "b2", "d4", "e5", "f6", "g7"]  # sorted; c3 failed, no row
    got = {r["source_id"]: r for r in rows}
    assert got["a1"] == listed["a1"] and got["d4"] == listed["d4"]         # fresh as they are; d4 listed again
    assert got["b2"] == {**previous["b2"], "stale": True} and list(got["b2"]) == RAW + ["stale"]
    assert got["g7"] == {**{k: previous["g7"][k] for k in RAW}, "stale": True}   # stale, failing again
    assert got["e5"] == {**previous["e5"], "removed": True}               # gone: removed, fields frozen
    assert list(got["f6"]) == RAW + ["removed"]                           # stale, then gone: removed alone
    assert (listed, previous) == before                                   # neither is changed


def test_carry_with_no_previous_file_keeps_the_fresh_rows_alone():
    assert scraper.carry({"b2": row("b2"), "a1": row("a1"), "c3": None}, {}) == [row("a1"), row("b2")]


# ---------------------------------------------------------------------------
# The rules, a-f
# ---------------------------------------------------------------------------

def test_a_removed_row_never_groups_by_key_and_a_stale_row_is_live():
    first = assign([row("a1", title="Alpha"), row("b2", title="Beta"), row("c3", title="Gamma"),
                    row("c4", title="Gamma")])
    # a1 is gone, carried removed; b2 takes a1's old title, and so its key; c3's page fails, and it is carried stale
    second = assign([row("a1", title="Alpha", removed=True), row("b2", title="Alpha"),
                     row("c3", title="Gamma", stale=True), row("c4", title="Gamma")], first.ledger, T2)
    assert ids(second) == {"a1": "a1", "b2": "b2", "c3": "c3", "c4": "c3"}   # a1 and b2 do not collide
    assert second.report.merged == [] and second.report.gone == ["a1"]
    assert second.ledger["b2"]["key"] == key("Alpha")
    assert "gone_since" not in second.ledger["c3"]                           # the stale row keeps its line live
    assert second.groups == {"a1": ["a1"], "b2": ["b2"], "c3": ["c3", "c4"]}


def test_a_group_keeps_the_id_its_members_map_to_and_a_new_copy_joins_it():
    first = assign([row("a1")])
    second = assign([row("0f"), row("a1")], first.ledger, T2)    # a new copy that sorts first: the id stays a1
    assert ids(second) == {"0f": "a1", "a1": "a1"} and second.report == ids_stage.IdsReport()
    assert second.ledger == {"a1": {"id": "a1", "source_ids": ["0f", "a1"], "key": KEY, "first_seen": T1}}


def test_two_ids_in_one_group_collide_the_smaller_surviving_and_the_other_merged_into_it():
    first = assign([row("a1", title="Alpha"), row("b2", title="Beta"), row("b3", title="Beta")])
    # b2 takes Alpha's title and its copy b3 goes: one group now maps to a1 and b2
    rows = [row("a1", title="Alpha"), row("b2", title="Alpha"), row("b3", title="Beta", removed=True)]
    second = assign(rows, first.ledger, T2)
    assert ids(second) == {"a1": "a1", "b2": "a1", "b3": "a1"}
    assert second.ledger["a1"] == {"id": "a1", "source_ids": ["a1", "b2", "b3"], "key": key("Alpha"), "first_seen": T1}
    assert second.ledger["b2"] == {
        "id": "b2", "source_ids": [], "left": [{"source_id": "b2", "to": "a1"}, {"source_id": "b3", "to": "a1"}],
        "key": key("Beta"), "first_seen": T1, "gone_since": T2, "merged_into": "a1"}
    assert second.groups == {"a1": ["a1", "b2", "b3"]}
    assert second.report == ids_stage.IdsReport(merged=[{"id": "b2", "into": "a1"}])
    # the line merged away is the merge's, never half of an UNSURE pair: n1 agrees with its key on two parts
    third = assign(rows + [row("n1", title="Beta Two")], first.ledger, T2)
    assert third.report.new == ["n1"] and third.report.unsure == []


def test_a_group_with_a_gone_line_s_key_takes_its_id_across_a_gap_or_in_the_same_run():
    first = assign([row("a1"), row("z1", title="Other")])
    second = assign([row("a1", removed=True), row("z1", title="Other")], first.ledger, T2)
    assert second.report.gone == ["a1"] and second.ledger["a1"]["gone_since"] == T2
    third = assign([row("a1", removed=True), row("b9"), row("z1", title="Other")], second.ledger, T3)
    assert ids(third)["b9"] == "a1"
    assert third.report == ids_stage.IdsReport(matched=[{"id": "a1", "source_ids": ["b9"]}], returned=["a1"])
    assert third.ledger["a1"] == {"id": "a1", "source_ids": ["a1", "b9"], "key": KEY, "first_seen": T1}
    # a source id that vanishes and one that appears in the same run are matched too, and the line was never gone
    same = assign([row("a1", removed=True), row("b9"), row("z1", title="Other")], first.ledger, T2)
    assert ids(same)["b9"] == "a1" and same.report == ids_stage.IdsReport(matched=[{"id": "a1", "source_ids": ["b9"]}])


def test_the_match_is_exact_and_passes_over_a_line_still_live_or_merged_away():
    # the room written with a hyphen is another key: no match but a new id (and an UNSURE pair, below)
    first = assign([row("a1", location="Hilton Salon")])
    hyphen = assign([row("a1", location="Hilton Salon", removed=True), row("b9", location="Hilton-Salon")],
                    first.ledger, T2)
    assert ids(hyphen)["b9"] == "b9" and hyphen.report.matched == []
    # a line with a copy still live is not gone, though its other copy is removed and it moved off its key
    pair = assign([row("a1"), row("a2")])
    moved = assign([row("a1", title="Renamed"), row("a2", removed=True), row("b9")], pair.ledger, T2)
    assert ids(moved) == {"a1": "a1", "a2": "a1", "b9": "b9"} and moved.report.new == ["b9"]
    # a line merged away holds no source id, and is never matched
    merged = {"m1": {"id": "m1", "source_ids": ["m1", "m2"], "key": key("Trek"), "first_seen": T1},
              "m2": {"id": "m2", "source_ids": [], "left": [{"source_id": "m2", "to": "m1"}],
                     "key": key("Trek Spaced"), "first_seen": T1, "gone_since": T1, "merged_into": "m1"}}
    after = assign([row("m1", title="Trek"), row("m2", title="Trek"), row("b9", title="Trek Spaced")], merged, T2)
    assert ids(after)["b9"] == "b9" and after.report.matched == []


def test_where_two_gone_lines_hold_the_key_the_smaller_id_takes_it():
    ledger = {i: {"id": i, "source_ids": [i], "key": KEY, "first_seen": T1, "gone_since": T2} for i in ("a3", "a1")}
    result = assign([row("a1", removed=True), row("a3", removed=True), row("b9")], ledger, T3)
    assert ids(result)["b9"] == "a1" and result.report.matched == [{"id": "a1", "source_ids": ["b9"]}]
    assert result.ledger["a3"]["gone_since"] == T2


def test_a_new_group_s_id_is_its_smallest_source_id_in_string_order():
    result = assign([row("c3"), row("a9"), row("a10")])
    assert ids(result) == {"c3": "a10", "a9": "a10", "a10": "a10"}     # "a10" sorts before "a9", as min() compares
    assert result.ledger == {"a10": {"id": "a10", "source_ids": ["a10", "a9", "c3"], "key": KEY, "first_seen": T1}}
    assert result.report == ids_stage.IdsReport(new=["a10"])


def test_a_split_goes_by_membership_and_the_leaver_keeps_its_own_source_id():
    first = assign([row("s1"), row("s2"), row("s3")])
    second = assign([row("s1"), row("s2"), row("s3", title="Renamed")], first.ledger, T2)
    assert ids(second) == {"s1": "s1", "s2": "s1", "s3": "s3"}
    assert second.ledger["s1"] == {"id": "s1", "source_ids": ["s1", "s2"],
                                   "left": [{"source_id": "s3", "to": "s3"}], "key": KEY, "first_seen": T1}
    assert second.ledger["s3"] == {"id": "s3", "source_ids": ["s3"], "key": key("Renamed"), "first_seen": T2}
    assert second.report == ids_stage.IdsReport(leavers=[{"id": "s3", "left": "s1", "source_ids": ["s3"]}])


def test_the_larger_group_keeps_the_id_even_where_it_is_the_side_that_moved():
    # DECISIONS #43 had the group keep its id in every case; membership decides first (contract.md, The ledger)
    first = assign([row("a1"), row("a2"), row("a3")])
    second = assign([row("a1"), row("a2", title="Renamed"), row("a3", title="Renamed")], first.ledger, T2)
    assert ids(second) == {"a1": "a1.1", "a2": "a1", "a3": "a1"}
    assert second.ledger["a1"]["key"] == key("Renamed") and second.ledger["a1.1"]["key"] == KEY
    assert second.report.leavers == [{"id": "a1.1", "left": "a1", "source_ids": ["a1"]}]


def test_a_tie_goes_to_the_group_at_the_line_s_key_and_the_leaver_whose_id_that_was_takes_dot_one():
    first = assign([row("t1"), row("t2")])
    later = "2026-09-05T11:30"
    second = assign([row("t1", start=later), row("t2")], first.ledger, T2)
    assert ids(second) == {"t1": "t1.1", "t2": "t1"}
    assert second.ledger["t1"] == {"id": "t1", "source_ids": ["t2"], "left": [{"source_id": "t1", "to": "t1.1"}],
                                   "key": KEY, "first_seen": T1}
    assert second.ledger["t1.1"] == {"id": "t1.1", "source_ids": ["t1"], "key": key(start=later), "first_seen": T2}


def test_a_tie_on_size_and_key_goes_to_the_smaller_smallest_source_id():
    first = assign([row("x1"), row("x2")])
    second = assign([row("x1", title="One"), row("x2", title="Two")], first.ledger, T2)
    assert ids(second) == {"x1": "x1", "x2": "x2"}
    assert second.report.leavers == [{"id": "x2", "left": "x1", "source_ids": ["x2"]}]


def test_n_counts_up_where_the_leaver_s_id_is_taken_and_a_merged_away_id_is_taken():
    later = "2026-09-05T11:30"
    # t1 left once as t1.1, which later collided back into t1; t1 leaving again takes t1.2
    ledger = {"t1": {"id": "t1", "source_ids": ["t1", "t2"], "left": [{"source_id": "t1", "to": "t1.1"}],
                     "key": KEY, "first_seen": T1},
              "t1.1": {"id": "t1.1", "source_ids": [], "left": [{"source_id": "t1", "to": "t1"}],
                       "key": key(start=later), "first_seen": T2, "gone_since": T3, "merged_into": "t1"}}
    assert ids(assign([row("t1", start=later), row("t2")], ledger, T4)) == {"t1": "t1.2", "t2": "t1"}
    # m2 was merged into m1; m2 leaving m1 again cannot take m2, the id of the line merged away
    ledger = {"m1": {"id": "m1", "source_ids": ["m1", "m2"], "key": KEY, "first_seen": T1},
              "m2": {"id": "m2", "source_ids": [], "left": [{"source_id": "m2", "to": "m1"}],
                     "key": key("Spaced"), "first_seen": T1, "gone_since": T2, "merged_into": "m1"}}
    assert ids(assign([row("m1"), row("m2", title="Spaced")], ledger, T3)) == {"m1": "m1", "m2": "m2.1"}


def test_a_line_is_gone_when_every_source_id_is_removed_and_returns_when_one_is_live():
    runs = [[row("w1"), row("w2")],
            [row("w1", removed=True), row("w2")],                         # one copy left: not gone
            [row("w1", removed=True), row("w2", removed=True)],           # gone
            [row("w1", removed=True), row("w2", removed=True)],           # still gone: the stamp stays
            [row("w1", removed=True), row("w2", title="Back Again")]]     # back, under a new key
    ledger, seen = {}, []
    for stamp, rows in zip(mini.STAMPS, runs):
        result = assign(rows, ledger, stamp)
        ledger = result.ledger
        seen.append((result.report.gone, result.report.returned, ledger["w1"].get("gone_since")))
    assert seen == [([], [], None), ([], [], None), (["w1"], [], T3), ([], [], T3), ([], ["w1"], None)]
    assert ledger["w1"] == {"id": "w1", "source_ids": ["w1", "w2"], "key": key("Back Again"), "first_seen": T1}


# ---------------------------------------------------------------------------
# UNSURE
# ---------------------------------------------------------------------------

def test_unsure_pairs_a_line_gone_with_an_id_new_that_agree_on_two_parts_the_location_folded():
    at = "2026-09-06T16:00"
    was = [("u1", "Hazbin Hotel Cast", at, "Hilton Salon"), ("v1", "Other Panel", "2026-09-05T10:00", "Hyatt A"),
           ("r1", "Solo", "2026-09-05T12:00", "Marriott A703"), ("q1", "Quiet", "2026-09-05T18:00", "Westin 1")]
    now = [("u2", "Meet the Hellaverse Cast", at, "Hilton-Salon"),         # the title differs: the Salon pair
           ("v2", "Other Panel", "2026-09-05T11:00", "Hyatt A"),            # the start differs
           ("r2", "Solo", "2026-09-05T12:00", "Marriott, A703"),            # the location's separators alone
           ("q2", "Loud", "2026-09-05T18:00", "Hyatt B")]                   # the start alone agrees: not UNSURE
    first = assign([row(i, t, s, loc) for i, t, s, loc in was])
    second = assign([row(i, t, s, loc, removed=True) for i, t, s, loc in was]
                    + [row(i, t, s, loc) for i, t, s, loc in now], first.ledger, T2)
    assert second.report.unsure == [{"gone": "r1", "new": "r2", "differs": []},
                                    {"gone": "u1", "new": "u2", "differs": ["title"]},
                                    {"gone": "v1", "new": "v2", "differs": ["start"]}]
    assert second.report.new == ["q2", "r2", "u2", "v2"] and second.report.matched == []  # the match never folds
    assert ids_stage.folded("hilton-salon") == ids_stage.folded("hilton salon") == ids_stage.folded("hilton, salon")
    assert ids_stage.differing(key("A", location="Hilton Salon"), key("B", location="Hilton-Salon")) == ["title"]


# ---------------------------------------------------------------------------
# Fatal
# ---------------------------------------------------------------------------

def test_the_ledger_absent_is_fatal(tmp_path):
    with pytest.raises(ids_stage.IdsError, match=r"is absent: it exists, empty, from the season's first commit"):
        ids_stage.read_ledger(str(tmp_path / "ids.jsonl"))


GOOD = '{"id":"a1","source_ids":["a1"],"key":["panel","2026-09-05T10:00","hilton 202"],"first_seen":"t1"}'


@pytest.mark.parametrize("text, number, says", [
    ("{not json\n", 1, "not JSON"),
    (GOOD + "\n[]\n", 2, "not a JSON object"),
    (GOOD + '\n{"id":"b2","source_ids":[],"first_seen":"t1"}\n', 2, "no key"),
    (GOOD[:-1] + ',"last_seen":"t2"}\n', 1, "'last_seen': not a key the ledger knows"),
    (GOOD.replace('["a1"]', '"a1"') + "\n", 1, "source_ids is not a list of source ids"),
    (GOOD.replace('"hilton 202"]', '"hilton 202","x"]') + "\n", 1, "key is not [title, start, location]"),
    (GOOD[:-1] + ',"left":[{"source_id":"a2"}]}\n', 1, "left is not a list of {source_id, to}"),
    (GOOD[:-1] + ',"merged_into":""}\n', 1, "merged_into is not an id"),
    (GOOD + "\n\n" + GOOD.replace("a1", "b2") + "\n", 2, "not JSON"),
    (GOOD + "\n" + GOOD + "\n", 2, "the id a1 is on an earlier line too"),
], ids=["not-json", "not-an-object", "a-key-missing", "an-unknown-key", "source-ids", "key", "left", "merged-into",
        "an-empty-line", "an-id-twice"])
def test_a_malformed_ledger_line_is_fatal_with_its_number(tmp_path, text, number, says):
    path = tmp_path / "ids.jsonl"
    path.write_bytes(text.encode("utf-8"))
    with pytest.raises(ids_stage.IdsError) as caught:
        ids_stage.read_ledger(str(path))
    assert f"ids.jsonl, line {number}: " in str(caught.value) and says in str(caught.value)


def test_a_removed_row_that_no_line_holds_is_fatal():
    with pytest.raises(ids_stage.IdsError, match=r"^the removed row a1 is in no line's source_ids"):
        assign([row("b2"), row("a1", removed=True)])


def test_a_source_id_in_two_lines_is_fatal():
    ledger = {"a1": {"id": "a1", "source_ids": ["a1", "x9"], "key": KEY, "first_seen": T1},
              "b2": {"id": "b2", "source_ids": ["b2", "x9"], "key": key("Beta"), "first_seen": T1}}
    with pytest.raises(ids_stage.IdsError, match=r"^source id x9 is in two lines' source_ids, a1's and b2's$"):
        assign([row("a1"), row("b2", title="Beta")], ledger, T2)


def test_a_source_id_on_two_rows_is_fatal():
    with pytest.raises(ids_stage.IdsError, match=r"^source id a1 is on two rows$"):
        assign([row("a1"), row("a1")])


def test_new_ids_above_new_ids_times_the_lines_before_are_fatal_but_not_on_an_empty_ledger():
    # five lines: c1 with its copy c2, and a0-a3; the first run is held to nothing
    five = [row("c1"), row("c2")] + [row(f"a{n}", title=f"Event {n}") for n in range(4)]
    first = assign(five, new_ids=0.2)
    assert len(first.report.new) == 5
    split = [row("c1"), row("c2", title="Split")] + five[2:]
    assert len(assign(split, first.ledger, T2, new_ids=0.2).report.leavers) == 1   # 1 of 5 at 0.2: not above
    with pytest.raises(ids_stage.IdsError,
                       match=r"^2 new ids, above new_ids 0\.2 of the 5 lines before the run \(1\.0\)$"):
        assign(split + [row("b1", title="New")], first.ledger, T2, new_ids=0.2)    # a leaver is a new id too
    # exact to the fraction: 29 of 100 at 0.29 is not above it, where the float product is 28.999999999999996
    hundred = [row(f"{n:02x}", title=f"Event {n}") for n in range(100)]
    ledger = assign(hundred).ledger
    more = hundred + [row(f"z{n:02d}", title=f"New {n}") for n in range(29)]
    assert len(assign(more, ledger, T2, new_ids=0.29).report.new) == 29


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def test_the_ledger_file_is_a_line_per_id_sorted_compact_utf8_lf_its_keys_in_order(tmp_path):
    ledger = {"b2": {"merged_into": "a1", "gone_since": T2, "first_seen": T1, "key": ["beta", None, "hilton " + DASH],
                     "left": [{"source_id": "b2", "to": "a1"}], "source_ids": [], "id": "b2"},
              "a1": {"id": "a1", "source_ids": ["a1", "b2"], "left": [], "key": ["alpha", "2026-09-05T10:00", "x"],
                     "first_seen": T1}}
    path = tmp_path / "ids.jsonl"
    ids_stage.write_ledger(str(path), ledger)
    expected = ('{"id":"a1","source_ids":["a1","b2"],"key":["alpha","2026-09-05T10:00","x"],"first_seen":"<t1>"}\n'
                '{"id":"b2","source_ids":[],"left":[{"source_id":"b2","to":"a1"}],"key":["beta",null,"hilton <dash>"],'
                '"first_seen":"<t1>","gone_since":"<t2>","merged_into":"a1"}\n')
    expected = expected.replace("<t1>", T1).replace("<t2>", T2).replace("<dash>", DASH)
    assert path.read_bytes() == expected.encode("utf-8")        # `left` empty and absent alike: not written
    assert os.listdir(tmp_path) == ["ids.jsonl"]                 # the file written beside it was swapped in
    back = ids_stage.read_ledger(str(path))
    assert back == {"a1": {k: v for k, v in ledger["a1"].items() if k != "left"}, "b2": ledger["b2"]}
    ids_stage.write_ledger(str(path), back)
    assert path.read_bytes() == expected.encode("utf-8")
    ids_stage.write_ledger(str(path), {})
    assert path.read_bytes() == b"" and ids_stage.read_ledger(str(path)) == {}   # an empty ledger: an empty file


# ---------------------------------------------------------------------------
# The mini-history, end to end
# ---------------------------------------------------------------------------

def mini_key(what):
    return list(ids_stage.dupe_key(dict(zip(("title", "start", "location"), what))))


def test_the_mini_history_run_end_to_end(tmp_path):
    runs = run_mini(str(tmp_path))
    assert [result.report for _, result in runs] == [
        ids_stage.IdsReport(new=["c1", "m1", "m2", "s1", "t1", "u1", "w1"]),
        ids_stage.IdsReport(new=["u2"], gone=["c1", "u1", "w1"],
                            unsure=[{"gone": "u1", "new": "u2", "differs": ["title"]}]),     # an UNSURE pair
        ids_stage.IdsReport(leavers=[{"id": "s3", "left": "s1", "source_ids": ["s3"]}],      # the leaver keeps its sid
                            returned=["w1"]),                                                # a return
        ids_stage.IdsReport(matched=[{"id": "c1", "source_ids": ["c9"]}],                    # a match across the gap
                            merged=[{"id": "m2", "into": "m1"}],                             # a collision
                            leavers=[{"id": "t1.1", "left": "t1", "source_ids": ["t1"]}],    # the leaver takes .1
                            returned=["c1"]),
        ids_stage.IdsReport(),                                                               # s2 goes: no id moves
    ]
    both = {"m1": "m1", "s1": "s1", "s2": "s1", "t2": "t1", "u1": "u1", "w1": "w1", "c1": "c1"}
    assert [ids(result) for _, result in runs] == [
        {**both, "m2": "m2", "s3": "s1", "t1": "t1"},
        {**both, "m2": "m2", "s3": "s1", "t1": "t1", "u2": "u2"},
        {**both, "m2": "m2", "s3": "s3", "t1": "t1", "u2": "u2"},
        {**both, "m2": "m1", "s3": "s3", "t1": "t1.1", "u2": "u2", "c9": "c1"},
        {**both, "m2": "m1", "s3": "s3", "t1": "t1.1", "u2": "u2", "c9": "c1"},
    ]
    final = runs[-1][1].ledger
    assert final == {
        "c1": {"id": "c1", "source_ids": ["c1", "c9"], "key": mini_key(mini.CALLIS), "first_seen": T1},
        "m1": {"id": "m1", "source_ids": ["m1", "m2"], "key": mini_key(mini.TREK), "first_seen": T1},
        "m2": {"id": "m2", "source_ids": [], "left": [{"source_id": "m2", "to": "m1"}],
               "key": mini_key(mini.TREK_SPACED), "first_seen": T1, "gone_since": T4, "merged_into": "m1"},
        "s1": {"id": "s1", "source_ids": ["s1", "s2"], "left": [{"source_id": "s3", "to": "s3"}],
               "key": mini_key(mini.SCIENCE), "first_seen": T1},
        "s3": {"id": "s3", "source_ids": ["s3"], "key": mini_key(mini.SCIENCE_RENAMED), "first_seen": T3},
        "t1": {"id": "t1", "source_ids": ["t2"], "left": [{"source_id": "t1", "to": "t1.1"}],
               "key": mini_key(mini.ROUND_UP), "first_seen": T1},
        "t1.1": {"id": "t1.1", "source_ids": ["t1"], "key": mini_key(mini.ROUND_UP_MOVED), "first_seen": T4},
        "u1": {"id": "u1", "source_ids": ["u1"], "key": mini_key(mini.SALON), "first_seen": T1, "gone_since": T2},
        "u2": {"id": "u2", "source_ids": ["u2"], "key": mini_key(mini.SALON_NEW), "first_seen": T2},
        "w1": {"id": "w1", "source_ids": ["w1"], "key": mini_key(mini.WELLING), "first_seen": T1},
    }
    assert list(final) == sorted(final)
    assert runs[-1][1].groups["s1"] == ["s1", "s2"] and runs[-1][1].groups["c1"] == ["c1", "c9"]
    assert ids_stage.read_ledger(str(tmp_path / "ids.jsonl")) == final      # threaded through the file each version
    assert [len(rows) for rows, _ in runs] == [10, 11, 11, 12, 12]           # the removed rows carried all season


def test_assign_changes_neither_its_rows_nor_its_ledger_and_the_rows_order_does_not_matter():
    rows, _ = run_mini()[3]                         # v4: a match, a split and a collision in one run
    ledger = run_mini()[2][1].ledger
    before = copy.deepcopy((rows, ledger))
    result = ids_stage.assign(rows, ledger, T4, THRESHOLDS)
    assert (rows, ledger) == before
    shuffled = rows[:]
    random.Random(4).shuffle(shuffled)
    again = ids_stage.assign(shuffled, ledger, T4, THRESHOLDS)
    assert (again.ledger, again.groups, again.report) == (result.ledger, result.groups, result.report)
    assert ids(again) == ids(result)


def test_the_mini_history_writes_the_same_ledger_under_two_hash_seeds(tmp_path):
    """Set order follows the process's hash seed; nothing the stage writes may."""
    code = ("import os, sys\n"
            f"sys.path[:0] = [{ROOT!r}, {HERE!r}]\n"
            "import ids_stage, scraper, mini_history\n"
            "ledger, previous = {}, {}\n"
            "for v in mini_history.versions():\n"
            "    listed = {e['id']: {'source_id': e['id'], **{k: e[k] for k in scraper.ROW_FIELDS[1:]}}\n"
            "              for e in v['events']}\n"
            "    rows = scraper.carry(listed, previous)\n"
            "    thresholds = {'new_ids': 0.2}\n"
            "    ledger = ids_stage.assign(rows, ledger, v['generated_at'], thresholds).ledger\n"
            "    previous = {r['source_id']: r for r in rows}\n"
            "ids_stage.write_ledger(sys.argv[1], ledger)\n")
    written = []
    for seed in ("1", "2"):
        path = tmp_path / f"ids-{seed}.jsonl"
        subprocess.run([sys.executable, "-c", code, str(path)], cwd=ROOT, check=True, capture_output=True,
                       env={**os.environ, "PYTHONHASHSEED": seed})
        written.append(path.read_bytes())
    ids_stage.write_ledger(str(tmp_path / "ids.jsonl"), run_mini()[-1][1].ledger)
    assert written[0] == written[1] == (tmp_path / "ids.jsonl").read_bytes()
