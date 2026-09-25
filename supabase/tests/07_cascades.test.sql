-- What the cleanup of stale anonymous users will rely on (contract, section 2):
-- deleting a user takes their picks, follows, memberships, subscriptions and
-- push ledger with them; a crew outlives its creator, set null, whose actions
-- then lapse, and its members can still leave.
begin;
select plan(9);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, is_anonymous) values
  ('a0000000-0000-4000-a000-000000000007', null, true),
  ('b0000000-0000-4000-a000-000000000007', 'bo.7@example.test', false);
insert into public.crews (id, year, name, creator) values
  ('c1000000-0000-4000-b000-000000000007', 2026, 'Left behind', 'a0000000-0000-4000-a000-000000000007');
insert into public.crew_members (crew_id, user_id, display_name) values
  ('c1000000-0000-4000-b000-000000000007', 'a0000000-0000-4000-a000-000000000007', 'Ada'),
  ('c1000000-0000-4000-b000-000000000007', 'b0000000-0000-4000-a000-000000000007', 'Bo');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000007', 2026, 'e1', true, now());
insert into public.follows (user_id, year, kind, key, followed, changed_at) values
  ('a0000000-0000-4000-a000-000000000007', 2026, 'track', 'Animation', true, now());
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/ada-7', 'a0000000-0000-4000-a000-000000000007', 'key', 'secret');
insert into public.push_sent (user_id, year, kind, key) values
  ('a0000000-0000-4000-a000-000000000007', 2026, 'starts-soon', 'e1');

delete from auth.users where id = 'a0000000-0000-4000-a000-000000000007';

select is((select count(*)::int from public.picks where user_id = 'a0000000-0000-4000-a000-000000000007'),
  0, 'a deleted user''s picks go with them');
select is((select count(*)::int from public.follows where user_id = 'a0000000-0000-4000-a000-000000000007'),
  0, 'their follows');
select is((select count(*)::int from public.push_subscriptions where user_id = 'a0000000-0000-4000-a000-000000000007'),
  0, 'their subscriptions');
select is((select count(*)::int from public.push_sent where user_id = 'a0000000-0000-4000-a000-000000000007'),
  0, 'their push ledger');
select results_eq(
  $$ select user_id from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000007' $$,
  $$ values ('b0000000-0000-4000-a000-000000000007'::uuid) $$,
  'their memberships, and no one else''s');
select results_eq(
  $$ select name, creator from public.crews where id = 'c1000000-0000-4000-b000-000000000007' $$,
  $$ values ('Left behind'::text, null::uuid) $$,
  'the crew outlives its creator, the creator set null');

select pg_temp.as_user('b0000000-0000-4000-a000-000000000007');
select throws_ok(
  $$ select public.regenerate_invite('c1000000-0000-4000-b000-000000000007') $$,
  '42501', null, 'with the creator gone, no one can regenerate the invite');
update public.crews set name = 'Ours now' where id = 'c1000000-0000-4000-b000-000000000007';
delete from public.crew_members
  where crew_id = 'c1000000-0000-4000-b000-000000000007' and user_id = 'b0000000-0000-4000-a000-000000000007';

reset role;
select is((select name from public.crews where id = 'c1000000-0000-4000-b000-000000000007'),
  'Left behind', 'or rename the crew');
select is((select count(*)::int from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000007'),
  0, 'and its members can still leave');

select * from finish();
rollback;
