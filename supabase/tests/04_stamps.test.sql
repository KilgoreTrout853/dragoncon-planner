-- Latest stamp wins, held by the triggers and not the client: an upsert with an
-- older or an equal stamp leaves the row as it was, a newer one applies, and a
-- stamp past the server's time plus five minutes is clamped to it. Own rows
-- only, no delete - an unstar is a tombstone - and no key column changes
-- (contract, section 2).
begin;
select plan(11);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000004', 'ada.4@example.test'),
  ('b0000000-0000-4000-a000-000000000004', 'bo.4@example.test');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000004');
select lives_ok(
  $$ insert into public.picks (user_id, year, event_id, picked, changed_at)
     values ('a0000000-0000-4000-a000-000000000004', 2026, 'e1', true, now() - interval '1 hour') $$,
  'a reader writes their own pick');

-- The client's upsert, as sync will send it.
insert into public.picks as p (user_id, year, event_id, picked, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'e1', false, now() - interval '2 hours')
  on conflict (user_id, year, event_id) do update set picked = excluded.picked, changed_at = excluded.changed_at;
select results_eq(
  $$ select picked, changed_at from public.picks where event_id = 'e1' $$,
  $$ values (true, now() - interval '1 hour') $$,
  'an older stamp leaves the row as it was');

insert into public.picks as p (user_id, year, event_id, picked, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'e1', false, now() - interval '1 hour')
  on conflict (user_id, year, event_id) do update set picked = excluded.picked, changed_at = excluded.changed_at;
select results_eq(
  $$ select picked, changed_at from public.picks where event_id = 'e1' $$,
  $$ values (true, now() - interval '1 hour') $$,
  'an equal stamp, a replayed operation, leaves the row as it was');

insert into public.picks as p (user_id, year, event_id, picked, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'e1', false, now() - interval '30 minutes')
  on conflict (user_id, year, event_id) do update set picked = excluded.picked, changed_at = excluded.changed_at;
select results_eq(
  $$ select picked, changed_at from public.picks where event_id = 'e1' $$,
  $$ values (false, now() - interval '30 minutes') $$,
  'a newer stamp applies: the unstar is a tombstone');

insert into public.picks (user_id, year, event_id, picked, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'e2', true, now() + interval '1 year');
select is(
  (select changed_at from public.picks where event_id = 'e2'),
  now() + interval '5 minutes', 'a stamp a year ahead is clamped to the server''s time plus five minutes');

insert into public.picks as p (user_id, year, event_id, picked, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'e1', true, now() + interval '1 year')
  on conflict (user_id, year, event_id) do update set picked = excluded.picked, changed_at = excluded.changed_at;
select results_eq(
  $$ select picked, changed_at from public.picks where event_id = 'e1' $$,
  $$ values (true, now() + interval '5 minutes') $$,
  'and on an update: clamped, and newer, so it applies');

insert into public.follows (user_id, year, kind, key, followed, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'track', 'Animation', true, now() - interval '1 hour');
insert into public.follows as f (user_id, year, kind, key, followed, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'track', 'Animation', false, now() - interval '2 hours')
  on conflict (user_id, year, kind, key) do update set followed = excluded.followed, changed_at = excluded.changed_at;
select is(
  (select followed from public.follows where key = 'Animation'), true, 'a follow: an older stamp leaves it');
insert into public.follows as f (user_id, year, kind, key, followed, changed_at)
  values ('a0000000-0000-4000-a000-000000000004', 2026, 'track', 'Animation', false, now())
  on conflict (user_id, year, kind, key) do update set followed = excluded.followed, changed_at = excluded.changed_at;
select is(
  (select followed from public.follows where key = 'Animation'), false, 'a follow: a newer stamp applies');

select throws_ok(
  $$ delete from public.picks where event_id = 'e2' $$,
  '42501', null, 'a pick is never deleted, even one''s own: an unstar is a tombstone');
select throws_ok(
  $$ update public.picks set event_id = 'e3' where event_id = 'e2' $$,
  '42501', null, 'a pick cannot move to another event');
select throws_ok(
  $$ insert into public.picks values ('b0000000-0000-4000-a000-000000000004', 2026, 'e1', true, now()) $$,
  '42501', null, 'a reader cannot write a pick for someone else');

reset role;
select * from finish();
rollback;
