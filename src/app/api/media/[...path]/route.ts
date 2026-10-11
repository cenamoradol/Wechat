import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Media proxy route. The `media` bucket is private, so we stream files
 * through this route after validating the user has access to the
 * workspace the file belongs to (encoded in the path as the first segment).
 *
 * Path format: <workspaceId>/messages/<conversationId>/<file>
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const fullPath = segments.join("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First segment is the workspaceId. Verify membership.
  const workspaceId = segments[0];
  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberErr) {
    return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Stream the file with the admin client (bypasses storage RLS).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.storage
    .from("media")
    .download(fullPath);
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Forward Content-Type and length; allow the browser to cache.
  const headers = new Headers();
  if (data.type) headers.set("Content-Type", data.type);
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(data as unknown as BodyInit, { headers });
}