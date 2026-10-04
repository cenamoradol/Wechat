import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { legacyLoginUrl, metaRedirectUri } from "@/lib/meta/login-config";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: member } = await supabase.from("workspace_members")
    .select("workspace_id, role").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Solo owner/admin puede conectar canales" }, { status: 403 });
  }
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const redirectUri = metaRedirectUri();

  if (!appId || !redirectUri) {
    return new NextResponse("META_APP_ID or NEXT_PUBLIC_APP_URL missing", { status: 500 });
  }

  const state = crypto.randomUUID();
  const url = legacyLoginUrl(appId, redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set("meta_oauth_state", JSON.stringify({ state, userId: user.id, workspaceId: member.workspace_id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/oauth/meta",
  });
  return res;
}
