"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const WORKSPACE_COOKIE = "active_workspace_id";
const Role = z.enum(["owner", "admin", "agent", "viewer"]);

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

async function getActiveWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (fromCookie) {
    const { data: ok } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", fromCookie)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ok) return fromCookie;
  }
  const { data: first } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.workspace_id ?? null;
}

export async function getActiveWorkspaceIdAction(): Promise<string | null> {
  return getActiveWorkspaceId();
}

// ------------------------------------------------------------------
// List the user's workspaces (for dropdown)
// ------------------------------------------------------------------
export type WorkspaceListItem = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "agent" | "viewer";
};

export async function listUserWorkspacesAction(): Promise<WorkspaceListItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).flatMap((row: any) =>
    row.workspaces
      ? [
          {
            id: row.workspaces.id,
            name: row.workspaces.name,
            slug: row.workspaces.slug,
            role: row.role,
          },
        ]
      : [],
  );
}

// ------------------------------------------------------------------
// Create a new workspace + add creator as owner
// ------------------------------------------------------------------
const CreateSchema = z.object({ name: z.string().min(1).max(80) });

export async function createWorkspaceAction(
  input: z.infer<typeof CreateSchema>,
): Promise<{ error?: string; workspaceId?: string }> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nombre inválido" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  for (let i = 1; i < 50; i++) {
    const { data: clash } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i}`;
  }

  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .insert({ name: parsed.data.name, slug })
    .select("id")
    .single();
  if (wsErr || !ws) return { error: wsErr?.message ?? "No se pudo crear el workspace" };

  await admin.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
  });

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, ws.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/");
  return { workspaceId: ws.id };
}

// ------------------------------------------------------------------
// Switch active workspace (set cookie)
// ------------------------------------------------------------------
export async function switchWorkspaceAction(workspaceId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const { data: ok } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ok) return { error: "No tienes acceso a este workspace" };
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
  return {};
}

// ------------------------------------------------------------------
// Create an invite for a workspace
// ------------------------------------------------------------------
const InviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  role: Role.default("agent"),
});

export async function createInviteAction(input: z.infer<typeof InviteSchema>): Promise<{
  error?: string;
  token?: string;
  url?: string;
  expiresAt?: string;
}> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Sin permiso para invitar" };
  }

  const admin = createAdminClient();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("invitations")
    .insert({
      workspace_id: parsed.data.workspaceId,
      email: parsed.data.email ? parsed.data.email : null,
      role: parsed.data.role,
      token,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select("token, expires_at")
    .single();
  if (error || !data) return { error: error?.message ?? "No se pudo crear la invitación" };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    token: data.token,
    url: `${base.replace(/\/$/, "")}/accept-invite/${data.token}`,
    expiresAt: data.expires_at,
  };
}

export async function revokeInviteAction(inviteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const admin = createAdminClient();
  // RLS will scope to workspaces where the user is owner/admin
  const { error } = await admin.from("invitations").delete().eq("id", inviteId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return {};
}

// ------------------------------------------------------------------
// Accept an invite (called from /accept-invite/[token] page)
// ------------------------------------------------------------------
export async function acceptInviteAction(token: string): Promise<{
  error?: string;
  workspaceId?: string;
  workspaceName?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Necesitas iniciar sesión para aceptar la invitación" };

  const admin = createAdminClient();
  const { data: invite, error: invErr } = await admin
    .from("invitations")
    .select("id, workspace_id, role, expires_at, accepted_at, workspaces(name)")
    .eq("token", token)
    .maybeSingle();
  if (invErr || !invite) return { error: "Invitación no encontrada" };
  if (invite.accepted_at) return { error: "Esta invitación ya fue aceptada" };
  if (new Date(invite.expires_at) < new Date()) return { error: "Esta invitación expiró" };

  // Add user as member
  const { error: memberErr } = await admin
    .from("workspace_members")
    .upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: "workspace_id,user_id" },
    );
  if (memberErr) return { error: memberErr.message };

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, invite.workspace_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/");
  return {
    workspaceId: invite.workspace_id,
    workspaceName: (invite as any).workspaces?.name,
  };
}

// ------------------------------------------------------------------
// Remove a workspace member
// ------------------------------------------------------------------
export async function removeMemberAction(memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const admin = createAdminClient();
  // Don't let an admin/owner remove themselves if they're the last owner
  const { data: target } = await admin
    .from("workspace_members")
    .select("id, workspace_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) return { error: "Miembro no encontrado" };

  if (target.role === "owner" && target.user_id === user.id) {
    const { count } = await admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", target.workspace_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return { error: "No puedes eliminar al último owner del workspace" };
    }
  }

  const { error } = await admin.from("workspace_members").delete().eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return {};
}

// ------------------------------------------------------------------
// Helper for use in server components / actions
// ------------------------------------------------------------------
export { getActiveWorkspaceId };