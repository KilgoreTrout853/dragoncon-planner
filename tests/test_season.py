"""Tests for season.py: one failing fixture per rule, and the committed files.

The fixtures are inline. The last test loads both committed years, data/2026/season.json and data/2027/season.json,
so that CI checks every later edit to them, and holds 2026's source and day strings to the frozen schedule.

Run:  python -m pytest tests/
"""
import copy
import datetime as dt
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import pytest  # noqa: E402

import season  # noqa: E402

GOOD = {"year": 2027, "slug": "dragoncon27", "source": "https://app.core-apps.com/dragoncon27",
        "days": ["Sep  1", "Sep  2", "Sep  3"], "con": {"first": "2027-09-01", "last": "2027-09-06"},
        "tz": "America/New_York", "window": {"from": "2027-08-01", "to": "2027-09-07"}, "frozen": False,
        "prompt_version": 1,
        "thresholds": {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}}


def good(**changes):
    return {**copy.deepcopy(GOOD), **changes}


def problems(data):
    """The problems `check` raises, or [] when it is happy."""
    try:
        season.check(data)
        return []
    except season.SeasonError as exc:
        return exc.problems


def only(data):
    """The one problem this fixture is built to produce."""
    found = problems(data)
    assert len(found) == 1, found
    return found[0]


def test_a_valid_season_is_returned_as_it_is():
    assert season.check(good()) == GOOD
    assert problems(good(window=None, frozen=True)) == []        # a frozen year has no window


def test_every_field_is_required():
    for field in season.FIELDS:
        d = good()
        del d[field]
        assert only(d) == f"the file: {field} is missing"


def test_a_key_the_file_does_not_know_is_a_problem():
    assert only(good(promt_version=1)) == "the file: 'promt_version' is not a key this file knows"
    assert only(good(con={**GOOD["con"], "middle": "2027-09-03"})) == "con: 'middle' is not a key this file knows"
    assert only(good(window={**GOOD["window"], "tz": "UTC"})) == "window: 'tz' is not a key this file knows"
    assert only(good(thresholds={**GOOD["thresholds"], "retries": 1})) == \
        "thresholds: 'retries' is not a key this file knows"
    assert only(good(con={"first": "2027-09-01"})) == "con: last is missing"


def test_year_prompt_version_and_frozen_are_typed():
    assert only(good(year="2027")) == "year '2027' is not a whole number"
    assert only(good(year=True)) == "year True is not a whole number"
    for bad in (0, -1, 1.5, True, "1"):
        assert "prompt_version" in only(good(prompt_version=bad)), bad
    assert only(good(frozen="no")) == "frozen 'no' is not true or false"


def test_slug_tz_and_source():
    assert only(good(slug="")) == "slug '' is not a non-empty string"
    assert only(good(tz=None)) == "tz None is not a non-empty string"
    for bad in ("app.core-apps.com/dragoncon27", "ftp://core-apps.com", "https:// core-apps", 27):
        assert "is not a URL" in only(good(source=bad)), bad


def test_days_are_distinct_day_strings():
    for bad in ([], "Sep  1", ["Sep  1", ""], [1, 2]):
        assert only(good(days=bad)) == "days is not a list of the source's day strings", bad
    assert only(good(days=["Sep  1", "Sep  1"])) == "days lists a day twice"


def test_con_and_window_are_iso_dates_in_order():
    for bad in ("2027-9-1", "2027/09/01", "20270901", "2027-02-30", None, 20270901):
        assert "con.first" in only(good(con={"first": bad, "last": "2027-09-06"})), bad
        assert "is not an ISO date" in only(good(con={"first": bad, "last": "2027-09-06"})), bad
    assert only(good(con={"first": "2027-09-07", "last": "2027-09-06"})) == \
        "con: first 2027-09-07 is after last 2027-09-06"
    assert only(good(window={"from": "2027-09-08", "to": "2027-09-07"})) == \
        "window: from 2027-09-08 is after to 2027-09-07"
    assert only(good(window=[])) == "window is not an object {from, to}"
    assert problems(good(con={"first": "2027-09-06", "last": "2027-09-06"})) == []   # one day is in order


def test_thresholds_are_fractions_and_a_request_cap():
    for bad in (0, -0.1, 1.5, "0.8", True, None):
        assert "thresholds.new_ids" in only(good(thresholds={**GOOD["thresholds"], "new_ids": bad})), bad
    assert problems(good(thresholds={**GOOD["thresholds"], "new_ids": 1})) == []     # 1 is in (0, 1]
    for bad in (0, 2.5, True, "40"):
        assert "thresholds.requests_per_run" in only(
            good(thresholds={**GOOD["thresholds"], "requests_per_run": bad})), bad
    assert only(good(thresholds=[])) == "thresholds is not an object"


def test_load_reads_a_file_and_lists_every_problem_sorted(tmp_path):
    path = tmp_path / "season.json"
    path.write_text(json.dumps(good(year="x", frozen=None, slug="")), encoding="utf-8")
    with pytest.raises(season.SeasonError) as exc:
        season.load(str(path))
    assert len(exc.value.problems) == 3 and exc.value.problems == sorted(exc.value.problems)
    (tmp_path / "broken.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(season.SeasonError, match="is not JSON"):
        season.load(str(tmp_path / "broken.json"))
    with pytest.raises(season.SeasonError, match="cannot be read"):
        season.load(str(tmp_path / "absent.json"))
    with pytest.raises(season.SeasonError, match="not an object"):
        season.check([GOOD])


def test_the_committed_seasons_are_valid():
    """Both years, so that CI checks every later edit to them."""
    s26 = season.load(os.path.join(ROOT, "data", "2026", "season.json"))
    s27 = season.load(os.path.join(ROOT, "data", "2027", "season.json"))
    # 2026's source is the frozen schedule's, and its day strings are the frozen events' days as the source writes
    # them - "Sep  2", two spaces before one digit - which the fetch reads from this file (PR 3)
    with open(os.path.join(ROOT, "data", "2026", "events.json"), "rb") as f:
        frozen = json.loads(f.read().decode("utf-8"))
    days = sorted({dt.date.fromisoformat(e["day"]) for e in frozen["events"]})
    assert s26["source"] == frozen["source"] and s26["source"].endswith("/" + s26["slug"])
    assert s26["days"] == [f"{d:%b} {d.day:>2}" for d in days]
    assert (s26["frozen"], s26["window"], s27["frozen"]) == (True, None, False)
    for s in (s26, s27):
        # the source's first day is the first day of the client's CON, which starts at the first listed event
        first = dt.datetime.strptime(f"{s['year']} {s['days'][0]}", "%Y %b %d").date().isoformat()
        assert first == s["con"]["first"], s["year"]
