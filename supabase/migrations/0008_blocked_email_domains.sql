-- Email-domain blocklist managed at runtime.
-- Static throwaway-domain knowledge lives in lib/disposable-emails.ts.
-- This table holds runtime additions made via the Slack
-- "ブロックリスト追加" button on new-subscriber notifications.

create table if not exists public.blocked_email_domains (
  domain text primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_email_domains enable row level security;

create index if not exists blocked_email_domains_created_at_idx
  on public.blocked_email_domains (created_at desc);
