-- 001_init_workspaces.sql
-- Profiles, workspaces, memberships, invitations, RLS

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  default_currency text default 'USD' not null,
  onboarding_step int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create type public.workspace_role as enum ('owner', 'admin', 'agent', 'viewer');

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.workspace_role not null default 'agent',
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role public.workspace_role not null default 'agent',
  token text unique not null,
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

create policy "profiles_self" on public.profiles
  for all using (id = auth.uid());

create policy "workspaces_members_only" on public.workspaces
  for all using (
    exists(
      select 1 from public.workspace_members
      where workspace_id = workspaces.id and user_id = auth.uid()
    )
  );

create policy "members_visible_to_members" on public.workspace_members
  for all using (
    exists(
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "invitations_workspace_members" on public.invitations
  for all using (
    exists(
      select 1 from public.workspace_members
      where workspace_id = invitations.workspace_id and user_id = auth.uid()
    )
  );

create or replace function public.user_workspace_ids()
returns setof uuid language sql stable security definer as $$
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$;

create or replace function public.user_role_in_workspace(p_workspace uuid)
returns public.workspace_role language sql stable security definer as $$
  select role from public.workspace_members
  where workspace_id = p_workspace and user_id = auth.uid();
$$;