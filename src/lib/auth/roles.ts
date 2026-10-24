// src/lib/auth/roles.ts
// Single authorization gate for workspace-scoped mutations.
//
// Why this exists: every feature file grew its own `requireMember()` with its
// own role list, and several forgot the check entirely (a signed-in agent
// could overwrite any channel's Meta token by id). One gate, one role list,
// used everywhere.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";

/** Roles that may manage the workspace itself: members, channels, API keys. */
export const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];

export type RoleContext = {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type RoleResult =
  | { error: string }
  | ({ admin: ReturnType<typeof createAdminClient> } & RoleContext);

/**
 * Resolve the caller's role in the active workspace, or fail. `allowed` is the
 * list of roles permitted to perform the action.
 *
 ponytail: the admin client bypasses RLS, so this check IS the authorization
 * boundary — there is no second line of defence below it.
 */
export async function requireWorkspaceRole(allowed: WorkspaceRole[]): Promise<RoleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No tienes un workspace activo" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return { error: "No perteneces al workspace activo" };

  const role = (member.role as WorkspaceRole) ?? "viewer";
  if (!allowed.includes(role)) {
    return {
      error: `Tu rol (${role}) no tiene permiso para esta acción`,
    };
  }

  return {
    admin,
    userId: user.id,
    email: user.email ?? "",
    workspaceId,
    role,
  };
}

/**
 * Same gate, but for actions that take a row id: also asserts the row belongs
 * to the active workspace. Without this, an owner of workspace A could pass a
 * channel id belonging to workspace B and mutate it.
 */
export async function requireRowOwnership(
  allowed: WorkspaceRole[],
  table: "channels" | "conversations" | "workspace_members" | "automations" | "ai_agents",
  rowId: string,
): Promise<RoleResult> {
  const ctx = await requireWorkspaceRole(allowed);
  if ("error" in ctx) return ctx;

  const { data } = await ctx.admin.from(table).select("workspace_id").eq("id", rowId).maybeSingle();
  if (!data) return { error: "Recurso no encontrado" };
  if (data.workspace_id !== ctx.workspaceId) {
    return { error: "Ese recurso no pertenece a tu workspace" };
  }
  return ctx;
}