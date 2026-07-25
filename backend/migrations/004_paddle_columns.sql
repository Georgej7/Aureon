-- Renames the payment-processor columns added in 003_subscriptions.sql from
-- Stripe naming to Paddle naming — the project switched processors before
-- Stripe billing ever went live (Stripe doesn't support Georgia as a seller
-- country; Paddle does, and as merchant of record also handles EU VAT
-- automatically). Run this once in the Supabase project's SQL Editor.

alter table profiles rename column stripe_customer_id to paddle_customer_id;
alter table profiles rename column stripe_subscription_id to paddle_subscription_id;

alter index if exists profiles_stripe_customer_id_idx rename to profiles_paddle_customer_id_idx;
