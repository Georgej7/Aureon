-- Corrects a design flaw in 009_protect_billing_columns.sql, already
-- applied to production and left completely unmodified here -- this is a
-- new, later migration, not an edit to that one.
--
-- 009's `revoke update (four billing columns) ... from authenticated` only
-- ever removed a COLUMN-level ACL entry. It had no practical effect,
-- because `authenticated` also holds Supabase's default TABLE-level UPDATE
-- grant on profiles (from the project's initial `grant all on all tables
-- in schema public to authenticated` bootstrap, run when the project was
-- created), and Postgres's privilege check for a column allows access if
-- EITHER the table-level OR the column-level ACL permits it -- a
-- column-level REVOKE cannot subtract from a table-level GRANT that
-- already exists. Confirmed directly against production before writing
-- this: information_schema.table_privileges showed
-- `authenticated | UPDATE | NO` on profiles, and pg_attribute.attacl was
-- NULL for all four billing columns (the column-level revoke succeeded
-- exactly as written -- it just was never the grant that mattered).
--
-- Important: the actual vulnerability has NOT been open at any point since
-- 009 was applied. The protect_billing_columns trigger fires on every
-- UPDATE regardless of which privilege path let the statement through,
-- and has been correctly rejecting every non-service_role write that
-- changes a billing column the whole time. This migration restores the
-- second, independent privilege-layer defense that was supposed to exist
-- alongside it, and additionally closes an INSERT-side path the original
-- design never considered at all (Part 3 below).
--
-- Every column in the allow-list below was found by searching the actual
-- repository for every write to `profiles` (both frontend and backend) --
-- not carried over from an earlier assumption. The only non-service_role
-- write path anywhere in the codebase is frontend/app/onboarding/page.tsx's
-- upsert(), which sets exactly: id, full_name, birth_date, birth_time,
-- birth_location, latitude, longitude, utc_offset, gender, chart,
-- numerology, updated_at. `id` is included deliberately: Supabase/
-- PostgREST's upsert (ON CONFLICT DO UPDATE) lists every payload column in
-- its SET clause, including the conflict column itself
-- (`id = excluded.id`, a same-value no-op) -- omitting UPDATE privilege on
-- `id` would make the onboarding upsert fail with a permission error on
-- every re-save, not just first creation. No other authenticated write
-- path exists anywhere in the backend or frontend (verified by grep across
-- both, not assumed).

begin;

-- === Part 1: UPDATE privilege correction ===
-- Remove the table-level grant entirely, then re-grant column-level UPDATE
-- on exactly the legitimate columns. The four billing columns are
-- deliberately excluded from this list.
revoke update on profiles from authenticated;

grant update (
  id,
  full_name,
  birth_date,
  birth_time,
  birth_location,
  latitude,
  longitude,
  utc_offset,
  gender,
  chart,
  numerology,
  updated_at
) on profiles to authenticated;

-- === Part 2: INSERT privilege correction ===
-- The same table-level-grant issue applies to INSERT and was never
-- addressed by 009 at all -- 009's trigger only fired BEFORE UPDATE, so a
-- brand-new user (an auth.users row with no profiles row yet) could call
-- PostgREST's insert endpoint directly and create their own profiles row
-- with subscription_tier already set to 'practitioner', bypassing both of
-- 009's protections entirely. This is a genuinely separate gap from the
-- one 009 was meant to close, not a continuation of the same bug. Same
-- fix shape: remove the table-level INSERT grant, re-grant column-level
-- INSERT only on the columns the onboarding upsert actually needs to
-- create a row. Billing columns excluded -- a first-time row gets them
-- from their column defaults ('free' / 'active' / null / null, from
-- 003_subscriptions.sql and 004_paddle_columns.sql), which is exactly the
-- intended behavior for a non-paying signup.
revoke insert on profiles from authenticated;

grant insert (
  id,
  full_name,
  birth_date,
  birth_time,
  birth_location,
  latitude,
  longitude,
  utc_offset,
  gender,
  chart,
  numerology,
  updated_at
) on profiles to authenticated;

-- === Part 3: extend the trigger to also cover INSERT ===
-- This is a `create or replace function` in a new migration, the normal
-- way a Postgres function is evolved across migrations -- the same
-- pattern 004_paddle_columns.sql and 007_practitioner_tier.sql already
-- used to amend objects 003_subscriptions.sql created. 009's file itself
-- is untouched. The UPDATE branch below keeps 009's exact original
-- behavior and column list, unchanged; only a new INSERT branch is added.
-- There's no OLD row to compare against on INSERT, so it checks NEW
-- against each billing column's actual schema default instead -- the
-- "nothing suspicious happened" baseline for a fresh signup.
create or replace function profiles_protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if TG_OP = 'INSERT' then
      if new.subscription_tier is distinct from 'free'
        or new.subscription_status is distinct from 'active'
        or new.paddle_customer_id is not null
        or new.paddle_subscription_id is not null
      then
        raise exception 'subscription/billing fields can only be set by the billing system';
      end if;
    elsif TG_OP = 'UPDATE' then
      if new.subscription_tier is distinct from old.subscription_tier
        or new.subscription_status is distinct from old.subscription_status
        or new.paddle_customer_id is distinct from old.paddle_customer_id
        or new.paddle_subscription_id is distinct from old.paddle_subscription_id
      then
        raise exception 'subscription/billing fields can only be changed by the billing system';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on profiles;
create trigger protect_billing_columns
  before insert or update on profiles
  for each row
  execute function profiles_protect_billing_columns();

commit;

-- --- Verification (run in the Supabase SQL Editor after applying) ---
-- Queries 1-2 are pure metadata reads, zero data risk. Query 3 performs
-- real writes and must only ever be run against a disposable test account
-- you create for this purpose -- never a real customer's row.
--
-- 1. Confirm no table-level grant remains for authenticated:
-- select grantee, privilege_type, is_grantable
-- from information_schema.table_privileges
-- where table_name = 'profiles' and grantee = 'authenticated';
-- -- expect: zero rows
--
-- 2. Confirm exactly the 12 safe columns carry column-level privilege,
--    and none of the 4 billing columns do:
-- select privilege_type, column_name
-- from information_schema.column_privileges
-- where table_name = 'profiles' and grantee = 'authenticated'
-- order by privilege_type, column_name;
--
-- select tgname, tgenabled, tgtype
-- from pg_trigger
-- where tgrelid = 'profiles'::regclass and tgname = 'protect_billing_columns';
-- -- expect: one row, tgenabled = 'O', tgtype reflecting BEFORE INSERT OR UPDATE
--
-- 3. Behavioral test against a throwaway test account only
-- (<test-user-uuid> = that account's real id):
-- select set_config('request.jwt.claims', '{"sub":"<test-user-uuid>","role":"authenticated"}', true);
-- set local role authenticated;
-- update profiles set full_name = full_name where id = '<test-user-uuid>';
-- -- expect: succeeds
-- update profiles set subscription_tier = 'practitioner' where id = '<test-user-uuid>';
-- -- expect: ERROR (permission denied for column, or the trigger's own
-- -- exception -- either is correct; both layers now independently reject it)
-- reset role;
-- delete from profiles where id = '<test-user-uuid>'; -- as an admin, to reset for the insert test
-- select set_config('request.jwt.claims', '{"sub":"<test-user-uuid>","role":"authenticated"}', true);
-- set local role authenticated;
-- insert into profiles (id, full_name, birth_date, subscription_tier)
--   values ('<test-user-uuid>', 'Test', '1990-01-01', 'practitioner');
-- -- expect: ERROR -- same two-layer rejection, now on the insert path
-- insert into profiles (id, full_name, birth_date)
--   values ('<test-user-uuid>', 'Test', '1990-01-01');
-- -- expect: succeeds (billing columns omitted, take their defaults)
-- reset role;
--
-- select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- set local role service_role;
-- update profiles set subscription_tier = 'premium' where id = '<test-user-uuid>';
-- -- expect: succeeds
-- reset role;
