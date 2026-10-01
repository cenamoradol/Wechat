-- 002_fix_rls.sql
-- Fix RLS on workspace_members: allow user to see their own memberships
-- (the original "visible_to_members" policy is recursive and breaks the first check)

drop policy if exists "members_visible_to_members" on public.workspace_members;

create policy "members_select_self" on public.workspace_members
  for select using (user_id = auth.uid());

create policy "members_select_workspace" on public.workspace_members
  for select using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- Allow members to insert themselves (signup / invite accept in Fase 5)
create policy "members_insert_self" on public.workspace_members
  for insert with check (user_id = auth.uid());

-- Only owner/admin can modify other members (Fase 5 will add invite/role flow)
create policy "members_modify_admin" on public.workspace_members
  for update using (
    exists(
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "members_delete_admin" on public.workspace_members
  for delete using (
    exists(
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );