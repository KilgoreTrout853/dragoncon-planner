-- A local dataset, and nothing else: `supabase db start` and `db reset` run this
-- after the migrations, and no hosted project ever does. Three users - two with
-- an email, one anonymous - one crew of two, and a few picks and follows across
-- the three, on 2026 events. The flags are the migration's.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-a000-00000000000a', 'ada@example.test', false),
  ('00000000-0000-4000-a000-00000000000b', 'bo@example.test', false),
  ('00000000-0000-4000-a000-00000000000c', null, true);

insert into public.crews (id, year, name, invite_token, creator) values
  ('00000000-0000-4000-b000-000000000001', 2026, 'Local crew', 'local-crew-invite', '00000000-0000-4000-a000-00000000000a');

insert into public.crew_members (crew_id, user_id, display_name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000a', 'Ada'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000000b', 'Bo');

insert into public.picks (user_id, year, event_id, picked, changed_at) values
  ('00000000-0000-4000-a000-00000000000a', 2026, '1e3995157984a4c0e6515a2ed630f116', true, '2026-09-03 12:00:00+00'),
  ('00000000-0000-4000-a000-00000000000a', 2026, '1e3995157984a4c0e6515a2ed63136a5', true, '2026-09-03 12:01:00+00'),
  ('00000000-0000-4000-a000-00000000000b', 2026, '1e3995157984a4c0e6515a2ed630f116', true, '2026-09-03 12:02:00+00'),
  ('00000000-0000-4000-a000-00000000000b', 2026, '1e3995157984a4c0e6515a2ed63136a5', false, '2026-09-03 12:03:00+00'),
  ('00000000-0000-4000-a000-00000000000c', 2026, '1e3995157984a4c0e6515a2ed630f116', true, '2026-09-03 12:04:00+00');

insert into public.follows (user_id, year, kind, key, followed, changed_at) values
  ('00000000-0000-4000-a000-00000000000a', 2026, 'track', 'Animation', true, '2026-09-03 12:05:00+00'),
  ('00000000-0000-4000-a000-00000000000b', 2026, 'work', '12-monkeys', true, '2026-09-03 12:06:00+00'),
  ('00000000-0000-4000-a000-00000000000c', 2026, 'person', 'brendon-lee', true, '2026-09-03 12:07:00+00');
