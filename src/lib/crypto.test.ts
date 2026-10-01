import { describe, it, expect } from "vitest";
import { encrypt, decrypt, encryptToBase64, decryptFromBase64 } from "./crypto";

const SAMPLE = "EAABwzLixnjY..."; // dummy access_token

describe("crypto AES-256-GCM", () => {
  it("roundtrips a string", () => {
    const blob = encrypt(SAMPLE);
    expect(decrypt(blob)).toBe(SAMPLE);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const a = encrypt(SAMPLE);
    const b = encrypt(SAMPLE);
    expect(a.equals(b)).toBe(false);
  });

  it("fails if tag is tampered", () => {
    const blob = encrypt(SAMPLE);
    blob[15] ^= 0xff; // flip a bit in the tag area
    expect(() => decrypt(blob)).toThrow();
  });

  it("roundtrips via base64", () => {
    const b64 = encryptToBase64("hello world");
    expect(decryptFromBase64(b64)).toBe("hello world");
  });

  it("roundtrips unicode", () => {
    const s = "Hola — ñáéíóú 中文 🎉";
    expect(decrypt(encrypt(s))).toBe(s);
  });
});