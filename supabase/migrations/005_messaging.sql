-- 005_messaging.sql
-- Contacts, contact_channels, conversations, messages, templates + RLS
-- (Moved up from Fase 3 because Fase 2 webhooks need to write here)

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  full_name text,
  email text,
  phone_e164 text,
  avatar_url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.contacts(workspace_id);
create index on public.contacts(workspace_id, phone_e164);
create unique index on public.contacts(workspace_id, phone_e164)
  where phone_e164 is not null;

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade not null,
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_user_id text not null,
  profile jsonb default '{}'::jsonb not null,
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  unique(channel_id, external_user_id)
);

create index on public.contact_channels(contact_id);

create type public.conversation_status as enum ('open', 'pending', 'closed');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  contact_channel_id uuid references public.contact_channels(id) on delete cascade not null,
  status public.conversation_status default 'open' not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz default now() not null,
  last_message_preview text,
  unread_count int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(contact_channel_id)
);

create index on public.conversations(workspace_id, last_message_at desc);
create index on public.conversations(workspace_id, status);

create type public.message_direction as enum ('in', 'out');
create type public.message_type as enum (
  'text', 'image', 'video', 'audio', 'document',
  'template', 'interactive', 'reaction', 'story_reply', 'system'
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  external_id text,
  direction public.message_direction not null,
  type public.message_type default 'text' not null,
  text text,
  media_url text,
  media_mime text,
  template_id text,
  template_vars jsonb,
  reactions jsonb default '[]'::jsonb not null,
  status text default 'sent',
  error_code text,
  error_message text,
  raw_payload jsonb,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

create index on public.messages(conversation_id, created_at);
create index on public.messages(external_id) where external_id is not null;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade not null,
  external_id text not null,
  name text not null,
  language text not null,
  status text not null,
  category text,
  components jsonb not null,
  last_synced_at timestamptz default now() not null,
  unique(channel_id, external_id, language)
);

alter table public.contacts enable row level security;
alter table public.contact_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.templates enable row level security;

create policy "workspace_scoped" on public.contacts
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.contact_channels
  for all using (
    exists(select 1 from public.contacts c
           where c.id = contact_channels.contact_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.conversations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.messages
  for all using (
    exists(select 1 from public.conversations c
           where c.id = messages.conversation_id
             and c.workspace_id in (select public.user_workspace_ids()))
  );

create policy "workspace_scoped" on public.templates
  for all using (
    exists(select 1 from public.channels ch
           where ch.id = templates.channel_id
             and ch.workspace_id in (select public.user_workspace_ids()))
  );

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;