-- Track when each subscriber's most recent confirm_token was issued so we can
-- enforce a minimum elapsed time before the confirmation link can be used.
-- Bots that auto-click the confirm link within seconds of signup will be
-- blocked; humans always take longer than the threshold (open inbox, etc.).
--
-- For existing rows the column stays NULL; the confirm endpoint falls back to
-- created_at when the column is NULL so already-pending tokens keep working.

alter table public.subscribers
  add column if not exists confirm_token_issued_at timestamptz;
