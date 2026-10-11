import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authed" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return NextResponse.json({ error: "no workspace" }, { status: 400 });
  const { data, error } = await supabase
    .from("ai_provider_keys")
    .select("provider, workspace_id, label, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    current_workspace: workspaceId,
    keys: data,
  });
}