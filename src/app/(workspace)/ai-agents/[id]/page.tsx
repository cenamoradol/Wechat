import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentEditor } from "@/components/ai/agent-editor";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { getAgentAction } from "@/app/(workspace)/ai-agents/actions";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return <div className="p-8 text-muted-foreground">No workspace.</div>;

  const res = await getAgentAction(id);
  if (res.error || !res.data) return <div className="p-8 text-muted-foreground">Agente no encontrado.</div>;

  return (
    <AgentEditor
      mode="edit"
      initial={{
        id: res.data.id,
        name: res.data.name,
        description: res.data.description ?? undefined,
        provider: res.data.provider as "openai" | "anthropic",
        model: res.data.model,
        system_prompt: res.data.system_prompt,
        temperature: Number(res.data.temperature),
        max_tokens: res.data.max_tokens,
        kb_enabled: res.data.kb_enabled,
        auto_reply_enabled: res.data.auto_reply_enabled,
        max_replies_per_conversation: res.data.max_replies_per_conversation,
        handoff_keywords: res.data.handoff_keywords ?? [],
        is_default: res.data.is_default,
      }}
    />
  );
}