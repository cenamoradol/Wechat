import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight polling endpoint used by the inbox client as a realtime fallback.
 * Returns messages for a conversation created after the given timestamp.
 * Body shape: { conversationId: string, sinceISO?: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, sinceISO } = (await req.json()) as {
    conversationId?: string;
    sinceISO?: string;
  };
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  let query = supabase
    .from("messages")
    .select("id, direction, type, text, status, created_at, external_id, read_at, sent_by, media_url, media_mime, media_filename, media_size_bytes, profiles:profiles!messages_sent_by_fkey(full_name, email)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (sinceISO) {
    query = query.gt("created_at", sinceISO);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}