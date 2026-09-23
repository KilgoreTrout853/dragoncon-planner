#!/usr/bin/env python3
"""The fetch stage (DECISIONS #41, #42, #44; docs/pipeline/contract.md): every listing a year's source serves, as a
raw row, into the year's source.json.

    python scraper.py --season data/2027/season.json                  # every listing -> data/2027/source.json
    python scraper.py --season data/2027/season.json --workers 2      # gentler on the server

The source is the web view of the official Dragon Con app, app.core-apps.com/<slug>. The season file gives its base
URL, its day strings and the year. The day lists - each day, panels and gaming - give the listings, and each
listing's detail page its row: the page's fields, normalised in shape and not in content. `location` is the page's
cell as it is, `speakers` the Speakers section alone, and there is no hotel, room, track or cancelled: those are
later stages'. The text is repaired before any whitespace is collapsed (`repair`).

--out defaults to source.json beside the season file, and --previous to --out where it exists. The previous file's
rows are carried forward - `stale` where a detail page failed, `removed` where a listing is gone - and set the
listings floor. --limit N takes the first N listings in page order, and the run is then as if the source listed
only those, so the floor refuses a limited run against a full previous file. A frozen season (#46) is refused
unless --out points outside its folder, which is how the 2026 source is probed:

    python scraper.py --season data/2026/season.json --limit 60 --out /tmp/probe.json

A fatal fetch (FetchError: a day list that fails, no listings, listings under the floor, failed detail pages over
the ceiling, every page parsing to an empty title) writes nothing and exits 1, as does a --previous that is missing,
malformed or another source's.

Requires: requests, beautifulsoup4, ftfy (requirements.txt)
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from decimal import Decimal

import ftfy
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from season import SeasonError, load as load_season

# "Events" module (panels etc.) has no type param; "Gaming Events" is type=Entertainment.
TYPES = {"panel": None, "gaming": "Entertainment"}
HEADERS = {"User-Agent": "dragoncon-planner/1.0 (personal schedule tool; polite, low volume)"}
# The raw row (#42), in the order it is written; `stale` or `removed` follows, only where true.
ROW_FIELDS = ("source_id", "type", "title", "day", "start", "end", "duration_min", "location", "description",
              "tracks", "speakers")


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


def get(session, base, path, params=None):
    r = session.get(f"{base}/{path}", params=params, timeout=30)
    r.raise_for_status()
    return r.text


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_day_list(html):
    """Day page -> list of {id, title, time_text, repaired}.

    Structure: div.redux_list > div.redux_list_item > a.object_link[href=/<slug>/event/<id>]
                  > div.line.one (title), div.line.two ("11:30 AM — 12:30 PM")

    The title is repaired as a detail page's is (`read_text`), and `repaired` is 1 where that changed it. A row
    takes this title only where its detail page has none, and the fetch counts the repair only then.
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
        title, repaired = read_text(a.select_one(".line.one"))
        when = a.select_one(".line.two")
        items.append({
            "id": m.group(1),
            "title": title,
            "time_text": clean(when.get_text()) if when else "",
            "repaired": repaired,
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

    The title, the location, the description, each track and each speaker's name are repaired before their
    whitespace is collapsed (`repair`); the labels, the date, the duration and the roles are read as they are.
    `repaired` counts the strings kept that the repair changed: the title, the location, the description - once,
    however many of its paragraphs it changed - each track and each name.
    """
    soup = BeautifulSoup(html, "html.parser")
    out = {"title": "", "location": "", "date_text": "", "duration_text": "",
           "description": "", "speakers": [], "tracks": [], "repaired": 0}
    fixed = {"title": 0, "location": 0, "description": 0, "speakers": 0, "tracks": 0}

    out["title"], fixed["title"] = read_text(soup.select_one("h1.header_title"))

    content = soup.select_one("div.template_content") or soup

    for tr in content.select("table tr"):
        tds = tr.find_all("td")
        if len(tds) >= 2:
            label = clean(tds[0].get_text()).lower()
            if label == "location":
                out["location"], fixed["location"] = read_text(tds[1])
            elif label == "date":
                out["date_text"] = clean(tds[1].get_text())
            elif label == "duration":
                out["duration_text"] = clean(tds[1].get_text())

    for section in content.select("div.section"):
        heading = section.select_one("h2.section_heading")
        name = clean(heading.get_text()) if heading else ""
        if not heading:
            # The site often opens a <p> inside a <p> it never closed, and
            # html.parser nests them. The outer's text already holds the
            # inner's, so reading both wrote 195 descriptions out twice.
            paras = [para_text(p) for p in section.select("p") if p.find_parent("p") is None]
            paras = [(text, n) for text, n in paras if text]
            if paras and not out["description"]:
                out["description"] = "\n".join(text for text, _ in paras)
                fixed["description"] = int(any(n for _, n in paras))
        elif name.lower() == "speakers":
            for li in section.select("li"):
                role = li.select_one(".line.one")
                who, n = read_text(li.select_one(".line.two"))
                if who:
                    out["speakers"].append({
                        "name": who,
                        "role": clean(role.get_text()) if role else "",
                    })
                    fixed["speakers"] += n
        elif name.lower() == "tracks":
            tracks = [read_text(a) for a in section.select("a")]
            out["tracks"] = [track for track, _ in tracks if track]
            fixed["tracks"] = sum(n for _, n in tracks)

    out["repaired"] = sum(fixed.values())
    return out


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def repair(text):
    """ftfy's fix_encoding, and no other ftfy transform (DECISIONS #44). The source serves some text that was UTF-8
    read as cp1252 - "â€“" for "–" - and on some pages an "Â" before a no-break space, the same fault on U+00A0.
    Where that no-break space ends a line, collapsing whitespace strips it, and the "Â" left behind is past ftfy's
    reach - the frozen 2026 file holds six such, "Best of 1.Â" and "Price: $35Â" - so the page's text is repaired
    first. fix_encoding returns ASCII, and text its badness check finds nothing wrong with, as it is; ftfy's other
    fixes - curly quotes, normalisation, HTML entities - would change clean text, and with it every tagger input and
    its cache key."""
    return ftfy.fix_encoding(text)


def read_text(node):
    """A node's text, repaired and then collapsed: (text, 1 where the repair changed text that is kept, else 0). A
    node that is absent reads as ("", 0)."""
    if node is None:
        return "", 0
    raw = node.get_text()
    fixed = repair(raw)
    text = clean(fixed)
    return text, int(bool(text) and fixed != raw)


def para_text(p):
    """A paragraph's text, with <br> kept as a line break, repaired before its lines are collapsed: (text, 1 where
    the repair changed it, else 0). get_text() alone ran the lines together: "Any Karma<br>The runners" became
    "KarmaThe"."""
    for br in p.find_all("br"):
        br.replace_with("\n")
    raw = p.get_text()
    fixed = repair(raw)
    lines = [clean(line) for line in fixed.split("\n")]
    text = "\n".join(line for line in lines if line)
    return text, int(bool(text) and fixed != raw)


def parse_start(date_text, year):
    """'Saturday, Sep  5 11:30 AM' -> datetime (naive, local Atlanta time), in `year`, the season's."""
    txt = clean(date_text)
    for fmt in ("%A, %b %d %I:%M %p", "%a, %b %d %I:%M %p", "%b %d %I:%M %p"):
        try:
            # The page gives no year. Parse with the season's in front rather
            # than patching it in afterwards: a day of month with no year is
            # deprecated in strptime and changes behaviour in Python 3.15.
            return dt.datetime.strptime(f"{year} {txt}", "%Y " + fmt)
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


# Kept for its reader; the fetch no longer calls it (#42). The panelist line
# is the parse step's, which pins its own copy of extract_panelists against
# this one (tests/test_parse_stage.py). The cancelled rule is the parse
# step's too, parse_stage.is_cancelled, since PR 6; the hotel and room split
# is the venues stage's, venues_stage.py (#45); and the merge of a group is
# merge_stage.py's.

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


def build_event(list_item, detail, kind, year):
    """A listing and its detail page -> the raw row (#42), its keys in ROW_FIELDS order. `location` is the page's
    cell as it is, with no hotel or room split (#45). `speakers` is the Speakers section alone, [] where the page has
    none: nothing is derived from the description, whose "Additional Panelists:" line is the parse step's. The title
    is the page's, else the day list's; the year is the season's."""
    start = parse_start(detail["date_text"], year)
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

    return {
        "source_id": list_item["id"],
        "type": kind,
        "title": detail["title"] or list_item["title"],
        "day": start.strftime("%Y-%m-%d") if start else None,
        "start": start.strftime("%Y-%m-%dT%H:%M") if start else None,
        "end": end.strftime("%Y-%m-%dT%H:%M") if end else None,
        "duration_min": duration,
        "location": detail["location"],
        "description": detail["description"],
        "tracks": detail["tracks"],
        "speakers": detail["speakers"],
    }


# ---------------------------------------------------------------------------
# The fetch
# ---------------------------------------------------------------------------

class FetchError(Exception):
    """A fatal fetch (#44), its numbers in the message. main() writes nothing and exits 1."""


@dataclass
class FetchResult:
    """What fetch() returns: the file's two lists, and the counts the run summary will read (contract.md, The
    fetch's result). `rows` is `fetched` + `carried_stale` + `carried_removed` rows, and `listings` is `fetched` +
    the failures."""
    rows: list             # the raw rows, sorted by source_id: source.json's `rows`
    failures: list         # {source_id, error}, sorted by source_id: source.json's `failures`
    repaired: int          # the strings the repair changed on the rows this run fetched
    listings: int          # the listings this run: every day list's, or the first --limit of them
    fetched: int           # detail pages fetched and parsed into a row
    carried_stale: int     # rows carried from the previous file with stale: true
    carried_removed: int   # rows carried from the previous file with removed: true
    seconds: float         # how long the fetch took


def fetch(season, previous, *, workers=3, limit=0, delay=0.15):
    """Every listing the season's source serves, as raw rows (#41, #42, #44) -> FetchResult.

    `season` is season.load()'s: its `source`, `days`, `year` and `thresholds` are read. `previous` is the previous
    source.json's rows by source_id, {} on a season's first run.

    A listing's detail page gives a fresh row. A listing whose page failed is carried from `previous` with `stale:
    true`, or, where `previous` has no row for it, is named in `failures` alone. A row of `previous` whose listing
    this run lacks is carried with `removed: true`, its fields frozen at last sight. A row carries one flag at most:
    a removed row listed again is fetched fresh, or is stale when its page fails, and a stale row whose listing goes
    is removed. carry() does the carrying.

    `limit` takes the first N listings in the order the day lists give them, and the run is as if the source listed
    only those.

    Fatal, as FetchError: a day list that fails; no listings; listings under thresholds.listings_floor of the
    previous rows not removed, where there are any; failed detail pages over thresholds.detail_failures of the
    listings; every page fetched parsing to an empty title. The first three are checked before any detail page is
    asked for.
    """
    started = time.monotonic()
    base = season["source"]
    floor = season["thresholds"]["listings_floor"]
    ceiling = season["thresholds"]["detail_failures"]
    session = make_session()

    # 1. Day lists: each day, panels and gaming.
    listings = {}
    for kind, type_param in TYPES.items():
        for day in season["days"]:
            params = {"day": day}
            if type_param:
                params["type"] = type_param
            try:
                items = parse_day_list(get(session, base, "events/view_by_day", params))
            except Exception as exc:  # noqa: BLE001
                # Every listing on it would be carried as removed; what #44 does not list as a degradation is fatal.
                raise FetchError(f"the {kind} day list for {day.replace('  ', ' ')} failed: {exc}") from exc
            for it in items:
                # An id can appear under two days if it straddles midnight; keep first.
                listings.setdefault(it["id"], {**it, "kind": kind})
            print(f"  {kind:6s} {day.replace('  ', ' ')}: {len(items):4d} events", file=sys.stderr)
            time.sleep(delay)

    ids = list(listings)
    if limit:
        ids = ids[:limit]
    live = sum(1 for row in previous.values() if not row.get("removed"))
    if not ids:
        raise FetchError(f"no listings on the {len(season['days']) * len(TYPES)} day lists")
    if live and len(ids) < share(floor, live):
        raise FetchError(f"{len(ids)} listings, under listings_floor {floor} of the previous file's {live} rows not "
                         f"removed ({share(floor, live)})")
    print(f"Fetching {len(ids)} detail pages with {workers} workers...", file=sys.stderr)

    # 2. Detail pages, politely parallel.
    fresh, failed, repaired, titled = {}, {}, 0, 0

    def fetch_one(sid):
        time.sleep(delay)
        return get(session, base, f"event/{sid}")

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, sid): sid for sid in ids}
        for done, fut in enumerate(as_completed(futures), 1):
            sid = futures[fut]
            item = listings[sid]
            try:
                detail = parse_detail(fut.result())
                fresh[sid] = build_event(item, detail, item["kind"], season["year"])
            except Exception as exc:  # noqa: BLE001
                failed[sid] = str(exc)
            else:
                # The day list's title is the row's only where the page has none, and its repair counts only then.
                repaired += detail["repaired"] + (0 if detail["title"] else item["repaired"])
                titled += bool(detail["title"])
            if done % 200 == 0 or done == len(ids):
                print(f"  {done}/{len(ids)}", file=sys.stderr)

    if len(failed) > share(ceiling, len(ids)):
        raise FetchError(f"{len(failed)} of {len(ids)} detail pages failed, over detail_failures {ceiling} of the "
                         f"listings ({share(ceiling, len(ids))})")
    if fresh and not titled:
        raise FetchError(f"all {len(fresh)} detail pages fetched parsed to an empty title: the page layout may have "
                         "changed")

    # 3. Carried from the previous file: a failed page's row, stale; a listing gone, removed.
    rows = carry({sid: fresh.get(sid) for sid in ids}, previous)
    return FetchResult(
        rows=rows,
        failures=[{"source_id": sid, "error": failed[sid]} for sid in sorted(failed)],
        repaired=repaired, listings=len(ids), fetched=len(fresh),
        carried_stale=sum(1 for row in rows if row.get("stale")),
        carried_removed=sum(1 for row in rows if row.get("removed")),
        seconds=time.monotonic() - started)


def share(fraction, n):
    """`fraction` of `n`, exact to the fraction as the season file writes it: 0.7 of 10 is 7, where a float product
    is 7.000000000000001 and would put exactly 70% under a 70% floor."""
    return Decimal(str(fraction)) * n


def carry(listed, previous):
    """This run's rows (#42), carried from the previous file where they must be -> the rows, sorted by source_id.

    `listed` maps each source id this run lists to its fresh row, or to None where its detail page failed; `previous`
    is the previous file's rows by source_id. A fresh row is kept as it is. A failed listing is carried from
    `previous` with `stale: true`, or, with no row there, left out: fetch() names it in `failures` alone. A row of
    `previous` that this run does not list is carried with `removed: true`. A carried row keeps its fields frozen at
    last sight and drops any flag it had, so a row carries one flag at most. fetch() calls it, and the replay of 2026
    (tools/replay_2026.py) calls it on each committed version.
    """
    rows = {sid: row for sid, row in listed.items() if row is not None}
    for sid, row in listed.items():
        if row is None and sid in previous:
            rows[sid] = carried(previous[sid], "stale")
    for sid in previous:
        if sid not in listed:
            rows[sid] = carried(previous[sid], "removed")
    return [rows[sid] for sid in sorted(rows)]


def carried(row, flag):
    """A row of the previous file, carried with one flag, `stale` or `removed`: its fields as they were, frozen at
    last sight, and any flag it had dropped (#42)."""
    return {**{k: row[k] for k in ROW_FIELDS}, flag: True}


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def read_previous(path, source):
    """The previous source.json's rows, by source_id. FetchError where the file cannot be read, is not a
    source.json, or is another source's: a wrong file's rows would all be carried as removed."""
    try:
        with open(path, "rb") as f:
            doc = json.loads(f.read().decode("utf-8"))
    except OSError as exc:
        raise FetchError(f"the previous file {path} cannot be read ({exc.strerror or exc})") from None
    except ValueError as exc:
        raise FetchError(f"the previous file {path} is not JSON ({exc})") from None
    if not isinstance(doc, dict) or set(doc) != {"source", "failures", "rows"} or not isinstance(doc["rows"], list):
        raise FetchError(f"the previous file {path} is not a source.json: an object of source, failures and rows")
    if doc["source"] != source:
        raise FetchError(f"the previous file {path} is {doc['source']}'s, not {source}'s")
    rows = {}
    for row in doc["rows"]:
        if not isinstance(row, dict) or not all(k in row for k in ROW_FIELDS):
            raise FetchError(f"the previous file {path} holds a row that is not a raw row: "
                             f"{json.dumps(row, ensure_ascii=False)[:80]}")
        if row["source_id"] in rows:
            raise FetchError(f"the previous file {path} holds {row['source_id']} twice")
        rows[row["source_id"]] = row
    return rows


def write_source(path, source, failures, rows):
    """source.json (#42): {"source", "failures", "rows"}, compact, a line break before each row, UTF-8 and LF, and
    no timestamp, so a run that changes nothing writes the same bytes. Written beside the file and swapped in, so a
    run that dies part-way leaves the last file whole."""
    def dumps(obj):
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))

    text = ('{"source":' + dumps(source) + ',"failures":' + dumps(failures) + ',"rows":['
            + ",".join("\n" + dumps(row) for row in rows) + "]}\n")
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(text.encode("utf-8"))
    os.replace(tmp, path)


def inside(path, folder):
    """True where `path` is `folder` or anything under it."""
    path, folder = (os.path.normcase(os.path.realpath(p)) for p in (path, folder))
    try:
        return os.path.commonpath([path, folder]) == folder
    except ValueError:  # another drive
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", required=True, help="the year's season.json, e.g. data/2027/season.json")
    ap.add_argument("--out", help="where source.json goes; default: beside the season file")
    ap.add_argument("--previous", help="the previous source.json; default: --out, where it exists")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0, help="only the first N listings, in page order")
    ap.add_argument("--delay", type=float, default=0.15, help="seconds to sleep before each request")
    args = ap.parse_args()

    try:
        season = load_season(args.season)
    except SeasonError as exc:
        sys.exit(str(exc))
    folder = os.path.dirname(os.path.abspath(args.season))
    out = args.out or os.path.join(folder, "source.json")
    if season["frozen"] and inside(out, folder):
        sys.exit(f"{args.season} is frozen (DECISIONS #46): nothing is written into {folder}. "
                 "Point --out outside it to probe the source.")
    previous_path = args.previous or (out if os.path.exists(out) else None)
    try:
        previous = read_previous(previous_path, season["source"]) if previous_path else {}
        print(f"Previous: {previous_path} ({len(previous)} rows)" if previous_path
              else "Previous: none, a season's first run", file=sys.stderr)
        result = fetch(season, previous, workers=args.workers, limit=args.limit, delay=args.delay)
    except FetchError as exc:
        sys.exit(f"FATAL: {exc}. Nothing written.")

    write_source(out, season["source"], result.failures, result.rows)
    for failure in result.failures:
        print(f"  failed: {failure['source_id']}: {failure['error']}", file=sys.stderr)
    print(f"Wrote {len(result.rows)} rows to {out}: {result.fetched} fetched of {result.listings} listings, "
          f"{result.carried_stale} carried stale, {result.carried_removed} carried removed; "
          f"{len(result.failures)} failed; {result.repaired} texts repaired; {result.seconds:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
