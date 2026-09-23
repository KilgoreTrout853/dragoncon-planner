"""Parser tests. Fixtures mirror the markup observed on app.core-apps.com/dragoncon26.

Run:  python -m pytest tests/
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scraper  # noqa: E402

DAY_HTML = """
<div class="redux_list">
  <div class="section_header alt">Saturday, Sep  5</div>
  <div class="section_header">12:00 am</div>
  <div class="redux_list_item">
    <a class="object_link" href="/dragoncon26/event/6ecc75745a676d39f230055623a5ae38">
      <div class="line one">Critters</div>
      <div class="line two">
12:00 AM —  1:30 AM
</div>
    </a>
  </div>
  <div class="section_header">11:00 pm</div>
  <div class="redux_list_item">
    <a class="object_link" href="/dragoncon26/event/4f5d40b3cfde6b85b4ccbfe2be9a09bf">
      <div class="line one">Onesie Party</div>
      <div class="line two">11:00 PM — 1:00 AM</div>
    </a>
  </div>
</div>
"""

DETAIL_WITH_SPEAKERS = """
<div class="template_header"><h1 class="header_title">Pluribus: A Perfect World?</h1></div>
<div class="template_content">
  <div class="section"><div class="section_inner">
    <table class="table">
      <tr><td>Location</td><td><a href="/dragoncon26/places/x">Marriott M302-M303</a></td></tr>
      <tr><td>Date</td><td>Friday, Sep  4 11:30 AM</td></tr>
      <tr><td>Duration</td><td>1 hour</td></tr>
    </table>
    <a class="btn link-btn rating-btn">Rate Event</a>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <p>A world where becoming part of something greater may be the ultimate reward...or the end.</p>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <h2 class="section_heading">Speakers</h2>
    <div class="btn_list_holder"><ul class="btn_list">
      <li><div class="li_layout"><a class="content"><div class="li_btn_inner"><div class="li_inner_content">
        <div class="line one">Moderator</div><div class="line two">Kevin Bachelder</div><div class="line three"></div>
      </div></div></a></div></li>
      <li><div class="li_layout"><a class="content"><div class="li_btn_inner"><div class="li_inner_content">
        <div class="line one">Speaker</div><div class="line two">Jane Doe</div><div class="line three"></div>
      </div></div></a></div></li>
    </ul></div>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <h2 class="section_heading">Tracks</h2>
    <a class="btn link-btn" href="/dragoncon26/events/track/abc">American Sci-fi and Fantasy Media</a>
  </div></div>
</div>
"""

DETAIL_PANELISTS_TEXT = """
<div class="template_header"><h1 class="header_title">Onesie Party</h1></div>
<div class="template_content">
  <div class="section"><div class="section_inner">
    <table class="table">
      <tr><td>Location</td><td>Mart Building 3, Floor 1</td></tr>
      <tr><td>Date</td><td>Saturday, Sep  5 11:00 PM</td></tr>
      <tr><td>Duration</td><td>2 hours</td></tr>
    </table>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <p>Board games that take science seriously. Additional Panelists: Brian Kvito, James Wallace(Moderator), Gracie Palmer (Virtual)</p>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <h2 class="section_heading">Tracks</h2>
    <a class="btn link-btn">Table Top Gaming</a>
  </div></div>
</div>
"""


def test_day_list():
    items = scraper.parse_day_list(DAY_HTML)
    assert len(items) == 2
    assert items[0] == {"id": "6ecc75745a676d39f230055623a5ae38", "title": "Critters",
                        "time_text": "12:00 AM — 1:30 AM", "repaired": 0}
    assert items[1]["time_text"] == "11:00 PM — 1:00 AM"


def test_detail_with_speakers():
    d = scraper.parse_detail(DETAIL_WITH_SPEAKERS)
    assert d["title"] == "Pluribus: A Perfect World?"
    assert d["location"] == "Marriott M302-M303"
    assert d["date_text"] == "Friday, Sep 4 11:30 AM"
    assert d["duration_text"] == "1 hour"
    assert d["description"].startswith("A world where")
    assert d["speakers"] == [{"name": "Kevin Bachelder", "role": "Moderator"},
                             {"name": "Jane Doe", "role": "Speaker"}]
    assert d["tracks"] == ["American Sci-fi and Fantasy Media"]
    assert d["repaired"] == 0                   # clean text: the repair changes nothing


def test_build_event_basic():
    items = scraper.parse_day_list(DAY_HTML)
    ev = scraper.build_event(items[0], scraper.parse_detail(DETAIL_WITH_SPEAKERS), "panel", 2026)
    # the raw row (#42): no hotel, room, track or cancelled - they are later stages'
    assert list(ev) == ["source_id", "type", "title", "day", "start", "end", "duration_min", "location",
                        "description", "tracks", "speakers"]
    assert ev["source_id"] == "6ecc75745a676d39f230055623a5ae38" and ev["type"] == "panel"
    assert ev["title"] == "Pluribus: A Perfect World?"
    assert ev["day"] == "2026-09-04"
    assert ev["start"] == "2026-09-04T11:30"
    assert ev["end"] == "2026-09-04T12:30"
    assert ev["duration_min"] == 60
    assert ev["location"] == "Marriott M302-M303"    # verbatim: the split is build's venues step (#45)
    assert ev["tracks"] == ["American Sci-fi and Fantasy Media"]
    assert ev["speakers"] == [{"name": "Kevin Bachelder", "role": "Moderator"}, {"name": "Jane Doe", "role": "Speaker"}]


def test_build_event_crosses_midnight_and_leaves_the_panelist_line_alone():
    items = scraper.parse_day_list(DAY_HTML)
    ev = scraper.build_event(items[1], scraper.parse_detail(DETAIL_PANELISTS_TEXT), "gaming", 2026)
    assert ev["start"] == "2026-09-05T23:00"
    assert ev["end"] == "2026-09-06T01:00"
    assert ev["location"] == "Mart Building 3, Floor 1"
    # speakers is the Speakers section alone, and this page has none; the line is the parse step's (#42)
    assert ev["speakers"] == []
    assert ev["description"].endswith(
        "Additional Panelists: Brian Kvito, James Wallace(Moderator), Gracie Palmer (Virtual)")


def test_midnight_fallback_without_duration():
    items = scraper.parse_day_list(DAY_HTML)
    detail = scraper.parse_detail(DETAIL_PANELISTS_TEXT)
    detail["duration_text"] = ""
    ev = scraper.build_event(items[1], detail, "gaming", 2026)
    assert ev["end"] == "2026-09-06T01:00" and ev["duration_min"] == 120


def test_duration_parse():
    assert scraper.parse_duration("11 hours 55 minutes") == 715
    assert scraper.parse_duration("10 minutes") == 10
    assert scraper.parse_duration("5 hours") == 300
    assert scraper.parse_duration("") is None


# ---------------------------------------------------------------------------
# Descriptions: read once, with the line breaks the page had
# ---------------------------------------------------------------------------

# Verbatim shape of a gaming event page: a <p> opened inside a <p> that is
# never closed, and <br> between lines. html.parser nests the paragraphs.
DETAIL_NESTED_P = """
<div class="template_header"><h1 class="header_title">CMP 2083-16: War Never Changes</h1></div>
<div class="template_content">
  <div class="section"><div class="section_inner">
    <table class="table">
      <tr><td>Location</td><td>Mart Building 3, Floor 2</td></tr>
      <tr><td>Date</td><td>Saturday, Sep  5 9:00 AM</td></tr>
      <tr><td>Duration</td><td>5 hours</td></tr>
    </table>
  </div></div>
  <div class="section section-about"><div class="section_inner">
    <p class="{PCLASS}" data-item-id="{IID}" id="{PID}"><p><strong><u>A Shadowrun Missions Event for Characters of Any Karma</u></strong><br/>The runners are surprise guest stars.<br/><br/>Bring a character.</p>
  </div></div>
</div>
"""


def test_nested_paragraph_is_read_once_with_its_line_breaks():
    d = scraper.parse_detail(DETAIL_NESTED_P)
    assert d["description"] == (
        "A Shadowrun Missions Event for Characters of Any Karma\n"
        "The runners are surprise guest stars.\n"
        "Bring a character.")
    assert d["description"].count("Shadowrun") == 1


def test_plain_paragraphs_still_join_on_newlines():
    d = scraper.parse_detail(DETAIL_WITH_SPEAKERS)
    assert d["description"] == "A world where becoming part of something greater may be the ultimate reward...or the end."


# ---------------------------------------------------------------------------
# Start time: the page gives no year, so the parse takes the season's
# ---------------------------------------------------------------------------

def test_parse_start_reads_all_three_date_shapes():
    want = dt.datetime(2026, 9, 5, 11, 30)
    assert scraper.parse_start("Saturday, Sep  5 11:30 AM", 2026) == want   # as the page has it
    assert scraper.parse_start("Sat, Sep 5 11:30 AM", 2026) == want
    assert scraper.parse_start("Sep 5 11:30 AM", 2026) == want
    assert scraper.parse_start("Monday, Sep  7 12:00 AM", 2026) == dt.datetime(2026, 9, 7, 0, 0)
    assert scraper.parse_start("Sunday, Sep  6 12:15 PM", 2026) == dt.datetime(2026, 9, 6, 12, 15)
    # The weekday name is read but never checked against the date.
    assert scraper.parse_start("Friday, Sep  5 11:30 AM", 2026) == want
    # The year is the season's, not the scraper's.
    assert scraper.parse_start("Wednesday, Sep  1 11:30 AM", 2027) == dt.datetime(2027, 9, 1, 11, 30)


def test_parse_start_returns_none_for_what_it_cannot_read():
    for txt in ("", None, "TBA", "Saturday", "Sep 5", "11:30 AM", "Sep 31 1:00 PM",
                "Saturday, Sep 5 11:30", "Saturday, Sep 5 2026 11:30 AM",
                "Saturday, Sep 5 11:30 AM 2026", "2026 Sep 5 11:30 AM"):
        assert scraper.parse_start(txt, 2026) is None, txt
