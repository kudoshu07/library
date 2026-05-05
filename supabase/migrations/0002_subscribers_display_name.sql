-- Add display_name to subscribers so newsletter sign-ups can include the
-- name that will later be shown alongside their blog comments.
-- Apply via Supabase Dashboard > SQL Editor (same flow as 0001_newsletter.sql).

alter table public.subscribers
  add column if not exists display_name text;

-- New sign-ups must provide display_name; the API enforces non-empty values.
-- Existing rows are intentionally left null so legacy subscribers can fill the
-- name in later (e.g. when they first try to comment on a blog post).
