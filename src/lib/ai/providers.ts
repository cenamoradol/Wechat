// src/lib/ai/providers.ts
// BYOK (Bring Your Own Key) per workspace. API keys are stored encrypted
// in ai_provider_keys; we decrypt on demand and never log them.

import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import type { AIProvider } from "./types";

/**
 * Per-provider config. Minimax is OpenAI-compatible (chat/completions
 * endpoint with messages array), so the request shape is identical to
 * OpenAI. The base URL is the only thing that differs.
 */
export const PROVIDER_CONFIG: Record<AIProvider, { baseUrl: string; testModel: string; format: "openai" | "anthropic" }> = {
  openai: { baseUrl: "https://api.openai.com/v1", testModel: "gpt-4o-mini", format: "openai" },
  anthropic: { baseUrl: "https://api.anthropic.com", testModel: "claude-3-5-haiku-latest", format: "anthropic" },
  // ponytail: MiniMax real base URL is api.minimax.io (NOT api.minimaxi.com
  // or api.minimax.io/anthropic). It's OpenAI-compat at /v1/chat/completions
  // with Authorization: Bearer. MiniMax-M3.1-Flash-Preview is the M Plan /
  // Token Plan model. base_resp.status_code is the success flag.
  minimax: { baseUrl: "https://api.minimax.io", testModel: "MiniMax-M3.1-Flash-Preview", format: "openai" },
  // ponytail: Google's OpenAI-compatible endpoint uses the same request and
  // response shape; keep API keys on the server via the existing BYOK flow.
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", testModel: "gemini-2.5-flash-lite", format: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", testModel: "openai/gpt-4o-mini", format: "openai" },
};

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
  if (error) {
    console.error("[ai] getApiKey query error", { provider, error: error.message });
    return null;
  }
  if (!data) {
    console.warn("[ai] getApiKey: no row", { provider, workspaceId });
    return null;
  }
  try {
    const raw = data.api_key_enc as string;
    // ponytail: postgrest-js returns bytea as base64 OR hex (\\x...).
    // Try base64 first, then hex.
    const buf = raw.startsWith("\\x")
      ? Buffer.from(raw.slice(2), "hex")
      : Buffer.from(raw, "base64");
    return decrypt(buf);
  } catch (e) {
    console.error("[ai] getApiKey decrypt failed", { provider, e: (e as Error).message });
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
  // ponytail: bytea column needs the \\x hex prefix to round-trip cleanly
  // through postgrest-js. Without it, the Buffer gets stringified as a JSON
  // object and the bytes get mangled, which then fails GCM auth on read.
  const encHex = "\\x" + enc.toString("hex");
  const { error } = await admin
    .from("ai_provider_keys")
    .upsert(
      {
        workspace_id: workspaceId,
        provider,
        api_key_enc: encHex,
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
  const cfg = PROVIDER_CONFIG[provider];
  try {
    if (cfg.format === "openai") {
      // OpenAI: /chat/completions. MiniMax: /v1/chat/completions (their
      // official OpenAI-compat path per platform.minimax.io docs).
      const path = provider === "minimax" ? "/v1/chat/completions" : "/chat/completions";
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      const txt = await res.text();
      // MiniMax returns 200 with base_resp.status_code != 0 on auth errors.
      if (provider === "minimax") {
        try {
          const j = JSON.parse(txt) as { base_resp?: { status_code: number; status_msg: string } };
          if (j.base_resp?.status_code && j.base_resp.status_code !== 0) {
            return { ok: false, error: `${provider} ${j.base_resp.status_code}: ${j.base_resp.status_msg}` };
          }
        } catch { /* not JSON, fall through */ }
      }
      if (!res.ok) {
        return { ok: false, error: `${provider} ${res.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } else {
      const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
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
        return { ok: false, error: `${provider} ${res.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
