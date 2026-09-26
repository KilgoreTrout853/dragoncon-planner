-- The mirror job (DECISIONS #54; docs/sync/contract.md, section 6): an event's
-- start and end may be null, as a live year's events.v2.json may hold them -
-- the fetch writes null where the source's date does not parse, and an end
-- where a listing gives neither a duration nor a time range - so that
-- schedule_events for a year equals the file, a null included, and never keeps
-- a time the source no longer states. The push job sends no starts-soon for an
-- event with no start. And the mirror's three tables are service_role's to
-- write, by name. The first migration is never edited; this is a new file.
alter table public.schedule_events alter column start drop not null;
alter table public.schedule_events alter column "end" drop not null;

-- The job writes as service_role, which row-level security does not stop but
-- a missing grant does. A project made since 2026-05-30 grants a new table to
-- no Data API role unless told to, so the grant is made here, by name, as
-- every grant in these migrations is: a production project gets it by
-- migration, whatever its defaults.
grant select, insert, update, delete
  on public.schedule_events, public.schedule_changes, public.mirror_state
  to service_role;
