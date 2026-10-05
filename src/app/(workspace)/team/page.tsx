import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { TeamView } from "@/components/team/team-view";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) redirect("/onboarding");

  // Verify membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const admin = createAdminClient();

  // Fetch members + workspace + invites in parallel
  const [{ data: workspace }, { data: members }, { data: invites }] = await Promise.all([
    admin.from("workspaces").select("id, name, slug").eq("id", workspaceId).maybeSingle(),
    admin
      .from("workspace_members")
      .select("id, role, user_id, profiles:profiles!workspace_members_user_id_fkey(email, full_name, avatar_url)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    admin
      .from("invitations")
      .select("id, token, email, role, expires_at, accepted_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (!workspace) redirect("/onboarding");

  return (
    <TeamView
      workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
      currentUserId={user.id}
      currentUserRole={membership.role}
      members={(members ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        email: m.profiles?.email ?? "—",
        full_name: m.profiles?.full_name ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      }))}
      invites={(invites ?? []).map((i: any) => ({
        id: i.id,
        token: i.token,
        email: i.email,
        role: i.role,
        expires_at: i.expires_at,
        accepted_at: i.accepted_at,
        created_at: i.created_at,
      }))}
    />
  );
}