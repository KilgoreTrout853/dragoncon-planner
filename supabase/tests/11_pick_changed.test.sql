-- Pick-changed (DECISIONS #55; docs/sync/contract.md, section 7): push_due()'s second kind. Each push-worthy kind is
-- due and each other kind is not; a `code` line and a flagged run's line are suppressed; a pick unstarred, or
-- starred at or after the run, gets nothing; an event started, or starting at `at`, gets nothing, and one with no
-- start passes; the horizon's two edges, six hours back and `at` itself; one row per user, run and event, its
-- changes the event's lines of that run, never another year's event or pick of the same id; the key; the order; the
-- claim - every key of every push in one insert, at `at`, a claim holding its own kind alone - a second call, and a
-- push's claims released together; and starts-soon's rows beside them. The times are
-- 2026's, in the past, so the picks' stamps are not clamped. Ada has two browsers, Bo one, Cy none. `at` is 12:00
-- UTC on 2026-09-03, the run R 11:00 and R2 10:00; the events start at 15:00 the next day unless a test needs
-- another start. The session's zone is New York's, not the server's UTC, so that a key is seen written in UTC
-- whatever zone the call runs in.
begin;
select plan(36);
set local timezone = 'America/New_York';

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000011', 'ada.11@example.test'),
  ('b0000000-0000-4000-a000-000000000011', 'bo.11@example.test'),
  ('c0000000-0000-4000-a000-000000000011', 'cy.11@example.test');

insert into public.schedule_events (year, id, title, start, "end", hotel, room, removed, cancelled) values
  (2026, 'pc-cancelled',      'pc-cancelled',      '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', 'Regency V', false, true),
  (2026, 'pc-uncancelled',    'pc-uncancelled',    '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', 'Regency V', false, false),
  (2026, 'pc-removed',        'pc-removed',        '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', 'Regency V', true, false),
  (2026, 'pc-restored',       'pc-restored',       '2026-09-04 09:00+00', '2026-09-04 10:00+00', 'Hyatt', 'Regency V', false, false),
  (2026, 'pc-time',           'pc-time: Time Panel',      '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hilton', 'Grand', false, false),
  (2026, 'pc-place',          'pc-place',          '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hilton', 'Grand', false, false),
  (2026, 'pc-added',          'pc-added',          '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-title',          'pc-title',          '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-description',    'pc-description',    '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-people',         'pc-people',         '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-tracks',         'pc-tracks',         '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-merged',         'pc-merged',         '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-code',           'pc-code',           '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-flagged',        'pc-flagged',        '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-unpicked',       'pc-unpicked',       '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-starred-after',  'pc-starred-after',  '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-starred-at',     'pc-starred-at',     '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-started',        'pc-started',        '2026-09-03 11:59+00', '2026-09-03 12:59+00', 'Hyatt', null, false, true),
  (2026, 'pc-starting',       'pc-starting',       '2026-09-03 12:00+00', '2026-09-03 13:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-unscheduled',    'pc-unscheduled',    null, null, 'Hyatt', null, false, true),
  (2026, 'pc-horizon',        'pc-horizon',        '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-too-old',        'pc-too-old',        '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-at',             'pc-at',             '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-future',         'pc-future',         '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-both',           'pc-both',           '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hilton', 'Grand', false, false),
  (2026, 'pc-twice',          'pc-twice',          '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, false),
  (2026, 'pc-other-year',     'pc-other-year',     '2026-09-04 15:00+00', '2026-09-04 16:00+00', 'Hyatt', null, false, true),
  (2026, 'pc-soon',           'pc-soon',           '2026-09-03 12:10+00', '2026-09-03 13:10+00', 'Westin', 'Augusta', false, false),
  (2027, 'pc-time',           'pc-time in 2027',   '2027-09-03 15:00+00', '2027-09-03 16:00+00', 'Hyatt', null, false, false);

insert into public.picks (user_id, year, event_id, picked, changed_at)
select 'a0000000-0000-4000-a000-000000000011', 2026, id, true, '2026-09-01 00:00+00'
from unnest(array['pc-cancelled', 'pc-uncancelled', 'pc-removed', 'pc-restored', 'pc-time', 'pc-place', 'pc-added',
                  'pc-title', 'pc-description', 'pc-people', 'pc-tracks', 'pc-merged', 'pc-code', 'pc-flagged',
                  'pc-started', 'pc-starting', 'pc-unscheduled', 'pc-horizon', 'pc-too-old', 'pc-at', 'pc-future',
                  'pc-both', 'pc-twice', 'pc-no-event', 'pc-soon']) as id;
insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('a0000000-0000-4000-a000-000000000011', 2026, 'pc-unpicked', false, '2026-09-01 00:00+00'),
  ('a0000000-0000-4000-a000-000000000011', 2026, 'pc-starred-after', true, '2026-09-03 11:00:01+00'),
  ('a0000000-0000-4000-a000-000000000011', 2026, 'pc-starred-at', true, '2026-09-03 11:00:00+00'),
  ('b0000000-0000-4000-a000-000000000011', 2026, 'pc-cancelled', true, '2026-09-01 00:00+00'),
  ('b0000000-0000-4000-a000-000000000011', 2027, 'pc-other-year', true, '2026-09-01 00:00+00'),
  ('c0000000-0000-4000-a000-000000000011', 2026, 'pc-cancelled', true, '2026-09-01 00:00+00');

insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/ada-2', 'a0000000-0000-4000-a000-000000000011', 'k2', 'a2'),
  ('https://push.example.test/ada-1', 'a0000000-0000-4000-a000-000000000011', 'k1', 'a1'),
  ('https://push.example.test/bo-1',  'b0000000-0000-4000-a000-000000000011', 'k3', 'a3');

insert into public.schedule_changes (year, run, sha, id, kind, "from", "to", cause, fetch_code_changed) values
  (2026, '2026-09-03 11:00+00', 's1', 'pc-cancelled',     'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-uncancelled',   'uncancelled', null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-removed',       'removed',     null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-restored',      'restored',    null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-time',          'time',
   '{"start": "2026-09-04T10:30", "end": "2026-09-04T11:30"}', '{"start": "2026-09-04T11:00", "end": "2026-09-04T12:00"}',
   'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-place',         'place',
   '{"hotel": "Hyatt", "room": "Regency V"}', '{"hotel": "Hilton", "room": "Grand"}', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-added',         'added',       null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-title',         'title',       '"A"', '"B"', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-description',   'description', null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-people',        'people',      '[]', '["ada"]', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-tracks',        'tracks',      '[]', '["X"]', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-merged',        'merged',      null, '"pc-cancelled"', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-code',          'cancelled',   null, null, 'code', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-flagged',       'cancelled',   null, null, 'source', true),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-unpicked',      'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-starred-after', 'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-starred-at',    'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-started',       'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-starting',      'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-unscheduled',   'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 06:00:00+00', 's0', 'pc-horizon',    'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 05:59:59+00', 's0', 'pc-too-old',    'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 12:00:00+00', 's2', 'pc-at',         'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 12:00:01+00', 's2', 'pc-future',     'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-both',          'time',
   '{"start": "2026-09-04T14:00", "end": "2026-09-04T15:00"}', '{"start": "2026-09-04T15:00", "end": "2026-09-04T16:00"}',
   'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-both',          'place',
   '{"hotel": "Hyatt", "room": null}', '{"hotel": "Hilton", "room": "Grand"}', 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-both',          'title',       '"Both"', '"pc-both"', 'source', false),
  (2026, '2026-09-03 10:00+00', 's1', 'pc-twice',         'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-twice',         'uncancelled', null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-other-year',    'cancelled',   null, null, 'source', false),
  (2026, '2026-09-03 11:00+00', 's1', 'pc-no-event',      'cancelled',   null, null, 'source', false);

-- The kill switch -------------------------------------------------------------------
select is_empty($$ select * from public.push_due('2026-09-03 12:00+00', true) $$,
  'with the kill switch off, no pick-changed is due');

update public.flags set value = 'true' where name = 'push_enabled';
create temp table dry_at as select * from public.push_due('2026-09-03 12:00+00', true);

-- What is due, and in what order ------------------------------------------------------
select results_eq(
  $$ select kind, key from public.push_due('2026-09-03 12:00+00', true) $$,
  $$ values ('starts-soon', 'pc-soon'),
            ('pick-changed', '2026-09-03T06:00:00Z|pc-horizon'), ('pick-changed', '2026-09-03T10:00:00Z|pc-twice'),
            ('pick-changed', '2026-09-03T11:00:00Z|pc-restored'), ('pick-changed', '2026-09-03T11:00:00Z|pc-both'),
            ('pick-changed', '2026-09-03T11:00:00Z|pc-cancelled'), ('pick-changed', '2026-09-03T11:00:00Z|pc-place'),
            ('pick-changed', '2026-09-03T11:00:00Z|pc-removed'), ('pick-changed', '2026-09-03T11:00:00Z|pc-time'),
            ('pick-changed', '2026-09-03T11:00:00Z|pc-twice'), ('pick-changed', '2026-09-03T11:00:00Z|pc-uncancelled'),
            ('pick-changed', '2026-09-03T11:00:00Z|pc-unscheduled'), ('pick-changed', '2026-09-03T11:00:00Z|pc-cancelled'),
            ('pick-changed', '2026-09-03T12:00:00Z|pc-at') $$,
  'starts-soon first; pick-changed by run, then user; inside a push by the event''s start - unknown last - and title');
select results_eq(
  $$ select event_id, changes from dry_at
     where user_id = 'a0000000-0000-4000-a000-000000000011'
       and event_id in ('pc-cancelled', 'pc-uncancelled', 'pc-removed', 'pc-restored', 'pc-time', 'pc-place')
     order by event_id $$,
  $$ values ('pc-cancelled', '[{"kind": "cancelled", "from": null, "to": null}]'::jsonb),
            ('pc-place', '[{"kind": "place", "from": {"hotel": "Hyatt", "room": "Regency V"},
                            "to": {"hotel": "Hilton", "room": "Grand"}}]'),
            ('pc-removed', '[{"kind": "removed", "from": null, "to": null}]'),
            ('pc-restored', '[{"kind": "restored", "from": null, "to": null}]'),
            ('pc-time', '[{"kind": "time", "from": {"start": "2026-09-04T10:30", "end": "2026-09-04T11:30"},
                           "to": {"start": "2026-09-04T11:00", "end": "2026-09-04T12:00"}}]'),
            ('pc-uncancelled', '[{"kind": "uncancelled", "from": null, "to": null}]') $$,
  'each of the six kinds a push tells is due, its line''s from and to as the change log has them');
select is_empty(
  $$ select * from dry_at
     where event_id in ('pc-added', 'pc-title', 'pc-description', 'pc-people', 'pc-tracks', 'pc-merged') $$,
  'added, title, description, people, tracks and merged are never due');

-- Suppressed -----------------------------------------------------------------------------
select is_empty($$ select * from dry_at where event_id = 'pc-code' $$,
  'a line the code caused is suppressed: a push for our own fix is the failure');
select is_empty($$ select * from dry_at where event_id = 'pc-flagged' $$,
  'a line of a run whose fetch code changed is suppressed');

-- The pick ---------------------------------------------------------------------------------
select is_empty($$ select * from dry_at where event_id = 'pc-unpicked' $$, 'not a pick unstarred');
select is_empty($$ select * from dry_at where event_id = 'pc-starred-after' $$,
  'not a star placed after the run: no push about a change made before it');
select is_empty($$ select * from dry_at where event_id = 'pc-starred-at' $$,
  'nor one stamped at the run: the run must come after the star');

-- The event's start -------------------------------------------------------------------------
select is_empty($$ select * from dry_at where event_id = 'pc-started' $$, 'not an event that started before `at`');
select is_empty($$ select * from dry_at where event_id = 'pc-starting' $$, 'nor one starting at `at`');
select results_eq($$ select event_id, start from dry_at where event_id = 'pc-unscheduled' $$,
  $$ values ('pc-unscheduled', null::timestamptz) $$, 'an event with no start is due');

-- The horizon ----------------------------------------------------------------------------------
select results_eq($$ select run from dry_at where event_id = 'pc-horizon' $$,
  $$ values ('2026-09-03 06:00:00+00'::timestamptz) $$, 'a run six hours before `at` is due');
select is_empty($$ select * from dry_at where event_id = 'pc-too-old' $$, 'a run a second older is not');
select results_eq($$ select run from dry_at where event_id = 'pc-at' $$,
  $$ values ('2026-09-03 12:00:00+00'::timestamptz) $$, 'a run at `at` is due');
select is_empty($$ select * from dry_at where event_id = 'pc-future' $$,
  'a run after `at` is not: on `at`''s clock it has not happened');

-- One row per user, run and event ------------------------------------------------------------
select results_eq($$ select key, changes from dry_at where event_id = 'pc-both' $$,
  $$ values ('2026-09-03T11:00:00Z|pc-both',
             '[{"kind": "place", "from": {"hotel": "Hyatt", "room": null}, "to": {"hotel": "Hilton", "room": "Grand"}},
               {"kind": "time", "from": {"start": "2026-09-04T14:00", "end": "2026-09-04T15:00"},
                "to": {"start": "2026-09-04T15:00", "end": "2026-09-04T16:00"}}]'::jsonb) $$,
  'an event''s lines of one run are one row, its title line left out');
select results_eq($$ select key, changes from dry_at where event_id = 'pc-twice' order by run $$,
  $$ values ('2026-09-03T10:00:00Z|pc-twice', '[{"kind": "cancelled", "from": null, "to": null}]'::jsonb),
            ('2026-09-03T11:00:00Z|pc-twice', '[{"kind": "uncancelled", "from": null, "to": null}]'::jsonb) $$,
  'an event changed by two runs is two rows, each its run''s key');
select results_eq(
  $$ select kind, key, user_id, year, event_id, title, start, hotel, room, minutes_until, run
     from dry_at where event_id = 'pc-time' $$,
  $$ values ('pick-changed', '2026-09-03T11:00:00Z|pc-time', 'a0000000-0000-4000-a000-000000000011'::uuid, 2026,
             'pc-time', 'pc-time: Time Panel', '2026-09-04 15:00+00'::timestamptz, 'Hilton', 'Grand', null::integer,
             '2026-09-03 11:00+00'::timestamptz) $$,
  'a pick-changed row: its kind and key, the user, the event''s year, id, title, start and place, no minutes, the run');
select is((select endpoints from dry_at where event_id = 'pc-time'),
  '[{"endpoint": "https://push.example.test/ada-1", "p256dh": "k1", "auth": "a1"},
    {"endpoint": "https://push.example.test/ada-2", "p256dh": "k2", "auth": "a2"}]'::jsonb,
  'and every browser of the user''s, by endpoint');

-- Whose ------------------------------------------------------------------------------------------
select is_empty($$ select * from dry_at where user_id = 'c0000000-0000-4000-a000-000000000011' $$,
  'not for a user with no browser');
select results_eq($$ select event_id from dry_at where user_id = 'b0000000-0000-4000-a000-000000000011' $$,
  $$ values ('pc-cancelled') $$,
  'each user their own picks, and not a pick of another year''s event of the same id');
select is_empty($$ select * from dry_at where event_id = 'pc-no-event' $$,
  'not a line whose event the mirror does not hold');
select results_eq(
  $$ select kind, key, event_id, minutes_until, run, changes from dry_at where kind = 'starts-soon' $$,
  $$ values ('starts-soon', 'pc-soon', 'pc-soon', 10, null::timestamptz, null::jsonb) $$,
  'a starts-soon row beside them: its key the event id, its minutes, no run and no changes');
select is((select count(*)::int from public.push_sent), 0, 'dry claimed nothing');
insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at) values
  ('a0000000-0000-4000-a000-000000000011', 2026, 'pick-changed', 'pc-soon', null, '2026-09-03 12:00+00');
select results_eq($$ select kind, key from public.push_due('2026-09-03 12:00+00', true) where event_id = 'pc-soon' $$,
  $$ values ('starts-soon', 'pc-soon') $$,
  'a claim holds its own kind alone: one of the other kind, whatever its key, hides nothing');
delete from public.push_sent;

-- The claim ----------------------------------------------------------------------------------------
create temp table first_call as select * from public.push_due('2026-09-03 12:00+00');
select set_eq($$ select user_id, kind, key from first_call $$, $$ select user_id, kind, key from dry_at $$,
  'a call claims and returns what the dry call showed');
select set_eq(
  $$ select user_id, year, kind, key, sent_at, claimed_at from public.push_sent $$,
  $$ select user_id, year, kind, key, null::timestamptz as sent_at, '2026-09-03 12:00+00'::timestamptz as claimed_at
     from dry_at $$,
  'every key of every push claimed by the one statement: the event''s year, unsent, claimed at `at`');
select is(
  (select key from public.push_sent
   where user_id = 'a0000000-0000-4000-a000-000000000011' and kind = 'pick-changed' and key like '%|pc-cancelled'),
  '2026-09-03T11:00:00Z|pc-cancelled', 'a pick-changed key: the run in UTC to the second, a bar, the event id');
create temp table second_call as select * from public.push_due('2026-09-03 12:00+00');
select is((select count(*)::int from second_call), 0, 'a second call takes nothing already claimed');
select is_empty($$ select * from public.push_due('2026-09-03 12:00+00', true) $$,
  'and a dry call shows nothing held by a live claim');

-- Stale, together ----------------------------------------------------------------------------------
update public.push_sent set sent_at = '2026-09-03 12:00:30+00' where user_id = 'b0000000-0000-4000-a000-000000000011';
create temp table past_five as select * from public.push_due('2026-09-03 12:05:01+00');
select results_eq(
  $$ select count(*)::int, min(claimed_at), max(claimed_at) from public.push_sent
     where user_id = 'a0000000-0000-4000-a000-000000000011' and key like '2026-09-03T11:00:00Z|%' $$,
  $$ values (9, '2026-09-03 12:05:01+00'::timestamptz, '2026-09-03 12:05:01+00'::timestamptz) $$,
  'past five minutes, a push''s unsent claims are released and claimed again together, at the new `at`');
select is_empty($$ select * from public.push_sent where key like '%|pc-horizon' $$,
  'a claim whose run has left the horizon is released and not claimed again');
select results_eq(
  $$ select key, sent_at from public.push_sent where user_id = 'b0000000-0000-4000-a000-000000000011' $$,
  $$ values ('2026-09-03T11:00:00Z|pc-cancelled', '2026-09-03 12:00:30+00'::timestamptz) $$,
  'a sent claim stays sent');
select results_eq($$ select key from past_five where event_id in ('pc-future', 'pc-horizon') $$,
  $$ values ('2026-09-03T12:00:01Z|pc-future') $$,
  'the horizon moves with `at`: a run that was after it is due, one six hours and a second before it is not');

update public.flags set value = 'false' where name = 'push_enabled';
select is_empty($$ select * from public.push_due('2026-09-03 12:06+00', true) $$,
  'with the switch off again, nothing is due');

select * from finish();
rollback;
