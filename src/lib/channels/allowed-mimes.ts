/**
 * Per-channel media type allowlists and helpers.
 *
 * WhatsApp Cloud API is strict about MIME types per kind; the FB/IG
 * Messenger attachment API is more permissive (just image/video/audio/file).
 */

export const WHATSAPP_ALLOWED_MIMES: Record<string, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/3gpp"],
  audio: [
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/amr",
    "audio/ogg",
    "audio/opus",
  ],
  document: [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

export function isMimeAllowedByChannel(
  channelType: string,
  kind: "image" | "video" | "audio" | "document",
  mime: string,
): boolean {
  const list =
    channelType === "whatsapp"
      ? WHATSAPP_ALLOWED_MIMES[kind]
      : undefined;
  if (!list) return true; // other channels accept any
  return list.includes(mime);
}

/**
 * Map a MIME to the closest WhatsApp-allowed audio type.
 * Returns null if no mapping is possible. Used to give a clear
 * error to the user when their audio can't be sent.
 */
export function mapAudioToWhatsApp(mime: string): string | null {
  // Browsers record MediaRecorder audio in webm/ogg/mp4. Map known
  // webm/opus recordings to ogg/opus which WA accepts.
  if (mime === "audio/webm" || mime === "audio/webm;codecs=opus") {
    return "audio/ogg";
  }
  if (mime === "audio/ogg" || mime === "audio/ogg;codecs=opus") {
    return "audio/ogg";
  }
  return null;
}