export const META_GRAPH_VERSION = "v26.0";

export function metaRedirectUri() {
  const explicit = process.env.NEXT_PUBLIC_META_REDIRECT_URI?.trim();
  if (explicit) return new URL(explicit).href;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("Falta NEXT_PUBLIC_APP_URL");
  return new URL("/api/oauth/meta/callback", base).href;
}

export function legacyLoginUrl(appId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_messages",
    ].join(","),
  });
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;
}
