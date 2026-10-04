"use server";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { processInbound, logWebhookEvent } from "@/lib/channels/process";
import { getAdapter } from "@/lib/channels";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Simulates a WhatsApp inbound message webhook for testing.
// Useful when you can't easily send a real message.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("channels")
    .select("access_token_enc, type, external_id")
    .eq("type", "whatsapp")
    .limit(1)
    .maybeSingle();
  if (!ch) return NextResponse.json({ error: "No WA channel" }, { status: 400 });

  let token: string;
  try {
    token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    return NextResponse.json({ error: `Cannot decrypt: ${(e as Error).message}` }, { status: 500 });
  }

  // Build a fake inbound message payload
  const fakeMessage = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: ch.external_id,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "TEST +504 0000-0000",
                phone_number_id: ch.external_id,
              },
              contacts: [{ profile: { name: "Test Contact" }, wa_id: "50499999999" }],
              messages: [
                {
                  id: `wamid.TEST_${Date.now()}`,
                  from: "50499999999",
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: "text",
                  text: { body: "Hola, esto es un mensaje de prueba desde Wechat 🧪" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  // Log it
  await logWebhookEvent({
    type: "whatsapp",
    payload: fakeMessage,
    processed: true,
  });

  // Process it
  try {
    const adapter = getAdapter("whatsapp");
    const messages = adapter.parseInbound(fakeMessage);
    for (const m of messages) {
      await processInbound(m);
    }
    return NextResponse.json({
      ok: true,
      simulated: true,
      messages_processed: messages.length,
      contact: fakeMessage.entry[0].changes[0].value.contacts[0].wa_id,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}