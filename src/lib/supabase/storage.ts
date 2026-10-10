import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Service-role client for storage admin ops (delete files, list, etc).
 * Uses SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin client not configured");
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MEDIA_BUCKET = "media";

/**
 * Delete all media files in a conversation.
 *
 * For every message in the conversation that has a media_url pointing to
 * the media bucket, removes the file from Storage AND nulls the URL/mime
 * columns in the DB so the UI shows the "Media no disponible" placeholder.
 */
export async function deleteConversationMedia(conversationId: string): Promise<{
  deleted: number;
  errors: number;
}> {
  const admin = getAdminClient();

  // 1. Find all messages with media in this conversation
  const { data: messages, error: fetchErr } = await admin
    .from("messages")
    .select("id, media_url")
    .eq("conversation_id", conversationId)
    .not("media_url", "is", null);

  if (fetchErr) {
    console.error("deleteConversationMedia: fetch failed", fetchErr);
    return { deleted: 0, errors: 1 };
  }

  if (!messages || messages.length === 0) {
    return { deleted: 0, errors: 0 };
  }

  let deleted = 0;
  let errors = 0;

  for (const m of messages) {
    if (!m.media_url) continue;
    try {
      // Extract the path inside the bucket from the public/signed URL.
      // We store paths like "workspace-id/messages/2026-10-08/uuid.jpg".
      const path = extractStoragePath(m.media_url);
      if (path) {
        const { error: rmErr } = await admin.storage
          .from(MEDIA_BUCKET)
          .remove([path]);
        if (rmErr) {
          console.error("deleteConversationMedia: remove failed", m.id, rmErr);
          errors++;
          continue;
        }
      }
      // Null out the URL so the UI shows the placeholder.
      const { error: upErr } = await admin
        .from("messages")
        .update({ media_url: null, media_meta_id: null })
        .eq("id", m.id);
      if (upErr) {
        console.error("deleteConversationMedia: update null failed", m.id, upErr);
        errors++;
        continue;
      }
      deleted++;
    } catch (e) {
      console.error("deleteConversationMedia: error for", m.id, e);
      errors++;
    }
  }

  return { deleted, errors };
}

/**
 * Extract the object path inside the bucket from a Supabase Storage URL.
 *
 * Works with:
 *   - Public URLs:  https://<project>.supabase.co/storage/v1/object/public/media/foo/bar.jpg
 *   - Signed URLs:  https://<project>.supabase.co/storage/v1/object/sign/media/foo/bar.jpg?token=...
 *   - Rendered/transformed: https://<project>.supabase.co/storage/v1/render/image/sign/media/foo/bar.jpg
 */
function extractStoragePath(url: string): string | null {
  try {
    const m = url.match(/\/storage\/v1\/(?:object|render)\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get the total storage used by a workspace in bytes.
 * Sums the size metadata of all files in the workspace's folder.
 */
export async function getWorkspaceStorageUsage(workspaceId: string): Promise<number> {
  const admin = getAdminClient();
  // The workspace folder is the first segment of the path.
  let total = 0;
  let offset = 0;
  const limit = 1000;
  // Supabase storage.list paginates.
  // We can't filter server-side by folder prefix, so we list and filter
  // client-side. The workspace folder is unique per workspace.
  while (true) {
    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .list("", { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) {
      console.error("getWorkspaceStorageUsage: list failed", error);
      break;
    }
    if (!data || data.length === 0) break;
    for (const f of data) {
      if (f.name.startsWith(`${workspaceId}/`)) {
        total += (f.metadata as { size?: number })?.size ?? 0;
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return total;
}
