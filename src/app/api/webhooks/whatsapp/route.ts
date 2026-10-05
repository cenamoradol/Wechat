import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";
import { getAdapter } from "@/lib/channels";
import { processInbound, processOutboundStatuses, logWebhookEvent } from "@/lib/channels/process";

export async function GET(req: NextRequest) {
  const adapter = getAdapter("whatsapp");
  const res = adapter.verifyWebhookGet(
    req.nextUrl.searchParams,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  );
  return res ?? NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(raw, signature, process.env.META_APP_SECRET ?? "")) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const adapter = getAdapter("whatsapp");
  const messages = adapter.parseInbound(payload);
  await logWebhookEvent({ type: "whatsapp", payload, processed: true });

  // Outbound message status updates (delivered / read) come in the same
  // payload under value.statuses — process them so blue ticks appear.
  const p = payload as {
    entry?: Array<{ changes?: Array<{ value?: { statuses?: unknown[] } }> }>;
  };
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (value?.statuses?.length) {
        try {
          await processOutboundStatuses("whatsapp", value as Parameters<typeof processOutboundStatuses>[1]);
        } catch (e) {
          console.error("processOutboundStatuses failed", e);
        }
      }
    }
  }

  for (const m of messages) {
    try {
      await processInbound(m);
    } catch (e) {
      console.error("processInbound failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}