import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { plaintext?: string };
  const plaintext = body.plaintext ?? "ping";

  const blob = encrypt(plaintext);
  const back = decrypt(blob);

  // Also re-encrypt and try to decrypt the existing WA channel
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let channelInfo: any = null;
  if (user) {
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
        .select("external_id, type, access_token_enc")
        .eq("workspace_id", member.workspace_id)
        .limit(1)
        .maybeSingle();
      if (ch) {
        const enc1 = encrypt("test-roundtrip");
        const dec1 = decrypt(enc1);
        let chDecrypt: string;
        let chErr: string | null = null;
        try {
          chDecrypt = decrypt(Buffer.from(ch.access_token_enc, "base64"));
        } catch (e) {
          chDecrypt = "";
          chErr = (e as Error).message;
        }
        channelInfo = {
          external_id: ch.external_id,
          type: ch.type,
          stored_first_8_bytes: Buffer.from(ch.access_token_enc, "base64").subarray(0, 8).toString("hex"),
          self_test_ok: dec1 === "test-roundtrip",
          ch_decrypt_ok: !chErr,
          ch_decrypt_error: chErr,
          ch_decrypt_first_chars: chDecrypt.slice(0, 10) + "...",
        };
      }
    }
  }

  return NextResponse.json({
    env_key_first_8_bytes: Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64")
      .subarray(0, 8)
      .toString("hex"),
    env_key_length: Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64").length,
    self_test: back === plaintext ? "ok" : "FAILED",
    self_test_ciphertext_first_8: blob.subarray(0, 8).toString("hex"),
    channel: channelInfo,
  });
}