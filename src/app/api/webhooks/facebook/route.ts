import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/meta/verify-signature";
import { getAdapter } from "@/lib/channels";
import { processInbound, logWebhookEvent } from "@/lib/channels/process";

export async function GET() {
  // FB has no GET verification
  return new NextResponse("Method Not Allowed", { status: 405 });
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

  const adapter = getAdapter("facebook");
  const messages = adapter.parseInbound(payload);
  await logWebhookEvent({ type: "facebook", payload, processed: true });

  for (const m of messages) {
    try {
      await processInbound(m);
    } catch (e) {
      console.error("processInbound failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}