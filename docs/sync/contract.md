# Identity and sync: the data contract

The design note for Identity and sync: DECISIONS #50-#56, in the detail a
pull request needs. Written 2026-09-25, before any of it was built:
sections 1-4 first, section 5 with the client's identity (PR #55), section
6 with the mirror job (PR #57), section 7 with the push job (PRs #59, #60
and #61), and section 8 with crews' client layer (PR #62). The evidence is
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
  `identity`, `state`, `time`; since PR #62 `crews` stands between
  `identity` and `state` (section 8, as built). `src/backend.js` holds the backend's
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
  There are seventeen: the email step's six, sync's five (section 5, as
  built) and crews' six (section 8, as built):

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
| Crews | `GET /rest/v1/crews?select=id,name,creator,invite_token,crew_members(user_id,display_name)&year=eq.<year>&order=created_at.asc,id.asc` | yes | none | 200: the caller's crews of the year, the oldest first, their invite tokens with them and their members embedded |
| Pull picks | `GET /rest/v1/picks?select=user_id,event_id,picked,changed_at,synced_at&year=eq.<year>&synced_at=gt.<since>&order=synced_at.asc,user_id.asc,event_id.asc&limit=1000&offset=<n>` | yes | none | 200: one's own rows and crewmates' of the year, 1,000 at most |
| Pull follows | `GET /rest/v1/follows?select=kind,key,followed,changed_at,synced_at&year=eq.<year>&synced_at=gt.<since>&order=synced_at.asc,kind.asc,key.asc&limit=1000&offset=<n>` | yes | none | 200: one's own rows, 1,000 at most |
| Create a crew | `POST /rest/v1/rpc/create_crew` | yes | `{"year", "name", "display_name"}`, the names trimmed | 200 and the crew, one object, its token with it; or 400 `22023`, 400 `23514` |
| Join a crew | `POST /rest/v1/rpc/join_crew` | yes | `{"token", "display_name"}` | 200 and the crew, unchanged to a member already in it; or 500 `P0002`, 500 `53400`, 400 `23514` |
| A new invite | `POST /rest/v1/rpc/regenerate_invite` | yes | `{"crew_id"}` | 200 and the new token, a JSON string; or 403 `42501` |
| Leave | `DELETE /rest/v1/crew_members?crew_id=eq.<crew>&user_id=eq.<the reader>` | yes | none | 204, whether or not row-level security let a row go |
| Remove a member | `DELETE /rest/v1/crew_members?crew_id=eq.<crew>&user_id=eq.<member>` | yes | none | 204, as leave's |
| Delete a crew | `DELETE /rest/v1/crews?id=eq.<crew>` | yes | none | 204, as leave's; the memberships go with the crew |

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
  on load; its callers are the email step and, since PR #62, a crew's
  create and join (section 8, as built).
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
- **The invite link** is the site's own address with `?join=<year>.<token>`
  for its query: the crew's token, and the year, so that a build of another
  year refuses the link before any request (section 8, as built).
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
  retention deletes by year. Since the push job (section 7) it is the
  queue too: a row with no `sent_at` is a claim, unsent, and `claimed_at`
  says when it was made.
- `mirror_state`: one row per year - `last_run`, `last_sha` and
  `updated_at`, how far the mirror has read; section 6 adds none. Section
  7's pick-changed was to add `tz`, the con's zone, for its times, and was
  found to need none (section 7, Pick-changed, as built).
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
- **The push job's migration,** the fourth,
  `20260926224454_push_spine.sql` (section 7, as built): the pg_cron and
  pg_net extensions; `push_sent.sent_at` nullable with no default, so a
  row written without it is a claim, and `claimed_at`, not null, `now()`
  by default; `push_due()`; its grants to `service_role` (section 3, as
  built); and two cron jobs, the push and a cleanup of pg_cron's records.
- **Pick-changed's migration,** the fifth,
  `20260928154158_pick_changed.sql` (section 7, Pick-changed, as built):
  `push_due()` replaced, to return both kinds, and its grants made again as
  they were. No table changes.
- **The batch's migration,** the sixth, `20260928193428_push_batch.sql`
  (section 7, The batch, as built): `push_due()` replaced in place, by
  `create or replace`, to claim a batch at a time; the same signature and
  return type, so its grants stand. No table changes.

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
  section 6). The push job's migration grants `service_role` select,
  insert, update and delete on `push_sent`, select and delete on
  `push_subscriptions` and select on `flags`, and `push_due()` is
  executable by `service_role` alone (#55; section 7, as built); pick-changed's
  migration makes the function again with the same grants, and reads
  `schedule_changes` as its owner, so the sender needs no grant on it; the
  batch's replaces it in place, by `create or replace`, which keeps them.
  `supabase/config.toml` turns the local database's defaults off to
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
- **The tests,** thirteen files under `supabase/tests/`, each one
  transaction rolled back: `00_structure`, `01_anon`, `02_stranger`,
  `03_member`, `04_stamps`, `05_rpcs`, `06_job_tables`, `07_cascades`,
  `08_push_subscriptions`, with sync's migration `09_sync`, with the push
  job's `10_push` (section 7, as built), with pick-changed's
  `11_pick_changed`, and with the batch's `12_batch`. A test user is a row
  inserted into `auth.users`. The test acts as that user through the
  `authenticated` role and a `request.jwt.claims` naming them, which
  `auth.uid()` reads, and as anon through `set local role anon`. A
  mutation pass - every policy dropped, each helper dropped and made to
  answer yes, each stamp trigger dropped, a grant to anon and one to
  `authenticated` on a job table - failed at least one test each; it is
  not committed.

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
  own. Since the push job (#55) it declares the push function,
  `[functions.push]`, with the gateway's JWT check off - the function's
  own secret header is the gate - and its entry, `index.js` (section 7,
  as built).
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
  minted the phone's user, and after it confirms one. Since PR #77, on a
  tap on the Plans tab and a tap on its Crew segment, and after a crew
  action in the crew panel, which waits for a run that began after the
  action - `syncAfter()`, since a run already out may have read before the
  action landed - and for how it ended. No timer. One run at a time: a
  trigger during one asks for one more after it, however many there are.
- **The pull** holds the drains while it reads and applies - the one out
  finishes first - so no pulled row lands on a change drained in between,
  and a tap meanwhile waits as an op. It reads the crews, with their
  members - and, since PR #62, their invite tokens, the oldest crew first
  (section 8, as built) - then the picks and the follows newer than the
  watermark less a minute, 1,000 rows a request - Supabase's most, hosted
  and in `supabase/config.toml` - until a request comes back short. When a crew
  has gained anyone since the last run, the picks are read whole, since a
  newcomer's are older than the watermark. Then, with no wait between: the
  reader's own rows are applied unless a pending op holds the key;
  crewmates' picks go to `storageKey("crewPicks")`, `{user: {event:
  true}}`, a crewmate's unstar taking the entry out and a departed member
  taking all of theirs; the crews to `storageKey("crew")`, `[{id, name,
  creator, invite_token, members: [{user_id, display_name}]}]`, which the
  crew screens draw from - the two keys `src/crews.js`'s since PR #62, and
  written through it (section 8, as built); and the watermark to
  `storageKey("syncStamp")`, `{user, picks, follows}`, each the newest
  `synced_at` its table's read returned, as the server wrote it.
- **The redraw.** A pull asks for one, on any tab, when the reader's own
  picks or follows changed. Since PR #77 there are two more: a pull that
  changed what a crew screen draws - a crew, its name, its token or its
  members, compared by id since the read gives members in no order, or a
  crewmate's stars, compared alone - and forgetting the crews at a change
  of owner or with no session. Those two are asked only while Plans is the
  tab or the crew panel is open: a redraw rebuilds Explore's grid, its
  filter box with it, and a crewmate's star should not take the caret from
  a reader typing there (ROADMAP, Flags). The tab's own draw shows the rest
  when it is tapped.
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
  the flag is the fetching run's (`docs/pipeline/contract.md`,
  `last-run.json`; PR #58): a run that does not fetch keeps the committed
  hash and records `false`, since its lines cannot carry the fetch's
  effects, and a `--to` run that fetches is refused once the year's
  `events.v2.json` exists, so the flag lands on the full run whose lines
  carry the change.
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

## 7. The push job

#55, as #50 has it: queue-shaped from its first pull request, which
carries the kill switch. Both kinds are built: starts-soon by PR #59 and
pick-changed by PR #60, each with its "as built" below; and the batch, by
PR #61, which claims and sends them a batch at a time.

- **Where it runs.** Inside the Supabase project (#25): pg_cron calls one
  Edge Function, `push`, through pg_net, every minute. Not a third Actions
  job: GitHub documents its schedule event as best effort - delayed under
  load, a five-minute floor, runs dropped - and its terms name a
  serverless application run on Actions as a disproportionate burden. The
  mirror is a publish step and stays on Actions (section 6); a sender on
  the minute is a runtime service.
- **The split.** A SQL function, `push_due()`, decides what is due and
  claims it; the function sends. The logic lives where pgTAP is.
- **The queue.** `push_sent` holds a claim per user, kind and key, its
  `sent_at` null until the push is sent. `push_due()` claims what is due,
  up to a batch - PostgREST answers an RPC with 1,000 rows at most, so a
  call claims no more than it can return (The batch, as built) - by an
  insert that skips a key already held, `on conflict do nothing`, and
  returns what it claimed, so two runs that overlap cannot both take a
  row. The sender acks a claim, setting `sent_at`, when a browser took
  the push; releases it, deleting it, when every browser answered 429, a
  5xx or nothing, so that the next minute retries; prunes a subscription
  on 404 or 410, and deletes a claim whose every browser was gone. A
  claim still unsent five minutes after it was made is a crashed run's,
  and `push_due()` releases it first.
- **The kill switch.** `flags.push_enabled`, read three times: by the cron
  job's own SQL, so that with it off there is no call at all; inside
  `push_due()`, which then returns nothing; and by the function, so that
  its summary's `off` is true. It is the season's window too: on at the
  freeze, off after the con (ROADMAP, Checklist).
- **The clock.** `push_due(at timestamptz default now(), dry boolean default false)`.
  The function passes on an `at` its request's body names, and the cron
  sends none; `dry` claims and releases nothing, and returns what a call
  would claim. It is #12's clock with a dev override, on the server: `at`
  is also when a claim is made, and so when it goes stale. `sent_at` is
  the real clock.
- **Starts-soon.** Due where the pick is picked; the event is not
  removed, not cancelled, and has a start (#54); `start - 15 min <= at < start`;
  and the user holds at least one browser. The key is the event's id,
  the year the event's. The lead time, 15 minutes, is one constant in
  `push_due()`, the value #40 and #50 left open. The function counts the
  minutes as it sends - from `at`, or the clock, with the time the run has
  taken added - so a late run gives a shorter warning, never a stale one.
  A user's picks that share a start fold into one push, one claim a pick;
  one start, so one count of minutes and one TTL, the seconds until the
  start. Urgency high.
- **The payload,** one shape: `{kind, year, event_ids, title, body}`. One
  pick: the event's title, and the body `Starts in N min · <hotel> <room>`.
  A fold: the title `N picks start in M min`, and the body one line an
  event, `<title> · <hotel> <room>`. The worker (Delivery's) builds any
  URL from `event_ids`; nothing here touches the client.
- **The caller.** The function refuses any request without an
  `x-push-secret` header equal to its `PUSH_SECRET`, whatever Supabase's
  JWT setting. pg_net sends that header and no JWT, and the gateway's JWT
  check is off for the function.
- **Libraries.** PostgREST by `fetch`, as #53: no library. Web Push by
  one, since VAPID and aes128gcm are not worth writing by hand.
- **Pick-changed,** decided, and PR B's. One push per user per run and
  event, folding the kinds `cancelled`, `uncancelled`, `time`, `place`,
  `removed` and `restored`, and never `title`, `description`, `people`,
  `tracks` or `merged`. Sent only where the line's `cause` is `source` and
  its run's `fetch_code_changed` is false - a `code` line is suppressed as
  a flagged run's is - the pick is still picked, the line's run is after
  the pick's `changed_at`, the event's start is in the future or null, and
  the run is within six hours. Its times are in the con's zone, from a
  `tz` column the mirror is to write to `mirror_state` (#54). As built,
  the column was found unneeded, and the fold is one push per user and run,
  across every event of theirs the run changed (Pick-changed, as built,
  below).

### The push job, as built

PR #59, with #55: starts-soon.

- **The migration,** the fourth, `20260926224454_push_spine.sql`:
  - `create extension if not exists pg_cron with schema pg_catalog`, and
    pg_net likewise `with schema extensions`: the schemas Supabase names.
    Both are in the image's preloaded libraries, locally and hosted, and
    `postgres` may create both - checked on the CLI's local stack, whose
    Postgres is the dev project's, 17.6.1.166, with pg_cron 1.6.4 and
    pg_net 0.20.4;
  - `push_sent.sent_at` nullable with no default, so that a row written
    without it is a claim, and `claimed_at`, a `timestamptz`, not null,
    `now()` by default;
  - `push_due(at, dry)`: plpgsql, security definer, owned by `postgres`,
    its `search_path` pinned to `public`, executable by `service_role`
    alone. Unless `dry`, it releases the stale claims first, those with
    `claimed_at < at - interval '5 minutes'` and no `sent_at`. With the
    switch off it returns nothing. Else one row per user and event it
    claimed: `user_id`, `year`, `event_id`, `title`, `start`, `hotel`,
    `room`, `minutes_until` - the whole minutes to the start, a part
    minute counted as one - and `endpoints`, the user's browsers,
    `[{endpoint, p256dh, auth}]` by endpoint; the rows by user, start,
    title and id. A claim's `claimed_at` is `at`. Replaced by the fifth
    migration, which returns both kinds (Pick-changed, as built, below),
    and in place by the sixth, which claims a batch at a time (The batch,
    as built, below);
  - the grants: `service_role` select, insert, update and delete on
    `push_sent`, select and delete on `push_subscriptions`, and select on
    `flags`; nothing to an app role;
  - two cron jobs, both run as `postgres`. `push`, every minute, posts to
    Vault's `project_url` with `/functions/v1/push` after it, the header
    `x-push-secret` from Vault's `push_secret`, an empty JSON body and a
    30-second timeout, so that `net._http_response` keeps the run's own
    answer for six hours - where `flags.push_enabled` is true. With the
    switch off the post's arguments are never evaluated: no Vault row is
    read and nothing is sent. With it on and Vault empty the run fails,
    and `cron.job_run_details` says why. `cron-history`, daily at 04:00
    UTC, deletes pg_cron's run records older than seven days, every job's,
    switch or no switch: pg_cron deletes none, and a job a minute is 1,440
    records a day.
- **The function,** `supabase/functions/push/`: `push.js`, the logic,
  which imports nothing; and `index.js`, the runtime's half, which hands
  it the environment, `fetch`, the clock and the encoder -
  `npm:web-push@3.6.7`'s `generateRequestDetails`, which encrypts (RFC
  8291, aes128gcm) and signs (RFC 8292) and leaves the sending to `fetch`,
  since its `sendNotification` goes through `node:https`. `config.toml`'s
  `[functions.push]` turns the gateway's JWT check off and names `index.js`
  as the entry. With the check on, the gateway passes any `apikey`, the
  public publishable key among them (checked on the CLI's local stack), so
  it could not be the gate.
- **A run,** in order. A POST only, else 405. `PUSH_SECRET` unset, 500. A
  missing or wrong `x-push-secret`, compared in constant time, 401. The
  service key is the runtime's default in `SUPABASE_SECRET_KEYS`, sent on
  `apikey` alone, else its legacy `SUPABASE_SERVICE_ROLE_KEY`, sent as the
  bearer too (#54's rule); with neither, 500. The encoder signs and
  encrypts a push to a browser that exists nowhere, so VAPID keys it
  refuses are a 500 before anything is claimed. A body it cannot read,
  400: it takes nothing, or `{at, dry}`, `at` an ISO date and time with
  its offset. Then the switch, and with it off `{off: true}` and nothing
  more; then `push_due()`, the fold, and each push to each of its user's
  browsers, 50 at once, each with a 10-second timeout and redirects
  refused. Per push: where a browser took it, acked; else, where one
  refused it, released, and the run fails; else released, for the next
  minute. A browser answering 404 or 410, or whose keys the encoder cannot
  use, is pruned. A 401, a 403 or any other 4xx is a refusal, and ours:
  logged with the push service's origin, the status and its body, and the
  run answers 500. A fold's body lists ten events at most, then `and N more`,
  so that a push stays well inside the 4 KB a push service takes. Since
  the batch, a run asks `push_due()` again until a call comes back empty
  or a limit ends the run, and a push no browser took is released when the
  run ends (The batch, as built, below).
- **Its answer,** and its log's one line: `{off, due, sent, released, pruned}`,
  counted in claims - `pruned` in browsers - from PostgREST's
  `Content-Range`. A failed run adds `error`. `dry` sends and writes
  nothing, and adds `pushes`: each push's user, `event_ids`, title, body,
  TTL and number of browsers. Since the batch it carries `batches` too,
  and `stopped` where a limit ended the run (The batch, as built, below).
- **Every request** to PostgREST carries the key, and a write
  `Prefer: handling=strict,return=minimal,count=exact`; an `in` list
  quotes each id as the mirror's does (section 6, as built). PostgREST
  14.5's answers:

| Request | Method and path | Body | Expects |
|---|---|---|---|
| The switch | `GET /rest/v1/flags?select=value&name=eq.push_enabled` | - | 200: `[{"value": true}]`, or not |
| Due | `POST /rest/v1/rpc/push_due` | `{}`, or `{"at": <ISO>, "dry": true}` | 200: the rows above, a batch of them since the batch |
| Ack | `PATCH /rest/v1/push_sent?user_id=eq.<user>&kind=eq.<kind>&key=in.("<key>",...)&sent_at=is.null` | `{"sent_at": <the clock, ISO>}` | 204, `*/N` |
| Release | `DELETE /rest/v1/push_sent?<the same filter>` | - | 204, `*/N` |
| Prune | `DELETE /rest/v1/push_subscriptions?endpoint=eq.<endpoint>` | - | 204, `*/N` |

  And to each browser, `POST <endpoint>` with web-push's headers - `TTL`,
  `Urgency: high`, `Content-Encoding: aes128gcm` and
  `Authorization: vapid t=<JWT>, k=<public key>` - and the encrypted
  payload.
- **The secrets.** The function's `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` and `PUSH_SECRET`, set by `supabase secrets set`; and
  Vault's `project_url` and `push_secret`, for the cron job, set by
  `vault.create_secret`. `VAPID_SUBJECT` is the site's https URL on dev,
  and a `mailto:` on production, where a push service may need to reach
  the sender. Locally they are in `supabase/functions/.env`, which git
  ignores.
- **The tests.** pgTAP's `10_push.test.sql`: the extensions and the two
  jobs, the gate in the push job's command, the grants, and `push_due()` -
  the switch; the window's edges, due at 15 minutes before the start and
  not at 16, nor at the start or after; a part minute counted as one; each
  thing never due; the endpoints; the claim; a second call; dry; a claim
  five minutes old holding, and a stale one released while a sent one
  stays; and `at`'s default. `00_structure` holds `push_sent`'s columns.
  Vitest's `tests/unit/push.test.js` runs `push.js` in Node against a fake
  PostgREST, fake push services, a fake encoder and a clock it moves: the
  gate, the switch, the RPC's arguments, dry, the fold and its words, the
  minutes and the TTL as it sends, each answer's write, the 500s, the
  quoting and the summary - and a mixed run, one push service refusing a
  push while another takes its own, in either order: the push taken is
  acked and only the refused released before the run answers 500, so no
  push a browser took is sent again while the keys are being fixed. A
  mutation pass is not committed: 46 of 47 mutants of the migration - each
  rule of `push_due()`, the grants, the two jobs and the columns - failed a
  pgTAP test, the one left the clause `start is not null`, which is
  equivalent, since a null start meets no window, and is kept because this
  section states the rule; and 41 of 41 of `push.js`, three of them of the
  mixed run, failed a Vitest test.
- **Run end to end** on the CLI's local stack, with the runtime the hosted
  project runs (edge-runtime 1.76.2; the hosted project answered as 1.76.0
  when the batch timed it, The batch, as built) and PostgREST 14.5, and a
  stand-in push service: the cron job called the function through pg_net
  with no JWT; a user with one browser that took the push and one gone was
  acked and pruned; one whose browser answered 503 was released, and
  claimed again the next minute; one with two picks at one start got one
  push, and both were acked; a 403 released the claim and failed the run,
  the service's answer in the log; every push sent decrypted, with its
  browser's keys, to the payload above, its VAPID signature checked; and
  with the switch off, the job's run read nothing and sent nothing.
- **The hand test,** on dev after the merge, and again on production at
  the freeze. First serve these two files from `http://localhost:<port>`,
  a secure context, in a desktop browser, allow notifications, and copy
  the three values the page prints:

```html
<!-- subscribe.html -->
<!doctype html><meta charset="utf-8"><title>Push subscribe</title><pre id="out">...</pre>
<script type="module">
  const KEY = "<the project's VAPID public key>";
  const raw = Uint8Array.from(atob(KEY.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const reg = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
  const { endpoint, keys } = sub.toJSON();
  document.getElementById("out").textContent =
    JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, null, 2);
</script>
```

```js
// sw.js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "Push", { body: data.body || "" }));
});
```

  Then, in Table Editor, add a `push_subscriptions` row with the three
  values and the tester's `user_id`, read from `picks`; choose one of the
  tester's picks, and read its event's `start` from `schedule_events`;
  and turn `flags.push_enabled` on. POST the function,
  `<project URL>/functions/v1/push` with the header `x-push-secret`, the
  body `{"dry": true, "at": "<start - 10 min, ISO>"}`: the answer previews
  the push. POST it again without `dry`: the notification arrives,
  `Starts in 10 min · <hotel> <room>`. If even DevTools' Push shows
  nothing with permission granted, the operating system is hiding the
  browser's notifications. POST once more: `sent` is 0, the claim acked.
  Last, turn the switch off, and delete the test's `push_sent` row and the
  subscription.

### Pick-changed, as built

PR #60, with #55.

- **The migration,** the fifth, `20260928154158_pick_changed.sql`:
  `push_due()` dropped and made again, since its return type grows - the
  same `(at, dry)`, the same grants, and no table changed. Three constants
  are named at its top: `lead_time`, 15 minutes, starts-soon's; `horizon`,
  6 hours, pick-changed's; and `stale`, 5 minutes, when an unsent claim is
  a crashed run's. It returns one row per user and thing a push tells:
  `kind`, `key`, `user_id`, `year`, `event_id`, `title`, `start`, `hotel`,
  `room`, `minutes_until`, `run`, `changes` and `endpoints`, the rows by
  kind, user, run, the event's start - an unknown start last - title and
  id. Replaced in place by the sixth migration: a fourth constant, `batch`,
  and the rows starts-soon first, pick-changed by run and then user (The
  batch, as built, below).
  - A starts-soon row is the spine's, its `key` the event's id, its `run`
    and `changes` null.
  - A pick-changed row is a user's pick whose event one run changed. Its
    `key` is the run in UTC to the second, a bar and the event's id -
    `2026-09-01T21:33:33Z|c32d19e7750818e0eb903f152adb7af0` - its `changes`
    the event's lines of that run, each `{kind, from, to}` as the change
    log has them, and its `minutes_until` null. A line counts where its
    kind is one of the six, its `cause` is `source` and its run's
    `fetch_code_changed` false; `at - horizon <= run <= at`, the upper edge
    so that an `at` named in the past never meets a later run's lines; the
    pick is picked, stamped before the run; and the event's start is after
    `at`, or unknown. The line's event is joined by year and id, so a line
    whose event the mirror does not hold is never due.
  - Either kind is due only for a user with a browser, as starts-soon was.
  - **The claim.** One insert, the one statement of a call, claims every
    due row of both kinds up to the batch - PostgREST answers an RPC with
    1,000 rows at most, so since the sixth migration a call claims no more
    than it can return (The batch, as built, below) - `on conflict do
    nothing`, and the call returns only what it inserted. So the keys of
    one push - a user's picks at one start, or a user's picks one run
    changed - are claimed together, carry one `claimed_at`, go stale and
    are released together, and are acked or released by the sender in one
    request; and a key sent once never comes back, so no part of a push is
    sent twice. A claim holds its own kind alone.
- **The zone.** `mirror_state.tz`, decided for pick-changed's times (#54,
  #55), was found unneeded and not added. A change line's `from` and `to`
  are the file's wall-clock strings, already the con's clock, and nothing a
  push shows is a `timestamptz`: the event's `start` serves the due test,
  the order and the TTL alone. The function says the strings as they are -
  the weekday from the date, the 12-hour time from `HH:MM`, put together by
  hand - with no zone and no `Intl`. A push that ever shows a `timestamptz`,
  the current start say, is the column's extension: the mirror writes it
  from `season.json`, and the function formats in it.
- **The function.** `push.js` folds a user's pick-changed rows into one
  push per year and run, each row in `push_due()`'s order; starts-soon's
  fold is the spine's. A change is said so:

| Change | Said |
|---|---|
| `cancelled`, `uncancelled` | `Cancelled`, `No longer cancelled` |
| `removed`, `restored` | `Removed from the schedule`, `Back on the schedule` |
| `time`, its start moved | `Moved: Sat 2:30 PM → Sat 3:00 PM`, a side with no start `Time TBD` |
| `time`, its start the same | `Ends: Sat 8:00 PM → Sat 6:00 PM`, a side with no end `Time TBD` |
| `place` | `Room: Hyatt Regency V → Hilton Grand`, the hotel and the room, whichever it has, `TBD` for neither |

  An event's changes of one run are told in this order - cancelled or
  uncancelled, removed or restored, time, place - joined by ` · `. One
  event: its title, and its changes. Several: `N of your picks changed`,
  and a line an event, `<title> — <changes>`, ten at most, then
  `and N more`. The payload is the spine's one shape, its `kind`
  `pick-changed`; urgency normal; the TTL the seconds until the earliest
  start among its events, never below zero, or 86,400 where none has a
  start. The sender acks and releases a push's claims by its kind and their
  keys, as `push_due()` made them, and the dry preview gives each push's
  `kind`.
- **Known gap: merged.** A pick on an id merged into another stays on the
  old id until the client re-points it through `was` on open (#43, #49);
  the survivor's own lines then apply, and until then its changes send no
  push.
- **The rehearsal.** `tools/replay_changes_2026.py` rebuilds 2026's change
  log from `main`'s history: the 34 versions replayed as
  `tools/replay_2026.py` replays them, each built by `events_v2.build()` on
  2026's inputs and diffed by `diff_stage.diff()` against the one before -
  v1 a season's first run - its lines stamped with the version's
  `generated_at` and its commit's SHA, and a run flagged where a
  `scraper.py` commit comes before it: v5, v9, v12 and v34. 4,009 lines in
  26 runs, all `source`, 653,506 bytes, in about 25 seconds, written to
  `tools/out/`, which git ignores. With `--load` it upserts them into a
  project's `schedule_changes` for 2026, by `mirror.py`'s own client and the
  names it reads, refusing where the year holds no events, and reports the
  lines whose id `schedule_events` does not hold: 45, on 21 ids - the two
  James Callis sessions, whose ids the replay keeps from before their gap
  (`docs/pipeline/replay-2026.md`, section 1), and 19 events the source
  dropped and never listed again, which the replay carries removed and the
  frozen file does not hold. A pick on one is never due. 2026 is frozen,
  so the mirror never meets the loaded lines - it reads no change log for a
  frozen season, and writes and deletes none - and the horizon keeps a real
  run, at the real clock, from ever sending one.
- **The tests.** pgTAP's `11_pick_changed.test.sql`: each of the six kinds
  due and every other kind not; a `code` line and a flagged run's
  suppressed; a pick unstarred, or starred at or after the run; an event
  started, or starting at `at`, and one with no start due; the horizon at
  six hours and a second more, a run at `at` and one a second after; one
  row per user, run and event, its title line left out; the key, written in
  UTC whatever the session's zone, the row, the endpoints and the order; a user with no browser, another year's pick
  or event of the same id, and a line whose event the mirror lacks; the
  claim - every key at `at`, a second call, a claim holding its own kind
  alone - and a push's stale claims released and claimed again together,
  one out of the horizon not claimed again; and starts-soon's rows beside
  them, `10_push` unchanged. Vitest's `tests/unit/push.test.js`: every
  word above, the weekday whatever zone the runtime is in, the fold, the
  TTL and the urgency, a run of both kinds acked and released each by its
  own kind and keys, and the dry preview. `tests/test_replay_changes_2026.py`
  runs the tool on `tests/mini_history.py`. Mutation passes, not
  committed: 72 of 74 mutants of the migration failed a pgTAP test, the
  two left equivalent - the spine's `start is not null`, and the claim's
  match on kind among what one call claimed, since a starts-soon key is an
  event id and a pick-changed key holds a run and a bar, so the two never
  meet; 79 of 79 of `push.js` failed a Vitest test; and 21 of 22 of the
  tool failed a pytest one, the one left its second redaction of an error
  `mirror.py`'s client has already redacted.
- **Run end to end** on the CLI's local stack, with PostgREST 14.5,
  edge-runtime 1.76.2 and a stand-in push service, at the real clock: one
  user's two picks one run changed - one moved and re-roomed, its title
  line beside them, one cancelled - and a third starting in eleven minutes;
  another's pick restored, to a browser answering 503; a third's pick two
  runs changed; a fourth's flagged line and `code` line. The dry call
  previewed five pushes; the cron's next run answered
  `{"off":false,"due":6,"sent":5,"released":1,"pruned":1}` - the fold,
  `2 of your picks changed`, to both of the first user's browsers, one of
  them 410 and pruned, the starts-soon push beside it at urgency high, the
  two runs' pushes one each, the 503 released, nothing for the flagged and
  `code` lines - and the run after it claimed the released push again and
  released it again. Every push sent decrypted, with its browser's keys, to
  the payload above, its VAPID signature checked, its TTL and urgency its
  kind's.
- **The hand test,** on dev after the merge, once the rehearsal's lines are
  loaded and the tester has a browser subscribed (the hand test above).
  Give the tester three picks by SQL, each stamped `2026-09-01T00:00Z`,
  before every run: v2's move of "Producing Puppet Short Films and Puppet
  Media" (`c32d19e7750818e0eb903f152adb7af0`), v31's cancellation of "The
  Temporal Formal" (`c32d19e7750818e0eb903f152aced30a`), and v12's removal
  of "On the Mothman Trail" (`c32d19e7750818e0eb903f152ac55882`), in a
  flagged run. Turn the switch on. POST with `at` a minute after v2's run,
  dry: the preview is `Moved: Fri 2:30 PM → Fri 10:00 AM`; again without
  `dry`: the push arrives; once more: `sent` is 0. `at` a minute after
  v31's run: `Cancelled`. `at` a minute after v12's run: nothing - the
  event is held, starts after `at` and was picked before the run, so the
  flag alone suppresses it. v9's `restored` lines cannot show the flag:
  they are the Callis sessions, which `schedule_events` does not hold.
  Last, turn the switch off, write the three picks back as tombstones -
  `picked` false, a newer stamp, so a device that pulled them unstars them
  - delete the test's `push_sent` rows, and keep the loaded lines.

### The batch, as built

PR #61, with #55.

- **Why.** PostgREST answers an RPC with at most `max_rows` rows - 1,000,
  in `supabase/config.toml` and on the hosted project alike - and cuts
  the rest from the end of the function's own order, while the function
  runs to its end: on the CLI's local stack a function that wrote 1,001
  rows and returned them was answered with 1,000, `Content-Range`
  `0-999/1001`, and all 1,001 were written; a `limit` cannot raise it.
  The fifth migration's `push_due()` claimed every due row, so past 1,000
  the rest were claimed and never sent until the stale release, five
  minutes on, and cut again each time they were claimed again while more
  than 1,000 were due: a starts-soon push could miss its window. And the
  function encrypted every push it was given in one request, against
  Supabase's 2 seconds of CPU a request.
- **The migration,** the sixth, `20260928193428_push_batch.sql`:
  `push_due()` replaced by `create or replace`, with the same signature
  and return type, so its owner and grants stand - `service_role`'s alone.
  `security definer` and the search path are said again, since the
  statement sets them: left out, they are lost while the grants stay
  (checked). A fourth constant beside `lead_time`, `horizon` and `stale`:
  `batch`, 200 rows. No table changes; the two cron jobs are the spine's.
  - **What is left out first.** A due row whose key is held - sent, or
    claimed and not yet stale - is left out before the batch is cut, in a
    real call and a dry one alike. A starts-soon pick stays due by its
    rule until its start, so a batch cut first would fill with keys the
    insert then skips, and come back empty with work waiting.
  - **The unit is a push:** a user's rows of one kind, year and moment -
    the start for starts-soon, the run for pick-changed - which is
    `push.js`'s fold. Pushes are taken in order: starts-soon before
    pick-changed; starts-soon by start, soonest first, and pick-changed by
    run, oldest first; then by user and year. They are taken while their
    rows stay within `batch`, and the first push whole even when it alone
    is more, so a call claims at most 200 rows, or one push, whichever is
    more, and never cuts one. A push the batch cannot take whole waits for
    the next call, and so does every push after it. A push's place and the
    rows taken up to its end are windows over the rows themselves, one
    order key a push.
  - **The claim** is the fifth's - one insert, `on conflict do nothing`,
    at `at` - over the batch alone, and the call returns its rows in the
    order it took them, inside a push by start - an unknown start last -
    title and id. The stale release is still first, every call but a dry
    one. `dry` returns the batch a call would claim, and nothing more.
- **The function.** `push.js` asks `push_due()`, with the same arguments
  every call, until a call comes back empty - empty, not short: with whole
  pushes a full batch can be under 200 rows - or a limit is met. Two
  constants: `BATCHES`, 2, the calls that bring rows in a run; and
  `BUDGET_MS`, 20,000, after which no call but the first is made. Each
  batch is folded and sent, and every answer read before its first write;
  then the pushes a browser took are acked and the gone browsers pruned,
  before the next call. `dry` calls once.
- **A push no browser took** - each of its browsers answering 429, a 5xx
  or nothing, refusing it, or gone - is held: its claims stay until the
  run ends, and are released then, once, a push at a time - on the way
  out of an error too, since the answers are read before any write, so a
  write that fails still leaves every such push of its batch held. A
  release deletes the claim, so the push is due again at once, and first
  in the order; released with its batch, it would be claimed by the run's
  next call and sent again seconds later, into the 429 or the outage that
  turned it away. Held, it is retried the next minute and not the next
  batch, as the queue has it. A refusal does not end the run: the refused
  push is held like the others, and the run answers 500 at its end, as it
  did.
- **Its answer,** and its log line: `{off, batches, due, sent, released,
  pruned}`, and `stopped`, `"batches"` or `"time"` - the ceiling's where
  both are met - where a limit ended the run: that the limit was met, not
  that more was due; a run whose second batch was the last of the work
  says so too. `batches` counts the calls that brought rows: none with the
  switch off, one for a dry run, or none with nothing due. Every count is
  summed over the run. An error keeps the acks made before it and answers
  500 with the summary so far. The switch turned off mid-run ends the loop
  at its next call, `off` still false.
- **The ceiling, and what it rests on.** A batch's CPU is the encoder's:
  `npm:web-push` encrypts and signs once a push a browser. Timed with the
  push function's own encoder, 200 calls at a time: on the hosted dev
  project - us-east-1, edge-runtime 1.76.0 - 0.75 to 0.86 ms a call; on
  the author's laptop, the same code in edge-runtime 1.76.2, 0.51 to 0.57
  ms, so hosted is 1.5 times the laptop. On the laptop, the whole of
  `push.js` in a worker held to 2 seconds of CPU, a batch of 200 one-row
  pushes to two browsers each - 400 encrypted sends, their acks and the
  call - took about 350 ms of the worker's CPU; two batches 680 ms, three
  970, five 1,500 to 1,630. At hosted's 1.5 times, two batches are about
  1.0 second of the 2, with room for what else a run spends, and three
  about 1.5. So `BATCHES` is 2 and the batch stays 200: 400 rows a minute.
  The bound assumes two browsers a user; a user's browsers are not
  capped, and each is a send. A change to `BATCHES` or `batch` starts
  from these figures.
- **The worst case** is a bound, not a figure: the budget, plus one
  batch, plus the run's releases. A batch is at most its browsers' sends,
  in rounds of `IN_FLIGHT`, 50, each round at most `SEND_TIMEOUT_MS`, 10
  seconds; then an ack a push a browser took and a prune a browser gone,
  one after another. The releases are a request a held push, one after
  another, once the calls are done. The requests to PostgREST carry no
  timeout of their own, so the bound holds while PostgREST answers. At two
  browsers a user a batch is at most 400 sends, eight rounds, 80 seconds;
  a user's browsers are not capped, so neither are a batch's rounds. A run
  that passes 30 seconds loses its answer in `net._http_response` - pg_net
  gives up waiting - and the log line alone has it; on the CLI's local
  stack the runtime finished a run whose caller had hung up, and hosted
  was not checked. A run that outlived `stale`, five minutes, could have
  another run release and claim its held push, and its own release then
  delete the other's fresh claim; the budget keeps a run of two-browser
  users far inside it.
- **What the ceiling leaves** is claimed the next minute, starts-soon
  first. A starts-soon row is due only until its start, so a backlog
  growing faster than 400 rows a minute sends the latest late, or not at
  all; pick-changed waits up to its six hours.
- **Known limits,** older than the batch, named here since the batch
  takes a push whole. A push is acked and released in one request, its
  every key in an `in` list, and the gateway refuses a request line of
  about 8 KB: on the local stack 118 pick-changed keys passed and 119 were
  refused, 414, and 196 starts-soon keys passed and 197 were refused. An
  ack refused so comes after the push was sent: its claims, and those of
  the pushes a browser took after it in its batch, are left to the stale
  release, and sent again; a release refused so leaves that push to the
  stale release. And `event_ids` lists every event of a push, so a push of
  more than some 70 to 100 events outgrows the 4 KB a push service takes,
  and is refused, 413. In 2026's data pick-changed stays far below both,
  at most 15 events of the push kinds changed by one run; starts-soon
  stays under the ack's limit, at most 113 events sharing a start, but a
  user who had picked more than some 70 of the 113 would outgrow the
  4 KB. A push of more than 1,000 rows would meet the 1,000-row cap again,
  whole push or not. Chunking the acks and bounding `event_ids` is Open.
- **Overlapping calls.** Two calls at the same instant compute the same
  batch; the second one's insert waits on the first's, skips every key,
  and comes back empty while more may wait. Its run ends there, and the
  other run, or the next minute, takes the rest: empty means nothing this
  call could claim, not nothing due.
- **The tests.** pgTAP's `12_batch.test.sql`: 201 one-row pushes - 200
  claimed and returned, dry the same batch, the 201st by the next call; a
  two-row push that would take the batch past 200, waiting whole, with
  every push after it; a first push of 201 rows taken whole; who waits at
  the line - a pick-changed push behind 200 starts-soon ones, a later
  start and a newer run though their users come first, and a user's
  second year's push of the same run; the order a call returns; a stale
  claim released first, every call, and claimed again inside the batch;
  a held key - sent, or claimed exactly five minutes before - taking no
  place; a key another run claims between the call's read and its insert,
  a trigger standing in for that run, skipped and not returned; the stale
  release made with the switch off; and events of one start and one title
  by id, planned so that only the tie-break can order them.
  `11_pick_changed`'s order follows - starts-soon first, then
  pick-changed by run and user - and `10_push` and `00_structure` are
  unchanged. Vitest's `tests/unit/push.test.js`: the two limits; a batch
  sent, acked and pruned before the next call; the ceiling; the budget at
  its edge, and the first call made however late; both limits met at
  once, said as the ceiling; a push nobody took released after the last
  call, and once; a refusal that does not end the run; a run the time
  ended, which still releases what it holds; dry's one call; the same
  arguments every call; an error in the second batch, or in its call,
  that keeps the first batch's acks and releases what the run holds; a
  failing ack that still leaves the batch's later untaken push held; and
  a release that fails at the run's end, the rest released on the way out.
  Mutation passes, not committed: 100 of 103 mutants of the migration -
  each rule of `push_due()` the earlier passes held, and the batch's
  constant, its cut, each term of its window, the held filter, the claim
  and the answer's order - failed a pgTAP test. The three left are
  equivalent: the spine's `start is not null`; `rank()` for
  `dense_rank()`, the same where every push has its own key; and the
  answer matching a claim of the other kind, which needs an event id
  holding a run and a bar, as no source issues. 135 of 137 of `push.js`
  failed a Vitest test; the two left are equivalent too: the ceiling's
  `===` as `>=`, since the count never passes it, and the pool's runners
  not capped at the sends, the spare ones starting none.
- **Run end to end** on the CLI's local stack, beside the repository's,
  with PostgREST 14.5, edge-runtime 1.76.2 and a stand-in push service, at
  the real clock, twice, the second on the final migration: 430 users each
  with a pick starting twelve minutes on - one browser answering 503 and
  one 410 - and 30 users with a pick one run had changed an hour before.
  The first cron run took two batches, 400 rows, and stopped at the
  ceiling,
  `{"off":false,"batches":2,"due":400,"sent":398,"released":2,"pruned":1,"stopped":"batches"}`:
  the 410's push released with the 503's when the run ended, its browser
  pruned after the first batch, in 1.6 to 1.9 seconds, most of them the
  acks, a PATCH a push, one after another. The next minute's run took the
  rest in one batch - the 503's push first, then the last 30 starts-soon
  pushes, then the 30 pick-changed - and an empty call,
  `{"off":false,"batches":1,"due":61,"sent":60,"released":1,"pruned":0}`;
  each run after it, the 503's push alone, released at its end. No browser
  had a push twice in a run, pg_net kept every run's answer, and every
  push sent decrypted, with its browser's keys, to the payload its kind
  makes. `push_due()` took 7 ms a call with 460 due, 20 with 2,000 and 35
  with 4,000, on tables never analysed. A first draft joined each row back
  to its push's rank, which Postgres planned on such tables as a nested
  loop, a second a call at 2,000 due.
- **No hand test:** the loop is the local run's to prove. After the merge
  the dev project takes the sixth migration and the function, and the
  switch stays off.

## 8. Crews

#10, as #50 narrows it: create, join by the link, leave, remove, regenerate
the invite, the overlay of crewmates' picks on the timeline, and who's
going. #56 has the client's rulings; this section is the client's layer,
PR #62, which has no screen. The screens - create, join, your crews,
who's going and the overlay's look - are Where things live's (ROADMAP).
Since PR #77 they exist on Plans: the crew header, the crew panel -
create, join by a tapped or a pasted link, and manage - and the crew's
day (`docs/screens/contract.md`, section 5, as built); who's going is the
event sheet's, still to come.

- **The creator cannot leave;** the creator's Leave is Delete crew. The
  policies let a creator delete their own membership (section 3, as
  built), and `creator` stays set when it goes, so a creator who left could
  still regenerate the invite from outside - that alone, since removing a
  member and deleting the crew read the crew as a member, and from outside
  answer 204 with nothing deleted (checked on the CLI's local stack).
  Handing a crew over is the spring's, only if a crew asks.
- **Who does what.** Any member may share the invite link. The creator
  alone regenerates it, removes a member and deletes the crew. A member
  removed can join again by the link they still hold until the creator
  makes a new one, so a removal that is meant to hold is followed by a new
  invite: the screens' to offer.
- **Several crews** a user, with no cap on how many. The readers take the
  union of all of them, a person once.
- **Renaming a crew and editing one's display name:** the policies allow
  both (section 3); neither is built now.
- **A crew action never writes local state on success.** The server's
  answer is the truth, and the next pull brings it, so section 1's rule -
  a crew action fails visibly and leaves local state untouched - holds by
  construction.

### Crews, the client, as built

PR #62, with #56.

- **The module,** `src/crews.js`, a nineteenth leaf after `identity`, the
  lowest place its imports allow (#29). It owns `storageKey("crew")` and
  `storageKey("crewPicks")`, moved out of `sync.js`: the pull asks
  `crewGained()` whether a crew has gained anyone, writes both keys through
  `applyPulledCrews()` - the crews as read, a departed member's picks
  dropped, a crewmate's star kept and an unstar taken out - and forgets
  both through `forgetCrews()`, at a change of owner and with no session
  (section 5, as built). It reads its keys when asked, never as it is
  imported. It imports nothing above it and runs no sync: a screen's
  handler runs `runSync()` after an action, as the email step's does after
  it sends a code.
- **The actions,** each one request made as the user (section 1, as
  built), answered by the server, and writing nothing on the phone:

  | Action | Request | Answer |
  |---|---|---|
  | `createCrew(name, displayName)` | `ensureUser()`, then `POST /rest/v1/rpc/create_crew`, `{"year", "name", "display_name"}` | the crew, one object, its token with it |
  | `joinCrew(invite, displayName)` | `ensureUser()`, then `POST /rest/v1/rpc/join_crew`, `{"token", "display_name"}` | the crew, unchanged to a member already in it |
  | `newInvite(crewId)` | `POST /rest/v1/rpc/regenerate_invite`, `{"crew_id"}` | the new token |
  | `leaveCrew(crewId)` | `DELETE /rest/v1/crew_members?crew_id=eq.<crew>&user_id=eq.<the reader>` | nothing, 204 |
  | `removeMember(crewId, userId)` | `DELETE /rest/v1/crew_members?crew_id=eq.<crew>&user_id=eq.<member>` | nothing, 204 |
  | `deleteCrew(crewId)` | `DELETE /rest/v1/crews?id=eq.<crew>` | nothing, 204; the memberships go with the crew |

  Create and join are section 1's first taps that need a user: with no
  session each mints one first, and one that then fails keeps the user it
  minted, as the email step does - the plan is untouched. The names are
  checked before any request, trimmed, as the tables' checks have them: a
  crew's 1 to 40 characters and a display name 1 to 24, counted by code
  point as Postgres's `char_length` counts them - forty emoji are a name.
  Postgres's `btrim` trims spaces alone, and the client trims all white
  space, so what it sends the checks hold.
- **Refused in the client:** the creator's leave, and the creator removing
  themselves, which is a leave; the creator's actions asked by anyone
  else; and an action on a crew the phone does not hold, whose creator it
  cannot know. The client's refusal is a courtesy - it says why before a
  request is spent - and the policy is the wall: a stale list sends the
  request, and the server refuses it or deletes nothing. The creator's
  leave is the one exception, since the policies allow it: there the
  client's refusal is #56's rule, and the only check. A delete
  row-level security turns away answers 204 as one that deletes a row
  does, so the answer cannot tell the two apart; the refusals keep a
  reader from meeting that silence.
- **The words,** `crewMessage()`, which falls back to identity's
  `plainMessage()` for the rest - offline, signing in, the session:

  | Failure | Status | Words |
  |---|---|---|
  | `P0002`, no crew has that invite | 500 | That invite doesn't work any more - ask for a new link. |
  | `53400`, the crew is full | 500 | That crew is full. |
  | `42501` from `regenerate_invite`, and the client's own refusal | 403, or none | Only the crew's creator can do that. |
  | a crew's name out of bounds | none | A crew's name is 1 to 40 characters. |
  | a display name out of bounds | none | Your name in the crew is 1 to 24 characters. |
  | a link from another year | none | That invite is for another year's con - ask for a new link. |
  | not an invite | none | That doesn't look like an invite link. |
  | the creator leaving | none | You made this crew, so you can't leave it - you can delete it instead. |
  | a crew the phone no longer holds, since PR #77 | none | That crew isn't on this phone any more - it may have been deleted. |

  `22023` and `23514`, both 400, reach no reader: the year is the
  build's, and the names are checked first.
- **The link.** `inviteLink(crew)` is the page's address with
  `?join=<year>.<token>` for its query - a query, like `?now=`, and the
  year in it, so that a build of another year refuses the link before any
  request. It is built by `new URL("?join=<year>.<token>",
  location.href)`: #15's rule, which the lint holds, forbids deciding by
  the address, and this reads the address only to point the link back at
  the site the sharer is on, so it is no way round that rule. The sharer's
  `?now=` and hash stay behind. `readJoinLink()`, which `boot()` calls
  beside `initTimeOverride()`, reads the parameter, takes it out of the
  address by `replaceState` - `?now=` and the hash left as they were - and
  keeps the invite under `storageKey("join")`, in session storage, until a
  screen takes it: `pendingJoin()` and `takePendingJoin()`, so that a
  reload before the join lands does not lose it. The address wins over
  what the session kept. With no backend the parameter goes and nothing is
  kept: the 2026 app knows no crews. Nothing here joins; a screen does.
  `readInvite()` reads an invite from the kept `<year>.<token>` or from a
  pasted link, for a home-screen app a tapped link never reaches (Open) -
  since PR #77 the last `join=` in what is pasted, since the message a
  share sends names the crew before its link, and a name cannot stand in
  for the link.
  Offline, the worker serves a page load with a query from its cache; it
  keeps each page it fetched under the address it was asked for, so an
  invite's address stays in the phone's cache, as a `?now=` address does,
  until the worker's cache is replaced. The address is rebuilt whole, its
  query replaced, rather than from its path, since a path that begins
  `//` would read as another host and the rewrite would throw at boot.
- **The readers,** pure reads of the two keys, for the two surfaces:
  - `goingTo(eventId)`: the crewmates, in any of the reader's crews, whose
    picks hold the event - `{user_id, display_name}`, a person once, the
    name from the first crew in the list that holds them, ordered by name.
    Never the reader, whose star already says they are going.
  - `crewmatesByEvent()`: the overlay's map, a `Map` from event id to the
    same list, for every event a crewmate starred.
  - `isCreator(crew)`, and `myCrews()`, the list as kept: `[{id, name,
    creator, invite_token, members}]`.
  - Since PR #77, for the crew's day and the crew panel:
    `crewmatePicks(userId)`, one crewmate's stars as the pull kept them,
    none for the reader; and `myMembership(crew)`, the reader's own row in
    a crew, `{user_id, display_name}`, or null.

  Since PR #77 `applyPulledCrews()` says whether anything a crew screen
  draws changed - the members compared by id, the stars alone - and
  `forgetCrews()` whether anything was kept, for the pull's redraw
  (section 5, as built).

  The crews read gains `invite_token`, which any member may read by policy,
  so that every member's phone can share the link; and it is ordered,
  `created_at` and then id, the oldest first, since an update moves a row
  in an unordered read - a rotation did, on the CLI's local stack - and
  the first crew would move with it.
- **The tests.** `tests/page/crews.test.js`: each action pinned as it is
  sent, with nothing kept on the phone; create and join minting with no
  session, and not with one; every failure in its words, with what it sent
  and nothing kept; the link read, taken out of the address, kept and
  taken, across a reload and over a kept one, another year's refused, and
  nothing kept with no backend; `readInvite()`; the readers - the union
  across two crews, a person once, the first crew's name, a departed member
  gone, a crewmate who leaves one of two crews, nothing with no crews - and
  `joinCrew()` then `runSync()` bringing the new crew's picks whole,
  older than the watermark. `tests/page/sync-pull.test.js` pins the crews
  read. The fake, `tests/helpers/backend.js`, answers the three RPCs and
  the two deletes as the policies judge them; a scenario of the crews'
  requests, replayed against the CLI's local stack - PostgREST 14.5 - and
  against the fake, got the same status and body from each, but for an
  error's `details`, which the client never reads. A mutation pass over
  `crews.js` is not committed. No pgTAP: the schema did not change.

## Open

- ~~How stale an anonymous user must be before the cleanup deletes it
  (section 2).~~ The operations track's, with the cleanup, which is not
  built: its next pull request (ROADMAP, tentpole 4).
- ~~Starts-soon's lead time: one value, set in the push job's call (#40,
  #50); how many minutes is unset.~~ 15 minutes, one constant in
  `push_due()` (#55; section 7).
- Recording searches that return nothing, anonymously, in 2027: #36's
  privacy question for this tentpole.
- A push's acks chunked, and its `event_ids` bounded, so that a push of
  more than some 70 to 100 events can be sent and acked (section 7, The
  batch, as built, Known limits): a follow-up, not built.
- ~~The Auth project's two limits. The built-in mailer sends only to the
  organisation's own addresses, a few an hour; custom email is not the
  operations track's but the six-digit code's prerequisite (#25's note;
  ROADMAP, Checklist). And anonymous sign-ins are capped at 30 an hour per
  IP by default, while a hotel's Wi-Fi puts many phones behind one
  address: for the operations track (#50).~~ The operations track's:
  production's sender domain and its limit on anonymous sign-ins
  (ROADMAP, tentpole 4).
- An invite link tapped on an iPhone opens the browser, not the
  home-screen app, whose storage is its own, so an installed reader who
  taps one joins as the browser's user. The join step has had a field to
  paste the link into since PR #77 - `readInvite()` reads it (section 8,
  as built) - and a link pasted there joins the home-screen app's own
  user, another member, since an invite serves anyone until it is
  renewed. The behaviour is to be confirmed on a phone - PR #77's hand
  test - with Delivery's install flow (ROADMAP).
