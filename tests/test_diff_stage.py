"""Tests for diff_stage.py and events_v2.attribution(): every kind with its from and to, the first run, a run that
changes nothing and a retag, what makes no line, the cause rule, merged read from `was`, the fatal event that leaves by
no merge, the lines' order and bytes, the counts and purity; two five-run mini-histories through the fetch's carry,
the ids stage, the build and the diff - this file's, and tests/mini_history.py's; and the attribution document, on the
current inputs and across a code change that regroups the previous rows. Nothing reads data/, calls a model or runs
git.

Run:  python -m pytest tests/
"""
import copy
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import diff_stage  # noqa: E402
import events_v2 as v2  # noqa: E402
import ids_stage  # noqa: E402
import mini_history  # noqa: E402
import parse_stage as ps  # noqa: E402
import registry  # noqa: E402
import scraper  # noqa: E402
import tag_key  # noqa: E402
import venues  # noqa: E402

T0, T1 = "2027-08-01T10:00:00+00:00", "2027-08-02T10:00:00+00:00"
SHA = "0123abc"
VERSION = 1
THRESHOLDS = {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 1, "requests_per_run": 40}


# --- documents by hand, for the diff alone ------------------------------------------

def event(i, **fields):
    """A v2 event with the fields the diff reads, and any others given."""
    out = {"id": i, "title": f"Event {i}", "start": "2027-09-04T11:30", "end": "2027-09-04T12:30",
           "hotel": "Marriott", "room": "A", "cancelled": False, "people": [], "tracks": ["Main Programming"],
           "description": f"About {i}."}
    out.update(fields)
    return out


def doc(*events, digest="d0", changed_at=T0):
    return {"changed_at": changed_at, "digest": digest, "events": [copy.deepcopy(e) for e in events]}


def person(pid, name=None, role="Speaker"):
    return {"id": pid, "name": name or pid.title(), "role": role, "src": "speakers"}


def run(previous, current, attribution=None, stamp=T1, sha=SHA):
    return diff_stage.diff(previous, current, stamp=stamp, sha=sha, attribution=attribution)


def brief(lines):
    """(id, kind, cause) of each line."""
    return [(x["id"], x["kind"], x["cause"]) for x in lines]


def test_every_kind_with_its_from_and_to():
    before = [event("time"), event("place"), event("title"), event("people", people=[person("ada")]),
              event("tracks", tracks=["B Track", "A Track"]), event("description"), event("cancel"),
              event("uncancel", cancelled=True), event("remove"), event("restore", removed=True), event("m1"),
              event("m2")]
    after = [event("time", start="2027-09-04T14:00", end="2027-09-04T15:00"),
             event("place", hotel="Courtland Grand", room="Athens"), event("title", title="Event title, renamed"),
             event("people", people=[person("bea"), person("ada")]), event("tracks", tracks=["C Track", "A Track"]),
             event("description", description="About it, again."), event("cancel", cancelled=True),
             event("uncancel"), event("remove", removed=True), event("restore"), event("m1", was=["m2"]),
             event("new")]
    lines = run(doc(*before), doc(*after, digest="d1")).lines
    base = {"run": T1, "sha": SHA}
    assert lines == [
        {**base, "id": "cancel", "kind": "cancelled", "cause": "source"},
        {**base, "id": "description", "kind": "description", "cause": "source"},
        {**base, "id": "m2", "kind": "merged", "to": "m1", "cause": "source"},
        {**base, "id": "new", "kind": "added", "cause": "source"},
        {**base, "id": "people", "kind": "people", "from": ["ada"], "to": ["ada", "bea"], "cause": "source"},
        {**base, "id": "place", "kind": "place", "from": {"hotel": "Marriott", "room": "A"},
         "to": {"hotel": "Courtland Grand", "room": "Athens"}, "cause": "source"},
        {**base, "id": "remove", "kind": "removed", "cause": "source"},
        {**base, "id": "restore", "kind": "restored", "cause": "source"},
        {**base, "id": "time", "kind": "time", "from": {"start": "2027-09-04T11:30", "end": "2027-09-04T12:30"},
         "to": {"start": "2027-09-04T14:00", "end": "2027-09-04T15:00"}, "cause": "source"},
        {**base, "id": "title", "kind": "title", "from": "Event title", "to": "Event title, renamed",
         "cause": "source"},
        {**base, "id": "tracks", "kind": "tracks", "from": ["A Track", "B Track"], "to": ["A Track", "C Track"],
         "cause": "source"},
        {**base, "id": "uncancel", "kind": "uncancelled", "cause": "source"}]
    for line in lines:    # the keys in their order, from and to only where the kind has them
        assert list(line) == [k for k in diff_stage.LINE_KEYS if k in line], line


def test_the_first_run_adds_every_event_its_stamp_changed_at():
    result = run(None, doc(event("b"), event("a", removed=True), event("c", cancelled=True)))
    assert brief(result.lines) == [("a", "added", "source"), ("b", "added", "source"), ("c", "added", "source")]
    assert (result.changed_at, result.changes_logged) == (T1, 3)   # an event added removed is added only


def test_a_run_that_changes_nothing_logs_nothing_and_keeps_changed_at():
    same = doc(event("a"), event("b", was=["x"]))
    result = run(same, copy.deepcopy(same))
    assert (result.lines, result.changed_at, result.changes_logged) == ([], T0, 0)


def test_a_retag_moves_changed_at_with_no_line():
    """Tags are never logged, so a digest that moves with no line still moves changed_at (#47)."""
    result = run(doc(event("a", tags={"kind": "panel"})), doc(event("a", tags={"kind": "qa"}), digest="d1"))
    assert (result.lines, result.changed_at) == ([], T1)


def test_no_line_for_an_order_alone_stale_was_source_id_tags_or_the_venues_reading():
    before = event("a", tracks=["B Track", "A Track"], people=[person("ada"), person("bea")], source_id="s1",
                   level="atrium", rooms=["A"], place="exact", tags={"kind": "panel"}, speakers=[])
    after = event("a", tracks=["A Track", "B Track"], stale=True, was=["z9"], source_id="s2", level=None, rooms=[],
                  place="hotel", tags={"kind": "qa"}, day="2027-09-05", duration_min=90, location="Marriott-A",
                  people=[person("bea", name="Bea B.", role="Moderator"), person("ada")],
                  speakers=[{"name": "Bea B.", "role": "Moderator"}])
    result = run(doc(before), doc(after, digest="d1"))
    assert result.lines == [] and result.changed_at == T1


def test_the_cause_is_source_where_attribution_differs_and_code_where_it_agrees():
    """Attribution is the previous rows through the current code: what it already shows, the code changed."""
    previous = doc(event("a", people=[person("ada")]), event("gone"), event("m1"), event("m2"))
    # the current code re-read a's room and reached bea's id (a registry alias, say); the source renamed a, added
    # carl to it, dropped gone's listing, and listed new; the current code merged m2 into m1
    attribution = doc(event("a", room="A707", people=[person("ada"), person("bea")]), event("gone"),
                      event("m1", was=["m2"]), event("new-by-code"))
    current = doc(event("a", room="A707", title="Renamed", people=[person("ada"), person("bea"), person("carl")]),
                  event("gone", removed=True), event("m1", was=["m2"]), event("new"), event("new-by-code"),
                  digest="d1")
    result = run(previous, current, attribution)
    assert brief(result.lines) == [
        ("a", "people", "source"),     # the code added bea and the source carl: source wins, from and to the whole
        ("a", "place", "code"),
        ("a", "title", "source"),
        ("gone", "removed", "source"),
        ("m2", "merged", "code"),
        ("new", "added", "source"),
        ("new-by-code", "added", "code")]
    people = next(x for x in result.lines if x["kind"] == "people")
    assert (people["from"], people["to"]) == (["ada"], ["ada", "bea", "carl"])
    assert brief(run(previous, current).lines) == [(i, k, "source") for i, k, _ in brief(result.lines)]


def test_an_event_attribution_lacks_differs_on_every_kind():
    previous, current = doc(event("a")), doc(event("a", title="Renamed", cancelled=True), digest="d1")
    assert brief(run(previous, current, doc()).lines) == [("a", "cancelled", "source"), ("a", "title", "source")]


def test_merged_is_read_from_the_survivors_was_and_an_id_logged_before_is_not_again():
    """A merged into B in an earlier run; B into C now. C's was names both, and B alone is a change this run. Two
    ids merging into one survivor in one run are two lines."""
    previous = doc(event("b", was=["a"]), event("c"))
    current = doc(event("c", was=["a", "b"]), digest="d1")
    assert run(previous, current).lines == [
        {"run": T1, "sha": SHA, "id": "b", "kind": "merged", "to": "c", "cause": "source"}]
    both = run(doc(event("m1"), event("m2"), event("m3")), doc(event("m1", was=["m2", "m3"]), digest="d1"))
    assert [(x["id"], x["kind"], x["to"]) for x in both.lines] == [("m2", "merged", "m1"), ("m3", "merged", "m1")]


def test_a_merge_attribution_makes_into_another_survivor_reads_as_source():
    """The code alone would have merged m2 into m9; the run merged it into m1: the source chose the survivor."""
    previous = doc(event("m1"), event("m2"), event("m9"))
    current = doc(event("m1", was=["m2"]), event("m9"), digest="d1")
    assert brief(run(previous, current, doc(event("m1"), event("m9", was=["m2"]))).lines) == [
        ("m2", "merged", "source")]
    assert brief(run(previous, current, doc(event("m1", was=["m2"]), event("m9"))).lines) == [
        ("m2", "merged", "code")]


def test_an_event_that_leaves_by_no_merge_is_fatal_and_named():
    with pytest.raises(diff_stage.DiffError, match="left events.v2.json by no merge.*: a, c$"):
        run(doc(event("a"), event("b"), event("c")), doc(event("b"), digest="d1"))


def test_lines_sort_by_run_id_and_kind_and_render_writes_one_compact_line_each():
    previous = doc(event("b"), event("a"), event("a.1"))
    current = doc(event("b", title="B", room="Athens"), event("a", start="2027-09-04T13:00", end="2027-09-04T14:00"),
                  event("a.1", description="Longer."), digest="d1")
    lines = run(previous, current).lines
    assert [(x["id"], x["kind"]) for x in lines] == [("a", "time"), ("a.1", "description"), ("b", "place"),
                                                     ("b", "title")]
    text = diff_stage.render(lines[1:3] + [{**lines[0], "id": "é"}])
    assert text.encode("utf-8") == (
        '{"run":"2027-08-02T10:00:00+00:00","sha":"0123abc","id":"a.1","kind":"description","cause":"source"}\n'
        '{"run":"2027-08-02T10:00:00+00:00","sha":"0123abc","id":"b","kind":"place",'
        '"from":{"hotel":"Marriott","room":"A"},"to":{"hotel":"Marriott","room":"Athens"},"cause":"source"}\n'
        '{"run":"2027-08-02T10:00:00+00:00","sha":"0123abc","id":"é","kind":"time",'
        '"from":{"start":"2027-09-04T11:30","end":"2027-09-04T12:30"},'
        '"to":{"start":"2027-09-04T13:00","end":"2027-09-04T14:00"},"cause":"source"}\n').encode("utf-8")
    assert diff_stage.render([]) == ""


def test_the_counts_by_kind_and_by_cause():
    previous = doc(event("a"), event("b"))
    current = doc(event("a", title="A"), event("b", title="B", removed=True), event("c"), digest="d1")
    result = run(previous, current, doc(event("a", title="A"), event("b")))
    assert result.kinds == {"title": 2, "removed": 1, "added": 1} and result.causes == {"code": 1, "source": 3}
    assert result.changes_logged == len(result.lines) == 4


def test_the_diff_changes_neither_document_and_hands_back_none_of_their_objects():
    previous = doc(event("a", people=[person("ada")], tracks=["X"]), event("m2"))
    current = doc(event("a", people=[person("bea")], tracks=["Y"], start="2027-09-05T10:00"), event("m1", was=["m2"]),
                  digest="d1")
    attribution = doc(event("a"), event("m2"))
    kept = copy.deepcopy((previous, current, attribution))
    result = run(previous, current, attribution)
    assert (previous, current, attribution) == kept
    for line in result.lines:
        for value in (line.get("from"), line.get("to")):
            if isinstance(value, (list, dict)):
                value.clear()
    assert (previous, current, attribution) == kept


# --- through the whole chain ---------------------------------------------------------------

def level(lid, name, order, rooms):
    return {"id": lid, "name": name, "order": order, "rooms": list(rooms), "aliases": {}, "notes": []}


def hotel(name, order, keys, levels=(), placeless=False):
    return {"hotel": name, "name": name, "keys": list(keys), "short": name, "group": name, "var": name, "order": order,
            "placeless": placeless, "display": "rest", "levels": list(levels), "unplaced": {}}


VENUES = venues.check({"walk": {"Marriott|Courtland Grand": 10}, "same_venue_min": 5, "unknown_pair_min": 12,
                       "slack_min": 10,
                       "hotels": [hotel("Marriott", 0, ["Marriott"],
                                        [level("atrium", "Atrium Level", 0, ["A", "A707"])]),
                                  hotel("Courtland Grand", 1, ["Courtland Grand", "Courtland"],
                                        [level("grand", "Grand Level", 0, ["Athens"])]),
                                  hotel("Streaming", 2, ["Streaming"], placeless=True),
                                  hotel("Other", 3, ["O", "Other"], placeless=True),
                                  hotel("Unknown", 4, [], placeless=True)]})
CASTLE = {"id": "castle", "name": "Castle", "aliases": [], "type": "franchise", "reviewed": True}
REG = registry.Registry([CASTLE], [], [])


def rows_of(version):
    """A version's events as raw rows, each id its source id."""
    return [{"source_id": e["id"], **{k: e[k] for k in scraper.ROW_FIELDS[1:]}} for e in version["events"]]


def chain(versions, shas, rules=None):
    """Each version through the fetch's carry, the ids stage with the last ledger, the build and the diff, as a run
    would; a changed sha builds the attribution from the run before's rows and ledger, and changed_at is written back
    as the orchestrator writes it. `rules`, where given, is each run's cancelled rule - that run's code - or None for
    today's, parse_stage.is_cancelled. -> the diffs, one a version."""
    ledger, carried, previous, out, today = {}, {}, None, [], ps.is_cancelled
    for n, (version, sha) in enumerate(zip(versions, shas)):
        ps.is_cancelled = (rules[n] if rules else None) or today
        try:
            rows = scraper.carry({r["source_id"]: r for r in rows_of(version)}, carried)
            result = ids_stage.assign(rows, ledger, version["generated_at"], THRESHOLDS)
            top = {"generated_at": version["generated_at"], "changed_at": previous["changed_at"] if previous else None}
            current, _ = v2.build(result.rows, top, REG, {}, VENUES, result.ledger, version=VERSION)
            attribution = None
            if n and sha != shas[n - 1]:    # the run before's rows through this run's code
                attribution = v2.attribution(list(carried.values()), ledger, REG, {}, VENUES, version=VERSION,
                                             thresholds=THRESHOLDS, stamp=versions[n - 1]["generated_at"])
        finally:
            ps.is_cancelled = today
        found = diff_stage.diff(previous, current, stamp=version["generated_at"], sha=sha, attribution=attribution)
        current["changed_at"] = found.changed_at
        out.append(found)
        ledger, carried, previous = result.ledger, {r["source_id"]: r for r in rows}, current
    return out


def older_cancelled_rule(title, description):
    """A cancelled rule before today's: "cancel" anywhere in the title, as the 2026 scraper's rule read "Hopes,
    Dreams, & Cancellations" until v9 (history-2026.md, section 5)."""
    return "cancel" in (title or "").lower()


def with_(what, **change):
    """mini_history's event, changed."""
    e = mini_history.event(*what)
    e.update(change)
    return e


def test_five_runs_a_move_a_rename_a_cancellation_a_return_a_removal_and_a_code_change():
    """Runs 1-4 are built by an older cancelled rule, which read "Cancellations" in a title, and run 5's commit brings
    today's: the attribution document, run 4's rows through run 5's code, shows d1 uncancelled already, so its line is
    code, while the description the source edited in the same run is source."""
    a = ("a1", "Castle Cast", "2027-09-04T11:30", "Marriott A")
    b = ("b1", "Firefly Reunion", "2027-09-04T13:00", "Marriott A707")
    c = ("c1", "Trek Trivia", "2027-09-04T20:00", "Courtland Grand Athens")
    d = ("d1", "Hopes, Dreams, & Cancellations: The Festivus Panel", "2027-09-05T17:00", "Marriott A")
    e = ("e1", "Dragon Con Burlesque: A Glamour Geek Revue", "2027-09-05T22:00", "Marriott A707")
    f = ("f1", "Onesie Wednesday", "2027-09-02T23:00", "Marriott A")
    moved = [with_(a, start="2027-09-04T14:00", end="2027-09-04T15:00"), with_(b, location="Courtland Grand Athens")]
    renamed = with_(c, title="Trek Trivia Night")
    cancelled = with_(e, title="CANCELLED: Dragon Con Burlesque: A Glamour Geek Revue")
    events = [[with_(x) for x in (a, b, c, d, e, f)],
              moved + [with_(c), with_(d), with_(e)],                         # f1 unlisted: carried removed
              moved + [renamed, with_(d), with_(e), with_(f)],                # f1 back
              moved + [renamed, with_(d), cancelled, with_(f)],
              moved + [with_(c, title="Trek Trivia Night", description="Name that starship, and its captain."),
                       with_(d), cancelled, with_(f)]]
    versions = [{"generated_at": s, "events": evs} for s, evs in zip(mini_history.STAMPS, events)]
    diffs = chain(versions, ["old"] * 4 + ["new"], rules=[older_cancelled_rule] * 4 + [None])
    assert [brief(x.lines) for x in diffs] == [
        [("a1", "added", "source"), ("b1", "added", "source"), ("c1", "added", "source"), ("d1", "added", "source"),
         ("e1", "added", "source"), ("f1", "added", "source")],
        [("a1", "time", "source"), ("b1", "place", "source"), ("f1", "removed", "source")],
        [("c1", "title", "source"), ("f1", "restored", "source")],
        [("e1", "cancelled", "source"), ("e1", "title", "source")],
        [("c1", "description", "source"), ("d1", "uncancelled", "code")]]
    assert [x.changed_at for x in diffs] == list(mini_history.STAMPS)
    time, place = diffs[1].lines[0], diffs[1].lines[1]
    assert (time["from"], time["to"]) == ({"start": "2027-09-04T11:30", "end": "2027-09-04T12:30"},
                                          {"start": "2027-09-04T14:00", "end": "2027-09-04T15:00"})
    assert (place["from"], place["to"]) == ({"hotel": "Marriott", "room": "A707"},
                                            {"hotel": "Courtland Grand", "room": "Athens"})
    assert {x["sha"] for x in diffs[4].lines} == {"new"}
    assert {x["run"] for x in diffs[4].lines} == {mini_history.STAMPS[4]}


def test_mini_history_through_the_whole_chain():
    """tests/mini_history.py's five versions: gone and swapped listings, a return, a copy that splits off under its
    own id, a match across a gap, a move that splits t1.1 off, a collision, and a dropped copy, which changes a group's
    membership and makes no line."""
    diffs = chain(mini_history.versions(), ["a"] * 5)
    assert [[(x["id"], x["kind"]) + ((x["to"],) if "to" in x else ()) for x in d.lines] for d in diffs] == [
        [("c1", "added"), ("m1", "added"), ("m2", "added"), ("s1", "added"), ("t1", "added"), ("u1", "added"),
         ("w1", "added")],
        [("c1", "removed"), ("u1", "removed"), ("u2", "added"), ("w1", "removed")],
        [("s3", "added"), ("w1", "restored")],
        [("c1", "restored"), ("m2", "merged", "m1"), ("t1.1", "added")],
        []]
    assert diffs[4].changed_at == diffs[3].changed_at == mini_history.STAMPS[3]   # v5 moves no digest


# --- the attribution document ---------------------------------------------------------------

def raw(sid, title="Castle Cast", location="Marriott A", **flags):
    out = {"source_id": sid, "type": "panel", "title": title, "day": "2027-09-04", "start": "2027-09-04T11:30",
           "end": "2027-09-04T12:30", "duration_min": 60, "location": location, "description": "",
           "tracks": ["Main Programming"], "speakers": []}
    return {**out, **{k: True for k, on in flags.items() if on}}


def test_attribution_on_the_current_inputs_is_the_current_build():
    """A live year after two runs, as tests/test_events_v2.py's live fixture has it: b2 merged into a1, c3 removed,
    d4 stale. Its rows and ledger through attribution() give the build's works, events and digest - under a
    prompt_version of 2, so the cache is read by the version given."""
    first = [raw("a1"), raw("b2", location="Marriott A707"), raw("c3", "Firefly Reunion"), raw("d4", "Trek Trivia")]
    second = [raw("a1"), raw("b2"), raw("c3", "Firefly Reunion", removed=True), raw("d4", "Trek Trivia", stale=True)]
    ledger = ids_stage.assign(first, {}, T0, THRESHOLDS).ledger
    result = ids_stage.assign(second, ledger, T1, THRESHOLDS)
    castle = {**raw("a1"), "id": "a1"}
    key = tag_key.input_key(tag_key.tagger_input(castle), 2)
    answer = {"kind": "qa", "works": [{"name": "Castle", "evidence": "Castle", "type": "franchise"}], "medium": [],
              "genre": [], "craft": [], "subject": [], "audience": "all", "play": None}
    cache = {key: {"key": key, "title": "Castle Cast", "model": "m", "answer": answer}}
    built, _ = v2.build(result.rows, {"generated_at": T1, "changed_at": T0}, REG, cache, VENUES, result.ledger,
                        version=2)
    kept = copy.deepcopy((second, result.ledger))
    seen = v2.attribution(second, result.ledger, REG, cache, VENUES, version=2, thresholds=THRESHOLDS, stamp=T1)
    assert list(seen) == ["digest", "works", "events"]
    assert (seen["digest"], seen["works"], seen["events"]) == (built["digest"], built["works"], built["events"])
    assert [e["id"] for e in seen["events"]] == ["a1", "c3", "d4"] and seen["works"][0]["id"] == "castle"
    assert (second, result.ledger) == kept


def test_attribution_builds_a_regrouping_the_current_code_makes_and_the_diff_reads_it_as_code(monkeypatch):
    """The commit changes the ids stage: norm_text reads "Q & A" as "Q&A". Re-run on mini_history v3's rows, the
    ledger changes - m2 collides with m1 - and attribution builds with the ledger the ids stage returns, in memory,
    refusing nothing; m2's merge into m1 then reads as code, and so does m1's description, which the merge now takes
    from m2's longer one."""
    versions = mini_history.versions()[:3]
    ledger, carried = {}, {}
    for version in versions:
        rows = scraper.carry({r["source_id"]: r for r in rows_of(version)}, carried)
        result = ids_stage.assign(rows, ledger, version["generated_at"], THRESHOLDS)
        ledger, carried = result.ledger, {r["source_id"]: r for r in rows}
    previous, _ = v2.build(result.rows, {"generated_at": versions[2]["generated_at"], "changed_at": T0}, REG, {},
                           VENUES, ledger, version=VERSION)
    real = ids_stage.norm_text
    monkeypatch.setattr(ids_stage, "norm_text", lambda s: real(str(s or "").replace(" & ", "&")))
    now = ids_stage.assign(rows, ledger, T1, THRESHOLDS)          # this run: the same listings, the new code
    assert now.ledger != ledger and now.report.merged == [{"id": "m2", "into": "m1"}]
    current, _ = v2.build(now.rows, {"generated_at": T1, "changed_at": T0}, REG, {}, VENUES, now.ledger,
                          version=VERSION)
    kept = copy.deepcopy(ledger)
    seen = v2.attribution(rows, ledger, REG, {}, VENUES, version=VERSION, thresholds=THRESHOLDS,
                          stamp=versions[2]["generated_at"])
    assert ledger == kept                                          # the snapshot's ledger, untouched
    lines = diff_stage.diff(previous, current, stamp=T1, sha="new", attribution=seen).lines
    assert [(x["id"], x["kind"], x.get("to"), x["cause"]) for x in lines] == [
        ("m1", "description", None, "code"), ("m2", "merged", "m1", "code")]
    assert [(x["id"], x["kind"], x["cause"]) for x in diff_stage.diff(previous, current, stamp=T1, sha="new").lines] \
        == [("m1", "description", "source"), ("m2", "merged", "source")]


def test_attribution_refuses_only_what_the_ids_stage_finds_fatal():
    with pytest.raises(v2.BuildError, match="the ids stage refuses the previous rows: the removed row x9"):
        v2.attribution([raw("x9", removed=True)], {}, REG, {}, VENUES, version=VERSION, thresholds=THRESHOLDS,
                       stamp=T0)


def test_render_of_a_whole_history_is_sorted_and_reads_back():
    diffs = chain(mini_history.versions(), ["a"] * 5)
    text = "".join(diff_stage.render(d.lines) for d in diffs)
    lines = [json.loads(line) for line in text.splitlines()]
    assert len(lines) == sum(d.changes_logged for d in diffs) and text.endswith("\n") and "\r" not in text
    assert lines == sorted(lines, key=lambda x: (x["run"], x["id"], x["kind"]))
