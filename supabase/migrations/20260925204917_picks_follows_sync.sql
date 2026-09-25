-- Picks and follows sync (DECISIONS #53; docs/sync/contract.md, section 5):
-- the server's stamp a pull reads by, the caller as a row's user by default,
-- the key columns granted so the upsert PostgREST sends can name them, a
-- trigger that keeps every key as it is, and the indexes the pull reads by.
-- The first migration is never edited; this is a new file.

-- synced_at is the server's: when a row was written, set on every insert and
-- on every update the latest-wins trigger accepts. A pull reads the rows newer
-- than its watermark by it, never by changed_at, which a change drained late
-- carries from hours before. The default fills the rows already there; the
-- trigger below sets every write's.
alter table public.picks   add column synced_at timestamptz not null default now();
alter table public.follows add column synced_at timestamptz not null default now();

-- The client never sends user_id: a row it writes is the caller's.
alter table public.picks   alter column user_id set default auth.uid();
alter table public.follows alter column user_id set default auth.uid();

-- PostgREST's upsert (Prefer: resolution=merge-duplicates) writes every column
-- of its payload into DO UPDATE SET, the key columns among them, and Postgres
-- checks the update grant on each one before it knows whether a row conflicts.
-- So the key columns are granted, and the trigger below keeps them as they
-- are: a pick never moves to another event, and a follow never to another key.
grant update (year, event_id)  on public.picks   to authenticated;
grant update (year, kind, key) on public.follows to authenticated;

create function public.pick_keys_stay() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id or new.year is distinct from old.year
     or new.event_id is distinct from old.event_id then
    raise exception 'a pick''s user, year and event never change' using errcode = '42501';
  end if;
  return new;
end
$$;

create function public.follow_keys_stay() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id or new.year is distinct from old.year
     or new.kind is distinct from old.kind or new.key is distinct from old.key then
    raise exception 'a follow''s user, year, kind and key never change' using errcode = '42501';
  end if;
  return new;
end
$$;

-- The row's own time, not the transaction's: rows written together still come
-- out in the order they were written, each close to its commit.
create function public.stamp_synced_at() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end
$$;

-- Postgres fires a table's BEFORE triggers in name order. The keys first, so a
-- move is refused whatever its stamp; then the clamp and latest-wins, as the
-- first migration has them; synced_at last, so a write latest-wins turns away -
-- it returns no row, and no later trigger fires - keeps the stamp it had.
create trigger picks_0_keys before update on public.picks
  for each row execute function public.pick_keys_stay();
create trigger picks_3_synced before insert or update on public.picks
  for each row execute function public.stamp_synced_at();
create trigger follows_0_keys before update on public.follows
  for each row execute function public.follow_keys_stay();
create trigger follows_3_synced before insert or update on public.follows
  for each row execute function public.stamp_synced_at();

-- The pull reads one's own rows by user and synced_at; nothing reads by
-- changed_at any more.
drop index public.picks_by_user_changed;
drop index public.follows_by_user_changed;
create index picks_by_user_synced   on public.picks (user_id, synced_at);
create index follows_by_user_synced on public.follows (user_id, synced_at);

revoke all on function
  public.pick_keys_stay(), public.follow_keys_stay(), public.stamp_synced_at()
  from public, anon, authenticated;
