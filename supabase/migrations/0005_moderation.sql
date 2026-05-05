-- Owner moderation: per-subscriber BAN flag.
-- BAN blocks all write operations (post, reply, like, edit) but keeps
-- existing comments visible. Apply via Supabase Dashboard > SQL Editor.

alter table public.subscribers
  add column if not exists banned boolean not null default false;

alter table public.subscribers
  add column if not exists banned_at timestamptz;

create index if not exists subscribers_banned_idx
  on public.subscribers (banned)
  where banned = true;
