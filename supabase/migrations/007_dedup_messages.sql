-- 007_dedup_messages.sql
-- Prevent duplicate messages from polling/webhook retries
-- (Polling runs every minute and may re-fetch the same messages.)

-- 1. Delete duplicates, keeping the oldest per (conversation_id, external_id)
delete from public.messages
where id in (
  select id from (
    select id,
           row_number() over (
             partition by conversation_id, external_id
             order by created_at asc, id asc
           ) as rn
    from public.messages
    where external_id is not null
  ) t
  where rn > 1
);

-- 2. Enforce uniqueness so future duplicates are rejected by the DB
create unique index messages_external_id_unique
  on public.messages(conversation_id, external_id)
  where external_id is not null;