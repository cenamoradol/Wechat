import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Cleanup utility: mark failed upsert events as processed once we've fixed
// the underlying constraint. Run after applying migration 008 to stop noise
// in the webhook_events table.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webhook_events")
    .update({ processed: true, error: "Resolved by migration 008 (partial unique index → full)" })
    .like("type", "error:message-upsert:%")
    .eq("processed", false)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleaned: data?.length ?? 0 });
}