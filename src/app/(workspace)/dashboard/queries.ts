// Query helpers for the dashboard. Used by server components only.

import { createAdminClient } from "@/lib/supabase/admin";

export type MessagesPerDay = {
  date: string; // ISO date (YYYY-MM-DD)
  whatsapp: number;
  facebook: number;
  instagram: number;
};

export async function getMessagesPerDay(
  workspaceId: string,
  days = 14,
): Promise<MessagesPerDay[]> {
  const admin = createAdminClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString();

  // Fetch inbound messages in the window; join via conversation to scope,
  // and via contact_channels → channels for the type.
  const { data } = await admin
    .from("messages")
    .select(
      "created_at, conversations!inner(workspace_id, contact_channels!inner(channels!inner(type)))",
    )
    .eq("direction", "in")
    .gte("created_at", startIso)
    .eq("conversations.workspace_id", workspaceId);

  // Bucket by date + channel
  const buckets = new Map<string, MessagesPerDay>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, whatsapp: 0, facebook: 0, instagram: 0 });
  }

  for (const row of data ?? []) {
    const key = new Date(row.created_at as string).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const type = (row as any).conversations?.contact_channels?.channels?.type as
      | "whatsapp"
      | "facebook"
      | "instagram"
      | undefined;
    if (type) bucket[type]++;
  }

  return Array.from(buckets.values());
}