import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIKeysForm } from "@/components/ai/ai-keys-form";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export default async function AISettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return <div className="p-8 text-muted-foreground">No workspace.</div>;

  const { data: keys } = await supabase
    .from("ai_provider_keys")
    .select("provider, last_used_at, label, created_at")
    .eq("workspace_id", workspaceId);

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración de IA</h1>
        <p className="text-sm text-muted-foreground">
          BYOK: trae tu propia API key de OpenAI o Anthropic. Se almacena cifrada (AES-256-GCM).
        </p>
      </div>
      <AIKeysForm
        initial={[
          { provider: "openai" as const, configured: keys?.some((k) => k.provider === "openai") ?? false, last_used_at: keys?.find((k) => k.provider === "openai")?.last_used_at ?? null },
          { provider: "anthropic" as const, configured: keys?.some((k) => k.provider === "anthropic") ?? false, last_used_at: keys?.find((k) => k.provider === "anthropic")?.last_used_at ?? null },
        ]}
      />
    </div>
  );
}