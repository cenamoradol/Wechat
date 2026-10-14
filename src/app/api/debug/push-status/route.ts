// Debug endpoint: shows VAPID config + DB state + subscriptions for current user.
// Useful to diagnose why push notifications aren't arriving.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushEnabled, sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authed" }, { status: 401 });

  const admin = createAdminClient();

  // 1. VAPID config check
  const serverEnabled = pushEnabled();

  // 2. Profile prefs
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .maybeSingle();

  // 3. Subscriptions
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, workspace_id, user_agent, created_at, last_seen_at, subscription")
    .eq("user_id", user.id);

  return NextResponse.json({
    serverEnabled,
    vapid: {
      publicKey: serverEnabled
        ? `${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.slice(0, 20)}…`
        : "(not set)",
      privateKey: !!process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT ?? "(not set)",
    },
    profile: {
      notification_prefs: profile?.notification_prefs ?? null,
      columnError: profileErr?.message ?? null,
    },
    subscriptions: (subs ?? []).map((s) => ({
      id: s.id,
      workspace_id: s.workspace_id,
      user_agent: s.user_agent?.slice(0, 80) ?? null,
      endpoint: (s.subscription as { endpoint?: string })?.endpoint?.slice(0, 60) ?? "?",
      has_keys:
        !!(s.subscription as { keys?: { p256dh?: string; auth?: string } })?.keys?.p256dh,
      created_at: s.created_at,
      last_seen_at: s.last_seen_at,
    })),
    columnError: subsErr?.message ?? null,
  });
}

/**
 * POST = send a test push to all subscriptions of the current user.
 * Body: { title?, body? }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authed" }, { status: 401 });

  let body: { title?: string; body?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const result = await sendPushToUser({
    userId: user.id,
    event: "new_message",
    payload: {
      title: body.title ?? "Test push · Wechat",
      body: body.body ?? "Si ves esto, las push funcionan 🎉",
      href: "/inbox",
      tag: `test-${Date.now()}`,
    },
  });

  return NextResponse.json(result);
}