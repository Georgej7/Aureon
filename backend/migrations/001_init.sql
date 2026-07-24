-- Aureon initial schema: user profiles (natal chart + numerology) and persistent chat.
-- Run this once in the Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Requires the pgcrypto extension for gen_random_uuid(), which Supabase enables by default.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  birth_date date,
  birth_time time,
  birth_location text,
  latitude double precision,
  longitude double precision,
  utc_offset double precision,
  chart jsonb,
  numerology jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);


create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_sessions enable row level security;

create policy "Users manage own chat sessions"
  on chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "Users manage own chat messages"
  on chat_messages for all
  using (
    exists (
      select 1 from chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );

create index if not exists chat_messages_session_id_idx on chat_messages (session_id, created_at);
create index if not exists chat_sessions_user_id_idx on chat_sessions (user_id, updated_at desc);
