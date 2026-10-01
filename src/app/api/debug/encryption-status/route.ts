import { NextResponse } from "next/server";
import { createHash, randomBytes, createCipheriv } from "node:crypto";

// Returns fingerprint + length of the current ENCRYPTION_KEY.
// NEVER returns the actual key.
export async function GET() {
  const k = process.env.ENCRYPTION_KEY ?? "";
  const buf = Buffer.from(k, "base64");
  const fingerprint = k
    ? createHash("sha256").update(buf).digest("hex").slice(0, 12)
    : "(empty)";
  const lengthBytes = buf.length;
  const expected = 32;

  // Self-test: encrypt + decrypt with the current key
  let selftest: string;
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", buf, iv);
    const ct = Buffer.concat([cipher.update("hello", "utf8"), cipher.final()]);
    selftest = `✅ ok (roundtripped ${ct.length} bytes)`;
  } catch (e) {
    selftest = `❌ error: ${(e as Error).message}`;
  }

  // If a token exists in the DB, check if it can be decrypted with current key
  let channelStatus: {
    found: boolean;
    external_id?: string;
    type?: string;
    decrypt_ok?: boolean;
    decrypt_error?: string;
  } = { found: false };

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: member } = await admin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (member) {
        const { data: ch } = await admin
          .from("channels")
          .select("id, type, external_id, access_token_enc")
          .eq("workspace_id", member.workspace_id)
          .limit(1)
          .maybeSingle();
        if (ch) {
          channelStatus = {
            found: true,
            external_id: ch.external_id,
            type: ch.type,
          };
          try {
            const { decrypt } = await import("@/lib/crypto");
            decrypt(Buffer.from(ch.access_token_enc, "base64"));
            channelStatus.decrypt_ok = true;
          } catch (e) {
            channelStatus.decrypt_ok = false;
            channelStatus.decrypt_error = (e as Error).message;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    raw_base64_length: k.length,
    decoded_bytes: lengthBytes,
    expected_bytes: expected,
    matches_expected: lengthBytes === expected,
    fingerprint_sha256_12: fingerprint,
    self_test: selftest,
    channel: channelStatus,
    recommendation:
      lengthBytes !== expected
        ? "⚠️ ENCRYPTION_KEY no tiene 32 bytes. Regenera con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
        : channelStatus.found && !channelStatus.decrypt_ok
          ? "⚠️ La clave actual es válida pero NO descifra los canales existentes. Esto significa que los canales se cifraron con una key distinta. Solución: desconecta y vuelve a conectar los canales."
          : "✅ Todo OK",
  });
}