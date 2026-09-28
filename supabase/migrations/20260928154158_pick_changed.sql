-- Pick-changed (DECISIONS #55; docs/sync/contract.md, section 7): push_due() replaced, to decide and claim the push
-- job's second kind beside starts-soon, in the same statement. Nothing else changes: the tables, the grants and the
-- two cron jobs are the spine's (20260926224454_push_spine.sql). A merged migration is never edited: this is a new
-- file. Its return type grows, so the function is dropped and made again, and its grants made again as they were.
drop function public.push_due(timestamptz, boolean);

-- What is due at `at`, claimed for the caller: one row per user and push-worthy thing, `kind` saying which.
--
-- starts-soon: a pick whose event starts within lead_time - not removed, not cancelled, its start known - one row
-- a pick, its key the event's id.
--
-- pick-changed: a scrape run's change lines for a pick's event, one row per user, run and event, its key
-- `<run as ISO 8601 UTC, to the second>|<event id>` and `changes` the event's lines of that run, each
-- {kind, from, to} as the change log has them - the times the con's wall clock, as the file writes them. Due where
-- the line is one of the six kinds a push tells (cancelled, uncancelled, removed, restored, time, place); its cause
-- is `source` and its run's fetch_code_changed is false, since a push for our own fix is the failure #47 exists
-- for; the run is within the horizon, `at - horizon <= run <= at`, so an older change is left to the pick news at
-- the next open and a switch turned back on sends no backlog; the pick is picked, and was before the run - a star
-- placed after a change gets no push about it; and the event's start is after `at`, or unknown.
--
-- Either kind is due only for a user with a browser to send it to. Every due row is claimed by one insert that
-- skips a key already held, so two runs that overlap cannot both take a row, a key sent once never comes back, and
-- the keys of one push - a user's run, or a user's picks at one start - are claimed together, at `at`, and so go
-- stale together. Only what this call claimed is returned. A stale claim is released first. With the kill switch
-- off, nothing is due. `at` is the clock, now() unless a caller names another, and `dry` claims and releases
-- nothing: it returns what a call would claim. The rows by kind, user, run, start, title and id.
create function public.push_due(at timestamptz default now(), dry boolean default false)
  returns table (kind text, key text, user_id uuid, year integer, event_id text, title text, start timestamptz,
                 hotel text, room text, minutes_until integer, run timestamptz, changes jsonb, endpoints jsonb)
  language plpgsql
  security definer
  set search_path = public
as $$
#variable_conflict use_column
declare
  lead_time constant interval := interval '15 minutes';   -- starts-soon: how long before a start (#40, #55)
  horizon   constant interval := interval '6 hours';      -- pick-changed: how old a run's lines may be
  stale     constant interval := interval '5 minutes';    -- a claim unsent this long is a crashed run's
begin
  if not push_due.dry then
    delete from public.push_sent c
    where c.sent_at is null and c.claimed_at < push_due.at - stale;
  end if;
  if not exists (select 1 from public.flags f where f.name = 'push_enabled' and f.value = 'true'::jsonb) then
    return;
  end if;
  return query
  with soon as (
    select 'starts-soon'::text as kind, e.id as key, p.user_id, e.year, e.id as event_id, e.title, e.start, e.hotel,
           e.room, ceil(extract(epoch from e.start - push_due.at) / 60)::integer as minutes_until,
           null::timestamptz as run, null::jsonb as changes
    from public.picks p
    join public.schedule_events e on e.year = p.year and e.id = p.event_id
    where p.picked
      and not e.removed
      and not e.cancelled
      and e.start is not null
      and e.start - lead_time <= push_due.at
      and push_due.at < e.start
  ),
  changed as (
    select 'pick-changed'::text as kind,
           to_char(l.run at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '|' || e.id as key,
           p.user_id, e.year, e.id as event_id, e.title, e.start, e.hotel, e.room, null::integer as minutes_until,
           l.run,
           jsonb_agg(jsonb_build_object('kind', l.kind, 'from', l."from", 'to', l."to") order by l.kind) as changes
    from public.schedule_changes l
    join public.picks p on p.year = l.year and p.event_id = l.id
    join public.schedule_events e on e.year = l.year and e.id = l.id
    where l.kind in ('cancelled', 'uncancelled', 'removed', 'restored', 'time', 'place')
      and l.cause = 'source'
      and not l.fetch_code_changed
      and push_due.at - horizon <= l.run
      and l.run <= push_due.at
      and p.picked
      and p.changed_at < l.run
      and (e.start is null or push_due.at < e.start)
    group by p.user_id, e.year, e.id, e.title, e.start, e.hotel, e.room, l.run
  ),
  due as (
    select * from soon
    union all
    select * from changed
  ),
  sendable as (
    select d.* from due d
    where exists (select 1 from public.push_subscriptions s where s.user_id = d.user_id)
  ),
  claimed as (
    insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at)
    select d.user_id, d.year, d.kind, d.key, null, push_due.at
    from sendable d
    where not push_due.dry
    on conflict do nothing
    returning push_sent.user_id, push_sent.kind, push_sent.key
  )
  select d.kind, d.key, d.user_id, d.year, d.event_id, d.title, d.start, d.hotel, d.room, d.minutes_until, d.run,
         d.changes,
         (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                           order by s.endpoint)
          from public.push_subscriptions s where s.user_id = d.user_id)
  from sendable d
  where case
          when push_due.dry then not exists (
            select 1 from public.push_sent c
            where c.user_id = d.user_id and c.kind = d.kind and c.key = d.key
              and (c.sent_at is not null or c.claimed_at >= push_due.at - stale))
          else exists (select 1 from claimed c where c.user_id = d.user_id and c.kind = d.kind and c.key = d.key)
        end
  order by d.kind, d.user_id, d.run, d.start, d.title, d.event_id;
end
$$;

-- Its grants, made again as the spine made them: the push function's alone, which calls it as service_role; no app
-- role, and not PUBLIC. It reads schedule_changes as its owner, a security definer, so the sender needs no grant on
-- it.
revoke all on function public.push_due(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.push_due(timestamptz, boolean) to service_role;
