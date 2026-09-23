#!/usr/bin/env python3
"""What the tag stage sends about an event, the key its answer is cached under, and the cache's file (DECISIONS #34,
#46). A leaf of the tag and build path: tag_stage.py and events_v2.py both import it, and it imports neither.

    from tag_key import input_key, load_cache, tagger_input
    key = input_key(tagger_input(event), season["prompt_version"])
    entry = load_cache("data/2027/tags.cache.jsonl").get(key)

What the model is sent about an event, and nothing else (`tagger_input`): the title without its price mark, clock
time, SOLD OUT or CANCELLED and the separators they leave, case kept; the scraped type and tracks; and the description
without its "Additional Panelists:" line, capped at DESCRIPTION_CAP characters. No people: a panel with a different
moderator is the same input, and a guest's name cannot pull their other shows into what an event is about.

The key (`input_key`) is the sha256 of the canonical JSON - sorted keys, compact, UTF-8 - of {"v": version, "input":
...}, where version is the year's prompt_version, from its season.json (#46), and nothing else: not the prompt text,
not the works list, not tracks.json, not the model. A season takes no bump, so an input is asked once a season.

The cache, tags.cache.jsonl beside a year's season.json, holds what the model said, held to the closed lists: one entry
a line, {key, title, model, answer} in that order and an answer's fields in theirs, sorted by key, LF, no timestamps.
It holds names, never ids (#34). A line that is not an entry is an error, not something to skip: the file is
committed, and a bad line is a bad merge. write_cache writes beside the file and moves over it, so an interrupted write
leaves the last good cache in place.

Standard library, and parse_stage for the title and the panelist line, and registry for the order of the four axes in
an answer. Nothing here calls a model or prints.
"""

import hashlib
import json
import os

import parse_stage as ps
import registry

DESCRIPTION_CAP = 2000
# What strip_facets can leave at either end of a title: "Matt Dinniman - Signing - SOLD OUT"
# comes out "Matt Dinniman - Signing -".
_SEPARATORS = " -–—:,/|"
_ENTRY_FIELDS = ("key", "title", "model", "answer")
_ANSWER_FIELDS = ("kind", "works") + tuple(registry.AXES) + ("audience", "play")
_WORK_FIELDS = ("name", "evidence", "type", "family")


def _clean_title(title):
    """The title the tagger is sent. parse_stage.strip_facets takes out a price mark, SOLD OUT, a
    clock time and CANCELLED; whitespace is collapsed; and the separators that leaves at either end
    go, so that "X - SOLD OUT" and "X" are one input. Case is kept. strip_facets is unchanged: its
    output is also the repeat key's, which folds the separators away by itself."""
    return " ".join(ps.strip_facets(title or "").split()).strip(_SEPARATORS)


def tagger_input(event):
    """Everything the model is told about an event: {title, type, tracks, description}."""
    description = ps.strip_panelists(event.get("description") or "").strip()
    return {"title": _clean_title(event.get("title")), "type": event.get("type") or "",
            "tracks": [str(t) for t in event.get("tracks") or []],
            "description": description[:DESCRIPTION_CAP]}


def _canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def input_key(inp, version):
    """sha256 of the canonical JSON of {"v": version, "input": inp}. `version` is the year's prompt_version, from its
    season.json (#46)."""
    return hashlib.sha256(_canonical({"v": version, "input": inp}).encode("utf-8")).hexdigest()


def _in_order(answer):
    """An answer with its fields, and each work's, in the cache's fixed order."""
    out = {k: answer[k] for k in _ANSWER_FIELDS}
    out["works"] = [{k: w[k] for k in _WORK_FIELDS if k in w} for w in answer["works"]]
    return out


def _line(entry):
    return json.dumps({"key": entry["key"], "title": entry["title"], "model": entry["model"],
                       "answer": _in_order(entry["answer"])}, ensure_ascii=False)


def load_cache(path):
    """{key: entry}. An absent file is an empty cache; a line that is not an entry is an error, not
    something to skip: the file is committed, and a bad line is a bad merge."""
    if not os.path.exists(path):
        return {}
    out = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            entry = json.loads(line)
            if not isinstance(entry, dict) or tuple(entry) != _ENTRY_FIELDS:
                raise ValueError(f"{path}:{n}: not a cache entry {_ENTRY_FIELDS}")
            out[entry["key"]] = entry
    return out


def write_cache(path, cache):
    """Every entry, one a line, sorted by key, LF. Written beside the file and moved over it, so an
    interrupted write leaves the last good cache in place."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        for key in sorted(cache):
            f.write(_line(cache[key]) + "\n")
    os.replace(tmp, path)
