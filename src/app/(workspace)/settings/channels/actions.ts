"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/channels";
import { decrypt, encrypt } from "@/lib/crypto";

export type ChannelActionResult = { error?: string; success?: string };

export async function updateChannelTokenAction(
  channelId: string,
  accessToken: string,
): Promise<ChannelActionResult> {
  if (!accessToken || accessToken.length < 20) {
    return { error: "Token inválido" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("channels")
    .select("type, external_id")
    .eq("id", channelId)
    .single();
  if (!ch) return { error: "Canal no encontrado" };

  // Quick probe: try the Graph API to confirm token works
  try {
    const probeUrl = `https://graph.facebook.com/v22.0/${ch.external_id}?access_token=${encodeURIComponent(accessToken)}`;
    const probe = await fetch(probeUrl);
    if (!probe.ok) {
      return { error: `Token rechazado por Meta (${probe.status}). Verifica que sea del System User con los scopes correctos.` };
    }
  } catch (e) {
    return { error: `No se pudo verificar el token: ${(e as Error).message}` };
  }

  const enc = encrypt(accessToken);
  const { error } = await admin
    .from("channels")
    .update({
      access_token_enc: enc.toString("base64"),
      status: "connected",
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", channelId);
  if (error) return { error: error.message };

  revalidatePath("/settings/channels");
  return { success: "ok" };
}

export async function deleteChannelAction(channelId: string): Promise<ChannelActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { error } = await admin.from("channels").delete().eq("id", channelId);
  if (error) return { error: error.message };

  revalidatePath("/settings/channels");
  return { success: "ok" };
}

export async function subscribeWebhooksAction(
  channelId: string,
): Promise<ChannelActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("channels")
    .select("type, access_token_enc, external_id")
    .eq("id", channelId)
    .single();
  if (!ch) return { error: "Canal no encontrado" };

  let token: string;
  try {
    token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    return { error: `No se pudo descifrar el token: ${(e as Error).message}` };
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  if (!appId) return { error: "META_APP_ID no configurado" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

  const results: { object: string; ok: boolean; status: number; msg?: string }[] = [];

  // 1. Subscribe to whatsapp_business_account (for WhatsApp messages)
  if (ch.type === "whatsapp") {
    try {
      const r = await fetch(`https://graph.facebook.com/v22.0/${appId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: `${appUrl}/api/webhooks/whatsapp`,
          verify_token: verifyToken,
          fields: ["messages", "message_deliveries", "message_reads", "message_echoes"],
        }),
      });
      const body = await r.json().catch(() => ({}));
      results.push({
        object: "whatsapp_business_account",
        ok: r.ok,
        status: r.status,
        msg: typeof body === "object" && "error" in body ? (body as any).error?.message : undefined,
      });
    } catch (e) {
      results.push({
        object: "whatsapp_business_account",
        ok: false,
        status: 0,
        msg: (e as Error).message,
      });
    }
  }

  // 2. Subscribe to instagram (covers Facebook Messenger + Instagram)
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${appId}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "instagram",
        callback_url: `${appUrl}/api/webhooks/instagram`,
        verify_token: verifyToken,
        fields: ["messages", "messaging_postbacks", "messaging_referrals", "message_deliveries", "message_reads"],
      }),
    });
    const body = await r.json().catch(() => ({}));
    results.push({
      object: "instagram",
      ok: r.ok,
      status: r.status,
      msg: typeof body === "object" && "error" in body ? (body as any).error?.message : undefined,
    });
  } catch (e) {
    results.push({
      object: "instagram",
      ok: false,
      status: 0,
      msg: (e as Error).message,
    });
  }

  // 3. Subscribe the page itself (needed for Messenger on some pages)
  if (ch.type === "facebook") {
    try {
      const r = await fetch(`https://graph.facebook.com/v22.0/${ch.external_id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribed_fields: ["messages", "messaging_postbacks", "message_deliveries", "message_reads"],
        }),
      });
      const body = await r.json().catch(() => ({}));
      results.push({
        object: `page:${ch.external_id}`,
        ok: r.ok,
        status: r.status,
        msg: typeof body === "object" && "error" in body ? (body as any).error?.message : undefined,
      });
    } catch (e) {
      results.push({
        object: `page:${ch.external_id}`,
        ok: false,
        status: 0,
        msg: (e as Error).message,
      });
    }
  }

  const allOk = results.every((r) => r.ok);
  const summary = results
    .map((r) => `${r.ok ? "✅" : "❌"} ${r.object}: ${r.status}${r.msg ? ` — ${r.msg.slice(0, 120)}` : ""}`)
    .join(" · ");

  revalidatePath("/settings/channels");
  return allOk ? { success: summary } : { error: summary };
}

export async function reVerifyChannelAction(channelId: string): Promise<ChannelActionResult> {
  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("channels")
    .select("type, external_id, access_token_enc")
    .eq("id", channelId)
    .single();
  if (!ch) return { error: "Canal no encontrado" };

  try {
    const token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${ch.external_id}?access_token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) {
      await admin
        .from("channels")
        .update({ status: "error", last_verified_at: new Date().toISOString() })
        .eq("id", channelId);
      return { error: `Meta respondió ${res.status}` };
    }
    await admin
      .from("channels")
      .update({ status: "connected", last_verified_at: new Date().toISOString() })
      .eq("id", channelId);
    revalidatePath("/settings/channels");
    return { success: "ok" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al verificar" };
  }
}

const ManualWASchema = z.object({
  phone_number_id: z.string().min(5),
  waba_id: z.string().min(5),
  access_token: z.string().min(20),
  display_name: z.string().max(100).optional(),
});

export async function connectWhatsAppManualAction(
  input: z.infer<typeof ManualWASchema>,
): Promise<ChannelActionResult> {
  const parsed = ManualWASchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return { error: "No tienes workspace" };

  const adapter = getAdapter("whatsapp");

  // 1. Probe token by fetching phone number details
  try {
    await adapter.fetchContactProfile({
      accessToken: parsed.data.access_token,
      externalUserId: parsed.data.phone_number_id,
    });
  } catch (e) {
    return { error: `Token inválido o phone_number_id incorrecto: ${(e as Error).message}` };
  }

  // 2. Save channel (encrypted token)
  const encToken = encrypt(parsed.data.access_token);
  const { data: channel, error: chErr } = await admin
    .from("channels")
    .upsert(
      {
        workspace_id: member.workspace_id,
        type: "whatsapp",
        external_id: parsed.data.phone_number_id,
        display_name: parsed.data.display_name ?? `WA ${parsed.data.phone_number_id.slice(-6)}`,
        access_token_enc: encToken.toString("base64"),
        meta: { waba_id: parsed.data.waba_id },
        status: "connected",
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,type,external_id" },
    )
    .select("id")
    .single();
  if (chErr || !channel) {
    return { error: chErr?.message ?? "No se pudo guardar el canal" };
  }

  // 3. Subscribe webhook (best-effort, may fail without app review)
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  if (appId && !appId.startsWith("<")) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${appId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`,
          verify_token: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
          fields: ["messages"],
        }),
      });
    } catch (e) {
      console.warn("WA webhook subscribe failed:", e);
    }
  }

  revalidatePath("/settings/channels");
  return { success: "ok" };
}