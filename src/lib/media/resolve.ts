/**
 * Convert any Supabase storage URL (public or signed) to our proxied
 * /api/media/<path> route. The proxy validates the user has access to
 * the workspace before streaming the file.
 *
 * Returns the original URL unchanged for external URLs (Meta CDN, etc.)
 * or non-Supabase URLs.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Match /storage/v1/object/(public|sign)/media/<path> or render/...
  const m = url.match(/\/storage\/v1\/(?:object|render)\/(?:public|sign)\/media\/(.+?)(?:\?|$)/);
  if (!m) return url;
  return `/api/media/${m[1]}`;
}