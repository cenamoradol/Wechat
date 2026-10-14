"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import {
  DEFAULT_PREFS,
  pushEnabled,
  type NotificationPrefs,
  type PushEvent,
} from "@/lib/push";

const PrefsSchema = z.object({
  prefs: z.object({
    new_message: z.boolean(),
    conversation_assigned: z.boolean(),
    automation_failed: z.boolean(),
    ai_handoff: z.boolean(),
    new_contact: z.boolean(),
  }),
});

export type PrefsResult = { error?: string; ok?: boolean };

export async function updatePrefsAction(
  input: z.infer<typeof PrefsSchema>,
): Promise<PrefsResult> {
  const parsed = PrefsSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ notification_prefs: parsed.data.prefs, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/notifications");
  return { ok: true };
}

/**
 * Save (or replace) a push subscription for the current user + active workspace.
 * Called from the browser after PushManager.subscribe() resolves.
 *
 * If the same endpoint+key already exists for this user, we just refresh
 * last_seen_at to avoid duplicates.
 */
const SubSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export async function registerPushAction(
  input: z.infer<typeof SubSchema>,
): Promise<{ error?: string; id?: string }> {
  if (!pushEnabled()) return { error: "Push no está configurado en este servidor" };

  const parsed = SubSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No tienes workspace activo" };

  const admin = createAdminClient();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;

  // Dedupe by endpoint
  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("subscription->>endpoint", parsed.data.subscription.endpoint)
    .maybeSingle();

  if (existing) {
    await admin
      .from("push_subscriptions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { id: existing.id };
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      subscription: parsed.data.subscription,
      user_agent: ua,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function unregisterPushAction(): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").delete().eq("user_id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function getPushStateAction(): Promise<{
  serverEnabled: boolean;
  subscribed: boolean;
  subscriptionCount: number;
  prefs: NotificationPrefs;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serverEnabled = pushEnabled();

  if (!user) {
    return {
      serverEnabled,
      subscribed: false,
      subscriptionCount: 0,
      prefs: DEFAULT_PREFS,
    };
  }

  const admin = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("profiles").select("notification_prefs").eq("id", user.id).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const prefs: NotificationPrefs = {
    ...DEFAULT_PREFS,
    ...((profile?.notification_prefs as NotificationPrefs | null) ?? {}),
  };

  return {
    serverEnabled,
    subscribed: (count ?? 0) > 0,
    subscriptionCount: count ?? 0,
    prefs,
  };
}

export type { PushEvent };