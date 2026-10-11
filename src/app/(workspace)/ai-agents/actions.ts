"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { generateAgentReply } from "@/lib/ai/chat";
import { addKBDoc, deleteKBDoc, listKBDocs } from "@/lib/ai/knowledge";
import { saveApiKey, deleteApiKey, pingProvider, getApiKey } from "@/lib/ai/providers";
import type { AIProvider } from "@/lib/ai/types";

// ---------------- AI Agents ----------------

const AgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().min(1).max(100),
  system_prompt: z.string().min(1).max(20_000),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().min(50).max(8192),
  kb_enabled: z.boolean(),
  auto_reply_enabled: z.boolean(),
  max_replies_per_conversation: z.number().int().min(1).max(50),
  handoff_keywords: z.array(z.string().max(50)).max(50),
  is_default: z.boolean(),
});

export type AgentFormData = z.infer<typeof AgentSchema>;

async function requireMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No workspace" as const };
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !["owner", "admin", "agent"].includes(member.role as string)) {
    return { error: "No tienes permisos" as const };
  }
  return { supabase, user, workspaceId };
}

export async function listAgentsAction(): Promise<{
  data?: Array<{ id: string; name: string; provider: string; model: string; auto_reply_enabled: boolean; is_default: boolean; description: string | null }>;
  error?: string;
}> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("ai_agents")
    .select("id, name, provider, model, auto_reply_enabled, is_default, description")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { data: data ?? [] };
}

export async function getAgentAction(id: string): Promise<{
  data?: {
    id: string;
    name: string;
    description: string | null;
    provider: string;
    model: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
    kb_enabled: boolean;
    auto_reply_enabled: boolean;
    max_replies_per_conversation: number;
    handoff_keywords: string[];
    is_default: boolean;
  };
  error?: string;
}> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("ai_agents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No encontrado" };
  return { data: data as never };
}

export async function createAgentAction(input: AgentFormData): Promise<{ id?: string; error?: string }> {
  const parsed = AgentSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  // Validate API key exists
  const key = await getApiKey(ctx.workspaceId, parsed.data.provider);
  if (!key) return { error: `No hay API key configurada para ${parsed.data.provider}. Ve a Configuración → IA.` };

  const admin = createAdminClient();
  // ponytail: only one default agent per workspace
  if (parsed.data.is_default) {
    await admin
      .from("ai_agents")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspaceId);
  }
  const { data, error } = await admin
    .from("ai_agents")
    .insert({
      workspace_id: ctx.workspaceId,
      ...parsed.data,
      description: parsed.data.description ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/ai-agents");
  return { id: data.id };
}

export async function updateAgentAction(id: string, input: AgentFormData): Promise<{ ok?: boolean; error?: string }> {
  const parsed = AgentSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  if (parsed.data.is_default) {
    await admin
      .from("ai_agents")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspaceId)
      .neq("id", id);
  }
  const { error } = await admin
    .from("ai_agents")
    .update({
      ...parsed.data,
      description: parsed.data.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/ai-agents");
  revalidatePath(`/ai-agents/${id}`);
  return { ok: true };
}

export async function deleteAgentAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { error } = await admin.from("ai_agents").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/ai-agents");
  return { ok: true };
}

// ---------------- Test Chat ----------------

export async function testChatAction(input: {
  agentId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ content?: string; error?: string }> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("ai_agents")
    .select("*")
    .eq("id", input.agentId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!a) return { error: "Agente no encontrado" };
  const agent = {
    id: a.id,
    workspaceId: a.workspace_id,
    name: a.name,
    description: a.description,
    provider: a.provider as AIProvider,
    model: a.model,
    systemPrompt: a.system_prompt,
    temperature: Number(a.temperature),
    maxTokens: a.max_tokens,
    kbEnabled: a.kb_enabled,
    autoReplyEnabled: a.auto_reply_enabled,
    maxRepliesPerConversation: a.max_replies_per_conversation,
    handoffKeywords: a.handoff_keywords ?? [],
    isDefault: a.is_default,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
  try {
    const res = await generateAgentReply({ agent, messages: input.messages });
    // Log
    await admin.from("ai_messages").insert({
      workspace_id: agent.workspaceId,
      agent_id: agent.id,
      conversation_id: null,
      contact_id: null,
      role: "assistant",
      content: res.content,
      tokens_in: res.usage.tokensIn,
      tokens_out: res.usage.tokensOut,
      latency_ms: res.usage.latencyMs,
    });
    return { content: res.content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// Re-exports for KB + keys
export { listKBDocs, addKBDoc, deleteKBDoc };
export { pingProvider };

// ---------------- API Keys (workspace-aware wrappers) ----------------

export async function saveApiKeyAction(
  provider: "openai" | "anthropic",
  apiKey: string,
): Promise<{ error?: string }> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  return saveApiKey(ctx.workspaceId, provider, apiKey);
}

export async function deleteApiKeyAction(
  provider: "openai" | "anthropic",
): Promise<{ error?: string }> {
  const ctx = await requireMember();
  if ("error" in ctx) return { error: ctx.error };
  return deleteApiKey(ctx.workspaceId, provider);
}