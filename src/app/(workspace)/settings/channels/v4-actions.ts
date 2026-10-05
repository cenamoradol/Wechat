"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { graphGet } from "@/lib/meta/oauth";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

const Schema = z.object({
  code: z.string().min(5),
  phone_number_id: z.string().optional(),
  waba_id: z.string().optional(),
  business_id: z.string().optional(),
});

export type V4Result = { error?: string; saved?: number };

export async function completeEmbeddedSignupV4Action(
  input: z.infer<typeof Schema>,
): Promise<V4Result> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No tienes workspace activo" };

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { error: "META_APP_ID / SECRET no configurados" };

  // Exchange code → System User access_token (short-lived; in real prod we'd
  // upgrade to a long-lived token; for v1 we use it as-is)
  const tokenRes = await fetch(
    `https://graph.facebook.com/v22.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code: parsed.data.code,
      }),
  );
  if (!tokenRes.ok) {
    return { error: `Token exchange failed: ${await tokenRes.text()}` };
  }
  const { access_token: systemUserToken } = (await tokenRes.json()) as {
    access_token: string;
  };

  let saved = 0;

  // 1. Save WhatsApp channel if we have phone_number_id + waba_id from ESU postMessage
  if (parsed.data.phone_number_id && parsed.data.waba_id) {
    const { error: waErr } = await admin.from("channels").upsert(
      {
        workspace_id: workspaceId,
        type: "whatsapp",
        external_id: parsed.data.phone_number_id,
        display_name: `WA ${parsed.data.phone_number_id.slice(-6)}`,
        access_token_enc: encrypt(systemUserToken).toString("base64"),
        meta: { waba_id: parsed.data.waba_id, business_id: parsed.data.business_id },
        status: "connected",
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,type,external_id" },
    );
    if (!waErr) saved++;
  }

  // 2. List and save FB Pages (and linked IG accounts)
  try {
    const pagesRes = await graphGet<{ data: any[] }>(
      "/me/accounts?fields=id,name,access_token,instagram_business_account",
      systemUserToken,
    );
    for (const page of pagesRes.data ?? []) {
      await admin.from("channels").upsert(
        {
          workspace_id: workspaceId,
          type: "facebook",
          external_id: page.id,
          display_name: page.name,
          access_token_enc: encrypt(page.access_token).toString("base64"),
          meta: { ig_business_account_id: page.instagram_business_account?.id ?? null },
          status: "connected",
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,type,external_id" },
      );
      saved++;

      if (page.instagram_business_account?.id) {
        await admin.from("channels").upsert(
          {
            workspace_id: workspaceId,
            type: "instagram",
            external_id: page.instagram_business_account.id,
            display_name: `${page.name} (IG)`,
            access_token_enc: encrypt(page.access_token).toString("base64"),
            meta: { page_id: page.id },
            status: "connected",
            last_verified_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,type,external_id" },
        );
        saved++;
      }
    }
  } catch (e) {
    console.warn("Could not list pages:", e);
  }

  // 3. Subscribe webhooks (best-effort)
  try {
    await fetch(`https://graph.facebook.com/v22.0/${appId}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`,
        verify_token: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
        fields: ["messages"],
      }),
    });
  } catch {
    /* best-effort */
  }
  try {
    await fetch(`https://graph.facebook.com/v22.0/${appId}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "instagram",
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/instagram`,
        verify_token: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
        fields: ["messages", "messaging_postbacks"],
      }),
    });
  } catch {
    /* best-effort */
  }

  revalidatePath("/settings/channels");
  return { saved };
}
