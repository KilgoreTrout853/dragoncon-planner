-- The batch (DECISIONS #55; docs/sync/contract.md, section 7, The batch, as built): push_due() replaced, to claim no
-- more than it can return. PostgREST answers an RPC with at most max_rows rows - 1,000, locally and hosted - while
-- the fifth migration's push_due() claimed every due row in its one insert, so past 1,000 rows were claimed and never
-- returned, and sat unsent until the stale release. A call now claims one batch, and the push function calls again
-- until a call comes back empty or its own limits end the run (BATCHES and BUDGET_MS in push.js), what is left
-- claimed the next minute. The signature and the return type are the fifth's, so `create or replace` keeps
-- the function's owner and its grants - service_role's alone (10_push.test.sql); security definer and the search
-- path belong to the statement, so they are said again. Nothing else changes: the tables and the two cron jobs are
-- the spine's (20260926224454_push_spine.sql). A merged migration is never edited: this is a new file.

-- What is due at `at`, claimed for the caller, one batch at a time: one row per user and push-worthy thing, `kind`
-- saying which.
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
-- Either kind is due only for a user with a browser to send it to, and only where its key is not held already:
-- sent, or claimed and not yet stale. The rest are taken a push at a time - a user's picks at one start, or a
-- user's picks one run changed, in one year - starts-soon before pick-changed; starts-soon by start, soonest first,
-- and pick-changed by run, oldest first; then by user. Pushes are taken while their rows stay within `batch`, and
-- the first push whole even when it alone is more, so a call returns at most `batch` rows, or one push, whichever is
-- more, and the batch never cuts a push: a push it cannot take whole waits for the next call. What is taken is
-- claimed by one insert that skips a key already held, so two runs that overlap cannot both take a row, a key sent
-- once never comes back, and the keys of one push are claimed together, at `at`, and so go stale together. Only
-- what this call claimed is returned, in the order it was taken: inside a push by start - an unknown start last -
-- title and id. A stale claim is released first, every call. With the kill switch off, nothing is due. `at` is the
-- clock, now() unless a caller names another, and `dry` claims and releases nothing: it returns the batch a call
-- would claim.
create or replace function public.push_due(at timestamptz default now(), dry boolean default false)
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
  batch     constant integer  := 200;                     -- rows a call claims, in whole pushes: PostgREST returns 1,000
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
           null::timestamptz as run, null::jsonb as changes, e.start as moment
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
           jsonb_agg(jsonb_build_object('kind', l.kind, 'from', l."from", 'to', l."to") order by l.kind) as changes,
           l.run as moment
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
  -- Due, for a user with a browser, and not held: a key sent, or claimed and not yet stale, is left out before the
  -- batch is cut, or the batch would fill with keys the insert then skips.
  waiting as (
    select d.* from due d
    where exists (select 1 from public.push_subscriptions s where s.user_id = d.user_id)
      and not exists (
        select 1 from public.push_sent c
        where c.user_id = d.user_id and c.kind = d.kind and c.key = d.key
          and (c.sent_at is not null or c.claimed_at >= push_due.at - stale))
  ),
  -- Each row with its push's place in the order the pushes are taken, and the rows taken up to the end of its push:
  -- a push's rows share its order key, so the count, which counts a row's peers with it, never ends inside a push.
  placed as (
    select w.*,
           dense_rank() over taking as place,
           count(*) over taking as upto
    from waiting w
    window taking as (order by w.kind <> 'starts-soon', w.moment, w.user_id, w.year)
  ),
  taken as (
    select p.* from placed p
    where p.upto <= batch or p.place = 1
  ),
  claimed as (
    insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at)
    select t.user_id, t.year, t.kind, t.key, null, push_due.at
    from taken t
    where not push_due.dry
    on conflict do nothing
    returning push_sent.user_id, push_sent.kind, push_sent.key
  )
  select t.kind, t.key, t.user_id, t.year, t.event_id, t.title, t.start, t.hotel, t.room, t.minutes_until, t.run,
         t.changes,
         (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                           order by s.endpoint)
          from public.push_subscriptions s where s.user_id = t.user_id)
  from taken t
  where push_due.dry
     or exists (select 1 from claimed c where c.user_id = t.user_id and c.kind = t.kind and c.key = t.key)
  order by t.place, t.start, t.title, t.event_id;
end
$$;
