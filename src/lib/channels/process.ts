import type { NormalizedMessage } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { downloadAndStoreMedia } from "@/lib/channels/download";
import { evaluateTriggers } from "@/lib/automations/engine";

// Process inbound: upsert contact + contact_channel + conversation + insert message
// All writes use service_role (admin) to bypass RLS — webhooks have no user session.
export async function processInbound(m: NormalizedMessage): Promise<void> {
  // Without a stable ID, PostgreSQL's UNIQUE constraint cannot deduplicate
  // NULLs; never let an unidentified delivery trigger a paid automation.
  if (!m.messageExternalId) return;
  const admin = createAdminClient();

  // 1. Identify channel
  const { data: channel, error: chErr } = await admin
    .from("channels")
    .select("id, workspace_id, access_token_enc")
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

  // 5. If the message has media, download from Meta and store in our
  //    Supabase Storage bucket. The Meta CDN URL expires in 5 min for
  //    WhatsApp; downloading immediately makes the media durable.
  let mediaUrl: string | null = m.mediaUrl ?? null;
  let mediaMime: string | null = m.mediaMime ?? null;
  let mediaFilename: string | null = null;
  let mediaSize: number | null = null;
  if (mediaUrl) {
    try {
      const accessToken = channel.access_token_enc
        ? decrypt(Buffer.from(channel.access_token_enc as string, "base64"))
        : "";
      const stored = await downloadAndStoreMedia({
        channelType: m.channelType,
        accessToken,
        workspaceId: channel.workspace_id,
        conversationId: conv.id,
        mediaUrl,
        mimeType: mediaMime,
        originalFilename: m.type === "document" ? m.text ?? undefined : undefined,
      });
      if (stored) {
        mediaUrl = stored.storageUrl;
        mediaMime = stored.mimeType;
        mediaFilename = stored.filename;
        mediaSize = stored.sizeBytes;
      }
    } catch (e) {
      console.error("inbound media download failed", e);
      // Fall back to the original (transient) URL — UI will show the
      // "Media no disponible" placeholder once the URL expires.
    }
  }

  // ponytail: claim the external message ID atomically. Polling and webhook
  // retries can deliver the same message repeatedly; only the first insert
  // may run automations (and call a paid AI provider).
  const { data: inserted, error: msgErr } = await admin.from("messages").upsert({
    conversation_id: conv.id,
    external_id: m.messageExternalId,
    direction: "in",
    type: m.type,
    text: m.text ?? null,
    media_url: mediaUrl,
    media_mime: mediaMime,
    media_filename: mediaFilename,
    media_size_bytes: mediaSize,
    raw_payload: m.raw as unknown as Record<string, unknown>,
    status: "delivered",
  }, { onConflict: "conversation_id,external_id", ignoreDuplicates: true }).select("id");

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
    return;
  }

  if (!inserted?.length) return;

  // 7. Fire automations whose trigger matches this inbound message.
  // ponytail: evaluateTriggers returns `{ matched, messagesSent }`. If
  // an automation already replied (matched > 0), the AI auto-reply
  // skips — otherwise the customer gets the automation's response
  // AND a redundant AI-generated answer. Fires-and-forgets the run,
  // so we await the dispatch result to read the signal, then run
  // auto-reply if no automation claimed the message.
  const dispatch = await evaluateTriggers({
    kind: "message_received",
    workspaceId: channel.workspace_id,
    conversationId: conv.id,
    contactId,
    contactChannelId: cc.id,
    channelId: channel.id,
    channelType: m.channelType,
    messageText: m.text ?? null,
    messageId: m.messageExternalId,
  }).catch((e) => {
    console.error("evaluateTriggers failed", e);
    return { matched: 0, messagesSent: 0 };
  });

  if (dispatch.matched > 0) {
    console.log(
      `[processInbound] automation matched=${dispatch.matched} conversation=${conv.id} — suppressing AI auto-reply`,
    );
    return;
  }

  // 8. AI auto-reply. Only runs when no automation handled the message.
  // fire-and-forget — webhook has no time to wait, and the customer
  // sees the agent's reply in the inbox as soon as it's sent.
  void runAutoReply({
    conversationId: conv.id,
    workspaceId: channel.workspace_id,
    contactId,
    contactChannelId: cc.id,
    channelType: m.channelType,
    channelExternalId: m.channelExternalId,
    accessToken: channel.access_token_enc
      ? decrypt(Buffer.from(channel.access_token_enc as string, "base64"))
      : null,
    contactExternalId: m.contactExternalId,
    messageText: m.text ?? null,
  }).catch((e) => console.error("auto-reply failed", e));
}

/**
 * Generate and send an AI reply if the workspace's default agent is
 * configured for auto-reply on inbound messages. Subject to the same
 * rate-limit / handoff rules as the `ai_reply` step inside an
 * automation, so the customer never gets both.
 */
async function runAutoReply(args: {
  conversationId: string;
  workspaceId: string;
  contactId: string;
  contactChannelId: string;
  channelType: "whatsapp" | "facebook" | "instagram";
  channelExternalId: string;
  accessToken: string | null;
  contactExternalId: string;
  messageText: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("ai_agents")
    .select("id, name, description, provider, model, system_prompt, temperature, max_tokens, kb_enabled, auto_reply_enabled, max_replies_per_conversation, handoff_keywords, is_default, workspace_id, created_at, updated_at")
    .eq("workspace_id", args.workspaceId)
    .eq("is_default", true)
    .maybeSingle();
  if (!agent || !agent.auto_reply_enabled) return;
  if (!args.messageText) return; // ponytail: only reply to text for now
  if (!args.accessToken) {
    console.warn("[auto-reply] no channel access token, skipping");
    return;
  }

  // handoff check + rate limit
  const text = args.messageText.toLowerCase();
  for (const kw of agent.handoff_keywords ?? []) {
    if (kw && text.includes(kw.toLowerCase())) {
      console.log(`[auto-reply] handoff keyword: ${kw}`);
      return;
    }
  }
  const { count: aiReplies } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", args.conversationId)
    .eq("direction", "out")
    .is("sent_by", null);
  if ((aiReplies ?? 0) >= agent.max_replies_per_conversation) {
    console.log(`[auto-reply] max replies reached (${aiReplies})`);
    return;
  }

  // build chat history
  const { data: msgs } = await admin
    .from("messages")
    .select("direction, text")
    .eq("conversation_id", args.conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(20);
  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = (msgs ?? []).map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text ?? "",
  }));

  const { generateAgentReply } = await import("@/lib/ai/chat");
  const { content } = await generateAgentReply({
    agent: {
      id: agent.id,
      workspaceId: agent.workspace_id,
      name: agent.name,
      description: agent.description,
      provider: agent.provider as "openai" | "anthropic" | "minimax" | "gemini" | "openrouter",
      model: agent.model,
      systemPrompt: agent.system_prompt,
      temperature: Number(agent.temperature),
      maxTokens: agent.max_tokens,
      kbEnabled: agent.kb_enabled,
      autoReplyEnabled: agent.auto_reply_enabled,
      maxRepliesPerConversation: agent.max_replies_per_conversation,
      handoffKeywords: agent.handoff_keywords ?? [],
      isDefault: agent.is_default,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
    },
    messages: chatMessages,
  });
  if (!content.trim()) return;

  const { getAdapter } = await import("@/lib/channels");
  const adapter = getAdapter(args.channelType);
  const sendRes = await adapter.sendText({
    accessToken: args.accessToken,
    fromExternalId: args.channelExternalId,
    toExternalId: args.contactExternalId,
    text: content,
  });
  await admin.from("messages").insert({
    conversation_id: args.conversationId,
    external_id: sendRes.externalId,
    direction: "out",
    type: "text",
    text: content,
    sent_by: null,
    status: "sent",
  });
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: content.slice(0, 200),
    })
    .eq("id", args.conversationId);
  console.log(`[auto-reply] sent conversation=${args.conversationId}`);
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
