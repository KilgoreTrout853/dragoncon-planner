"""Parser tests. Fixtures mirror the markup observed on app.core-apps.com/dragoncon26.

Run:  python -m pytest tests/ -q     (or)   python tests/test_parse.py
"""
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
                        "time_text": "12:00 AM — 1:30 AM"}
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


def test_build_event_basic():
    items = scraper.parse_day_list(DAY_HTML)
    ev = scraper.build_event(items[0], scraper.parse_detail(DETAIL_WITH_SPEAKERS), "panel")
    assert ev["day"] == "2026-09-04"
    assert ev["start"] == "2026-09-04T11:30"
    assert ev["end"] == "2026-09-04T12:30"
    assert ev["duration_min"] == 60
    assert ev["hotel"] == "Marriott" and ev["room"] == "M302-M303"
    assert ev["track"] == "American Sci-fi and Fantasy Media"
    assert ev["cancelled"] is False


def test_build_event_midnight_and_panelists():
    items = scraper.parse_day_list(DAY_HTML)
    ev = scraper.build_event(items[1], scraper.parse_detail(DETAIL_PANELISTS_TEXT), "gaming")
    assert ev["start"] == "2026-09-05T23:00"
    assert ev["end"] == "2026-09-06T01:00"
    assert ev["hotel"] == "AmericasMart"
    assert ev["room"] == "Mart Building 3, Floor 1"
    assert [s["name"] for s in ev["speakers"]] == ["Brian Kvito", "James Wallace", "Gracie Palmer"]
    assert [s["role"] for s in ev["speakers"]] == ["Panelist", "Moderator", "Virtual"]


def test_midnight_fallback_without_duration():
    items = scraper.parse_day_list(DAY_HTML)
    detail = scraper.parse_detail(DETAIL_PANELISTS_TEXT)
    detail["duration_text"] = ""
    ev = scraper.build_event(items[1], detail, "gaming")
    assert ev["end"] == "2026-09-06T01:00" and ev["duration_min"] == 120


def test_hotel_mapping():
    cases = {
        "Hilton 202": ("Hilton", "202"),
        "Hyatt Grand Hall C": ("Hyatt", "Grand Hall C"),
        "Courtland Grand Capitol Ballroom": ("Courtland Grand", "Grand Capitol Ballroom"),
        "Westin Chastain F": ("Westin", "Chastain F"),
        "Mart2 Vendor Hall Floor 3": ("AmericasMart", "Mart2 Vendor Hall Floor 3"),
        "Hardy Ivy Structure": ("Hardy Ivy Park", "Ivy Structure"),
        "Streaming STRM_TWITCH https://twitch.tv/x": ("Streaming", "STRM_TWITCH https://twitch.tv/x"),
        "": ("Unknown", ""),
    }
    for loc, expected in cases.items():
        assert scraper.split_hotel(loc) == expected, loc


def test_duration_parse():
    assert scraper.parse_duration("11 hours 55 minutes") == 715
    assert scraper.parse_duration("10 minutes") == 10
    assert scraper.parse_duration("5 hours") == 300
    assert scraper.parse_duration("") is None


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
