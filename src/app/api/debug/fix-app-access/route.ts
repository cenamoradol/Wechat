import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Adds the current channel's System User to the new app via Meta API
// (uses app access token via client_credentials grant)
export async function POST() {
  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("channels")
    .select("access_token_enc, type, id")
    .eq("type", "whatsapp")
    .limit(1)
    .maybeSingle();
  if (!ch) return NextResponse.json({ error: "Canal no encontrado" }, { status: 404 });

  let userToken: string;
  try {
    userToken = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    return NextResponse.json({ error: `No se pudo descifrar: ${(e as Error).message}` }, { status: 500 });
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "META_APP_ID / META_APP_SECRET no configurados" }, { status: 500 });
  }

  const log: string[] = [];

  // 1. Get System User ID from the stored token
  const meRes = await fetch(
    `https://graph.facebook.com/v22.0/me?access_token=${encodeURIComponent(userToken)}`,
  );
  if (!meRes.ok) {
    const t = await meRes.text();
    return NextResponse.json({ error: `Token inválido: ${t}` }, { status: 400 });
  }
  const me = (await meRes.json()) as { id: string; name: string };
  log.push(`ℹ️ System User: ${me.name} (${me.id})`);

  // 2. Get an APP access token (client_credentials grant) — this is what allows app-level operations
  const tokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: appId,
        client_secret: appSecret,
      }),
  );
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return NextResponse.json({ error: `No se pudo obtener app access token: ${t}` }, { status: 500 });
  }
  const { access_token: appToken } = (await tokenRes.json()) as { access_token: string };
  log.push(`✅ App access token obtenido`);

  // 3. Add the System User to the app with admin role
  const addRes = await fetch(
    `https://graph.facebook.com/v22.0/${appId}/assigned_users`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: me.id, role: "administrator" }),
    },
  );
  const addText = await addRes.text();
  if (addRes.ok || addText.includes("already")) {
    log.push(`✅ System User asignado a la app como administrator`);
  } else {
    log.push(`❌ No se pudo asignar: ${addRes.status} ${addText.slice(0, 200)}`);
    return NextResponse.json({ log, error: addText }, { status: 500 });
  }

  // 4. Now re-subscribe webhooks using the APP access token (which has app admin)
  const results: { object: string; ok: boolean; status: number; msg?: string }[] = [];
  const objects: Array<{ object: string; fields: string[] }> = [
    { object: "whatsapp_business_account", fields: ["messages", "message_deliveries", "message_reads"] },
    { object: "instagram", fields: ["messages", "messaging_postbacks", "message_deliveries", "message_reads"] },
  ];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://wechat-eight-sigma.vercel.app";

  for (const o of objects) {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${appId}/subscriptions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: o.object,
          callback_url: `${appUrl}/api/webhooks/${o.object === "whatsapp_business_account" ? "whatsapp" : "instagram"}`,
          verify_token: verifyToken,
          fields: o.fields,
        }),
      },
    );
    const body = await r.json().catch(() => ({}));
    results.push({
      object: o.object,
      ok: r.ok,
      status: r.status,
      msg: typeof body === "object" && "error" in body ? (body as any).error?.message : undefined,
    });
  }

  const allOk = results.every((r) => r.ok);
  log.push(
    `📡 Webhook subscriptions: ${results
      .map((r) => `${r.ok ? "✅" : "❌"} ${r.object} (${r.status})`)
      .join(", ")}`,
  );

  return NextResponse.json({
    log,
    ok: allOk,
    details: results,
  });
}