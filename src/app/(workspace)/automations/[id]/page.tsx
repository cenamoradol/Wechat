import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutomationEditor } from "@/components/automations/automation-editor";
import { RunsLog } from "@/components/automations/runs-log";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { getAutomationAction, listRunsAction } from "@/app/(workspace)/automations/actions";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return <div className="p-8 text-muted-foreground">No workspace.</div>;

  const [autoRes, runsRes] = await Promise.all([
    getAutomationAction(id),
    listRunsAction(id, 20),
  ]);

  if (autoRes.error || !autoRes.data) {
    return <div className="p-8 text-muted-foreground">Automatización no encontrada.</div>;
  }

  return (
    <div className="space-y-6">
      <AutomationEditor
        initial={{
          id: autoRes.data.id,
          name: autoRes.data.name,
          description: autoRes.data.description ?? undefined,
          trigger: autoRes.data.trigger as never,
          steps: autoRes.data.steps as never,
          status: autoRes.data.status as "active" | "paused" | "draft",
        }}
      />
      <div className="px-6">
        <RunsLog runs={(runsRes.data ?? []) as never} />
      </div>
    </div>
  );
}