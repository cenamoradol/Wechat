import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { WorkspaceSettingsView } from "@/components/settings/workspace-settings-view";
import { getWorkspaceStorageQuota } from "@/lib/supabase/storage";

const GB = 1024 * 1024 * 1024;

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) redirect("/onboarding");

  const admin = createAdminClient();

  // Get workspace details + role + quota in parallel
  const [{ data: ws }, { data: member }, quota] = await Promise.all([
    admin
      .from("workspaces")
      .select("id, name, storage_limit_bytes, storage_unlimited")
      .eq("id", workspaceId)
      .maybeSingle(),
    admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    getWorkspaceStorageQuota(workspaceId),
  ]);

  if (!ws) redirect("/onboarding");

  const isOwner = member?.role === "owner";
  const limitGB = (ws.storage_limit_bytes ?? 1073741824) / GB;
  const usageGB = quota.usage / GB;

  return (
    <WorkspaceSettingsView
      workspaceName={ws.name}
      limitGB={limitGB}
      usageBytes={quota.usage}
      unlimited={ws.storage_unlimited ?? false}
      isOwner={isOwner}
    />
  );
}