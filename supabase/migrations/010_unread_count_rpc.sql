-- 010_unread_count_rpc.sql
-- Atomic function that recomputes a conversation's unread_count from the messages table.

create or replace function public.recompute_unread_count(p_conversation_id uuid)
returns void
as $$
begin
  update public.conversations c
  set unread_count = (
    select count(*) from public.messages m
    where m.conversation_id = c.id
      and m.direction = 'in'
      and m.read_at is null
  )
  where c.id = p_conversation_id;
end;
$$ language plpgsql security definer;

-- Allow authenticated users to call it
grant execute on function public.recompute_unread_count(uuid) to authenticated;
grant execute on function public.recompute_unread_count(uuid) to service_role;