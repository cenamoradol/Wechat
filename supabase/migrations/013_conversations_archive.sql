-- 013_conversations_archive.sql
-- Add archive columns to conversations. When archived, media files are
-- immediately deleted (see inbox actions and storage helper).

alter table public.conversations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

-- Partial index: most conversations are NOT archived, so this is fast.
create index if not exists conversations_archived_idx
  on public.conversations(workspace_id, archived_at desc)
  where archived_at is not null;

-- Composite index for the inbox query that filters by workspace + status
create index if not exists conversations_workspace_active_idx
  on public.conversations(workspace_id, last_message_at desc)
  where archived_at is null;
