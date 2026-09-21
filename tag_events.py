#!/usr/bin/env python3
"""Tag every event in data/2026/events.json with fandoms, kind, topics, and 18+ using Claude.

The tags power the Fandom picker, the kind chips, the 18+ filter, and search in index.html.

Retired for 2026: the schedule is frozen (DECISIONS #13, #33), and main() refuses to write
data/2026/events.json. Tags v2 are tag_stage.py (the model, cached) and events_v2.py (no model).
KINDS, TOPICS, CANON, the two transports and parse_json_array stay here: the census, the drafter
and the tag stage import them.

Two ways to run:
    ANTHROPIC_API_KEY=sk-... python tag_events.py     # Anthropic API (claude-haiku-4-5, cheap)
    python tag_events.py                               # Claude Code's `claude -p` on your subscription

By default only untagged events are sent, so re-running after a refresh tags just the new ones.
The scraper preserves existing tags across refreshes.

Options:
    --all           retag everything
    --limit N       only process the first N untagged events (smoke test)
    --batch 40      events per request
    --workers 3     parallel requests
    --model NAME    API model id, or Claude Code alias (default: claude-haiku-4-5-20251001 / haiku)
    --dry-run       build the prompts, don't call anything
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

EVENTS = "data/2026/events.json"
# The frozen schedule by where it is, not by the name --file was given, so no spelling of the path
# gets past the refusal in main().
FROZEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "2026", "events.json")
REFUSAL = ("tag_events.py will not write data/2026/events.json: the 2026 schedule is frozen "
           "(DECISIONS #13, #33). Tags v2 are `python tag_stage.py`, which asks the model and caches "
           "its answers in data/2026/tags.cache.jsonl, and `python events_v2.py`, which writes "
           "data/2026/events.v2.json with no model.")
# Where the tag stage's `claude -p` runs: an empty directory of its own (see call_claude_code).
ISOLATED_DIR = os.path.join(tempfile.gettempdir(), "dragoncon-tagger")
KINDS = ["qa", "panel", "screening", "workshop", "signing", "photo", "contest", "performance",
         "party", "gaming", "reading", "tour", "other"]
TOPICS = ["Space", "Science", "Writing", "Costuming", "Props & Making", "Comics", "Animation", "Anime",
          "Film", "TV", "Literature", "Music", "Comedy", "History", "Tech", "Kids", "Horror", "Fantasy",
          "Sci-Fi", "Gaming", "Tabletop", "Fitness", "Food", "Podcasting", "Art", "Community",
          "Politics", "Fandom Culture", "Puppetry", "Cosplay Photography", "Skepticism", "Paranormal"]
# Map common variants to one canonical fandom name so the picker doesn't show five Marvels.
CANON = {
    "mcu": "Marvel", "marvel cinematic universe": "Marvel", "marvel comics": "Marvel",
    "dnd": "Dungeons & Dragons", "d&d": "Dungeons & Dragons", "dungeons and dragons": "Dungeons & Dragons",
    "lotr": "The Lord of the Rings", "lord of the rings": "The Lord of the Rings", "tolkien": "The Lord of the Rings",
    "star trek: the next generation": "Star Trek", "star trek: discovery": "Star Trek", "star trek: strange new worlds": "Star Trek",
    "rick & morty": "Rick and Morty", "expanse": "The Expanse", "warhammer 40k": "Warhammer 40,000",
    "warhammer 40000": "Warhammer 40,000", "warhammer": "Warhammer 40,000", "got": "Game of Thrones",
    "dc": "DC Comics", "dc universe": "DC Comics", "dceu": "DC Comics", "batman": "DC Comics",
    "star wars: andor": "Star Wars", "the mandalorian": "Star Wars", "doctor who": "Doctor Who", "dr who": "Doctor Who",
    "mtg": "Magic: The Gathering", "magic the gathering": "Magic: The Gathering",
    "harry potter": "Harry Potter", "wizarding world": "Harry Potter", "video game": "Video Games", "videogames": "Video Games",
}

PROMPT = """You are tagging events from Dragon Con 2026, a very large science fiction, fantasy, and pop-culture convention, so an attendee can filter the 3,600-event schedule by interest.

For each event below, return one object with these fields:
- "id": copy exactly.
- "fandoms": 0 to 3 franchise or property names the event is centrally about, using franchise-level canonical names: "Marvel" (not MCU or Avengers), "DC Comics", "Star Trek" (not TNG), "Star Wars", "Dungeons & Dragons", "The Lord of the Rings", "Game of Thrones", "Doctor Who", "Rick and Morty", "The Expanse", "Harry Potter", "Warhammer 40,000", "Magic: The Gathering", "Pokemon", "Stranger Things", "Buffy the Vampire Slayer". Use the show or game's proper title for others. Use "Video Games" or "Anime" only when no specific property is named. Empty list if it's not about a particular property (most science, writing-craft, costuming, and gaming panels).
- "kind": exactly one of {kinds}. qa = an appearance, Q&A, or spotlight featuring actors, creators, or notable named guests; panel = a fan-run or expert discussion; screening = a film, episode, or video showing; workshop = hands-on or how-to; signing = autographs; photo = photo ops or photo sessions; contest = a competition, contest, or tournament with winners; performance = concerts, comedy, puppetry, wrestling, burlesque, theatrical shows; party = dances, socials, mixers, meetups; gaming = open play, RPG sessions, LAN, demo tables; reading = author readings; tour = walking tours; other.
- "topics": 0 to 3 chosen only from this list: {topics}.
- "adult": true only if it is 18+ or adults-only or explicitly sexual; otherwise false.
- "guests": "celebrity" if named screen or media stars appear, "creator" if authors, artists, scientists, or industry professionals lead it, "fan" if fan-run, "unknown" if unclear.

Return ONLY a JSON array of these objects, one per event, in the same order. No prose, no code fences.

Events:
{events}"""


def build_prompt(batch):
    slim = [{
        "id": e["id"], "title": e["title"], "track": e.get("track", ""), "type": e.get("type", ""),
        "speakers": ", ".join(p["name"] + (f" ({p['role']})" if p.get("role") and p["role"] not in ("Speaker", "Panelist") else "")
                              for p in e.get("speakers", []))[:300],
        "description": (e.get("description") or "")[:600],
    } for e in batch]
    return PROMPT.format(kinds=", ".join(KINDS), topics=", ".join(TOPICS),
                         events=json.dumps(slim, ensure_ascii=False, indent=0))


# ---------------------------------------------------------------------------
# Two transports
# ---------------------------------------------------------------------------

def call_api(prompt, model):
    import requests  # already installed for the scraper
    r = requests.post("https://api.anthropic.com/v1/messages", timeout=180,
                      headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                               "content-type": "application/json"},
                      json={"model": model, "max_tokens": 8000, "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json()["content"])


def claude_code_command(model, isolated=False):
    """The command line call_claude_code runs. The prompt is not on it: it goes on stdin."""
    cmd = ["claude", "-p", "--output-format", "json" if isolated else "text"]
    if isolated:
        cmd += ["--tools", "", "--strict-mcp-config", "--no-session-persistence"]
    if model:
        cmd += ["--model", model]
    return cmd


def isolated_dir():
    """The empty directory the tag stage's `claude -p` runs in. Claude Code reads a CLAUDE.md from
    the working directory and every directory above it, and keys its memory on the working
    directory, so an empty directory of its own keeps both out of the request. One fixed place,
    because Claude Code makes an (empty) memory folder for every directory it is run from."""
    os.makedirs(ISOLATED_DIR, exist_ok=True)
    if os.listdir(ISOLATED_DIR):
        raise RuntimeError(f"{ISOLATED_DIR} must be empty: whatever is in it rides along with every request")
    return ISOLATED_DIR


def call_claude_code(prompt, model, *, isolated=False, meta=None):
    """`claude -p` on the subscription. The prompt goes on stdin, not on the command line: Windows
    caps a command line at 32,767 characters, and a tag stage prompt runs past 30,000.

    `isolated=True` is the tag stage's: no tools and no MCP servers (`--tools ""`,
    `--strict-mcp-config`), no session saved (`--no-session-persistence`), and run from an empty
    directory of its own, so that no CLAUDE.md and no project memory ride along. A request then
    carries about 6,100 tokens of Claude Code's own context instead of 24,000 to 32,000 (CLI
    2.1.145, measured 2026-09-21). The reply is read from `--output-format json`, which names the
    model that answered - `sonnet` is an alias, not an id - and when `meta` is a dict that id goes
    in meta["model"] and the token counts in meta["usage"]. There is no fallback to the default
    model: the tag stage records the model it asked for, or fails.

    The default is the call draft_people.py has always made, the prompt now on stdin."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDECODE")}  # allow running from inside Claude Code
    # encoding, not the locale's: text=True alone decodes with locale.getencoding(), which is
    # cp1252 on Windows, and every non-ASCII character the model returns comes back double-encoded
    # ("Les MisÃ©rables"). The model answers in UTF-8 whatever the console is set to, and the prompt
    # goes out in UTF-8 the same way.
    if isolated:
        res = subprocess.run(claude_code_command(model, isolated=True), input=prompt, capture_output=True,
                             text=True, encoding="utf-8", timeout=600, env=env, cwd=isolated_dir())
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip()[:300] or res.stdout.strip()[:300] or f"claude exited {res.returncode}")
        out = json.loads(res.stdout)
        if out.get("is_error") or out.get("subtype") != "success":
            raise RuntimeError(f"claude: {out.get('subtype')}: {str(out.get('result'))[:300]}")
        if isinstance(meta, dict):
            used = out.get("modelUsage") or {}
            # the model that wrote the answer, should Claude Code have made a small call of its own
            meta["model"] = max(used, key=lambda m: ((used[m] or {}).get("outputTokens") or 0, m)) if used else model
            meta["usage"] = out.get("usage") or {}
        return out.get("result") or ""
    cmd = claude_code_command(model)
    res = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8", timeout=600, env=env)
    if res.returncode != 0 and model:  # maybe the alias isn't accepted; try the default model
        res = subprocess.run(claude_code_command(None), input=prompt, capture_output=True, text=True,
                             encoding="utf-8", timeout=600, env=env)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip()[:300] or f"claude exited {res.returncode}")
    return res.stdout


def parse_json_array(text):
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        raise ValueError("no JSON array in response")
    return json.loads(m.group(0))


def canon_fandom(name):
    n = re.sub(r"\s+", " ", str(name)).strip()
    return CANON.get(n.lower(), n)


def clean_tags(obj):
    kind = str(obj.get("kind", "other")).strip().lower()
    return {
        "fandoms": [canon_fandom(f) for f in (obj.get("fandoms") or []) if str(f).strip()][:3],
        "kind": kind if kind in KINDS else "other",
        "topics": [t for t in (obj.get("topics") or []) if t in TOPICS][:3],
        "adult": bool(obj.get("adult", False)),
        "guests": obj.get("guests") if obj.get("guests") in ("celebrity", "creator", "fan", "unknown") else "unknown",
    }


def is_frozen(path):
    """True where `path` is data/2026/events.json, however it is spelled."""
    try:
        return os.path.samefile(path, FROZEN)
    except OSError:  # one of the two does not exist
        return os.path.normcase(os.path.realpath(path)) == os.path.normcase(os.path.realpath(FROZEN))


def tag_batch(batch, transport, model):
    prompt = build_prompt(batch)
    last = None
    for attempt in range(2):
        try:
            text = transport(prompt, model)
            rows = parse_json_array(text)
            out = {}
            for row in rows:
                if isinstance(row, dict) and row.get("id"):
                    out[row["id"]] = clean_tags(row)
            if out:
                return out
            last = "empty result"
        except Exception as exc:  # noqa: BLE001
            last = str(exc)
            time.sleep(3)
    raise RuntimeError(last)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=40)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--model", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--file", default=EVENTS)
    args = ap.parse_args()
    if is_frozen(args.file):
        sys.exit(REFUSAL)

    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    events = data["events"]
    todo = [e for e in events if args.all or not e.get("tags")]
    if args.limit:
        todo = todo[:args.limit]
    if not todo:
        print("Nothing to tag.", file=sys.stderr)
        return

    use_api = bool(os.environ.get("ANTHROPIC_API_KEY"))
    transport = call_api if use_api else call_claude_code
    model = args.model or ("claude-haiku-4-5-20251001" if use_api else "haiku")
    batches = [todo[i:i + args.batch] for i in range(0, len(todo), args.batch)]
    print(f"Tagging {len(todo)} events in {len(batches)} batches via {'API' if use_api else 'Claude Code'} ({model})", file=sys.stderr)
    if args.dry_run:
        print(build_prompt(batches[0])[:1500])
        return

    by_id = {e["id"]: e for e in events}
    done = failed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(tag_batch, b, transport, model): b for b in batches}
        for fut in as_completed(futures):
            try:
                for eid, tags in fut.result().items():
                    if eid in by_id:
                        by_id[eid]["tags"] = tags
                        done += 1
            except Exception as exc:  # noqa: BLE001
                failed += len(futures[fut])
                print(f"  batch failed: {exc}", file=sys.stderr)
            if (done + failed) % 200 < args.batch:
                print(f"  {done} tagged, {failed} failed", file=sys.stderr)
            # Save as we go so a crash doesn't lose work.
            with open(args.file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    counts = {}
    for e in events:
        for fd in (e.get("tags") or {}).get("fandoms", []):
            counts[fd] = counts.get(fd, 0) + 1
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:25]
    print(f"Done: {done} tagged, {failed} failed. {sum(1 for e in events if e.get('tags'))}/{len(events)} events have tags.", file=sys.stderr)
    print("Top fandoms: " + ", ".join(f"{k} ({v})" for k, v in top), file=sys.stderr)


if __name__ == "__main__":
    main()
