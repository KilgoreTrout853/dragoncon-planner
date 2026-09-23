"""Tests for the merge, merge_stage.py (DECISIONS #43, #44; contract.md, The merge): every clause on inline rows - who
supplies the scalars and the source id, removed, stale, type, the unions and their order, the description, was - the
identity on groups of one, the order of the events, and that it changes neither input. Nothing here reads data/.

Run:  python -m pytest tests/
"""
import copy
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import merge_stage as ms  # noqa: E402
import scraper  # noqa: E402


def row(sid, eid=None, **fields):
    """A raw row carrying our id: the ten fields, then `stale` or `removed` where given true."""
    flags = {k: True for k in ("stale", "removed") if fields.pop(k, False)}
    out = {"source_id": sid, "type": "panel", "title": "Castle Cast", "day": "2026-09-05",
           "start": "2026-09-05T11:30", "end": "2026-09-05T12:30", "duration_min": 60,
           "location": "Marriott Atrium Ballroom", "description": "", "tracks": [], "speakers": []}
    out.update(fields)
    return {**out, "id": eid or sid, **flags}


def sp(name, role="Speaker"):
    return {"name": name, "role": role}


def one(rows, ledger=None):
    """The one event a group of rows makes."""
    events = ms.merge(rows, ledger)
    assert len(events) == 1, events
    return events[0]


def line(eid, merged_into=None):
    """A ledger line (contract.md, The ledger); the merge reads merged_into alone."""
    out = {"id": eid, "source_ids": [] if merged_into else [eid], "key": ["castle cast", "2026-09-05T11:30", "x"],
           "first_seen": "2026-08-01T00:00:00+00:00"}
    return {**out, "merged_into": merged_into} if merged_into else out


# ---------------------------------------------------------------------------
# A group of one
# ---------------------------------------------------------------------------

def test_the_ten_fields_are_the_raw_row_s():
    assert ms.FIELDS == scraper.ROW_FIELDS[1:]


def test_a_frozen_year_s_groups_of_one_come_back_as_they_were():
    rows = [row("a1", tracks=["Kids Track", "Anime"], description="Songs.",
                # 2026's "Ultimate Puppet Ninja Warrior: Finals" lists one person in two roles, and a list's own
                # repeats are its own
                speakers=[sp("Christine Papalexis", "Judge"), sp("Robin Amico"), sp("Christine Papalexis")]),
            row("b2", speakers=[sp("Ann"), sp("Ann")], type="gaming", description=None),
            row("c3", stale=True), row("d4", removed=True)]
    assert ms.merge(rows, None) == rows
    assert ms.merge(rows, {}) == rows


def test_the_events_come_in_the_order_of_each_id_s_first_row():
    rows = [row("c3"), row("a1", "b2"), row("b2"), row("d4", "c3")]
    assert [e["id"] for e in ms.merge(rows, {})] == ["c3", "b2"]       # not id order: c3's first row comes first
    assert [e["id"] for e in ms.merge(rows[1:], {})] == ["b2", "c3"]


def test_an_event_is_its_id_its_source_id_the_ten_fields_and_its_flags():
    event = one([row("a1", "x", removed=True, stale=False)], {"x": line("x"), "y": line("y", "x")})
    assert list(event) == ["id", "source_id", *ms.FIELDS, "removed", "was"]


# ---------------------------------------------------------------------------
# Existence is the group's
# ---------------------------------------------------------------------------

def test_removed_only_when_every_row_of_the_group_is():
    assert "removed" not in one([row("a1", "x", removed=True), row("b2", "x")])
    assert "removed" not in one([row("a1", "x"), row("b2", "x", removed=True)])
    assert one([row("a1", "x", removed=True), row("b2", "x", removed=True)])["removed"] is True


# ---------------------------------------------------------------------------
# Content is a row's
# ---------------------------------------------------------------------------

def test_the_smallest_row_not_removed_supplies_every_scalar_and_the_source_id():
    event = one([row("c3", "x", title="Third", location="Hilton 202", start="2026-09-05T15:00", day="2026-09-05"),
                 row("a1", "x", removed=True, title="Gone", location="Hyatt Regency V"),
                 row("b2", "x", title="Castle Cast Live", location="Marriott A707", day="2026-09-06",
                     start="2026-09-06T10:00", end="2026-09-06T11:30", duration_min=90)])
    assert event["source_id"] == "b2"      # the supplying row moved: a1 is removed and b2 is not (#43's header note)
    assert {k: event[k] for k in ("title", "day", "start", "end", "duration_min", "location")} == {
        "title": "Castle Cast Live", "day": "2026-09-06", "start": "2026-09-06T10:00", "end": "2026-09-06T11:30",
        "duration_min": 90, "location": "Marriott A707"}


def test_source_ids_sort_as_strings():
    assert one([row("a9", "x", title="Nine"), row("a10", "x", title="Ten")])["title"] == "Ten"   # "a10" < "a9"


def test_where_every_row_is_removed_the_smallest_of_all_supplies():
    event = one([row("b2", "x", removed=True, title="Second"), row("a1", "x", removed=True, title="First")])
    assert (event["source_id"], event["title"], event["removed"]) == ("a1", "First", True)


def test_stale_is_the_supplying_row_s():
    assert one([row("a1", "x", stale=True), row("b2", "x")])["stale"] is True
    assert "stale" not in one([row("a1", "x"), row("b2", "x", stale=True)])
    assert one([row("a1", "x", removed=True), row("b2", "x", stale=True)])["stale"] is True


def test_type_is_panel_where_any_row_not_removed_is_panel():
    assert one([row("a1", "x", type="gaming"), row("b2", "x", type="panel")])["type"] == "panel"
    assert one([row("a1", "x", type="gaming"), row("b2", "x", type="panel", removed=True)])["type"] == "gaming"
    assert one([row("a1", "x", type="gaming", removed=True), row("b2", "x", type="panel", removed=True)])["type"] == \
        "panel"
    assert one([row("a1", "x", type="gaming"), row("b2", "x", type="gaming")])["type"] == "gaming"


def test_tracks_and_speakers_are_unions_in_source_id_order():
    event = one([row("c3", "x", tracks=["Anime"], speakers=[sp("Dee")]),
                 row("a1", "x", tracks=["Trek Track"], speakers=[sp("Ann"), sp("Bo")]),
                 row("b2", "x", tracks=["Science", "Trek Track"],
                     speakers=[sp("Bo", "Moderator"), sp("Cy"), sp("Ann")])])
    assert event["tracks"] == ["Trek Track", "Science", "Anime"]
    # a speaker is the whole entry: Bo in two roles stays twice, and Ann, the same entry twice, once
    assert event["speakers"] == [sp("Ann"), sp("Bo"), sp("Bo", "Moderator"), sp("Cy"), sp("Dee")]


def test_a_row_s_own_repeats_stay_and_an_earlier_row_s_entries_are_not_added_again():
    event = one([row("a1", "x", speakers=[sp("Ann"), sp("Ann")]),
                 row("b2", "x", speakers=[sp("Ann"), sp("Bo"), sp("Bo")])])
    assert event["speakers"] == [sp("Ann"), sp("Ann"), sp("Bo"), sp("Bo")]


def test_a_removed_row_s_lists_count_only_where_every_row_is_removed():
    rows = [row("a1", "x", removed=True, tracks=["Old Track"], speakers=[sp("Gone")]),
            row("b2", "x", tracks=["New Track"], speakers=[sp("Here")])]
    assert (one(rows)["tracks"], one(rows)["speakers"]) == (["New Track"], [sp("Here")])
    rows[1]["removed"] = True
    assert (one(rows)["tracks"], one(rows)["speakers"]) == (["Old Track", "New Track"], [sp("Gone"), sp("Here")])


def test_the_description_is_the_longest_of_the_rows_read_a_tie_going_to_the_first():
    assert one([row("a1", "x", description="Short."), row("b2", "x", description="A longer one.")])["description"] == \
        "A longer one."
    assert one([row("b2", "x", description="Evn!"), row("a1", "x", description="Same")])["description"] == "Same"
    assert one([row("a1", "x", removed=True, description="The longest description of all."),
                row("b2", "x", description="Short.")])["description"] == "Short."
    assert one([row("a1", "x", description=None), row("b2", "x", description="")])["description"] is None


# ---------------------------------------------------------------------------
# was
# ---------------------------------------------------------------------------

def test_was_is_every_id_merged_into_this_one_through_any_chain():
    # c3 merged into b2, and b2 later into a1: a pick on c3 lands on a1, so a1's was holds both. The ledger is not
    # in id order here, and was is sorted all the same.
    ledger = {"d4": line("d4", "a1"), "a1": line("a1"), "c3": line("c3", "b2"), "b2": line("b2", "a1"),
              "e5": line("e5"), "f6": line("f6", "g7"), "g7": line("g7")}
    events = {e["id"]: e for e in ms.merge([row("a1"), row("b2x", "a1"), row("e5")], ledger)}
    assert events["a1"]["was"] == ["b2", "c3", "d4"]
    assert "was" not in events["e5"]
    assert set(events) == {"a1", "e5"}           # an id merged away holds no rows, and makes no event
    assert ms.merged_into_each(ledger) == {"a1": ["b2", "c3", "d4"], "g7": ["f6"]}


def test_was_is_set_whether_or_not_the_survivor_is_removed():
    assert one([row("a1", removed=True)], {"a1": line("a1"), "b2": line("b2", "a1")})["was"] == ["b2"]


# ---------------------------------------------------------------------------
# Purity
# ---------------------------------------------------------------------------

def test_the_merge_changes_neither_input_and_returns_none_of_their_objects():
    rows = [row("b2", "x", tracks=["Science"], speakers=[sp("Bo")]), row("a1", "x", tracks=["Trek Track"],
                                                                         speakers=[sp("Ann")])]
    ledger = {"x": line("x"), "y": line("y", "x")}
    before = copy.deepcopy((rows, ledger))
    event = one(rows, ledger)
    assert (rows, ledger) == before
    event["tracks"].append("Anime")
    event["speakers"][0]["name"] = "Someone Else"
    event["was"].append("z")
    alone = ms.merge([rows[0]], {})[0]
    alone["speakers"][0]["role"] = "Moderator"
    assert (rows, ledger) == before
