#!/usr/bin/env python3
"""The curated registries: load them, validate them, resolve a name to an id (DECISIONS #31).

`data/registry/works.json`, `people.json` and `tracks.json` are hand-curated, in git, and
cross-year. The pipeline validates them on every run and resolves them to ids; the client sees
only resolved data, never a registry. An id is a slug and is forever: a rename or a merge keeps
the old name as an alias, because follows are stored by id.

    from registry import load
    reg = load()                      # raises RegistryError listing every problem, not the first
    reg.resolve_work("d&d")           # -> "dungeons-and-dragons"

The four closed axis lists are `AXES`, here and nowhere else: `tracks.json` is validated against
them and the tagger (PR 4) imports them. Standard library, plus `parse_stage` for its folding.
Report code is `census_v2.py`; nothing here writes a file or prints.
"""

import json
import os
import re

from parse_stage import fold, person_slug

DIR = os.path.join("data", "registry")
FILES = ("works.json", "people.json", "tracks.json")

# The four closed axes of schema-v2.md, at most 2 values each on a track or an event.
AXES = {
    "medium": ("tv", "film", "books", "comics", "animation", "anime", "music", "podcast-web",
               "video-games", "tabletop"),
    "genre": ("fantasy", "sci-fi", "horror", "comedy", "superhero", "romance"),
    "craft": ("writing", "costuming", "props-making", "art", "photography", "puppetry", "performance"),
    "subject": ("science", "space", "tech", "history", "politics", "skepticism", "paranormal",
                "fitness", "food", "community", "fandom-culture"),
}
MAX_AXIS_VALUES = 2
WORK_TYPES = ("franchise", "game")
GAME_FAMILIES = ("rpg", "ccg", "board", "miniatures", "video")
TIERS = ("celebrity", "creator")
TRACK_AUDIENCES = ("kids", "mature")
MAX_CREDITS = 5
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LEADING_THE = re.compile(r"^the-")
DIGIT_COMMA = re.compile(r"(?<=\d),(?=\d)")


class RegistryError(Exception):
    """Every problem in the registries, not the first. `problems` is the list."""

    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__(f"{len(self.problems)} problem(s) in the registries:\n  "
                         + "\n  ".join(self.problems))


# ---------------------------------------------------------------------------
# Slugs and keys
# ---------------------------------------------------------------------------

def work_slug(name):
    """A work's or a track's id, drafted from its name: case, accents and punctuation fold to
    hyphens, "&" reads "and", and a comma inside a number is not a separator, so "Warhammer
    40,000" is `warhammer-40000`. A leading "the" stays - `the-expanse`, not `expanse` - because
    it is part of the name. The seed holds `id == work_slug(name)` for every entry, but that is
    not a rule `load` enforces: an id never changes and a name may be corrected later."""
    s = fold(DIGIT_COMMA.sub("", str(name or ""))).replace("&", " and ").replace("'", "")
    return "-".join(re.sub(r"[^a-z0-9]+", " ", s).split())


def resolve_key(name):
    """What two spellings of one name share: `work_slug` without a leading "the", so that
    "The Wheel of Time" and "Wheel of Time" are one name and neither needs an alias. Aliases
    carry only the names that are really different - `d&d`, `dnd`, `mcu`."""
    slug = work_slug(name)
    return LEADING_THE.sub("", slug) or slug


# ---------------------------------------------------------------------------
# The loaded registries
# ---------------------------------------------------------------------------

class Registry:
    """Three lists as they are on disk, and the lookups built from them. Entries are the parsed
    JSON objects, in file order; `works`, `people` and `tracks` are read, never written."""

    def __init__(self, works, people, tracks):
        self.works, self.people, self.tracks = works, people, tracks
        self._works = _lookup(works, resolve_key)
        self._tracks = _lookup(tracks, resolve_key)
        # A person's names normalise the way a person's id is made (`parse_stage.person_slug`),
        # which sets aside an honorific and a trailing credential rather than a leading "the".
        self._people = _lookup(people, person_slug)
        self._terms = {resolve_key(t) for e in works if isinstance(e, dict)
                       for t in (e.get("terms") if _is_str_list(e.get("terms")) else [])
                       if t.strip()}

    def resolve_work(self, name):
        """A work's id, by name or alias, or None. Terms never resolve: one term may sit on
        several works, and a term is not a name for the work."""
        return self._works.get(resolve_key(name))

    def is_term(self, name):
        """True where the name is a term on some work: a word that leads a searcher to a work but
        is not a name for it, and so never resolves. The tagger's answers can name one - "DDAL"
        for an Adventurers League table - and the cache keeps it as the model said it; mint skips
        it and events_v2 drops it. Made an alias instead, it links with no model call."""
        return resolve_key(name) in self._terms

    def resolve_track(self, name):
        return self._tracks.get(resolve_key(name))

    def resolve_person(self, name):
        return self._people.get(person_slug(name))

    def by_id(self, kind="works"):
        return {e["id"]: e for e in getattr(self, kind) if isinstance(e, dict) and "id" in e}


def _lookup(entries, key):
    out = {}
    for e in entries:
        if not isinstance(e, dict) or not e.get("id"):
            continue
        for name in [e.get("name")] + list(e.get("aliases") or []):
            if isinstance(name, str) and name.strip():
                out.setdefault(key(name), e["id"])
    return out


# ---------------------------------------------------------------------------
# Loading and validation
# ---------------------------------------------------------------------------

def load(directory=DIR):
    """The three registries, validated. Raises RegistryError listing every problem found, so that
    one run of the pipeline shows a curator everything to fix."""
    problems, files = [], {}
    for name in FILES:
        path = os.path.join(directory, name)
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except OSError as exc:
            problems.append(f"{name}: cannot be read ({exc.strerror or exc})")
            data = []
        except ValueError as exc:
            problems.append(f"{name}: is not JSON ({exc})")
            data = []
        if not isinstance(data, list):
            problems.append(f"{name}: holds {type(data).__name__}, not a list of entries")
            data = []
        files[name] = data

    works, people, tracks = files["works.json"], files["people.json"], files["tracks.json"]
    for name, entries in (("works.json", works), ("people.json", people), ("tracks.json", tracks)):
        problems += _common(name, entries, person_slug if name == "people.json" else resolve_key)
    work_ids = {e["id"] for e in works if isinstance(e, dict) and isinstance(e.get("id"), str)}
    problems += _works(works, work_ids)
    problems += _tracks(tracks, work_ids)
    problems += _people(people, work_ids)
    problems += _terms(works, tracks)
    if problems:
        raise RegistryError(sorted(problems))
    return Registry(works, people, tracks)


def _at(file, entry, index):
    return f"{file}[{index}] {(entry.get('id') or entry.get('name') or '?') if isinstance(entry, dict) else '?'}"


def _common(file, entries, key):
    """An id is a slug and unique in its file; a name is present; no two entries share a key."""
    out, seen, by_key = [], {}, {}
    for i, e in enumerate(entries):
        if not isinstance(e, dict):
            out.append(f"{file}[{i}]: is {type(e).__name__}, not an object")
            continue
        here = _at(file, e, i)
        eid = e.get("id")
        if not isinstance(eid, str) or not SLUG.match(eid):
            out.append(f"{here}: id {eid!r} is not a slug (lowercase, digits, single hyphens)")
        elif eid in seen:
            out.append(f"{here}: id {eid!r} is already used at index {seen[eid]}")
        else:
            seen[eid] = i
        if not isinstance(e.get("name"), str) or not e["name"].strip():
            out.append(f"{here}: name {e.get('name')!r} is missing or empty")
        if "aliases" in e and not _is_str_list(e["aliases"]):
            out.append(f"{here}: aliases is not a list of strings")
        for name in [e.get("name")] + list(e.get("aliases") or []):
            if isinstance(name, str) and name.strip():
                by_key.setdefault(key(name), []).append((name, eid))
    for k, hits in by_key.items():
        if len({eid for _, eid in hits}) > 1:
            who = ", ".join(f"{name!r} ({eid})" for name, eid in sorted(hits, key=lambda h: (h[1] or "", h[0])))
            out.append(f"{file}: the key {k!r} resolves to more than one entry: {who}")
    return out


def _works(works, work_ids):
    out = []
    for i, e in enumerate(works):
        if not isinstance(e, dict):
            continue
        here = _at("works.json", e, i)
        kind = e.get("type")
        if kind not in WORK_TYPES:
            out.append(f"{here}: type {kind!r} is not one of {', '.join(WORK_TYPES)}")
        family = e.get("family")
        if kind == "game" and family not in GAME_FAMILIES:
            out.append(f"{here}: a game needs a family, one of {', '.join(GAME_FAMILIES)}, not {family!r}")
        if kind != "game" and family is not None:
            out.append(f"{here}: family {family!r} is for a game, and this is a {kind!r}")
        if not isinstance(e.get("reviewed"), bool):
            out.append(f"{here}: reviewed {e.get('reviewed')!r} is not true or false")
        parent = e.get("parent")
        if parent is not None and parent not in work_ids:
            out.append(f"{here}: parent {parent!r} is not a work")
        if "terms" in e and not _is_str_list(e["terms"]):
            out.append(f"{here}: terms is not a list of strings")
    return out + _cycles(works)


def _cycles(works):
    """A work is not its own ancestor. One cycle is one problem however many works are on it: the
    ring is rotated to start at its smallest id, so every member reports the same string."""
    parent = {e["id"]: e.get("parent") for e in works
              if isinstance(e, dict) and isinstance(e.get("id"), str)}
    out = set()
    for start in sorted(parent):
        seen, at = [], start
        while at is not None and at in parent:
            if at in seen:
                ring = seen[seen.index(at):]
                ring = ring[ring.index(min(ring)):] + ring[:ring.index(min(ring))]
                out.add(f"works.json: {' -> '.join(ring + [ring[0]])} is a parent cycle")
                break
            seen.append(at)
            at = parent[at]
    return sorted(out)


def _tracks(tracks, work_ids):
    out = []
    for i, e in enumerate(tracks):
        if not isinstance(e, dict):
            continue
        here = _at("tracks.json", e, i)
        axes = e.get("axes")
        if axes is not None:
            if not isinstance(axes, dict):
                out.append(f"{here}: axes is not an object")
            else:
                for axis, values in sorted(axes.items()):
                    if axis not in AXES:
                        out.append(f"{here}: {axis!r} is not an axis ({', '.join(sorted(AXES))})")
                    elif not _is_str_list(values):
                        out.append(f"{here}: axes.{axis} is not a list of strings")
                    else:
                        for v in values:
                            if v not in AXES[axis]:
                                out.append(f"{here}: {v!r} is not a value of {axis} "
                                           f"({', '.join(AXES[axis])})")
                        if len(values) > MAX_AXIS_VALUES:
                            out.append(f"{here}: axes.{axis} has {len(values)} values, at most "
                                       f"{MAX_AXIS_VALUES}")
        audience = e.get("audience")
        if audience is not None and audience not in TRACK_AUDIENCES:
            out.append(f"{here}: audience {audience!r} is not one of {', '.join(TRACK_AUDIENCES)}")
        work = e.get("work")
        if work is not None and work not in work_ids:
            out.append(f"{here}: work {work!r} is not a work")
    return out


def _people(people, work_ids):
    out = []
    for i, e in enumerate(people):
        if not isinstance(e, dict):
            continue
        here = _at("people.json", e, i)
        tier = e.get("tier")  # optional: an entry with no tier exists to carry aliases
        if tier is not None and tier not in TIERS:
            out.append(f"{here}: tier {tier!r} is not one of {', '.join(TIERS)}")
        # Required, as on a work: a person has confirmed who this is and the tier.
        if not isinstance(e.get("reviewed"), bool):
            out.append(f"{here}: reviewed {e.get('reviewed')!r} is not true or false")
        credits = e.get("credits")
        if credits is None:
            continue
        if not isinstance(credits, list):
            out.append(f"{here}: credits is not a list")
            continue
        if len(credits) > MAX_CREDITS:
            out.append(f"{here}: {len(credits)} credits, at most {MAX_CREDITS}")
        for c in credits:
            if not isinstance(c, dict) or set(c) != {"work", "reviewed"}:
                out.append(f"{here}: a credit is not {{work, reviewed}}: {c!r}")
                continue
            if c["work"] not in work_ids:
                out.append(f"{here}: credit work {c['work']!r} is not a work")
            if not isinstance(c["reviewed"], bool):
                out.append(f"{here}: credit {c['work']!r} reviewed {c['reviewed']!r} is not true or false")
    return out


def _terms(works, tracks):
    """A term leads a searcher to a work but is not a name for it, so terms never resolve and need
    not be unique - "whedon" sits on Firefly, Buffy and Angel. What a term may not be is a name or
    an alias somewhere else, which would make one string both resolvable and not."""
    named = {}
    for entries in (works, tracks):
        for e in entries:
            if not isinstance(e, dict) or not e.get("id"):
                continue
            for name in [e.get("name")] + list(e.get("aliases") or []):
                if isinstance(name, str) and name.strip():
                    named.setdefault(resolve_key(name), e["id"])
    out = []
    for i, e in enumerate(works):
        if not isinstance(e, dict) or not _is_str_list(e.get("terms") or []):
            continue
        for term in e.get("terms") or []:
            owner = named.get(resolve_key(term))
            if owner:
                out.append(f"{_at('works.json', e, i)}: the term {term!r} is also the name or "
                           f"alias of {owner}")
    return out


def _is_str_list(value):
    return isinstance(value, list) and all(isinstance(v, str) for v in value)
