// src/app/(workspace)/team/actions.ts
// Team management that touches LOGIN credentials.
//
// Separate from (workspace)/actions.ts because these actions talk to
// supabase.auth.admin, which is a different blast radius: they can create
// accounts and reset passwords. The gate here is owner/admin, and only an
// owner may modify another owner's credentials.

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceRole, type WorkspaceRole } from "@/lib/auth/roles";
import { createConfirmedUser, updateUserCredentials } from "@/lib/auth/admin-users";

const RoleSchema = z.enum(["owner", "admin", "agent", "viewer"]);

const CreateUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
    .regex(/[0-9]/, "Debe tener al menos un número"),
  fullName: z.string().max(100).optional(),
  role: RoleSchema.default("agent"),
});

const UpdateUserSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email("Email inválido").optional(),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
      .regex(/[0-9]/, "Debe tener al menos un número")
      .optional(),
  })
  .refine((d) => d.email || d.password, {
    message: "Indicá un email o una contraseña nueva",
  });

export type CreateUserActionResult = {
  error?: string;
  userId?: string;
  email?: string;
  /** False when the account already existed and we only attached it. */
  created?: boolean;
};

/**
 * Provision a member's login and attach them to the workspace in one go.
 * No email confirmation, no invite link: the admin hands the credentials
 * over directly.
 */
export async function createUserAction(
  // z.input, not z.infer: `role` has a default, so it's optional on the way in
  // but required on the parsed output. The client may omit it.
  input: z.input<typeof CreateUserSchema>,
): Promise<CreateUserActionResult> {
  const parsed = CreateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ctx = await requireWorkspaceRole(["owner", "admin"]);
  if ("error" in ctx) return { error: ctx.error };

  const email = parsed.data.email.trim().toLowerCase();

  // Don't hand out a second owner account by accident: only an owner may
  // create another owner.
  if (parsed.data.role === "owner" && ctx.role !== "owner") {
    return { error: "Solo un owner puede crear otro owner" };
  }

  const created = await createConfirmedUser({
    email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
  });
  if ("error" in created) return { error: created.error };

  // Attach to the workspace. If they were already a member, this is a no-op.
  const admin = ctx.admin;
  const { data: existing } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", created.userId)
    .maybeSingle();

  if (!existing) {
    const { error: memErr } = await admin.from("workspace_members").insert({
      workspace_id: ctx.workspaceId,
      user_id: created.userId,
      role: parsed.data.role,
    });
    if (memErr) {
      // The auth user exists but the membership failed — say so, otherwise
      // the admin thinks it worked and the person can't see the workspace.
      return {
        error: `El usuario se creó pero no se pudo añadir al workspace: ${memErr.message}`,
        userId: created.userId,
        email: created.email,
      };
    }
  }

  console.log(
    `[team] user created/attached by ${ctx.userId} → ${created.email} as ${parsed.data.role} (new auth user: ${created.created})`,
  );

  revalidatePath("/team");
  return {
    userId: created.userId,
    email: created.email,
    created: created.created,
  };
}

export type UpdateUserActionResult = { error?: string; ok?: boolean };

/**
 * Correct a member's email or reset their password.
 *
 * Guard rails:
 *  - owner/admin only
 *  - the target must be a member of the ACTIVE workspace
 *  - only an owner may modify an owner's credentials
 *  - you can't change your own email/password here (use /settings/profile)
 */
export async function updateMemberCredentialsAction(
  input: z.input<typeof UpdateUserSchema>,
): Promise<UpdateUserActionResult> {
  const parsed = UpdateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ctx = await requireWorkspaceRole(["owner", "admin"]);
  if ("error" in ctx) return { error: ctx.error };

  if (parsed.data.userId === ctx.userId) {
    return { error: "No puedes cambiar tus propias credenciales aquí. Usá Mi perfil." };
  }

  const { data: target } = await ctx.admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!target) return { error: "Ese usuario no es miembro de este workspace" };

  const targetRole = target.role as WorkspaceRole;
  if (targetRole === "owner" && ctx.role !== "owner") {
    return { error: "Solo un owner puede modificar las credenciales de otro owner" };
  }

  const result = await updateUserCredentials({
    userId: parsed.data.userId,
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (result.error) return { error: result.error };

  console.log(
    `[team] credentials updated by ${ctx.userId} → user ${parsed.data.userId}` +
      (parsed.data.email ? " (email)" : "") +
      (parsed.data.password ? " (password)" : ""),
  );

  revalidatePath("/team");
  return { ok: true };
}
