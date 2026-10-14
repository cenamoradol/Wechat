// Debug: shows the last N push attempts (successes + failures) for the
// current user. In-memory ring buffer; resets on server restart.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPushLogs } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authed" }, { status: 401 });
  return NextResponse.json({ logs: getPushLogs() });
}