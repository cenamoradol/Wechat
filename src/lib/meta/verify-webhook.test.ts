import { expect, it } from "vitest";
import { verifyWebhook } from "./verify-webhook";

it("returns only the challenge for an authenticated verification request", async () => {
  const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "test", "hub.challenge": "12345" });
  expect(await verifyWebhook(params, "test").text()).toBe("12345");
  expect(verifyWebhook(params, "wrong").status).toBe(403);
  expect(verifyWebhook(params, undefined).status).toBe(403);
  params.delete("hub.challenge");
  expect(verifyWebhook(params, "test").status).toBe(403);
});
