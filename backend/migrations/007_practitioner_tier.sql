-- Adds "practitioner" as a valid subscription_tier value -- a separate
-- professional track (client roster, PDF reports) alongside the personal
-- Free/Premium/VIP ladder, not simply "VIP but more expensive". Run this
-- once in the Supabase project's SQL Editor, after 003_subscriptions.sql.

alter table profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'premium', 'vip', 'practitioner'));
