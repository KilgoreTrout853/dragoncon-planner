-- Delete my account (DECISIONS #93; contract, sections 1 and 3): the fourth
-- RPC deletes the caller and no one else. Their picks, follows, memberships,
-- subscriptions and push ledger go by the foreign keys (07_cascades), and the
-- function takes two things the keys do not: a crew the caller made that holds
-- no one else, any year, and the Auth server's audit rows that name the caller
-- as their actor. A crew with anyone else in it stays, its creator null. No
-- session is refused, anon cannot call it, and a caller whose user is already
-- gone gets the same answer. Who may execute it is 00_structure's list.
begin;
select plan(22);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.audit(actor uuid, username text, action text) returns void language sql as $$
  insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) values
    ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
     json_build_object('action', action, 'actor_id', actor, 'actor_username', username, 'log_type', 'account'),
     now(), '203.0.113.13');
$$;

insert into auth.users (id, email, is_anonymous) values
  ('a0000000-0000-4000-a000-000000000013', 'ada.13@example.test', false),
  ('b0000000-0000-4000-a000-000000000013', 'bo.13@example.test', false),
  ('c0000000-0000-4000-a000-000000000013', null, true);
insert into public.crews (id, year, name, creator) values
  ('c1000000-0000-4000-b000-000000000013', 2026, 'Shared',     'a0000000-0000-4000-a000-000000000013'),
  ('c2000000-0000-4000-b000-000000000013', 2026, 'Bo made it', 'b0000000-0000-4000-a000-000000000013'),
  ('c3000000-0000-4000-b000-000000000013', 2026, 'Alone',      'a0000000-0000-4000-a000-000000000013'),
  ('c4000000-0000-4000-b000-000000000013', 2027, 'Alone next year', 'a0000000-0000-4000-a000-000000000013'),
  ('c5000000-0000-4000-b000-000000000013', 2026, 'Left empty', 'a0000000-0000-4000-a000-000000000013'),
  ('c6000000-0000-4000-b000-000000000013', 2026, 'Cy alone',   'c0000000-0000-4000-a000-000000000013'),
  ('c7000000-0000-4000-b000-000000000013', 2026, 'Bo left it', 'b0000000-0000-4000-a000-000000000013'),
  ('c8000000-0000-4000-b000-000000000013', 2026, 'Bo emptied', 'b0000000-0000-4000-a000-000000000013');
insert into public.crew_members (crew_id, user_id, display_name) values
  ('c1000000-0000-4000-b000-000000000013', 'a0000000-0000-4000-a000-000000000013', 'Ada'),
  ('c1000000-0000-4000-b000-000000000013', 'b0000000-0000-4000-a000-000000000013', 'Bo'),
  ('c2000000-0000-4000-b000-000000000013', 'b0000000-0000-4000-a000-000000000013', 'Bo'),
  ('c2000000-0000-4000-b000-000000000013', 'a0000000-0000-4000-a000-000000000013', 'Ada'),
  ('c3000000-0000-4000-b000-000000000013', 'a0000000-0000-4000-a000-000000000013', 'Ada'),
  ('c4000000-0000-4000-b000-000000000013', 'a0000000-0000-4000-a000-000000000013', 'Ada'),
  ('c6000000-0000-4000-b000-000000000013', 'c0000000-0000-4000-a000-000000000013', 'Cy'),
  ('c7000000-0000-4000-b000-000000000013', 'a0000000-0000-4000-a000-000000000013', 'Ada');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000013', 2026, 'e1', true, now()),
  ('a0000000-0000-4000-a000-000000000013', 2026, 'e2', false, now()),
  ('b0000000-0000-4000-a000-000000000013', 2026, 'e1', true, now());
insert into public.follows (user_id, year, kind, key, followed, changed_at) values
  ('a0000000-0000-4000-a000-000000000013', 2026, 'track', 'Animation', true, now()),
  ('b0000000-0000-4000-a000-000000000013', 2026, 'track', 'Animation', true, now());
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/ada-13', 'a0000000-0000-4000-a000-000000000013', 'key', 'secret'),
  ('https://push.example.test/bo-13', 'b0000000-0000-4000-a000-000000000013', 'key', 'secret');
insert into public.push_sent (user_id, year, kind, key) values
  ('a0000000-0000-4000-a000-000000000013', 2026, 'starts-soon', 'e1'),
  ('b0000000-0000-4000-a000-000000000013', 2026, 'starts-soon', 'e1');
select pg_temp.audit('a0000000-0000-4000-a000-000000000013', '', 'user_modified');
select pg_temp.audit('a0000000-0000-4000-a000-000000000013', 'ada.13@example.test', 'login');
select pg_temp.audit('b0000000-0000-4000-a000-000000000013', 'bo.13@example.test', 'login');

select is(
  (select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'delete_my_account' and p.pronargs = 0),
  1, 'delete_my_account takes no argument: there is no id to pass');
select is(
  (select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'delete_my_account'),
  1, 'and has no other form');
select results_eq(
  $$ select p.prosecdef, p.proconfig::text collate "default" from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'delete_my_account' $$,
  $$ values (true, '{search_path=public}'::text) $$,
  'it is a security definer with its search path pinned');

-- Who may not call it, and that neither try deleted anyone.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
select throws_ok($$ select public.delete_my_account() $$, '42501', 'sign in first', 'no session is refused: sign in first');
select set_config('request.jwt.claims', '', true);
select set_config('role', 'anon', true);
select throws_ok($$ select public.delete_my_account() $$, '42501', 'permission denied for function delete_my_account',
  'anon cannot execute it');
reset role;
select is((select count(*)::int from auth.users where id::text like '%-000000000013'), 3, 'and neither try deleted anyone');

-- Ada deletes her account.
select pg_temp.as_user('a0000000-0000-4000-a000-000000000013');
select lives_ok($$ select public.delete_my_account() $$, 'a signed-in caller deletes their account');
reset role;

select results_eq(
  $$ select id from auth.users where id::text like '%-000000000013' order by 1 $$,
  $$ values ('b0000000-0000-4000-a000-000000000013'::uuid), ('c0000000-0000-4000-a000-000000000013') $$,
  'the caller''s user is gone, and no one else''s');
select results_eq(
  $$ select (select count(*)::int from public.picks where user_id = 'a0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.follows where user_id = 'a0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.crew_members where user_id = 'a0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.push_subscriptions where user_id = 'a0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.push_sent where user_id = 'a0000000-0000-4000-a000-000000000013') $$,
  $$ values (0, 0, 0, 0, 0) $$,
  'their picks, follows, memberships, subscriptions and push ledger go with them');
select results_eq(
  $$ select (select count(*)::int from public.picks where user_id = 'b0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.follows where user_id = 'b0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.push_subscriptions where user_id = 'b0000000-0000-4000-a000-000000000013'),
            (select count(*)::int from public.push_sent where user_id = 'b0000000-0000-4000-a000-000000000013') $$,
  $$ values (1, 1, 1, 1) $$,
  'another user''s stay');
select results_eq(
  $$ select c.name, c.creator from public.crews c where c.id = 'c1000000-0000-4000-b000-000000000013' $$,
  $$ values ('Shared'::text, null::uuid) $$,
  'a crew they made with someone else in it stays, with no creator');
select results_eq(
  $$ select user_id from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000013' $$,
  $$ values ('b0000000-0000-4000-a000-000000000013'::uuid) $$,
  'and keeps its other members');
select results_eq(
  $$ select c.creator, m.user_id from public.crews c join public.crew_members m on m.crew_id = c.id
     where c.id = 'c2000000-0000-4000-b000-000000000013' $$,
  $$ values ('b0000000-0000-4000-a000-000000000013'::uuid, 'b0000000-0000-4000-a000-000000000013'::uuid) $$,
  'a crew they joined keeps its creator and its others');
select is_empty(
  $$ select name from public.crews where id in ('c3000000-0000-4000-b000-000000000013', 'c4000000-0000-4000-b000-000000000013') $$,
  'a crew they made with no one else in it goes with them, another year''s too');
select is_empty(
  $$ select name from public.crews where id = 'c5000000-0000-4000-b000-000000000013' $$,
  'and one they made that holds no one at all');
select results_eq(
  $$ select c.creator, m.user_id from public.crews c join public.crew_members m on m.crew_id = c.id
     where c.id = 'c6000000-0000-4000-b000-000000000013' $$,
  $$ values ('c0000000-0000-4000-a000-000000000013'::uuid, 'c0000000-0000-4000-a000-000000000013'::uuid) $$,
  'someone else alone in their own crew is left alone');
select results_eq(
  $$ select c.name, (select count(*)::int from public.crew_members m where m.crew_id = c.id) from public.crews c
     where c.id in ('c7000000-0000-4000-b000-000000000013', 'c8000000-0000-4000-b000-000000000013') order by 1 $$,
  $$ values ('Bo emptied'::text, 0), ('Bo left it', 0) $$,
  'a crew someone else made stays though the caller was its last member, and so does one that held no one');
select is(
  (select count(*)::int from auth.audit_log_entries
   where payload::text like '%a0000000-0000-4000-a000-000000000013%' or payload::text like '%ada.13@example.test%'),
  0, 'the audit rows that name the caller as their actor are gone, the id and the email with them');
select is(
  (select count(*)::int from auth.audit_log_entries where payload ->> 'actor_id' = 'b0000000-0000-4000-a000-000000000013'),
  1, 'another user''s audit row is left');

-- A token that outlived its user: the same call, the same answer, nothing changed.
create temp table before_again as
  select (select count(*) from auth.users) as users, (select count(*) from public.crews) as crews,
         (select count(*) from public.crew_members) as members, (select count(*) from auth.audit_log_entries) as audit;
select pg_temp.as_user('a0000000-0000-4000-a000-000000000013');
select lives_ok($$ select public.delete_my_account() $$, 'a caller whose user is already gone gets no error');
reset role;
select results_eq(
  $$ select (select count(*) from auth.users), (select count(*) from public.crews),
            (select count(*) from public.crew_members), (select count(*) from auth.audit_log_entries) $$,
  $$ select users, crews, members, audit from before_again $$,
  'and the second call changes nothing');

-- Bo, whose crew Ada had joined, is still its creator in every sense.
select pg_temp.as_user('b0000000-0000-4000-a000-000000000013');
select lives_ok(
  $$ select public.regenerate_invite('c2000000-0000-4000-b000-000000000013') $$,
  'the crew they joined is still its creator''s to manage');

select * from finish();
rollback;
