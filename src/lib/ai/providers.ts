// src/lib/ai/providers.ts
// BYOK (Bring Your Own Key) per workspace. API keys are stored encrypted
// in ai_provider_keys; we decrypt on demand and never log them.

import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import type { AIProvider } from "./types";

export async function getApiKey(
  workspaceId: string,
  provider: AIProvider,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_provider_keys")
    .select("api_key_enc")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return decrypt(Buffer.from(data.api_key_enc as string, "base64"));
  } catch {
    return null;
  }
}

export async function saveApiKey(
  workspaceId: string,
  provider: AIProvider,
  apiKey: string,
  label?: string,
): Promise<{ error?: string }> {
  if (!apiKey || apiKey.length < 10) return { error: "API key inválida" };
  const admin = createAdminClient();
  const enc = encrypt(apiKey);
  const { error } = await admin
    .from("ai_provider_keys")
    .upsert(
      {
        workspace_id: workspaceId,
        provider,
        api_key_enc: enc as unknown as string,
        label: label ?? "default",
        last_used_at: null,
      },
      { onConflict: "workspace_id,provider" },
    );
  if (error) return { error: error.message };
  return {};
}

export async function deleteApiKey(
  workspaceId: string,
  provider: AIProvider,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_provider_keys")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
  if (error) return { error: error.message };
  return {};
}

export async function touchApiKey(
  workspaceId: string,
  provider: AIProvider,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("ai_provider_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
}

/**
 * Test if the API key works by sending a minimal request.
 */
export async function pingProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `OpenAI ${res.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `Anthropic ${res.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}