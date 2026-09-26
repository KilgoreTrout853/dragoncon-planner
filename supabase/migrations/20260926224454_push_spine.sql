-- The push job's spine (DECISIONS #55; docs/sync/contract.md, section 7): push_sent made a queue,
-- push_due() to decide and claim what is due, and pg_cron calling the push function through pg_net every
-- minute while the kill switch is on. Starts-soon alone; pick-changed follows in a pull request of its own.
-- A merged migration is never edited: this is a new file.

-- The two extensions, in the schemas Supabase names for them: pg_cron in pg_catalog, pg_net in extensions,
-- which makes a schema of its own, net, for its functions. Both are in the image's preloaded libraries, locally
-- and hosted, and postgres may create both.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- push_sent becomes the queue. A row is a claim, sent_at null until the sender acks it; claimed_at is when
-- push_due() took it, by its own clock, so a claim still unsent five minutes on is a crashed run's, and is
-- released to be due again. sent_at loses its default: a row written without one is a claim, not a send.
alter table public.push_sent alter column sent_at drop not null;
alter table public.push_sent alter column sent_at drop default;
alter table public.push_sent add column claimed_at timestamptz not null default now();

-- What is due at `at`, claimed for the caller, one row per user and event: starts-soon, a pick whose event
-- starts within fifteen minutes - not removed, not cancelled, its start known - for a user with a browser to
-- send it to. The claim is an insert that skips a key already held, so two runs that overlap cannot both take
-- a row, and only what this call claimed is returned. A stale claim is released first. With the kill switch
-- off, nothing is due. `at` is the clock, now() unless a caller names another, and `dry` claims and releases
-- nothing: it returns what a call would claim.
create function public.push_due(at timestamptz default now(), dry boolean default false)
  returns table (user_id uuid, year integer, event_id text, title text, start timestamptz, hotel text,
                 room text, minutes_until integer, endpoints jsonb)
  language plpgsql
  security definer
  set search_path = public
as $$
#variable_conflict use_column
begin
  if not push_due.dry then
    delete from public.push_sent c
    where c.sent_at is null and c.claimed_at < push_due.at - interval '5 minutes';
  end if;
  if not exists (select 1 from public.flags f where f.name = 'push_enabled' and f.value = 'true'::jsonb) then
    return;
  end if;
  return query
  with due as (
    select p.user_id, e.year, e.id as event_id, e.title, e.start, e.hotel, e.room
    from public.picks p
    join public.schedule_events e on e.year = p.year and e.id = p.event_id
    where p.picked
      and not e.removed
      and not e.cancelled
      and e.start is not null
      and e.start - interval '15 minutes' <= push_due.at
      and push_due.at < e.start
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
  ),
  claimed as (
    insert into public.push_sent (user_id, year, kind, key, sent_at, claimed_at)
    select d.user_id, d.year, 'starts-soon', d.event_id, null, push_due.at
    from due d
    where not push_due.dry
    on conflict do nothing
    returning push_sent.user_id, push_sent.key
  )
  select d.user_id, d.year, d.event_id, d.title, d.start, d.hotel, d.room,
         ceil(extract(epoch from d.start - push_due.at) / 60)::integer,
         (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                           order by s.endpoint)
          from public.push_subscriptions s where s.user_id = d.user_id)
  from due d
  where case
          when push_due.dry then not exists (
            select 1 from public.push_sent c
            where c.user_id = d.user_id and c.kind = 'starts-soon' and c.key = d.event_id
              and (c.sent_at is not null or c.claimed_at >= push_due.at - interval '5 minutes'))
          else exists (select 1 from claimed c where c.user_id = d.user_id and c.key = d.event_id)
        end
  order by d.user_id, d.start, d.title, d.event_id;
end
$$;

-- Grants, by name. push_due() is the push function's alone, which calls it as service_role; the sender acks,
-- releases and prunes as service_role too, and reads the kill switch for its summary. Nothing reaches an app
-- role.
revoke all on function public.push_due(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.push_due(timestamptz, boolean) to service_role;
grant select, insert, update, delete on public.push_sent to service_role;
grant select, delete on public.push_subscriptions to service_role;
grant select on public.flags to service_role;

-- Every minute, the push function, while the kill switch is on. The switch is read here too, so with it off
-- there is no call at all: the where clause finds no row, and the post's arguments - Vault's two secrets among
-- them - are never read. With it on, Vault must hold project_url and push_secret (ROADMAP, Checklist), or the
-- run fails and cron.job_run_details says why. The function answers within the timeout, its summary kept in
-- net._http_response for six hours.
select cron.schedule('push', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
  where exists (select 1 from public.flags where name = 'push_enabled' and value = 'true'::jsonb)
$cron$);

-- pg_cron records every run and deletes none: a job a minute is 1,440 rows a day, switch on or off. A week is
-- kept, every job's.
select cron.schedule('cron-history', '0 4 * * *', $cron$
  delete from cron.job_run_details where end_time < now() - interval '7 days'
$cron$);
