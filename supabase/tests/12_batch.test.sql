-- The batch (DECISIONS #55; docs/sync/contract.md, section 7, The batch, as built): push_due() claims one batch - whole
-- pushes, starts-soon first, while their rows stay within 200, or the first push alone where it is more - so that a
-- call never claims a row PostgREST's answer of at most 1,000 would leave out. 201 one-row pushes: 200 claimed and
-- returned, dry the same batch, the 201st by the next call; a two-row push that would take the batch past 200 waits
-- whole, and so does every push after it; a first push of 201 rows taken whole; the order that decides who waits,
-- across the kinds and within each, a push one year's; the order a call returns; a stale claim released first, every
-- call, and claimed again inside the batch; a held key - sent, or claimed exactly five minutes before - taking no
-- place in it; a key another run claims between this call's read and its insert, skipped and not returned; the stale
-- release made with the switch off too; and the id last inside a push. Users 0-202 have one browser each; `at` is
-- 14:50 UTC on 2027-09-03, the picks start at 15:00 and the runs are at 13:00 unless a test needs another. Each
-- section clears the last one's picks, claims, events and lines.
begin;
select plan(26);

create function pg_temp.u(n integer) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-a012-' || lpad(n::text, 12, '0'))::uuid $$;

insert into auth.users (id, email)
select pg_temp.u(n), 'u' || n || '.12@example.test' from generate_series(0, 202) n;
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/12-' || n, pg_temp.u(n), 'k' || n, 'a' || n from generate_series(0, 202) n;
update public.flags set value = 'true' where name = 'push_enabled';

-- 201 one-row pushes ------------------------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 201) n;

create temp table dry_1 as select * from public.push_due('2027-09-03 14:50+00', true);
select results_eq($$ select count(*)::int, min(user_id::text), max(user_id::text) from dry_1 $$,
  $$ values (200, pg_temp.u(1)::text, pg_temp.u(200)::text) $$,
  'dry: the first batch, 200 of 201 one-row pushes, by user');
select is((select count(*)::int from public.push_sent), 0, 'and it claims nothing');
create temp table call_1 as select * from public.push_due('2027-09-03 14:50+00');
select set_eq($$ select user_id, kind, key from call_1 $$, $$ select user_id, kind, key from dry_1 $$,
  'a call claims and returns the batch the dry call showed, and no more');
select results_eq(
  $$ select count(*)::int, count(*) filter (where user_id = pg_temp.u(201))::int from public.push_sent $$,
  $$ values (200, 0) $$,
  'it claims only what it returns: the 201st is left unclaimed, not claimed and cut from the answer');
select results_eq($$ select user_id from public.push_due('2027-09-03 14:50+00', true) $$, $$ values (pg_temp.u(201)) $$,
  'a dry call now shows the next batch: the 201st alone');
select results_eq($$ select user_id, key from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (pg_temp.u(201), 'e-1') $$, 'and the next call claims it');
select is_empty($$ select * from public.push_due('2027-09-03 14:50+00') $$, 'and the call after that comes back empty');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- A two-row push at the line --------------------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V'),
  (2027, 'e-2', 'Panel 2', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VI');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(200), 2027, 'e-2', true, '2026-09-01 00:00+00');

select results_eq($$ select count(*)::int, max(user_id::text) from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (199, pg_temp.u(199)::text) $$,
  'a two-row push that would take the batch past 200 waits whole, and every push after it waits too');
select results_eq($$ select user_id, event_id from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (pg_temp.u(200), 'e-1'), (pg_temp.u(200), 'e-2'), (pg_temp.u(201), 'e-1') $$,
  'the next call takes it whole, both its keys, and then the next');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- A first push bigger than the batch -----------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room)
select 2027, 'e-' || lpad(n::text, 3, '0'), 'Panel ' || lpad(n::text, 3, '0'), '2027-09-03 15:00+00',
       '2027-09-03 16:00+00', 'Hyatt', null
from generate_series(1, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(1), 2027, 'e-' || lpad(n::text, 3, '0'), true, '2026-09-01 00:00+00' from generate_series(1, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(2), 2027, 'e-001', true, '2026-09-01 00:00+00');

select results_eq(
  $$ select count(*)::int, count(distinct user_id)::int, min(event_id), max(event_id)
     from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (201, 1, 'e-001', 'e-201') $$,
  'a first push bigger than the batch is taken whole: 201 rows, one push');
select results_eq($$ select user_id from public.push_due('2027-09-03 14:50+00') $$, $$ values (pg_temp.u(2)) $$,
  'and the push after it waits for the next call');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- Who waits: the order at the line -----------------------------------------------------------------
-- Across the kinds: 200 starts-soon pushes fill the batch; a pick-changed push waits, though its run is older than
-- their start and its user comes first.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V'),
  (2027, 'e-pc', 'Changed Panel', '2027-09-04 15:00+00', '2027-09-04 16:00+00', 'Hilton', 'Grand');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 200) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(0), 2027, 'e-pc', true, '2026-09-01 00:00+00');
insert into public.schedule_changes (year, run, sha, id, kind, "from", "to", cause, fetch_code_changed) values
  (2027, '2027-09-03 13:00+00', 's1', 'e-pc', 'cancelled', null, null, 'source', false);

select results_eq(
  $$ select kind, count(*)::int from public.push_due('2027-09-03 14:50+00', true) group by kind $$,
  $$ values ('starts-soon', 200) $$,
  'starts-soon before pick-changed: 200 starts-soon pushes fill the batch, and the pick-changed push waits');

delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_changes where year in (2027, 2028);
delete from public.schedule_events where year in (2027, 2028);

-- Within starts-soon: a later start waits, though its user comes first.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V'),
  (2027, 'e-2', 'Panel 2', '2027-09-03 15:04+00', '2027-09-03 16:04+00', 'Hyatt', 'Regency VI');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(2, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(1), 2027, 'e-2', true, '2026-09-01 00:00+00');

select results_eq(
  $$ select count(*)::int, count(*) filter (where user_id = pg_temp.u(1))::int
     from public.push_due('2027-09-03 14:50+00', true) $$,
  $$ values (200, 0) $$,
  'starts-soon by start, soonest first, then user: a later start waits, though its user comes first');

delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- Within pick-changed: a newer run waits, though its user comes first.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-pc', 'Changed Panel', '2027-09-04 15:00+00', '2027-09-04 16:00+00', 'Hilton', 'Grand'),
  (2027, 'e-pc2', 'Changed Again', '2027-09-04 15:00+00', '2027-09-04 16:00+00', 'Hilton', 'Grand');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-pc', true, '2026-09-01 00:00+00' from generate_series(2, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(1), 2027, 'e-pc2', true, '2026-09-01 00:00+00');
insert into public.schedule_changes (year, run, sha, id, kind, "from", "to", cause, fetch_code_changed) values
  (2027, '2027-09-03 13:00+00', 's1', 'e-pc', 'cancelled', null, null, 'source', false),
  (2027, '2027-09-03 14:00+00', 's2', 'e-pc2', 'cancelled', null, null, 'source', false);

select results_eq(
  $$ select count(*)::int, count(*) filter (where user_id = pg_temp.u(1))::int, min(run), max(run)
     from public.push_due('2027-09-03 14:50+00', true) $$,
  $$ values (200, 0, '2027-09-03 13:00+00'::timestamptz, '2027-09-03 13:00+00'::timestamptz) $$,
  'pick-changed by run, oldest first, then user: a newer run waits, though its user comes first');

delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_changes where year in (2027, 2028);
delete from public.schedule_events where year in (2027, 2028);

-- A push is one year's: one run's lines for a user's picks in two years are two pushes, the later year's after.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-pc', 'Changed Panel', '2027-09-04 15:00+00', '2027-09-04 16:00+00', 'Hilton', 'Grand'),
  (2028, 'e-pc28', 'Changed Next Year', '2028-09-01 15:00+00', '2028-09-01 16:00+00', 'Hilton', 'Grand');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-pc', true, '2026-09-01 00:00+00' from generate_series(2, 201) n;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(201), 2028, 'e-pc28', true, '2026-09-01 00:00+00');
insert into public.schedule_changes (year, run, sha, id, kind, "from", "to", cause, fetch_code_changed) values
  (2027, '2027-09-03 13:00+00', 's1', 'e-pc', 'cancelled', null, null, 'source', false),
  (2028, '2027-09-03 13:00+00', 's1', 'e-pc28', 'cancelled', null, null, 'source', false);

select results_eq(
  $$ select count(*)::int, count(*) filter (where user_id = pg_temp.u(201) and year = 2027)::int,
            count(*) filter (where year = 2028)::int
     from public.push_due('2027-09-03 14:50+00', true) $$,
  $$ values (200, 1, 0) $$,
  'a push is one year''s: the 200th row is the user''s 2027 push, and their 2028 push, of the same run, waits');

delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_changes where year in (2027, 2028);
delete from public.schedule_events where year in (2027, 2028);

-- The order a call returns -----------------------------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-a', 'B Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V'),
  (2027, 'e-b', 'A Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VI'),
  (2027, 'e-c', 'C Panel', '2027-09-03 14:58+00', '2027-09-03 15:58+00', 'Hyatt', 'Regency VII'),
  (2027, 'e-d', 'D Panel', '2027-09-04 15:00+00', '2027-09-04 16:00+00', 'Hilton', 'Grand'),
  (2027, 'e-e', 'A Unscheduled', null, null, 'Hilton', null),
  (2027, 'e-f', 'F Panel', '2027-09-04 16:00+00', '2027-09-04 17:00+00', 'Hilton', 'Grand');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(2), 2027, 'e-a', true, '2026-09-01 00:00+00'),
  (pg_temp.u(2), 2027, 'e-b', true, '2026-09-01 00:00+00'),
  (pg_temp.u(3), 2027, 'e-c', true, '2026-09-01 00:00+00'),
  (pg_temp.u(1), 2027, 'e-d', true, '2026-09-01 00:00+00'),
  (pg_temp.u(1), 2027, 'e-e', true, '2026-09-01 00:00+00'),
  (pg_temp.u(4), 2027, 'e-f', true, '2026-09-01 00:00+00');
insert into public.schedule_changes (year, run, sha, id, kind, "from", "to", cause, fetch_code_changed) values
  (2027, '2027-09-03 13:00+00', 's1', 'e-d', 'cancelled', null, null, 'source', false),
  (2027, '2027-09-03 13:00+00', 's1', 'e-e', 'cancelled', null, null, 'source', false),
  (2027, '2027-09-03 12:00+00', 's0', 'e-f', 'cancelled', null, null, 'source', false);

select results_eq($$ select kind, user_id, event_id from public.push_due('2027-09-03 14:50+00', true) $$,
  $$ values ('starts-soon', pg_temp.u(3), 'e-c'), ('starts-soon', pg_temp.u(2), 'e-b'), ('starts-soon', pg_temp.u(2), 'e-a'),
            ('pick-changed', pg_temp.u(4), 'e-f'), ('pick-changed', pg_temp.u(1), 'e-d'),
            ('pick-changed', pg_temp.u(1), 'e-e') $$,
  'dry: starts-soon by start, pick-changed by run, each then by user; inside a push by start - unknown last - and title');
select results_eq($$ select kind, user_id, event_id from public.push_due('2027-09-03 14:50+00') $$,
  $$ values ('starts-soon', pg_temp.u(3), 'e-c'), ('starts-soon', pg_temp.u(2), 'e-b'), ('starts-soon', pg_temp.u(2), 'e-a'),
            ('pick-changed', pg_temp.u(4), 'e-f'), ('pick-changed', pg_temp.u(1), 'e-d'),
            ('pick-changed', pg_temp.u(1), 'e-e') $$,
  'and a call returns its rows in the order it took them');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_changes where year in (2027, 2028);
delete from public.schedule_events where year in (2027, 2028);

-- The stale release, first, every call ----------------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 201) n;
insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at) values
  (pg_temp.u(1), 2027, 'starts-soon', 'e-1', null, '2027-09-03 14:44:59+00');

create temp table call_7 as select * from public.push_due('2027-09-03 14:50+00');
select results_eq(
  $$ select count(*)::int, count(*) filter (where user_id = pg_temp.u(1))::int,
            count(*) filter (where user_id = pg_temp.u(201))::int from call_7 $$,
  $$ values (200, 1, 0) $$,
  'a stale claim is released before the batch is cut: its push is due again and takes its place in the batch');
select is((select claimed_at from public.push_sent where user_id = pg_temp.u(1)), '2027-09-03 14:50+00'::timestamptz,
  'claimed again at the new `at`');
update public.push_sent set claimed_at = '2027-09-03 14:40+00' where user_id = pg_temp.u(2);
select results_eq($$ select user_id from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (pg_temp.u(2)), (pg_temp.u(201)) $$,
  'and on every call: a claim gone stale since is released and claimed again, beside the push the last call left');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- A held key takes no place --------------------------------------------------------------------------------
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 202) n;
insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at) values
  (pg_temp.u(1), 2027, 'starts-soon', 'e-1', '2027-09-03 14:46+00', '2027-09-03 14:45+00'),
  (pg_temp.u(2), 2027, 'starts-soon', 'e-1', null, '2027-09-03 14:45+00');

select results_eq($$ select count(*)::int, min(user_id::text), max(user_id::text) from public.push_due('2027-09-03 14:50+00') $$,
  $$ values (200, pg_temp.u(3)::text, pg_temp.u(202)::text) $$,
  'a key held - sent, or claimed exactly five minutes before - takes no place in the batch: 200 others are claimed');
select results_eq(
  $$ select user_id, sent_at, claimed_at from public.push_sent where user_id in (pg_temp.u(1), pg_temp.u(2))
     order by user_id $$,
  $$ values (pg_temp.u(1), '2027-09-03 14:46+00'::timestamptz, '2027-09-03 14:45+00'::timestamptz),
            (pg_temp.u(2), null::timestamptz, '2027-09-03 14:45+00'::timestamptz) $$,
  'and both are left as they were');

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- A run that overlaps ------------------------------------------------------------------------------------
-- A trigger stands in for another run that claims two of the three due keys after this call has read the ledger
-- and before its insert reaches them.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-1', 'Panel 1', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V');
insert into public.picks (user_id, year, event_id, picked, changed_at)
select pg_temp.u(n), 2027, 'e-1', true, '2026-09-01 00:00+00' from generate_series(1, 3) n;
create function pg_temp.other_run() returns trigger language plpgsql as $f$
begin
  insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at)
  select pg_temp.u(n), 2027, 'starts-soon', 'e-1', null, '2027-09-03 14:49:59+00'
  from generate_series(1, 3) n where pg_temp.u(n) <> new.user_id
  on conflict do nothing;
  return new;
end $f$;
create trigger other_run before insert on public.push_sent for each row
  when (new.claimed_at = '2027-09-03 14:50+00') execute function pg_temp.other_run();
create temp table overlap as select * from public.push_due('2027-09-03 14:50+00', true) limit 0;
select lives_ok($$ insert into overlap select * from public.push_due('2027-09-03 14:50+00') $$,
  'a key another run claims after the call has read the ledger is skipped by its insert, not an error');
select results_eq(
  $$ select count(*)::int, count(*) filter (where s.claimed_at = '2027-09-03 14:50+00')::int
     from overlap o join public.push_sent s using (user_id, kind, key) $$,
  $$ values (1, 1) $$,
  'and the call returns only the key it claimed, one of three: the other two are the other run''s to send');
drop trigger other_run on public.push_sent;

delete from public.push_sent;
delete from public.picks where user_id::text like '00000000-0000-4000-a012-%';
delete from public.schedule_events where year in (2027, 2028);

-- The release, before the switch ---------------------------------------------------------------------------
update public.flags set value = 'false' where name = 'push_enabled';
insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at) values
  (pg_temp.u(1), 2027, 'starts-soon', 'e-stale', null, '2027-09-03 14:44:59+00');
create temp table switched_off as select * from public.push_due('2027-09-03 14:50+00');
select is_empty($$ select * from public.push_sent where key = 'e-stale' $$,
  'with the switch off a call still releases a stale claim: the release comes first');
update public.flags set value = 'true' where name = 'push_enabled';
delete from public.push_sent;

-- One start, one title: by id --------------------------------------------------------------------------------
-- The events and picks go in in an order that is neither the ids' nor its reverse, and the call is planned afresh with
-- the ways of reading a table in its key's order turned off, so that only the tie-break can put the ids in order.
insert into public.schedule_events (year, id, title, start, "end", hotel, room) values
  (2027, 'e-b', 'Same Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency V'),
  (2027, 'e-d', 'Same Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VI'),
  (2027, 'e-a', 'Same Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Regency VII'),
  (2027, 'e-c', 'Same Panel', '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', 'Embassy');
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  (pg_temp.u(1), 2027, 'e-b', true, '2026-09-01 00:00+00'), (pg_temp.u(1), 2027, 'e-d', true, '2026-09-01 00:00+00'),
  (pg_temp.u(1), 2027, 'e-a', true, '2026-09-01 00:00+00'), (pg_temp.u(1), 2027, 'e-c', true, '2026-09-01 00:00+00');
set local plan_cache_mode = force_custom_plan;
set local enable_mergejoin = off;
set local enable_indexscan = off;
set local enable_indexonlyscan = off;
set local enable_bitmapscan = off;
select results_eq($$ select event_id from public.push_due('2027-09-03 14:50+00', true) $$,
  $$ values ('e-a'), ('e-b'), ('e-c'), ('e-d') $$,
  'inside a push, events of one start and one title by id');

select * from finish();
rollback;
