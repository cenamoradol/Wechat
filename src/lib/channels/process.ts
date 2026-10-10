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

  // 4. Upsert conversation (only bump last_message_at if the new message is newer)
  const preview = (m.text ?? `[${m.type}]`).slice(0, 200);
  const { data: existing } = await admin
    .from("conversations")
    .select("last_message_at")
    .eq("contact_channel_id", cc.id)
    .maybeSingle();
  const newerThanLast = !existing?.last_message_at ||
    m.timestamp.getTime() > new Date(existing.last_message_at).getTime();
  const convFields: {
    workspace_id: string;
    contact_channel_id: string;
    status: "open";
    last_message_at?: string;
    last_message_preview?: string;
  } = {
    workspace_id: channel.workspace_id,
    contact_channel_id: cc.id,
    status: "open",
  };
  if (newerThanLast) {
    convFields.last_message_at = m.timestamp.toISOString();
    convFields.last_message_preview = preview;
  }
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .upsert(convFields, { onConflict: "contact_channel_id" })
    .select("id, archived_at")
    .single();
  if (convErr || !conv) {
    console.error("conversation upsert failed", convErr);
    return;
  }

  // 4b. Auto-unarchive on new inbound message. The user explicitly chose
  //     to "follow the plan" for archive+unarchive: the same number writing
  //     again resurfaces the conversation in the main inbox.
  if (m.direction === "in" && conv.archived_at) {
    await admin
      .from("conversations")
      .update({ archived_at: null, archived_by: null })
      .eq("id", conv.id);
  }

  // 5. Upsert message (idempotent on (conversation_id, external_id))
  const { error: msgErr } = await admin.from("messages").upsert({
    conversation_id: conv.id,
    external_id: m.messageExternalId,
    direction: "in",
    type: m.type,
    text: m.text ?? null,
    media_url: m.mediaUrl ?? null,
    media_mime: m.mediaMime ?? null,
    raw_payload: m.raw as unknown as Record<string, unknown>,
    status: "delivered",
  }, { onConflict: "conversation_id,external_id" });

  // 6. Recompute unread_count atomically from the messages table (only for inbound)
  if (m.direction === "in") {
    await admin.rpc("recompute_unread_count", { p_conversation_id: conv.id });
  }
  if (msgErr) {
    console.error("message upsert failed", {
      msgErr: msgErr.message,
      conversation_id: conv.id,
      external_id: m.messageExternalId,
      type: m.type,
    });
    await admin.from("webhook_events").insert({
      type: `error:message-upsert:${m.channelType}`,
      payload: { err: msgErr.message, conversation_id: conv.id, external_id: m.messageExternalId },
      processed: false,
      error: msgErr.message,
    });
  }
}

/**
 * Process outbound message status updates from Meta webhooks.
 *
 * WhatsApp/Messenger/Instagram webhooks deliver delivery & read events as
 * `statuses` entries inside the same payload (NOT as a separate field).
 * Each entry has shape:
 *   { id: string, status: "sent" | "delivered" | "read" | "failed", timestamp: string|number, recipient_id?: string }
 *
 * We update the matching OUTBOUND message by external_id.
 */
export async function processOutboundStatuses(
  channelType: "whatsapp" | "facebook" | "instagram",
  value: { statuses?: Array<{ id?: string; status?: string; timestamp?: string | number }> } | null | undefined,
): Promise<void> {
  if (!value?.statuses?.length) return;
  const admin = createAdminClient();
  for (const s of value.statuses) {
    if (!s.id || !s.status) continue;
    const ts = s.timestamp
      ? new Date(typeof s.timestamp === "number" ? s.timestamp * 1000 : s.timestamp)
      : new Date();
    const updates: { status?: string; read_at?: string } = {};
    if (s.status === "read") {
      updates.read_at = ts.toISOString();
      updates.status = "read";
    } else if (s.status === "delivered") {
      updates.status = "delivered";
    } else if (s.status === "sent") {
      updates.status = "sent";
    } else if (s.status === "failed") {
      updates.status = "failed";
    }
    if (Object.keys(updates).length === 0) continue;
    const { error } = await admin
      .from("messages")
      .update(updates)
      .eq("external_id", s.id)
      .eq("direction", "out")
      .select("id");
    if (error) {
      console.error("outbound status update failed", { error: error.message, external_id: s.id });
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