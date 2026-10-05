-- 009_messages_read.sql
-- Add per-message read tracking and seed unread_count for existing conversations.

alter table public.messages
  add column if not exists read_at timestamptz;

-- Index to quickly count unread messages per conversation
create index if not exists messages_unread_idx
  on public.messages(conversation_id)
  where read_at is null and direction = 'in';

-- Seed unread_count for any existing conversations that have unread inbound messages
update public.conversations c
set unread_count = (
  select count(*) from public.messages m
  where m.conversation_id = c.id
    and m.direction = 'in'
    and m.read_at is null
)
where exists (
  select 1 from public.messages m
  where m.conversation_id = c.id
    and m.direction = 'in'
    and m.read_at is null
);