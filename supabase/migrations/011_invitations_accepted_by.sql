-- 011_invitations_accepted_by.sql
-- Add the accepted_by column referenced by acceptInviteAction.
-- The column was missing in the original migration, causing the post-signup
-- UPDATE to fail silently and leaving invitations stuck as "pending".

alter table public.invitations
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null;