-- The five job tables are the jobs' alone: to a signed-in user they are refused,
-- 42501, since no grant reaches authenticated - not merely empty (contract,
-- section 2). anon's refusal is 01_anon.test.sql's.
begin;
select plan(7);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email) values ('a0000000-0000-4000-a000-000000000006', 'ada.6@example.test');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000006');
select throws_ok($$ select * from public.schedule_events $$, '42501', null, 'signed in: schedule_events refused');
select throws_ok($$ select * from public.schedule_changes $$, '42501', null, 'signed in: schedule_changes refused');
select throws_ok($$ select * from public.push_sent $$, '42501', null, 'signed in: push_sent refused');
select throws_ok($$ select * from public.mirror_state $$, '42501', null, 'signed in: mirror_state refused');
select throws_ok($$ select * from public.flags $$, '42501', null, 'signed in: flags refused');
select throws_ok(
  $$ update public.flags set value = 'true' where name = 'push_enabled' $$,
  '42501', null, 'signed in: the kill switch cannot be touched');
select throws_ok(
  $$ insert into public.push_sent (user_id, year, kind, key)
     values ('a0000000-0000-4000-a000-000000000006', 2026, 'pick-changed', 'e1') $$,
  '42501', null, 'signed in: the push ledger cannot be written');

reset role;
select * from finish();
rollback;
