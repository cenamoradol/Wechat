alter table public.ai_agents drop constraint if exists ai_agents_provider_check;
alter table public.ai_agents
  add constraint ai_agents_provider_check
  check (provider in ('openai', 'anthropic', 'minimax', 'gemini'));

alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys
  add constraint ai_provider_keys_provider_check
  check (provider in ('openai', 'anthropic', 'minimax', 'gemini'));
