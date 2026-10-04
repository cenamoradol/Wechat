import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// Helps the user figure out which System User token they should use
// No auth required — this is a diagnostic endpoint.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json(
      { error: "Pasa { token: 'EAA...' } en el body" },
      { status: 400 },
    );
  }

  const expectedAppId = process.env.NEXT_PUBLIC_META_APP_ID ?? "";

  // Probe with this token: can it subscribe to the app?
  const result: {
    app_id: string;
    token_owner: { id: string; name: string } | null;
    has_app_subscription_access: boolean;
    has_page_access: boolean;
    has_waba_access: boolean;
    has_business_manager: boolean;
    recommendations: string[];
  } = {
    app_id: expectedAppId,
    token_owner: null,
    has_app_subscription_access: false,
    has_page_access: false,
    has_waba_access: false,
    has_business_manager: false,
    recommendations: [],
  };

  // 1. Get token owner
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${encodeURIComponent(token)}`);
    if (r.ok) {
      const me = (await r.json()) as { id: string; name: string };
      result.token_owner = { id: me.id, name: me.name };
    }
  } catch {
    // ignore
  }

  // 2. Test app-level webhook subscription
  if (expectedAppId) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v22.0/${expectedAppId}/subscriptions?access_token=${encodeURIComponent(token)}`,
      );
      result.has_app_subscription_access = r.ok;
      if (!r.ok) {
        const text = await r.text();
        result.recommendations.push(
          `❌ El System User (ID: ${result.token_owner?.id ?? "?"}) NO está asignado a la app ${expectedAppId}. Ve a business.facebook.com/settings/users → ese System User → sección "Apps" → Add Apps → selecciona "Wechat" → Full Control.`,
        );
      } else {
        result.recommendations.push("✅ El System User SÍ está asignado a la app. Puede suscribir webhooks.");
      }
    } catch {
      // ignore
    }
  }

  // 3. Test page access
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?access_token=${encodeURIComponent(token)}`,
    );
    if (r.ok) {
      const j = (await r.json()) as { data: Array<{ id: string; name: string }> };
      const pages = j.data ?? [];
      result.has_page_access = pages.length > 0;
      if (pages.length === 0) {
        result.recommendations.push(
          "❌ El System User no admin ninguna página. Agrégale tus páginas en business.facebook.com/settings/users → sección Pages.",
        );
      } else {
        result.recommendations.push(`✅ Páginas accesibles: ${pages.map((p) => p.name).join(", ")}`);
      }
    }
  } catch {
    // ignore
  }

  // 4. Test WABA access
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/2017363685552310?access_token=${encodeURIComponent(token)}`,
    );
    result.has_waba_access = r.ok;
    if (!r.ok) {
      result.recommendations.push(
        "❌ El System User no tiene acceso al WABA 2017363685552310.",
      );
    } else {
      result.recommendations.push("✅ WABA accesible directamente.");
    }
  } catch {
    // ignore
  }

  // 5. Test business manager access
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/me/businesses?access_token=${encodeURIComponent(token)}`,
    );
    if (r.ok) {
      const j = (await r.json()) as { data: unknown[] };
      result.has_business_manager = (j.data?.length ?? 0) > 0;
      if (!result.has_business_manager) {
        result.recommendations.push(
          "⚠️ /me/businesses está vacío. El System User técnicamente tiene acceso al WABA pero no está formalmente listado como miembro del BM donde está el WABA.",
        );
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(result);
}