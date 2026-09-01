#!/usr/bin/env python3
"""Dragon Con 2026 schedule scraper.

Pulls every event (panels + gaming) from the web version of the official
Dragon Con app (app.core-apps.com/dragoncon26) and writes events.json for
index.html to read.

Usage:
    python scraper.py                 # full scrape (~3,600 events, a few minutes)
    python scraper.py --limit 30      # smoke test: first 30 events only
    python scraper.py --days "Sep  5" # one day only (note the two spaces)
    python scraper.py --workers 4     # be gentler on the server

Requires: requests, beautifulsoup4
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://app.core-apps.com/dragoncon26"
YEAR = 2026
# The app uses two spaces between month and single-digit day ("Sep  5").
DAYS = ["Sep  2", "Sep  3", "Sep  4", "Sep  5", "Sep  6", "Sep  7"]
# "Events" module (panels etc.) has no type param; "Gaming Events" is type=Entertainment.
TYPES = {"panel": None, "gaming": "Entertainment"}
HEADERS = {"User-Agent": "dragoncon-planner/1.0 (personal schedule tool; polite, low volume)"}
OUTPUT = "events.json"

# Location strings start with the venue name. Map the first token to a canonical hotel.
HOTEL_PREFIXES = [
    ("marriott", "Marriott"),
    ("hyatt", "Hyatt"),
    ("hilton", "Hilton"),
    ("courtland", "Courtland Grand"),
    ("sheraton", "Courtland Grand"),
    ("westin", "Westin"),
    ("mart", "AmericasMart"),
    ("americasmart", "AmericasMart"),
    ("hardy", "Hardy Ivy Park"),
    ("streaming", "Streaming"),
    ("virtual", "Streaming"),
    ("online", "Streaming"),
]


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    # 403 is how this host signals rate limiting, so it must be retried like 429;
    # without it the first throttle turns every remaining fetch into an instant failure.
    retry = Retry(total=8, backoff_factor=1.5, backoff_jitter=1.0,
                  status_forcelist=(403, 429, 500, 502, 503, 504),
                  respect_retry_after_header=True)
    s.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=16))
    return s


def get(session, path, params=None):
    r = session.get(f"{BASE}/{path}", params=params, timeout=30)
    r.raise_for_status()
    return r.text


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_day_list(html):
    """Day page -> list of {id, title, time_text}.

    Structure: div.redux_list > div.redux_list_item > a.object_link[href=/dragoncon26/event/<id>]
                  > div.line.one (title), div.line.two ("11:30 AM — 12:30 PM")
    """
    soup = BeautifulSoup(html, "html.parser")
    items = []
    for item in soup.select("div.redux_list_item"):
        a = item.select_one("a.object_link[href]")
        if not a:
            continue
        m = re.search(r"/event/([0-9a-f]+)", a["href"])
        if not m:
            continue
        title = a.select_one(".line.one")
        when = a.select_one(".line.two")
        items.append({
            "id": m.group(1),
            "title": clean(title.get_text()) if title else "",
            "time_text": clean(when.get_text()) if when else "",
        })
    return items


def parse_detail(html):
    """Event page -> dict of raw fields.

    Structure:
      div.template_header > h1.header_title                      title
      div.template_content > div.section
         table.table tr > td(label), td(value)                     Location / Date / Duration
         (section with no heading) p                                description
         h2.section_heading "Speakers" + ul.btn_list li            .line.one role, .line.two name
         h2.section_heading "Tracks" + a.btn.link-btn              track name(s)
    """
    soup = BeautifulSoup(html, "html.parser")
    out = {"title": "", "location": "", "date_text": "", "duration_text": "",
           "description": "", "speakers": [], "tracks": []}

    h1 = soup.select_one("h1.header_title")
    if h1:
        out["title"] = clean(h1.get_text())

    content = soup.select_one("div.template_content") or soup

    for tr in content.select("table tr"):
        tds = tr.find_all("td")
        if len(tds) >= 2:
            label = clean(tds[0].get_text()).lower()
            value = clean(tds[1].get_text())
            if label == "location":
                out["location"] = value
            elif label == "date":
                out["date_text"] = value
            elif label == "duration":
                out["duration_text"] = value

    for section in content.select("div.section"):
        heading = section.select_one("h2.section_heading")
        name = clean(heading.get_text()) if heading else ""
        if not heading:
            paras = [clean(p.get_text()) for p in section.select("p")]
            paras = [p for p in paras if p]
            if paras and not out["description"]:
                out["description"] = "\n".join(paras)
        elif name.lower() == "speakers":
            for li in section.select("li"):
                role = li.select_one(".line.one")
                who = li.select_one(".line.two")
                if who and clean(who.get_text()):
                    out["speakers"].append({
                        "name": clean(who.get_text()),
                        "role": clean(role.get_text()) if role else "",
                    })
        elif name.lower() == "tracks":
            out["tracks"] = [clean(a.get_text()) for a in section.select("a") if clean(a.get_text())]

    return out


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def parse_start(date_text):
    """'Saturday, Sep  5 11:30 AM' -> datetime (naive, local Atlanta time)."""
    txt = clean(date_text)
    for fmt in ("%A, %b %d %I:%M %p", "%a, %b %d %I:%M %p", "%b %d %I:%M %p"):
        try:
            return dt.datetime.strptime(txt, fmt).replace(year=YEAR)
        except ValueError:
            pass
    return None


def parse_duration(duration_text):
    """'1 hour 30 minutes' -> 90. Returns None if nothing parseable."""
    hours = re.search(r"(\d+)\s*hour", duration_text or "")
    mins = re.search(r"(\d+)\s*min", duration_text or "")
    if not hours and not mins:
        return None
    return (int(hours.group(1)) * 60 if hours else 0) + (int(mins.group(1)) if mins else 0)


def parse_time_range(time_text):
    """'11:00 PM — 1:00 AM' -> ('11:00 PM', '1:00 AM')."""
    parts = re.split(r"\s*[—–-]\s*", time_text or "")
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return None, None


def split_hotel(location):
    loc = clean(location)
    first = re.split(r"[\s,]", loc, maxsplit=1)[0].lower().rstrip("0123456789") if loc else ""
    for prefix, hotel in HOTEL_PREFIXES:
        if first.startswith(prefix):
            room = loc[len(re.split(r"[\s,]", loc, maxsplit=1)[0]):].strip(" ,")
            # Keep building numbers like "Mart2" / "Mart Building 3" readable.
            if hotel == "AmericasMart":
                room = clean(loc)
            return hotel, room or loc
    return ("Other" if loc else "Unknown"), loc


PANELIST_RE = re.compile(r"Additional Panelists?\s*:\s*(.+)$", re.IGNORECASE | re.DOTALL)


def extract_panelists(description):
    """Descriptions often end with 'Additional Panelists: A, B(Moderator), C (Virtual)'."""
    m = PANELIST_RE.search(description or "")
    if not m:
        return []
    names = []
    for raw in re.split(r",\s*", m.group(1).strip().rstrip(".")):
        raw = clean(raw)
        if not raw:
            continue
        role = re.search(r"\((moderator|virtual|host|panelist)\)", raw, re.IGNORECASE)
        name = re.sub(r"\s*\((moderator|virtual|host|panelist)\)\s*", " ", raw, flags=re.IGNORECASE).strip()
        names.append({"name": name, "role": role.group(1).title() if role else "Panelist"})
    return names


def build_event(list_item, detail, kind):
    start = parse_start(detail["date_text"])
    duration = parse_duration(detail["duration_text"])
    range_start, range_end = parse_time_range(list_item["time_text"])

    end = None
    if start and duration is not None:
        end = start + dt.timedelta(minutes=duration)
    elif start and range_end:
        try:
            t = dt.datetime.strptime(range_end, "%I:%M %p").time()
            end = dt.datetime.combine(start.date(), t)
            if end <= start:  # crossed midnight
                end += dt.timedelta(days=1)
            duration = int((end - start).total_seconds() // 60)
        except ValueError:
            pass

    hotel, room = split_hotel(detail["location"])
    title = detail["title"] or list_item["title"]
    description = detail["description"]
    speakers = detail["speakers"] or extract_panelists(description)
    flagged = bool(re.search(r"\bcancel+ed\b", title + " " + description, re.IGNORECASE))

    return {
        "id": list_item["id"],
        "type": kind,
        "title": title,
        "day": start.strftime("%Y-%m-%d") if start else None,
        "start": start.strftime("%Y-%m-%dT%H:%M") if start else None,
        "end": end.strftime("%Y-%m-%dT%H:%M") if end else None,
        "duration_min": duration,
        "location": detail["location"],
        "hotel": hotel,
        "room": room,
        "description": description,
        "tracks": detail["tracks"],
        "track": detail["tracks"][0] if detail["tracks"] else "",
        "speakers": speakers,
        "cancelled": flagged,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def scrape(days, workers, limit, delay):
    session = make_session()

    # 1. Day lists: 6 days x 2 modules = 12 pages.
    listings = {}
    for kind, type_param in TYPES.items():
        for day in days:
            params = {"day": day}
            if type_param:
                params["type"] = type_param
            html = get(session, "events/view_by_day", params)
            items = parse_day_list(html)
            for it in items:
                # An id can appear under two days if it straddles midnight; keep first.
                listings.setdefault(it["id"], {**it, "kind": kind})
            print(f"  {kind:6s} {day.replace('  ', ' ')}: {len(items):4d} events", file=sys.stderr)
            time.sleep(delay)

    ids = list(listings)
    if limit:
        ids = ids[:limit]
    print(f"Fetching {len(ids)} detail pages with {workers} workers...", file=sys.stderr)

    # 2. Detail pages, politely parallel.
    events, failures = [], []

    def fetch_one(eid):
        time.sleep(delay)
        return eid, get(session, f"event/{eid}")

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fetch_one, eid) for eid in ids]
        for fut in as_completed(futures):
            try:
                eid, html = fut.result()
                item = listings[eid]
                events.append(build_event(item, parse_detail(html), item["kind"]))
            except Exception as exc:  # noqa: BLE001
                failures.append(str(exc))
            done += 1
            if done % 200 == 0 or done == len(ids):
                print(f"  {done}/{len(ids)}", file=sys.stderr)

    events.sort(key=lambda e: (e["start"] or "9999", e["title"]))
    return events, failures


def load_previous(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", nargs="*", default=DAYS, help='e.g. "Sep  5" (two spaces)')
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0, help="only fetch the first N detail pages")
    ap.add_argument("--delay", type=float, default=0.15, help="seconds to sleep before each request")
    ap.add_argument("--out", default=OUTPUT)
    args = ap.parse_args()

    started = time.time()
    events, failures = scrape(args.days, args.workers, args.limit, args.delay)

    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    previous = load_previous(args.out)

    # Keep tags from tag_events.py across refreshes (matched by event id).
    prev_tags = {e["id"]: e["tags"] for e in (previous or {}).get("events", []) if e.get("tags")}
    for e in events:
        if e["id"] in prev_tags:
            e["tags"] = prev_tags[e["id"]]
    if prev_tags:
        untagged = sum(1 for e in events if not e.get("tags"))
        print(f"Carried over tags for {len(events) - untagged} events; {untagged} new/untagged "
              f"(run tag_events.py to tag them)", file=sys.stderr)

    changed_at = now
    if previous and previous.get("events") == events:
        changed_at = previous.get("changed_at", now)

    payload = {
        "generated_at": now,
        "changed_at": changed_at,
        "source": BASE,
        "count": len(events),
        "failures": len(failures),
        "events": events,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(args.out) // 1024
    print(f"Wrote {len(events)} events to {args.out} ({size_kb} KB) in {time.time() - started:.0f}s",
          file=sys.stderr)
    if failures:
        print(f"WARNING: {len(failures)} detail pages failed, e.g. {failures[0]}", file=sys.stderr)
    if not events:
        sys.exit("No events parsed - the site layout may have changed.")


if __name__ == "__main__":
    main()
