-- Adds the Practitioner-tier check that the client roster (clients table,
-- 006_clients.sql) was missing. That table is read/written straight from
-- the browser via the Supabase client (frontend/app/clients/page.tsx and
-- clients/[id]/page.tsx), not proxied through the FastAPI backend the way
-- chart endpoints are -- so unlike vedic/synastry/solar-return/etc, there
-- was never a server-side tier gate on it at all, only ownership. Any
-- signed-in user, regardless of tier, could insert/select their own rows
-- in a table meant to be Practitioner-exclusive. This is the DB-level fix:
-- since the gate can't live in a backend route, it has to live in the RLS
-- policy itself, referencing the caller's own subscription_tier on
-- profiles. Covers /clients and /clients/[id] together, since both query
-- this same table under this same policy.
--
-- Note: a practitioner who downgrades loses access to their previously
-- saved clients (the policy re-evaluates their *current* tier on every
-- query) -- consistent with how every other paid feature in this app
-- already behaves on downgrade, not a new behavior being introduced here.

drop policy if exists "Practitioners manage own clients" on clients;

create policy "Practitioners manage own clients"
  on clients for all
  using (
    auth.uid() = practitioner_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.subscription_tier = 'practitioner'
    )
  )
  with check (
    auth.uid() = practitioner_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.subscription_tier = 'practitioner'
    )
  );

-- --- Manual verification (run in the Supabase SQL Editor after applying) ---
-- Replace <free-tier-user-uuid> with a real profiles.id whose
-- subscription_tier is not 'practitioner'.
--
-- select set_config('request.jwt.claims', '{"sub":"<free-tier-user-uuid>","role":"authenticated"}', true);
-- set local role authenticated;
--
-- -- Expected: 0 rows affected / RLS-blocked, not a database error
-- insert into clients (practitioner_id, full_name, birth_date)
--   values ('<free-tier-user-uuid>', 'Test Client', '1990-01-01');
--
-- reset role;
