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

## The spring checkpoint

Its candidates, `docs/scope-2027.md`'s section 3 in rank order; the cut
takes from the bottom (#18):

1. W4, similar events, computed in the pipeline.
2. W24, status pings tied to a pick.
3. W35, crew pings by push, after W24.
4. W46, your own schedule items.
5. W10, recent and pinned searches.
6. W17, a pre-con "help me plan", behind a flag.
7. W30, a recover that brings a phone's crews across.
8. W26, hand a crew over.
9. W15, onboarding: pick your fandoms.
10. W29, hide my plan.

The building view, W38 to W41, ranks above every one: if the checkpoint
must cut a 2027 row, not these (#60).

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
  alone, 30 of 2026's events (`docs/venues/census-2026.md`, section 4),
  each an alias or a room to curate (#45).
- A curation gap (#45), closed for the Westin's plan: its current floor
  plans are on the hotel's events page, and its 6th, 7th and 8th Floors
  are drawn (`docs/venues/README.md`); the 12th and 14th Floors are not.
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
shape's venue resolution (#37, #45). The building view is 2027 (#60): its
drawings a side lane, its screens Where things live's, with the map.

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
- pgTAP lines owed for the display name's update: `03_member.test.sql`
  pins that a member cannot hand a membership to someone else, `user_id`,
  but nothing pins `crew_id` or `joined_at`, which only `crew_members`'
  grant - `display_name` alone - refuses; a member's update naming either
  answers 403 `42501` on the CLI's local stack (PR #80;
  `docs/sync/contract.md`, section 3, as built; #52).
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
  note; Checklist). The about panel names Resend (`src/about.js`, #92), so
  another sender changes its words.
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
- Before the freeze, `database` and `browser` required on the `main`
  ruleset beside `client` and `pipeline`: the Checklist's line names
  those two, written before the `database` and `browser` jobs existed
  (Checklist; #48, #52, #81).
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

### The scope pass — not a tentpole (#57); done (PRs #69 and #70), its verdicts in and Part B landed; closed

Its list is the union of three sources: VISION's pillars; every item
DECISIONS or this file defers, holds, or names as the spring's, not built,
or open; and the design chat's catalogue, Part A, which the pass brings
into the repo. Every wanted feature on it is given a fuller description,
passed through VISION's test - does it help someone plan or coordinate -
and given a verdict: 2027, checkpoint candidate, or out. A description is
what the test needs, not a design: a feature is still specified when its
tentpole opens. A walk through the official 2026 app on a phone gives one
row a feature, each marked planning, coordination or reference, and the
pass writes a rule for reference content, which VISION's Not doing banned
only by implication. A DECISIONS entry comes of the pass only for a
change to VISION. The pass adds to the spring checkpoint's list, and the
checkpoint still cuts from the bottom.

Its output is two files: `docs/scope-2027.md`, Part A, the list and its
verdicts; and `docs/official-app-2026.md`, Part B, the walk. Where things
live opens with it. `docs/scope-2027.md` itself opens with an inventory of
what the app does on `next` today, read before the list.

Done by PR #69: `docs/scope-2027.md`'s section 2 given its descriptions,
tests and verdicts, and section 3, the verdicts - 2027, the spring
checkpoint's candidates in rank order, and out; and DECISIONS #59, the
rule for reference content, and #60, the building view a 2027
commitment, with the VISION changes they make. Part B,
`docs/official-app-2026.md`, the walk, landed by PR #70, and added W46,
your own schedule items, to the spring checkpoint's candidates. With it the
pass is closed.

`docs/scope-2027.md`'s W44, a calendar alarm on each exported event, is
2027: a small standalone pull request, for a free execution slot (#57).

### 5. Where things live — in design → closing docs (PR #73)

Opened in design on 2026-09-29, after the scope pass. The recon:
`docs/screens/recon.md`, the client's screens at `next` 7968d96. The
design is DECISIONS #62-#66 and `docs/screens/contract.md`, which names
every wanted feature's home, section by section, and every entry point's
way back.

Five tabs in today's positions, Plans in Mine's slot (#62): Now, Search,
Explore, Map, Plans. Crew is a dimension of every tab, not a place, and
its management is Plans'. The bar is provisional, with a tripwire (#62).

The sequence, each pull request small and shippable to the next site.
W44, the calendar alarm, is not in it: a standalone pull request in a free
execution slot (#57), which can run before any of this.

1. The docs: DECISIONS #62-#66 and `docs/screens/contract.md` - this pull
   request.
2. The bar: `mine` → `plans` - the tab, its view, its module and its
   badge, and the tests' selectors (`docs/screens/recon.md`, section 10,
   counts the files) - `--nav-h` measured and the five numbers derived
   from it, and the opening tab by phase. Behaviour otherwise unchanged.
   A phone check on the next site (contract, section 1) - built (PR #74).
3. The quieter Now: leave-by out (#40) - the hero, the mini-bar, the map
   card; streams; `SLACK_MIN`, `leave.js` → `walk.js`,
   `currentLocation()` deleted - and the install nudge's gate (#65). A
   hand check on the next site with a simulated clock (contract, sections
   2 and 12) - built (PR #76).
4. Plans, the crew: the header and its actions, join by a tapped and a
   pasted link, the My day | Crew segment and the crew's day, and the sync
   redraw on a crew change. A hand test with two browsers on dev (contract,
   section 5) - built (PR #77).
   - 4b. W28's `crews.js` action, one's own display name, and its place in
     the header: a small follow-up - built (PR #80), in the crew panel's
     manage step, which the header's Manage opens.
5. Crew everywhere, in three pull requests (contract, sections 2, 5, 6, 7
   and 8):
   - 5a. Who's going on the sheet, the crew counted per hotel on the Map -
     people, not picks - and the crew section on Now, Your crew right now;
     the crew redraw's gate (PR #77) widened to every tab that draws a
     crew, and to an open event's sheet (Flags) - built (PR #81).
   - 5b. W25, Share a day, in Plans' action strip: a day of the reader's
     picks as a message and a link that needs no backend, and the link
     opened, a list kept in memory alone with the reader's own stars
     (#69) - built (PR #85; contract, section 5, Share a day, as built).
     Before it, PR #84: the worker keeps the page once, under its address
     less the query, which a `?day=` link would otherwise have added to.
   - 5c. The hotel sheet's crew: Your crew here under the reader's own
     picks, a line a crewmate's pick, the head's count the pill's, refilled
     in place by a pull, and an open hotel sheet counted in the crew
     redraw's gate - built (PR #82; contract, section 8, as built).
   - 5d. The crew's words: a star is a pick, not a whereabouts (#68) -
     "Starred by" on the event's sheet, Your crew's picks right now and
     here, "yours too" on a line; words only - built (PR #83; contract,
     sections 2, 7 and 8, as built).
6. The filter sheet, W13, with W8's topic axes: no Apply, one value a
   filter, each filter in effect a chip under the box, and a word in the
   box holding its filter (#70) - built (PR #88; contract, section 3, as
   built).
7. The row and the sheet (#64): the three lines, the facets, W1's flag and
   line, the chips and the place line as entry points at the hotel's
   grain, W18's level where the data is, W42's line once its review has
   merged (contract, sections 7 and 10). The row - the time a range on
   line 2, the place as text and the level by its short name, the facet
   flags and W1's overlap flag on line 3, and the gap line saying no
   overlap - built (PR #92, #73; contract, section 10, as built). The
   sheet - the level in full, the facts in the row's words, the other
   sessions, W1's line before the star and after it, the people with
   W42's line under a name, and the star written in place - built (PR #93,
   #74; contract, section 7, as built); W42's line shows once its review
   has merged. The entry points - the place line a tap to the Map, focused
   on the event, the hotel's grain a ring on its block; each track's chip
   and each reviewed work's a tap to its Explore page; focus on what a tap
   opened; and the other sessions still to come alone - built (PR #94,
   #75; contract, sections 6, 7 and 11, as built). The cue that a
   scrolling area has more past its edge - a fade on six areas of the
   sheet, as deep as what is hidden there, with the crew pill's landing
   and a drag in Advanced fixed beside it - built (PR #95, #76; contract,
   section 7, as built). Nothing is left of this step.
   - 7b. W7's facets as filters in the filter sheet, now that the row
     shows them (#70): cost, sign-up, audience and sold out, four selects
     under Getting in, each one value like every other filter, with 18+
     one rule for the word, the filter and the row's flag; not a game's
     format or level - built (PR #96, #77; contract, section 3, as
     built).
8. Explore's top: For you and the zero state, its source decided at its
   design; W5's Mute beside Follow on a page; W6's cast group in Search and
   in Following (contract, section 4); and Explore's filter box kept across
   a redraw, which lifts the crew redraw's gate (Flags). That last clause
   went first, since the rest puts more on Explore that redraws: the box
   built once, a draw of the grid writing around it, and a crew's change
   a redraw on any tab - built (PR #100, #80; contract, section 4, as
   built). Mute beside Follow, and the cast group in Search and in
   Following - built (PR #103, #84, #85; contract, section 4). What is
   tapped stays where it stood, a fix before For you, which puts a Show
   more where the folds are - built (PR #104, #86; contract, section 0).
   For you, a short list with its reasons, first on the grid, and
   Following folded under it - built (PR #105, #87; contract, section 4).
   The zero state, "Start here" and the big ones in For you's place where
   it has no row - built (PR #106, #88; contract, section 4). 8b, the last
   of step 8, is built: nothing is left of it.
   - 8b. W2, the alternatives in the time a cancelled or moved pick
     vacated, under the picks-changed notice on Now and Plans, and a
     cancelled pick no longer next - built (PR #108, #90; contract,
     section 2).
9. The gear, in two pull requests (contract, section 9) - built whole.
   The first (PR #110, #92): Settings a heading, one body that scrolls and
   a pinned Done, About this app behind its row, and Remove all picks in
   Settings alone. The second (PR #111, #93): Delete my account (W45),
   with its migration.
10. The building view (#60), in five pull requests, the drawings a side
    lane; the map is one persistent SVG (PR #107, #89); the place line
    reaches the room's grain here (contract, section 6). A, the level
    drawings in the app and the building's model, with no screen - built
    (PR #112, #94). B, the stack (W38): a venue lifted into its floors, the
    reader's picks lit, end states only. C, the level (W39): rooms in
    place, and a tap on a room for what is on there. D, the motion between
    them (W40). E, "All `<n>` on Saturday", a place filter in Search.
11. An accessibility sweep (#66) of what the pull requests above left,
    which adds its checks to the browser tests. Their harness came
    forward from the execution slot - built (PR #101, #81): Playwright in
    two engines at three sizes, two standing checks on every tab, and
    the header's simulated-time chip its first named test (#82).

The rename and the leave-by removal are the first two changes a reader
sees: the group can tap the five tabs after PR 2 and the quieter Now after
PR 3.

Open here (contract, Open):

- Crew status pings (W24, a checkpoint candidate). The build order stays
  picks → presence → pings (#10).
- ~~When the install nudge is shown (W36, W37 folded in): a standing line
  on Now, or at the moment it earns itself.~~ Once the reader has a pick
  (#65).
- The crew's day beyond per-person lists, and the Now board beyond one
  line per crewmate.

### 6. Delivery — not opened; last (#57)

How the app reaches a phone and stays current: `sw.js` and its cache version
(#4), hashed assets against the single file (#23), the IIFE-or-module sharp
edge (ARCHITECTURE.md), Playwright's tests of the worker, of offline and
of install (#24; its harness is built, #81), the install flow, the client side
of a push subscription, and Pages from Actions (#26).

The notifications toggle (W34) is Delivery's whole, built with its wiring:
its place is in Settings' body, between Keep your plan and About this app,
and no slot is kept for it (#92; `docs/screens/contract.md`, section 9).

The install flow is W36 (`docs/scope-2027.md`), 2027, W37 folded in: its
mechanics are Delivery's; what it says and when it shows are the install
nudge's, whose home is the top of Now, shown once the reader has a pick
(#65; `docs/screens/contract.md`, section 2).

Playwright (#24) came forward as a standalone pull request in the
execution slot (#57), for layout (PR #101, #81): a real-browser test earns
its place under a UI reshaping, and depended on nothing else here. Its
tests of the worker, of offline and of install are still Delivery's.

Open: `index.html` needs `mobile-web-app-capable` beside the Apple meta
(Chrome's deprecation warning, 2026-09-25).

Open: an invite link tapped on an iPhone opens the browser, not the
home-screen app, whose storage is its own, so an installed reader who taps
one joins as the browser's user. The join step has had a field to paste the
link into since PR #77, which `readInvite()` reads (#56), and a pasted link
joins the home-screen app's own user, another member; the behaviour is to be
confirmed on a phone, by PR #77's hand test and with the install flow
(`docs/sync/contract.md`, Open).

## Held

- The room census: done (PR #33, `docs/venues/census-2026.md`).
- `scrape.yml`'s path onto a PR-only branch (#26): decided by #48.
- Dragon Con outreach (#19): deferred, with no date (#41).
- The worker's new-schedule notice: done by #49, on the file's `digest`,
  `generated_at` deciding only for a copy without one.
- Search tuning by the eval harness (#36): held until the first pass of the
  whole app. The call postdates #37, which ran it once PR 6 had landed.

## Flags

- Delete my account reaches a second phone signed in as the same user
  only when its token next expires, within the hour: until then its reads
  come back empty, so its crew goes, and a star it sends is turned away,
  409 (#93). Left as built.
- The cleanup of stale anonymous users, when it is built, skips anyone in
  a crew (#52), so a crew member who never added an email and lost the
  phone's session keeps rows nothing removes: they cannot sign in to
  delete (#93). The operations track's.
- `supabase/config.toml`'s Auth is not the dev project's: anonymous
  sign-ins off, confirmations off, and a link where dev sends a code. A
  probe of the app's sign-in on the local stack needs a scratch copy with
  those set, as PR #111's had. The operations track's.
- The freeze date is tied to the source's posting date for the 2027
  schedule.
- The listing-only pre-check, held as a fallback against 403 pushback
  (#48).
- ~~A redraw rebuilds Explore's grid, and its filter box with it, so a pull
  that changes the reader's own picks or follows - another device's - takes
  the focus and the caret from a reader typing there; the text stays.
  Search's box is kept across a redraw. PR #77 asks for a crew's redraw
  only while Plans or the crew panel is on screen for this reason; since
  PR #81, while Now, the Map or Plans is the tab, or the crew panel or an
  event's sheet is open - and since PR #82 a hotel's - never on Search or
  Explore alone. An event's or a hotel's sheet open over Explore draws
  Explore again behind it, where focus is in the sheet and the filter box
  keeps its text. The picks path is as it was. Keeping Explore's filter box
  across a redraw, which lifts the gate, is step 8's (Explore's top).~~
  Closed by PR #100 (#80): the filter box is built once, and a draw of the
  grid writes around it - what stands above the sticky block, the jump
  chips and the tiles - so the box keeps its node, and with it its focus,
  its caret and its text, through a pull's redraw, a return to the page
  and a tap that draws the page whole. The gate is gone: a crew's change
  pulled, and the crews forgotten, ask for a redraw on any tab, as the
  reader's own picks and follows do (contract, section 4, The filter
  box, as built).
- A redraw of Explore still takes focus from whatever else had it. On
  the grid: the Following heading, a follow's chip and its unfollow,
  "+ Follow more", By interest and By time, a Following row and its
  star, Show more, Already happened, a Because-you-starred tile, a jump
  chip, a tile and Show all. On a page: the way back, Follow, the folds,
  a row and its star. PR #100 kept the filter box alone (#80). PR #103's
  controls join them: Mute, the Muted fold, a muted chip and its x, and
  the cast's fold and its photo ops' button in Following; Search's cast
  fold loses focus at its own tap. Now and the
  Map give focus back after a draw (#66; `scroll.js` `focusIn()`,
  `giveFocusBack()`), and Plans to its own controls that carry an id -
  the picker, the segment, Manage; Search keeps its box and its Filters
  button and loses a day chip's and a row's, and Plans its view toggle's,
  a timeline block's and its action strip's.
  And a tile, a Following chip or a suggestion tapped while the filter
  box has the keyboard opens a page, which takes the focused box away
  with the view before focus goes to the page's heading (#75): what the
  keyboard does then is a phone's to check. A key typed while the filter
  box is off screen brings it into view under the mini-bar and the nav,
  because `main` has no scroll padding for them - in Chromium at 375x667
  the box's top stands at 633 px, the mini-bar's at 549 and the nav's at
  597 - which is older than PR #100, where a key typed in a box scrolled
  away put it in the same place. And the header's simulated-time chip,
  tapped by keyboard, goes with focus on it, and focus falls to the page:
  older than PR #101, which moved the chip and did not fix it (#82). Step
  11's sweep's (contract, sections 4 and 14).
- The follow chips' taps are under #66's 44 px, a chip's name and its x
  both. The muted chips, the same shape, were built at 44 (PR #103, #84).
  Step 11's sweep's.
- ~~A pull that changes the reader's own pick of an open event leaves the
  sheet's star stale until the sheet is reopened - a tap on it meanwhile
  does what the pick as kept calls for, not what the star shows:
  `render()` never drew the event's panel again, and since PR #81 refills
  only its who's-going line. It predates PR #81, and `sheet.js`
  `refreshEventSheet()` is where the fix goes.~~ Closed for an event's
  sheet by PR #93 (#74): `eventsheet.js` `refreshEventSheet()` writes the
  star and the overlap line in place, with Starred by, on a pull as at the
  star's own tap. An open hotel sheet is as it was: a pull that changes
  the reader's own picks leaves its rows, their
  stars and its own count as drawn, since PR #82 refills only what it draws
  of the crew - "yours too" on a crew line follows the picks, the rows above
  it do not. It predates PR #82, and `refreshHotelSheet()` is where
  that fix goes. Since PR #92 the rows' overlap flags are among what stays
  as drawn, until the sheet is drawn again (#73).
- A star in the hotel's sheet draws the whole panel again
  (`dispatch.js` `onHotelPanelClick()`, `sheet.js` `drawHotelSheet()`), so
  its list jumps back to its top under the thumb that tapped. It is older
  than PR #95, which did not fix it: the new body is marked afresh, so the
  fade is right, at the top (#76; contract, sections 8 and 14). Writing
  the star in place, as an event's sheet does since PR #93, is where the
  fix goes.
- ~~Settings is taller than a short screen once Advanced is open: at
  375x667 its top stands 24 px above the screen, 93 with Walk-time
  defaults open and 134 with Larger text too, and the sheet does not
  scroll, so the heading and the crowd factor are out of reach. Found by
  PR #95's browser run, older than it, and the gear's pull request's to
  fix (step 9; contract, section 14).~~ Fixed by PR #110 (#92).
- A swipe down on Settings or on About this app is a real touch's, and the
  browser tests can send one in neither engine: a drag in a body that fits
  moving the sheet, and one in a body that does not scrolling it, are a
  page test's and a phone's to check (#92). WebKit does not focus a tapped
  button, so there Done gives focus back to nothing: step 11's sweep's.
- A focus ring is still cut at the top and the foot of a scrolling area
  of the sheet, where its first or last thing is a control and the area
  is at that end - a hotel's list and a shared day's at both ends, an
  event's body at its foot, the crew panel at both - and at the foot of
  an event's panel on every sheet, where the star, Add this to calendar
  and Done lose the bottom of their ring. PR #97 gave a ring room at the
  sides alone (#78): block padding would change heights. Settings' body
  and About's, new with PR #110, have the room at their top and foot too
  (#92). Older than PR #97, and step 11's sweep's (contract, sections 7
  and 14).
- The filter sheet's Type control shows no focus ring above or below a
  focused button, nor at its two ends: `.seg` clips at its box and has
  no ring drawn inside, as Plans' segment has (`.plans-seg`). Found by
  PR #97's browser run, older than it, and step 11's sweep's (contract,
  section 14).
- The Map tab's height counts the header and the nav and not a notice
  above the views: while one stands - the preview banner before the con,
  "has ended" after it until its OK - the tab is taller than the screen by
  the notice, and the card under the map is cut at the page's top. It
  predates PR #94, which made it show after the con too, where the Map had
  no card and a focused event now has one (contract, sections 6 and 14).
- ~~The star's anchoring has no test that can fail. [53] in
  `tests/page/now.test.js` cannot fail without layout - every rect in
  jsdom is 0 - and [1240] in `tests/rules/source.test.js` pins
  `togglePick()`'s signature in its place. Both stay until a browser test
  of the star's anchoring is written, and retire with it: the harness for
  one exists since PR #101 (#81), and the test is not written.~~
  Closed by PR #104 (#86): `tests/browser/tap-place.spec.js` holds the
  star's row where it stood, in both engines, and [53] and [1240] are
  deleted.
- The zero state's big ones are one track's celebrity events, Main
  Programming's, by a constant in `foryou.js` (#88): whether that is the
  right list is judged on the real 2027 schedule in August. And a held
  zero state waits for the grid to be left: an unmute on the grid, like a
  star that gives For you a row, shows nothing new until then.
- In place of a pick (#90): the 15 minutes an event is still offered
  after its start, and the three rows, are set by hand - for August's
  tuning pass, with For you's weights (#87). Found and left: two shut
  folds side by side share a doubled line, as two folds do anywhere.
- Three places rewrite the address, each its own way: `time.js`
  `setOverride()`, the `?now=`; `crews.js` `readJoinLink()`, the `?join=`;
  and since PR #85 `sheet.js` `takeDayLink()`, the `?day=`. One helper for
  the three is a tidy pull request of its own.

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
- After the `browser` job's first green run on `next`: `browser` required
  on the `next` ruleset (#81).
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
- For Delete my account on dev (#93), after its pull request merges, by
  Claude Code: the seventh migration pushed, a dry run first; then
  "Deploy next".
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
- For you's weights are by hand and untuned; its reason takes the
  ellipsis where line 3 cannot hold a long name; and a list held keeps a
  row whose event has started until the grid is left (#87; contract,
  section 14).
- Before the freeze: `client` and `pipeline` required on the `main`
  ruleset (#48).
- At the freeze: `next` merges to `main`, the default branch flips to
  `main`, and `SCRAPE_TARGET` flips to `main`, by hand (#48; PR 8); and
  `DC_YEAR=2027` on `main`, in the build that publishes it (#49).
- After the con: the `next` ruleset allows merge commits beside squash,
  `main` merges back into `next` as a merge commit, and the default branch
  and `SCRAPE_TARGET` flip back to `next` (#48).
- Every year: a new token (#48).
