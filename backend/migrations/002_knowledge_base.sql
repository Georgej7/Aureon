-- Aureon knowledge base: structured, practitioner-reviewable reference content for Western
-- astrology and numerology (PROJECT-BRIEF.md Section 6). Public read-only reference data, not
-- user data — no per-user RLS scoping, just a permissive read policy. Only the seed script
-- (using the service_role key, which bypasses RLS) can write to it.
-- Run this once in the Supabase project's SQL Editor, after 001_init.sql.

create extension if not exists vector;

create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  system text not null,
  category text not null,
  topic text not null,
  definition text not null,
  traditional_interpretation text not null,
  modern_interpretation text not null,
  psychological_interpretation text not null,
  positive_aspects text not null,
  challenges text not null,
  career_meaning text not null,
  relationship_meaning text not null,
  growth_meaning text not null,
  sources text[] not null,
  confidence_level text not null,
  context_notes jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (system, category, topic)
);

alter table knowledge_base enable row level security;

create policy "Anyone can read the knowledge base"
  on knowledge_base for select
  using (true);

create index if not exists knowledge_base_lookup_idx on knowledge_base (system, category, topic);
