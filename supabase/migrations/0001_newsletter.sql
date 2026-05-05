-- Newsletter schema for Kudo Shu Library
-- Apply via Supabase Dashboard > SQL Editor (or `supabase db push` if using the CLI).

create extension if not exists "pgcrypto";

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  sources text[] not null default '{}',
  confirmed boolean not null default false,
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

create index if not exists subscribers_confirmed_idx
  on public.subscribers (confirmed)
  where confirmed = true and unsubscribed_at is null;

create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  content_id text not null unique,
  source text not null,
  title text not null,
  url text not null,
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0
);

-- Row Level Security: deny all access by default.
-- The Next.js API routes and the notification script both use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. The anon key is never used to read or write these tables, so there is
-- no need to create permissive policies.
alter table public.subscribers enable row level security;
alter table public.notifications_log enable row level security;
