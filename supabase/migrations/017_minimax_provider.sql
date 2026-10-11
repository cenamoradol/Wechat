-- 017_minimax_provider.sql
-- Add 'minimax' as a valid AI provider (OpenAI-compatible API at
-- https://api.minimaxi.com/v1 with subscription keys prefixed sk-cp-).

-- Drop and recreate the CHECK constraint on ai_agents.provider
alter table public.ai_agents drop constraint if exists ai_agents_provider_check;
alter table public.ai_agents
  add constraint ai_agents_provider_check
  check (provider in ('openai', 'anthropic', 'minimax'));

-- Drop and recreate the CHECK constraint on ai_provider_keys.provider
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys
  add constraint ai_provider_keys_provider_check
  check (provider in ('openai', 'anthropic', 'minimax'));