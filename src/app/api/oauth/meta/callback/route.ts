import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { graphGet, graphPost } from "@/lib/meta/oauth";

type PageAsset = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/settings/channels?error=${encodeURIComponent(error ?? "no_code")}`, req.url),
    );
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }

  // 1. Exchange code → user access_token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.redirect(
      new URL(`/settings/channels?error=${encodeURIComponent("token_exchange:" + text)}`, req.url),
    );
  }
  const { access_token: userToken } = (await tokenRes.json()) as { access_token: string };

  // 2. List user's pages
  const pagesRes = await graphGet<{ data: PageAsset[] }>("/me/accounts?fields=id,name,access_token,instagram_business_account", userToken);
  const pages = pagesRes.data ?? [];

  // 3. Get workspace of this user
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) {
    return NextResponse.redirect(new URL("/onboarding?error=no_workspace", req.url));
  }
  const workspaceId = member.workspace_id;

  // 4. Store each page + linked IG account as channels
  let saved = 0;
  for (const page of pages) {
    const encToken = encrypt(page.access_token);
    await admin.from("channels").upsert(
      {
        workspace_id: workspaceId,
        type: "facebook",
        external_id: page.id,
        display_name: page.name,
        access_token_enc: encToken.toString("base64"),
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

  // 5. Best-effort subscribe to webhooks (may fail if app needs review)
  // For Messenger + IG, the proper way is page-level subscriptions via /{page-id}/subscribed_apps
  for (const page of pages) {
    try {
      await fetch(
        `https://graph.facebook.com/v22.0/${page.id}/subscribed_apps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${page.access_token}`,
          },
          body: JSON.stringify({
            subscribed_fields: ["messages", "messaging_postbacks", "message_deliveries"],
          }),
        },
      );
    } catch (e) {
      console.warn(`Page-level subscribe failed for ${page.id}:`, e);
    }
  }

  // Also try app-level instagram subscription (best-effort, may need app review)
  try {
    await fetch(
      `https://graph.facebook.com/v22.0/${appId}/subscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          object: "instagram",
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/instagram`,
          verify_token: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
          fields: ["messages", "messaging_postbacks"],
        }),
      },
    );
  } catch (e) {
    console.warn("App-level instagram subscription failed (may need app review):", e);
  }

  return NextResponse.redirect(
    new URL(`/settings/channels?connected=${saved}`, req.url),
  );
}