// Push notification sender — Web Push API via web-push + VAPID.
//
// Flow:
//   1. Client subscribes via PushManager (in browser) → PushSubscription JSON
//   2. Client POSTs the subscription to a server action → saved in
//      public.push_subscriptions (one row per browser/device)
//   3. When an event fires (e.g. processInbound), call sendPushToUser()
//      which loads all subscriptions for that user + checks their
//      notification_prefs toggle for the event.

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "./env";

export type PushEvent =
  | "new_message"
  | "conversation_assigned"
  | "automation_failed"
  | "ai_handoff"
  | "new_contact";

export type NotificationPrefs = Partial<Record<PushEvent, boolean>>;

export const DEFAULT_PREFS: NotificationPrefs = {
  new_message: true,
  conversation_assigned: true,
  automation_failed: true,
  ai_handoff: true,
  new_contact: false,
};

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return false;
  }
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

/** True si el server tiene claves VAPID configuradas. */
export function pushEnabled(): boolean {
  return Boolean(
    env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  href?: string;
  tag?: string;
};

// In-memory ring buffer of recent push attempts. Used by /api/debug/push-logs.
// Resets on server restart — good enough for debugging.
const LOG_LIMIT = 50;
export type PushLogEntry = {
  ts: string;
  userId: string;
  event: PushEvent;
  endpoint: string | null;
  status: "sent" | "removed" | "skipped" | "no_subs" | "pref_off" | "error";
  detail?: string;
};
const logs: PushLogEntry[] = [];
export function getPushLogs() {
  return [...logs];
}
function log(entry: PushLogEntry) {
  logs.unshift(entry);
  if (logs.length > LOG_LIMIT) logs.length = LOG_LIMIT;
}

/**
 * Send a push to every active subscription of `userId` that has the event
 * toggle enabled in their notification_prefs.
 *
 * Returns { sent, removed } — `removed` counts subscriptions that were deleted
 * because they returned 404/410 (user revoked permission or browser cleaned up).
 */
export async function sendPushToUser(args: {
  userId: string;
  event: PushEvent;
  payload: PushPayload;
}): Promise<{ sent: number; removed: number; skipped: boolean }> {
  if (!ensureConfigured()) {
    log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: null, status: "skipped", detail: "VAPID not configured" });
    return { sent: 0, removed: 0, skipped: true };
  }

  const admin = createAdminClient();

  // Load user prefs + all their push subscriptions in parallel.
  const [{ data: profile }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("notification_prefs").eq("id", args.userId).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", args.userId),
  ]);

  const prefs: NotificationPrefs = {
    ...DEFAULT_PREFS,
    ...((profile?.notification_prefs as NotificationPrefs | null) ?? {}),
  };
  if (!prefs[args.event]) {
    log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: null, status: "pref_off" });
    return { sent: 0, removed: 0, skipped: false };
  }

  if (!subs || subs.length === 0) {
    log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: null, status: "no_subs" });
    return { sent: 0, removed: 0, skipped: false };
  }

  let sent = 0;
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      const ep = (s.subscription as { endpoint?: string })?.endpoint ?? null;
      try {
        await webpush.sendNotification(
          s.subscription as unknown as webpush.PushSubscription,
          JSON.stringify(args.payload),
          { TTL: 60 * 60 }, // 1h
        );
        sent++;
        log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: ep, status: "sent" });
        await admin
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (e: any) {
        const code = e?.statusCode;
        // 404/410 = subscription is dead, remove it. 401/403 = VAPID config issue.
        if (code === 404 || code === 410) {
          dead.push(s.id);
          log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: ep, status: "removed", detail: `${code}` });
        } else {
          log({ ts: new Date().toISOString(), userId: args.userId, event: args.event, endpoint: ep, status: "error", detail: `${code ?? "?"} ${e?.body ?? e?.message ?? ""}` });
          console.error("[push] send failed", code, e?.body);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, removed: dead.length, skipped: false };
}

/**
 * Send the same push to multiple users at once (e.g. workspace owners on
 * automation failure). Skips users whose prefs disable the event.
 */
export async function sendPushToUsers(args: {
  userIds: string[];
  event: PushEvent;
  payload: PushPayload;
}): Promise<{ sent: number; removed: number }> {
  const results = await Promise.all(
    args.userIds.map((id) => sendPushToUser({ userId: id, event: args.event, payload: args.payload })),
  );
  return {
    sent: results.reduce((acc, r) => acc + r.sent, 0),
    removed: results.reduce((acc, r) => acc + r.removed, 0),
  };
}