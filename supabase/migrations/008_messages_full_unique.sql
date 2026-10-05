-- 008_messages_full_unique.sql
-- Replace the partial unique index with a full one so onConflict (col1, col2)
-- inference works in PostgreSQL/PostgREST. NULL values still allowed because
-- PostgreSQL treats NULL != NULL in unique constraints.

drop index if exists public.messages_external_id_unique;
create unique index messages_external_id_unique
  on public.messages(conversation_id, external_id);