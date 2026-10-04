export function verifyWebhook(search: URLSearchParams, expectedToken: string | undefined) {
  const challenge = search.get("hub.challenge");
  if (!expectedToken || search.get("hub.mode") !== "subscribe" ||
      search.get("hub.verify_token") !== expectedToken || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
