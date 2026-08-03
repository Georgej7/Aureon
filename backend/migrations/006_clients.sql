-- Client roster: lets a practitioner account save and manage multiple other
-- people's charts, not just their own -- the foundational piece for
-- professional (Practitioner-tier) use, distinct from the personal `profiles`
-- table. Run this once in the Supabase project's SQL Editor, after 001_init.sql.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  birth_time time,
  birth_location text,
  latitude double precision,
  longitude double precision,
  utc_offset double precision,
  time_known boolean not null default true,
  chart jsonb,
  numerology jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients enable row level security;

-- Same single "for all" policy pattern as profiles -- a practitioner has
-- full CRUD over their own clients and no visibility into anyone else's.
create policy "Practitioners manage own clients"
  on clients for all
  using (auth.uid() = practitioner_id)
  with check (auth.uid() = practitioner_id);

create index if not exists clients_practitioner_idx on clients (practitioner_id, updated_at desc);
