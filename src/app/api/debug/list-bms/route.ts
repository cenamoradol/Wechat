import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// List all Businesses the current app is connected to, with all System Users
// in each. This helps the user figure out where the mystery SU lives.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { data: ch } = await admin
    .from("channels")
    .select("access_token_enc, type")
    .eq("workspace_id", member.workspace_id)
    .eq("type", "whatsapp")
    .limit(1)
    .maybeSingle();
  if (!ch) return NextResponse.json({ error: "No hay canal" }, { status: 400 });

  let userToken: string;
  try {
    userToken = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    return NextResponse.json({ error: `No se pudo descifrar: ${(e as Error).message}` }, { status: 500 });
  }

  const log: string[] = [];

  // Get the System User ID and info
  const meRes = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${encodeURIComponent(userToken)}`);
  if (!meRes.ok) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }
  const me = (await meRes.json()) as { id: string; name: string };
  log.push(`ℹ️ Token belongs to System User: ${me.name} (${me.id})`);

  // Get app info
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "META_APP_ID/SECRET missing" }, { status: 500 });
  }

  // Get app access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/oauth/access_token?` +
      new URLSearchParams({ grant_type: "client_credentials", client_id: appId, client_secret: appSecret }),
  );
  const { access_token: appToken } = (await tokenRes.json()) as { access_token: string };

  // Try to find all BMs that have access to this app
  // We need to use Business Manager API: /{app-id}/accounts (returns BMs that have added the app)
  const bmsRes = await fetch(
    `https://graph.facebook.com/v22.0/${appId}/accounts?fields=id,name&access_token=${appToken}`,
  );
  const bmsJson = await bmsRes.json();
  log.push(`ℹ️ BMs que han agregado esta app: ${JSON.stringify(bmsJson)}`);

  // For each BM, list system users
  const businesses = Array.isArray(bmsJson.data) ? bmsJson.data : [];
  const result: Array<{
    bm_id: string;
    bm_name: string;
    system_users: Array<{ id: string; name: string; role: string }>;
  }> = [];

  for (const bm of businesses) {
    try {
      const suRes = await fetch(
        `https://graph.facebook.com/v22.0/${bm.id}/system_users?fields=id,name,role&access_token=${appToken}`,
      );
      const suJson = await suRes.json();
      const sus = Array.isArray(suJson.data) ? suJson.data : [];
      result.push({
        bm_id: bm.id,
        bm_name: bm.name,
        system_users: sus.map((s: any) => ({ id: s.id, name: s.name, role: s.role })),
      });
    } catch (e) {
      result.push({ bm_id: bm.id, bm_name: bm.name, system_users: [] });
    }
  }

  // Check if our token's SU is in any of them
  const targetSU = result
    .flatMap((bm) => bm.system_users.map((su) => ({ ...su, bm_id: bm.bm_id, bm_name: bm.bm_name })))
    .find((su) => su.id === me.id);

  return NextResponse.json({
    log,
    app_id: appId,
    your_system_user: { id: me.id, name: me.name },
    found_in_business: targetSU
      ? { bm_id: targetSU.bm_id, bm_name: targetSU.bm_name }
      : null,
    businesses: result,
    recommendations: targetSU
      ? [
          `✅ Tu System User (${me.id}) está en el BM "${targetSU.bm_name}" (${targetSU.bm_id}).`,
          `Para asignarlo a la app, ve a business.facebook.com/${targetSU.bm_id}/settings/users/${me.id} → sección "Apps" → "Add Apps" → selecciona "Wechat" (${appId}) → Full Control.`,
        ]
      : [
          `⚠️ Tu System User (${me.id}) no aparece en ningún Business Manager que tenga esta app.`,
          `El System User probablemente está en una Meta account/organización diferente.`,
          `Recomendación: contacta a Meta support o usa el System User que SÍ ves en tu UI actual (admin / 61592458953927) y genera un token DESDE ESE.`,
        ],
  });
}