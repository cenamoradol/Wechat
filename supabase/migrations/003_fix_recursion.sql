-- 003_fix_recursion.sql
-- The members_select_workspace policy causes infinite recursion in RLS.
-- Remove it. members_select_self is enough for Fase 1.

drop policy if exists "members_select_workspace" on public.workspace_members;