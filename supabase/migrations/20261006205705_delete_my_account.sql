-- Delete my account (DECISIONS #93; docs/sync/contract.md, sections 1 and 3):
-- the fourth RPC, the one way a reader removes what the server keeps for them.
-- No table, policy or table grant changes. A merged migration is never edited:
-- this is a new file.

-- The caller's own user, and no one else's: there is no id to pass. In one
-- transaction, in this order: a crew the caller made that holds no one else
-- goes, any year, since its name would be left where no one could read or
-- remove it - a crew with anyone else in it stays, its creator set null by the
-- foreign key; then the Auth server's audit rows that name the caller as
-- their actor, which carry the id and, once one was added, the email; then
-- the row of auth.users, whose foreign keys take the picks, the follows, the
-- memberships, the subscriptions and the push ledger (07_cascades.test.sql).
-- A caller whose user is already gone - a token that outlived it - finds
-- nothing in each and gets the same answer, so a request whose answer was
-- lost can be made again.
create function public.delete_my_account() returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  delete from public.crews c
    where c.creator = me
      and not exists (select 1 from public.crew_members m where m.crew_id = c.id and m.user_id <> me);
  delete from auth.audit_log_entries a where a.payload ->> 'actor_id' = me::text;
  delete from auth.users u where u.id = me;
end
$$;

-- Its grant, by name, as the three before it: not PUBLIC's, not anon's.
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
