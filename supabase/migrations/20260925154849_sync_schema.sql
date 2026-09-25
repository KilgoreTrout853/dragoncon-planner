-- Identity and sync's schema: the ten tables, their privileges and row-level
-- security, the two helpers, the stamp triggers and the three RPCs (DECISIONS
-- #52; docs/sync/contract.md, sections 2-4). A merged migration is never
-- edited: a change is a new file.

-- Privileges -----------------------------------------------------------------
-- Supabase's defaults grant every new table, sequence and function in public
-- to anon and authenticated. From here on nothing reaches either role unless a
-- migration grants it by name. PUBLIC's own right to execute a function is
-- Postgres's default and cannot be revoked for one schema alone, so each
-- function below revokes it itself; 00_structure.test.sql holds the list of
-- what anon and authenticated may reach.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- A crew's invite: 16 random bytes as base64url, 22 characters.
create function public.new_invite_token() returns text
  language sql
  volatile
  set search_path = public
as $$
  select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_')
$$;

-- The tables -----------------------------------------------------------------
-- A reader's plan: one row per item, a tombstone (false) rather than a delete,
-- latest stamp wins (the triggers below).
create table public.picks (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  year       integer     not null check (year between 2026 and 2099),
  event_id   text        not null check (event_id <> ''),
  picked     boolean     not null,
  changed_at timestamptz not null,
  primary key (user_id, year, event_id)
);

create table public.follows (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  year       integer     not null check (year between 2026 and 2099),
  kind       text        not null check (kind in ('track', 'work', 'axis', 'person')),
  key        text        not null check (key <> ''),
  followed   boolean     not null,
  changed_at timestamptz not null,
  primary key (user_id, year, kind, key)
);

-- A crew outlives its creator: creator is set null, and the creator-only
-- actions lapse with them.
create table public.crews (
  id           uuid        primary key default gen_random_uuid(),
  year         integer     not null check (year between 2026 and 2099),
  name         text        not null check (name = btrim(name) and char_length(name) between 1 and 40),
  invite_token text        not null unique default public.new_invite_token(),
  creator      uuid        references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.crew_members (
  crew_id      uuid        not null references public.crews (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  display_name text        not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 24),
  joined_at    timestamptz not null default now(),
  primary key (crew_id, user_id)
);

-- One row per browser. No year: an endpoint outlives one, and a dead one is
-- pruned when a send to it fails.
create table public.push_subscriptions (
  endpoint     text        primary key check (endpoint <> ''),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  p256dh       text        not null,
  auth         text        not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- The schedule mirror, written by the mirror job after a scrape merges.
-- start and end are the file's local times read in the con's zone.
create table public.schedule_events (
  year      integer     not null check (year between 2026 and 2099),
  id        text        not null,
  title     text        not null,
  start     timestamptz not null,
  "end"     timestamptz not null,
  hotel     text,
  room      text,
  removed   boolean     not null default false,
  cancelled boolean     not null default false,
  primary key (year, id)
);

-- The change log's line as it is, with its year and its run's
-- fetch_code_changed from last-run.json.
create table public.schedule_changes (
  year               integer     not null check (year between 2026 and 2099),
  run                timestamptz not null,
  sha                text        not null,
  id                 text        not null,
  kind               text        not null check (kind in ('added', 'removed', 'restored', 'cancelled', 'uncancelled',
                                                          'merged', 'time', 'place', 'title', 'people', 'tracks',
                                                          'description')),
  "from"             jsonb,
  "to"               jsonb,
  cause              text        not null check (cause in ('source', 'code')),
  fetch_code_changed boolean     not null,
  primary key (year, run, id, kind)
);

-- The push job's idempotence ledger. year, because retention deletes by year.
create table public.push_sent (
  user_id uuid        not null references auth.users (id) on delete cascade,
  year    integer     not null check (year between 2026 and 2099),
  kind    text        not null check (kind in ('starts-soon', 'pick-changed')),
  key     text        not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

-- How far the mirror has read, one row per year; section 6 may add columns.
create table public.mirror_state (
  year       integer     primary key check (year between 2026 and 2099),
  last_run   timestamptz,
  last_sha   text,
  updated_at timestamptz not null default now()
);

create table public.flags (
  name  text  primary key,
  value jsonb not null
);

-- The kill switch, off until the push job is built and trusted; the cap is a
-- one-row update, not a migration.
insert into public.flags (name, value) values
  ('push_enabled', 'false'),
  ('crew_size_cap', '25');

-- The reads the contract names. schedule_changes by (year, run) is its primary
-- key's own leading columns, so it has no index of its own.
create index picks_by_user_changed         on public.picks (user_id, changed_at);
create index follows_by_user_changed       on public.follows (user_id, changed_at);
create index crew_members_by_user          on public.crew_members (user_id);
create index schedule_events_by_year_start on public.schedule_events (year, start);

-- Stamps ---------------------------------------------------------------------
-- A stamp is the client's real clock, clamped to the server's time plus five
-- minutes, and a row changes only for a stamp strictly newer than its own: an
-- equal one is a replayed operation. The client upserts; these hold the rule.
-- Postgres fires a table's BEFORE triggers in name order, so the clamp runs
-- first and latest-wins compares clamped stamps.
create function public.clamp_changed_at() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.changed_at > now() + interval '5 minutes' then
    new.changed_at := now() + interval '5 minutes';
  end if;
  return new;
end
$$;

create function public.latest_stamp_wins() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.changed_at <= old.changed_at then
    return null;
  end if;
  return new;
end
$$;

create trigger picks_1_clamp before insert or update on public.picks
  for each row execute function public.clamp_changed_at();
create trigger picks_2_latest_wins before update on public.picks
  for each row execute function public.latest_stamp_wins();
create trigger follows_1_clamp before insert or update on public.follows
  for each row execute function public.clamp_changed_at();
create trigger follows_2_latest_wins before update on public.follows
  for each row execute function public.latest_stamp_wins();

-- Helpers --------------------------------------------------------------------
-- Security definer, so a policy on crew_members can ask about crew_members
-- without recursing into its own policy.
create function public.is_crew_member(crew_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = is_crew_member.crew_id and m.user_id = auth.uid()
  )
$$;

-- Whether the caller and another user are in a crew together for that year: a
-- crewmate's picks are the crew's year's.
create function public.shares_crew_with(other_user uuid, year integer) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs on theirs.crew_id = mine.crew_id
    join public.crews c on c.id = mine.crew_id
    where mine.user_id = auth.uid()
      and theirs.user_id = shares_crew_with.other_user
      and c.year = shares_crew_with.year
  )
$$;

-- Row-level security ---------------------------------------------------------
-- On every table. Policies are for authenticated alone; anon has none, and the
-- five job tables have none for any app role.
alter table public.picks              enable row level security;
alter table public.follows            enable row level security;
alter table public.crews              enable row level security;
alter table public.crew_members       enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.schedule_events    enable row level security;
alter table public.schedule_changes   enable row level security;
alter table public.push_sent          enable row level security;
alter table public.mirror_state       enable row level security;
alter table public.flags              enable row level security;

create policy "picks: own or a crewmate's are read" on public.picks
  for select to authenticated
  using (user_id = auth.uid() or public.shares_crew_with(user_id, year));
create policy "picks: own are added" on public.picks
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "picks: own are changed" on public.picks
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "follows: own are read" on public.follows
  for select to authenticated
  using (user_id = auth.uid());
create policy "follows: own are added" on public.follows
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "follows: own are changed" on public.follows
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "crews: members read" on public.crews
  for select to authenticated
  using (public.is_crew_member(id));
create policy "crews: the creator renames" on public.crews
  for update to authenticated
  using (creator = auth.uid())
  with check (creator = auth.uid());
create policy "crews: the creator deletes" on public.crews
  for delete to authenticated
  using (creator = auth.uid());

create policy "crew_members: members read" on public.crew_members
  for select to authenticated
  using (public.is_crew_member(crew_id));
create policy "crew_members: own display name" on public.crew_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "crew_members: a member leaves, the creator removes" on public.crew_members
  for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.crews c where c.id = crew_id and c.creator = auth.uid()));

create policy "push_subscriptions: own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RPCs -----------------------------------------------------------------------
-- What a plain write cannot do. Each refuses a caller who is not signed in, and
-- each error carries a code the tests assert: 42501 not signed in or not the
-- creator, P0002 no crew has that invite, 53400 the crew is full, 22023 no
-- such year; a name out of bounds fails the table's check, 23514.

-- The crew and its creator's membership, in one transaction.
create function public.create_crew(year integer, name text, display_name text) returns public.crews
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  crew public.crews;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if create_crew.year is null or create_crew.year not between 2026 and 2099 then
    raise exception 'no such year: %', create_crew.year using errcode = '22023';
  end if;
  insert into public.crews (year, name, creator)
    values (create_crew.year, btrim(create_crew.name), auth.uid())
    returning * into crew;
  insert into public.crew_members (crew_id, user_id, display_name)
    values (crew.id, auth.uid(), btrim(create_crew.display_name));
  return crew;
end
$$;

-- The caller holds a token, not an id. The crew's row is locked, so two joins
-- at the cap cannot both pass; an existing member gets the crew back as it is.
create function public.join_crew(token text, display_name text) returns public.crews
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  crew public.crews;
  cap integer;
  size integer;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into crew from public.crews c where c.invite_token = join_crew.token for update;
  if not found then
    raise exception 'no crew has that invite' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.crew_members m where m.crew_id = crew.id and m.user_id = auth.uid()) then
    return crew;
  end if;
  select (f.value #>> '{}')::integer into cap from public.flags f where f.name = 'crew_size_cap';
  select count(*) into size from public.crew_members m where m.crew_id = crew.id;
  if size >= coalesce(cap, 0) then
    raise exception 'the crew is full' using errcode = '53400';
  end if;
  insert into public.crew_members (crew_id, user_id, display_name)
    values (crew.id, auth.uid(), btrim(join_crew.display_name));
  return crew;
end
$$;

-- The creator alone; the server picks the new secret, and the old one joins
-- nothing.
create function public.regenerate_invite(crew_id uuid) returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  token text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  update public.crews c
    set invite_token = public.new_invite_token()
    where c.id = regenerate_invite.crew_id and c.creator = auth.uid()
    returning c.invite_token into token;
  if token is null then
    raise exception 'only the crew''s creator can do that' using errcode = '42501';
  end if;
  return token;
end
$$;

-- Grants, by name ------------------------------------------------------------
-- Nothing for anon. authenticated gets the five client tables only, and an
-- update only of the columns a plain write may change; the job tables get
-- nothing. service_role keeps Supabase's grants: the jobs are its.
revoke all on
  public.picks, public.follows, public.crews, public.crew_members, public.push_subscriptions,
  public.schedule_events, public.schedule_changes, public.push_sent, public.mirror_state, public.flags
  from anon, authenticated;

grant select, insert on public.picks to authenticated;
grant update (picked, changed_at) on public.picks to authenticated;
grant select, insert on public.follows to authenticated;
grant update (followed, changed_at) on public.follows to authenticated;
grant select, delete on public.crews to authenticated;
grant update (name) on public.crews to authenticated;
grant select, delete on public.crew_members to authenticated;
grant update (display_name) on public.crew_members to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant update (p256dh, auth, last_seen_at) on public.push_subscriptions to authenticated;

revoke all on function
  public.new_invite_token(), public.clamp_changed_at(), public.latest_stamp_wins(),
  public.is_crew_member(uuid), public.shares_crew_with(uuid, integer),
  public.create_crew(integer, text, text), public.join_crew(text, text), public.regenerate_invite(uuid)
  from public, anon, authenticated;

grant execute on function
  public.is_crew_member(uuid), public.shares_crew_with(uuid, integer),
  public.create_crew(integer, text, text), public.join_crew(text, text), public.regenerate_invite(uuid)
  to authenticated;
