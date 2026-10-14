-- Fase 9: preferencias de notificación y suscripciones push por usuario.
-- notification_prefs: booleanos por evento que el usuario quiere recibir push.
-- push_subscriptions: una fila por suscripción del navegador (un usuario puede
-- tener varios dispositivos/navegadores). Borradas al desuscribirse.

alter table public.profiles
  add column if not exists notification_prefs jsonb
    default '{"new_message": true, "conversation_assigned": true, "automation_failed": true, "ai_handoff": true, "new_contact": false}'::jsonb;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz default now() not null,
  last_seen_at timestamptz default now() not null
);

create index on public.push_subscriptions(user_id);
create index on public.push_subscriptions(workspace_id);

alter table public.push_subscriptions enable row level security;

-- Los usuarios solo ven/modifican sus propias suscripciones
create policy "push_own" on public.push_subscriptions
  for all using (user_id = auth.uid());

-- Service role necesita bypass de RLS para enviar push desde el server
-- (ya lo tiene por defecto).