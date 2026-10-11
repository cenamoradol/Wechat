-- Fase 7: AI Agents
-- Tablas: ai_agents, ai_knowledge_docs, ai_messages, ai_provider_keys
-- Full re-runnable (idempotent for tables, FK, policies, indexes)

-- 1. Column on conversations
alter table public.conversations
  add column if not exists ai_agent_id uuid;

-- 2. ai_agents
create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  provider text not null check (provider in ('openai', 'anthropic')),
  model text not null,
  system_prompt text not null,
  temperature numeric(3,2) default 0.7 not null,
  max_tokens int default 1024 not null,
  kb_enabled boolean default false not null,
  auto_reply_enabled boolean default false not null,
  max_replies_per_conversation int default 5 not null,
  handoff_keywords text[] default '{}'::text[] not null,
  is_default boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists one_default_agent_per_workspace
  on public.ai_agents(workspace_id) where is_default;

-- 3. ai_knowledge_docs
create table if not exists public.ai_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  title text not null,
  source_url text,
  content text not null,
  tokens int,
  tsv tsvector generated always as (
    to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,''))
  ) stored,
  created_at timestamptz default now() not null
);

create index if not exists ai_knowledge_docs_tsv_idx
  on public.ai_knowledge_docs using gin(tsv);
create index if not exists ai_knowledge_docs_agent_idx
  on public.ai_knowledge_docs(agent_id);

-- 4. ai_messages
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.ai_agents(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  created_at timestamptz default now() not null
);

create index if not exists ai_messages_conv_idx
  on public.ai_messages(conversation_id, created_at);
create index if not exists ai_messages_agent_idx
  on public.ai_messages(agent_id, created_at desc);

-- 5. ai_provider_keys
create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  api_key_enc bytea not null,
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now() not null,
  unique(workspace_id, provider)
);

-- 6. FK on conversations.ai_agent_id -> ai_agents.id
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'conversations_ai_agent_fk'
  ) then
    alter table public.conversations
      add constraint conversations_ai_agent_fk
      foreign key (ai_agent_id) references public.ai_agents(id) on delete set null;
  end if;
end $$;

create index if not exists conversations_ai_agent_idx
  on public.conversations(ai_agent_id) where ai_agent_id is not null;

-- 7. RLS — enable on each table (no-op if already enabled)
alter table public.ai_agents enable row level security;
alter table public.ai_knowledge_docs enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_provider_keys enable row level security;

-- 8. Policies — drop+recreate for idempotency
drop policy if exists "workspace_scoped" on public.ai_agents;
create policy "workspace_scoped" on public.ai_agents
  for all using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "workspace_scoped" on public.ai_knowledge_docs;
create policy "workspace_scoped" on public.ai_knowledge_docs
  for all using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "workspace_scoped" on public.ai_messages;
create policy "workspace_scoped" on public.ai_messages
  for all using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "workspace_scoped" on public.ai_provider_keys;
create policy "workspace_scoped" on public.ai_provider_keys
  for all using (workspace_id in (select public.user_workspace_ids()));