-- 023_message_sender_label.sql
-- Attribute outbound messages that have no human sender (sent_by is null):
-- AI auto-replies and automation steps. Until now those bubbles rendered with
-- no author at all, so you could not tell who was answering the customer.
--
-- Denormalized on purpose: a chat log should keep the name it was sent under,
-- so renaming an agent or automation must not rewrite history. This also
-- avoids an ai_agents/automations join on every message render.

alter table public.messages
  add column if not exists sent_by_label text;

comment on column public.messages.sent_by_label is
  'Display name of a non-human sender: AI agent name (auto-reply) or automation name (steps). Null for human sends, which use sent_by -> profiles.';