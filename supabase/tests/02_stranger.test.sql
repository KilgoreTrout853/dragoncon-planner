-- As a signed-in stranger: in no crew with anyone here, so row-level security
-- leaves every other reader's rows out - empty, not refused, since the grants
-- exist - and every write to them touches nothing (contract, section 3).
begin;
select plan(13);

-- Who acts next: a signed-in user, by the claims of their session.
create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000002', 'ada.2@example.test'),
  ('b0000000-0000-4000-a000-000000000002', 'bo.2@example.test'),
  ('e0000000-0000-4000-a000-000000000002', 'stranger.2@example.test');
insert into public.crews (id, year, name, creator) values
  ('c1000000-0000-4000-b000-000000000002', 2026, 'Their crew', 'a0000000-0000-4000-a000-000000000002');
insert into public.crew_members (crew_id, user_id, display_name) values
  ('c1000000-0000-4000-b000-000000000002', 'a0000000-0000-4000-a000-000000000002', 'Ada'),
  ('c1000000-0000-4000-b000-000000000002', 'b0000000-0000-4000-a000-000000000002', 'Bo');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000002', 2026, 'e1', true, now() - interval '1 hour'),
  ('b0000000-0000-4000-a000-000000000002', 2026, 'e2', true, now() - interval '1 hour');
insert into public.follows (user_id, year, kind, key, followed, changed_at) values
  ('a0000000-0000-4000-a000-000000000002', 2026, 'track', 'Animation', true, now() - interval '1 hour');
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/ada-2', 'a0000000-0000-4000-a000-000000000002', 'key', 'secret');

select pg_temp.as_user('e0000000-0000-4000-a000-000000000002');
select is_empty($$ select * from public.picks $$, 'a stranger reads no one''s picks');
select is_empty($$ select * from public.follows $$, 'a stranger reads no one''s follows');
select is_empty($$ select * from public.crews $$, 'a stranger reads no crew');
select is_empty($$ select * from public.crew_members $$, 'a stranger reads no crew''s members');
select is_empty($$ select * from public.push_subscriptions $$, 'a stranger reads no one''s subscriptions');
select ok(not public.is_crew_member('c1000000-0000-4000-b000-000000000002'), 'a stranger is no member');
select ok(not public.shares_crew_with('a0000000-0000-4000-a000-000000000002', 2026), 'a stranger shares no crew');
select throws_ok(
  $$ select public.regenerate_invite('c1000000-0000-4000-b000-000000000002') $$,
  '42501', null, 'a stranger cannot regenerate a crew''s invite');
select throws_ok(
  $$ insert into public.picks values ('a0000000-0000-4000-a000-000000000002', 2026, 'e9', true, now()) $$,
  '42501', null, 'a stranger cannot write a pick for someone else');

update public.picks set picked = false, changed_at = now() where user_id = 'a0000000-0000-4000-a000-000000000002';
delete from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000002';
update public.crews set name = 'Mine now' where id = 'c1000000-0000-4000-b000-000000000002';
delete from public.crews where id = 'c1000000-0000-4000-b000-000000000002';

reset role;
select is(
  (select picked from public.picks where user_id = 'a0000000-0000-4000-a000-000000000002' and event_id = 'e1'),
  true, 'a stranger''s update of someone''s pick touches nothing');
select is(
  (select count(*)::int from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000002'),
  2, 'a stranger removes no one from a crew');
select is(
  (select name from public.crews where id = 'c1000000-0000-4000-b000-000000000002'),
  'Their crew', 'a stranger cannot rename a crew');
select ok(
  exists (select 1 from public.crews where id = 'c1000000-0000-4000-b000-000000000002'),
  'a stranger cannot delete a crew');

select * from finish();
rollback;
