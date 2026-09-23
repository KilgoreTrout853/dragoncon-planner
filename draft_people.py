#!/usr/bin/env python3
"""Draft people into data/registry/people.json with a model, for a person to review (DECISIONS #31).

Candidates are everyone `parse_stage.people_for` names on an event whose v1 tags say
`guests: celebrity`, or an ad hoc list with --names. Anyone `registry.resolve_person` already
finds - in `people.json` by name or alias - and anyone the sidecar records as rejected is skipped,
so a second run drafts nothing and calls nothing.

    python draft_people.py                    # `claude -p --model claude-opus-5` on your subscription
    ANTHROPIC_API_KEY=sk-... python draft_people.py       # the Anthropic API, claude-opus-5
    python draft_people.py --names FILE --dry-run

Nothing here is reviewed. Every person is written `reviewed: false`, every credit
`reviewed: false`, and every work the model proposes `reviewed: false`; `tools/review-people.html`
is what turns those into true. The model's own "not a guest" answer writes no person at all - it
writes a rejection to the sidecar, which is what makes a second run quiet.

The sidecar, `data/registry/people.draft.json`, holds what does not belong in the registry: each
person's `known_for`, the model's confidence, the event titles it was shown, and the rejected ids
with who rejected them. `registry.load` ignores it.
"""

import argparse
import json
import os
import sys
from collections import Counter

import parse_stage as ps
import registry
from tag_events import call_api, call_claude_code, parse_json_array

EVENTS = os.path.join("data", "2026", "events.json")
SIDECAR = os.path.join("data", "registry", "people.draft.json")
API_MODEL = "claude-opus-5"   # the current Opus id
# A full id on Claude Code too, never an alias, as the tag stage asks (DECISIONS #34): an alias moves with
# the CLI, and on claude 2.1.145 (2026-09-21) `opus` was claude-opus-4-7.
CODE_MODEL = "claude-opus-5"
PER_REQUEST = 20
MAX_TITLES = 8
MAX_CREDITS = registry.MAX_CREDITS
TIERS = ("celebrity", "creator", "none")
CONFIDENCE = ("high", "low")

PROMPT = """You are drafting a registry of people for Dragon Con 2026, a very large science
fiction, fantasy and pop-culture convention. A reader follows a person to find the events they are
on, so the registry needs to know who each person is and what a con-goer would follow them for.

For each person below you are given the role they are credited with and up to {max_titles} titles
of events they appear on. Return one object per person, in the same order, with these fields:
- "id": copy exactly.
- "tier": "celebrity" for a performer guest - an actor, a voice actor, a billed musician;
  "creator" for an author, artist, scientist, podcaster, game designer or other maker; "none" for
  a moderator, a track director or convention staff, or anyone you do not recognise. "none" is the
  right answer whenever you are not sure the person is a public figure.
- "known_for": one short line, plainly worded, saying who they are. "" when the tier is "none".
- "credits": up to {max_credits} works a con-goer would follow this person for, strongest first.
  Each is an object: {{"work": "the work's name"}}, and where the work is not a household name add
  "type" ("franchise" or "game"), "family" for a game ("rpg", "ccg", "board", "miniatures",
  "video"), and "parent" (the name of the work it plainly belongs to) when it is a child of a
  bigger one. Use the name people know the work by. Fewer credits when you are unsure, none rather
  than a guess, and never a work you are not certain exists. [] when the tier is "none".
- "confidence": "high" when you are confident of the person and the credits, "low" otherwise.

Return ONLY a JSON array of these objects. No prose, no code fences.

People:
{people}"""


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

def candidates(events):
    """Everyone on a `guests: celebrity` event: {id: {name, roles, titles}}, in first-seen order."""
    out = {}
    for e in events:
        if (e.get("tags") or {}).get("guests") != "celebrity":
            continue
        for p in ps.people_for(e):
            seen = out.setdefault(p["id"], {"id": p["id"], "name": p["name"],
                                            "roles": Counter(), "titles": []})
            seen["roles"][p["role"]] += 1
            if e["title"] not in seen["titles"]:
                seen["titles"].append(e["title"])
    return out


def by_names(events, names):
    """The same shape for an ad hoc list of names: what the schedule knows about each."""
    want = {ps.person_slug(n): n for n in names if ps.person_slug(n)}
    out = {}
    for e in events:
        for p in ps.people_for(e):
            if p["id"] in want:
                seen = out.setdefault(p["id"], {"id": p["id"], "name": p["name"],
                                                "roles": Counter(), "titles": []})
                seen["roles"][p["role"]] += 1
                if e["title"] not in seen["titles"]:
                    seen["titles"].append(e["title"])
    for pid, name in want.items():   # a name the schedule never mentions is still a candidate
        out.setdefault(pid, {"id": pid, "name": name, "roles": Counter(), "titles": []})
    return out


def to_draft(found, reg, rejected):
    """The candidates that are neither known nor already rejected. `resolve_person` and not a bare
    id lookup, so a person the registry holds under another spelling is skipped too: "Pat Henry -
    President of Dragon Con" is an alias of `pat-henry`, not a second person."""
    out = []
    for pid in sorted(found):
        person = found[pid]
        if pid in rejected or reg.resolve_person(person["name"]) or reg.resolve_person(pid):
            continue
        out.append(person)
    return out


# ---------------------------------------------------------------------------
# The request
# ---------------------------------------------------------------------------

def build_prompt(batch):
    people = [{"id": p["id"], "name": p["name"],
               "role": ", ".join(f"{r} x{k}" if k > 1 else r for r, k in sorted(p["roles"].items())),
               "events": p["titles"][:MAX_TITLES]} for p in batch]
    return PROMPT.format(max_titles=MAX_TITLES, max_credits=MAX_CREDITS,
                         people=json.dumps(people, ensure_ascii=False, indent=0))


def clean_row(row):
    """One answer, held to the shapes the registry and the sidecar accept."""
    tier = str(row.get("tier", "none")).strip().lower()
    credits = []
    for c in row.get("credits") or []:
        name = (c.get("work") if isinstance(c, dict) else c) or ""
        if not str(name).strip():
            continue
        credits.append({"work": str(name).strip(),
                        "type": c.get("type") if isinstance(c, dict) else None,
                        "family": c.get("family") if isinstance(c, dict) else None,
                        "parent": c.get("parent") if isinstance(c, dict) else None})
    confidence = str(row.get("confidence", "low")).strip().lower()
    return {
        "id": row.get("id"),
        "tier": tier if tier in TIERS else "none",
        "known_for": " ".join(str(row.get("known_for") or "").split()),
        "credits": credits[:MAX_CREDITS],
        "confidence": confidence if confidence in CONFIDENCE else "low",
    }


def ask(batch, transport, model):
    rows = parse_json_array(transport(build_prompt(batch), model))
    out = {}
    for row in rows:
        if isinstance(row, dict) and row.get("id"):
            out[row["id"]] = clean_row(row)
    return out


# ---------------------------------------------------------------------------
# Folding the answers into the registry
# ---------------------------------------------------------------------------

def resolve_credits(answer, reg, new_works):
    """A credit's work by name through the registry; one it does not hold becomes a new work,
    `reviewed: false`, drafted once however many people name it. The cap holds after resolving,
    because two names can be one work."""
    out, seen = [], set()
    for c in answer["credits"]:
        wid = reg.resolve_work(c["work"]) or new_works.get(registry.resolve_key(c["work"]), {}).get("id")
        if not wid:
            wid = registry.work_slug(c["work"])
            if not wid:
                continue
            kind = c.get("type") if c.get("type") in registry.WORK_TYPES else "franchise"
            work = {"id": wid, "name": c["work"], "aliases": [], "type": kind}
            if kind == "game":
                work["family"] = c["family"] if c.get("family") in registry.GAME_FAMILIES else "video"
            parent = reg.resolve_work(c.get("parent") or "")
            if parent:
                work["parent"] = parent
            work["reviewed"] = False
            new_works[registry.resolve_key(c["work"])] = work
        if wid not in seen:
            seen.add(wid)
            out.append({"work": wid, "reviewed": False})
    return out[:MAX_CREDITS]


def fold(answers, found, reg):
    """(people, new works, sidecar entries, rejections). A `none` answer writes no person: it
    writes a rejection, which is what a second run reads to stay quiet."""
    people, new_works, notes, rejected = [], {}, {}, []
    for pid in sorted(answers):
        answer, person = answers[pid], found.get(pid)
        if not person:
            continue
        notes[pid] = {"name": person["name"], "known_for": answer["known_for"],
                      "confidence": answer["confidence"], "events": person["titles"][:MAX_TITLES]}
        if answer["tier"] == "none":
            rejected.append({"id": pid, "by": "model", "name": person["name"],
                             "events": person["titles"][:MAX_TITLES]})
            continue
        people.append({"id": pid, "name": person["name"], "aliases": [], "tier": answer["tier"],
                       "credits": resolve_credits(answer, reg, new_works), "reviewed": False})
    return people, list(new_works.values()), notes, rejected


PARENT_PROMPT = """You are tidying a registry of works for a Dragon Con schedule. Each work below
needs to know whether it belongs inside a bigger one the registry already holds.

For each work in "works", return one object:
- "id": copy exactly.
- "parent": the id of the work it plainly belongs to, chosen ONLY from the "registry" list below,
  or null.

A distinct title inside a franchise the registry holds is a child of that franchise: a film, a
series, a game or a book set in it. A work that belongs to no franchise in the list gets null, and
so does one you are unsure of. Never invent an id; never make a work its own parent.

Return ONLY a JSON array of these objects. No prose, no code fences.

registry:
{registry}

works:
{works}"""
PARENTS_PER_REQUEST = 40


def parent_prompt(batch, known):
    return PARENT_PROMPT.format(
        registry=json.dumps([{"id": w["id"], "name": w["name"]} for w in known],
                            ensure_ascii=False, indent=0),
        works=json.dumps([{"id": w["id"], "name": w["name"]} for w in batch],
                         ensure_ascii=False, indent=0))


def clean_parents(rows, minted, ids):
    """{work id: parent id} for the answers that name a work being tidied and a parent the registry
    holds. A closed list: an id the registry does not have is dropped, and so is a self-parent."""
    out = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        wid, parent = row.get("id"), row.get("parent")
        if wid in minted and isinstance(parent, str) and parent in ids and parent != wid:
            out[wid] = parent
    return out


def ask_parents(batch, known, transport, model, minted, ids):
    return clean_parents(parse_json_array(transport(parent_prompt(batch, known), model)), minted, ids)


def looks_double_encoded(s):
    """True where a string is UTF-8 that something decoded as cp1252: "Les MisÃ©rables" for "Les
    Misérables". `tag_events.call_claude_code` used to do that on Windows; the summary checks every
    string the model returned so a transport that regresses says so instead of writing it down."""
    try:
        return s.encode("cp1252").decode("utf-8") != s
    except (UnicodeEncodeError, UnicodeDecodeError):
        return False


def damaged(people, works, notes):
    """Every model-returned string that looks double-encoded: work names and known_for lines. A
    person's name is the schedule's, not the model's, so it is not at risk."""
    out = [w["name"] for w in works if looks_double_encoded(w["name"])]
    out += [n["known_for"] for n in notes.values() if looks_double_encoded(n["known_for"])]
    return sorted(out)


PERSON_KEYS = ("id", "name", "aliases", "tier", "credits", "reviewed")   # a work's are registry.WORK_KEYS


def in_order(row, keys):
    """One entry with its keys in the registry's own order, so setting a field late - a parent, on
    the second pass - does not leave it after `reviewed` and rewrite the line for every reader. A
    key not in `keys` is not written."""
    return {k: row[k] for k in keys if k in row}


def load_sidecar(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return {"people": {}, "rejected": [], "minted": []}
    return {"people": data.get("people") or {}, "rejected": data.get("rejected") or [],
            "minted": data.get("minted") or []}


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:  # LF on Windows too (.gitattributes)
        if not isinstance(data, list):
            json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
        elif not data:
            f.write("[]\n")
        else:  # one entry a line, as the seeded registries are written
            f.write("[\n" + ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in data) + "\n]\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", default=EVENTS)
    ap.add_argument("--registry", default=registry.DIR)
    ap.add_argument("--sidecar", default=SIDECAR)
    ap.add_argument("--names", help="a file of names, one per line, instead of the celebrity events")
    ap.add_argument("--per-request", type=int, default=PER_REQUEST)
    ap.add_argument("--limit", type=int, default=0, help="only draft the first N candidates")
    ap.add_argument("--model", default=None)
    ap.add_argument("--dry-run", action="store_true", help="build the prompts, call nothing")
    ap.add_argument("--parents", action="store_true",
                    help="a second pass: give each minted work a parent from the registry, or none")
    args = ap.parse_args()

    reg = registry.load(args.registry)
    use_api = bool(os.environ.get("ANTHROPIC_API_KEY"))
    transport = call_api if use_api else call_claude_code
    model = args.model or (API_MODEL if use_api else CODE_MODEL)
    if args.parents:
        return parents_pass(reg, args, transport, model)
    with open(args.file, encoding="utf-8") as f:
        events = json.load(f)["events"]
    found = by_names(events, [n.strip() for n in open(args.names, encoding="utf-8")
                              if n.strip()]) if args.names else candidates(events)
    sidecar = load_sidecar(args.sidecar)
    rejected_ids = {r["id"] for r in sidecar["rejected"] if isinstance(r, dict) and r.get("id")}
    todo = to_draft(found, reg, rejected_ids)
    if args.limit:
        todo = todo[:args.limit]
    batches = [todo[i:i + args.per_request] for i in range(0, len(todo), args.per_request)]

    print(f"{len(found)} candidates, {len(found) - len(todo)} already known or rejected, "
          f"{len(todo)} to draft in {len(batches)} request(s) via "
          f"{'the API' if use_api else 'Claude Code'} ({model})", file=sys.stderr)
    if args.dry_run:
        if batches:
            print(build_prompt(batches[0])[:2000])
        return
    if not todo:
        print("Nothing to draft.", file=sys.stderr)
        return

    answers = {}
    for i, batch in enumerate(batches, 1):
        try:
            answers.update(ask(batch, transport, model))
            print(f"  request {i}/{len(batches)}: {len(answers)} answered", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            print(f"  request {i}/{len(batches)} failed: {str(exc)[:200]}", file=sys.stderr)

    people, new_works, notes, rejections = fold(answers, {p["id"]: p for p in todo}, reg)
    people = sorted(reg.people + people, key=lambda p: p["id"])
    works = sorted(reg.works + new_works, key=lambda w: w["id"])
    sidecar["people"].update(notes)
    sidecar["rejected"] += rejections
    # what this run minted, and only that - never the registry's own works - so the review page knows which works it
    # may drop again
    sidecar["minted"] = sorted(set(sidecar["minted"]) | {w["id"] for w in new_works})
    write_json(os.path.join(args.registry, "people.json"),
               [in_order(p, PERSON_KEYS) for p in people])
    write_json(os.path.join(args.registry, "works.json"),
               [in_order(w, registry.WORK_KEYS) for w in works])
    write_json(args.sidecar, sidecar)

    hurt = damaged(people, works, notes)
    if hurt:
        print(f"  WARNING: {len(hurt)} model-returned string(s) look double-encoded, e.g. "
              f"{hurt[0]!r} - check the transport's encoding", file=sys.stderr)
    tiers = Counter(p["tier"] for p in people if p.get("tier"))
    low = sum(1 for n in notes.values() if n["confidence"] == "low")
    print(f"drafted {len(people) - len(reg.people)} people "
          f"({tiers['celebrity']} celebrity, {tiers['creator']} creator total), "
          f"{len(rejections)} none, {sum(len(p['credits']) for p in people)} credits, "
          f"{len(works) - len(reg.works)} new works, {low} low confidence, "
          f"{len(hurt)} strings double-encoded", file=sys.stderr)


def parents_pass(reg, args, transport, model):
    """The narrow second pass. Only the works this drafter minted are tidied; the registry's own
    works are sent as the closed list of parents to choose from and are never changed."""
    sidecar = load_sidecar(args.sidecar)
    by_id = reg.by_id()
    minted = [by_id[w] for w in sidecar["minted"] if w in by_id]
    todo = [w for w in minted if not w.get("parent")]
    batches = [todo[i:i + PARENTS_PER_REQUEST] for i in range(0, len(todo), PARENTS_PER_REQUEST)]
    print(f"{len(minted)} minted works, {len(minted) - len(todo)} already have a parent, "
          f"{len(todo)} to place in {len(batches)} request(s) via "
          f"{'the API' if os.environ.get('ANTHROPIC_API_KEY') else 'Claude Code'} ({model})",
          file=sys.stderr)
    if args.dry_run:
        if batches:
            print(parent_prompt(batches[0], reg.works)[:2000])
        return
    if not todo:
        print("Nothing to place.", file=sys.stderr)
        return

    ids, mint_ids, found = set(by_id), {w["id"] for w in minted}, {}
    for i, batch in enumerate(batches, 1):
        try:
            found.update(ask_parents(batch, reg.works, transport, model, mint_ids, ids))
            print(f"  request {i}/{len(batches)}: {len(found)} placed", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            print(f"  request {i}/{len(batches)} failed: {str(exc)[:200]}", file=sys.stderr)

    for wid, parent in found.items():
        by_id[wid]["parent"] = parent
    works = sorted(reg.works, key=lambda w: w["id"])
    write_json(os.path.join(args.registry, "works.json"),
               [in_order(w, registry.WORK_KEYS) for w in works])
    print(f"placed {len(found)} of {len(todo)}; {len(todo) - len(found)} stay top-level",
          file=sys.stderr)


if __name__ == "__main__":
    main()
