"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const Schema = z.object({
  workspace_name: z.string().min(1).max(100),
  timezone: z.string().default("America/Tegucigalpa"),
});

export type OnboardingResult = { error?: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function completeOnboardingAction(
  input: z.infer<typeof Schema>,
): Promise<OnboardingResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Check if user already has a workspace (signup created one but onboarding didn't complete)
  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from("workspaces")
      .update({ name: parsed.data.workspace_name, onboarding_step: 1 })
      .eq("id", existing.workspace_id);
  } else {
    const baseName = parsed.data.workspace_name;
    const slug = `${slugify(baseName)}-${Date.now().toString(36)}`.slice(0, 40);
    const { data: ws, error: wsError } = await admin
      .from("workspaces")
      .insert({ name: baseName, slug, onboarding_step: 1 })
      .select("id")
      .single();

    if (wsError || !ws) {
      console.error("workspace insert failed", wsError);
      return { error: `No se pudo crear el workspace: ${wsError?.message ?? "unknown"}` };
    }

    const { error: memberError } = await admin.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      console.error("workspace_members insert failed", memberError);
      return { error: `No se pudo asignar el rol: ${memberError.message}` };
    }
  }

  redirect("/dashboard");
}

export async function skipOnboardingAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const slug = `workspace-${Date.now().toString(36)}`;
    const { data: ws } = await admin
      .from("workspaces")
      .insert({ name: "Mi workspace", slug, onboarding_step: 1 })
      .select("id")
      .single();

    if (ws) {
      await admin.from("workspace_members").insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: "owner",
      });
    }
  } else {
    await admin
      .from("workspaces")
      .update({ onboarding_step: 1 })
      .eq("id", existing.workspace_id);
  }

  redirect("/dashboard");
}