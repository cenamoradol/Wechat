import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
  if (!appId || !redirectUri) {
    return new NextResponse("Meta OAuth env vars missing", { status: 500 });
  }

  const state = req.nextUrl.searchParams.get("state") ?? crypto.randomUUID();
  const useV4 = configId && !configId.startsWith("<");

  // Scopes needed for FB + IG (works with or without Embedded Signup)
  const scopes = [
    "business_management",
    "pages_show_list",
    "pages_messaging",
    "instagram_basic",
    "instagram_manage_messages",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });
  if (useV4) params.set("config_id", configId);

  const url = `https://www.facebook.com/v22.0/dialog/oauth?${params}`;

  const res = NextResponse.redirect(url);
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
  });
  return res;
}