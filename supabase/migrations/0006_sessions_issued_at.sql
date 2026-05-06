-- Track when a session was first issued so the sliding-renewal logic in
-- lib/auth.ts can enforce an absolute lifetime cap (currently 365 days)
-- on top of the rolling expires_at extension.

alter table public.sessions
  add column if not exists issued_at timestamptz not null default now();
