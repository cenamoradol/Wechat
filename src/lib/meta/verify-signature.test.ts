import { describe, it, expect } from "vitest";
import { verifyMetaSignature } from "./verify-signature";
import { createHmac } from "node:crypto";

const SECRET = "test-meta-app-secret";

function sign(body: string, secret: string = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a valid signature", () => {
    expect(verifyMetaSignature(payload, sign(payload), SECRET)).toBe(true);
  });

  it("rejects when signature header is missing", () => {
    expect(verifyMetaSignature(payload, null, SECRET)).toBe(false);
  });

  it("rejects when signature is not sha256= prefixed", () => {
    expect(verifyMetaSignature(payload, "md5=abc", SECRET)).toBe(false);
  });

  it("rejects when body has been tampered with", () => {
    const sig = sign(payload);
    expect(verifyMetaSignature(payload + "x", sig, SECRET)).toBe(false);
  });

  it("rejects when secret is wrong", () => {
    expect(verifyMetaSignature(payload, sign(payload, "wrong-secret"), SECRET)).toBe(false);
  });
});