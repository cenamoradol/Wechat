"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

const GB = 1024 * 1024 * 1024;
const MAX_LIMIT_GB = 1024; // 1 TB
const MIN_LIMIT_GB = 0.1; // 100 MB

const Schema = z.object({
  limitGB: z.number().min(MIN_LIMIT_GB).max(MAX_LIMIT_GB),
  unlimited: z.boolean().default(false),
});

export type WorkspaceSettingsResult = { error?: string; ok?: boolean };

export async function updateStorageLimitAction(
  input: z.infer<typeof Schema>,
): Promise<WorkspaceSettingsResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No tienes workspace activo" };

  const admin = createAdminClient();

  // Only owner can change storage limit
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || member.role !== "owner") {
    return { error: "Solo el owner puede cambiar el límite de storage" };
  }

  const limitBytes = Math.round(parsed.data.limitGB * GB);

  const { error } = await admin
    .from("workspaces")
    .update({
      storage_limit_bytes: limitBytes,
      storage_unlimited: parsed.data.unlimited,
    })
    .eq("id", workspaceId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/settings/workspace");
  revalidatePath("/inbox");
  return { ok: true };
}