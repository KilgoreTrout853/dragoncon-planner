-- As a crew member: crewmates' picks of the crew's year are read, their follows
-- never; the member list reads with no recursion; a member edits their own
-- display name and leaves, and the creator renames, removes and deletes
-- (contract, sections 2 and 3).
begin;
select plan(19);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- a3: the creator; b3 and d3: members; c3: in another crew.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000003', 'ada.3@example.test'),
  ('b0000000-0000-4000-a000-000000000003', 'bo.3@example.test'),
  ('c0000000-0000-4000-a000-000000000003', 'cy.3@example.test'),
  ('d0000000-0000-4000-a000-000000000003', 'di.3@example.test');
insert into public.crews (id, year, name, creator) values
  ('c1000000-0000-4000-b000-000000000003', 2026, 'Our crew', 'a0000000-0000-4000-a000-000000000003'),
  ('c2000000-0000-4000-b000-000000000003', 2026, 'Another crew', 'c0000000-0000-4000-a000-000000000003');
insert into public.crew_members (crew_id, user_id, display_name) values
  ('c1000000-0000-4000-b000-000000000003', 'a0000000-0000-4000-a000-000000000003', 'Ada'),
  ('c1000000-0000-4000-b000-000000000003', 'b0000000-0000-4000-a000-000000000003', 'Bo'),
  ('c1000000-0000-4000-b000-000000000003', 'd0000000-0000-4000-a000-000000000003', 'Di'),
  ('c2000000-0000-4000-b000-000000000003', 'c0000000-0000-4000-a000-000000000003', 'Cy');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000003', 2026, 'e1', true, now() - interval '1 hour'),
  ('a0000000-0000-4000-a000-000000000003', 2027, 'e9', true, now() - interval '1 hour'),
  ('b0000000-0000-4000-a000-000000000003', 2026, 'e2', true, now() - interval '1 hour'),
  ('c0000000-0000-4000-a000-000000000003', 2026, 'e3', true, now() - interval '1 hour');
insert into public.follows (user_id, year, kind, key, followed, changed_at) values
  ('a0000000-0000-4000-a000-000000000003', 2026, 'track', 'Animation', true, now() - interval '1 hour'),
  ('b0000000-0000-4000-a000-000000000003', 2026, 'work', '12-monkeys', true, now() - interval '1 hour');

select pg_temp.as_user('b0000000-0000-4000-a000-000000000003');
select results_eq(
  $$ select user_id, event_id from public.picks order by 1, 2 $$,
  $$ values ('a0000000-0000-4000-a000-000000000003'::uuid, 'e1'::text),
            ('b0000000-0000-4000-a000-000000000003', 'e2') $$,
  'a member reads their own picks and a crewmate''s of the crew''s year, not another year''s or another crew''s');
select results_eq(
  $$ select user_id, key from public.follows $$,
  $$ values ('b0000000-0000-4000-a000-000000000003'::uuid, '12-monkeys'::text) $$,
  'a member reads their own follows and never a crewmate''s');
select lives_ok($$ select * from public.crew_members $$, 'the member list reads with no recursion');
select results_eq(
  $$ select user_id from public.crew_members order by 1 $$,
  $$ values ('a0000000-0000-4000-a000-000000000003'::uuid), ('b0000000-0000-4000-a000-000000000003'),
            ('d0000000-0000-4000-a000-000000000003') $$,
  'a member reads their own crew''s members and no other crew''s');
select results_eq(
  $$ select id from public.crews $$,
  $$ values ('c1000000-0000-4000-b000-000000000003'::uuid) $$,
  'a member reads their own crew and no other');
select ok(public.is_crew_member('c1000000-0000-4000-b000-000000000003'), 'is_crew_member: yes for their crew');
select ok(not public.is_crew_member('c2000000-0000-4000-b000-000000000003'), 'is_crew_member: no for another');
select ok(public.shares_crew_with('a0000000-0000-4000-a000-000000000003', 2026), 'shares_crew_with: yes for the crew''s year');
select ok(not public.shares_crew_with('a0000000-0000-4000-a000-000000000003', 2027), 'shares_crew_with: no for another year');
select throws_ok(
  $$ update public.crew_members set user_id = 'c0000000-0000-4000-a000-000000000003'
     where user_id = 'b0000000-0000-4000-a000-000000000003' $$,
  '42501', null, 'a member cannot hand a membership to someone else: only the display name is theirs to change');

update public.crew_members set display_name = 'Bobby'
  where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'b0000000-0000-4000-a000-000000000003';
update public.crew_members set display_name = 'Nope'
  where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'a0000000-0000-4000-a000-000000000003';
update public.crews set name = 'Renamed by Bo' where id = 'c1000000-0000-4000-b000-000000000003';
delete from public.crew_members
  where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'd0000000-0000-4000-a000-000000000003';

reset role;
select is(
  (select display_name from public.crew_members
   where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'b0000000-0000-4000-a000-000000000003'),
  'Bobby', 'a member edits their own display name');
select is(
  (select display_name from public.crew_members
   where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'a0000000-0000-4000-a000-000000000003'),
  'Ada', 'a member cannot edit a crewmate''s display name');
select is(
  (select name from public.crews where id = 'c1000000-0000-4000-b000-000000000003'),
  'Our crew', 'a member who is not the creator cannot rename the crew');
select ok(
  exists (select 1 from public.crew_members
          where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'd0000000-0000-4000-a000-000000000003'),
  'a member who is not the creator cannot remove a crewmate');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000003');
delete from public.crew_members
  where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'd0000000-0000-4000-a000-000000000003';
update public.crews set name = 'Renamed' where id = 'c1000000-0000-4000-b000-000000000003';
reset role;
select ok(
  not exists (select 1 from public.crew_members
              where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'd0000000-0000-4000-a000-000000000003'),
  'the creator removes a member');
select is(
  (select name from public.crews where id = 'c1000000-0000-4000-b000-000000000003'),
  'Renamed', 'the creator renames the crew');

select pg_temp.as_user('b0000000-0000-4000-a000-000000000003');
delete from public.crew_members
  where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'b0000000-0000-4000-a000-000000000003';
reset role;
select ok(
  not exists (select 1 from public.crew_members
              where crew_id = 'c1000000-0000-4000-b000-000000000003' and user_id = 'b0000000-0000-4000-a000-000000000003'),
  'a member leaves');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000003');
delete from public.crews where id = 'c1000000-0000-4000-b000-000000000003';
reset role;
select ok(
  not exists (select 1 from public.crews where id = 'c1000000-0000-4000-b000-000000000003'),
  'the creator deletes the crew');
select is(
  (select count(*)::int from public.crew_members where crew_id = 'c1000000-0000-4000-b000-000000000003'),
  0, 'and its memberships go with it');

select * from finish();
rollback;
