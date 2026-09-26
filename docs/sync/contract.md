# Identity and sync: the data contract

The design note for Identity and sync: DECISIONS #50-#54, in the detail a
pull request needs. Written 2026-09-25, before any of it was built:
sections 1-4 first, section 5 with the client's identity (PR #55), section
6 with the mirror job (PR #57), and 7-8 as their design is done. The
evidence is
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
  the client shows no widget until the project turns it on, and a refusal
  for want of one is a plain message (#53).
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
- **Confirm email stays on,** on every project: an invariant (ROADMAP,
  Checklist). With it off, the server sets an anonymous user's email with
  no code at all, so anyone could claim an address they do not own, and
  its owner's later recover would sign into the claimant's plan.
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

### Identity, as built

PR #55, with #53.

- **Two modules,** after `build` in #29's order - `build`, `backend`,
  `identity`, `state`, `time`. `src/backend.js` holds the backend's
  address and public key, every request, and the session.
  `src/identity.js` holds `ensureUser()`, the email step and sign out.
- **The constants.** `DC_SUPABASE_URL` and `DC_SUPABASE_KEY` reach the
  client through `dcBackend()` in `build/vite-dc.js`, as
  `__DC_SUPABASE_URL__` and `__DC_SUPABASE_KEY__`, in the dev server, the
  build and Vitest alike. A build given neither has no backend:
  `hasBackend` is false, no request is made, `ensureUser()` is refused
  without one, and Settings shows nothing of this - the app is the 2026
  app. The key is inlined in a public page, so the build refuses a secret
  key - an `sb_secret_` key, or a JWT whose role is `service_role` - and
  refuses an address that is more than an origin, one that is not https
  but for http on this machine, and either constant without the other.
- **The session** is kept under `storageKey("session")` -
  `dc<yy>.session`, or `dc<yy>.session.<channel>` on a stamped build - as
  the two tokens and the user's id, email and `is_anonymous`, and read
  afresh at every use, so a tab never holds a token another has rotated
  away.
- **Every request** carries `apikey`, the public key; one with a body,
  `Content-Type: application/json`; one made as the user, `Authorization:
  Bearer` and the session's access token; and sync's two upserts,
  PostgREST's `Prefer`. Nothing else: the page asks for no API version,
  and reads an error's code from `code` where that is a string - the Auth
  server's newer shape, and PostgREST's - and from `error_code` otherwise.
  There are eleven, the email step's six and sync's five (section 5, as
  built):

| Request | Method and path | As the user | Body | Expects |
|---|---|---|---|---|
| Anonymous sign-in | `POST /auth/v1/signup` | no | `{}` | 200 and a session; or 422 `anonymous_provider_disabled`, 400 `captcha_failed` |
| Add | `PUT /auth/v1/user` | yes | `{"email"}` | 200, and a code sent; or 422 `email_exists`, and then recover |
| Recover | `POST /auth/v1/otp` | no | `{"email", "create_user": false}` | 200, and a code sent; or 422 `otp_disabled`, and then mint and add |
| Verify | `POST /auth/v1/verify` | no | `{"type", "email", "token"}`, the type `email_change` after add and `email` after recover | 200 and a session; or 403 `otp_expired` |
| Refresh | `POST /auth/v1/token?grant_type=refresh_token` | no | `{"refresh_token"}` | 200 and a session; or 400, 401, 403 or 404, and the session is lost |
| Sign out | `POST /auth/v1/logout?scope=local` | yes | none | 204, not waited on |
| Upsert picks | `POST /rest/v1/picks?on_conflict=user_id,year,event_id`, with `Prefer: resolution=merge-duplicates,return=minimal` | yes | `[{"year", "event_id", "picked", "changed_at"}]`, a row per op, by key; no `user_id`, which is the caller's | 201 where a row was inserted, else 200, and no body; a failure keeps the ops |
| Upsert follows | `POST /rest/v1/follows?on_conflict=user_id,year,kind,key`, with the same `Prefer` | yes | `[{"year", "kind", "key", "followed", "changed_at"}]` | as the picks' |
| Crews | `GET /rest/v1/crews?select=id,name,creator,crew_members(user_id,display_name)&year=eq.<year>` | yes | none | 200: the caller's crews of the year, their members embedded |
| Pull picks | `GET /rest/v1/picks?select=user_id,event_id,picked,changed_at,synced_at&year=eq.<year>&synced_at=gt.<since>&order=synced_at.asc,user_id.asc,event_id.asc&limit=1000&offset=<n>` | yes | none | 200: one's own rows and crewmates' of the year, 1,000 at most |
| Pull follows | `GET /rest/v1/follows?select=kind,key,followed,changed_at,synced_at&year=eq.<year>&synced_at=gt.<since>&order=synced_at.asc,kind.asc,key.asc&limit=1000&offset=<n>` | yes | none | 200: one's own rows, 1,000 at most |

`<since>` is the watermark less a minute, URL-encoded; a first pull has
none, and neither has the picks' when a crew has gained anyone.

- **A refused token.** A request made as the user and refused for its
  token - a 401, or a 403 with `bad_jwt` or `session_not_found` - takes
  the session another tab has refreshed, if there is one, or refreshes
  it once, and is made once more. A refresh refused drops the session;
  offline, rate-limited or a server's error, the session is kept for the
  next try. No clock is read for any of it.
- **`ensureUser()`** returns the session, or signs in anonymously, with
  one request however many callers ask while it is out. Nothing calls it
  on load; its one caller is the email step.
- **The email step** is Settings' "Keep your plan", between Advanced and
  Done, and only on a build with a backend. Send code: with no session,
  recover, and an address no one holds mints the anonymous user and adds
  it; with an anonymous session, add, and an address someone holds falls
  through to recover. A session lost on the way - an anonymous user the
  cleanup took - is dropped, and the step starts again with none. One
  code either way, typed in and confirmed; then "Signed in as" the
  address, and Sign out, offered only to a user with an email. Since sync
  (PR #56), Sign out first sends every change still waiting: it lets any
  run or send under way finish - a run a trigger starts meanwhile too -
  then makes a try of its own. If any change still waits after that try,
  it refuses, and removes neither the session nor sync's four keys; a line
  in the Keep section, under sync's status, says "N changes are waiting to
  send; connect and try again" - "1 change is" for one - counting afresh
  each time it is drawn, and gone once a drain has left nothing waiting,
  whether or not the line was drawn then. Only with the outbox empty does
  Sign out remove the session key and sync's four, and nothing of the plan
  (section 5, as built). A session lost on the way - its refresh refused -
  leaves nothing to sign out of: sync's keys are forgotten, as with no
  session, and the note says the phone was signed out. Recover signs in,
  and sync then carries the phone's plan up (section 5, as built).
- **Failures in plain words,** and local state untouched: offline; the
  captcha - "Signing in needs a check this app can't show yet. Please try
  again later.", with no widget (#53); anonymous sign-ins switched off;
  too many tries; a code asked for again too soon; a wrong or expired
  code; a code or an address that does not look like one, refused before
  a request; an address the server cannot mail; and a session lost.
- **`wallClock()`,** in `src/time.js`: the real clock whatever `?now=`
  says, for sync stamps; `src/outbox.js` is its one caller.
- **The tests.** `tests/page/keep.test.js` pins each request above as it
  is sent, against a fake of the Auth server (`tests/helpers/backend.js`),
  and drives every door and failure; `tests/page/settings.test.js` pins
  both layouts of Settings, `year.test.js` the session among the keys and
  `time.test.js` `wallClock()`; `tests/unit/backend-env.test.js` the
  build's guard; `tests/build.test.js` the built page with no backend
  asking for nothing but the schedule, and the next site's build, given a
  backend, signing in and keeping `dc26.session.next`; and
  `tests/worker.test.js` the worker passing the backend's requests
  untouched. Since sync, a step that succeeds starts a sync run too, and
  `keep.test.js` reads the email step's conversation from the Auth
  requests; sync's own are pinned by its tests (section 5, as built).

## 2. The data model

#52: ten tables.

| table | written by | read by | what it holds |
|---|---|---|---|
| `picks` | the client, as its user | its user; crewmates, by policy | One row per event a user has starred, or unstarred. |
| `follows` | the client, as its user | its user alone | One row per follow, or unfollow. |
| `crews` | `create_crew`, `regenerate_invite`; the creator's plain update of the name, and delete | its members | A crew and its invite token. |
| `crew_members` | `create_crew`, `join_crew`; a plain update of one's own display name; a plain delete to leave or remove | the crew's members | A membership, with its display name. |
| `push_subscriptions` | the client, as its user | its user; the push job | One row per browser endpoint. |
| `schedule_events` | the mirror job | the push job; the mirror job, its ids | The year's events, the fields the push job reads. |
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
  America/New_York, and null where the file's are (section 6).
- `schedule_changes`: `year`, and the `changes.jsonl` line as it is -
  `run`, `sha`, `id`, `kind`, `from`, `to`, `cause`
  (`docs/pipeline/contract.md`, The change log) - plus the run's
  `fetch_code_changed`: `last-run.json`'s, for the lines of the run it
  describes, and `true` for an earlier run's the mirror had not yet
  written (section 6).
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
  `updated_at`, how far the mirror has read; section 6 adds none.
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
  and `end` too, nullable since the mirror's migration, below. `from` and
  `to` are `jsonb`, and the subscription's two
  keys are `p256dh` and `auth`. `end`, `from` and `to` are reserved words,
  quoted in SQL.
- **The invite token** defaults to `new_invite_token()`: 16 random bytes
  from pgcrypto's `gen_random_bytes`, base64url with no padding, 22
  characters.
- **`flags`** is seeded by the migration, not by `seed.sql`, so a hosted
  project has it: `push_enabled` false and `crew_size_cap` 25, each a
  one-row update to change.
- **The indexes:** `picks` and `follows` by user and `changed_at` - by
  user and `synced_at` since sync's migration, below - `crew_members` by
  user, `schedule_events` by year and start.
  `schedule_changes` by year and run is its primary key's leading
  columns, and has no index of its own.
- **The triggers** on `picks` and `follows`: `*_1_clamp`, before insert
  or update, and `*_2_latest_wins`, before update, which returns no row
  unless the stamp is strictly newer, so the client's upsert updates
  nothing. A table's before triggers fire in name order, so the clamp runs
  first and latest-wins compares clamped stamps.
- **Sync's migration,** the second,
  `20260925204917_picks_follows_sync.sql` (section 5, as built):
  - `synced_at` on `picks` and `follows`, the row's `clock_timestamp()`,
    set by a third trigger, `*_3_synced`, on every insert and on every
    update latest-wins accepts; after it by name, so a write latest-wins
    turns away - it returns no row, and no later trigger fires - keeps the
    stamp it had;
  - `user_id` the caller's by default, `auth.uid()`: the client never
    sends it;
  - `*_0_keys`, before update and first by name, which refuses a change of
    any key column, 42501, whatever the stamp (section 3, as built);
  - the indexes by user and `synced_at` in place of those by user and
    `changed_at`, which nothing reads any more.
- **The mirror's migration,** the third,
  `20260926005152_mirror_times.sql` (section 6, as built):
  `schedule_events.start` and `end` nullable, as the file's may be; and
  `service_role` granted select, insert, update and delete on
  `schedule_events`, `schedule_changes` and `mirror_state`, by name
  (section 3, as built).

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
  that test. A project made since 2026-05-30 grants a new table to no
  Data API role by default, `service_role` included, so a job's grants are
  made by migration, by name, like every other: the mirror's migration
  grants `service_role` select, insert, update and delete on
  `schedule_events`, `schedule_changes` and `mirror_state`, and a
  production project gets them by migration, whatever its defaults (#54;
  section 6). `push_sent` and `flags`, the push job's, have no such grant
  yet. `supabase/config.toml` turns the local database's defaults off to
  match (section 4, as built), so `00_structure` holds the migration's
  grants, not the defaults.
- **Grants to `authenticated`.** On `picks` and `follows`: select, insert,
  and an update of `picked` or `followed` and `changed_at` alone; no
  delete. Sync's migration adds an update of the key columns - `year` and
  `event_id`, and `year`, `kind` and `key` - because PostgREST's upsert
  names every column of its payload in its `SET`, and Postgres checks the
  grant on each before it knows whether a row conflicts: without it the
  upsert is refused, a new key's too (checked against PostgREST 14.5 on
  the CLI's local stack). The key trigger keeps them as they are, so a
  pick still never moves to another event. `user_id` and `synced_at` stay
  ungranted, so a payload that names either is refused. On `crews` and `crew_members`: select, delete, and an update of
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
- **The tests,** ten files under `supabase/tests/`, each one transaction
  rolled back: `00_structure`, `01_anon`, `02_stranger`, `03_member`,
  `04_stamps`, `05_rpcs`, `06_job_tables`, `07_cascades`,
  `08_push_subscriptions` and, with sync's migration, `09_sync`. A test user is a row inserted into
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
  since nothing uses them and `db start` then pulls neither image. Since
  the mirror job (#54), `auto_expose_new_tables` is off too: like a hosted
  project made since 2026-05-30, the local database - and CI's - grants a
  new table to no Data API role, so the migrations' grants are the only
  ones, and pgTAP pins them rather than the defaults. The hosted projects
  are to match it (#50, operations). `supabase/.gitignore` is the CLI's
  own.
- **The commands,** from the repo root with Docker running:
  `npm --prefix supabase run start` starts the database alone and applies
  the migrations and `seed.sql`; `npm --prefix supabase test` runs pgTAP
  against it; `run reset` builds it afresh, and `run stop` stops it.
- **CI's `database` job** runs the install, the start and the tests on
  Ubuntu, where Docker is running.

## 5. Sync rules

#53, built by the sync PR, PR #56 (ROADMAP, tentpole 4); as built, below.

- **What syncs.** Picks and follows, one's own rows, both ways, and
  nothing else: no settings (#50), and neither the pick news nor the
  snapshot it is judged against.
- **The doors.** `savePicks()` and `saveFollows()` are the only writers of
  picks and follows, and each writes the whole state (`recon.md`,
  section 3), so the diff happens there: against a copy retained at the
  last save, every key that changed becomes an op. A pick re-pointed by
  `reconcilePicks()` - gone, or merged into another event (#43) - goes
  through `savePicks()` as well: a tombstone for the old id, and for a
  merge an add for the survivor.
- **The outbox** is a map keyed by table and key: one op per changed key,
  with `picked` or `followed` and a stamp from `wallClock()`, a later
  change to a key replacing the op before it - coalescing to the latest.
  No session means no outbox.
- **Mint and recover.** At mint the whole local state goes up as adds,
  stamped as it goes; recover's union (section 1) is the same act, for a
  phone that signs in as a user who already has rows.
- **The drain** is one upsert per table of every pending op. The trigger
  judges each row by `changed_at` (section 2), so a replay or an older
  stamp changes nothing. A failure is kept and retried with backoff up to
  five minutes; nothing is dropped.
- **The pull** is one query per table for the rows newer than the
  watermark, `storageKey("syncStamp")`. The watermark is on a
  server-written stamp, `synced_at`, set by a trigger on insert and on
  update: never on `changed_at`, which a change drained late carries from
  hours before, so a watermark on it would miss the change for good. The
  query overlaps the watermark by a small margin, since a write can
  commit after a later stamp was read, and a row applied twice changes
  nothing. Latest stamp wins still judges by `changed_at`. One's own rows
  are applied unless an op is pending for the key; crewmates' picks go to
  `storageKey("crewPicks")`; the new watermark is the newest `synced_at`
  seen. The pull also refreshes the member list, and drops a departed
  member's picks.
- **When.** On open; on `visibilitychange` and `pageshow`, ungated -
  unlike the schedule's recheck, which waits fifteen minutes (`recon.md`,
  section 5); on `online` and the worker's `schedule-online`; and after a
  drain. There is no timer.
- **Pick news and a push** agree by sharing no state: the phone's news
  comes from the schedule it loads, the push job's from
  `schedule_changes` (section 7).
- **Failure modes.** The backend down: stars and follows work as ever, the
  outbox holds and the drain retries. The session lost: no session, so no
  outbox, until the email step signs in again and the whole local state
  goes up as adds. Two tabs of one phone: each saves whole state, so the
  last save wins, accepted for 2027.
- **The migration** is the sync PR's: `synced_at` on `picks` and
  `follows`, an index by user and `synced_at`, the trigger, and the
  behavioural test that clamps a follow's stamp, which PR #54 left to the
  structure test.

### Sync rules, as built

PR #56, with #53.

- **Two modules,** in #29's order: `src/outbox.js`, an eighteenth leaf
  after `time`, and `src/sync.js`, after the bus. The doors hand the
  outbox their changes, and a module imports only the modules before it,
  so the outbox sits below `picks` and `follows`; the pull applies rows to
  both and asks for a redraw, so `sync` sits above the bus. Nothing but
  `render()` calls upward, so a drain the outbox starts after a tap is
  followed by no pull: the pull follows the drains `sync` runs, and after
  a tap it comes at the next trigger.
- **The doors.** `savePicks()` and `saveFollows()` each keep a copy of
  what they last saved - read with the module, and for follows after the
  shape filter, so a follow it drops, never synced, is no change - and
  hand the outbox every key gained or lost since: a star or a follow an
  add, an unstar or an unfollow a tombstone. A save that changed nothing
  records nothing; no call site changed. `reconcilePicks()`'s changes are
  a save like any other: a gone pick a tombstone, a merged one a tombstone
  and an add for its survivor. A pull goes through neither door:
  `applyPulledPicks()` and `applyPulledFollows()` change the state and
  move the saved copy with it, so nothing pulled is sent back.
- **A pick this schedule never showed.** A pick whose id no event has or
  names in its `was`, and that has no snapshot, stays in the plan, unseen,
  until the schedule knows it. In a live year an event leaves the file
  only by a merge (#47), so such a pick was made on another device
  against a newer schedule; dropped as gone, its tombstone would unpick it
  on every device. A pick with a snapshot whose event has gone leaves as
  before. Mine's badge counts `picks.size`, so it counts such a pick
  meanwhile.
- **The outbox,** `storageKey("outbox")`: `{user, ops}`, `ops` by table
  and key - a pick by event id, a follow by `kind:key` - each `{on, at}`,
  `at` from `wallClock()` and never the same moment twice from one page,
  so two changes to a key in a millisecond cannot tie. A later change to a
  key replaces its op. No session, no outbox, and ops kept for one user
  are never sent as another's.
- **The drain** is one upsert per table, its rows by key and no `user_id`
  among them (section 1, as built). Success clears each key it sent unless
  a newer op took its place meanwhile. A failure keeps them all, and the
  drain tries again after 5 seconds, doubling to 5 minutes and staying
  there; a success starts the wait at 5 again. One drain at a time. A tap
  starts one, but not inside a failure's wait; a trigger does, at once. A
  refusal is kept, retried and shown like any failure, never dropped.
- **A run,** `runSync()`: the drain, then the pull. After the load; on
  `visibilitychange` and `pageshow`, ungated; on `online` and the worker's
  `schedule-online`; and after the email step sends a code, which may have
  minted the phone's user, and after it confirms one. No timer. One run at
  a time: a trigger during one asks for one more after it, however many
  there are.
- **The pull** holds the drains while it reads and applies - the one out
  finishes first - so no pulled row lands on a change drained in between,
  and a tap meanwhile waits as an op. It reads the crews, with their
  members, then the picks and the follows newer than the watermark less a
  minute, 1,000 rows a request - Supabase's most, hosted and in
  `supabase/config.toml` - until a request comes back short. When a crew
  has gained anyone since the last run, the picks are read whole, since a
  newcomer's are older than the watermark. Then, with no wait between: the
  reader's own rows are applied unless a pending op holds the key;
  crewmates' picks go to `storageKey("crewPicks")`, `{user: {event:
  true}}`, a crewmate's unstar taking the entry out and a departed member
  taking all of theirs; the crews to `storageKey("crew")`, `[{id, name,
  creator, members: [{user_id, display_name}]}]`, data alone for the crew
  screens; and the watermark to `storageKey("syncStamp")`, `{user, picks,
  follows}`, each the newest `synced_at` its table's read returned, as the
  server wrote it.
- **The watermark stops at a held row.** A row of the reader's own that a
  pending op holds is passed over, and the watermark goes no later than
  it, so the next pull reads it again, and applies the server's value if
  the op, drained, lost to a newer stamp. A watermark past it would leave
  the phone holding a change the server turned away. The rule above, "the
  newest `synced_at` seen", did not say so; this is the rule as built.
  **Its cost when a refusal lasts.** The client builds no row the
  database's checks refuse, so a lasting refusal is a whole request's: a
  grant or a schema out of step with the client. It is retried and shown,
  never dropped (the drain, above). The drain sends a table in one
  request, all or none, the picks before the follows, and stops at the
  first refused. So while the refusal lasts every waiting change of the
  refused table waits with it, and every later one joins them; when the
  picks are refused the follows wait too, and crewmates see none of the
  reader's later picks, while a refusal of the follows alone lets the
  picks through. Each waiting key keeps the phone's value, never the
  server's. Where the reads still work - a missing update grant, say -
  the watermark of each table with waiting keys stops at the earliest row
  a pull reads for any of them, so every pull then reads again everything
  written since, page after page, a read that only grows while the
  refusal lasts. Where they do not - a project this PR's migration has
  not reached, whose tables have no `synced_at` to read by - no pull
  succeeds at all, so no watermark moves and nothing from the server
  reaches the phone, crewmates' picks included. Sign out is refused
  meanwhile (section 1, as built), and the status line names the refusal.
- **The owner.** A run whose session's user is not the watermark's - a
  mint, a recover, a sign-in in another tab - starts the outbox afresh for
  them, with the whole local plan as adds stamped at once, which is
  recover's union (section 1), and starts the watermark and the crew's
  two keys again. With no session a run forgets all four keys, and so does
  Sign out, once nothing waits to be sent (section 1, as built), so the
  next sign-in, even as the same user, sends the whole plan again.
- **The status line,** under Keep your plan's heading, with a session
  alone: "Synced just now"; "N changes waiting"; "Offline, N changes
  waiting", or "Offline, nothing waiting"; or the last failure in plain
  words - a server's error, "The server had a problem. Your changes are
  safe on this phone, and will be sent again.", and a refusal, "The server
  turned your changes away. They're kept on this phone, and will be sent
  again." Under it, after a refused Sign out and while changes still
  wait, the refusal's line (section 1, as built). A run redraws both; a
  drain the outbox starts on its own does not, until the next run or the
  next time Settings opens.
- **What never syncs:** settings, the views, `pickInfo` and the pick news.
- **The tests.** `tests/page/sync.test.js`: the doors and the upsert
  pinned as sent, coalescing, the stamps and `?now=`, one drain at a time,
  the backoff and its cap, the status line, mint, recover and sign out.
  `tests/page/sync-pull.test.js`: the pull's requests pinned, own rows and
  crewmates', the watermark and its overlap, a held row and the watermark
  stopping at it, a departed member and a newcomer, each trigger, the
  drains held during a pull, paging and reconcile. Both run against
  `tests/helpers/backend.js`, whose PostgREST half was checked against the
  real one; pgTAP's `09_sync.test.sql` holds the migration. A mutation
  pass over the doors, the outbox and the pull is not committed.

## 6. The mirror job

#54, as #50 has it: the schedule's two tables, written after a scrape's
pull request lands, from three committed files - `events.v2.json`,
`changes.jsonl` and `last-run.json` (`docs/pipeline/contract.md`). The
pipeline never learns Supabase exists, and the mirror is off its path and
off the site's: if it fails, nothing else waits.

- **The trigger.** `.github/workflows/mirror.yml`, `Mirror`, three ways:
  - a push to `next` or `main` that changes a year's `events.v2.json`,
    `changes.jsonl` or `last-run.json`: a scrape's pull request landing,
    by a squash merge on `next` or a merge commit on `main` (#48). Not
    `workflow_run`: Scrape ends when it opens its pull request, and
    auto-merge lands it later;
  - hourly at `47 * * * *`, thirty minutes off Scrape's, inside the
    season's window alone - `python pipeline.py window`, as `scrape.yml`
    asks it - so it costs nothing off-season and heals a failed mirror
    within the hour during the con;
  - by hand, `workflow_dispatch`, with `season`, by default
    `data/2027/season.json`.

  A push and the hourly run mirror the default season, and a dispatch the
  one it names; a season's first mirror, and 2026's, is a dispatch. Only
  `next` and `main` run it: another branch's runs never landed. One run at
  a time for a project and a season, none cancelled once running. It reads
  the repository alone. The branch is checked out as it stands, not the
  commit that started the run, and `MIRROR_SHA` is the checkout's commit:
  a re-run mirrors the head, whose log holds every earlier commit's lines,
  and never takes the tables back. The job runs under a GitHub Environment
  by branch - `production` on `main`, `dev` otherwise - recording no
  deployment, and reads its variable `SUPABASE_URL` and its secret
  `SUPABASE_SERVICE_KEY`. Python 3.13 from `requirements.txt`, as the scrape
  runs; the job summary: the events upserted, the rows deleted, the change
  lines written, and any run flagged.
- **The transport.** `mirror.py`, over PostgREST as the service role,
  which bypasses row-level security - the job tables have no policies, by
  design - but not its table grants, which the mirror's migration gives
  it by name. `requests`, already pinned: no new
  dependency. The key is the project's secret key, `sb_secret_`, sent as
  `apikey` alone, as Supabase's API keys guide directs, or a legacy
  `service_role` JWT, sent as `apikey` and as the bearer. It is checked
  before any request - stripped, and refused unless it is one of the two,
  a publishable or anon key among the refused, the message naming the
  variable alone - and never printed: every message is redacted of it.
  `SUPABASE_URL` is the project's https origin, or http on this machine,
  for the CLI's local stack.
- **What it writes, in this order.** The invariant: `schedule_events` for
  the year equals the file, a null time included.
  1. `mirror_state` is read first. A watermark later than this log's last
     run means the commit is older than the one last mirrored, and the job
     stops before any write rather than take the tables back.
  2. `schedule_events`: every event, removed ones too - year, id, title,
     start, end, hotel, room, removed, `true` only where the event carries
     it, and cancelled - upserted on (year, id), 1,000 a request. Then the
     year's ids are read back, 1,000 a page, and those the file no longer
     holds are deleted, 100 a request - rare, since in a live year an
     event leaves the file only by a merge (#43, #47). So an id to delete
     that no `merged` line names stops the job, and nothing is deleted.
  3. `schedule_changes`: the log's lines later than the watermark, all of
     them where there is no row, each the line as it is, `from` and `to`
     null where it has none, plus `year` and `fetch_code_changed`,
     upserted on (year, run, id, kind), 1,000 a request.
  4. `mirror_state`, last: `last_run` the log's last run, null with no
     log; `last_sha` the commit mirrored; `updated_at` sent, since a
     column's default does not fire again on an upsert's update.

  No transaction: each step is idempotent and the watermark comes last, so
  a run that fails partway is completed by the next.
- **The flag.** `last-run.json` describes the last committed run alone. A
  line of that run takes its `fetch_code_changed`; a line of any earlier
  run the mirror had not yet written is written `true`, fail-safe (#47) - a
  suppressed push is cheaper than a push for our own bug - and a warning
  names each such run. The lines after the watermark are always sent
  together, and a line sent again is written again whole, so a run's lines
  carry one value, which only moves from `false` to `true` as newer runs
  land. The push job reads the flag per line. So a run the mirror did not
  write while `last-run.json` described it is flagged: after a failed
  mirror completed once the next scrape has landed, and, at a project's
  first mirror - production's, at the freeze - every earlier run of the
  season. The exact recovery is a re-run before the next scrape lands. And
  one inherited from the pipeline: the flag is the run that committed, not
  the run that fetched (`pipeline.py`), so a committed `--from` or `--to`
  run takes it from the next fetching run - until a pipeline pull request
  of its own moves it (#54; ROADMAP, Flags).
- **Times and nulls.** `start` and `end` are the file's local times, to the
  minute; `season.json`'s `tz` is attached through zoneinfo, and each is
  sent with its offset. A time the file holds null - the fetch writes one
  where the source's date does not parse, and an end where a listing gives
  neither a duration nor a time range - is mirrored null: a time kept
  from before would make a starts-soon push at a time the source no longer
  states, the wrong push #47 exists to prevent. The push job sends no
  starts-soon for an event with no start (section 7). A zone that will not
  load stops the job: the mirror never guesses one.
- **How it ends.** `events.v2.json` absent - a season before its first
  full run - is nothing to mirror: exit 0, with a note. A frozen season
  (#46) mirrors its events alone, `last_run` null; a live one needs its
  change log and `last-run.json` beside the file (#42, #44). A file there
  and unreadable exits 1 before any request, sending nothing: not JSON, a
  line with a key or a kind the log does not write, a line twice, an event
  whose id is missing or held twice, a time not local to the minute, and
  an empty list of events, which would delete the year. A request that
  fails for want of a connection, a 429 or a 5xx is tried three times in
  all, after 5 and 15 seconds, since every request is idempotent - a
  DELETE tried again may count fewer rows, those an earlier try deleted
  before its answer was lost; any other failure exits 1 with the status
  and the server's body.

### The mirror job, as built

PR #57, with #54.

- **`mirror.py`,** at the repo root. `read_year()` reads and checks a
  season's files; three pure functions make the rows -
  `event_rows(doc, season)`, `change_rows(lines, since, last_run, *,
  year)`, which returns the rows and the runs flagged, and
  `ids_to_delete(in_table, in_file)` - and one small class, `Rest`, sends
  every request, over a `requests.Session` a test replaces. `--dry-run`
  reads and checks the files and prints the events and the lines - every
  line, the watermark not read; `3,459 events, 0 lines` for 2026 - sending
  nothing and needing no key. `--summary PATH` appends the job summary: the
  events upserted, the rows deleted, the change lines written, the
  watermark before and after, the commit, and the runs flagged. On Actions
  one `::warning::` names the flagged runs, the first 20 of them, and a
  failure is an `::error::`.
- **The migration,** the third, `20260926005152_mirror_times.sql`:
  `schedule_events.start` and `end` nullable, and `service_role` granted
  select, insert, update and delete on the three tables.
- **Every request** carries `apikey`, and for a JWT alone `Authorization:
  Bearer`; one with a body, `Content-Type: application/json`; and each
  write, `Prefer` with `handling=strict` - PostgREST otherwise ignores a
  preference it does not know, and a slip in `resolution` would make the
  upsert a plain insert - and `count=exact`, whose `Content-Range: */N`
  must be the rows sent, since a slip in the `in` list would otherwise
  match nothing, and say nothing. Queries are encoded by `requests`, never
  joined by hand. The statuses are PostgREST 14.5's, the dev project's:

| Request | Method and path | `Prefer` | Body | Expects |
|---|---|---|---|---|
| The watermark | `GET /rest/v1/mirror_state?select=last_run,last_sha&year=eq.<year>` | - | - | 200: `[]` or one row |
| Events | `POST /rest/v1/schedule_events?on_conflict=year,id` | `handling=strict,resolution=merge-duplicates,return=minimal,count=exact` | up to 1,000 rows, each with all nine columns | 201 where a row went in, else 200; `*/N`, N the rows |
| The ids | `GET /rest/v1/schedule_events?select=id&year=eq.<year>&order=id.asc&limit=1000&offset=<n>` | - | - | 200: a page; the offset moves by the rows returned, until a page returns none |
| A delete | `DELETE /rest/v1/schedule_events?year=eq.<year>&id=in.("<id>",...)` | `handling=strict,return=minimal,count=exact` | - | 204; `*/N`, N the ids |
| Change lines | `POST /rest/v1/schedule_changes?on_conflict=year,run,id,kind` | as the events' | up to 1,000 rows: `{year, run, sha, id, kind, from, to, cause, fetch_code_changed}` | as the events' |
| The watermark, written | `POST /rest/v1/mirror_state?on_conflict=year` | as the events' | `[{year, last_run, last_sha, updated_at}]` | as the events' |

- **A batch.** Every row of a batch has the same keys - PostgREST refuses
  mixed keys, 400 `PGRST102` - so a line with no `from` or `to` sends
  null, which lands as SQL null; a key the table lacks is 400 `PGRST204`.
  A key twice in one batch is refused before the request, an event's id
  and a line's run, id and kind alike, since a merge refuses a batch that
  holds one (21000).
- **The `in` list.** Each id is double-quoted, `"` and `\` escaped with a
  backslash: an id can hold a dot, `<source_id>.<n>` (#43), and PostgREST
  reserves the comma, the dot, the colon and the parentheses. 100 ids keep
  a request line near 4 KB, under the gateway's 8 KB.
- **jsonb** keeps a line's values, not its bytes: an object's keys come
  back reordered, and a stamp in UTC. A reader compares values.
- **The tests.** `tests/test_mirror.py`, in CI's `pipeline` job: the rows;
  the job against a fake PostgREST that answers as 14.5 does, every
  request recorded - the order, the batches, the ids read whole under a
  smaller max rows, a second run sending no line, the guard, the deletes a
  merge allows and their quoting, 100 a request, a count short of the rows
  sent, a DELETE tried again after its first try landed, the flag moving
  to `true` on a re-send, both key forms and the key in no URL, body or
  output - one the server echoes across the cut included - the retries,
  the strict `Prefer`, the frozen year, the absent file, the refusals, the
  dry run and the summary - and the committed 2026 file converted whole,
  3,459 rows. The fake reads an `in` list as PostgREST 14.5's parser does,
  a parenthesis not quoted ending it. It was checked against a real
  PostgREST, 14.5 on the CLI's local stack, with both key forms, step by
  step: each request's status and count, and the tables after.
  `00_structure.test.sql` holds the nullable times and the migration's
  grants to `service_role`, which with the local defaults off nothing else
  gives: without the grant, that test fails. A mutation pass over `mirror.py`, 50 mutants each failing a test,
  is not committed.

## 7. The push job — to follow

The queue-shaped sender: pick-changed from `schedule_changes`, suppressed
by `fetch_code_changed`, read per line (#54); starts-soon by one lead time
set in its call (#40, #50), and none for an event with no start (#54);
`push_sent`, the kill switch, and a dead endpoint pruned.

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
- The Auth project's two limits. The built-in mailer sends only to the
  organisation's own addresses, a few an hour; custom email is not the
  operations track's but the six-digit code's prerequisite (#25's note;
  ROADMAP, Checklist). And anonymous sign-ins are capped at 30 an hour per
  IP by default, while a hotel's Wi-Fi puts many phones behind one
  address: for the operations track (#50).
