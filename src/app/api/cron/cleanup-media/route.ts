import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteConversationMedia } from "@/lib/supabase/storage";

/**
 * Daily cleanup job:
 *  1. Delete media files for messages older than 7 days
 *     in non-archived conversations.
 *  2. Delete media files for messages in archived conversations
 *     (in case any leaked through).
 *  3. The DB rows themselves are preserved (text + media_url null).
 *
 * Vercel Cron calls this once a day.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  let deletedFiles = 0;
  let updatedRows = 0;
  const errors: string[] = [];

  try {
    // 1. Find all messages with media in non-archived conversations,
    //    where message is older than 7 days.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldMedia, error: qErr } = await admin
      .from("messages")
      .select("id, conversation_id, media_url, conversations!inner(workspace_id, archived_at)")
      .not("media_url", "is", null)
      .lt("created_at", sevenDaysAgo)
      .is("conversations.archived_at", null);

    if (qErr) {
      errors.push(`query old media: ${qErr.message}`);
    } else if (oldMedia && oldMedia.length > 0) {
      // Group by conversation for batch delete
      const byConv: Record<string, string[]> = {};
      for (const m of oldMedia) {
        const cid = (m as any).conversation_id;
        if (!byConv[cid]) byConv[cid] = [];
        byConv[cid].push((m as any).id);
      }
      for (const cid of Object.keys(byConv)) {
        const res = await deleteConversationMedia(cid);
        deletedFiles += res.deleted;
        updatedRows += byConv[cid].length;
        if (res.errors > 0) errors.push(`${cid}: ${res.errors} file errors`);
      }
    }

    // 2. Safety net: archived conversations — their media should already
    //    be gone, but if any leaked through, clean them up.
    const { data: archivedMedia, error: q2 } = await admin
      .from("messages")
      .select("id, conversation_id, conversations!inner(workspace_id, archived_at)")
      .not("media_url", "is", null)
      .not("conversations.archived_at", "is", null);

    if (q2) {
      errors.push(`query archived media: ${q2.message}`);
    } else if (archivedMedia && archivedMedia.length > 0) {
      const byConv: Record<string, string[]> = {};
      for (const m of archivedMedia) {
        const cid = (m as any).conversation_id;
        if (!byConv[cid]) byConv[cid] = [];
        byConv[cid].push((m as any).id);
      }
      for (const cid of Object.keys(byConv)) {
        const res = await deleteConversationMedia(cid);
        deletedFiles += res.deleted;
        updatedRows += byConv[cid].length;
      }
    }
  } catch (e) {
    errors.push(`unexpected: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    deletedFiles,
    updatedRows,
    errors,
  });
}