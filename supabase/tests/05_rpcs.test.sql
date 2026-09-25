-- The three RPCs (contract, section 3): create_crew makes the crew and its
-- creator's membership; join_crew takes a token, refuses an unknown one and a
-- full crew, and is idempotent for a member; regenerate_invite is the
-- creator's alone and retires the old token. Each refuses a caller who is not
-- signed in.
begin;
select plan(17);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
-- What an RPC returned, kept for the next statements: the crew as JSON.
create function pg_temp.crew() returns jsonb language sql as $$
  select current_setting('test.crew')::jsonb
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000005', 'ada.5@example.test'),
  ('b0000000-0000-4000-a000-000000000005', 'bo.5@example.test'),
  ('c0000000-0000-4000-a000-000000000005', 'cy.5@example.test');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000005');
select set_config('test.crew', row_to_json(c)::text, true) from public.create_crew(2026, '  The Crew  ', ' Ada ') c;
select results_eq(
  $$ select pg_temp.crew() ->> 'name', pg_temp.crew() ->> 'creator', (pg_temp.crew() ->> 'year')::int $$,
  $$ values ('The Crew'::text, 'a0000000-0000-4000-a000-000000000005'::text, 2026) $$,
  'create_crew returns the crew: its name trimmed, the caller its creator');
select matches(pg_temp.crew() ->> 'invite_token', '^[A-Za-z0-9_-]{22}$', 'its invite is 22 url-safe characters');
select throws_ok($$ select public.create_crew(2025, 'Too early', 'Ada') $$, '22023', null, 'create_crew refuses a year before 2026');
select throws_ok($$ select public.create_crew(2026, '   ', 'Ada') $$, '23514', null, 'create_crew refuses an empty name');
select throws_ok($$ select public.create_crew(2026, 'A crew', repeat('x', 25)) $$, '23514', null, 'create_crew refuses a display name over 24');

reset role;
select results_eq(
  format($$ select user_id, display_name from public.crew_members where crew_id = %L $$, pg_temp.crew() ->> 'id'),
  $$ values ('a0000000-0000-4000-a000-000000000005'::uuid, 'Ada'::text) $$,
  'create_crew leaves the creator a member, the display name trimmed');

select pg_temp.as_user('b0000000-0000-4000-a000-000000000005');
select throws_ok($$ select public.join_crew('no-such-invite', 'Bo') $$, 'P0002', null, 'join_crew refuses an unknown token');
select is(
  (select c.id::text from public.join_crew(pg_temp.crew() ->> 'invite_token', ' Bo ') c),
  pg_temp.crew() ->> 'id', 'join_crew returns the crew the token names');
select is(
  (select c.id::text from public.join_crew(pg_temp.crew() ->> 'invite_token', 'Someone else') c),
  pg_temp.crew() ->> 'id', 'twice for one user, the same crew');

reset role;
select results_eq(
  format($$ select user_id, display_name from public.crew_members where crew_id = %L order by 1 $$, pg_temp.crew() ->> 'id'),
  $$ values ('a0000000-0000-4000-a000-000000000005'::uuid, 'Ada'::text),
            ('b0000000-0000-4000-a000-000000000005', 'Bo') $$,
  'and the second call changes nothing: one membership, its first display name');

update public.flags set value = '2' where name = 'crew_size_cap';
select pg_temp.as_user('c0000000-0000-4000-a000-000000000005');
select throws_ok(
  format($$ select public.join_crew(%L, 'Cy') $$, pg_temp.crew() ->> 'invite_token'),
  '53400', null, 'join_crew refuses a crew at crew_size_cap');

select pg_temp.as_user('b0000000-0000-4000-a000-000000000005');
select throws_ok(
  format($$ select public.regenerate_invite(%L) $$, pg_temp.crew() ->> 'id'),
  '42501', null, 'regenerate_invite is not a member''s: the creator''s alone');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000005');
select set_config('test.token', public.regenerate_invite((pg_temp.crew() ->> 'id')::uuid), true);
select isnt(current_setting('test.token'), pg_temp.crew() ->> 'invite_token', 'regenerate_invite gives the creator a new token');
select matches(current_setting('test.token'), '^[A-Za-z0-9_-]{22}$', 'as url-safe as the first');

reset role;
update public.flags set value = '25' where name = 'crew_size_cap';
select pg_temp.as_user('c0000000-0000-4000-a000-000000000005');
select throws_ok(
  format($$ select public.join_crew(%L, 'Cy') $$, pg_temp.crew() ->> 'invite_token'),
  'P0002', null, 'the old token joins nothing');
select is(
  (select c.id::text from public.join_crew(current_setting('test.token'), 'Cy') c),
  pg_temp.crew() ->> 'id', 'the new one joins the crew');

-- Signed in as a role, with no user in the claims.
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok($$ select public.create_crew(2026, 'Nobody''s', 'Nobody') $$, '42501', null, 'with no user, create_crew refuses');

reset role;
select * from finish();
rollback;
