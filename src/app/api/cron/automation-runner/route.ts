import { NextRequest, NextResponse } from "next/server";
import { resumeScheduledRuns } from "@/lib/automations/engine";

/**
 * Resume automation runs whose `scheduled_at` has passed.
 * Schedule: every minute (configured in vercel.json).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("user-agent")?.includes("vercel-cron") === false) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const resumed = await resumeScheduledRuns();
  return NextResponse.json({ ok: true, resumed });
}