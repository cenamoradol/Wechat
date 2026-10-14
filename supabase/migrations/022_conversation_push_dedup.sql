-- Fase 9: dedup de push por conversación (ventana de 20s).
-- Cuando un cliente manda varios mensajes seguidos, solo se manda el primer
-- push; los siguientes dentro de la ventana se ignoran. La columna rastrea
-- el último push enviado por conversación para esa decisión.

alter table public.conversations
  add column if not exists push_last_sent_at timestamptz;