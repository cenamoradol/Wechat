"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { getAdapter } from "@/lib/channels";
import { deleteConversationMedia } from "@/lib/supabase/storage";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

const Schema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(4096),
});

export type SendMessageResult = { error?: string; ok?: boolean; messageId?: string };

// Send a text reply from the current workspace to the conversation's contact.
// Uses the channel linked to the conversation's contact_channel.
export async function sendMessageAction(
  input: z.infer<typeof Schema>,
): Promise<SendMessageResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const admin = createAdminClient();

  // 1. Get conversation + contact_channel + channel
  const { data: conv } = await admin
    .from("conversations")
    .select(
      "id, workspace_id, contact_channel_id",
    )
    .eq("id", parsed.data.conversationId)
    .maybeSingle();

  if (!conv) return { error: "Conversación no encontrada" };

  // Fetch the contact_channel with the channel
  const { data: cc } = await admin
    .from("contact_channels")
    .select(
      "id, channel_id, external_user_id, channels(id, type, external_id, access_token_enc)",
    )
    .eq("id", (conv as any).contact_channel_id)
    .maybeSingle();

  if (!conv) return { error: "Conversación no encontrada" };

  // 2. Verify the current user is a member of the conversation's workspace
  const { data: member } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", (conv as any).workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "Sin acceso a este workspace" };

  if (!cc) return { error: "Canal no encontrado" };
  const ch = (cc as any).channels;
  const channelExternalId: string = (cc as any).external_user_id;
  const channelType: string = ch?.type;
  const channelAccessTokenEnc: string = ch?.access_token_enc;
  const channelFromId: string = ch?.external_id;

  // 3. Decrypt channel token
  let token: string;
  try {
    token = decrypt(Buffer.from(channelAccessTokenEnc, "base64"));
  } catch (e) {
    return { error: `No se pudo descifrar el token: ${(e as Error).message}` };
  }

  // 4. Send via the appropriate channel adapter
  const adapter = getAdapter(channelType as "whatsapp" | "facebook" | "instagram");
  let result: { externalId: string };
  try {
    if (channelType === "whatsapp") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: channelFromId,
        toExternalId: channelExternalId,
        text: parsed.data.text,
      });
    } else if (channelType === "facebook") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: channelFromId,
        toExternalId: channelExternalId,
        text: parsed.data.text,
      });
    } else if (channelType === "instagram") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: channelFromId,
        toExternalId: channelExternalId,
        text: parsed.data.text,
      });
    } else {
      return { error: `Canal ${channelType} no soportado para envío` };
    }
  } catch (e) {
    console.error("sendMessage error", e);
    return { error: `Error al enviar: ${(e as Error).message}` };
  }

  // 5. Persist the outbound message
  const { data: msg, error: msgErr } = await admin
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      external_id: result.externalId,
      direction: "out",
      type: "text",
      text: parsed.data.text,
      status: "sent",
      sent_by: user.id,
    })
    .select("id")
    .single();

  if (msgErr) {
    return { error: `Enviado a Meta pero no se pudo guardar: ${msgErr.message}` };
  }

  // 6. Update conversation last_message_at
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: parsed.data.text.slice(0, 200),
    })
    .eq("id", parsed.data.conversationId);

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${parsed.data.conversationId}`);
  return { ok: true, messageId: msg?.id };
}

export async function markAsReadAction(conversationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("messages")
    .update({ read_at: now })
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .is("read_at", null);
  await admin.rpc("recompute_unread_count", { p_conversation_id: conversationId });
  revalidatePath("/inbox");
}

// ──────────────────────────────────────────────────────────────────
// Archive / Unarchive / Delete conversations
// ──────────────────────────────────────────────────────────────────

export type ArchiveActionResult = { error?: string; ok?: boolean };

async function requireMemberForConversation(
  conversationId: string,
  requiredRoles: ("owner" | "admin" | "agent" | "viewer")[] = ["owner", "admin", "agent", "viewer"],
): Promise<
  | { error: string }
  | { userId: string; workspaceId: string; role: string; conversationWorkspaceId: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const activeWorkspaceId = await getActiveWorkspaceIdAction();
  if (!activeWorkspaceId) return { error: "No tienes un workspace activo" };

  const admin = createAdminClient();

  // Verify the conversation belongs to the active workspace
  const { data: conv } = await admin
    .from("conversations")
    .select("workspace_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { error: "Conversación no encontrada" };
  if (conv.workspace_id !== activeWorkspaceId) {
    return { error: "Esta conversación no pertenece a tu workspace activo" };
  }

  // Verify membership
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !requiredRoles.includes(member.role as "owner" | "admin" | "agent" | "viewer")) {
    return { error: "No tienes permiso para esta acción" };
  }

  return {
    userId: user.id,
    workspaceId: activeWorkspaceId,
    role: member.role,
    conversationWorkspaceId: conv.workspace_id,
  };
}

/**
 * Archive a conversation. Owner/admin only.
 * Immediately deletes all media files (saves storage).
 * Conversation stays in DB but is hidden from the main inbox.
 * Auto-unarchives when a new inbound message arrives (see processInbound).
 */
export async function archiveConversationAction(
  conversationId: string,
): Promise<ArchiveActionResult> {
  const ctx = await requireMemberForConversation(conversationId, ["owner", "admin"]);
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();

  // 1. Set archived_at + archived_by
  const { error: archErr } = await admin
    .from("conversations")
    .update({ archived_at: new Date().toISOString(), archived_by: ctx.userId })
    .eq("id", conversationId)
    .is("archived_at", null); // Don't overwrite if already archived
  if (archErr) return { error: `No se pudo archivar: ${archErr.message}` };

  // 2. Delete all media for this conversation (fire and forget; we don't want
  //    archive to fail if a file is missing)
  try {
    const result = await deleteConversationMedia(conversationId);
    if (result.errors > 0) {
      console.warn(`archiveConversation: ${result.errors} media files failed to delete for ${conversationId}`);
    }
  } catch (e) {
    console.error("archiveConversation: media delete threw", e);
  }

  revalidatePath("/inbox");
  return { ok: true };
}

/**
 * Unarchive a conversation. Owner/admin only.
 * Media is gone forever (we already deleted it on archive).
 */
export async function unarchiveConversationAction(
  conversationId: string,
): Promise<ArchiveActionResult> {
  const ctx = await requireMemberForConversation(conversationId, ["owner", "admin"]);
  if ("error" in ctx) return { error: ctx.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("conversations")
    .update({ archived_at: null, archived_by: null })
    .eq("id", conversationId);
  if (error) return { error: `No se pudo desarchivar: ${error.message}` };

  revalidatePath("/inbox");
  return { ok: true };
}

/**
 * Hard-delete a conversation. Owner only.
 * Cascades to messages + contact_channels via FK ON DELETE.
 * Caller is responsible for confirming with the user (typed name check).
 */
export async function deleteConversationAction(
  conversationId: string,
): Promise<ArchiveActionResult> {
  const ctx = await requireMemberForConversation(conversationId, ["owner", "admin"]);
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.role !== "owner") return { error: "Solo el owner puede eliminar conversaciones" };

  const admin = createAdminClient();

  // Delete media first (cascading FK doesn't help with storage)
  try {
    await deleteConversationMedia(conversationId);
  } catch (e) {
    console.error("deleteConversation: media delete threw", e);
  }

  // Hard delete the conversation (cascades to messages + contact_channels)
  const { error } = await admin
    .from("conversations")
    .delete()
    .eq("id", conversationId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/inbox");
  return { ok: true };
}