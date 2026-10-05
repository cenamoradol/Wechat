-- Diagnóstico: ¿por qué el thread no muestra mensajes?

-- 1. ¿Hay conversaciones cuyo contact_channel está roto?
select c.id as conv_id,
       c.last_message_preview,
       ch.type as channel_type,
       cc.id as contact_channel_id,
       cc.external_user_id,
       ct.id as contact_id
from public.conversations c
left join contact_channels cc on cc.id = c.contact_channel_id
left join contacts ct on ct.id = cc.contact_id
left join channels ch on ch.id = cc.channel_id
order by c.last_message_at desc nulls last
limit 10;

-- 2. ¿Hay mensajes con conversation_id que no existe?
select count(*) as orphan_messages
from messages m
where not exists (select 1 from conversations c where c.id = m.conversation_id);

-- 3. ¿Hay mensajes con conversation_id = NULL? (ya verificamos pero por si acaso)
select count(*) as null_conv_msgs from messages where conversation_id is null;

-- 4. ¿Cuál es el conversation_id de la URL cuando abre el chat?
--    Si el usuario abre /inbox?conversation=<X>, X debe estar en la lista
select id, last_message_preview from conversations order by last_message_at desc;

-- 5. ¿Las queries RLS permiten ver los mensajes de cada workspace?
--    Si no, no se ven aunque estén en la DB
select m.id, m.text, m.conversation_id, m.created_at, m.direction,
       c.workspace_id as conv_workspace_id,
       public.user_workspace_ids() as user_workspaces
from messages m
join conversations c on c.id = m.conversation_id
order by m.created_at desc
limit 5;