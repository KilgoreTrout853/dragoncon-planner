# Roadmap — 2027

The order of the 2027 work, by tentpole (DECISIONS #30). VISION.md says what
the app is for and DECISIONS.md what was decided; this file says what is
open, what is held, and what comes next. It is short on purpose: a feature
is specified when its tentpole opens, not before.

## Rules

- Most features hang off a few load-bearing designs. Those are the six
  tentpoles below.
- A tentpole opens with a design chat. The chat ends in DECISIONS entries, a
  data contract, and a first Claude Code prompt, usually a read-only census.
- One tentpole is in design and one in execution at a time. Review
  attention, not code throughput, is the limit.
- There is no feature-level plan for a tentpole that has not opened.
- Discover is first.

## Dates

The con is Labor Day weekend 2027. The spring checkpoint and the freeze are
unset. There are no other dates.

## The tentpoles

### 1. Pipeline shape — designed (#41-#48); executing

The design is DECISIONS #41-#48 and `docs/pipeline/contract.md`, the data
contract; the evidence is `docs/pipeline/history-2026.md` and
`docs/venues/census-2026.md`. Outreach is deferred, and the raw row is the
seam a feed would plug into (#41). The sequence:

1. Docs: DECISIONS #41-#48, the contract, this file.
2. `season.json` and `venues.json`, for 2027 and for 2026 (frozen,
   `PROMPT_VERSION` 1): the migration from `docs/venues/registry.json`,
   which retires; the Mart's levels; the walk table; the loader and its CI
   test; the room census retargeted at `venues.json`. Beside it, as
   Discover housekeeping, census v2 counts a year's works block, not the
   registry (#46).
3. Fetch: `fetch()`, the raw row, `location` verbatim, failures named,
   `stale`, the repair, `season.json` read. Testable against the live 2026
   source with `--limit`.
4. Ids, and the replay harness, with its report (#43).
5. The venues step (#45).
6. Build: the merge with sorted unions, `cancelled` read by the parse
   step, tolerance, the digest, one event a line, `removed`, `stale`, the
   place fields, untagged events. 2026's `events.v2.json` is rebuilt in
   the new shape, so the client reads one shape.
7. Tag and diff.
8. The orchestrator, the run summary and the workflow, proven by a
   dispatch run against the 2026 source with `--limit` into a scratch
   branch.
9. The 2027 client switch, after a design pass of its own; its pick
   reconciliation reads `was` (#43).

Identity and sync opens in design once PR 2 is running (#37).

The Postgres mirror (#27) is the seam: Pipeline shape ends at writing JSON,
and the mirror is designed with Identity and sync's schema and row-level
security (#37).

Venue resolution is Places' data half, which moved here (#37): the room
census is done (PR #33), and the venues file and room resolution are #45.

The raw row's `speakers` is the detail page's Speakers section only, never
derived from the description; the parse stage owns the "Additional
Panelists:" line (#42).

The scraper decodes these feeds correctly; the source sends the text
double-encoded, and the 2027 pipeline repairs it inside fetch, before
whitespace is collapsed (#44). 45 events of the frozen 2026
file - 27 in Role-Playing Games (Campaign), 17 in Role-Playing Games
(Non-Campaign) and 1 in Collectible Card Games - carry text that was UTF-8
read as cp1252 ("â€“" for "–", "FaerÃ»n" for "Faerûn"), found by
`draft_people.looks_double_encoded`. The frozen file keeps them as scraped,
and so does `events.v2.json`, which copies the scraped fields as they are.

### 2. Discover — built (PRs 1-6); search tuning (#36) held until the first pass of the whole app

What an event is about, who is on it, and how a reader finds it: the
registries, tags v2, and the derived file. Rests on #22 and #31-#33, and
supersedes #3 when built. The design is `docs/discover/schema-v2.md`; the
evidence is `docs/discover/census-2026.md`. The sequence:

1. Docs: the design note, DECISIONS #30-#33, this file.
2. The parse stage: `facets` and `people`, no model; the census corrected
   with its name splitter.
3. Registries seeded: `works.json`, `people.json`, `tracks.json`.
4. Tagger v2 - built: `tag_stage.py` and its cache, `events_v2.py` and
   `events.v2.json` (DECISIONS #34).
5. Census v2 - built: `census_v2.py` writes
   `docs/discover/census-v2-2026.md`, held fresh by CI (DECISIONS #35).
6. The client switch - built, in two: the works block in `events.v2.json`
   (DECISIONS #38), and the client reading it, plumbing and parity (#36,
   #39).
7. Search tuning, by an eval harness (#36) - held until the first pass of
   the whole app (Held).

### 3. Places — designed; its data half is Pipeline shape's

Where a room is: the venues file, room resolution, and the building view
down to the level. Rests on #21, #27 and #28. The venues registry is merged
(`docs/venues/`), and the room census is done (PR #33); the venues file
and room resolution are Pipeline shape's venue resolution (#37, #45). The
building view's drawings and sketches continue on the side, in chat; a
Places PR beyond what the pipeline absorbs takes a free review slot.

### 4. Identity and sync — not opened; designed while Pipeline shape executes (#37)

What is synced, the outbox and the conflict rule, the Postgres schema and
row-level security, the crew permission model, and push sending (the
scheduled job, the Edge Function). Rests on #8-#11, #20 and #25. It carries
VISION's Keep, Coordinate and Tell me.

Push sending is two types, pick-changed and starts-soon (#40).

### 5. Delivery — not opened

How the app reaches a phone and stays current: `sw.js` and its cache version
(#4), hashed assets against the single file (#23), the IIFE-or-module sharp
edge (ARCHITECTURE.md), Playwright (#24), the install flow, the client side
of a push subscription, and Pages from Actions (#26).

### 6. Where things live — not opened; opens last

The UI's information architecture. There are five tabs today; For you,
crews, a filter sheet and the building view need homes. No decisions yet.

The Now tab, mini-bar and map's next-pick card drop the leave-by countdown
and keep the walk estimate and tight bands (#40).

Open here, unscheduled (#40):

- Crew status pings. The build order stays picks → presence → pings (#10).
- When the install nudge is shown: a standing line on Now, or at the
  moment it earns itself.

## Held

- The room census: done (PR #33, `docs/venues/census-2026.md`).
- `scrape.yml`'s path onto a PR-only branch (#26): decided by #48.
- Dragon Con outreach (#19): deferred, with no date (#41).
- The worker's new-schedule notice. `sw.js` tells the page of a new schedule
  only when `generated_at` moves, and every rebuild of `events.v2.json` -
  after a registry or a cache edit - keeps it (#39). Pipeline shape's input
  is the file's `digest`, with nothing volatile in it (#42); whether the
  worker reads that or the HTTP ETag is still Delivery's call.
- Search tuning by the eval harness (#36): held until the first pass of the
  whole app. The call postdates #37, which ran it once PR 6 had landed.

## Flags

- The freeze date is tied to the source's posting date for the 2027
  schedule.
- Curation gaps (#45): the Westin's current, post-renovation floor plan
  (`docs/venues/README.md`); the Marriott's Atrium and Marquis note
  entries, and the Courtland Grand's room list (room census, section 5).
- The listing-only pre-check, held as a fallback against 403 pushback
  (#48).
- Census v2's 45 double-encoded events are 51 with the six lone "Â" events
  PR #33's encoding probe found: Discover housekeeping in `census_v2.py`.

## Checklist

Steps taken by hand, beside the PRs rather than in them:

- Beside PR 2: `anthropic_key.txt` deleted from the working copy, and its
  key revoked (#46).
- Before PR 8's dispatch run: `ANTHROPIC_API_KEY` as a repository secret,
  with a spend cap in the console (#46); the fine-grained token as a
  secret, expiring the month after the con (#48); "Allow auto-merge"
  turned on (#48).
- Before the freeze: `client` and `pipeline` required on the `main`
  ruleset (#48).
- At the freeze: `next` merges to `main`, the default branch flips to
  `main`, and the freeze PR flips the scrape's target (#48).
- After the con: the `next` ruleset allows merge commits beside squash,
  `main` merges back into `next` as a merge commit, and the default branch
  and the target flip back (#48).
- Every year: a new token (#48).
