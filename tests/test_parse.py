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


# ---------------------------------------------------------------------------
# Duplicate merging
# ---------------------------------------------------------------------------

def _ev(eid, **kw):
    """A minimal event; the merge only looks at these fields."""
    e = {"id": eid, "type": "panel", "title": "Quick & Easy Board Games",
         "start": "2026-09-05T13:00", "room": "A707", "location": "Hyatt A707",
         "tracks": [], "track": None, "speakers": [], "description": "", "cancelled": False}
    e.update(kw)
    return e


def test_dedupe_panel_and_gaming_pair_becomes_one_panel():
    out, merged, removed = scraper.dedupe([
        _ev("b", type="gaming", tracks=["Table Top Gaming"]),
        _ev("a", type="panel", tracks=["Main Programming"]),
    ])
    assert len(out) == 1 and merged == 1 and removed == 1
    assert out[0]["type"] == "panel"          # a panel cross-listed in gaming is a panel
    assert out[0]["id"] == "a"                # smallest id survives


def test_dedupe_keeps_the_copy_that_has_speakers():
    people = [{"name": "Karl Urban", "role": "Speaker"}]
    out, _, _ = scraper.dedupe([_ev("a", speakers=[]), _ev("b", speakers=people)])
    assert len(out) == 1
    assert [p["name"] for p in out[0]["speakers"]] == ["Karl Urban"]
    assert out[0]["id"] == "a"                # survivor keeps its id, gains the speakers


def test_dedupe_unions_speakers_in_order_of_first_appearance():
    out, _, _ = scraper.dedupe([
        _ev("a", speakers=[{"name": "Ann", "role": "Speaker"}, {"name": "Bo", "role": "Speaker"}]),
        _ev("b", speakers=[{"name": "Bo", "role": "Moderator"}, {"name": "Cy", "role": "Speaker"}]),
    ])
    assert [p["name"] for p in out[0]["speakers"]] == ["Ann", "Bo", "Cy"]
    assert out[0]["speakers"][1]["role"] == "Speaker"   # first appearance wins


def test_dedupe_unions_tracks_and_takes_the_first():
    out, _, _ = scraper.dedupe([
        _ev("a", tracks=["Trek Track"], track="Trek Track"),
        _ev("b", tracks=["Science"], track="Science"),
    ])
    assert out[0]["tracks"] == ["Trek Track", "Science"]
    assert out[0]["track"] == "Trek Track"


def test_dedupe_takes_the_longest_description():
    out, _, _ = scraper.dedupe([
        _ev("a", description="Short."),
        _ev("b", description="A considerably longer description of the same panel."),
    ])
    assert out[0]["description"] == "A considerably longer description of the same panel."


def test_dedupe_carries_tags_from_whichever_copy_has_them():
    tags = {"fandoms": ["Star Trek"], "kind": "panel", "topics": [], "adult": False, "guests": "fan"}
    # the tagged copy is NOT the one whose id survives
    out, _, _ = scraper.dedupe([_ev("a"), _ev("b", tags=tags)])
    assert out[0]["id"] == "a"
    assert out[0]["tags"] == tags


def test_dedupe_cancelled_is_sticky():
    out, _, _ = scraper.dedupe([_ev("a", cancelled=False), _ev("b", cancelled=True)])
    assert out[0]["cancelled"] is True


def test_dedupe_group_of_three_collapses_to_one():
    out, merged, removed = scraper.dedupe([
        _ev("c", type="gaming"), _ev("a", speakers=[{"name": "Ann", "role": "Speaker"}]),
        _ev("b", tracks=["Science"]),
    ])
    assert len(out) == 1 and merged == 1 and removed == 2
    assert out[0]["id"] == "a"
    assert [p["name"] for p in out[0]["speakers"]] == ["Ann"]


def test_dedupe_is_deterministic_across_input_order():
    a, b, c = _ev("c"), _ev("a"), _ev("b")
    first, _, _ = scraper.dedupe([a, b, c])
    second, _, _ = scraper.dedupe([c, b, a])
    assert first[0]["id"] == second[0]["id"] == "a"


def test_dedupe_normalises_title_room_whitespace_and_punctuation():
    out, merged, _ = scraper.dedupe([
        _ev("a", title="Quick & Easy Board Games", room="A707"),
        _ev("b", title="quick &  easy board games.", room=" a707 "),
    ])
    assert merged == 1 and len(out) == 1


def test_dedupe_leaves_genuinely_different_events_alone():
    out, merged, removed = scraper.dedupe([
        _ev("a"),
        _ev("b", start="2026-09-05T14:00"),      # different time
        _ev("c", room="A708"),                   # different room
        _ev("d", title="Something Else"),        # different title
    ])
    assert len(out) == 4 and merged == 0 and removed == 0


def test_dedupe_sorts_by_start_then_title():
    out, _, _ = scraper.dedupe([
        _ev("a", title="Zebra", start="2026-09-05T14:00"),
        _ev("b", title="Apple", start="2026-09-05T14:00"),
        _ev("c", title="Early", start="2026-09-05T09:00"),
    ])
    assert [e["title"] for e in out] == ["Early", "Apple", "Zebra"]


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
# Cancelled: only when the event says so up front
# ---------------------------------------------------------------------------

def test_cancelled_when_the_title_or_opening_line_says_so():
    assert scraper.is_cancelled("CANCELLED: Trek Trivia", "") is True
    assert scraper.is_cancelled("Canceled - Trek Trivia", "") is True
    assert scraper.is_cancelled("Trek Trivia (Cancelled)", "") is True
    assert scraper.is_cancelled("Trek Trivia - CANCELLED", "") is True
    assert scraper.is_cancelled("Trek Trivia", "This event has been cancelled.") is True
    assert scraper.is_cancelled("Trek Trivia", "CANCELLED: the guest could not travel.") is True


def test_a_panel_about_cancellations_is_not_cancelled():
    # All three were struck through by the old anywhere-in-the-text match.
    assert scraper.is_cancelled(
        "Hopes, Dreams, & Cancellations: The MSFM Festivus Panel",
        "'Reboot incoming!' CANCELLED. 'A new & reimagined' CANCELLED. How many times have we heard it?") is False
    assert scraper.is_cancelled(
        "Classic TV Table Read: Manimal",
        "we shouldn't devote valuable schedule space to a silly show canceled in 1983") is False
    assert scraper.is_cancelled(
        "Doctor Who: Into the Wilderness Years?",
        "So, the 2026 Doctor Who Christmas special has been cancelled, and the show has been put on hiatus") is False


def test_build_event_uses_the_narrow_cancelled_rule():
    items = scraper.parse_day_list(DAY_HTML)
    detail = scraper.parse_detail(DETAIL_WITH_SPEAKERS)
    detail["description"] = "A show canceled in 1983, revisited with love."
    assert scraper.build_event(items[0], detail, "panel")["cancelled"] is False
    detail["title"] = "CANCELLED: " + detail["title"]
    assert scraper.build_event(items[0], detail, "panel")["cancelled"] is True


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
