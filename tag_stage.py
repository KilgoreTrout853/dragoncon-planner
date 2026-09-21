#!/usr/bin/env python3
"""The tag stage of tags v2 (DECISIONS #32, #34): what an event is about, asked of a model once per
distinct input, and the answers cached.

    python tag_stage.py --dry-run      # the inputs, the requests, the prompt sizes; calls nothing
    python tag_stage.py                # ask about every uncached input, then mint the new works
    python tag_stage.py --mint-only    # mint what the cache names and the registry lacks; no model

What the model is sent about an event, and nothing else (`tagger_input`): the title without its
price mark, clock time, SOLD OUT or CANCELLED; the scraped type and tracks; and the description
without its "Additional Panelists:" line. No people: a panel with a different moderator is the same
input, and a guest's name cannot pull their other shows into what an event is about. The cache key
is a hash of that input and PROMPT_VERSION, and nothing else - not the prompt text, not the works
list, not tracks.json, not the model - so an input is tagged once, and PROMPT_VERSION is bumped by
hand to tag everything again.

The cache, data/2026/tags.cache.jsonl, holds what the model said, held to the closed lists: one
entry a line, sorted by key, rewritten after every request, so a crash or a rate limit resumes where
it stopped and a second run sends nothing. It holds names, never ids: a work is {"name", "evidence",
"type", "family"}, and events_v2.py resolves each name through the registry on every run, so an
alias, a merge or a rename fixes events with no model call. Nothing the model wrote becomes an id
except through mint, here: a cached name the registry cannot resolve becomes a works.json row,
`reviewed: false`, placed under a parent by one more request, and the file is written once.

Transports are tag_events.py's: the Anthropic API when ANTHROPIC_API_KEY is set in the environment,
otherwise `claude -p` on the subscription, run with no tools, no MCP servers, no saved session and no
CLAUDE.md. Both ask for claude-sonnet-5 by full id; --model overrides it. The key is read from the
environment and nowhere else.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

import draft_people as dp
import parse_stage as ps
import registry
from tag_events import KINDS, call_api, call_claude_code, claude_code_command, parse_json_array
import tag_events

EVENTS = os.path.join("data", "2026", "events.json")
CACHE = os.path.join("data", "2026", "tags.cache.jsonl")
PROMPT_VERSION = 1   # bumped by hand to tag every input again; the prompt text is not in the key
PER_REQUEST = 25
DESCRIPTION_CAP = 2000
MAX_WORKS = 3
API_MODEL = "claude-sonnet-5"
# A full id on Claude Code too, never an alias: an alias moves with the CLI, and here `sonnet` is
# claude-sonnet-4-6 (claude 2.1.145, 2026-09-21). The tag stage names the model it asks for, and the
# cache records the one that answered.
CODE_MODEL = "claude-sonnet-5"
AXIS_NAMES = tuple(registry.AXES)   # medium, genre, craft, subject
AUDIENCES = ("kids", "all", "mature")
# campaign and experienced were struck after the gate: at this con the Campaign track IS organized
# play, and most format and level flips between two runs were organized-play/campaign and any/experienced.
PLAY_FORMATS = ("demo", "learn-to-play", "organized-play", "tournament", "open-play", "one-shot")
PLAY_LEVELS = ("beginner", "any")
# What strip_facets can leave at either end of a title: "Matt Dinniman - Signing - SOLD OUT"
# comes out "Matt Dinniman - Signing -".
SEPARATORS = " -–—:,/|"
CACHE_FIELDS = ("key", "title", "model", "answer")
ANSWER_FIELDS = ("kind", "works") + AXIS_NAMES + ("audience", "play")
WORK_FIELDS = ("name", "evidence", "type", "family")
STOP_AFTER_FAILURES = 3   # requests in a row; a rate limit fails every request after it
CHARS_PER_TOKEN = 4       # for the dry run's estimate only
# Likewise: Claude Code's own count of claude-sonnet-5's output in the pilot, which includes its
# thinking - about 310 an answer, where the answer itself is about 50.
TOKENS_PER_ANSWER = 310


# ---------------------------------------------------------------------------
# What the tagger is sent, and the key
# ---------------------------------------------------------------------------

def clean_title(title):
    """The title the tagger is sent. parse_stage.strip_facets takes out a price mark, SOLD OUT, a
    clock time and CANCELLED; whitespace is collapsed; and the separators that leaves at either end
    go, so that "X - SOLD OUT" and "X" are one input. Case is kept. strip_facets is unchanged: its
    output is also the repeat key's, which folds the separators away by itself."""
    return " ".join(ps.strip_facets(title or "").split()).strip(SEPARATORS)


def tagger_input(event):
    """Everything the model is told about an event: {title, type, tracks, description}."""
    description = ps.strip_panelists(event.get("description") or "").strip()
    return {"title": clean_title(event.get("title")), "type": event.get("type") or "",
            "tracks": [str(t) for t in event.get("tracks") or []],
            "description": description[:DESCRIPTION_CAP]}


def over_cap(event):
    return len(ps.strip_panelists(event.get("description") or "").strip()) > DESCRIPTION_CAP


def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def input_key(inp, version=None):
    """sha256 of the canonical JSON of {"v": PROMPT_VERSION, "input": inp}. The version is read
    when called, so a test can move it."""
    doc = {"v": PROMPT_VERSION if version is None else version, "input": inp}
    return hashlib.sha256(canonical(doc).encode("utf-8")).hexdigest()


def distinct_inputs(events):
    """({key: input}, [key of each event, in event order])."""
    inputs, keys = {}, []
    for e in events:
        inp = tagger_input(e)
        key = input_key(inp)
        inputs.setdefault(key, inp)
        keys.append(key)
    return inputs, keys


def request_order(item):
    """Requests go in (first track, title) order, so that one request holds like events."""
    key, inp = item
    return ((inp["tracks"] or [""])[0], inp["title"], key)


def batches_of(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]


# ---------------------------------------------------------------------------
# The prompt
# ---------------------------------------------------------------------------

# What each kind means. qa, panel, screening, signing, photo, party and tour are v1's words
# (tag_events.PROMPT), so that the two stay comparable; workshop, gaming, contest, performance and
# reading were rewritten after the pilot, where they were the kinds two runs disagreed on.
KIND_GLOSSES = {
    "qa": "an appearance, Q&A, or spotlight featuring actors, creators, or notable named guests",
    "panel": "a fan-run or expert discussion",
    "screening": "a film, episode, or video showing",
    "workshop": "hands-on: the attendees make, practise or do the thing in the session. A how-to talk "
                "with nothing hands-on is a panel",
    "signing": "autographs",
    "photo": "photo ops or photo sessions",
    "contest": "a competition with winners that is not the playing of a game: costume, art, film, talent, "
               "or a sporting or combat match that people watch",
    "performance": "concerts, comedy, puppetry, wrestling, burlesque, theatrical shows, a staged or table "
                   "read, an artist or maker working live for an audience",
    "party": "dances, socials, mixers, meetups",
    "gaming": "any session where the attendees play a game: open play, RPG sessions, LAN, demo tables, "
              "learn-to-play, and game tournaments too (the tournament goes in play.format)",
    "reading": "an author reading their own work",
    "tour": "walking tours",
    "other": None,
}
PLAY_FORMAT_GLOSSES = {
    "demo": "a publisher or designer showing a game; short, drop-in",
    "learn-to-play": "the session teaches the rules",
    "organized-play": "a session of a league or living campaign with continuing characters: Adventurers "
                      "League (DDAL), Pathfinder and Starfinder Society, Legends of Greyhawk, and the "
                      "sessions of the schedule's Campaign track",
    "tournament": "players compete for a result over rounds or a bracket, usually for prizes. A story "
                  "that happens to be about a tournament is not one",
    "open-play": "drop in and play: a game library, a free-play room",
    "one-shot": "a scheduled, self-contained session of a game, none of the above",
}
PLAY_LEVEL_GLOSSES = {
    "beginner": "the listing says new players are welcome, the rules are taught, or characters or decks "
                "are provided",
    "any": "everything else",
}

PROMPT = """You are tagging the events of Dragon Con 2026, a very large science fiction, fantasy and
pop-culture convention, so that a reader can find what each event is about.

Each event below has an "id", its "title", its "type" as the schedule files it (panel or gaming),
its "tracks" and its "description". Return one object per event, with every one of these fields,
every time:

- "id": copy exactly.
- "kind": exactly one of {kinds}:
{kind_glosses}
- "works": at most {max_works} works the listing is about. A work is anything a fan follows and a
  person can be credited with: a show, film, book, game, podcast, web series, stage show or band.
  A person or a convention is not a work, and neither is a genre or a medium; a company or a brand
  is not a work unless it is in the list below. An event this convention puts on - a contest, a
  show, a party, a parade - is not a work, however often it recurs. A scenario, module, adventure
  or session is not a work; the published game it is played in is. A campaign setting or game
  world is named only when it is in the list below; otherwise name the game system it is played
  in, and if the listing does not say which system, name nothing. A traditional game with no
  publisher - chess, poker, bingo - is not a work. Link a work only when the
  listing itself refers to it, in its title or its description, never because of who is
  appearing. A work mentioned in passing, or in a list of examples, is not what the listing is
  about. A work named only to say what a presenter has worked on, or as one example among
  several, is not what the listing is about. If the work's name could be removed and the listing
  would still describe the same event, do not link it. For each, name the most specific work the
  listing is about: "Star Trek: Lower Decks", not "Star Trek", for a listing about Lower Decks. Use
  a name from the list of works below, spelled exactly as it is there, where one fits; otherwise
  use the work's plain name. Each work is an object:
    "name": the work's name;
    "evidence": the shortest phrase of the title or the description that shows it, copied exactly;
    "type": "game" for a work that began as a game, "franchise" for one that began as anything else;
    "family": for a game only, one of {families}.
  An empty list when the listing is about no particular work.
- "medium": at most {max_axis} of {medium}.
- "genre": at most {max_axis} of {genre}.
- "craft": at most {max_axis} of {craft}.
- "subject": at most {max_axis} of {subject}.
  For these four, only values from their list, and an empty list when none fits.
- "audience": "kids" for an event made for children or families, "mature" for one that is 18+,
  adults-only or explicitly sexual, and "all" otherwise.
- "play": for an event where people play a game, {{"format": ..., "level": ...}}; null otherwise.
  "format" is exactly one of:
{format_glosses}
  "level" is exactly one of:
{level_glosses}

Return ONLY a JSON array of these objects, one per event, in the same order. No prose, no code
fences.

The works already known, as a guide to spelling. A work indented under another belongs to it.
{works}

Events:
{events}"""


def glosses(table):
    """One line a value, indented under its field: "    value = what it means."."""
    return "\n".join(f"    {value} = {gloss}." if gloss else f"    {value}." for value, gloss in table.items())


def works_guide(works):
    """Every work's name, each child indented under its parent and each level in name order: names
    only, no aliases and no ids. The model spells what is listed; build resolves what it wrote."""
    ids = {w["id"] for w in works}
    children = defaultdict(list)
    for w in works:
        children[w.get("parent") if w.get("parent") in ids else None].append(w)
    lines = []

    def walk(parent, depth):
        for w in sorted(children.get(parent, []), key=lambda w: (ps.fold(w["name"]), w["name"], w["id"])):
            lines.append("  " * depth + w["name"])
            walk(w["id"], depth + 1)

    walk(None, 0)
    return "\n".join(lines)


def events_block(batch):
    return "[\n" + ",\n".join(json.dumps({"id": rid, **inp}, ensure_ascii=False) for rid, inp in batch) + "\n]"


def build_prompt(batch, guide):
    """One request's prompt, and {short id: key}. The model sees e1..eN, never a key."""
    ids = {f"e{i}": key for i, (key, _) in enumerate(batch, 1)}
    block = events_block([(f"e{i}", inp) for i, (_, inp) in enumerate(batch, 1)])
    prompt = PROMPT.format(kinds=", ".join(KINDS), kind_glosses=glosses(KIND_GLOSSES), max_works=MAX_WORKS,
                           families=", ".join(registry.GAME_FAMILIES),
                           max_axis=registry.MAX_AXIS_VALUES,
                           **{axis: ", ".join(values) for axis, values in registry.AXES.items()},
                           format_glosses=glosses(PLAY_FORMAT_GLOSSES), level_glosses=glosses(PLAY_LEVEL_GLOSSES),
                           works=guide, events=block)
    return prompt, ids


# ---------------------------------------------------------------------------
# Holding an answer to the closed lists
# ---------------------------------------------------------------------------

def new_tally():
    """What validation set aside, for the run report."""
    return {"kind_rejected": [], "evidence_dropped": [], "works_over_cap": [], "works_malformed": 0,
            "type_invalid": 0, "family_invalid": 0, "axis_dropped": Counter(), "axis_capped": 0,
            "audience_defaulted": Counter(), "play_nulled": Counter()}


def folded(s):
    """parse_stage.fold, and the left single quote read as a straight one too. parse_stage.fold
    folds only the right one (U+2019) and is not changed for this: it makes person ids, and an id
    is forever. "Podcast ‘No Latency,'" lost its link to that before the fix."""
    return " ".join(ps.fold(str(s).replace("\u2018", "'")).split())


def evidence_holds(evidence, inp):
    """True where the evidence is in the title or the description that was sent, both sides folded
    (case, accents, curly quotes) and whitespace collapsed. An empty phrase holds nowhere."""
    phrase = folded(evidence or "")
    return bool(phrase) and phrase in folded(f"{inp['title']}\n{inp['description']}")


def _value(v):
    return str(v).strip().lower() if isinstance(v, (str, int, float)) else ""


def validate(row, inp, tally, key=None):
    """The model's row for one input -> the answer to cache, or None where the row is rejected: a
    kind outside the list. Everything else is held to its list and the rest noted in `tally`: an
    axis value outside AXES is dropped and an axis capped at 2; an audience outside the list is
    "all"; a play outside its lists is null; works are capped at 3, and a work whose evidence is
    not in the text that was sent is dropped. Nothing here reads a registry: the cache holds what
    the model said."""
    kind = _value(row.get("kind"))
    if kind not in KINDS:
        tally["kind_rejected"].append({"key": key, "title": inp["title"], "kind": row.get("kind")})
        return None

    works, seen = [], set()
    for w in row.get("works") if isinstance(row.get("works"), list) else []:
        if not isinstance(w, dict) or not isinstance(w.get("name"), str) or not w["name"].strip():
            tally["works_malformed"] += 1
            continue
        name = " ".join(w["name"].split())
        if registry.resolve_key(name) in seen:   # one work, two spellings: the first stands
            continue
        seen.add(registry.resolve_key(name))
        works.append((name, w))
    if len(works) > MAX_WORKS:
        tally["works_over_cap"].append({"key": key, "title": inp["title"],
                                        "dropped": [name for name, _ in works[MAX_WORKS:]]})
        works = works[:MAX_WORKS]
    kept = []
    for name, w in works:
        evidence = w.get("evidence") if isinstance(w.get("evidence"), str) else ""
        if not evidence_holds(evidence, inp):
            tally["evidence_dropped"].append({"key": key, "title": inp["title"], "name": name,
                                              "evidence": evidence})
            continue
        kind_of = _value(w.get("type"))
        if kind_of not in registry.WORK_TYPES:
            tally["type_invalid"] += 1
            kind_of = None
        out = {"name": name, "evidence": " ".join(evidence.split()), "type": kind_of}
        if kind_of == "game":
            family = _value(w.get("family"))
            if family not in registry.GAME_FAMILIES:
                tally["family_invalid"] += 1
                family = None
            out["family"] = family
        kept.append(out)

    answer = {"kind": kind, "works": kept}
    for axis in AXIS_NAMES:
        values = []
        for v in row.get(axis) if isinstance(row.get(axis), list) else []:
            v = _value(v)
            if v not in registry.AXES[axis]:
                tally["axis_dropped"][f"{axis}: {v}"] += 1
            elif v not in values:
                values.append(v)
        if len(values) > registry.MAX_AXIS_VALUES:
            tally["axis_capped"] += len(values) - registry.MAX_AXIS_VALUES
        answer[axis] = values[:registry.MAX_AXIS_VALUES]

    audience = _value(row.get("audience"))
    if audience not in AUDIENCES:
        tally["audience_defaulted"][str(row.get("audience"))] += 1
        audience = "all"
    answer["audience"] = audience

    play = row.get("play")
    if play is not None:
        fmt = _value(play.get("format")) if isinstance(play, dict) else ""
        level = _value(play.get("level")) if isinstance(play, dict) else ""
        if fmt in PLAY_FORMATS and level in PLAY_LEVELS:
            play = {"format": fmt, "level": level}
        else:
            tally["play_nulled"][json.dumps(play, ensure_ascii=False)[:80]] += 1
            play = None
    answer["play"] = play
    return answer


# ---------------------------------------------------------------------------
# The cache
# ---------------------------------------------------------------------------

def in_order(answer):
    """An answer with its fields, and each work's, in the cache's fixed order."""
    out = {k: answer[k] for k in ANSWER_FIELDS}
    out["works"] = [{k: w[k] for k in WORK_FIELDS if k in w} for w in answer["works"]]
    return out


def cache_line(entry):
    return json.dumps({"key": entry["key"], "title": entry["title"], "model": entry["model"],
                       "answer": in_order(entry["answer"])}, ensure_ascii=False)


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
            if not isinstance(entry, dict) or tuple(entry) != CACHE_FIELDS:
                raise ValueError(f"{path}:{n}: not a cache entry {CACHE_FIELDS}")
            out[entry["key"]] = entry
    return out


def write_cache(path, cache):
    """Every entry, one a line, sorted by key, LF. Written beside the file and moved over it, so an
    interrupted write leaves the last good cache in place."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        for key in sorted(cache):
            f.write(cache_line(cache[key]) + "\n")
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# The requests
# ---------------------------------------------------------------------------

def api_transport(prompt, model, meta):
    meta["model"] = model
    return call_api(prompt, model)


def code_transport(prompt, model, meta):
    return call_claude_code(prompt, model, isolated=True, meta=meta)


def pick_transport(model=None):
    """(label, transport, model): the API when the environment has a key, else Claude Code."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "the Anthropic API", api_transport, model or API_MODEL
    return "Claude Code", code_transport, model or CODE_MODEL


def ask(batch, guide, transport, model):
    """One request: [(key, input)] -> ({key: the model's row}, what the request cost)."""
    prompt, ids = build_prompt(batch, guide)
    meta = {}
    started = time.monotonic()
    text = transport(prompt, model, meta)
    info = {"inputs": len(batch), "prompt_chars": len(prompt), "reply_chars": len(text),
            "seconds": round(time.monotonic() - started, 1), "model": meta.get("model") or model,
            "usage": meta.get("usage") or {}}
    rows = {}
    for row in parse_json_array(text):
        if isinstance(row, dict) and row.get("id") in ids and ids[row["id"]] not in rows:
            rows[ids[row["id"]]] = row
    return rows, info


def run_requests(todo, guide, transport, model, cache, save, tally, requests, *, per_request=PER_REQUEST,
                 workers=1, log=None, label="request"):
    """Ask about every (key, input) in `todo`, `per_request` to a request, caching each accepted
    answer and saving after every request. Returns (the keys not answered, stopped): a request that
    fails leaves all its keys unanswered, and STOP_AFTER_FAILURES failures in a row stop the run."""
    log = log or (lambda msg: None)
    batches = batches_of(todo, per_request)
    lock = threading.Lock()
    state = {"missing": [], "failures": 0, "stopped": False, "done": 0}

    def one(n, batch):
        if state["stopped"]:
            with lock:
                state["missing"] += [k for k, _ in batch]
            return
        try:
            rows, info = ask(batch, guide, transport, model)
        except Exception as exc:  # noqa: BLE001 - a transport or a reply we cannot read
            with lock:
                state["missing"] += [k for k, _ in batch]
                state["failures"] += 1
                state["stopped"] = state["failures"] >= STOP_AFTER_FAILURES
                requests.append({"label": label, "n": n, "inputs": len(batch), "error": str(exc)[:300]})
                log(f"  {label} {n}/{len(batches)} failed: {str(exc)[:200]}")
            return
        with lock:
            answered = rejected = missing = 0
            for key, inp in batch:
                row = rows.get(key)
                if row is None:
                    missing += 1
                    state["missing"].append(key)
                    continue
                answer = validate(row, inp, tally, key)
                if answer is None:
                    rejected += 1
                    state["missing"].append(key)
                    continue
                cache[key] = {"key": key, "title": inp["title"], "model": info["model"], "answer": answer}
                answered += 1
            save(cache)
            state["failures"] = 0
            state["done"] += 1
            requests.append({"label": label, "n": n, **info, "answered": answered, "rejected": rejected,
                             "missing": missing})
            log(f"  {label} {n}/{len(batches)}: {answered} answered, {rejected} rejected, {missing} missing, "
                f"{info['seconds']}s ({info['model']})")

    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(lambda nb: one(*nb), enumerate(batches, 1)))
    else:
        for n, batch in enumerate(batches, 1):
            one(n, batch)
    return state["missing"], state["stopped"]


def tag(todo, guide, transport, model, cache, save, *, per_request=PER_REQUEST, workers=1, log=None):
    """Ask about `todo` (sorted), then once more about whatever was missing or rejected. Returns
    (the keys still unanswered, the tally, the requests, stopped)."""
    tally, requests = new_tally(), []
    missing, stopped = run_requests(todo, guide, transport, model, cache, save, tally, requests,
                                    per_request=per_request, workers=workers, log=log)
    if missing and not stopped:
        by_key = dict(todo)
        again = sorted(((k, by_key[k]) for k in dict.fromkeys(missing)), key=request_order)
        missing, stopped = run_requests(again, guide, transport, model, cache, save, tally, requests,
                                        per_request=per_request, workers=workers, log=log, label="retry")
    return sorted(set(missing)), tally, requests, stopped


# ---------------------------------------------------------------------------
# Mint
# ---------------------------------------------------------------------------

def _winner(counter):
    """(the most common key, whether another key had as many). Ties go to the key that sorts first,
    folded, so the answer does not depend on the order anything was read in."""
    ranked = sorted(counter.items(), key=lambda kv: (-kv[1], ps.fold(str(kv[0])), str(kv[0])))
    return ranked[0][0], len(ranked) > 1 and ranked[1][1] == ranked[0][1]


def mint_plan(events, cache, reg):
    """What mint would add, calling nothing and writing nothing: every work name in the cache
    entries the current events use that the registry cannot resolve, one new work per
    registry.resolve_key - so "The X" and "X" are one work - id = registry.work_slug of the most
    used spelling, `reviewed: false`, type and family the most common in the answers.

    Not minted, and reported: a name that is a registry term (build drops it), and a slug that is
    already an id (build fails on it until a person adds an alias)."""
    counts = Counter(input_key(tagger_input(e)) for e in events)
    groups, terms = {}, {}
    for key in sorted(counts):
        entry = cache.get(key)
        if not entry:
            continue
        for w in entry["answer"]["works"]:
            name = w["name"]
            if reg.resolve_work(name):
                continue
            if reg.is_term(name):
                t = terms.setdefault(name, {"name": name, "events": 0, "titles": [], "evidence": []})
                t["events"] += counts[key]
                t["titles"].append(entry["title"])
                t["evidence"].append(w["evidence"])
                continue
            g = groups.setdefault(registry.resolve_key(name), {
                "spellings": Counter(), "types": Counter(), "families": Counter(), "evidence": [],
                "events": 0, "inputs": 0, "titles": [], "kinds": Counter()})
            g["spellings"][name] += counts[key]
            g["types"][w.get("type")] += 1
            if w.get("type") == "game":
                g["families"][w.get("family")] += 1
            if w["evidence"] not in g["evidence"]:
                g["evidence"].append(w["evidence"])
            g["events"] += counts[key]
            g["inputs"] += 1
            g["titles"].append(entry["title"])
            g["kinds"][entry["answer"]["kind"]] += counts[key]

    existing = {w["id"] for w in reg.works}
    plan = {"works": [], "details": [], "defaulted": [], "ties": [], "conflicts": [], "collisions": [],
            "terms": [terms[n] for n in sorted(terms, key=lambda n: (ps.fold(n), n))]}
    taken = set()
    for rk in sorted(groups):
        g = groups[rk]
        name, name_tie = _winner(g["spellings"])
        wid = registry.work_slug(name)
        if not wid or wid in existing or wid in taken:
            plan["collisions"].append({"name": name, "id": wid, "events": g["events"], "titles": g["titles"],
                                       "why": "no slug" if not wid else "the id is already taken"})
            continue
        taken.add(wid)
        if name_tie:
            plan["ties"].append({"id": wid, "field": "name", "counts": dict(g["spellings"])})
        types = Counter({t: n for t, n in g["types"].items() if t in registry.WORK_TYPES})
        if not types:
            kind = "franchise"
            plan["defaulted"].append({"id": wid, "field": "type", "value": kind})
        else:
            kind, tie = _winner(types)
            if tie:
                plan["ties"].append({"id": wid, "field": "type", "counts": dict(types)})
            elif len(types) > 1:
                plan["conflicts"].append({"id": wid, "field": "type", "counts": dict(types)})
        row = {"id": wid, "name": name, "aliases": [], "type": kind}
        if kind == "game":
            families = Counter({f: n for f, n in g["families"].items() if f in registry.GAME_FAMILIES})
            if not families:
                family = "video"
                plan["defaulted"].append({"id": wid, "field": "family", "value": family})
            else:
                family, tie = _winner(families)
                if tie:
                    plan["ties"].append({"id": wid, "field": "family", "counts": dict(families)})
                elif len(families) > 1:
                    plan["conflicts"].append({"id": wid, "field": "family", "counts": dict(families)})
            row["family"] = family
        row["reviewed"] = False
        plan["works"].append(row)
        plan["details"].append({"id": wid, "name": name, "type": kind, "family": row.get("family"),
                                "events": g["events"], "inputs": g["inputs"], "evidence": g["evidence"],
                                "titles": g["titles"], "kinds": dict(g["kinds"]),
                                "spellings": dict(g["spellings"])})
    return plan


def acyclic(found, parents):
    """The parent links in `found` that make no work its own ancestor, applied in id order."""
    parents, out = dict(parents), {}
    for wid in sorted(found):
        at, seen = found[wid], set()
        while at is not None and at != wid and at not in seen:
            seen.add(at)
            at = parents.get(at)
        if at != wid:
            parents[wid] = found[wid]
            out[wid] = found[wid]
    return out


def place_parents(new, reg, transport, model):
    """{new id: parent id} for the planned works, from draft_people's parent prompt and its closed
    list: the registry's works and the planned ones. A failed request raises, and nothing is
    written; a work the model leaves out, or gives no parent, stays top-level."""
    known = list(reg.works) + list(new)
    ids, minted, found = {w["id"] for w in known}, {w["id"] for w in new}, {}
    asked = lambda prompt, m: transport(prompt, m, {})  # noqa: E731 - draft_people's two-argument shape
    for batch in batches_of(list(new), dp.PARENTS_PER_REQUEST):
        found.update(dp.ask_parents(batch, known, asked, model, minted, ids))
    return acyclic(found, {w["id"]: w.get("parent") for w in reg.works})


def write_works(directory, reg, new):
    """works.json with the new rows added, sorted by id and in the registry's key order - written
    the way draft_people writes it, so the diff is the added rows - once the registry, new rows
    and all, has been shown to load."""
    rows = [dp.in_order(w, dp.WORK_KEYS) for w in sorted(list(reg.works) + list(new), key=lambda w: w["id"])]
    with tempfile.TemporaryDirectory() as tmp:
        dp.write_json(os.path.join(tmp, "works.json"), rows)
        for name in ("people.json", "tracks.json"):
            shutil.copy(os.path.join(directory, name), tmp)
        registry.load(tmp)
    dp.write_json(os.path.join(directory, "works.json"), rows)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def err(msg=""):
    print(msg, file=sys.stderr, flush=True)


def read_events(path):
    with open(path, "rb") as f:   # read-only: the 2026 schedule is frozen (#13, #33)
        return json.loads(f.read().decode("utf-8"))["events"]


def dry_run(events, inputs, todo, guide, label, model, per_request, cached):
    batches = batches_of(todo, per_request)
    sizes = [len(build_prompt(b, guide)[0]) for b in batches]
    rules = len(build_prompt([], guide)[0]) - len(guide)
    over = sum(1 for e in events if over_cap(e))
    err(f"{len(events):,} events, {len(inputs):,} distinct inputs, {over} description(s) over "
        f"{DESCRIPTION_CAP:,} characters")
    err(f"{cached:,} cached, {len(todo):,} to send in {len(batches)} request(s) of up to "
        f"{per_request}, via {label} ({model})")
    if sizes:
        err(f"prompt characters: longest {max(sizes):,}, mean {sum(sizes) // len(sizes):,} "
            f"(the rules {rules:,}, the works guide {len(guide):,}, the events the rest)")
        tin, tout = sum(sizes) // CHARS_PER_TOKEN, len(todo) * TOKENS_PER_ANSWER
        err(f"tokens, estimated: ~{tin:,} in at {CHARS_PER_TOKEN} characters a token, ~{tout:,} out at "
            f"~{TOKENS_PER_ANSWER} an answer")
    if label == "Claude Code":
        err("command: " + subprocess.list2cmdline(claude_code_command(model, isolated=True)))
        err(f"  the prompt on stdin, run in {tag_events.ISOLATED_DIR} (empty); Claude Code adds about "
            f"6,100 tokens of its own context to each request")
    return {"events": len(events), "inputs": len(inputs), "over_cap": over, "to_send": len(todo),
            "requests": len(batches), "prompt_chars": sizes}


def report_mint(plan, wrote):
    works = plan["works"]
    for d in plan["defaulted"]:   # first, so a defaulted type or family is read before anything else
        err(f"  defaulted: {d['id']} {d['field']} = {d['value']} (no answer gave a valid one)")
    for d in plan["details"]:
        err(f"  {'minted' if wrote else 'would mint'}: {d['id']} ({d['type']}"
            f"{'/' + d['family'] if d['family'] else ''}) - {d['events']} event(s), evidence "
            f"{', '.join(repr(e) for e in d['evidence'][:3])}")
    for t in plan["ties"] + plan["conflicts"]:
        err(f"  {'tie' if t in plan['ties'] else 'conflict'}: {t['id']} {t['field']} {t['counts']}")
    for c in plan["collisions"]:
        err(f"  not minted: {c['name']!r} -> {c['id']!r}: {c['why']} ({c['events']} event(s))")
    for t in plan["terms"]:
        err(f"  a registry term, not minted: {t['name']!r} ({t['events']} event(s))")
    err(f"mint: {len(works)} new work(s), {len(plan['collisions'])} collision(s), "
        f"{len(plan['terms'])} term name(s), {len(plan['defaulted'])} defaulted field(s)")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--events", default=EVENTS)
    ap.add_argument("--registry", default=registry.DIR)
    ap.add_argument("--cache", default=CACHE)
    ap.add_argument("--model", default=None, help="an API model id, or a Claude Code alias or id")
    ap.add_argument("--per-request", type=int, default=PER_REQUEST)
    ap.add_argument("--workers", type=int, default=1, help="requests in flight at once")
    ap.add_argument("--only", help="a file of event ids, one a line: ask only about the inputs they use")
    ap.add_argument("--dry-run", action="store_true", help="build every prompt, call nothing, write nothing")
    ap.add_argument("--mint-only", action="store_true", help="mint from the cache with no model, and no parents")
    ap.add_argument("--no-mint", action="store_true", help="tag only: the registry is not touched")
    ap.add_argument("--no-parents", action="store_true", help="mint without asking for parents")
    ap.add_argument("--report", help="write the run report here, as JSON (not committed)")
    args = ap.parse_args(argv)

    events = read_events(args.events)
    reg = registry.load(args.registry)
    inputs, keys = distinct_inputs(events)
    cache = load_cache(args.cache)
    label, transport, model = pick_transport(args.model)
    report = {"transport": label, "model": model, "events": len(events), "inputs": len(inputs)}

    if not args.mint_only:
        wanted = set(inputs)
        if args.only:
            with open(args.only, encoding="utf-8") as f:
                ids = {line.strip() for line in f if line.strip()}
            wanted = {k for e, k in zip(events, keys) if e.get("id") in ids}
        todo = sorted(((k, inputs[k]) for k in wanted if k not in cache), key=request_order)
        guide = works_guide(reg.works)
        if args.dry_run:
            report["dry_run"] = dry_run(events, inputs, todo, guide, label, model, args.per_request,
                                        sum(1 for k in inputs if k in cache))
            if args.report:
                dp.write_json(args.report, report)
            return 0
        err(f"{len(inputs):,} distinct inputs, {sum(1 for k in inputs if k in cache):,} cached, {len(todo):,} to send "
            f"via {label} ({model})" + (f"; --only asks about {len(wanted):,}" if args.only else ""))
        missing, tally, requests, stopped = tag(todo, guide, transport, model, cache,
                                                lambda c: write_cache(args.cache, c),
                                                per_request=args.per_request, workers=args.workers, log=err)
        report.update({"sent": len(todo), "requests": requests, "unanswered":
                       [{"key": k, "title": inputs[k]["title"]} for k in missing],
                       "stopped": stopped, "tally": tally})
        err(f"tagged: {len(todo) - len(missing):,} of {len(todo):,}; evidence dropped "
            f"{len(tally['evidence_dropped'])} link(s), works over the cap {len(tally['works_over_cap'])}, "
            f"kind rejected {len(tally['kind_rejected'])} time(s)")
        for k in missing:
            err(f"  unanswered: {inputs[k]['title']}")
        if stopped:
            err(f"stopped after {STOP_AFTER_FAILURES} failed requests in a row; the cache holds every answer "
                f"so far, and running again resumes")

    status = 0
    if not args.no_mint:
        plan = mint_plan(events, cache, reg)
        placed = {}
        if plan["works"] and not (args.mint_only or args.no_parents):
            try:
                placed = place_parents(plan["works"], reg, transport, model)
            except Exception as exc:  # noqa: BLE001
                err(f"the parents request failed ({str(exc)[:200]}): works.json is not written. "
                    f"Run again, or pass --no-parents to mint with no parents.")
                plan["parents_failed"] = str(exc)[:300]
                status = 1
        if status == 0 and plan["works"]:
            for w in plan["works"]:
                if w["id"] in placed:
                    w["parent"] = placed[w["id"]]
            write_works(args.registry, reg, plan["works"])
        plan["parents"] = placed
        report_mint(plan, wrote=status == 0)
        if args.mint_only and plan["works"]:
            err(f"--mint-only: {len(plan['works'])} work(s) minted with no parent asked")
        elif plan["works"] and status == 0:
            err(f"parents: {len(placed)} of {len(plan['works'])} placed; the rest stay top-level")
        report["mint"] = plan
    if args.report:
        dp.write_json(args.report, report)
    if not args.mint_only and report.get("unanswered"):
        status = 1
    return status


if __name__ == "__main__":
    sys.exit(main())
