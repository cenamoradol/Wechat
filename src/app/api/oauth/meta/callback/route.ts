import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToBase64 } from "@/lib/crypto";
import { META_GRAPH_VERSION, metaRedirectUri } from "@/lib/meta/login-config";

const Context = z.object({ state: z.string().uuid(), userId: z.string().uuid(), workspaceId: z.string().uuid() });
const Page = z.object({
  id: z.string().regex(/^\d+$/), name: z.string(), access_token: z.string().min(1),
  instagram_business_account: z.object({ id: z.string().regex(/^\d+$/) }).optional(),
});
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export async function GET(req: NextRequest) {
  const finish = (params: Record<string, string>) => {
    const url = new URL("/settings/channels", req.url);
    url.search = new URLSearchParams(params).toString();
    const res = NextResponse.redirect(url);
    res.cookies.set("meta_oauth_state", "", { path: "/api/oauth/meta", maxAge: 0 });
    res.cookies.set("meta_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return finish({ error: "La sesión expiró. Inicia sesión y vuelve a conectar." });

  let context;
  try { context = Context.parse(JSON.parse(req.cookies.get("meta_oauth_state")?.value ?? "")); }
  catch { return finish({ error: "Conexión caducada. Inicia nuevamente la conexión con Facebook." }); }
  if (context.state !== req.nextUrl.searchParams.get("state") || context.userId !== user.id) {
    return finish({ error: "La validación de la conexión falló. Vuelve a intentarlo." });
  }
  const { data: member, error: memberError } = await supabase.from("workspace_members")
    .select("role").eq("workspace_id", context.workspaceId).eq("user_id", user.id).maybeSingle();
  if (memberError || !member || !["owner", "admin"].includes(member.role)) return finish({ error: "Sin permiso para conectar canales." });
  if (req.nextUrl.searchParams.has("error")) return finish({ error: "Autorización cancelada o rechazada por Meta." });
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return finish({ error: "Meta no devolvió el código de autorización." });

  let saved = 0;
  const warnings: string[] = [];
  try {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const secret = process.env.META_APP_SECRET;
    if (!appId || !secret) throw new Error("Faltan las credenciales de la app Meta en el servidor.");
    const exchange = await fetch(`${GRAPH}/oauth/access_token`, {
      method: "POST", cache: "no-store", body: new URLSearchParams({
        client_id: appId, client_secret: secret, redirect_uri: metaRedirectUri(), code,
      }),
    });
    if (!exchange.ok) throw new Error("Meta rechazó el código. Comprueba App ID, App Secret y la URL de retorno.");
    const { access_token: token } = z.object({ access_token: z.string().min(1) }).parse(await exchange.json());
    const pages: z.infer<typeof Page>[] = [];
    let after: string | undefined;
    do {
      const url = new URL(`${GRAPH}/me/accounts`);
      url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron consultar páginas e Instagram. Revisa pages_show_list, pages_read_engagement e instagram_basic en la autorización.");
      const list = z.object({ data: z.array(Page), paging: z.object({
        next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional(),
      }).optional() }).parse(await response.json());
      pages.push(...list.data);
      const next = list.paging?.next ? list.paging.cursors?.after : undefined;
      if (next && next === after) throw new Error("Meta repitió la paginación. Intenta conectar nuevamente.");
      after = next;
    } while (after);
    if (!pages.length) return finish({ error: "Meta no autorizó ninguna página. Selecciona PM Solution al conectar." });

    const admin = createAdminClient();
    for (const page of pages) {
      const channels = [{ type: "facebook" as const, id: page.id, name: page.name },
        ...(page.instagram_business_account ? [{ type: "instagram" as const, id: page.instagram_business_account.id, name: `${page.name} (Instagram)` }] : [])];
      for (const channel of channels) {
        const { error } = await admin.from("channels").upsert({
          workspace_id: context.workspaceId, type: channel.type, external_id: channel.id,
          display_name: channel.name, access_token_enc: encryptToBase64(page.access_token),
          meta: { page_id: page.id }, status: "connected", last_verified_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,type,external_id" });
        if (error) throw new Error("No se pudo guardar un canal autorizado. Los canales guardados previamente se conservan.");
        saved++;
      }
      const subscription = await fetch(`${GRAPH}/${page.id}/subscribed_apps`, {
        method: "POST", headers: { Authorization: `Bearer ${page.access_token}` },
        body: new URLSearchParams({ subscribed_fields: "messages,messaging_postbacks,message_deliveries,message_reads" }),
      });
      const result = await subscription.json();
      if (!subscription.ok || result.success !== true) warnings.push(`No se confirmó la suscripción de la página ${page.id}; revisa pages_manage_metadata y Webhooks en Meta.`);
    }
    if (!pages.some(p => p.instagram_business_account)) warnings.push("Meta no devolvió una cuenta Instagram vinculada; esto no confirma que no exista. Revisa permisos y la selección de activos.");
    return finish({ connected: String(saved), ...(warnings.length ? { error: warnings.join(" ") } : {}) });
  } catch (error) {
    return finish({ error: error instanceof Error ? error.message : "No se pudo completar la conexión con Meta.", ...(saved ? { connected: String(saved) } : {}) });
  }
}
