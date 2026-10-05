import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the user's workspace conversations ordered by last_message_at desc.
 * Used by the sidebar polling fallback.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ conversations: [] });

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, last_message_preview, unread_count, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type))",
    )
    .eq("workspace_id", member.workspace_id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}