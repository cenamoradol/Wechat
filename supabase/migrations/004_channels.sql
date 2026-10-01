-- 004_channels.sql
-- Channels table + webhook events table + RLS

create type public.channel_type as enum ('whatsapp', 'facebook', 'instagram');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type public.channel_type not null,
  external_id text not null,
  display_name text not null,
  access_token_enc bytea not null,
  webhook_secret_enc bytea,
  meta jsonb,
  status text default 'connected' not null,
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(workspace_id, type, external_id)
);

create index on public.channels(workspace_id);
create index on public.channels(type);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  type text not null,
  processed boolean default false,
  payload jsonb not null,
  error text,
  received_at timestamptz default now() not null
);

create index on public.webhook_events(channel_id, received_at desc);
create index on public.webhook_events(received_at desc);

alter table public.channels enable row level security;
alter table public.webhook_events enable row level security;

create policy "channels_workspace_members" on public.channels
  for all using (workspace_id in (select public.user_workspace_ids()));

-- webhook_events: solo service_role (server-side) — no policy para usuarios normales

-- Storage bucket para avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;