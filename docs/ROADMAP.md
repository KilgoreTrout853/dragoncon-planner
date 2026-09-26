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

### 1. Pipeline shape — built (#41-#49); closed

The design is DECISIONS #41-#48 and `docs/pipeline/contract.md`, the data
contract; the evidence is `docs/pipeline/history-2026.md` and
`docs/venues/census-2026.md`. Outreach is deferred, and the raw row is the
seam a feed would plug into (#41). The sequence:

1. Docs: DECISIONS #41-#48, the contract, this file.
2. `season.json` and `venues.json`, for 2027 and for 2026 (frozen,
   `PROMPT_VERSION` 1) - built: the migration from
   `docs/venues/registry.json`, which is retired; the Mart's levels; the
   walk table; the loaders, `season.py` and `venues.py`, and their CI
   tests; the room census retargeted at `venues.json`. Beside it, as
   Discover housekeeping, census v2 counts a year's works block, not the
   registry (#46).
3. Fetch: `fetch()`, the raw row, `location` verbatim, failures named,
   `stale`, the repair, `season.json` read. Testable against the live 2026
   source with `--limit` - built: `scraper.fetch()` and its result object;
   `source.json`, with `stale` and `removed` carried; the fatal rules, a
   failed day list among them; the repair, ftfy's `fix_encoding`, before
   whitespace is collapsed; the year from `season.json`; the v1 writer
   deleted.
4. Ids, and the replay harness, with its report (#43) - built:
   `ids_stage.py`, its rules as `contract.md` has them, the ledger's file
   and `data/2027/ids.jsonl`, empty; `scraper.carry()`, the fetch's
   carrying on its own; `tools/replay_2026.py` and `replay-2026.md`: ours
   differ from the frozen file's ids on the two James Callis sessions
   alone, and the Salon pair is UNSURE by its title.
5. The venues step (#45) - built: `venues_stage.py`, the hotel split out
   of the scraper and the resolver - aliases, exact rooms, the grammar,
   the Mart - with its report; the room census retargeted at it, as the
   curation worklist.
6. Build: the merge with sorted unions, `cancelled` read by the parse
   step, tolerance, the digest, one event a line, `removed`, `stale`, the
   place fields, untagged events. 2026's `events.v2.json` is rebuilt in
   the new shape, so the client reads one shape - built: `merge_stage.py`;
   `events_v2.py`'s two front doors, frozen and live, and its tolerance,
   counted in its report and held at zero on 2026 by
   `tests/test_zero_hold.py`; `cancelled` by `parse_stage.is_cancelled`;
   the digest, and one works row and one event a line; 2026's file
   rebuilt, 164 of its rooms read anew by the venues step.
7. Tag and diff, in two. 7a, the tag stage - built: `tag_key.py`, the
   input and its key and the cache's file, a leaf both the tag stage and
   the build import; a season read through the build's front door and the
   merge; `prompt_version` from `season.json`; `seed`; the request cap and
   `--requests`; the result the run summary reads; the frozen refusal; and
   `minted` on a minted row. 7b, the diff - built: `diff_stage.py`, one
   line per event and kind, `merged` read from `was`, each line `source` or
   `code` by the attribution document the caller builds with
   `events_v2.attribution()`, `changed_at` with the digest, `render()`; and
   the change log's committed check, skipped until a live run commits.
8. The orchestrator, the run summary and the workflow, proven by a
   dispatch run against the 2026 source with `--limit` into a scratch
   branch - built: `pipeline.py`, its `run`, `window` and `summary`; the
   snapshot of the previous files; one stamp handed down to every stage,
   and one git call, `rev-parse HEAD`, with `fetch_code_hash` for
   `fetch_code_changed`; every stage called with its inputs; the writes
   all or nothing, the change log's prefix check among them, and the
   build's second run on the texts about to be written; `last-run.json`
   as built; `scrape.yml`, landing each run by pull request with
   auto-merge; `requirements.txt` frozen; and the season-start sequence
   it owns: a dispatch run to the ids stage, then `seed`, then the cron,
   whose runs finish a first tag in about three (`contract.md`, The run,
   as built).
9. The 2027 client switch, after a design pass of its own; its pick
   reconciliation reads `was` (#43) - built (#49): `DC_YEAR` at the
   build, the season and venues files as modules, storage and caches keyed
   by the year, removed events in Mine alone, `was` in the pick
   reconciliation, untagged events read through one helper, and the
   worker on the digest.

Pipeline shape is closed. What it leaves, carried:

- The alias worklist: the room strings the venues step reads at the hotel
  alone, 686 of 2026's events (`docs/venues/census-2026.md`, section 4),
  each an alias or a room to curate (#45).
- Curation gaps (#45): the Westin's current, post-renovation floor plan
  (`docs/venues/README.md`); the Marriott's Atrium and Marquis note
  entries, and the Courtland Grand's room list (room census, section 5).
- Census v2's 45 double-encoded events are 51 with the six lone "Â"
  events PR #33's encoding probe found: Discover housekeeping in
  `census_v2.py`.
- Brandish: census v2's Appendix A opens with it, 44 events, unreviewed -
  searchable, never followable - until a works review (#34, #46).
- The attribution runs on almost every run (PR #49): each landed run moves
  the target's head, so the next run's SHA differs from the last one's. A
  hash of the build's code instead of the SHA would skip it, if the cost
  ever matters.
- `CON`'s 18:00 and 19:00 are 2026's observed bounds, the first listed
  start and the last end; they move into `season.json` once 2027's
  schedule shows its own (#49).

Identity and sync opened in design on 2026-09-24 (#37).

The Postgres mirror (#27) is the seam: Pipeline shape ends at writing JSON,
and the mirror is designed with Identity and sync's schema and row-level
security (#37).

Venue resolution is Places' data half, which moved here (#37): the room
census is done (PR #33), and the venues file and room resolution are #45.

The raw row's `speakers` is the detail page's Speakers section only, never
derived from the description; the parse stage owns the "Additional
Panelists:" line (#42).

The scraper decodes these feeds correctly; the source sends the text
double-encoded, and the fetch repairs it, with ftfy's `fix_encoding`,
before whitespace is collapsed (#44, PR 3). 45 events of the frozen 2026
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
down to the level. Rests on #21, #27 and #28. The venues registry is
retired into the venues file, `data/<year>/venues.json` (Pipeline shape's
PR 2), and the room census is done (PR #33); room resolution is Pipeline
shape's venue resolution (#37, #45). The building view's drawings and
sketches continue on the side, in chat; a Places PR beyond what the
pipeline absorbs takes a free review slot.

### 4. Identity and sync — in design (opened 2026-09-24, after Pipeline shape closed at PR #50; the recon is `docs/sync/recon.md`)

1. The channel in the key (#39) - built.
2. Docs: `docs/sync/contract.md` sections 1-4, DECISIONS #50-#52 - built.
3. The schema: migrations, RLS, pgTAP, the `database` CI job - built.
4. The client's identity: the backend's two build constants,
   `src/backend.js` and `src/identity.js`, the email step in Settings, and
   the sync rules written down, `docs/sync/contract.md` section 5 and
   DECISIONS #53 - built.
5. Picks and follows sync: the doors, the outbox, the pull, the crew's
   data, the status line in Keep your plan, and a second migration -
   `synced_at`, the key columns' grant and the trigger that keeps them
   (`docs/sync/contract.md`, section 5, as built) - built.
6. The mirror job: `schedule_events` and `schedule_changes`, written
   after a scrape's pull request merges, hourly in the season's window and
   by hand, and a third migration - the events' times nullable, and the
   mirror's three tables granted to `service_role` by name
   (`docs/sync/contract.md`, section 6, as built) - built.

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

Open: `index.html` needs `mobile-web-app-capable` beside the Apple meta
(Chrome's deprecation warning, 2026-09-25).

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
- The worker's new-schedule notice: done by #49, on the file's `digest`,
  `generated_at` deciding only for a copy without one.
- Search tuning by the eval harness (#36): held until the first pass of the
  whole app. The call postdates #37, which ran it once PR 6 had landed.

## Flags

- The freeze date is tied to the source's posting date for the 2027
  schedule.
- The listing-only pre-check, held as a fallback against 403 pushback
  (#48).

## Checklist

Steps taken by hand, beside the PRs rather than in them:

- Beside PR 2: `anthropic_key.txt` deleted from the working copy, and its
  key revoked (#46).
- Before PR 8's dispatch run: `ANTHROPIC_API_KEY` as a repository secret,
  with a spend cap in the console (#46); the fine-grained token as a
  secret, `SCHEDULE_BOT_TOKEN`, expiring the month after the con (#48);
  "Allow auto-merge" turned on (#48); and `SCRAPE_TARGET` = `next`, a
  repository variable.
- After the `database` job's first green run: `database` required on the
  `next` ruleset (#52).
- On the dev project, for the email step: anonymous sign-ins turned on, and
  the Magic Link and Change Email Address templates sending the code,
  `{{ .Token }}`, rather than a link (#51, #53).
- Before the production project serves the email step, its Auth set up by
  hand: custom SMTP, with a domain verified at the sender - the templates
  cannot be edited without it (#25's note) - the Magic Link and Change
  Email Address templates sending `{{ .Token }}`, an OTP length of 6,
  anonymous sign-ins on, and Confirm email on (#51, #53).
- On every project, an invariant: Confirm email stays on. With it off, the
  server sets an anonymous user's email with no code at all, so anyone
  could claim an address they do not own, and its owner's later recover
  would sign into the claimant's plan (`docs/sync/contract.md`, section 1).
- For the next site's backend: `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` in
  the `dragoncon-planner-next` repository's workflow, set by hand as
  repository variables, not secrets - the key is the public one, and the
  build refuses a secret (#53).
- For the mirror job (#54): the `dev` Environment's variable
  `SUPABASE_URL` and secret `SUPABASE_SERVICE_KEY`, the dev project's -
  set 2026-09-25; and `dev`'s deployment branches restricted to `next`, so
  a workflow on another branch cannot read the dev project's secret key.
  After the mirror's pull request merges, its migration pushed to the dev
  project before the first run, as each migration is (#52).
- Before the freeze merge brings `mirror.yml` to `main`: the `production`
  Environment, its deployment branches `main` alone, with the production
  project's `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (#54).
- A season's first mirror is a dispatch of Mirror, `season` its season
  file, and 2026's too; and after the first bot landing on `next`, a
  Mirror run started by the push confirmed - no document says an
  auto-merge the bot's token turned on starts one - with a dispatch as the
  fallback (#54).
- At the season start, once the first run past the ids stage has written
  `data/2027/events.v2.json`: `DC_YEAR=2027` on `next`, in the next site's
  build - the `dragoncon-planner-next` repository's workflow (#49).
- Before the 2027 client ships: the icons and the preview image redrawn
  for 2027. `public/icon.svg`, the `icon-*.png` files and `og-image.png`
  draw DC26 and Dragon Con 2026, which the build's stamp does not reach
  (`make_icons.py`; #49).
- Before the freeze: `client` and `pipeline` required on the `main`
  ruleset (#48).
- At the freeze: `next` merges to `main`, the default branch flips to
  `main`, and `SCRAPE_TARGET` flips to `main`, by hand (#48; PR 8); and
  `DC_YEAR=2027` on `main`, in the build that publishes it (#49).
- After the con: the `next` ruleset allows merge commits beside squash,
  `main` merges back into `next` as a merge commit, and the default branch
  and `SCRAPE_TARGET` flip back to `next` (#48).
- Every year: a new token (#48).
