-- 014_messages_media.sql
-- Add media columns to messages + soft delete + workspace storage limit.

-- Extend media fields for richer metadata
alter table public.messages
  add column if not exists media_filename text,
  add column if not exists media_size_bytes bigint,
  add column if not exists media_duration_seconds int,
  add column if not exists media_thumbnail_url text,
  add column if not exists media_meta_id text;

-- Soft delete for messages (text/media cleared, row kept 30d then hard-deleted)
alter table public.messages
  add column if not exists deleted_at timestamptz;

create index if not exists messages_deleted_idx
  on public.messages(deleted_at)
  where deleted_at is not null;

-- Per-workspace configurable storage limit
alter table public.workspaces
  add column if not exists storage_limit_bytes bigint default 1073741824,
  add column if not exists storage_unlimited boolean default false;

comment on column public.workspaces.storage_limit_bytes is
  'Max bytes of media storage per workspace. Default 1GB.';
comment on column public.workspaces.storage_unlimited is
  'If true, skip storage quota check. Use carefully.';