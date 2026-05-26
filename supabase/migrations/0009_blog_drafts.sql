-- Blog drafts for the owner-only authoring UI.
-- Published posts live as MDX files in content/blog/YYYY/MM/DD/{slug}.mdx
-- and are committed via the GitHub API. This table only holds in-progress
-- drafts so we never bloat Supabase with full post bodies long-term: a draft
-- row is deleted as soon as its post is published.
--
-- source_path is non-null when the draft was created by importing an existing
-- published MDX file (the "edit" button on a public post). On publish, that
-- path is the target to overwrite; if slug/date changed, the old file is
-- deleted and a new one created in the same commit.
--
-- Same RLS posture as 0001/0003: deny all; the Next.js API uses the service
-- role key after verifying session.isOwner.

create table if not exists public.blog_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  title text not null default '',
  slug text not null default '',
  publish_date timestamptz,
  summary text not null default '',
  tags text[] not null default '{}',
  thumbnail_url text,
  body_html text not null default '',
  body_blocks jsonb,
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_drafts_owner_updated_idx
  on public.blog_drafts (owner_subscriber_id, updated_at desc);

create index if not exists blog_drafts_source_path_idx
  on public.blog_drafts (source_path)
  where source_path is not null;

alter table public.blog_drafts enable row level security;
