// src/lib/automations/ai-helpers.ts
// ponytail: helpers to load the workspace's AI configuration. Used by
// llm-condition (trigger) and the llm_draft_message / ai_extract /
// ai_reply steps. Centralized so the providers/keys table is read in
// exactly one place.

import { createAdminClient } from "@/lib/supabase/admin";
import { getApiKey, PROVIDER_CONFIG } from "@/lib/ai/providers";
import { decrypt } from "@/lib/crypto";
import type { AIProvider } from "@/lib/ai/types";

export type LoadedAiConfig = {
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

/**
 * Load the workspace's default AI agent. Returns null if the workspace
 * has no agent configured. Picks the agent marked `is_default`, falling
 * back to the most recently created one.
 */
export async function loadAiConfig(workspaceId: string): Promise<LoadedAiConfig | null> {
  const admin = createAdminClient();
  const { data: agents } = await admin
    .from("ai_agents")
    .select("id, provider, model, system_prompt, temperature, max_tokens, is_default, created_at")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const agent = agents?.[0];
  if (!agent) return null;
  const cfg = PROVIDER_CONFIG[agent.provider as AIProvider];
  if (!cfg) return null;

  const apiKey = await getApiKey(workspaceId, agent.provider as AIProvider);
  if (!apiKey) return null;

  return {
    provider: agent.provider as AIProvider,
    model: agent.model,
    baseUrl: cfg.baseUrl,
    apiKey,
    systemPrompt: agent.system_prompt ?? "",
    temperature: Number(agent.temperature),
    maxTokens: agent.max_tokens,
  };
}

// silence unused-import for crypto (decrypt is used by getApiKey upstream,
// but keep here for symmetry with steps.ts decryption patterns).
void decrypt;
