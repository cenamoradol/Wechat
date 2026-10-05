import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { processInbound } from "@/lib/channels/process";

export const runtime = "nodejs";

const GRAPH = "https://graph.facebook.com/v22.0";
const MESSAGE_LIMIT = 20;

type Channel = {
  id: string;
  workspace_id: string;
  type: "facebook" | "instagram";
  external_id: string;
  access_token_enc: string;
  meta: { page_id?: string; last_polled_at?: string; username?: string } | null;
};

type GraphMessage = {
  id: string;
  message?: string;
  created_time: string;
  from?: { id: string; name?: string };
};

async function pollOneChannel(ch: Channel): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  const token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  const pageId = ch.type === "facebook" ? ch.external_id : ch.meta?.page_id;
  if (!pageId) {
    return { processed: 0, errors: [`${ch.id}: no page_id in meta`] };
  }
  const since = ch.meta?.last_polled_at;
  const sinceUnix = since ? Math.floor(new Date(since).getTime() / 1000) : undefined;

  const fields = `id,updated_time,messages.limit(${MESSAGE_LIMIT}){id,message,created_time,from}`;
  const url = new URL(`${GRAPH}/${pageId}/conversations`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "50");
  if (ch.type === "instagram") url.searchParams.set("platform", "instagram");
  if (sinceUnix) url.searchParams.set("since", String(sinceUnix));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    return { processed: 0, errors: [`${ch.id} (${ch.type}): ${res.status} ${await res.text()}`] };
  }
  const data = (await res.json()) as { data?: { id: string; messages?: { data?: GraphMessage[] } }[] };
  const conversations = data.data ?? [];
  let processed = 0;

  for (const conv of conversations) {
    const messages = conv.messages?.data ?? [];
    for (const msg of messages) {
      // Skip our own outgoing messages (from.page_id == pageId)
      if (!msg.from?.id || msg.from.id === pageId) continue;
      // Skip empty (stickers, etc.) — keep them as `type: "text"` with null text? For MVP, skip.
      if (!msg.message) continue;

      await processInbound({
        channelType: ch.type,
        channelExternalId: ch.external_id,
        contactExternalId: msg.from.id,
        messageExternalId: msg.id,
        direction: "in",
        text: msg.message,
        timestamp: new Date(msg.created_time),
        type: "text",
        raw: msg,
      });
      processed++;
    }
  }

  return { processed, errors };
}

export async function GET(req: NextRequest) {
  // Vercel Cron auth — header check
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: channels } = await admin
    .from("channels")
    .select("id, workspace_id, type, external_id, access_token_enc, meta")
    .in("type", ["facebook", "instagram"])
    .eq("status", "connected");

  let totalProcessed = 0;
  const allErrors: string[] = [];
  const now = new Date().toISOString();

  for (const ch of (channels ?? []) as Channel[]) {
    try {
      const { processed, errors } = await pollOneChannel(ch);
      totalProcessed += processed;
      allErrors.push(...errors);
      // Always bump the cursor so we make forward progress
      await admin
        .from("channels")
        .update({ meta: { ...(ch.meta ?? {}), last_polled_at: now } })
        .eq("id", ch.id);
    } catch (e) {
      allErrors.push(`${ch.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, processed: totalProcessed, errors: allErrors });
}