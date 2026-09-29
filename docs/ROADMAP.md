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
  alone, 547 of 2026's events (`docs/venues/census-2026.md`, section 4),
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

### 4. Identity and sync — built (PRs #51-#62, six migrations, the contract's sections 1-8); the operations track trailing (#50)

Opened in design on 2026-09-24, after Pipeline shape closed at PR #50. The
design is DECISIONS #50-#56 and `docs/sync/contract.md`, sections 1-8, each
with its as built; the evidence is `docs/sync/recon.md`.

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
7. The push job, first: starts-soon - `push_due()` and the queue in
   `push_sent`, the `push` Edge Function that pg_cron calls through pg_net
   every minute while the kill switch is on, and a fourth migration
   (`docs/sync/contract.md`, section 7, as built; #55) - built. Then
   pick-changed: `push_due()` replaced by a fifth migration to claim both
   kinds, the fold of a run's changes per user, and the 2026 rehearsal
   tool, `tools/replay_changes_2026.py` (`docs/sync/contract.md`, section
   7, Pick-changed, as built; PR #60) - built. `mirror_state.tz`, decided
   for it, was found unneeded. Then the batch: `push_due()` replaced in
   place by a sixth migration to claim a batch at a time, whole pushes and
   starts-soon first, under PostgREST's 1,000 rows, and the sender asking
   again, two batches a run at most (`docs/sync/contract.md`, section 7,
   The batch, as built; PR #61) - built.
8. Crews, the client's layer: `src/crews.js` - create, join, leave,
   remove, delete and a new invite, each one request as the user and
   nothing written on the phone; the invite link, read at boot and kept for the
   tab's session until a screen takes it; the readers for who's going and
   the overlay; and the crews read's invite token (`docs/sync/contract.md`,
   section 8, as built; #56; PR #62) - built. The screens are Where things
   live's.

What is synced, the outbox and the conflict rule, the Postgres schema and
row-level security, the crew permission model, and push sending (the
scheduled job, the Edge Function). Rests on #8-#11, #20 and #25. It carries
VISION's Keep, Coordinate and Tell me.

Push sending is two types, pick-changed and starts-soon (#40).

The operations track trails, run beside the rest and gating none of it
(#50). What it still has to do, each line with where it came from; the
Checklist, below, keeps the history:

- ~~`ubuntu-24.04` in place of `ubuntu-latest` in the three workflows,
  `ci.yml`, `scrape.yml` and `mirror.yml`, before 2026-10-19, when GitHub
  starts moving `ubuntu-latest` to Ubuntu 26 (the notice on every job's
  run; actions/runner-images#14748).~~ Done by PR #64.
- The `dev` Environment's deployment branches restricted to `next`, so
  that a workflow on another branch cannot read the dev project's secret
  key (Checklist; #54).
- The dev project's keep-alive: a weekly request, since a free project
  pauses after about a week idle (#25; #50).
- The dev project's "Automatically expose new tables" off and its grants
  exactly the migrations': the extra rights `service_role` holds by the
  old defaults revoked by hand, since turning the setting off changes
  nothing already granted (`docs/sync/contract.md`, section 4, as built;
  #54).
- The cleanup of stale anonymous users, the track's next pull request: a
  scheduled job, by a migration, deleting only those in no crew and
  holding no subscription, and how stale that is (`docs/sync/contract.md`,
  section 2 and Open; #25, #50, #52).
- The production project, and the workflow that migrates it: dev takes
  each migration by hand, production by a workflow (#50, #52;
  `docs/sync/contract.md`, section 4).
- Production's plan: Pro for August and September, for backups and no
  pausing, and free otherwise, when the keep-alive covers it too - about
  $50 a year (#25; #50).
- Production's "Automatically expose new tables" off, as
  `supabase/config.toml`'s `auto_expose_new_tables` is, and its grants
  exactly the migrations' - the lists `00_structure.test.sql` and
  `10_push.test.sql` hold (`docs/sync/contract.md`, sections 3 and 4, as
  built; #54, #55).
- A domain verified at Resend for production's custom SMTP, without which
  the email templates cannot be edited, so production's six-digit code
  needs it; the dev project sends through Resend's test sender (#25's
  note; Checklist).
- Production's Auth, by hand, before it serves the email step: custom
  SMTP through that domain, the Magic Link and Change Email Address
  templates sending `{{ .Token }}`, an OTP length of 6, anonymous sign-ins
  on, and Confirm email on, an invariant on every project (#51, #53;
  Checklist; `docs/sync/contract.md`, section 1).
- Production's limit on anonymous sign-ins, 30 an hour per IP by default,
  set for a hotel's Wi-Fi, which puts many phones behind one address
  (`docs/sync/contract.md`, Open).
- At 2027's season start, the first mirror a dispatch of Mirror with that
  season's file; and after the first bot landing on `next`, a Mirror run
  started by the push confirmed, with a dispatch as the fallback
  (Checklist; #54).
- Before the freeze merge brings `mirror.yml` to `main`: the `production`
  Environment, its deployment branches `main` alone, with the production
  project's `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (Checklist; #54).
- Before the freeze, the push job on production: its own VAPID pair, with
  `VAPID_SUBJECT` a `mailto:`, and its own `PUSH_SECRET` - the four
  function secrets - and Vault's two rows, `project_url` and
  `push_secret`; and the function deployed (Checklist; #55;
  `docs/sync/contract.md`, section 7, as built).
- Before the freeze, `database` required on the `main` ruleset beside
  `client` and `pipeline`: the Checklist's line names those two, written
  before the `database` job existed (Checklist; #48, #52).
- At the freeze, the build that publishes `main` given production's
  `DC_SUPABASE_URL` and `DC_SUPABASE_KEY`, as the next site's build is
  given the dev project's - variables, not secrets, since the key is the
  public one and the build refuses a secret (Checklist, which names the
  next site's alone; #53).
- At the freeze, production's first mirror: the freeze merge's push
  starting Mirror under `production` confirmed, with a dispatch as the
  fallback, and every earlier run of the season flagged, by design (#54's
  Cost; `docs/sync/contract.md`, section 6). Then the push job's hand test
  repeated on production, which reads a pick's start from
  `schedule_events` (Checklist, which lists it before the freeze;
  `docs/sync/contract.md`, section 7, as built: "again on production at
  the freeze").
- Production's `flags.push_enabled` on at the freeze and off after the
  con (#55; Checklist).

### The scope pass — not a tentpole (#57); in the design slot now

Its list is the union of three sources: VISION's pillars; every item
DECISIONS or this file defers, holds, or names as the spring's, not built,
or open; and the design chat's catalogue, Part A, which the pass brings
into the repo. Every wanted feature on it is given a fuller description,
passed through VISION's test - does it help someone plan or coordinate -
and given a verdict: 2027, checkpoint candidate, or out. A description is
what the test needs, not a design: a feature is still specified when its
tentpole opens. A walk through the official 2026 app on a phone gives one
row a feature, each marked planning, coordination or reference, and the
pass writes a rule for reference content, which VISION's Not doing bans
only by implication. A DECISIONS entry comes of the pass only for a
change to VISION. The pass adds to the spring checkpoint's list, and the
checkpoint still cuts from the bottom.

Its output is two files: `docs/scope-2027.md`, Part A, the list and its
verdicts; and `docs/official-app-2026.md`, Part B, the walk. Where things
live opens with it. `docs/scope-2027.md` itself opens with an inventory of
what the app does on `next` today, read before the list.

### 5. Where things live — not opened; opens with the scope pass's output (#57)

The UI's information architecture. There are five tabs today; For you,
crews, a filter sheet and the building view need homes. No decisions yet.

Waiting for a home:

- The crew screens: create, join - with a field to paste a link into
  (Delivery) - your crews, who's going, and the overlay's look. Their data
  and actions are built (`src/crews.js`; #56; `docs/sync/contract.md`,
  section 8).
- The notifications toggle.
- The install nudge (below).

The Now tab, mini-bar and map's next-pick card drop the leave-by countdown
and keep the walk estimate and tight bands (#40).

Open here, unscheduled (#40):

- Crew status pings. The build order stays picks → presence → pings (#10).
- When the install nudge is shown: a standing line on Now, or at the
  moment it earns itself.

### 6. Delivery — not opened; last (#57)

How the app reaches a phone and stays current: `sw.js` and its cache version
(#4), hashed assets against the single file (#23), the IIFE-or-module sharp
edge (ARCHITECTURE.md), Playwright (#24), the install flow, the client side
of a push subscription, and Pages from Actions (#26).

Playwright (#24) may come forward as a standalone pull request in a free
execution slot (#57): a real-browser test earns its place under a UI
reshaping, and depends on nothing else here.

Open: `index.html` needs `mobile-web-app-capable` beside the Apple meta
(Chrome's deprecation warning, 2026-09-25).

Open: an invite link tapped on an iPhone opens the browser, not the
home-screen app, whose storage is its own, so an installed reader who taps
one joins as the browser's user. The crew screens need a field to paste the
link into, which `readInvite()` reads (#56), and the behaviour is to be
confirmed on a phone with the install flow (`docs/sync/contract.md`, Open).

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
- For the push job on dev (#55), after its pull request merges, by
  Claude Code: the migration pushed and the function deployed
  (`supabase functions deploy push`); the four function secrets -
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, the site's
  https URL, and `PUSH_SECRET` - set by `supabase secrets set --env-file`
  from the file generated for them; and Vault's `project_url` and
  `push_secret` set by `vault.create_secret`. Then by hand: the file's
  values kept in a password manager and the file deleted, and
  `flags.push_enabled` turned on in Table Editor for the hand test
  (`docs/sync/contract.md`, section 7, as built) and off after it.
- For pick-changed on dev (#55), after its pull request merges, by Claude
  Code: the fifth migration pushed and the function deployed again; then
  the rehearsal - `python tools/replay_changes_2026.py --load`, from a
  clone with `main`'s history, the service key from an env file outside
  the repository - which loads 2026's change log into `schedule_changes`
  and reports 45 lines whose event `schedule_events` does not hold. Then
  the hand test (`docs/sync/contract.md`, section 7, Pick-changed, as
  built): a browser subscribed again, three picks by SQL, the switch on for
  it and off after, the picks written back as tombstones and the test's
  `push_sent` rows deleted; the loaded lines kept.
- For the batch on dev (#55), after its pull request merges, by Claude
  Code: the sixth migration pushed, a dry run first, and the function
  deployed again; the switch stays off, and a call without the secret
  answers 401, with it `{off: true}`. No hand test: the local end-to-end
  run is the batch's (`docs/sync/contract.md`, section 7, The batch, as
  built).
- For the push job on production, in the operations track, before the
  freeze: its own VAPID pair, with `VAPID_SUBJECT` a `mailto:` - a push
  service that needs to reach the sender cannot use a page - and its own
  `PUSH_SECRET`; the same four secrets and two Vault rows; the function
  deployed; the hand test repeated; and `flags.push_enabled` on at the
  freeze, off after the con (#55).
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
