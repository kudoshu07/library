-- Blog post comments + per-comment likes.
-- Apply via Supabase Dashboard > SQL Editor (same flow as 0001-0003).

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  parent_id uuid references public.comments(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (length(body) between 1 and 1000)
);

-- The 2-level nesting cap (post -> comment -> reply) is enforced in the
-- API layer. A DB trigger could enforce it as well but adds complexity for
-- little gain at our scale.

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at);

create index if not exists comments_subscriber_idx
  on public.comments (subscriber_id);

create index if not exists comments_subscriber_recent_idx
  on public.comments (subscriber_id, created_at desc);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, subscriber_id)
);

create index if not exists comment_likes_subscriber_idx
  on public.comment_likes (subscriber_id);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
