-- Full-text search over the knowledge base, so the chat can find relevant content for
-- freeform user questions ("what does deep transformation mean for me?") that don't match
-- an exact topic string, on top of the existing exact-match lookup (topicsForProfile()).
-- Uses Postgres's built-in text search — no external embeddings provider, no new API key,
-- no per-query cost. Weighted so a match in the topic name (A) ranks above a match buried
-- in career_meaning or growth_meaning (D).
-- Run this once in the Supabase project's SQL Editor, after 002_knowledge_base.sql.

alter table knowledge_base
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', topic), 'A') ||
    setweight(to_tsvector('english', definition), 'B') ||
    setweight(to_tsvector('english', traditional_interpretation), 'C') ||
    setweight(to_tsvector('english', modern_interpretation), 'C') ||
    setweight(to_tsvector('english', psychological_interpretation), 'C') ||
    setweight(to_tsvector('english', positive_aspects), 'D') ||
    setweight(to_tsvector('english', challenges), 'D') ||
    setweight(to_tsvector('english', career_meaning), 'D') ||
    setweight(to_tsvector('english', relationship_meaning), 'D') ||
    setweight(to_tsvector('english', growth_meaning), 'D')
  ) stored;

create index if not exists knowledge_base_search_idx on knowledge_base using gin (search_vector);
