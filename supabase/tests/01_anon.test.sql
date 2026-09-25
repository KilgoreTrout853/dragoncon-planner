-- As anon - a request with the public key and no session - every table and
-- every function is refused, 42501: no grant reaches the role, so nothing is
-- even filtered (contract, section 3: refused, not empty).
begin;
select plan(16);

set local role anon;
select throws_ok($$ select * from public.picks $$, '42501', null, 'anon: picks refused');
select throws_ok($$ select * from public.follows $$, '42501', null, 'anon: follows refused');
select throws_ok($$ select * from public.crews $$, '42501', null, 'anon: crews refused');
select throws_ok($$ select * from public.crew_members $$, '42501', null, 'anon: crew_members refused');
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'anon: push_subscriptions refused');
select throws_ok($$ select * from public.schedule_events $$, '42501', null, 'anon: schedule_events refused');
select throws_ok($$ select * from public.schedule_changes $$, '42501', null, 'anon: schedule_changes refused');
select throws_ok($$ select * from public.push_sent $$, '42501', null, 'anon: push_sent refused');
select throws_ok($$ select * from public.mirror_state $$, '42501', null, 'anon: mirror_state refused');
select throws_ok($$ select * from public.flags $$, '42501', null, 'anon: flags refused');
select throws_ok(
  $$ insert into public.picks values ('00000000-0000-4000-a000-00000000000a', 2026, 'e', true, now()) $$,
  '42501', null, 'anon: a pick cannot be written');
select throws_ok($$ select public.is_crew_member('00000000-0000-4000-b000-000000000001') $$,
  '42501', null, 'anon: is_crew_member refused');
select throws_ok($$ select public.shares_crew_with('00000000-0000-4000-a000-00000000000a', 2026) $$,
  '42501', null, 'anon: shares_crew_with refused');
select throws_ok($$ select public.create_crew(2026, 'A crew', 'Me') $$, '42501', null, 'anon: create_crew refused');
select throws_ok($$ select public.join_crew('local-crew-invite', 'Me') $$, '42501', null, 'anon: join_crew refused');
select throws_ok($$ select public.regenerate_invite('00000000-0000-4000-b000-000000000001') $$,
  '42501', null, 'anon: regenerate_invite refused');

reset role;
select * from finish();
rollback;
