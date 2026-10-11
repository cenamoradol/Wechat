import { createAdminClient } from "@/lib/supabase/admin";
import { uploadMediaFile } from "@/lib/supabase/storage";

/**
 * Download an inbound media file from the channel's CDN and store it
 * in our Supabase Storage bucket under the workspace folder. Returns
 * the public URL of the stored file (or the original URL if storage
 * is unavailable).
 *
 * For WhatsApp, `mediaUrl` is the temporary URL returned by Meta in the
 * webhook payload. For Facebook/Instagram, it's already a public CDN URL.
 * Both expire (5 min for WA, longer for FB/IG but still subject to Meta's
 * retention). Downloading to our own storage makes the media durable.
 */
export async function downloadAndStoreMedia(args: {
  channelType: "whatsapp" | "facebook" | "instagram";
  accessToken: string;
  workspaceId: string;
  conversationId: string;
  mediaUrl: string;
  mimeType: string | null;
  originalFilename?: string;
}): Promise<{ storageUrl: string; mimeType: string; filename: string; sizeBytes: number } | null> {
  const { channelType, accessToken, workspaceId, conversationId, mediaUrl, mimeType, originalFilename } = args;

  // ponytail: WhatsApp Cloud API requires a two-step: fetch the media_url
  // by calling GET /{media_id} which returns the actual download URL.
  // For Facebook/Instagram, the URL is already in the webhook payload.
  let downloadUrl = mediaUrl;
  if (channelType === "whatsapp" && /^https?:\/\//.test(mediaUrl) === false) {
    // It's a media_id, not a URL. Resolve to the actual download URL.
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${mediaUrl}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      console.error("resolve WA media url failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = (await res.json()) as { url?: string };
    if (!j.url) return null;
    downloadUrl = j.url;
  }

  // Download the binary
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    console.error("download media failed", fileRes.status, await fileRes.text().catch(() => ""));
    return null;
  }
  const blob = await fileRes.blob();
  const detectedMime = fileRes.headers.get("content-type") || mimeType || blob.type || "application/octet-stream";
  const finalMime = detectedMime.split(";")[0].trim();

  // Build a sensible filename
  const ext = mimeToExt(finalMime, originalFilename);
  const stamp = Date.now();
  const safe = (originalFilename ?? `inbound-${stamp}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const filename = `${stamp}-${safe}${ext ? `.${ext}` : ""}`;

  // Upload to our storage
  const { url, error } = await uploadMediaFile(workspaceId, conversationId, blob, filename);
  if (error || !url) {
    console.error("upload inbound media failed", error);
    return null;
  }
  return { storageUrl: url, mimeType: finalMime, filename, sizeBytes: blob.size };
}

function mimeToExt(mime: string, originalFilename?: string): string {
  // If the original filename already has an extension, reuse it.
  if (originalFilename) {
    const m = originalFilename.match(/\.([a-z0-9]{1,5})$/i);
    if (m) return m[1].toLowerCase();
  }
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/3gpp") return "3gp";
  if (mime === "audio/mp4" || mime === "audio/mpeg") return "m4a";
  if (mime === "audio/ogg" || mime === "audio/opus") return "ogg";
  if (mime === "audio/aac") return "aac";
  if (mime === "audio/amr") return "amr";
  if (mime === "application/pdf") return "pdf";
  return "";
}

// re-export so the call site doesn't need its own import
export { createAdminClient };