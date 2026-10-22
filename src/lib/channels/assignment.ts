// src/lib/channels/assignment.ts
// Single source of truth for "is the AI allowed to talk on this conversation?".
//
// A conversation assigned to a human is on-hold: automations don't run and the
// default agent doesn't auto-reply. The hold expires so a customer who writes
// again the next morning still gets an answer instead of silence.
//
// ponytail: evaluated lazily at trigger time rather than swept by a cron. No
// infra to keep alive, and it self-heals the moment the hold expires. The
// expiry also clears the stale assignee so the inbox doesn't display a seller
// who stopped working three days ago.

import { createAdminClient } from "@/lib/supabase/admin";

/** How long a human assignment keeps the AI quiet. */
export const AI_HOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

type Assignment = { assigned_to: string | null; assigned_at: string | null };

/**
 * Pure check — no I/O. Returns true when a human holds the conversation and
 * the hold hasn't expired. A missing/unparsable assigned_at reads as expired
 * so a legacy row can never silence the AI forever.
 */
export function isHoldActive(
  conv: Assignment | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!conv?.assigned_to) return false;
  if (!conv.assigned_at) return false;
  const at = Date.parse(conv.assigned_at);
  if (Number.isNaN(at)) return false;
  return now - at < AI_HOLD_MS;
}

/**
 * Same question, answered from the DB. Expired assignments are cleared as a
 * side effect so `conversations.assigned_to` stops showing a stale owner.
 * Never throws — callers are on the webhook hot path.
 */
export async function isAiOnHold(conversationId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("conversations")
      .select("assigned_to, assigned_at")
      .eq("id", conversationId)
      .maybeSingle();

    const conv = data as Assignment | null;
    if (isHoldActive(conv)) return true;

    // Expired (or legacy without assigned_at): drop the owner so the UI and
    // the push target reflect reality. Only assigned_at needs clearing too,
    // otherwise a later read would re-evaluate the same stale pair.
    if (conv?.assigned_to) {
      await admin
        .from("conversations")
        .update({ assigned_to: null, assigned_at: null })
        .eq("id", conversationId);
      console.log(
        `[assignment] hold expired for conversation=${conversationId} (was ${conv.assigned_to}) — AI resumes`,
      );
    }
    return false;
  } catch (e) {
    // Fail open: a DB hiccup must not silently mute the business.
    console.error("isAiOnHold failed, treating as not-on-hold", e);
    return false;
  }
}

/** Stamp a new assignment. Call this whenever assigned_to is written. */
export async function markAssigned(conversationId: string, userId: string | null) {
  const admin = createAdminClient();
  await admin
    .from("conversations")
    .update({ assigned_to: userId, assigned_at: userId ? new Date().toISOString() : null })
    .eq("id", conversationId);
}