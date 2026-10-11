"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { generateAgentReply } from "@/lib/ai/chat";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AIProvider } from "@/lib/ai/types";

const Schema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid().optional(),
});

/**
 * Generate a suggested reply for the current conversation using the
 * workspace's default agent (or a specific one if provided). Returns the
 * suggested text or an error.
 */
export async function suggestReplyAction(input: {
  conversationId: string;
  agentId?: string;
}): Promise<{ content?: string; sources?: Array<{ id: string; title: string; snippet: string }>; error?: string }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No workspace" };

  const admin = createAdminClient();

  // 1. Pick agent
  let agentRow: {
    id: string;
    workspace_id: string;
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
    handoff_keywords: string[] | null;
    is_default: boolean;
  } | null = null;
  if (parsed.data.agentId) {
    const { data } = await admin
      .from("ai_agents")
      .select("*")
      .eq("id", parsed.data.agentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    agentRow = data;
  } else {
    const { data } = await admin
      .from("ai_agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_default", true)
      .maybeSingle();
    if (!data) {
      // Fall back to any agent
      const { data: any } = await admin
        .from("ai_agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      agentRow = any;
    } else {
      agentRow = data;
    }
  }
  if (!agentRow) return { error: "No hay agentes configurados. Crea uno en /ai-agents." };

  // 2. Fetch last 20 messages + contact info
  const { data: conv } = await admin
    .from("conversations")
    .select("id, contact_channel_id, contact_channels(external_user_id, contact_id, contacts(id, full_name, phone_e164, email))")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return { error: "Conversación no encontrada" };

  const cc = (conv as unknown as { contact_channels: { contacts: { id: string; full_name: string | null; phone_e164: string | null; email: string | null } | null } | null }).contact_channels;
  const contact = cc?.contacts;

  const { data: msgs } = await admin
    .from("messages")
    .select("direction, text, sent_by")
    .eq("conversation_id", parsed.data.conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(20);

  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = (msgs ?? []).map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text ?? "",
  }));

  // 3. Call LLM
  const agent = {
    id: agentRow.id,
    workspaceId: agentRow.workspace_id,
    name: agentRow.name,
    description: agentRow.description,
    provider: agentRow.provider as AIProvider,
    model: agentRow.model,
    systemPrompt: agentRow.system_prompt,
    temperature: Number(agentRow.temperature),
    maxTokens: agentRow.max_tokens,
    kbEnabled: agentRow.kb_enabled,
    autoReplyEnabled: agentRow.auto_reply_enabled,
    maxRepliesPerConversation: agentRow.max_replies_per_conversation,
    handoffKeywords: agentRow.handoff_keywords ?? [],
    isDefault: agentRow.is_default,
    createdAt: "",
    updatedAt: "",
  };

  try {
    const res = await generateAgentReply({
      agent,
      messages: chatMessages,
      contactVars: {
        "contact.name": contact?.full_name ?? "",
        "contact.phone": contact?.phone_e164 ?? "",
        "contact.email": contact?.email ?? "",
      },
    });
    return { content: res.content, sources: res.sources };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listAgentsForSuggestAction(): Promise<{
  data?: Array<{ id: string; name: string; provider: string; model: string; is_default: boolean }>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No workspace" };
  const { data, error } = await supabase
    .from("ai_agents")
    .select("id, name, provider, model, is_default")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { data: data ?? [] };
}