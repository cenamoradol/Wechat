import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

type DebugResult = {
  app: { id: string | null; name: string | null };
  token_used: "whatsapp_channel" | "none";
  bms: Array<{ id: string; name: string }>;
  pages: Array<{ id: string; name: string; tasks: string[] }>;
  whatsapp_accounts: Array<{ id: string; name: string; phone_numbers: string[] }>;
  instagram_business_accounts: Array<{
    id: string;
    page_id: string;
    username: string | null;
  }>;
  scopes: string[];
  app_id_matches: boolean;
  warnings: string[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Use any existing WA channel's token as the probe token
  const { data: ch } = await admin
    .from("channels")
    .select("access_token_enc, type, external_id")
    .eq("workspace_id", member.workspace_id)
    .eq("type", "whatsapp")
    .limit(1)
    .maybeSingle();

  const expectedAppId = process.env.NEXT_PUBLIC_META_APP_ID ?? "";

  const result: DebugResult = {
    app: { id: expectedAppId, name: "Wechat" },
    token_used: ch ? "whatsapp_channel" : "none",
    bms: [],
    pages: [],
    whatsapp_accounts: [],
    instagram_business_accounts: [],
    scopes: [],
    app_id_matches: false,
    warnings: [],
  };

  if (!ch) {
    result.warnings.push(
      "No hay canal WhatsApp conectado. Conecta uno primero (tab 'WhatsApp manual') para tener un token con el que probar.",
    );
    return NextResponse.json(result);
  }

  let token: string;
  try {
    token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    result.warnings.push(`No se pudo descifrar el token del canal: ${(e as Error).message}`);
    return NextResponse.json(result);
  }

  const GRAPH = "https://graph.facebook.com/v22.0";

  // 1. Validate token works at all by hitting /me
  try {
    const meRes = await fetch(`${GRAPH}/me?access_token=${encodeURIComponent(token)}`);
    if (!meRes.ok) {
      const text = await meRes.text();
      result.warnings.push(
        `❌ El token fue rechazado por Meta (${meRes.status}). Regenera el System User token. Detalle: ${text.slice(0, 150)}`,
      );
      return NextResponse.json(result);
    }
    const me = (await meRes.json()) as { id?: string; name?: string };
    result.warnings.push(
      `✅ Token válido para Facebook ID ${me.id}${me.name ? ` (${me.name})` : ""}.`,
    );
  } catch (e) {
    result.warnings.push(`/me excepción: ${(e as Error).message}`);
    return NextResponse.json(result);
  }

  // 2. List pages (/me/accounts)
  try {
    const r = await fetch(`${GRAPH}/me/accounts?fields=id,name,tasks&access_token=${token}`);
    if (r.ok) {
      const j = (await r.json()) as { data: any[] };
      result.pages = (j.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        tasks: p.tasks ?? [],
      }));
    } else {
      result.warnings.push(`/me/accounts error: ${await r.text()}`);
    }
  } catch (e) {
    result.warnings.push(`/me/accounts excepción: ${(e as Error).message}`);
  }

  // 3. List WABAs via /me/businesses?fields=owned_whatsapp_business_accounts
  // The /me/whatsapp_business_accounts endpoint was deprecated.
  try {
    const r = await fetch(
      `${GRAPH}/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${token}`,
    );
    if (r.ok) {
      const j = (await r.json()) as {
        data: Array<{
          id: string;
          name?: string;
          owned_whatsapp_business_accounts?: Array<{
            id: string;
            name?: string;
            phone_numbers?: Array<{
              id: string;
              display_phone_number?: string;
              verified_name?: string;
            }>;
          }>;
        }>;
      };
      result.bms = (j.data ?? []).map((b) => ({ id: b.id, name: b.name ?? b.id }));
      for (const bm of j.data ?? []) {
        for (const w of bm.owned_whatsapp_business_accounts ?? []) {
          result.whatsapp_accounts.push({
            id: w.id,
            name: w.name ?? "(sin nombre)",
            phone_numbers: (w.phone_numbers ?? []).map((p) => p.display_phone_number ?? p.id),
          });
        }
      }
    } else {
      result.warnings.push(`/me/businesses error: ${await r.text()}`);
    }
  } catch (e) {
    result.warnings.push(`/me/businesses excepción: ${(e as Error).message}`);
  }

  // 4. List IG business accounts (via /me/accounts → instagram_business_account)
  for (const page of result.pages) {
    try {
      const r = await fetch(
        `${GRAPH}/${page.id}?fields=instagram_business_account{id,username,name}&access_token=${token}`,
      );
      if (r.ok) {
        const j = (await r.json()) as { instagram_business_account?: { id: string; username?: string; name?: string } };
        if (j.instagram_business_account) {
          result.instagram_business_accounts.push({
            id: j.instagram_business_account.id,
            page_id: page.id,
            username: j.instagram_business_account.username ?? j.instagram_business_account.name ?? null,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // Final checklist
  if (result.pages.length === 0) {
    result.warnings.push(
      "❌ No se listan páginas. Tu System User no admin ninguna página o no está en el mismo BM.",
    );
  }
  if (result.instagram_business_accounts.length === 0) {
    result.warnings.push(
      "❌ No hay cuentas de Instagram Business accesibles. Vincula una IG Business/Creator a una de tus páginas.",
    );
  }
  if (result.bms.length === 0) {
    result.warnings.push(
      "❌ El token no tiene acceso a ningún Business Manager. Asigna tu System User a un BM en business.facebook.com/settings/users.",
    );
  } else {
    result.warnings.push(`✅ Tu token tiene acceso a ${result.bms.length} Business Manager(s).`);
  }
  if (result.whatsapp_accounts.length === 0) {
    result.warnings.push(
      "❌ No hay WABAs visibles. Tu System User no tiene asignado el WABA real. Ve a business.facebook.com/settings/users → tu System User → Add Assets → WhatsApp Accounts.",
    );
  }

  return NextResponse.json(result);
}