-- The structure the policies stand on (DECISIONS #52; docs/sync/contract.md,
-- sections 2-4): row-level security on every table, the flags seeded, and the
-- whole list of what anon and authenticated may reach - which every later
-- migration grants into by name. Functions that belong to an extension (pgTAP's
-- among them) are left out of the lists.
begin;
select plan(9);

select is(
  (select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
  10, 'public holds the ten tables');
select is(
  (select count(*)::int from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity),
  10, 'row-level security is on for all ten');
select results_eq(
  $$ select name, value from public.flags order by name $$,
  $$ values ('crew_size_cap'::text, '25'::jsonb), ('push_enabled', 'false') $$,
  'the migration seeds flags: the cap 25, the kill switch off');
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm')
       and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger') $$,
  'anon holds no privilege on any table');
select results_eq(
  $$ select c.relname::text collate "default" from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
       and has_table_privilege('authenticated', c.oid, 'select') order by 1 $$,
  $$ values ('crew_members'), ('crews'), ('follows'), ('picks'), ('push_subscriptions') $$,
  'authenticated reads the five client tables and none of the five job tables');
select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon executes no function in public');
select results_eq(
  $$ select p.proname::text collate "default" from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('authenticated', p.oid, 'execute') order by 1 $$,
  $$ values ('create_crew'), ('is_crew_member'), ('join_crew'), ('regenerate_invite'), ('shares_crew_with') $$,
  'authenticated executes the two helpers and the three RPCs, and nothing else in public');
select results_eq(
  $$ select t.tgname::text collate "default" from pg_trigger t
     where t.tgrelid in ('public.picks'::regclass, 'public.follows'::regclass) and not t.tgisinternal order by 1 $$,
  $$ values ('follows_1_clamp'), ('follows_2_latest_wins'), ('picks_1_clamp'), ('picks_2_latest_wins') $$,
  'picks and follows each carry the clamp, then latest-wins, in that order by name');

-- A later migration's table reaches neither role until it grants by name.
create table public.probe (x integer);
select ok(
  not has_table_privilege('anon', 'public.probe', 'select')
  and not has_table_privilege('authenticated', 'public.probe', 'select'),
  'a new table in public grants nothing to anon or authenticated by default');

select * from finish();
rollback;
