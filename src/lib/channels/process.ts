import type { NormalizedMessage } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Process inbound: upsert contact + contact_channel + conversation + insert message
// All writes use service_role (admin) to bypass RLS — webhooks have no user session.
export async function processInbound(m: NormalizedMessage): Promise<void> {
  const admin = createAdminClient();

  // 1. Identify channel
  const { data: channel, error: chErr } = await admin
    .from("channels")
    .select("id, workspace_id")
    .eq("type", m.channelType)
    .eq("external_id", m.channelExternalId)
    .maybeSingle();
  if (chErr) {
    console.error("processInbound channel lookup failed", chErr);
    return;
  }
  if (!channel) {
    console.warn("processInbound: no channel for", m.channelType, m.channelExternalId);
    return;
  }

  // 2. Upsert contact (by workspace + phone for WA, or by channel-contact for FB/IG)
  const phone = m.channelType === "whatsapp" ? "+" + m.contactExternalId : null;

  let contactId: string;
  if (phone) {
    const { data: existingContact } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", channel.workspace_id)
      .eq("phone_e164", phone)
      .maybeSingle();
    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: created, error: cErr } = await admin
        .from("contacts")
        .insert({ workspace_id: channel.workspace_id, phone_e164: phone })
        .select("id")
        .single();
      if (cErr || !created) {
        console.error("contact insert failed", cErr);
        return;
      }
      contactId = created.id;
    }
  } else {
    // For FB/IG: contact is per (channel + external_user_id), so use that as identity
    const { data: existingCC } = await admin
      .from("contact_channels")
      .select("contact_id")
      .eq("channel_id", channel.id)
      .eq("external_user_id", m.contactExternalId)
      .maybeSingle();
    if (existingCC) {
      contactId = existingCC.contact_id;
    } else {
      const { data: created, error: cErr } = await admin
        .from("contacts")
        .insert({ workspace_id: channel.workspace_id })
        .select("id")
        .single();
      if (cErr || !created) {
        console.error("contact insert failed", cErr);
        return;
      }
      contactId = created.id;
    }
  }

  // 3. Upsert contact_channel
  const { data: cc, error: ccErr } = await admin
    .from("contact_channels")
    .upsert(
      {
        contact_id: contactId,
        channel_id: channel.id,
        external_user_id: m.contactExternalId,
        last_seen_at: m.timestamp.toISOString(),
      },
      { onConflict: "channel_id,external_user_id" },
    )
    .select("id")
    .single();
  if (ccErr || !cc) {
    console.error("contact_channels upsert failed", ccErr);
    return;
  }

  // 4. Upsert conversation
  const preview = (m.text ?? `[${m.type}]`).slice(0, 200);
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .upsert(
      {
        workspace_id: channel.workspace_id,
        contact_channel_id: cc.id,
        last_message_at: m.timestamp.toISOString(),
        last_message_preview: preview,
        status: "open",
      },
      { onConflict: "contact_channel_id" },
    )
    .select("id")
    .single();
  if (convErr || !conv) {
    console.error("conversation upsert failed", convErr);
    return;
  }

  // 5. Insert message (idempotent on external_id when present)
  const { error: msgErr } = await admin.from("messages").insert({
    conversation_id: conv.id,
    external_id: m.messageExternalId,
    direction: "in",
    type: m.type,
    text: m.text ?? null,
    media_url: m.mediaUrl ?? null,
    media_mime: m.mediaMime ?? null,
    raw_payload: m.raw as unknown as Record<string, unknown>,
    status: "delivered",
  });
  if (msgErr) {
    // Unique violation = duplicate, ignore
    if (!String(msgErr.message).toLowerCase().includes("duplicate")) {
      console.error("message insert failed", msgErr);
    }
  }
}

export async function logWebhookEvent(args: {
  channelId?: string;
  type: string;
  payload: unknown;
  processed?: boolean;
  error?: string;
}) {
  const admin = createAdminClient();
  await admin.from("webhook_events").insert({
    channel_id: args.channelId ?? null,
    type: args.type,
    payload: args.payload as Record<string, unknown>,
    processed: args.processed ?? false,
    error: args.error ?? null,
  });
}