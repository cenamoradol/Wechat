"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export async function listAutomationOptionsAction(): Promise<{
  tags?: Array<{ id: string; name: string; color: string }>;
  templates?: Array<{ id: string; name: string; language: string }>;
  members?: Array<{ id: string; full_name: string | null; email: string }>;
  customFields?: Array<{ id: string; name: string; type: string }>;
  aiAgents?: Array<{ id: string; name: string; provider: string; model: string }>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No workspace" };

  const [tagsRes, templatesRes, membersRes, fieldsRes, agentsRes] = await Promise.all([
    supabase.from("tags").select("id, name, color").eq("workspace_id", workspaceId).order("name"),
    supabase
      .from("templates")
      .select("id, name, language, channels!inner(workspace_id)")
      .eq("channels.workspace_id", workspaceId)
      .order("name"),
    supabase
      .from("workspace_members")
      .select("user_id, profiles(id, full_name, email)")
      .eq("workspace_id", workspaceId),
    supabase
      .from("custom_field_defs")
      .select("id, name, type")
      .eq("workspace_id", workspaceId)
      .order("name"),
    supabase
      .from("ai_agents")
      .select("id, name, provider, model")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    tags: tagsRes.data ?? [],
    templates: templatesRes.data ?? [],
    members: (membersRes.data ?? []).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { id: (p as { id: string } | null)?.id ?? "", full_name: (p as { full_name: string | null } | null)?.full_name ?? null, email: (p as { email: string } | null)?.email ?? "" };
    }).filter((m) => m.id),
    customFields: fieldsRes.data ?? [],
    aiAgents: agentsRes.data ?? [],
  };
}