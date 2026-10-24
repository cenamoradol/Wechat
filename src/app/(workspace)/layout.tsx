import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import {
  listUserWorkspacesAction,
  getActiveWorkspaceIdAction,
} from "@/app/(workspace)/actions";
import type { WorkspaceRole } from "@/lib/auth/roles";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const memberships = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (!memberships.data || memberships.data.length === 0) {
    redirect("/onboarding");
  }

  // Role in the ACTIVE workspace, so the nav can hide what this user may not do.
  const { data: activeMember } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", (await getActiveWorkspaceIdAction()) ?? "")
    .eq("user_id", user.id)
    .maybeSingle();
  const userRole = (activeMember?.role as WorkspaceRole) ?? "viewer";

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listUserWorkspacesAction(),
    getActiveWorkspaceIdAction(),
  ]);

  return (
    <div className="flex h-svh bg-background">
      <Sidebar role={userRole} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={profile?.full_name ?? undefined}
          userEmail={user.email ?? undefined}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId ?? undefined}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}