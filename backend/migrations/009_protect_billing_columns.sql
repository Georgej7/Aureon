-- Closes the tier self-escalation hole: profiles' only RLS policy ("Users
-- manage own profile", from 001_init.sql) is a blanket "owner can write
-- every column" rule. RLS is row-level only -- it cannot restrict which
-- *columns* an authorized row-update may touch -- so subscription_tier,
-- subscription_status, paddle_customer_id, and paddle_subscription_id were
-- one authenticated PATCH away from being self-granted by any signed-in
-- user, via the same public PostgREST API every legitimate profile edit
-- already uses. Only the Paddle webhook route
-- (frontend/app/api/webhooks/paddle/route.ts, via lib/supabase/admin.ts's
-- service_role client) is meant to ever change these columns.
--
-- Two independent layers, both standard Supabase-documented patterns for
-- this exact problem:

-- 1) Privilege layer -- revoke UPDATE on the billing columns from the
-- `authenticated` role. Supabase's default `grant all on all tables in
-- schema public to authenticated` included column-level UPDATE with no
-- restriction; this narrows it. Enforced by Postgres before RLS is even
-- evaluated, so it holds regardless of any future policy change on this
-- table. `anon` never had table-level access to profiles to begin with
-- (RLS already scopes everything to auth.uid()), so nothing to revoke there.
revoke update (
  subscription_tier,
  subscription_status,
  paddle_customer_id,
  paddle_subscription_id
) on profiles from authenticated;

-- 2) Defense in depth -- a trigger that hard-rejects any write actually
-- changing a billing-controlled column unless the request is authenticated
-- as service_role. auth.role() reads the `role` claim off the PostgREST
-- session JWT: it resolves to 'service_role' for the webhook's admin
-- client, 'authenticated' for a normal user session, and NULL for direct
-- SQL-editor/superuser access with no PostgREST session at all (so manual
-- admin fixes in the Supabase SQL Editor are unaffected -- NULL <>
-- 'service_role' is NULL, which short-circuits the `if` as false). This
-- catches the case revoke #1 doesn't: any future grant that accidentally
-- restores column access, or any other role/path that isn't service_role.
create or replace function profiles_protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.subscription_tier is distinct from old.subscription_tier
      or new.subscription_status is distinct from old.subscription_status
      or new.paddle_customer_id is distinct from old.paddle_customer_id
      or new.paddle_subscription_id is distinct from old.paddle_subscription_id
    then
      raise exception 'subscription/billing fields can only be changed by the billing system';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on profiles;
create trigger protect_billing_columns
  before update on profiles
  for each row
  execute function profiles_protect_billing_columns();

-- --- Manual verification (run in the Supabase SQL Editor after applying) ---
-- Replace <some-real-user-uuid> with an actual profiles.id to test against.
--
-- -- Simulates an authenticated user's own PostgREST session (sub must
-- -- match the row being updated, since RLS's own using/with check clause
-- -- still applies underneath this trigger):
-- select set_config('request.jwt.claims', '{"sub":"<some-real-user-uuid>","role":"authenticated"}', true);
-- set local role authenticated;
--
-- -- Expected: ERROR — subscription/billing fields can only be changed by the billing system
-- update profiles set subscription_tier = 'practitioner' where id = '<some-real-user-uuid>';
--
-- -- Expected: succeeds (not a billing column)
-- update profiles set full_name = full_name where id = '<some-real-user-uuid>';
--
-- reset role;
--
-- -- Simulates the webhook's service_role client — expected: succeeds
-- select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- set local role service_role;
-- update profiles set subscription_tier = 'premium' where id = '<some-real-user-uuid>';
-- reset role;
