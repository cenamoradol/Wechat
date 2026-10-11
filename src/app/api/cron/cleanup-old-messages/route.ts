import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily soft-delete for messages older than 30 days. Marks `deleted_at`
 * so the UI hides them but the row stays in the DB for audit / analytics.
 *
 * The corresponding media files are already deleted by /api/cron/cleanup-media
 * after 7 days, so we don't need to touch storage here.
 *
 * Schedule: every day at 04:00 UTC (configured in vercel.json).
 */
export async function GET(req: NextRequest) {
  // Vercel cron sets this header automatically
  if (req.headers.get("user-agent")?.includes("vercel-cron") === false) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .is("deleted_at", null)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("cleanup-old-messages failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    softDeleted: data?.length ?? 0,
  });
}