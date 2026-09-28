-- The push job's spine (DECISIONS #55; docs/sync/contract.md, section 7): the two extensions, the two cron
-- jobs - the push gated by the kill switch, the history cleanup not - the grants, and push_due(): the switch,
-- the window's edges, what is never due, the endpoints, the claim, dry, a stale claim released and a sent one
-- kept, and `at`. Ada has two browsers; Bo's pick is another year's; Cy has no browser. The picks start at
-- 15:00 UTC on 2027-09-03, one an hour later.
begin;
select plan(37);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000010', 'ada.10@example.test'),
  ('b0000000-0000-4000-a000-000000000010', 'bo.10@example.test'),
  ('c0000000-0000-4000-a000-000000000010', 'cy.10@example.test');

insert into public.schedule_events (year, id, title, start, "end", hotel, room, removed, cancelled) values
  (2027, 'e-due',       'Due Panel',       '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V', false, false),
  (2027, 'e-also',      'Also Panel',      '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Marriott', null, false, false),
  (2027, 'e-later',     'Later Panel',     '2027-09-03 16:00+00', '2027-09-03 17:00+00', 'Hilton', 'Grand', false, false),
  (2027, 'e-removed',   'Removed Panel',   '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VI', true, false),
  (2027, 'e-cancelled', 'Cancelled Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VII', false, true),
  (2027, 'e-nostart',   'Unscheduled',     null, null, 'Hyatt', null, false, false),
  (2027, 'e-unpicked',  'Unpicked Panel',  '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Embassy', false, false);

insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-due', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-also', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-later', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-removed', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-cancelled', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-nostart', true, now()),
  ('a0000000-0000-4000-a000-000000000010', 2027, 'e-unpicked', false, now()),
  ('b0000000-0000-4000-a000-000000000010', 2026, 'e-due', true, now()),
  ('c0000000-0000-4000-a000-000000000010', 2027, 'e-due', true, now());

insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/ada-2', 'a0000000-0000-4000-a000-000000000010', 'k2', 'a2'),
  ('https://push.example.test/ada-1', 'a0000000-0000-4000-a000-000000000010', 'k1', 'a1'),
  ('https://push.example.test/bo-1',  'b0000000-0000-4000-a000-000000000010', 'k3', 'a3');

-- The extensions and the two jobs ---------------------------------------------
select results_eq(
  $$ select extname::text collate "default", extnamespace::regnamespace::text collate "default"
     from pg_extension where extname in ('pg_cron', 'pg_net') order by 1 $$,
  $$ values ('pg_cron', 'pg_catalog'), ('pg_net', 'extensions') $$,
  'pg_cron is in pg_catalog and pg_net in extensions');
select results_eq(
  $$ select jobname::text collate "default", schedule::text collate "default", username::text collate "default", active
     from cron.job where jobname in ('push', 'cron-history') order by 1 $$,
  $$ values ('cron-history', '0 4 * * *', 'postgres', true), ('push', '* * * * *', 'postgres', true) $$,
  'two jobs: the push every minute, the history cleanup daily, both as postgres');
select ok(
  (select command like '%net.http_post(%'
      and command like '%where exists (select 1 from public.flags where name = ''push_enabled'' and value = ''true''::jsonb)%'
      and command like '%/functions/v1/push%'
      and command like '%''x-push-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''push_secret'')%'
      and command like '%(select decrypted_secret from vault.decrypted_secrets where name = ''project_url'')%'
      and command like '%timeout_milliseconds := 30000%'
   from cron.job where jobname = 'push'),
  'the push job posts to the function with the secret from Vault, only where the kill switch is on');
select ok(
  (select command like '%delete from cron.job_run_details where end_time < now() - interval ''7 days''%'
      and command not like '%push_enabled%'
   from cron.job where jobname = 'cron-history'),
  'the history cleanup keeps a week, switch or no switch');

-- The grants ------------------------------------------------------------------
select is_empty(
  $$ select t, p from (values
       ('public.push_sent', 'select'), ('public.push_sent', 'insert'), ('public.push_sent', 'update'),
       ('public.push_sent', 'delete'), ('public.push_subscriptions', 'select'), ('public.push_subscriptions', 'delete'),
       ('public.flags', 'select')) as g(t, p)
     where not has_table_privilege('service_role', t, p) $$,
  'service_role holds what the sender needs: push_sent, and a browser''s row to read and prune, and the switch to read');
select is_empty(
  $$ select t, p from (values
       ('public.push_subscriptions', 'insert'), ('public.push_subscriptions', 'update'),
       ('public.flags', 'insert'), ('public.flags', 'update'), ('public.flags', 'delete')) as g(t, p)
     where has_table_privilege('service_role', t, p) $$,
  'and no more: it adds no browser, and never flips the switch');
select ok(has_function_privilege('service_role', 'public.push_due(timestamptz, boolean)', 'execute'),
  'service_role executes push_due()');
select ok(
  not has_function_privilege('anon', 'public.push_due(timestamptz, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.push_due(timestamptz, boolean)', 'execute')
  and not exists (select 1 from aclexplode((select proacl from pg_proc
                                            where oid = 'public.push_due(timestamptz, boolean)'::regprocedure)) a
                  where a.grantee = 0),
  'no app role executes it, and nor does PUBLIC');
select ok(
  (select prosecdef and proconfig = array['search_path=public'] from pg_proc
   where oid = 'public.push_due(timestamptz, boolean)'::regprocedure),
  'push_due() is a security definer with its search path pinned');

-- The kill switch ---------------------------------------------------------------
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00') $$,
  'with the kill switch off, nothing is due');
select is((select count(*)::int from public.push_sent), 0, 'and nothing is claimed');

update public.flags set value = 'true' where name = 'push_enabled';

-- The window, by dry calls, which claim nothing ---------------------------------
select results_eq(
  $$ select event_id, minutes_until from public.push_due('2027-09-03 14:45+00', true) $$,
  $$ values ('e-also', 15), ('e-due', 15) $$,
  'due at start - 15 min, fifteen minutes out, a user''s picks by start and then title');
select is_empty($$ select * from public.push_due('2027-09-03 14:44+00', true) $$, 'not at start - 16 min');
select is_empty(
  $$ select * from public.push_due('2027-09-03 14:44:59+00', true) where event_id in ('e-due', 'e-also') $$,
  'nor a second before the fifteen minutes');
select is_empty($$ select * from public.push_due('2027-09-03 15:00+00', true) $$, 'not at start');
select is_empty($$ select * from public.push_due('2027-09-03 15:01+00', true) $$, 'not after it');
select results_eq(
  $$ select event_id, minutes_until from public.push_due('2027-09-03 14:49:30+00', true) $$,
  $$ values ('e-also', 11), ('e-due', 11) $$,
  'minutes_until counts a part minute as a minute: 10.5 is 11');
select results_eq(
  $$ select user_id, year, event_id, title, start, hotel, room, minutes_until
     from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-due' $$,
  $$ values ('a0000000-0000-4000-a000-000000000010'::uuid, 2027, 'e-due', 'Due Panel',
             '2027-09-03 15:00+00'::timestamptz, 'Hyatt', 'Regency V', 10) $$,
  'a due row: the user, the event''s year, id, title, start, hotel and room, and the minutes left');

-- What is never due -------------------------------------------------------------
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-removed' $$,
  'not an event the source removed');
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-cancelled' $$,
  'not a cancelled event');
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-nostart' $$,
  'not an event with no start');
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-unpicked' $$,
  'not a pick unstarred');
select is_empty(
  $$ select * from public.push_due('2027-09-03 14:50+00', true)
     where user_id = 'c0000000-0000-4000-a000-000000000010' $$,
  'not for a user with no browser');
select is_empty(
  $$ select * from public.push_due('2027-09-03 14:50+00', true)
     where user_id = 'b0000000-0000-4000-a000-000000000010' $$,
  'not for a pick of another year''s event of the same id');
select is((select endpoints from public.push_due('2027-09-03 14:50+00', true) where event_id = 'e-due'),
  '[{"endpoint": "https://push.example.test/ada-1", "p256dh": "k1", "auth": "a1"},
    {"endpoint": "https://push.example.test/ada-2", "p256dh": "k2", "auth": "a2"}]'::jsonb,
  'the endpoints: every browser of the user''s, by endpoint');
select is((select count(*)::int from public.push_sent), 0, 'dry claimed nothing');

-- The claim ----------------------------------------------------------------------
create temp table first_call as select * from public.push_due('2027-09-03 14:45+00');
select results_eq($$ select event_id from first_call $$, $$ values ('e-also'), ('e-due') $$,
  'a call returns what it claims');
select results_eq(
  $$ select user_id, year, kind, key, sent_at, claimed_at from public.push_sent order by key $$,
  $$ values ('a0000000-0000-4000-a000-000000000010'::uuid, 2027, 'starts-soon', 'e-also', null::timestamptz,
             '2027-09-03 14:45+00'::timestamptz),
            ('a0000000-0000-4000-a000-000000000010'::uuid, 2027, 'starts-soon', 'e-due', null::timestamptz,
             '2027-09-03 14:45+00'::timestamptz) $$,
  'a claim: the event''s year, starts-soon, the event id, unsent, claimed at `at`');
create temp table second_call as select * from public.push_due('2027-09-03 14:46+00');
select is((select count(*)::int from second_call), 0, 'a second call takes nothing already claimed');
select is_empty($$ select * from public.push_due('2027-09-03 14:46+00', true) $$,
  'and a dry call shows nothing held by a live claim');

-- A stale claim, released; a sent one, kept ---------------------------------------
update public.push_sent set sent_at = '2027-09-03 14:45:30+00' where key = 'e-due';
create temp table at_five as select * from public.push_due('2027-09-03 14:50+00');
select is((select count(*)::int from at_five), 0, 'a claim five minutes old still holds');
select results_eq($$ select event_id from public.push_due('2027-09-03 14:50:01+00', true) $$, $$ values ('e-also') $$,
  'past five minutes a dry call shows the unsent claim as due again');
select is((select claimed_at from public.push_sent where key = 'e-also'), '2027-09-03 14:45+00'::timestamptz,
  'and releases nothing');
create temp table past_five as select * from public.push_due('2027-09-03 14:50:01+00');
select results_eq($$ select event_id from past_five $$, $$ values ('e-also') $$,
  'a call past five minutes releases the stale claim and claims it again; the sent one stays sent');
select results_eq(
  $$ select key, sent_at, claimed_at from public.push_sent order by key $$,
  $$ values ('e-also', null::timestamptz, '2027-09-03 14:50:01+00'::timestamptz),
            ('e-due', '2027-09-03 14:45:30+00'::timestamptz, '2027-09-03 14:45+00'::timestamptz) $$,
  'the ledger: one claim made afresh, one sent');

-- `at` is now() unless named --------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2026, 'e-now', 'Soon Panel', now() + interval '10 minutes', now() + interval '70 minutes', 'Westin', 'Augusta');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000010', 2026, 'e-now', true, now());
create temp table no_args as select * from public.push_due();
select results_eq($$ select event_id, minutes_until from no_args $$, $$ values ('e-now', 10) $$,
  'with no arguments the clock is now(), and the call claims');

update public.flags set value = 'false' where name = 'push_enabled';
select is_empty($$ select * from public.push_due('2027-09-03 14:59+00', true) $$,
  'with the switch off again, nothing is due, dry or not');

select * from finish();
rollback;
