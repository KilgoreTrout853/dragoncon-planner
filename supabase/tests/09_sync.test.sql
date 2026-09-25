-- Sync's migration (DECISIONS #53; docs/sync/contract.md, section 5): synced_at
-- is the server's, set on an insert and on an update latest-wins accepts and on
-- no other; user_id is the caller's by default; the upsert PostgREST sends, the
-- key columns in its SET, passes the grants and is still judged by its stamp;
-- no key ever moves, whatever the stamp; and a follow's stamp is clamped as a
-- pick's is, which 04_stamps leaves to the structure test.
begin;
select plan(25);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000009', 'ada.9@example.test'),
  ('b0000000-0000-4000-a000-000000000009', 'bo.9@example.test');

-- The test's own reads, made as postgres, which row-level security does not
-- narrow: this user's rows alone, whatever seed.sql holds. And what synced_at
-- was at each step.
create temp view ada_picks as
  select * from public.picks where user_id = 'a0000000-0000-4000-a000-000000000009';
create temp view ada_follows as
  select * from public.follows where user_id = 'a0000000-0000-4000-a000-000000000009';
create temp table seen (step text primary key, at timestamptz);

-- An insert with no user_id: the caller's, stamped by the server.
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
select lives_ok(
  $$ insert into public.picks (year, event_id, picked, changed_at) values (2026, 'e1', true, now() - interval '1 hour') $$,
  'a pick sent with no user_id is written');
reset role;
select is((select count(*)::int from ada_picks where event_id = 'e1'), 1, 'and it is the caller''s: user_id defaults to auth.uid()');
select ok((select synced_at from ada_picks where event_id = 'e1') >= now(), 'synced_at is set on insert, by the server');
insert into seen select 'insert', synced_at from ada_picks where event_id = 'e1';

-- The upsert as PostgREST writes it: every column of the payload in its SET.
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
select lives_ok(
  $$ insert into public.picks as p (year, event_id, picked, changed_at) values (2026, 'e1', false, now() - interval '30 minutes')
     on conflict (user_id, year, event_id) do update
     set year = excluded.year, event_id = excluded.event_id, picked = excluded.picked, changed_at = excluded.changed_at $$,
  'the upsert PostgREST sends, the key columns in its SET, passes the grants');
reset role;
select is((select picked from ada_picks where event_id = 'e1'), false, 'and its newer stamp applies');
select ok(
  (select synced_at from ada_picks where event_id = 'e1') > (select at from seen where step = 'insert'),
  'synced_at moves on an accepted update');
insert into seen select 'accepted', synced_at from ada_picks where event_id = 'e1';

-- An older stamp and an equal one: turned away, synced_at with them.
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
insert into public.picks as p (year, event_id, picked, changed_at) values (2026, 'e1', true, now() - interval '2 hours')
  on conflict (user_id, year, event_id) do update
  set year = excluded.year, event_id = excluded.event_id, picked = excluded.picked, changed_at = excluded.changed_at;
reset role;
select results_eq(
  $$ select picked, synced_at from ada_picks where event_id = 'e1' $$,
  $$ select false, at from seen where step = 'accepted' $$,
  'an older stamp changes nothing, synced_at included');
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
insert into public.picks as p (year, event_id, picked, changed_at) values (2026, 'e1', true, now() - interval '30 minutes')
  on conflict (user_id, year, event_id) do update
  set year = excluded.year, event_id = excluded.event_id, picked = excluded.picked, changed_at = excluded.changed_at;
reset role;
select results_eq(
  $$ select picked, synced_at from ada_picks where event_id = 'e1' $$,
  $$ select false, at from seen where step = 'accepted' $$,
  'an equal stamp, a replay, changes nothing, synced_at included');

-- synced_at is never the client's.
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
insert into public.picks (year, event_id, picked, changed_at, synced_at) values (2026, 'e2', true, now(), '2000-01-01');
reset role;
select ok((select synced_at from ada_picks where event_id = 'e2') >= now(), 'a synced_at the client sends is replaced by the server''s');
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
select throws_ok(
  $$ update public.picks set synced_at = '2000-01-01' where event_id = 'e2' $$,
  '42501', null, 'and the client has no update of it');

-- No key moves, even with a newer stamp - which latest-wins alone would let through.
select throws_ok(
  $$ update public.picks set event_id = 'e9', changed_at = now() + interval '1 minute' where event_id = 'e2' $$,
  '42501', null, 'a pick cannot move to another event, even with a newer stamp');
select throws_ok(
  $$ update public.picks set year = 2027, changed_at = now() + interval '1 minute' where event_id = 'e2' $$,
  '42501', null, 'nor to another year');
select throws_ok(
  $$ update public.picks set user_id = 'b0000000-0000-4000-a000-000000000009', changed_at = now() + interval '1 minute' where event_id = 'e2' $$,
  '42501', null, 'nor to another user');

-- Follows: the same, by kind and key.
select lives_ok(
  $$ insert into public.follows (year, kind, key, followed, changed_at) values (2026, 'track', 'Animation', true, now() - interval '1 hour') $$,
  'a follow sent with no user_id is written');
reset role;
select is((select count(*)::int from ada_follows where key = 'Animation'), 1, 'and it is the caller''s');
insert into seen select 'follow', synced_at from ada_follows where key = 'Animation';
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
select lives_ok(
  $$ insert into public.follows as f (year, kind, key, followed, changed_at) values (2026, 'track', 'Animation', false, now())
     on conflict (user_id, year, kind, key) do update
     set year = excluded.year, kind = excluded.kind, key = excluded.key, followed = excluded.followed, changed_at = excluded.changed_at $$,
  'the follows upsert, the key columns in its SET, passes the grants');
reset role;
select ok(
  (select not followed and synced_at > (select at from seen where step = 'follow') from ada_follows where key = 'Animation'),
  'and applies, moving synced_at');
select pg_temp.as_user('a0000000-0000-4000-a000-000000000009');
select throws_ok(
  $$ update public.follows set key = 'Anime', changed_at = now() + interval '1 minute' where key = 'Animation' $$,
  '42501', null, 'a follow cannot change its key, even with a newer stamp');
select throws_ok(
  $$ update public.follows set kind = 'work', changed_at = now() + interval '1 minute' where key = 'Animation' $$,
  '42501', null, 'nor its kind');

-- The follows clamp, which 04_stamps tests for a pick alone.
insert into public.follows (year, kind, key, followed, changed_at) values (2026, 'work', 'firefly', true, now() + interval '1 year');
select is(
  (select changed_at from public.follows where key = 'firefly'),
  now() + interval '5 minutes', 'a follow stamped a year ahead is clamped to the server''s time plus five minutes');
insert into public.follows as f (year, kind, key, followed, changed_at) values (2026, 'track', 'Animation', true, now() + interval '1 year')
  on conflict (user_id, year, kind, key) do update
  set year = excluded.year, kind = excluded.kind, key = excluded.key, followed = excluded.followed, changed_at = excluded.changed_at;
select results_eq(
  $$ select followed, changed_at from public.follows where key = 'Animation' $$,
  $$ values (true, now() + interval '5 minutes') $$,
  'and on an update: clamped, and newer, so it applies');
reset role;

-- The indexes the pull reads by, and none by changed_at.
select has_index('public', 'picks', 'picks_by_user_synced', array['user_id', 'synced_at'], 'picks are indexed by user and synced_at');
select has_index('public', 'follows', 'follows_by_user_synced', array['user_id', 'synced_at'], 'follows are indexed by user and synced_at');
select hasnt_index('public', 'picks', 'picks_by_user_changed', 'and picks no longer by user and changed_at');
select hasnt_index('public', 'follows', 'follows_by_user_changed', 'nor follows');

select * from finish();
rollback;
