-- Fase 6: Automatizaciones
-- Tablas: automations, automation_runs
-- Trigger: ejecuta evaluateTriggers desde el webhook handler (no SQL trigger)

create type public.automation_status as enum ('active', 'paused', 'draft');

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  trigger jsonb not null,                          -- ver src/lib/automations/types.ts
  steps jsonb not null default '[]'::jsonb,
  status public.automation_status default 'draft' not null,
  created_by uuid references public.profiles(id),
  last_run_at timestamptz,
  run_count int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index on public.automations(workspace_id, status);
create index on public.automations(workspace_id, created_at desc);

create type public.run_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status public.run_status default 'pending' not null,
  current_step int default 0 not null,
  log jsonb default '[]'::jsonb not null,
  trigger_data jsonb default '{}'::jsonb not null,
  scheduled_at timestamptz,            -- para waits
  started_at timestamptz default now() not null,
  completed_at timestamptz
);

create index on public.automation_runs(automation_id, started_at desc);
create index on public.automation_runs(workspace_id, status, started_at desc);
create index on public.automation_runs(status, scheduled_at) where status = 'pending';

-- RLS
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create policy "workspace_scoped" on public.automations
  for all using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_scoped" on public.automation_runs
  for all using (workspace_id in (select public.user_workspace_ids()));

-- Helper: bump last_run_at and run_count on automations when a run completes
create or replace function public.bump_automation_stats()
returns trigger language plpgsql as $$
begin
  if new.status in ('succeeded', 'failed', 'cancelled') and old.status = 'running' then
    update public.automations
       set last_run_at = new.completed_at,
           run_count = run_count + 1
     where id = new.automation_id;
  end if;
  return new;
end;
$$;

create trigger automation_runs_bump_stats
  after update on public.automation_runs
  for each row execute function public.bump_automation_stats();