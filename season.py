#!/usr/bin/env python3
"""The season file, data/<year>/season.json: load it and validate it (DECISIONS #44, #46).

Hand-edited, one a year: what the pipeline needs to know of a con that its schedule does not say.

    year            the con's year
    slug, source    the source's slug and its base URL (2026: dragoncon26)
    days            the source's day strings, as its day pages take them: "Sep  2", two spaces before one digit
    con             {first, last}: the first and last day of the client's CON, ISO dates
    tz              the time zone's name, a string only: pipeline.py's window reads it through zoneinfo
    window          {from, to}, ISO dates: the cron window, outside which a run exits 0 (#48); null for a frozen year
    frozen          a frozen year: its raw file is write-refused and no run targets it (#46)
    prompt_version  the tag stage's PROMPT_VERSION for the year (#46)
    thresholds      listings_floor, detail_failures and new_ids, each in (0, 1]; requests_per_run, a positive integer

    from season import load
    s = load("data/2027/season.json")   # the validated file; raises SeasonError listing every problem, not the first

The fetch reads it (scraper.py, PR 3): the source, the day strings, the year and the two fetch thresholds, and
`frozen`, which keeps the fetch from writing into a frozen year's folder. Every field is required, and a key the file
does not know is a problem, because a typo in a hand-edited file would otherwise do nothing, silently. Standard
library; nothing here writes a file or prints.
"""

import datetime as dt
import json
import re

FIELDS = ("year", "slug", "source", "days", "con", "tz", "window", "frozen", "prompt_version", "thresholds")
CON = ("first", "last")
WINDOW = ("from", "to")
FRACTIONS = ("listings_floor", "detail_failures", "new_ids")
THRESHOLDS = FRACTIONS + ("requests_per_run",)
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class SeasonError(Exception):
    """Every problem in the file, not the first. `problems` is the list."""

    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__(f"{len(self.problems)} problem(s) in the season file:\n  " + "\n  ".join(self.problems))


def load(path):
    """The file at `path`, validated, as it is on disk. Raises SeasonError listing every problem found."""
    try:
        with open(path, "rb") as f:
            data = json.loads(f.read().decode("utf-8"))
    except OSError as exc:
        raise SeasonError([f"{path}: cannot be read ({exc.strerror or exc})"]) from None
    except ValueError as exc:
        raise SeasonError([f"{path}: is not JSON ({exc})"]) from None
    return check(data)


def check(data):
    """Parsed JSON, validated and returned as it is. Raises SeasonError listing every problem found."""
    if not isinstance(data, dict):
        raise SeasonError([f"the file holds {type(data).__name__}, not an object"])
    out = _keys("the file", data, FIELDS)
    if "year" in data and not _whole(data["year"]):
        out.append(f"year {data['year']!r} is not a whole number")
    for field in ("slug", "tz"):
        if field in data and not _text(data[field]):
            out.append(f"{field} {data[field]!r} is not a non-empty string")
    if "source" in data and not (isinstance(data["source"], str) and re.match(r"^https?://\S+$", data["source"])):
        out.append(f"source {data['source']!r} is not a URL")
    if "days" in data:
        days = data["days"]
        if not isinstance(days, list) or not days or not all(_text(d) for d in days):
            out.append("days is not a list of the source's day strings")
        elif len(set(days)) != len(days):
            out.append("days lists a day twice")
    if "con" in data:
        out += _span("con", data["con"], CON)
    if "window" in data and data["window"] is not None:
        out += _span("window", data["window"], WINDOW)
    if "frozen" in data and not isinstance(data["frozen"], bool):
        out.append(f"frozen {data['frozen']!r} is not true or false")
    if "prompt_version" in data and not (_whole(data["prompt_version"]) and data["prompt_version"] >= 1):
        out.append(f"prompt_version {data['prompt_version']!r} is not a positive whole number")
    if "thresholds" in data:
        out += _thresholds(data["thresholds"])
    if out:
        raise SeasonError(sorted(out))
    return data


def _span(name, value, keys):
    """{first, last} or {from, to}: two ISO dates, in order."""
    if not isinstance(value, dict):
        return [f"{name} is not an object {{{', '.join(keys)}}}"]
    out = _keys(name, value, keys)
    dates = [_date(value.get(k)) for k in keys]
    for k, d in zip(keys, dates):
        if k in value and d is None:
            out.append(f"{name}.{k} {value[k]!r} is not an ISO date, YYYY-MM-DD")
    if all(dates) and dates[0] > dates[1]:
        out.append(f"{name}: {keys[0]} {value[keys[0]]} is after {keys[1]} {value[keys[1]]}")
    return out


def _thresholds(value):
    if not isinstance(value, dict):
        return ["thresholds is not an object"]
    out = _keys("thresholds", value, THRESHOLDS)
    for k in FRACTIONS:
        v = value.get(k)
        if k in value and not (isinstance(v, (int, float)) and not isinstance(v, bool) and 0 < v <= 1):
            out.append(f"thresholds.{k} {v!r} is not in (0, 1]")
    v = value.get("requests_per_run")
    if "requests_per_run" in value and not (_whole(v) and v >= 1):
        out.append(f"thresholds.requests_per_run {v!r} is not a positive whole number")
    return out


def _date(value):
    if not isinstance(value, str) or not ISO_DATE.match(value):
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None


def _keys(where, obj, allowed):
    """Every key of `allowed` present, and no other."""
    missing = [f"{where}: {k} is missing" for k in allowed if k not in obj]
    unknown = [f"{where}: {k!r} is not a key this file knows" for k in obj if k not in allowed]
    return missing + unknown


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _whole(value):
    return isinstance(value, int) and not isinstance(value, bool)
