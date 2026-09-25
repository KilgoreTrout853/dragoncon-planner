# Identity and sync: the data contract

The design note for Identity and sync: DECISIONS #50-#52, in the detail a
pull request needs. Written 2026-09-25, before any of it is built:
sections 1-4 now, and 5-8 as their design is done. The evidence is
`recon.md`, beside this file, the client as the design found it. Where an
entry has the detail, this note points at it rather than saying it twice.
What the note does not settle is under Open, at the end. A change of
meaning here is a decision: log it in DECISIONS.md and update this file in
the same PR.

## 1. Identity

#51, as #50 narrows #8 and #25.

- **No user until one is needed.** The server holds no user for a reader
  until the first tap that needs one: joining or creating a crew, turning
  on notifications, or entering an email. A star, a follow and every
  screen work with no session, no network and no backend; with the backend
  down, the app is the 2026 app (#9).
- **The anonymous user is the device.** There is no separate device key.
  The first tap that needs a user mints one, by Supabase's anonymous
  sign-in, and that user is this browser's. Whether a bot check - a
  captcha - is required is the Supabase project's setting, and it is off;
  the client wires the widget, and shows it when anonymous sign-in is
  refused.
- **The email step** is one screen, one field and a six-digit code typed
  into the app (#25). It ends one of two ways:
  - *Add.* The email belongs to no one, so the anonymous user gains it in
    place: the same id, keeping its picks, follows, memberships and
    subscription.
  - *Recover.* The email already belongs to a user, so the phone signs in
    as that user. This is how a wiped or replaced phone gets its plan
    back, and it is Keep's whole job. A recovering phone that holds local
    picks and follows pushes them up as adds stamped now: the union of the
    two plans. A recovering phone that was already anonymous and in a crew
    leaves that membership and its subscription behind, with the anonymous
    user; the person rejoins by the link and turns notifications on again.
    Nothing carries them across: this is documented, not built. Turning
    notifications on again, the phone unsubscribes and subscribes afresh,
    which gives it a new endpoint, so no endpoint ever changes hands; the
    old row is pruned when a send to it fails.
- **Two devices.** Nothing keeps two signed-in devices in step beyond
  latest stamp wins (section 2).
- **Stamps** read the real clock, never `now()`, so a simulated clock
  (#12) moves no stamp. The one read lives in `src/time.js`, beside
  `now()`, under the exemption the lint's clock rule already gives that
  file, for sync stamps only (`recon.md`, section 4).
- **The session** is kept under `storageKey("session")` (`src/build.js`),
  so it is per year and per channel like every key the app stores: an
  email user types one code a year, and the next site's session is its
  own.
- **Two rules every later screen inherits:**
  - a star or a follow never waits on the network;
  - a crew or notification action that needs the network fails visibly and
    leaves local state untouched.

## 2. The data model

#52: ten tables.

| table | written by | read by | what it holds |
|---|---|---|---|
| `picks` | the client, as its user | its user; crewmates, by policy | One row per event a user has starred, or unstarred. |
| `follows` | the client, as its user | its user alone | One row per follow, or unfollow. |
| `crews` | `create_crew`, `regenerate_invite`; the creator's plain update of the name, and delete | its members | A crew and its invite token. |
| `crew_members` | `create_crew`, `join_crew`; a plain update of one's own display name; a plain delete to leave or remove | the crew's members | A membership, with its display name. |
| `push_subscriptions` | the client, as its user | its user; the push job | One row per browser endpoint. |
| `schedule_events` | the mirror job | the push job | The year's events, the fields the push job reads. |
| `schedule_changes` | the mirror job | the push job | The change log's lines, with their year and each run's `fetch_code_changed`. |
| `push_sent` | the push job | the push job | What was sent to whom: the idempotence ledger. |
| `mirror_state` | the mirror job | the mirror job | One row per year: how far the mirror has read. |
| `flags` | by hand | the push job; `join_crew` | `push_enabled`, the kill switch, and `crew_size_cap`. |

### Picks and follows

- `picks`: user, year, event id, `picked` (boolean), `changed_at`.
  `follows`: user, year, `kind` - `track`, `work`, `axis` or `person` -
  `key`, `followed` (boolean), `changed_at`. The event id is
  `events.v2.json`'s, and a follow's kind and key are as
  `dc<yy>.follows` stores them (`recon.md`, section 2).
- One row per item. Unstarring and unfollowing write a tombstone, `false`,
  with a newer stamp; nothing is deleted.
- Two tables of one shape, deliberately: crewmates may read picks and
  never follows, and that boundary is structural.
- **Latest stamp wins,** enforced in the database by a trigger, not by a
  clause in the client's write: a write whose `changed_at` is not strictly
  newer than the row's leaves the row as it was - an equal stamp is a
  replayed operation. A stamp is the client's real clock
  (section 1), clamped by a trigger to the server's time plus five
  minutes. This is #9's conflict rule, per row.
- The client's local lists, `dc<yy>.picks` and `dc<yy>.follows`, are never
  synced as they stand: sync moves rows (section 5).

### Crews

- `crews`: id, year, name, invite token, creator, `created_at`. The token
  is the server's - random and URL-safe - made by `create_crew` and
  replaced by `regenerate_invite`.
- `crew_members`: crew, user, display name (1 to 24 characters),
  `joined_at`; its primary key is crew and user. The name lives on the
  membership, not on the user, whose row holds nothing personal (#8). A
  membership's year is its crew's.
- A star means going; there is no maybe.

### Push subscriptions

`push_subscriptions`: user, endpoint - one row per browser - the two keys,
`created_at`, `last_seen_at`. No year: a browser's endpoint outlives a
year, and a dead one is pruned when a send to it fails.

### The schedule mirror

- `schedule_events`: year, id, title, start, end, hotel, room, removed,
  cancelled. `start` and `end` are `timestamptz`, converted at mirror time
  from the file's local times in the con's zone, `season.json`'s `tz`,
  America/New_York.
- `schedule_changes`: `year`, and the `changes.jsonl` line as it is -
  `run`, `sha`, `id`, `kind`, `from`, `to`, `cause`
  (`docs/pipeline/contract.md`, The change log) - plus the run's
  `fetch_code_changed`, from `last-run.json`.
- Both are written by the mirror job after a scrape's pull request merges
  (section 6; #50). The pipeline never learns Supabase exists.
- The mirror always mirrors. Suppression is the push job's, by the flag:
  that run's lines still read as the diff finds them, and the push job
  reads `fetch_code_changed` and suppresses that run
  (`docs/pipeline/contract.md`, `last-run.json`).

### The jobs' tables

- `push_sent`: user, year, kind - `starts-soon` or `pick-changed` - key,
  `sent_at`: the push job's idempotence ledger. It carries `year` because
  retention deletes by year.
- `mirror_state`: one row per year - `last_run`, `last_sha` and
  `updated_at`, how far the mirror has read; section 6 may add columns.
- `flags`: name and value; two, `push_enabled`, the kill switch, and
  `crew_size_cap`. Whether a captcha is required is not a flag but the
  Supabase project's setting (section 1).

### Every table

- Every table that holds a year's plan carries `year`: `picks`,
  `follows`, `crews` and `push_sent`; `crew_members` takes its year
  through `crews`.
- Every foreign key to a user cascades on delete, but `crews.creator`,
  which is `on delete set null`: a crew outlives its creator. If the
  creator is ever gone, the creator-only actions - regenerating the
  invite, removing a member - lapse; members can still leave.
- **The cleanup.** A scheduled job deletes stale anonymous users (#25,
  #50), and only those in no crew and holding no subscription. How stale
  is Open.
- **No client access.** The five job tables - `schedule_events`,
  `schedule_changes`, `push_sent`, `mirror_state` and `flags` - have no
  client access at all: no policy for any app role. The jobs reach them,
  and `join_crew` reads `flags` as a security definer.

### The data model, as built

`supabase/migrations/20260925154849_sync_schema.sql` (PR #54), the first
migration.

- **The keys.** `picks`: user, year and event id. `follows`: user, year,
  kind and key. `crews`: a uuid. `crew_members`: crew and user.
  `push_subscriptions`: the endpoint. `schedule_events`: year and id.
  `schedule_changes`: year, run, id and kind. `push_sent`: user, kind and
  key. `mirror_state`: the year. `flags`: the name. The columns are
  `user_id`, `event_id` and `crew_id` where a user, an event or a crew is
  meant.
- **The checks.** Every `year` is an integer from 2026 to 2099. A crew's
  name is 1 to 40 characters and a display name 1 to 24, each already
  trimmed: the RPCs trim what they are given, and a plain update must send
  it trimmed. `follows.kind` is one of its four, `push_sent.kind` one of
  its two, `schedule_changes.kind` one of the change log's twelve and its
  `cause` `source` or `code`. An event id, a follow's key and an endpoint
  are never empty.
- **The types.** Every stamp is `timestamptz`: `changed_at`, and
  `schedule_changes.run`, the line's value in the database's type; `start`
  and `end` too. `from` and `to` are `jsonb`, and the subscription's two
  keys are `p256dh` and `auth`. `end`, `from` and `to` are reserved words,
  quoted in SQL.
- **The invite token** defaults to `new_invite_token()`: 16 random bytes
  from pgcrypto's `gen_random_bytes`, base64url with no padding, 22
  characters.
- **`flags`** is seeded by the migration, not by `seed.sql`, so a hosted
  project has it: `push_enabled` false and `crew_size_cap` 25, each a
  one-row update to change.
- **The indexes:** `picks` and `follows` by user and `changed_at`,
  `crew_members` by user, `schedule_events` by year and start.
  `schedule_changes` by year and run is its primary key's leading
  columns, and has no index of its own.
- **The triggers** on `picks` and `follows`: `*_1_clamp`, before insert
  or update, and `*_2_latest_wins`, before update, which returns no row
  unless the stamp is strictly newer, so the client's upsert updates
  nothing. A table's before triggers fire in name order, so the clamp runs
  first and latest-wins compares clamped stamps.

## 3. Security

#52. Row-level security is the whole defence, and its mistakes are silent:
wrong rows come back, and nothing errors (#25).

- **Row-level security on every table.** Policies are for the signed-in
  role alone, `authenticated`, which an anonymous user's session holds
  too. The anon role - a request with the public key and no session - has
  no policy anywhere, and its default grants are revoked.
- **The helper.** `is_crew_member(crew_id)`, a security-definer function
  with a pinned search path, used by the policies on `crews`,
  `crew_members` and `picks`. It exists because a policy on
  `crew_members` that reads `crew_members` recurses.
- **Reads by policy, not by function.** The client's overlay is one query,
  the picks it may see that changed since its watermark, and row-level
  security narrows it to its own and its crewmates'.
- **Three RPCs,** because a plain write cannot do what they do:
  - `create_crew(year, name, display_name)`: the crew and its creator's
    membership, in one transaction.
  - `join_crew(token, display_name)`: the caller holds a token, not an id;
    the cap is read from `flags`.
  - `regenerate_invite(crew_id)`: the creator alone; the server picks the
    new secret.

  Everything else is a plain write the policies judge: a star, a follow,
  leaving, removing - the creator, any member of the crew - renaming or
  deleting a crew, the creator's too, editing one's own display name, and
  subscribing.
- **The tests,** named here because the mistakes are silent: as the anon
  role, as a signed-in stranger and as a member, on every client table and
  every RPC; the recursion case; an older stamp losing; the job tables
  refused to every app role. Each case is refused or empty, and says
  which: refused where no grant reaches the role, empty where a grant
  exists and row-level security filters. pgTAP, under `supabase/tests/`,
  run by the Supabase CLI against a local database in a `database` CI job
  (#24, #26), which becomes a required check on `next` after its first
  green run (ROADMAP, Checklist). They exist before any crew screen.

### Security, as built

The same migration (PR #54).

- **Privileges.** Before creating anything, the migration alters the
  default privileges of what `postgres` creates in `public`, so that no
  table, sequence or function reaches `anon` or `authenticated` until a
  migration grants it by name. PUBLIC's right to execute a function is
  Postgres's own default and cannot be revoked for one schema, so each
  function revokes it by name. `00_structure.test.sql` holds the list of
  what each role reaches, and a later migration that adds to it changes
  that test. `service_role` keeps Supabase's grants, for the jobs.
- **Grants to `authenticated`.** On `picks` and `follows`: select, insert,
  and an update of `picked` or `followed` and `changed_at` alone; no
  delete. On `crews` and `crew_members`: select, delete, and an update of
  `name` or `display_name` alone. On `push_subscriptions`: select, insert,
  delete, and an update of its keys and `last_seen_at`. On the five job
  tables: nothing.
- **Two helpers,** security definer, stable, `search_path` pinned to
  `public`, executable by `authenticated` alone: `is_crew_member(crew_id)`,
  which the policies on `crews` and `crew_members` use; and
  `shares_crew_with(other_user, year)`, whether the caller shares a crew
  of that year with another user, which the `picks` policy uses, so a
  crewmate reads the picks of the crew's year only.
- **The policies,** every one `to authenticated`: `picks` - read one's
  own or a crewmate's, add and change one's own; `follows` - read, add and
  change one's own; `crews` - members read, the creator renames and
  deletes; `crew_members` - members read, a member changes their own
  display name, deletes their own row, and the creator deletes any;
  `push_subscriptions` - one's own, for everything. Nothing for anon, and
  nothing on the job tables. The creator's rename, delete and removal
  read the crew as a member, so they hold while the creator is one.
- **The RPCs,** security definer, `search_path` pinned, executable by
  `authenticated` alone. `create_crew(year, name, display_name)` returns
  the crew, its token with it. `join_crew(token, display_name)` locks the
  crew's row, so two joins at the cap cannot both pass, returns the crew
  unchanged to a member, and refuses at `crew_size_cap`, or at any size if
  the flag is missing. `regenerate_invite(crew_id)` returns the new token.
  Their errors: 42501, not signed in or not the creator; P0002, no crew
  has that invite; 53400, the crew is full; 22023, no such year; 23514, a
  name out of bounds, from the table's check.
- **The tests,** nine files under `supabase/tests/`, each one transaction
  rolled back: `00_structure`, `01_anon`, `02_stranger`, `03_member`,
  `04_stamps`, `05_rpcs`, `06_job_tables`, `07_cascades` and
  `08_push_subscriptions`. A test user is a row inserted into
  `auth.users`. The test acts as that user through the `authenticated`
  role and a `request.jwt.claims` naming them, which `auth.uid()` reads,
  and as anon through `set local role anon`. A mutation pass - every
  policy dropped, each helper dropped and made to answer yes, each stamp
  trigger dropped, a grant to anon and one to `authenticated` on a job
  table - failed at least one test each; it is not committed.

## 4. Migrations

- `supabase/migrations/`: numbered SQL, applied by the Supabase CLI, one
  migration a pull request. A merged migration is never edited; a change
  is a new file. `supabase/seed.sql` holds a local dataset.
- Two hosted projects (#25). Dev takes migrations by hand, pushed from the
  author's machine after each merge; production by a workflow, in the
  operations track (#50).
- **No TypeScript.** #23 left it to this step, where generated database
  types were to be the payoff; ten small tables whose shapes live here do
  not earn it.

### Migrations, as built

PR #54.

- **The CLI** is `supabase/package.json`'s dev dependency, pinned at
  2.118.0 with its own lockfile. `npm ci --prefix supabase` installs it;
  the root `npm ci` - CI's `client` job, the next site's build - never
  does, since its binary is about 150 MB.
- **`supabase/config.toml`** is `supabase init`'s: the project
  `dragoncon-planner`, Postgres 17, and storage and realtime turned off,
  since nothing uses them and `db start` then pulls neither image. The
  hosted projects are to match it (#50, operations). `supabase/.gitignore`
  is the CLI's own.
- **The commands,** from the repo root with Docker running:
  `npm --prefix supabase run start` starts the database alone and applies
  the migrations and `seed.sql`; `npm --prefix supabase test` runs pgTAP
  against it; `run reset` builds it afresh, and `run stop` stops it.
- **CI's `database` job** runs the install, the start and the tests on
  Ubuntu, where Docker is running.

## 5. Sync rules — to follow

How the client moves rows: the writes it queues and when they go, the pull
since its watermark on the hooks it has (`recon.md`, section 5), a
recovering phone's union, and a pick on a merged event (#43).

## 6. The mirror job — to follow

The Actions job that writes `schedule_events` and `schedule_changes` after
a scrape merges: its trigger, what it reads, `mirror_state`, and how it
fails.

## 7. The push job — to follow

The queue-shaped sender: pick-changed from `schedule_changes`, suppressed
by `fetch_code_changed`; starts-soon by one lead time set in its call
(#40, #50); `push_sent`, the kill switch, and a dead endpoint pruned.

## 8. Crews — to follow

The crew screens: create, join by the link, leave, remove, regenerate the
invite, the overlay on the timeline, and who's going (#10, as #50 narrows
it).

## Open

- How stale an anonymous user must be before the cleanup deletes it
  (section 2).
- Starts-soon's lead time: one value, set in the push job's call (#40,
  #50); how many minutes is unset.
- Recording searches that return nothing, anonymously, in 2027: #36's
  privacy question for this tentpole.
