-- Aureon subscription state: adds Stripe/subscription columns to profiles.
-- Run this once in the Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Written from a server context only (the Next.js webhook route, using the
-- service_role key), never by the browser client, so no new RLS policy is needed
-- beyond the existing "Users manage own profile" policy already covering reads
-- for the owning user.

alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium', 'vip')),
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('active', 'past_due', 'canceled', 'incomplete'));

create unique index if not exists profiles_stripe_customer_id_idx
  on profiles (stripe_customer_id)
  where stripe_customer_id is not null;
