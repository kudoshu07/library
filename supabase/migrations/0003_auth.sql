-- Magic-link login tokens, server-side sessions, and the per-subscriber
-- "notify on reply" preference used by the comments feature.
-- Apply via Supabase Dashboard > SQL Editor (same flow as 0001 and 0002).

alter table public.subscribers
  add column if not exists notify_on_reply boolean not null default true;

create table if not exists public.login_tokens (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_tokens_subscriber_recent_idx
  on public.login_tokens (subscriber_id, created_at desc);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_subscriber_idx
  on public.sessions (subscriber_id);

-- Same RLS posture as 0001: deny all; the Next.js API uses the service role key.
alter table public.login_tokens enable row level security;
alter table public.sessions enable row level security;
