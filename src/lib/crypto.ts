import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  // ponytail: read directly from process.env so unit tests don't trip on
  // t3-oss's "client-side access to server-side var" guard
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("ENCRYPTION_KEY not configured");
  return Buffer.from(k, "base64");
}

// ponytail: 12-byte nonce + 16-byte tag + ciphertext. Stored as bytea (Buffer in pg).
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Convenience: base64 in/out (for env-driven use cases)
export function encryptToBase64(plaintext: string): string {
  return encrypt(plaintext).toString("base64");
}

export function decryptFromBase64(b64: string): string {
  return decrypt(Buffer.from(b64, "base64"));
}