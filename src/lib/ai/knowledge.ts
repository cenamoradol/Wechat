// src/lib/ai/knowledge.ts
// Full-text search over ai_knowledge_docs using Postgres tsvector
// (tsv column populated by the migration's generated column).

import { createAdminClient } from "@/lib/supabase/admin";
import type { KBDoc } from "./types";

export async function searchKnowledge(
  agentId: string,
  query: string,
  limit = 3,
): Promise<Array<{ id: string; title: string; snippet: string }>> {
  if (!query.trim()) return [];
  const admin = createAdminClient();
  // websearch handles plain text well. Falls back to ILIKE if no results.
  const { data } = await admin
    .from("ai_knowledge_docs")
    .select("id, title, content")
    .eq("agent_id", agentId)
    .textSearch("tsv", query, { type: "websearch", config: "spanish" })
    .limit(limit);
  if (data && data.length > 0) {
    return data.map((d) => ({
      id: d.id,
      title: d.title,
      snippet: (d.content as string).slice(0, 500),
    }));
  }
  // Fallback: ILIKE match
  const { data: fallback } = await admin
    .from("ai_knowledge_docs")
    .select("id, title, content")
    .eq("agent_id", agentId)
    .ilike("content", `%${query}%`)
    .limit(limit);
  return (fallback ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    snippet: (d.content as string).slice(0, 500),
  }));
}

export async function listKBDocs(agentId: string): Promise<KBDoc[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_knowledge_docs")
    .select("id, title, content, source_url, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    sourceUrl: d.source_url,
    createdAt: d.created_at,
  }));
}

export async function addKBDoc(args: {
  agentId: string;
  workspaceId: string;
  title: string;
  content: string;
  sourceUrl?: string;
}): Promise<{ id?: string; error?: string }> {
  if (!args.title.trim()) return { error: "Título requerido" };
  if (!args.content.trim()) return { error: "Contenido vacío" };
  const admin = createAdminClient();
  // ponytail: rough token estimate (4 chars ≈ 1 token). Good enough for
  // cost estimation; we don't need exact counts.
  const tokens = Math.ceil(args.content.length / 4);
  const { data, error } = await admin
    .from("ai_knowledge_docs")
    .insert({
      agent_id: args.agentId,
      workspace_id: args.workspaceId,
      title: args.title,
      content: args.content,
      source_url: args.sourceUrl ?? null,
      tokens,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function deleteKBDoc(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_knowledge_docs").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}