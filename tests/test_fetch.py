"""Tests for the fetch stage: scraper.fetch(), source.json and main() (DECISIONS #41, #42, #44; contract.md).

get() is replaced by a fake source that serves day lists and detail pages in the markup of app.core-apps.com, as
tests/test_parse.py has them, so nothing here asks the network. Non-ASCII text is built with chr(), so that a line
of the test holds what it says.

Run:  python -m pytest tests/
"""
import json
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

import ftfy  # noqa: E402
import pytest  # noqa: E402
import requests  # noqa: E402

import scraper  # noqa: E402
import tag_key  # noqa: E402

BASE = "https://example.test/dc"
SEASON = {"year": 2026, "slug": "dc", "source": BASE, "days": ["Sep  5", "Sep  6"],
          "con": {"first": "2026-09-05", "last": "2026-09-06"}, "tz": "America/New_York", "window": None,
          "frozen": False, "prompt_version": 1,
          "thresholds": {"listings_floor": 0.8, "detail_failures": 0.2, "new_ids": 0.2, "requests_per_run": 40}}
RAW = ["source_id", "type", "title", "day", "start", "end", "duration_min", "location", "description", "tracks",
       "speakers"]

A_HAT, NBSP = chr(0xC2), chr(0xA0)                        # "Â" and a no-break space: U+00A0's UTF-8 read as cp1252
DASH = chr(0x2013)                                        # "–"
DASH_MOJIBAKE = chr(0xE2) + chr(0x20AC) + chr(0x201C)     # "â€“": the UTF-8 of "–" read as cp1252


# ---------------------------------------------------------------------------
# The fake source
# ---------------------------------------------------------------------------

def day_html(items):
    """A day list of (source_id, title) pairs."""
    rows = "".join(f'<div class="redux_list_item"><a class="object_link" href="/dc/event/{sid}">'
                   f'<div class="line one">{title}</div><div class="line two">11:00 AM - 12:00 PM</div></a></div>'
                   for sid, title in items)
    return f'<div class="redux_list">{rows}</div>'


def page(title="A Panel", location="Hilton 202", when="Saturday, Sep  5 11:00 AM", duration="1 hour",
         paragraphs=("What it is about.",), speakers=(), tracks=("Science",)):
    """A detail page. `title` None leaves the header out; `speakers` are (role, name) pairs."""
    head = f'<div class="template_header"><h1 class="header_title">{title}</h1></div>' if title is not None else ""
    table = (f'<table class="table"><tr><td>Location</td><td>{location}</td></tr>'
             f'<tr><td>Date</td><td>{when}</td></tr><tr><td>Duration</td><td>{duration}</td></tr></table>')
    people = "".join(f'<li><div class="line one">{role}</div><div class="line two">{name}</div></li>'
                     for role, name in speakers)
    links = "".join(f'<a class="btn link-btn">{track}</a>' for track in tracks)
    return (head + '<div class="template_content">'
            + f'<div class="section">{table}</div>'
            + '<div class="section">' + "".join(f"<p>{p}</p>" for p in paragraphs) + "</div>"
            + (f'<div class="section"><h2 class="section_heading">Speakers</h2><ul>{people}</ul></div>' if speakers else "")
            + (f'<div class="section"><h2 class="section_heading">Tracks</h2>{links}</div>' if tracks else "")
            + "</div>")


def panels(*ids, day="Sep  5"):
    """(lists, pages): `ids` listed as panels on one day, in that order, each page titled after its id."""
    return {("panel", day): [(sid, f"Listed {sid}") for sid in ids]}, {sid: page(title=f"Panel {sid}") for sid in ids}


class Source:
    """`lists` maps (kind, day) to [(source_id, title)], or to the exception that day list raises; `pages` maps a
    source_id to its detail page, or to the exception its fetch raises. `asked` is every path asked for."""

    def __init__(self, lists, pages):
        self.lists, self.pages, self.asked = lists, pages, []

    def get(self, session, base, path, params=None):
        assert base == BASE and session is None
        self.asked.append(path)
        if path == "events/view_by_day":
            kind = "gaming" if params.get("type") == "Entertainment" else "panel"
            found = self.lists.get((kind, params["day"]), [])
            if isinstance(found, Exception):
                raise found
            return day_html(found)
        found = self.pages[path.removeprefix("event/")]
        if isinstance(found, Exception):
            raise found
        return found

    def details(self):
        return sorted(p for p in self.asked if p.startswith("event/"))


@pytest.fixture
def serve(monkeypatch):
    """serve(lists, pages) puts a Source in place of get(), with no HTTP session, and returns it."""
    def install(lists, pages):
        source = Source(lists, pages)
        monkeypatch.setattr(scraper, "get", source.get)
        monkeypatch.setattr(scraper, "make_session", lambda: None)
        return source
    return install


def run(previous=None, season=None, **options):
    return scraper.fetch(season or SEASON, previous or {}, delay=0, **{"workers": 2, **options})


def old(sid, **flags):
    """A row of the previous file, as the fetch wrote it last time, with whichever flag is true."""
    row = {"source_id": sid, "type": "panel", "title": f"Old {sid}", "day": "2026-09-05", "start": "2026-09-05T09:00",
           "end": "2026-09-05T10:00", "duration_min": 60, "location": "Hyatt Regency V", "description": "As it was.",
           "tracks": ["Old Track"], "speakers": [{"name": "Ann Lee", "role": "Speaker"}]}
    return {**row, **{flag: True for flag, on in flags.items() if on}}


# ---------------------------------------------------------------------------
# The rows
# ---------------------------------------------------------------------------

def test_the_rows_are_the_raw_shape_sorted_by_source_id(serve):
    serve({("panel", "Sep  5"): [("c3", "Listed c3"), ("a1", "Listed a1")],
           ("gaming", "Sep  6"): [("b2", "Listed b2")]},
          {"c3": page(title="Panel c3"), "a1": page(title="Panel a1", speakers=[("Moderator", "Ann Lee")]),
           "b2": page(title="Game b2", location="Mart Building 3, Floor 1", when="Sunday, Sep  6 11:00 PM",
                      duration="2 hours", tracks=("Table Top Gaming", "Board Games"))})
    result = run()
    assert [r["source_id"] for r in result.rows] == ["a1", "b2", "c3"]
    assert all(list(r) == RAW for r in result.rows)       # no hotel, room, track or cancelled, and no flag
    a1, b2, _ = result.rows
    assert (a1["type"], a1["speakers"]) == ("panel", [{"name": "Ann Lee", "role": "Moderator"}])
    assert b2 == {"source_id": "b2", "type": "gaming", "title": "Game b2", "day": "2026-09-06",
                  "start": "2026-09-06T23:00", "end": "2026-09-07T01:00", "duration_min": 120,
                  "location": "Mart Building 3, Floor 1", "description": "What it is about.",
                  "tracks": ["Table Top Gaming", "Board Games"], "speakers": []}
    assert (result.failures, result.repaired, result.listings, result.fetched) == ([], 0, 3, 3)
    assert (result.carried_stale, result.carried_removed) == (0, 0) and result.seconds >= 0
    # the pages come back in any order; the rows do not
    assert run(workers=1).rows == run(workers=4).rows == result.rows
    # the page gives no year: the season does
    assert run(season={**SEASON, "year": 2027}).rows[1]["start"] == "2027-09-06T23:00"


def test_a_listing_on_two_lists_is_fetched_once_as_first_listed(serve):
    # a listing that runs past midnight is on two days' lists; the first it is on, the panel feed's, gives its type
    source = serve({("panel", "Sep  5"): [("a1", "Late")], ("panel", "Sep  6"): [("a1", "Late")],
                    ("gaming", "Sep  6"): [("a1", "Late")]}, {"a1": page(title="Late")})
    result = run()
    assert [(r["source_id"], r["type"]) for r in result.rows] == [("a1", "panel")]
    assert result.listings == 1 and source.details() == ["event/a1"]


# ---------------------------------------------------------------------------
# Failures and the rows carried from the previous file
# ---------------------------------------------------------------------------

def test_a_failed_page_with_no_row_to_carry_is_named_in_failures_alone(serve):
    lists, pages = panels("a1", "b2", "c3", "d4", "e5")
    pages["e5"] = requests.HTTPError("404 Client Error: Not Found for url: https://example.test/dc/event/e5")
    serve(lists, pages)
    result = run()                                        # 1 of 5 failing is the ceiling, not over it
    assert [r["source_id"] for r in result.rows] == ["a1", "b2", "c3", "d4"]
    assert result.failures == [
        {"source_id": "e5", "error": "404 Client Error: Not Found for url: https://example.test/dc/event/e5"}]
    assert (result.listings, result.fetched, result.carried_stale) == (5, 4, 0)


# The subject row, f9: its flag last run ("" for none), whether it is listed now, whether its page fails; its flag now.
@pytest.mark.parametrize("was, listed, fails, now", [
    ("", True, True, "stale"),                            # a failed page: carried stale
    ("stale", True, True, "stale"),                       # stale, failing again: stays stale
    ("removed", True, True, "stale"),                     # removed, listed again and failing: stale, not removed
    ("removed", True, False, ""),                         # removed, listed again: fetched fresh, the flag drops
    ("stale", True, False, ""),                           # stale, fetched again: the flag drops
    ("", False, False, "removed"),                        # gone: carried removed
    ("removed", False, False, "removed"),                 # removed, still gone: stays removed
    ("stale", False, False, "removed"),                   # stale, then gone: removed, not stale
], ids=["fresh-fails", "stale-fails", "removed-returns-failing", "removed-returns", "stale-returns",
        "fresh-goes", "removed-stays", "stale-goes"])
def test_a_carried_row_holds_its_fields_frozen_and_one_flag_at_most(serve, was, listed, fails, now):
    previous = {"f9": old("f9", stale=was == "stale", removed=was == "removed")}
    lists, pages = panels("a1", "b2", "c3", "d4", *(["f9"] if listed else []))
    pages["f9"] = requests.HTTPError("503 Server Error") if fails else page(title="Panel f9")
    serve(lists, pages)
    result = run(previous)
    row = next(r for r in result.rows if r["source_id"] == "f9")
    assert list(row) == RAW + ([now] if now else [])      # the flag last, and only where true
    if now:
        assert row[now] is True
        assert {k: row[k] for k in RAW} == {k: previous["f9"][k] for k in RAW}   # frozen at last sight
    else:
        assert row["title"] == "Panel f9" and row["speakers"] == []               # fetched fresh
    assert (result.carried_stale, result.carried_removed) == (int(now == "stale"), int(now == "removed"))
    assert [f["source_id"] for f in result.failures] == (["f9"] if fails else [])
    assert len(result.rows) == 5


def test_failures_are_sorted_by_source_id_and_hold_the_exception_s_text(serve):
    # f6 is listed, asked for and fails first, one worker at a time: the order is the sort's, not the fetch's
    lists, pages = panels("f6", "a1", "b2", "c3", "d4", "e5", "a7", "b8", "c9", "d0")
    pages["f6"] = requests.ConnectionError("Max retries exceeded with url: /dc/event/f6")
    pages["b2"] = requests.HTTPError("404 Client Error: Not Found for url: https://example.test/dc/event/b2")
    serve(lists, pages)
    assert run(workers=1).failures == [
        {"source_id": "b2", "error": "404 Client Error: Not Found for url: https://example.test/dc/event/b2"},
        {"source_id": "f6", "error": "Max retries exceeded with url: /dc/event/f6"}]


# ---------------------------------------------------------------------------
# Fatal
# ---------------------------------------------------------------------------

def test_a_day_list_that_fails_is_fatal(serve):
    lists, pages = panels("a1")
    lists[("gaming", "Sep  6")] = requests.HTTPError("500 Server Error: Internal Server Error")
    source = serve(lists, pages)
    with pytest.raises(scraper.FetchError, match=r"^the gaming day list for Sep 6 failed: 500 Server Error"):
        run()
    assert source.details() == []


def test_no_listings_is_fatal(serve):
    source = serve({}, {})
    with pytest.raises(scraper.FetchError, match=r"^no listings on the 4 day lists$"):
        run()
    assert source.details() == []


def test_listings_under_the_floor_of_the_previous_rows_not_removed_are_fatal(serve):
    # five rows not removed and five removed: the floor is 0.8 of five, 4 listings
    previous = {**{sid: old(sid) for sid in ("a1", "b2", "c3", "d4", "e5")},
                **{sid: old(sid, removed=True) for sid in ("f1", "f2", "f3", "f4", "f5")}}
    source = serve(*panels("a1", "b2", "c3"))
    with pytest.raises(scraper.FetchError, match=r"^3 listings, under listings_floor 0\.8 of the previous file's 5 "
                                                 r"rows not removed \(4\.0\)$"):
        run(previous)
    assert source.details() == []                         # refused before any detail page
    serve(*panels("a1", "b2", "c3", "d4"))
    assert run(previous).listings == 4                    # the floor itself is not under it
    serve(*panels("a1"))
    assert run().listings == 1                            # a season's first run has no floor


def test_failed_pages_over_the_ceiling_are_fatal(serve):
    lists, pages = panels("a1", "b2", "c3", "d4", "e5")
    pages["a1"] = pages["b2"] = requests.HTTPError("503 Server Error")
    serve(lists, pages)
    with pytest.raises(scraper.FetchError, match=r"^2 of 5 detail pages failed, over detail_failures 0\.2 of the "
                                                 r"listings \(1\.0\)$"):
        run()


def test_the_floor_and_the_ceiling_are_exact_to_the_fraction(serve):
    # As floats, 0.7 * 10 is 7.000000000000001 and 0.29 * 100 is 28.999999999999996: exactly 70% of the previous
    # rows would be under a 70% floor, and exactly 29% of the pages failing over a 29% ceiling.
    season = {**SEASON, "thresholds": {**SEASON["thresholds"], "listings_floor": 0.7, "detail_failures": 0.29}}
    ten = [f"a{n}" for n in range(10)]
    serve(*panels(*ten[:7]))
    assert run({sid: old(sid) for sid in ten}, season=season).listings == 7
    hundred = [f"{n:02x}" for n in range(100)]
    lists, pages = panels(*hundred)
    for sid in hundred[:29]:
        pages[sid] = requests.HTTPError("503 Server Error")
    serve(lists, pages)
    result = run(season=season)
    assert (len(result.failures), result.fetched) == (29, 71)


def test_every_page_parsing_to_an_empty_title_is_fatal(serve):
    lists = {("panel", "Sep  5"): [("a1", "Listed a1"), ("b2", "Listed b2")]}
    serve(lists, {"a1": page(title=None), "b2": page(title="")})
    with pytest.raises(scraper.FetchError, match=r"^all 2 detail pages fetched parsed to an empty title"):
        run()
    # one page with a title is enough, and a page without one takes the day list's
    serve(lists, {"a1": page(title=None), "b2": page(title="Panel b2")})
    assert [r["title"] for r in run().rows] == ["Listed a1", "Panel b2"]


def test_limit_takes_the_first_listings_in_page_order_and_the_floor_holds_it(serve):
    source = serve({("panel", "Sep  5"): [("c3", "C"), ("a1", "A")], ("panel", "Sep  6"): [("e5", "E")],
                    ("gaming", "Sep  5"): [("b2", "B")]},
                   {sid: page(title=sid) for sid in ("a1", "b2", "c3", "e5")})
    result = run(limit=2)
    assert [r["source_id"] for r in result.rows] == ["a1", "c3"] and result.listings == 2
    assert source.details() == ["event/a1", "event/c3"]
    # the run is as if the source listed only those: a previous row past the limit is gone, carried removed ...
    rows = {r["source_id"]: r for r in run({sid: old(sid) for sid in ("a1", "b2", "c3")}, limit=3).rows}
    assert sorted(rows) == ["a1", "b2", "c3", "e5"] and rows["b2"]["removed"] is True
    # ... and against a previous file of all four, two listings are under the floor
    with pytest.raises(scraper.FetchError, match=r"^2 listings, under listings_floor"):
        run({sid: old(sid) for sid in ("a1", "b2", "c3", "e5")}, limit=2)


# ---------------------------------------------------------------------------
# The repair
# ---------------------------------------------------------------------------

def test_the_repair_runs_before_whitespace_is_collapsed(serve, monkeypatch):
    # "Â" and a no-break space, as the source sends six 2026 card-game pages, and "â€“" and friends, as 45 more
    lists, pages = panels("a1")
    pages["a1"] = page(title="One Piece Sealed" + A_HAT + NBSP + "Draft",
                       location="Marriott A706" + A_HAT + NBSP,
                       paragraphs=("Best of 1." + A_HAT + NBSP + "<br/>Winner gets 2 packs.",
                                   "Tier 1" + DASH_MOJIBAKE + "5."),
                       speakers=[("Moderator", "Ren" + chr(0xC3) + chr(0xA9) + "e Martin")],
                       tracks=("Collectible Card Games", "Faer" + chr(0xC3) + chr(0xBB) + "n"))
    serve(lists, pages)
    result = run()
    row = result.rows[0]
    assert row["title"] == "One Piece Sealed Draft"      # the no-break space collapsed, and no "Â"
    assert row["location"] == "Marriott A706"
    assert row["description"] == "Best of 1.\nWinner gets 2 packs.\nTier 1" + DASH + "5."
    assert row["speakers"] == [{"name": "Ren" + chr(0xE9) + "e Martin", "role": "Moderator"}]
    assert row["tracks"] == ["Collectible Card Games", "Faer" + chr(0xFB) + "n"]
    assert A_HAT not in json.dumps(row, ensure_ascii=False)
    # the title, the location, the description - once, for two paragraphs - one name and one track
    assert result.repaired == 5

    # Repaired after clean(), it is too late where the no-break space ended a line: collapsing stripped it, and the
    # "Â" it leaves is past repair - the frozen 2026 file's "Best of 1.Â" and "Price: $35Â".
    monkeypatch.setattr(scraper, "repair", lambda text: text)
    late = run().rows[0]
    assert late["description"].startswith("Best of 1." + A_HAT + "\nWinner")
    assert late["location"] == "Marriott A706" + A_HAT
    assert ftfy.fix_encoding(late["description"]).startswith("Best of 1." + A_HAT)
    assert ftfy.fix_encoding(late["location"]) == late["location"]


def test_a_clean_page_reads_the_same_with_the_repair_and_without(serve, monkeypatch):
    # Curly quotes, an ellipsis, accents, a no-break space, a dash, an entity: fix_encoding leaves clean text as it
    # is, so a clean listing's tagger input, and its cache key, are what they were (#34).
    lists, pages = panels("a1")
    pages["a1"] = page(title="Ask a NASA Scientist " + DASH + " Q&amp;A",
                       paragraphs=("Engineers talk " + chr(0x201C) + "crewed" + chr(0x201D) + " missions" + chr(0x2026),
                                   "Faer" + chr(0xFB) + "n, Ren" + chr(0xE9) + "e" + NBSP + "and caf" + chr(0xE9) + "."),
                       speakers=[("Speaker", "Zo" + chr(0xEB) + " Chen")], tracks=("Space", "Science"))
    serve(lists, pages)
    repaired = run()
    monkeypatch.setattr(scraper, "repair", lambda text: text)
    unrepaired = run()
    assert repaired.repaired == 0 and repaired.rows == unrepaired.rows
    assert tag_key.tagger_input(repaired.rows[0]) == tag_key.tagger_input(unrepaired.rows[0])
    assert chr(0x201C) in repaired.rows[0]["description"]      # no quote uncurled


def test_the_day_list_s_title_is_repaired_and_counted_only_where_a_row_takes_it(serve):
    dirty = "Lorcana" + A_HAT + NBSP + "- Pack Rush"
    serve({("panel", "Sep  5"): [("a1", dirty), ("b2", dirty)]},
          {"a1": page(title=None), "b2": page(title="Lorcana - Pack Rush")})
    result = run()
    assert [r["title"] for r in result.rows] == ["Lorcana - Pack Rush", "Lorcana - Pack Rush"]
    assert result.repaired == 1                           # a1 took the day list's title; b2 had its own


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def test_the_file_is_compact_a_row_a_line_utf8_and_lf_with_no_timestamp(tmp_path):
    rows = [{**old("a1"), "title": "Tier 1" + DASH + "5"}, old("b2", stale=True)]
    failures = [{"source_id": "b2", "error": "boom"}]
    path = tmp_path / "source.json"
    scraper.write_source(str(path), BASE, failures, rows)
    data = path.read_bytes()
    lines = data.decode("utf-8").split("\n")
    assert lines[0] == '{"source":"https://example.test/dc","failures":[{"source_id":"b2","error":"boom"}],"rows":['
    assert lines[1] == json.dumps(rows[0], ensure_ascii=False, separators=(",", ":")) + ","
    assert lines[2] == json.dumps(rows[1], ensure_ascii=False, separators=(",", ":")) + "]}"
    assert lines[3:] == [""]                              # a line break ends the file
    assert b"\r" not in data and DASH.encode("utf-8") in data
    assert json.loads(data) == {"source": BASE, "failures": failures, "rows": rows}
    assert os.listdir(tmp_path) == ["source.json"]        # the file written beside it was swapped in
    scraper.write_source(str(path), BASE, failures, rows)
    assert path.read_bytes() == data                      # no timestamp: the same rows give the same bytes
    scraper.write_source(str(path), BASE, [], [])
    assert path.read_bytes() == b'{"source":"https://example.test/dc","failures":[],"rows":[]}\n'


# ---------------------------------------------------------------------------
# main()
# ---------------------------------------------------------------------------

def write_season(folder, **changes):
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "season.json"
    path.write_text(json.dumps({**SEASON, **changes}), encoding="utf-8")
    return str(path)


def call_main(monkeypatch, *argv):
    """scraper.main() on these arguments: None where it returns, else what it exits with. sys.exit() with a message
    prints it and exits 1."""
    monkeypatch.setattr(sys, "argv", ["scraper.py", *argv, "--delay", "0"])
    try:
        scraper.main()
    except SystemExit as exc:
        return exc.code
    return None


def test_main_refuses_a_frozen_season_unless_out_points_outside_its_folder(serve, monkeypatch, tmp_path):
    serve(*panels("a1"))
    season = write_season(tmp_path / "2026", frozen=True)
    for out in ([], ["--out", str(tmp_path / "2026" / "source.json")],
                ["--out", str(tmp_path / "2026" / "probe" / "source.json")]):
        assert "is frozen (DECISIONS #46)" in call_main(monkeypatch, "--season", season, *out)
    assert os.listdir(tmp_path / "2026") == ["season.json"]
    assert call_main(monkeypatch, "--season", season, "--out", str(tmp_path / "probe.json")) is None
    assert [r["source_id"] for r in json.loads((tmp_path / "probe.json").read_bytes())["rows"]] == ["a1"]
    # and the process exits 1, before any request
    run_ = subprocess.run([sys.executable, os.path.join(ROOT, "scraper.py"), "--season", season],
                          capture_output=True, text=True, encoding="utf-8")
    assert run_.returncode == 1 and "is frozen" in run_.stderr


def test_main_takes_the_previous_file_from_out_where_it_exists(serve, monkeypatch, tmp_path, capsys):
    season = write_season(tmp_path / "2027")
    serve(*panels("a1", "b2", "c3", "d4", "e5"))
    assert call_main(monkeypatch, "--season", season) is None      # --out: source.json beside the season file
    out = tmp_path / "2027" / "source.json"
    assert len(json.loads(out.read_bytes())["rows"]) == 5
    serve(*panels("a1", "b2", "c3", "d4"))                         # e5 is gone
    assert call_main(monkeypatch, "--season", season) is None
    rows = {r["source_id"]: r for r in json.loads(out.read_bytes())["rows"]}
    assert rows["e5"]["removed"] is True and "removed" not in rows["a1"]
    assert "Wrote 5 rows to" in capsys.readouterr().err


GOOD_ROW = json.dumps(old("a1"))


@pytest.mark.parametrize("content, says", [
    (None, "cannot be read"),
    ("{not json", "is not JSON"),
    ('{"rows": []}', "is not a source.json"),
    ('{"source": "https://example.test/other", "failures": [], "rows": []}',
     "is https://example.test/other's, not https://example.test/dc's"),
    ('{"source": "https://example.test/dc", "failures": [], "rows": [{"source_id": "a1"}]}',
     "holds a row that is not a raw row"),
    ('{"source": "https://example.test/dc", "failures": [], "rows": [' + GOOD_ROW + "," + GOOD_ROW + "]}",
     "holds a1 twice"),
], ids=["missing", "not-json", "not-a-source-file", "another-source", "not-a-raw-row", "a-row-twice"])
def test_main_refuses_a_previous_file_missing_malformed_or_another_source_s(serve, monkeypatch, tmp_path, content,
                                                                            says):
    serve(*panels("a1"))
    season = write_season(tmp_path / "2027")
    previous = tmp_path / "previous.json"
    if content is not None:
        previous.write_text(content, encoding="utf-8")
    exit_ = call_main(monkeypatch, "--season", season, "--previous", str(previous))
    assert exit_.startswith("FATAL: the previous file") and says in exit_ and exit_.endswith(". Nothing written.")
    assert not (tmp_path / "2027" / "source.json").exists()


def test_a_fatal_fetch_writes_nothing(serve, monkeypatch, tmp_path):
    season = write_season(tmp_path / "2027")
    out = tmp_path / "2027" / "source.json"
    serve(*panels("a1", "b2", "c3", "d4", "e5"))
    assert call_main(monkeypatch, "--season", season) is None
    before = out.read_bytes()
    serve({}, {})                                         # the source lists nothing
    assert call_main(monkeypatch, "--season", season) == "FATAL: no listings on the 4 day lists. Nothing written."
    assert out.read_bytes() == before
    assert sorted(os.listdir(tmp_path / "2027")) == ["season.json", "source.json"]
