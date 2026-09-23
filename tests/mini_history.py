"""The five-version mini-history that tests/test_ids_stage.py runs through scraper.carry() and ids_stage.assign(), and
tests/test_replay_2026.py through the replay: each version a stamp and its events, in the frozen 2026 file's shape -
`id` and the ten fields a raw row holds. Not a test file: pytest does not collect it.

    v1  seeds the ledger: a lone session c1, a panel w1, a panel u1 in the Salon, three copies s1-s3, two copies
        t1-t2, and two events m1 and m2 whose titles differ in their spacing
    v2  drops c1 and w1, and swaps u1 for u2 at the same start in the same room, written "Hilton-Salon" this time,
        under a new title: an UNSURE pair, the title its one differing part
    v3  brings w1 back under its own id, and renames s3 alone: {s1, s2} keep s1, and s3 leaves under its own id
    v4  lists c9 with c1's key, a match across the v2-v3 gap; moves t1 alone to a new start, so the tie goes to t2's
        side by the ledger's key and t1 leaves as t1.1; and gives m2 m1's title, a collision: m2 is merged into m1
    v5  drops s2, as the 2026 dedupe dropped copies: no id changes
"""
import datetime as dt

STAMPS = ("2026-09-01T18:00:00+00:00", "2026-09-01T21:00:00+00:00", "2026-09-02T00:00:00+00:00",
          "2026-09-02T03:00:00+00:00", "2026-09-02T06:00:00+00:00")

# (title, start, location)
CALLIS = ("Photo Session: James Callis Solo", "2026-09-04T13:50", "Marriott International Hall South")
WELLING = ("Photo Session: Tom Welling Solo", "2026-09-06T14:50", "Marriott International Hall South")
SALON = ("Hazbin Hotel Cast", "2026-09-06T16:00", "Hilton Salon")
SALON_NEW = ("Meet the Hellaverse Cast", "2026-09-06T16:00", "Hilton-Salon")
SCIENCE = ("Gaming with Science", "2026-09-05T14:30", "Westin Augusta 3")
SCIENCE_RENAMED = ("Gaming with Science: Wingspan", "2026-09-05T14:30", "Westin Augusta 3")
ROUND_UP = ("Board Game Round Up", "2026-09-06T10:00", "Westin Augusta 1-2")
ROUND_UP_MOVED = ("Board Game Round Up", "2026-09-06T11:30", "Westin Augusta 1-2")
TREK = ("Star Trek Actors Q&A", "2026-09-07T10:00", "Marriott Atrium Ballroom")
TREK_SPACED = ("Star Trek Actors Q & A", "2026-09-07T10:00", "Marriott Atrium Ballroom")

EVENTS = [
    [("c1", CALLIS), ("w1", WELLING), ("u1", SALON), ("s1", SCIENCE), ("s2", SCIENCE), ("s3", SCIENCE),
     ("t1", ROUND_UP), ("t2", ROUND_UP), ("m1", TREK), ("m2", TREK_SPACED)],
    [("u2", SALON_NEW), ("s1", SCIENCE), ("s2", SCIENCE), ("s3", SCIENCE), ("t1", ROUND_UP), ("t2", ROUND_UP),
     ("m1", TREK), ("m2", TREK_SPACED)],
    [("w1", WELLING), ("u2", SALON_NEW), ("s1", SCIENCE), ("s2", SCIENCE), ("s3", SCIENCE_RENAMED), ("t1", ROUND_UP),
     ("t2", ROUND_UP), ("m1", TREK), ("m2", TREK_SPACED)],
    [("c9", CALLIS), ("w1", WELLING), ("u2", SALON_NEW), ("s1", SCIENCE), ("s2", SCIENCE), ("s3", SCIENCE_RENAMED),
     ("t1", ROUND_UP_MOVED), ("t2", ROUND_UP), ("m1", TREK), ("m2", TREK)],
    [("c9", CALLIS), ("w1", WELLING), ("u2", SALON_NEW), ("s1", SCIENCE), ("s3", SCIENCE_RENAMED),
     ("t1", ROUND_UP_MOVED), ("t2", ROUND_UP), ("m1", TREK), ("m2", TREK)],
]


def event(i, title, start, location):
    """An event in the frozen file's shape: `id` and the ten fields a raw row holds."""
    end = dt.datetime.fromisoformat(start) + dt.timedelta(minutes=60)
    return {"id": i, "type": "panel", "title": title, "day": start[:10], "start": start,
            "end": end.strftime("%Y-%m-%dT%H:%M"), "duration_min": 60, "location": location,
            "description": f"About {title}.", "tracks": ["Mini"], "speakers": []}


def versions():
    """The five versions, fresh: [{generated_at, events}], as a committed schedule holds them."""
    return [{"generated_at": stamp, "events": [event(i, *what) for i, what in events]}
            for stamp, events in zip(STAMPS, EVENTS)]
