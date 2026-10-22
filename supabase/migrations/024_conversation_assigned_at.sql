-- 024_conversation_assigned_at.sql
-- Timestamp of when a conversation was handed to a human. Needed to expire
-- the AI pause: conversations.assigned_to has no timestamp and
-- conversations.updated_at is NOT maintained by a trigger (it only holds the
-- INSERT default), so there was no way to tell a 5-minute-old assignment
-- from a three-day-old one.

alter table public.conversations
  add column if not exists assigned_at timestamptz;

comment on column public.conversations.assigned_at is
  'When assigned_to was last set. NULL means "not assigned" or "assigned before this column existed" (treated as expired so the AI never stays silent forever).';

-- Legacy rows: give them the 2h window from now rather than treating them
-- as fresh (which would block the AI indefinitely) or as ancient (which
-- would ignore a real handoff that just happened).
update public.conversations
set assigned_at = now()
where assigned_to is not null
  and assigned_at is null;