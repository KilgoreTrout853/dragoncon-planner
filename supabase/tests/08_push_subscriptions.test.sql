-- A browser's subscription is its user's alone (contract, section 2): they add,
-- read, refresh and remove their own; they cannot add one for someone else or
-- hand theirs over. A stranger reads none of it - 02_stranger.test.sql - and on
-- recovery a phone subscribes afresh, so no endpoint ever changes hands.
begin;
select plan(7);

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-a000-000000000008', 'ada.8@example.test'),
  ('b0000000-0000-4000-a000-000000000008', 'bo.8@example.test');

select pg_temp.as_user('a0000000-0000-4000-a000-000000000008');
select lives_ok(
  $$ insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
     values ('https://push.example.test/ada-8', 'a0000000-0000-4000-a000-000000000008', 'key', 'secret') $$,
  'a reader subscribes this browser');
select results_eq(
  $$ select endpoint, p256dh from public.push_subscriptions $$,
  $$ values ('https://push.example.test/ada-8'::text, 'key'::text) $$,
  'and reads their own subscription back');
select lives_ok(
  $$ update public.push_subscriptions set last_seen_at = now(), p256dh = 'key-2'
     where endpoint = 'https://push.example.test/ada-8' $$,
  'and refreshes its keys and when it was last seen');
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
     values ('https://push.example.test/bo-8', 'b0000000-0000-4000-a000-000000000008', 'key', 'secret') $$,
  '42501', null, 'a reader cannot subscribe someone else');
select throws_ok(
  $$ update public.push_subscriptions set user_id = 'b0000000-0000-4000-a000-000000000008'
     where endpoint = 'https://push.example.test/ada-8' $$,
  '42501', null, 'a subscription cannot be handed to another user');
delete from public.push_subscriptions where endpoint = 'https://push.example.test/ada-8';

reset role;
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example.test/ada-8'),
  0, 'a reader removes their own subscription');
select is(
  (select count(*)::int from public.push_subscriptions where user_id = 'b0000000-0000-4000-a000-000000000008'),
  0, 'and nothing was written in the other reader''s name');

select * from finish();
rollback;
