#!/usr/bin/env python3
"""The 2026 schedule on `main`, commit by commit: docs/pipeline/history-2026.md.

    python tools/schedule_history.py             # write docs/pipeline/history-2026.md
    python tools/schedule_history.py --no-runs   # leave scrape.yml's runs out, and call no gh
    python tools/schedule_history.py --ref REF --out PATH

Evidence for Pipeline shape (ROADMAP tentpole 1; DECISIONS #7, #20, #26, #37): how the schedule the scraper
wrote changed from commit to commit while the con ran. It walks every commit on the ref whose first-parent line
touched the 2026 schedule, following the file back to `events.json` at the repo root, where it lived until the
archive merge moved it (#13); reads each version with `git show`; and diffs each against the one before, by id
and by content, with `scraper.dupe_key` and `scraper.norm_text` - the rule dedupe uses. With `gh` authenticated
it adds scrape.yml's runs, which the commits cannot show: a run that fails, or never starts, leaves no commit.

A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. It states
facts; UNSURE marks a match that needs a person's judgment, and the one fix it proposes is applied to nothing.
The standard library, `git` and `gh`, and `scraper` for its two functions; deterministic - two runs write the
same bytes, and the only times in it are the commits' and the runs' own.
"""

import argparse
import datetime as dt
import json
import os
import re
import statistics
import subprocess
import sys
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)

import scraper  # noqa: E402  (dupe_key and norm_text, nothing else)

SCHEDULE = "data/2026/events.json"
SCRAPER = "scraper.py"
WORKFLOW = ".github/workflows/scrape.yml"
OUT = "docs/pipeline/history-2026.md"
BOT = "schedule-bot"
# The fields compared on the ids two versions share. speakers and tracks can change by order alone, and an
# order-only change is counted apart from a change of what they hold.
FIELDS = ("title", "start", "end", "room", "hotel", "location", "description", "speakers", "tracks", "cancelled")
ORDERED = ("speakers", "tracks")
SHOW = 12  # a list longer than this shows its first 10 and says how many more
RUN_FIELDS = "databaseId,number,event,status,conclusion,createdAt,startedAt,updatedAt,headSha,attempt"
FAILED = re.compile(r"WARNING: \d+ detail pages? failed, e\.g\. .*")
HEX_ID = re.compile(r"\b[0-9a-f]{32}\b")
CRON = re.compile(r"""^\s*-\s*cron:\s*["']([^"']+)["']""", re.M)
CONCURRENCY = re.compile(r"^concurrency:", re.M)

# New York is UTC-4 for every time this report converts: each one falls inside 2026's daylight-saving window,
# 2026-03-08 07:00 UTC to 2026-11-01 06:00 UTC, and new_york() refuses anything outside it rather than guess.
# That, and nothing else, makes the constant exact here. The 2027 cron's con-week guard - or anything else that
# turns a UTC time into a local one across a changeover - needs real zone handling.
EDT = dt.timedelta(hours=-4)
DST_2026 = (dt.datetime(2026, 3, 8, 7, tzinfo=dt.timezone.utc), dt.datetime(2026, 11, 1, 6, tzinfo=dt.timezone.utc))


# ---------------------------------------------------------------------------
# Pure functions: what tests/test_schedule_history.py reaches
# ---------------------------------------------------------------------------

def utc(s):
    """An ISO time from git, gh or the schedule, as an aware UTC datetime."""
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(dt.timezone.utc)


def new_york(t):
    """A UTC time as New York wall-clock time: UTC-4, and only inside 2026's daylight-saving window."""
    if not DST_2026[0] <= t < DST_2026[1]:
        raise ValueError(f"{t.isoformat()} is outside 2026's daylight-saving window, where New York is not UTC-4")
    return (t + EDT).replace(tzinfo=None)


def classify(author, subject):
    """scrape: scrape.yml's commits, by schedule-bot as "Refresh schedule <time>". tag: tag_events.py's passes,
    committed by hand as "Tag the N events ...". other: the rest - the import, the merges, the move."""
    if author == BOT and subject.startswith("Refresh schedule"):
        return "scrape"
    if re.match(r"Tag\b", subject):
        return "tag"
    return "other"


def canon(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False)


def reordered(a, b):
    """Two lists that differ and hold the same items: only the order changed."""
    a, b = a or [], b or []
    return a != b and sorted(map(canon, a)) == sorted(map(canon, b))


def slot_of(e):
    """When and where: the start, and the room half of dupe_key."""
    return e.get("start"), scraper.norm_text(e.get("room") or e.get("location"))


def diff(prev, new):
    """Two versions' events, compared by id: the counts; what changed on the ids both hold; where each removed id's
    content went - under an id added here, still under an id both hold, or nowhere - and the same-title matches for
    those that went nowhere; and, for each title change that moved an event's dupe_key, whether a dedupe group
    gained or lost a member."""
    p = {e["id"]: e for e in prev}
    c = {e["id"]: e for e in new}
    pk = {i: scraper.dupe_key(e) for i, e in p.items()}
    ck = {i: scraper.dupe_key(e) for i, e in c.items()}
    added = sorted(set(c) - set(p))
    removed = sorted(set(p) - set(c))
    common = sorted(set(p) & set(c))
    fields, order_only, other = Counter(), Counter(), Counter()
    reorders = {f: [] for f in ORDERED}
    changed, starts, rooms, titles, flips = [], [], [], [], []
    for i in common:
        a, b = p[i], c[i]
        hit = False
        for f in FIELDS:
            if a.get(f) == b.get(f):
                continue
            if f in ORDERED and reordered(a.get(f), b.get(f)):
                order_only[f] += 1
                reorders[f].append(i)
            else:
                fields[f] += 1
                hit = True
        for f in sorted((set(a) | set(b)) - set(FIELDS) - {"id"}):
            if a.get(f) != b.get(f):
                other[f] += 1
        if hit:
            changed.append(i)
        title = b.get("title") or ""
        if a.get("start") != b.get("start"):
            starts.append((title, a.get("start"), b.get("start"), i))
        if (a.get("hotel"), a.get("room")) != (b.get("hotel"), b.get("room")):
            rooms.append((title, f"{a.get('hotel')} / {a.get('room')}", f"{b.get('hotel')} / {b.get('room')}", i))
        if a.get("title") != b.get("title"):
            titles.append((a.get("title") or "", title, pk[i] != ck[i], i))
        if bool(a.get("cancelled")) != bool(b.get("cancelled")):
            flips.append((title, bool(a.get("cancelled")), bool(b.get("cancelled")), i))

    holders, held_before = defaultdict(list), defaultdict(list)
    for i in sorted(c):
        holders[ck[i]].append(i)
    for i in sorted(p):
        held_before[pk[i]].append(i)
    fresh = set(added)
    bins = {}
    for r in removed:
        hs = holders.get(pk[r], [])
        new_hs = [h for h in hs if h in fresh]
        bins[r] = ("added", new_hs) if new_hs else ("kept", hs) if hs else ("gone", [])
    taken = {h for kind, hs in bins.values() if kind == "added" for h in hs}
    loose = []
    for r in removed:
        if bins[r][0] != "gone":
            continue
        for a in added:
            if a in taken or scraper.norm_text(p[r].get("title")) != scraper.norm_text(c[a].get("title")):
                continue
            same_start, same_room = slot_of(p[r])[0] == slot_of(c[a])[0], slot_of(p[r])[1] == slot_of(c[a])[1]
            loose.append(("new start" if same_room else "new room" if same_start else "both", r, a))

    renames = []
    for _, _, rekeyed, i in titles:
        if not rekeyed:
            continue
        at = {slot_of(p[i]), slot_of(c[i])}
        renames.append({"id": i,
                        "left": [o for o in holders.get(pk[i], []) if o != i],       # kept the old title after
                        "joined": [o for o in held_before.get(ck[i], []) if o != i],  # had the new title before
                        "near": sorted({a for a in added if slot_of(c[a]) in at} | {r for r in removed if slot_of(p[r]) in at})})
    return {"before": len(prev), "after": len(new), "added": added, "removed": removed, "common": len(common),
            "fields": fields, "order_only": order_only, "reorders": reorders, "other": other, "changed": changed,
            "starts": sorted(starts), "rooms": sorted(rooms), "titles": sorted(titles), "flips": sorted(flips),
            "bins": bins, "loose": sorted(loose), "renames": renames}


def sorts_before(new_id, old_id):
    """By string order, as merge_group's min() compares ids."""
    return new_id < old_id


def returns_by_id(id_lists):
    """Ids missing from a version between two that hold them: {id: [indexes of the versions they miss]}."""
    where = defaultdict(list)
    for v, ids in enumerate(id_lists):
        for i in ids:
            where[i].append(v)
    out = {}
    for i in sorted(where):
        held = set(where[i])
        missed = [v for v in range(where[i][0], where[i][-1] + 1) if v not in held]
        if missed:
            out[i] = missed
    return out


def returns_by_key(versions):
    """Content that leaves and comes back under other ids: (key, last version holding it before the gap, first
    after, ids before, ids after) for every gap after which different ids hold the key."""
    held = defaultdict(dict)
    for v, events in enumerate(versions):
        for e in events:
            held[scraper.dupe_key(e)].setdefault(v, []).append(e["id"])
    out = []
    for key in sorted(held, key=repr):
        vs = sorted(held[key])
        for a, b in zip(vs, vs[1:]):
            if b > a + 1 and sorted(held[key][a]) != sorted(held[key][b]):
                out.append((key, a, b, sorted(held[key][a]), sorted(held[key][b])))
    return out


def last_groups(versions):
    """The last version in which two or more ids share a dupe_key - the file before dedupe landed - and its
    groups: (index, {key: [ids]}), or (None, {}) when no version has one."""
    for v in range(len(versions) - 1, -1, -1):
        groups = defaultdict(list)
        for e in versions[v]:
            groups[scraper.dupe_key(e)].append(e["id"])
        multi = {k: sorted(ids) for k, ids in groups.items() if len(ids) > 1}
        if multi:
            return v, multi
    return None, {}


def tied(events, groups):
    """The groups whose copies share their start and their exact title, which a sort by (start, title) leaves
    in the order it found them."""
    by_id = {e["id"]: e for e in events}
    return {k for k, ids in groups.items() if len({(by_id[i].get("start"), by_id[i].get("title")) for i in ids}) == 1}


def cron_hours(expr):
    """(minute, hours) of a cron that runs every day: "17 */3 * * *" is (17, [0, 3, ..., 21]). Anything else
    is refused, not guessed at."""
    parts = expr.split()
    if len(parts) != 5 or tuple(parts[2:]) != ("*", "*", "*") or not parts[0].isdigit():
        raise ValueError(f"not a daily cron: {expr!r}")
    hour = parts[1]
    if hour == "*":
        hours = list(range(24))
    elif re.fullmatch(r"\*/\d+", hour):
        hours = list(range(0, 24, int(hour[2:])))
    elif re.fullmatch(r"\d+(,\d+)*", hour):
        hours = sorted({int(h) for h in hour.split(",")})
    else:
        raise ValueError(f"not a daily cron: {expr!r}")
    return int(parts[0]), hours


def slots(expr, start, end):
    """Every time the cron names after start and before end (UTC)."""
    minute, hours = cron_hours(expr)
    out, day = [], start.date()
    while day <= end.date():
        for h in hours:
            t = dt.datetime(day.year, day.month, day.day, h, minute, tzinfo=dt.timezone.utc)
            if start < t < end:
                out.append(t)
        day += dt.timedelta(days=1)
    return out


def cron_life(workflow):
    """From scrape.yml's versions on the ref, oldest first ({sha, committed, text}): each stretch one cron was
    in the file - (expr, sha from, time from, sha to or None, time to or None) - and the first version with a
    concurrency group, or None."""
    stretches, current, concurrency = [], None, None
    for w in workflow:
        crons = CRON.findall(w["text"])
        if concurrency is None and CONCURRENCY.search(w["text"]):
            concurrency = w
        expr = crons[0] if len(crons) == 1 else None
        if len(crons) > 1:
            raise ValueError(f"{w['sha'][:7]}: more than one cron in {WORKFLOW}")
        if current and current[0] != expr:
            stretches.append((*current, w["sha"], w["committed"]))
            current = None
        if expr and not current:
            current = (expr, w["sha"], w["committed"])
    if current:
        stretches.append((*current, None, None))
    return stretches, concurrency


def attribute(runs, slot_times):
    """Each scheduled run to the last cron slot at or before its creation - GitHub records no slot for a run -
    as {slot: [run numbers]}."""
    out = defaultdict(list)
    for r in sorted(runs, key=lambda r: r["number"]):
        if r["event"] != "schedule":
            continue
        prior = [s for s in slot_times if s <= utc(r["createdAt"])]
        if prior:
            out[prior[-1]].append(r["number"])
    return out


def join_runs(runs, commits):
    """Each scrape commit to the run that made it: the run whose start-to-last-update holds the commit's author
    time - the successful one, where two runs do. {sha: run number, or None where no one run fits}."""
    out = {}
    for c in commits:
        if classify(c["author"], c["subject"]) != "scrape":
            continue
        t = utc(c["authored"])
        inside = [r for r in runs if utc(r["startedAt"]) <= t <= utc(r["updatedAt"])]
        won = [r for r in inside if r["conclusion"] == "success"]
        pick = won if len(won) == 1 else inside if len(inside) == 1 else []
        out[c["sha"]] = pick[0]["number"] if pick else None
    return out


def overlaps(runs):
    """Pairs of runs (by number) that were running at the same time."""
    rs = sorted(runs, key=lambda r: (utc(r["startedAt"]), r["number"]))
    return [(a["number"], b["number"]) for i, a in enumerate(rs) for b in rs[i + 1:]
            if utc(b["startedAt"]) < utc(a["updatedAt"])]


def failure_lines(log_text):
    """The scraper's warning about detail pages that failed, from a run's log: the message, without the log's
    own prefix and time."""
    return [m.group(0).rstrip() for m in map(FAILED.search, log_text.splitlines()) if m]


def median(values):
    return statistics.median(sorted(values)) if values else 0


# ---------------------------------------------------------------------------
# Reading git and gh
# ---------------------------------------------------------------------------

def run(*cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, check=True).stdout.decode("utf-8")


def gather(ref, with_runs=True):
    """Everything the report reads, as plain data: the commits and their versions, the ref's first-parent line,
    scraper.py's and scrape.yml's commits on it, and scrape.yml's runs where gh can list them."""
    try:
        head = run("git", "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").strip()
    except subprocess.CalledProcessError:
        raise SystemExit(f"no commit {ref!r} here: a clone whose default branch is next may need --ref origin/main")
    line = run("git", "rev-list", "--first-parent", "--reverse", ref).split()
    log = run("git", "log", "--first-parent", "--follow", "--name-status",
              "--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%cI%x1f%s", ref, "--", SCHEDULE)
    commits = []
    for block in log.split("\x1e")[1:]:
        top, *rest = [x for x in block.split("\n") if x.strip()]
        sha, parents, author, authored, committed, subject = top.split("\x1f")
        status = rest[0].split("\t")
        commits.append({"sha": sha, "parents": parents.split(), "author": author, "authored": authored,
                        "committed": committed, "subject": subject, "status": status[0], "path": status[-1]})
    commits.reverse()
    versions = [json.loads(run("git", "show", f"{c['sha']}:{c['path']}")) for c in commits]
    fp = "--format=%H%x1f%cI%x1f%s"
    scraper_commits = [dict(zip(("sha", "committed", "subject"), x.split("\x1f")))
                       for x in reversed(run("git", "log", "--first-parent", fp, ref, "--", SCRAPER).splitlines())]
    workflow = []
    for x in reversed(run("git", "log", "--first-parent", fp, ref, "--", WORKFLOW).splitlines()):
        sha, committed, _ = x.split("\x1f")
        try:
            text = run("git", "show", f"{sha}:{WORKFLOW}")
        except subprocess.CalledProcessError:
            text = ""
        workflow.append({"sha": sha, "committed": committed, "text": text})
    try:
        frozen = run("git", "rev-parse", f"HEAD:{SCHEDULE}").strip()
    except subprocess.CalledProcessError:
        frozen = None
    last_blob = run("git", "rev-parse", f"{commits[-1]['sha']}:{commits[-1]['path']}").strip()
    h = {"ref": ref, "head": head, "line": line, "commits": commits, "versions": versions,
         "scraper": scraper_commits, "workflow": workflow, "frozen": frozen, "last_blob": last_blob}
    h["runs"] = gather_runs(commits, versions) if with_runs else None
    return h


def gather_runs(commits, versions):
    """scrape.yml's runs, each with its job's times and failed steps, and the scraper's warning from the log of
    each run that made a version with failures. {"error": ...} if gh cannot say."""
    try:
        listed = json.loads(run("gh", "run", "list", f"--workflow={os.path.basename(WORKFLOW)}", "--limit", "1000",
                                "--json", RUN_FIELDS))
        runs = []
        for r in sorted(listed, key=lambda r: r["number"]):
            jobs = json.loads(run("gh", "run", "view", str(r["databaseId"]), "--json", "jobs"))["jobs"]
            r["jobs"] = [{"name": j["name"], "startedAt": j["startedAt"], "completedAt": j["completedAt"],
                          "failed": [s["name"] for s in j["steps"] if s["conclusion"] == "failure"]} for j in jobs]
            runs.append(r)
        logs = {}
        for c, v in zip(commits, versions):
            if not v.get("failures"):
                continue
            t = utc(c["authored"])
            for r in runs:
                if utc(r["startedAt"]) <= t <= utc(r["updatedAt"]):
                    try:
                        logs[str(r["number"])] = failure_lines(run("gh", "run", "view", str(r["databaseId"]), "--log"))
                    except subprocess.CalledProcessError:
                        logs[str(r["number"])] = None
        return {"runs": runs, "logs": logs}
    except FileNotFoundError:
        return {"error": "`gh` is not installed"}
    except subprocess.CalledProcessError as exc:
        return {"error": f"`{' '.join(exc.cmd[:3])}` exited {exc.returncode}"}


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def n(x):
    return f"{x:,}"


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def code(s):
    s = " ".join(str(s).split())
    return f"`` {s} ``" if "`" in s else f"`{s}`"


def table(head, rows, align=None):
    """A GFM table; align is one letter a column, l or r (default: the first column left, the rest right)."""
    align = align or "l" + "r" * (len(head) - 1)
    rule = ["---" if a == "l" else "---:" for a in align]
    lines = [head, rule] + [[str(x).replace("|", "\\|") for x in r] for r in rows]
    return ["| " + " | ".join(r) + " |" for r in lines] + [""]


def short(sha):
    return f"`{sha[:7]}`"


def stamp(t):
    return t.strftime("%Y-%m-%d %H:%M:%S")


def ny(t):
    return new_york(t).strftime("%Y-%m-%d %H:%M")


def span(seconds):
    s = int(round(seconds))
    return f"{s // 3600}h {s % 3600 // 60:02d}m" if s >= 3600 else f"{s // 60}m {s % 60:02d}s"


def capped(items, fmt):
    """Every item, when there are at most SHOW; else the first 10 and how many more."""
    shown = items if len(items) <= SHOW else items[:10]
    return [fmt(x) for x in shown] + ([f"- ... and {n(len(items) - 10)} more"] if len(items) > SHOW else [])


def event_line(e):
    return f"{code(e.get('title'))} - {e.get('start')} - {e.get('hotel')} / {e.get('room')} - {code(e['id'])}"


def counted(counter, order=None):
    keys = order or sorted(counter)
    return ", ".join(f"{k} {n(counter[k])}" for k in keys if counter.get(k)) or "none"


def many(count, one, more=None):
    return f"{n(count)} {one if count == 1 else more or one + 's'}"


# ---------------------------------------------------------------------------
# The report
# ---------------------------------------------------------------------------

def analyse(h):
    """The facts the sections render, from gathered plain data."""
    commits, versions = h["commits"], h["versions"]
    events = [v["events"] for v in versions]
    f = {"classes": [classify(c["author"], c["subject"]) for c in commits],
         "pairs": [diff(events[i - 1], events[i]) for i in range(1, len(events))],
         "authored": [utc(c["authored"]) for c in commits],
         "committed": [utc(c["committed"]) for c in commits]}
    f["ny"] = [new_york(t) for t in f["authored"]]  # every commit time converted is checked against the window
    f["final_ids"] = {e["id"] for e in events[-1]}
    f["ever"] = {e["id"] for evs in events for e in evs}
    f["returns"] = returns_by_id([[e["id"] for e in evs] for evs in events])
    f["key_returns"] = returns_by_key(events)
    f["pre"], f["groups"] = last_groups(events)
    f["tied"] = tied(events[f["pre"]], f["groups"]) if f["pre"] is not None else set()
    f["grouped"] = {i for ids in f["groups"].values() for i in ids}
    f["con_days"] = sorted({e["day"] for e in events[-1] if e.get("day")})
    pos = {sha: k for k, sha in enumerate(h["line"])}
    f["pos"] = pos
    f["between"] = []
    for i in range(1, len(commits)):
        lo, hi = pos.get(commits[i - 1]["sha"], -1), pos.get(commits[i]["sha"], -1)
        f["between"].append([s for s in h["scraper"] if lo < pos.get(s["sha"], -1) <= hi])
    runs = h.get("runs")
    f["runs"] = runs["runs"] if runs and "runs" in runs else None
    f["join"] = join_runs(f["runs"], commits) if f["runs"] else {}
    return f


def period(f, t):
    day = new_york(t).date().isoformat()
    return "before" if day < f["con_days"][0] else "after" if day > f["con_days"][-1] else "during"


def headline(h, f):
    commits, versions, pairs = h["commits"], h["versions"], f["pairs"]
    cls = Counter(f["classes"])
    same = sum(1 for v in versions if v.get("changed_at") == v.get("generated_at"))
    scrape_after = [p for k, p in enumerate(pairs, start=1)
                    if f["classes"][k] == "scrape" and f["pre"] is not None and k > f["pre"]]
    reorder = [p["order_only"]["tracks"] for p in scrape_after]
    only_order = [k for k, p in enumerate(pairs, start=1) if f["classes"][k] == "scrape" and not p["added"]
                  and not p["removed"] and not p["changed"] and not p["other"].keys() - {"track"}]
    bins = Counter(kind for p in pairs for kind, _ in p["bins"].values())
    flips = [x for p in pairs for x in p["flips"]]
    parser_pairs = [k for k, b in enumerate(f["between"], start=1) if b and f["classes"][k] == "scrape"]
    both = [commits[k]["sha"] for k, b in enumerate(f["between"], start=1) if any(s["sha"] == commits[k]["sha"] for s in b)]
    out = [f"Commits: {n(len(commits))} touched the schedule: {n(cls['scrape'])} scrape, {n(cls['tag'])} tag, "
           f"{n(cls['other'])} other; {n(len(pairs))} consecutive pairs.",
           f"Events: {n(len(versions[0]['events']))} in the first version, {n(len(versions[-1]['events']))} in the "
           f"last; {n(len(f['ever']))} ids were ever seen.",
           f"`changed_at` equals `generated_at` in {n(same)} of {n(len(versions))} versions."]
    if reorder:
        out.append(f"Every scrape after the dedupe reorders `tracks` on {min(reorder)}-{max(reorder)} events, and "
                   f"{many(len(only_order), 'scrape')} changed nothing but the order of `tracks` and `speakers` "
                   f"(section 6).")
    out += [f"Scrape pairs with a `scraper.py` change between them: {n(len(parser_pairs))} "
            f"({', '.join(f'v{k + 1}' for k in parser_pairs) or 'none'})"
            + (f"; {' and '.join(short(s) for s in both)} {'each ' if len(both) > 1 else ''}changed `scraper.py` and "
               f"the schedule in one commit." if both else "."),
            f"Removed ids: {n(sum(bins.values()))} - under an id added in the same pair {n(bins['added'])}, still "
            f"under an id both versions hold {n(bins['kept'])}, gone {n(bins['gone'])}. Same-title matches (UNSURE): "
            f"{n(sum(len(p['loose']) for p in pairs))}.",
            f"Ids that leave and later return: {n(len(f['returns']))}. Content that returns under another id: "
            f"{n(len(f['key_returns']))}.",
            f"`cancelled` transitions: {n(len(flips))} - false to true {n(sum(1 for x in flips if x[2]))}, true to "
            f"false {n(sum(1 for x in flips if not x[2]))}."]
    if f["runs"] is not None:
        rs = f["runs"]
        joined = set(v for v in f["join"].values() if v is not None)
        out.append(f"scrape.yml ran {n(len(rs))} times: {n(sum(1 for r in rs if r['conclusion'] == 'success'))} "
                   f"succeeded, {n(sum(1 for r in rs if r['conclusion'] == 'failure'))} failed; successful runs that "
                   f"committed nothing: {n(sum(1 for r in rs if r['conclusion'] == 'success' and r['number'] not in joined))} "
                   f"(section 8).")
    scrape_pairs = [(k, p) for k, p in enumerate(pairs, start=1) if f["classes"][k] == "scrape"]
    during = [p for k, p in scrape_pairs if period(f, f["authored"][k]) == "during"]
    moved = lambda ps: sum(len(p["added"]) + len(p["removed"]) + len(p["changed"]) for p in ps)
    out.append(f"Con days ({f['con_days'][0]} to {f['con_days'][-1]}): {n(len(during))} of {n(len(scrape_pairs))} "
               f"scrape pairs landed on them, with {n(moved(during))} of the {n(moved(p for _, p in scrape_pairs))} ids "
               f"those pairs added, removed or changed - an id counted once a pair (section 7).")
    return [f"{k}. {line}" for k, line in enumerate(out, start=1)]


def commits_section(h, f):
    commits = h["commits"]
    rows = [[k + 1, short(c["sha"]), f["classes"][k], stamp(f["authored"][k]), ny(f["authored"][k]), c["author"],
             c["subject"]] for k, c in enumerate(commits)]
    moved = [c for c in commits if c["status"].startswith("R")]
    rebased = [(k, c) for k, c in enumerate(commits) if f["committed"][k] != f["authored"][k]]
    out = ["A commit's time is its author date: when it was made, which for a scrape is the end of the run. "
           "Classes, by author and message: `scrape` is schedule-bot's \"Refresh schedule\", `tag` a hand commit of "
           "`tag_events.py`'s output (\"Tag the N events ...\"), `other` the rest.", ""]
    out += table(["#", "commit", "class", "UTC", "New York", "author", "subject"], rows, "rllllll")
    for c in moved:
        out.append(f"- {short(c['sha'])} moved the file to `{c['path']}` ({c['status']}: "
                   f"{'the same bytes' if c['status'] == 'R100' else 'renamed with changes'}).")
    if rebased:
        gaps = [(f["committed"][k] - f["authored"][k]).total_seconds() for k, _ in rebased]
        out.append(f"- Committed after they were authored, as a rebase leaves them: {n(len(rebased))} "
                   f"({', '.join(short(c['sha']) for _, c in rebased)}), by {min(gaps):.0f}-{max(gaps):.0f} s.")
    return out + [""]


def versions_section(h, f):
    versions = h["versions"]
    final = f["final_ids"]
    rows = []
    for k, (c, v) in enumerate(zip(h["commits"], versions)):
        ids = {e["id"] for e in v["events"]}
        rows.append([k + 1, short(c["sha"]), f["classes"][k], v.get("generated_at"), v.get("changed_at"),
                     n(len(v["events"])), n(v["count"]) if isinstance(v.get("count"), int) else v.get("count"),
                     v.get("failures"), f"{n(len(ids & final))} ({pct(len(ids & final), len(final))})"])
    out = table(["v", "commit", "class", "generated_at", "changed_at", "events", "count", "failures",
                 "final ids present"], rows, "rllllrrrr")
    agree = sum(1 for v in versions if v.get("count") == len(v["events"]))
    same = sum(1 for v in versions if v.get("changed_at") == v.get("generated_at"))
    out += [f"- `count` equals the number of events in {n(agree)} of {n(len(versions))} versions; `changed_at` equals "
            f"`generated_at` in {n(same)}.",
            f"- Ids ever seen: {n(len(f['ever']))}; in the last version: {n(len(final))}."]
    if h.get("frozen"):
        verdict = "is" if h["frozen"] == h["last_blob"] else "is not"
        out.append(f"- The last version's blob, `{h['last_blob'][:7]}`, {verdict} the frozen `{SCHEDULE}` at `HEAD`.")
    out += ["", "### Failures", "",
            "`failures` in the file is a count. The scraper prints the first failure's error at the end of its run, "
            "so a run's log is the only place a failure is named.", ""]
    for k, (c, v) in enumerate(zip(h["commits"], versions)):
        if not v.get("failures"):
            continue
        here = {e["id"] for e in v["events"]}
        before = {e["id"] for e in versions[k - 1]["events"]} if k else set()
        run_no = f["join"].get(c["sha"])
        logs = (h.get("runs") or {}).get("logs") or {}
        head = f"- v{k + 1} {short(c['sha'])}: `failures` {v['failures']}."
        if f["runs"] is None:
            out.append(head + " Runs not read.")
        elif run_no is None:
            out.append(head + " No scrape.yml run made this version: its failures are not named anywhere.")
        elif logs.get(str(run_no)) is None:
            out.append(head + f" Run #{run_no}'s log is no longer available.")
        else:
            for line in logs[str(run_no)] or ["(no warning line in the log)"]:
                named = sorted(set(HEX_ID.findall(line)))
                where = lambda i: ("this version lacks and the one before held" if i in before - here else
                                   "this version holds" if i in here else "neither this version nor the one before holds")
                verdict = ("It names " + "; ".join(f"{code(i)}, an id {where(i)}" for i in named) + "."
                           if named else "It names no event id.")
                out.append(head + f" Run #{run_no}'s log: {code(line)}. {verdict}")
    return out + [""]


def pairs_section(h, f):
    rows1, rows2 = [], []
    for k, p in enumerate(f["pairs"], start=1):
        name = f"v{k} → v{k + 1}"
        rows1.append([name, short(h["commits"][k]["sha"]), f["classes"][k], n(p["before"]), n(p["after"]),
                      n(len(p["added"])), n(len(p["removed"])), n(p["common"]), n(len(p["changed"])),
                      n(sum(p["order_only"].values()))])
        rows2.append([name] + [n(p["fields"][x]) for x in FIELDS] + [n(p["order_only"][x]) for x in ORDERED]
                     + [counted(p["other"])])
    out = ["Each version against the one before it. `common` is the ids both hold; `changed`, those of them on "
           "which one of the ten fields below changed, other than by order alone.", ""]
    out += table(["pair", "to", "class", "before", "after", "added", "removed", "common", "changed", "order only"],
                 rows1, "lllrrrrrrr")
    out += ["The fields, counted on the common ids. `speakers` and `tracks` count a change of what they hold; a "
            "list that only changed its order is counted in the two columns after them. Other fields are every key "
            "outside the ten that differs, by name.", ""]
    out += table(["pair"] + list(FIELDS) + [f"{x}, order only" for x in ORDERED] + ["other fields"], rows2,
                 "l" + "r" * (len(FIELDS) + len(ORDERED)) + "l")
    return out


def pair_detail(h, f, k, p):
    """Pair k (v{k} -> v{k+1}) in full; only what it has."""
    prev, new = h["versions"][k - 1]["events"], h["versions"][k]["events"]
    pe, ce = {e["id"]: e for e in prev}, {e["id"]: e for e in new}
    c = h["commits"][k]
    out = [f"### v{k} → v{k + 1}: {short(c['sha'])} - {f['classes'][k]}, {stamp(f['authored'][k])} UTC", ""]
    between = f["between"][k - 1]
    if between:
        run_no = f["join"].get(c["sha"])
        head = next((r["headSha"] for r in f["runs"] or [] if r["number"] == run_no), None)
        items = []
        for s in between:
            note = ""
            if head in f["pos"] and f["pos"].get(s["sha"], -1) > f["pos"][head]:
                note = f" (not yet on `{h['ref']}` when run #{run_no} checked it out)"
            items.append(f"{short(s['sha'])} {s['subject']}{note}")
        out.append(f"- `scraper.py` changed in between: {'; '.join(items)}.")
    if not (p["added"] or p["removed"] or any(p["fields"].values()) or any(p["order_only"].values()) or p["other"]):
        return out + ["- No change: the same events, field for field.", ""]
    if p["added"]:
        out.append(f"- Added {n(len(p['added']))}:")
        out += ["  " + x for x in capped([ce[i] for i in p["added"]], lambda e: "- " + event_line(e))]
    if p["removed"]:
        bins = Counter(kind for kind, _ in p["bins"].values())
        out.append(f"- Removed {n(len(p['removed']))}: under an id added here {n(bins['added'])}, still under an id "
                   f"both versions hold {n(bins['kept'])}, gone {n(bins['gone'])}.")
        for kind, label in (("added", "under an id added here"), ("kept", "still under an id both hold"),
                            ("gone", "gone")):
            ids = [r for r in p["removed"] if p["bins"][r][0] == kind]
            if not ids:
                continue
            out.append(f"  - {label.capitalize()}:")
            if kind == "added":
                fmt = lambda r: (f"- {event_line(pe[r])} → " + ", ".join(
                    f"{code(x)} ({'sorts before' if sorts_before(x, r) else 'sorts after'})" for x in p["bins"][r][1]))
            elif kind == "kept":
                fmt = lambda r: f"- {event_line(pe[r])} → {', '.join(code(x) for x in p['bins'][r][1])}"
            else:
                fmt = lambda r: "- " + event_line(pe[r])
            out += ["    " + x for x in capped(ids, fmt)]
    if p["loose"]:
        out.append(f"- Same-title matches for ids that went nowhere, UNSURE ({n(len(p['loose']))}):")
        out += [f"  - UNSURE, {kind}: {event_line(pe[r])} → {event_line(ce[a])}" for kind, r, a in p["loose"]]
    for key, label, fmt in (
            ("starts", "Start", lambda x: f"- {code(x[0])}: {x[1]} → {x[2]}"),
            ("rooms", "Room", lambda x: f"- {code(x[0])}: {x[1]} → {x[2]}"),
            ("titles", "Title", lambda x: f"- {code(x[0])} → {code(x[1])}"),
            ("flips", "`cancelled`", lambda x: f"- {code(x[0])}: {str(x[1]).lower()} → {str(x[2]).lower()}")):
        if p[key]:
            extra = ""
            if key == "titles":
                extra = f"; {n(sum(1 for x in p['titles'] if x[2]))} moved the event's dupe_key"
            out.append(f"- {label} changes, {n(len(p[key]))}{extra}:")
            out += ["  " + x for x in capped(p[key], fmt)]
    if p["renames"]:
        moved = [r for r in p["renames"] if r["left"] or r["joined"] or r["near"]]
        line = f"- Dedupe groups across the {many(len(p['renames']), 'title change')} that moved a dupe_key: "
        if f["pre"] is not None and k > f["pre"]:
            grouped = sum(1 for r in p["renames"] if r["id"] in f["grouped"])
            line += (f"{n(grouped)} of the renamed events had been a group of two or more ids in v{f['pre'] + 1}, "
                     f"the last version where copies show; ")
        if not moved:
            out.append(line + "no other event holds a renamed event's old key after the pair or held its new key "
                       "before it, and no id was added or removed at a renamed event's start and room, so no group "
                       "gained or lost a member.")
        else:
            out.append(line + f"{many(len(moved), 'rename')} touched another id:")
            for r in moved:
                out.append(f"  - {code(ce[r['id']]['title'])}: kept the old title "
                           f"{', '.join(code(x) for x in r['left']) or 'none'}; had the new one "
                           f"{', '.join(code(x) for x in r['joined']) or 'none'}; added or removed at its start and "
                           f"room {', '.join(code(x) for x in r['near']) or 'none'}")
    if any(p["order_only"].values()):
        out.append(f"- Order only: {counted(p['order_only'], ORDERED)}.")
    if p["other"]:
        out.append(f"- Other fields: {counted(p['other'])}.")
    return out + [""]


def history_section(h, f):
    commits, versions = h["commits"], h["versions"]
    pairs = f["pairs"]
    out = ["### Removed ids", "",
           "Where a removed id's content - its dupe_key - went:", "",
           "- To an id added in the same pair. A new id that sorts before the old one is consistent with a "
           "dedupe-survivor flip, a new copy with a smaller id winning the group, and with a source id change that "
           "happens to sort lower. One that sorts after cannot be the dedupe's choice, since the smallest id "
           "survives: either the source gave the listing a new id, or a smaller copy left the source while a larger "
           "one the dedupe had hidden stayed. The file keeps no merged-away ids, so the two readings cannot be told "
           "apart. Ids sort as strings, as `merge_group`'s `min()` compares them.",
           "- To an id both versions hold: a dedupe collapse.",
           "- Nowhere: gone.", ""]
    rows = []
    for k, p in enumerate(pairs, start=1):
        if p["removed"]:
            b = Counter(kind for kind, _ in p["bins"].values())
            rows.append([f"v{k} → v{k + 1}", f["classes"][k], n(len(p["removed"])), n(b["added"]), n(b["kept"]),
                         n(b["gone"]), n(len(p["loose"]))])
    out += table(["pair", "class", "removed", "under an added id", "under an id both hold", "gone",
                  "same-title matches (UNSURE)"], rows, "llrrrrr")
    out += ["### Ids that leave and later return", ""]
    if f["returns"]:
        rows = []
        for i, missed in f["returns"].items():
            last = max(v for v, vs in enumerate(versions) if any(e["id"] == i for e in vs["events"]))
            title = next(e["title"] for e in versions[last]["events"] if e["id"] == i)
            fails = ", ".join(str(versions[v].get("failures")) for v in missed)
            span_ = (f"v{missed[0] + 1} {short(commits[missed[0]]['sha'])}" if len(missed) == 1 else
                     f"v{missed[0] + 1}-v{missed[-1] + 1} ({short(commits[missed[0]]['sha'])} to "
                     f"{short(commits[missed[-1]]['sha'])})")
            gone_for = f["authored"][missed[-1] + 1] - f["authored"][missed[0]] if missed[-1] + 1 < len(commits) else None
            rows.append([code(i), code(title), span_, n(len(missed)), fails,
                         span(gone_for.total_seconds()) if gone_for else "-"])
        out += table(["id", "title", "missing from", "versions", "`failures` there", "first missing to back"], rows,
                     "lllrrr")
    else:
        out += ["None.", ""]
    out += ["### Content that returns under another id", "",
            "A dupe_key absent from one or more versions, then held again by a different id. The readings of "
            "\"sorts before\" and \"sorts after\" are the two above; no pair shows this within itself, so the "
            "examples come from across the history.", ""]
    if f["key_returns"]:
        for key, a, b, before, after in f["key_returns"]:
            e = next(x for x in versions[b]["events"] if x["id"] == after[0])
            orders = ", ".join(f"{code(x)} {'sorts before' if sorts_before(x, before[0]) else 'sorts after'} "
                               f"{code(before[0])}" for x in after)
            out.append(f"- {code(e['title'])} - {e['start']} - {e['hotel']} / {e['room']}: held by "
                       f"{', '.join(code(x) for x in before)} to v{a + 1}, absent v{a + 2}-v{b}, back in v{b + 1} "
                       f"under {', '.join(code(x) for x in after)}; {orders}.")
    else:
        out.append("None.")
    out += ["", "### `cancelled`, every transition", ""]
    flips = [(k, x) for k, p in enumerate(pairs, start=1) for x in p["flips"]]
    if flips:
        for k, (title, a, b, i) in flips:
            note = " - `scraper.py` changed in between" if f["between"][k - 1] else ""
            out.append(f"- v{k + 1} {short(commits[k]['sha'])}: {code(title)}: {str(a).lower()} → "
                       f"{str(b).lower()}{note}")
    else:
        out.append("None.")
    return out + [""]


def unions_section(h, f):
    pairs, versions = f["pairs"], h["versions"]
    if f["pre"] is None:
        return ["No version has two ids with one dupe_key, so the dedupe's groups cannot be seen.", ""]
    pre = h["commits"][f["pre"]]["sha"]
    later = [(k, p) for k, p in enumerate(pairs, start=1) if k > f["pre"]]
    out = ["The mechanism, from `scraper.py`, with each step checked against the history where the history can "
           "show it:", "",
           "1. `scrape()` sorts the events by (start, title) before `dedupe()` groups them.",
           f"2. The copies of a dedupe group tie on that sort. In {short(pre)} (v{f['pre'] + 1}), the last version "
           f"in which two ids share a dupe_key, {n(len(f['groups']))} keys are held by two or more ids, and the "
           f"copies of {n(len(f['tied']))} of them share their start and their exact title.",
           "3. Python's sort is stable, so tied copies keep the order they arrived in: the order in which "
           "`as_completed` handed back their detail pages, which is the order the requests finished.",
           "4. `merge_group` takes `speakers` and `tracks` in first appearance, so a merged event's lists - and "
           "`track`, the first of `tracks` - come out in that order.", ""]
    last = {e["id"]: e for e in versions[-1]["events"]}
    named = lambda ids: "; ".join(f"{code(last[i]['title']) if i in last else '(not in the last version)'} "
                                  f"({code(i)})" for i in ids)
    for field in ORDERED:
        hits = [i for _, p in later for i in p["reorders"][field]]
        events = sorted(set(hits))
        on = [i for i in events if i in f["grouped"]]
        off = [i for i in events if i not in f["grouped"]]
        groups = f"the v{f['pre'] + 1} groups"
        if len(events) == 1:
            verdict = f"which is an id of {groups}" if on else f"which is not an id of {groups}"
        else:
            verdict = f"of which {n(len(on))} {'is an id' if len(on) == 1 else 'are ids'} of {groups}"
        line = (f"- `{field}`, after v{f['pre'] + 1}: {many(len(hits), 'order-only change')} on "
                f"{many(len(events), 'event')}, {verdict}")
        line += f": {named(events)}." if len(events) <= SHOW else "."
        if off:
            line += f" Not in them: {named(off)}."
        out.append(line)
    multi = [e for e in versions[-1]["events"] if len(e.get("tracks") or []) > 1]
    out += [f"- Events in the last version with two or more tracks: {n(len(multi))}, of which "
            f"{n(sum(1 for e in multi if e['id'] in f['grouped']))} are ids of the v{f['pre'] + 1} groups.", "",
            "The fix, proposed and applied to nothing: sort a group by id before merging it - "
            "`group = sorted(group, key=lambda e: e[\"id\"])` at the top of `merge_group` - so the unions follow id "
            "order, the same on every run. The same order would also settle the two other picks that take the "
            "group's order today: `max` between two descriptions of one length, and `next` for the first tagged "
            "copy.", ""]
    return out


def timing_section(h, f):
    commits = h["commits"]
    out = ["### Commits by date", ""]
    days = sorted({t.date().isoformat() for t in f["authored"]} | {t.date().isoformat() for t in f["ny"]})
    rows = []
    for d in days:
        utc_all = [k for k, t in enumerate(f["authored"]) if t.date().isoformat() == d]
        ny_all = [k for k, t in enumerate(f["ny"]) if t.date().isoformat() == d]
        rows.append([d, n(len(utc_all)), n(sum(1 for k in utc_all if f["classes"][k] == "scrape")),
                     n(len(ny_all)), n(sum(1 for k in ny_all if f["classes"][k] == "scrape"))])
    out += table(["date", "UTC: all", "UTC: scrape", "New York: all", "New York: scrape"], rows)
    out += ["### Commits by hour", ""]
    rows = []
    for hr in range(24):
        u = [k for k, t in enumerate(f["authored"]) if t.hour == hr]
        y = [k for k, t in enumerate(f["ny"]) if t.hour == hr]
        rows.append([f"{hr:02d}", n(len(u)), n(sum(1 for k in u if f["classes"][k] == "scrape")), n(len(y)),
                     n(sum(1 for k in y if f["classes"][k] == "scrape"))])
    out += table(["hour", "UTC: all", "UTC: scrape", "New York: all", "New York: scrape"], rows)
    scrapes = [k for k in range(len(commits)) if f["classes"][k] == "scrape"]
    out += ["### Gaps between scrape commits", ""]
    gaps = [(a, b, (f["authored"][b] - f["authored"][a]).total_seconds()) for a, b in zip(scrapes, scrapes[1:])]
    if gaps:
        secs = [g for _, _, g in gaps]
        out.append(f"{n(len(gaps))} gaps: shortest {span(min(secs))}, median {span(median(secs))}, longest "
                   f"{span(max(secs))}.")
        out.append("")
        out += table(["from", "to", "gap"], [[f"v{a + 1} {short(commits[a]['sha'])}", f"v{b + 1} "
                                              f"{short(commits[b]['sha'])}", span(g)] for a, b, g in gaps], "llr")
    out += ["### Con days and before", "",
            f"Con days are the days the last version's events fall on, {f['con_days'][0]} to {f['con_days'][-1]} - "
            "the bounds the client's `CON` holds - and a commit's day is its New York date. Only scrape pairs are "
            "counted; `changed` is common ids with one of the ten fields changed other than by order.", ""]
    for label, keep in (("Every scrape pair:", lambda k: True),
                        ("Scrape pairs with no `scraper.py` change between them - the source's changes alone:",
                         lambda k: not f["between"][k - 1])):
        rows = []
        for when in ("before", "during", "after"):
            ps = [p for k, p in enumerate(f["pairs"], start=1)
                  if f["classes"][k] == "scrape" and keep(k) and period(f, f["authored"][k]) == when]
            if not ps and when == "after":
                continue
            rows.append([when, n(len(ps)), n(sum(len(p["added"]) for p in ps)), n(sum(len(p["removed"]) for p in ps)),
                         n(sum(len(p["changed"]) for p in ps)), n(sum(len(p["starts"]) for p in ps)),
                         n(sum(len(p["rooms"]) for p in ps)), n(sum(len(p["titles"]) for p in ps)),
                         n(sum(len(p["flips"]) for p in ps))])
        out += [label, ""]
        out += table(["period", "pairs", "added", "removed", "changed", "start", "room", "title", "cancelled"], rows)
    return out


def runs_section(h, f):
    runs = h.get("runs")
    out = []
    if runs is None:
        return ["Not read: the report was written with `--no-runs`.", ""]
    if "error" in runs:
        return [f"Unavailable: {runs['error']}.", ""]
    rs = sorted(runs["runs"], key=lambda r: r["number"])
    by = {r["number"]: r for r in rs}
    concl, trig = Counter(r["conclusion"] for r in rs), Counter(r["event"] for r in rs)
    durations = [(utc(r["updatedAt"]) - utc(r["startedAt"])).total_seconds() for r in rs]
    delays = [(utc(j["startedAt"]) - utc(r["createdAt"])).total_seconds() for r in rs for j in r["jobs"][:1]]
    joined = {sha: no for sha, no in f["join"].items() if no is not None}
    committed = set(joined.values())
    nothing = [r for r in rs if r["number"] not in committed]
    out += [f"From `gh run list --workflow={os.path.basename(WORKFLOW)}` (every run) and `gh run view` for each "
            "run's job.", "",
            f"- Runs: {n(len(rs))}: {counted(trig)}. Conclusions: {counted(concl)}. Runs on a second attempt: "
            f"{n(sum(1 for r in rs if r.get('attempt', 1) > 1))}.",
            f"- Start to last update: shortest {span(min(durations))}, median {span(median(durations))}, longest "
            f"{span(max(durations))}. A run's job started at most {max(delays):.0f} s after the run was created."
            if rs else "- No runs.",
            f"- Scrape commits made by a run: {n(len(joined))} of {n(sum(1 for c in f['classes'] if c == 'scrape'))}, "
            f"each to one run, by the run whose start to last update holds the commit's author time. Runs that "
            f"committed nothing: {n(len(nothing))} - "
            + (", ".join(f"#{r['number']} ({r['conclusion']})" for r in nothing) or "none") + ".",
            f"- Successful runs that committed nothing - no-op runs: "
            f"{n(sum(1 for r in nothing if r['conclusion'] == 'success'))}. Every scrape writes a new `generated_at`, so "
            "a run that reaches its commit step has something to commit.", ""]
    failed = [r for r in rs if r["conclusion"] == "failure"]
    ov = overlaps(rs)
    stretches, conc = cron_life(h["workflow"])
    conc_at = utc(conc["committed"]) if conc else None
    if failed:
        out += ["### Failed runs", ""]
        rows = []
        for r in failed:
            steps = "; ".join(s for j in r["jobs"] for s in j["failed"]) or "-"
            with_ = [b if a == r["number"] else a for a, b in ov if r["number"] in (a, b)]
            rows.append([f"#{r['number']}", stamp(utc(r["createdAt"])), r["event"], short(r["headSha"]), steps,
                         ", ".join(f"#{x}" for x in with_) or "-"])
        out += table(["run", "created (UTC)", "trigger", "head", "failed step", "overlapped"], rows, "llllll")
    out += ["### Runs that overlapped", ""]
    if ov:
        for a, b in ov:
            ra, rb = by[a], by[b]
            when = ("before" if conc_at is None or utc(rb["createdAt"]) < conc_at else "after")
            out.append(f"- #{a} ({ra['event']}, {ra['conclusion']}, {stamp(utc(ra['startedAt']))} to "
                       f"{stamp(utc(ra['updatedAt']))}) and #{b} ({rb['event']}, {rb['conclusion']}, "
                       f"{stamp(utc(rb['startedAt']))} to {stamp(utc(rb['updatedAt']))}), {when} scrape.yml had a "
                       f"concurrency group.")
    else:
        out.append("None.")
    out += ["", "### The cron and its slots", ""]
    if conc:
        out.append(f"- scrape.yml gained its concurrency group in {short(conc['sha'])} "
                   f"({stamp(utc(conc['committed']))} UTC, commit time). A run the group queues out is kept as a "
                   f"`cancelled` run; runs cancelled: {n(concl['cancelled'])}.")
    if not stretches:
        out.append("- No cron in scrape.yml on the ref.")
    for expr, sha_from, t_from, sha_to, t_to in stretches:
        start = utc(t_from)
        end = utc(t_to) if t_to else max(utc(r["updatedAt"]) for r in rs)
        ts = slots(expr, start, end)
        by_slot = attribute(rs, ts)
        late = [(utc(by[no]["createdAt"]) - s).total_seconds() for s, nos in by_slot.items() for no in nos]
        crowded = {s: nos for s, nos in by_slot.items() if len(nos) > 1}
        empty = [s for s in ts if s not in by_slot]
        out += [f"- `{expr}` was in scrape.yml from {short(sha_from)} ({stamp(start)} UTC) to "
                + (f"{short(sha_to)} ({stamp(utc(t_to))} UTC), by commit time" if sha_to else "the ref's head")
                + f": {n(len(ts))} slots.",
                "- GitHub records no slot for a scheduled run, so a run is counted for the last slot at or before its "
                f"creation. Under that rule {n(sum(len(v) for v in by_slot.values()))} scheduled runs fall in "
                f"{n(len(by_slot))} slots, created {span(min(late)) if late else '-'} to "
                f"{span(max(late)) if late else '-'} after their slot"
                + (f"; slots with two or more runs: {n(len(crowded))}" if crowded else "; one run a slot") + ".",
                f"- Slots with no run: {n(len(empty))}. The run metadata holds no run for any of them - no record, "
                "and no `cancelled` run the concurrency group queued out - so each one never started:", ""]
        cancelled_runs = {no for s, nos in by_slot.items() for no in nos if by[no]["conclusion"] == "cancelled"}
        rows = []
        for d in sorted({s.date() for s in ts}):
            day = [s for s in ts if s.date() == d]
            miss = [s for s in day if s not in by_slot]
            queued = [s for s in day if s in by_slot and set(by_slot[s]) <= cancelled_runs]
            sched = [no for s in day for no in by_slot.get(s, [])]
            manual = [r for r in rs if r["event"] != "schedule" and utc(r["createdAt"]).date() == d]
            rows.append([d.isoformat(), n(len(day)), n(len(sched)), n(len(manual)),
                         ", ".join(s.strftime("%H:%M") for s in miss) or "-",
                         ", ".join(s.strftime("%H:%M") for s in queued) or "-"])
        out += table(["day (UTC)", "slots", "scheduled runs", "manual runs", "slots with no run (never started)",
                      "slots queued out"], rows, "lrrrll")
    return out


def render(h):
    f = analyse(h)
    head = h["head"]
    body = ["# Schedule history - the 2026 schedule on `main`", "",
            f"Written by `tools/schedule_history.py` from `{h['ref']}` at `{head[:7]}`: every commit whose "
            f"first-parent line touched the 2026 schedule, followed back to `events.json` at the repo root, where "
            f"the file lived until the archive merge. Do not edit it by hand; run the script again.", "",
            "A record, not held fresh by CI: a shallow checkout has no history, and the history will not change. It "
            "states facts; `UNSURE` marks a match that needs a person's judgment, and the one fix it proposes "
            "(section 6) is applied to nothing. Events are matched by id, and by content through "
            "`scraper.dupe_key` - the normalised title, the start and the normalised room, the rule dedupe uses. "
            "Times are UTC. New York is UTC-4 throughout: every time converted here falls inside 2026's "
            f"daylight-saving window, and the script refuses one that does not. Lists longer than {SHOW} show their "
            "first 10.", "",
            "## 0. Headline", ""]
    body += headline(h, f) + ["", "## 1. Commits", ""] + commits_section(h, f)
    body += ["## 2. Versions", ""] + versions_section(h, f)
    body += ["## 3. Pairs", ""] + pairs_section(h, f)
    body += ["## 4. Pair by pair", ""]
    for k, p in enumerate(f["pairs"], start=1):
        body += pair_detail(h, f, k, p)
    body += ["## 5. Across the history", ""] + history_section(h, f)
    body += ["## 6. Why `tracks` and `speakers` reorder", ""] + unions_section(h, f)
    body += ["## 7. When the changes landed", ""] + timing_section(h, f)
    body += ["## 8. scrape.yml's runs", ""] + runs_section(h, f)
    text = "\n".join(body)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.rstrip("\n") + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", default="main", help="the branch whose history is read (default: main)")
    ap.add_argument("--out", default=os.path.join(ROOT, OUT))
    ap.add_argument("--no-runs", action="store_true", help="leave scrape.yml's runs out, and call no gh")
    args = ap.parse_args(argv)
    h = gather(args.ref, with_runs=not args.no_runs)
    text = render(h)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"{os.path.relpath(args.out, ROOT).replace(os.sep, '/')}: {len(h['commits'])} commits, "
          f"{text.count(chr(10))} lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
