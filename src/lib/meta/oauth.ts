// Meta Graph API base + helpers used by channel adapters
const GRAPH = "https://graph.facebook.com/v21.0";

export async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${GRAPH}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Meta GET ${path} failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function graphPost<T>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Meta POST ${path} failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export type MetaOauthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export type MetaOauthMeAccountsResponse = {
  data: Array<{ id: string; name: string; access_token: string }>;
};

export type MetaOauthInstagramAccountsResponse = {
  instagram_business_account?: { id: string };
  id: string; // page id
  name: string;
};