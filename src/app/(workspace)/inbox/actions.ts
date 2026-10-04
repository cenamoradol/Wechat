"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { getAdapter } from "@/lib/channels";

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

  const cc = (conv as any).contact_channels?.[0];
  const ch = cc?.channels?.[0];
  if (!cc || !ch) return { error: "Canal no encontrado" };

  // 3. Decrypt channel token
  let token: string;
  try {
    token = decrypt(Buffer.from(ch.access_token_enc, "base64"));
  } catch (e) {
    return { error: `No se pudo descifrar el token: ${(e as Error).message}` };
  }

  // 4. Send via the appropriate channel adapter
  const adapter = getAdapter(ch.type as "whatsapp" | "facebook" | "instagram");
  let result: { externalId: string };
  try {
    if (ch.type === "whatsapp") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: ch.external_id,
        toExternalId: cc.external_user_id,
        text: parsed.data.text,
      });
    } else if (ch.type === "facebook") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: ch.external_id,
        toExternalId: cc.external_user_id,
        text: parsed.data.text,
      });
    } else if (ch.type === "instagram") {
      result = await adapter.sendText({
        accessToken: token,
        fromExternalId: ch.external_id,
        toExternalId: cc.external_user_id,
        text: parsed.data.text,
      });
    } else {
      return { error: `Canal ${ch.type} no soportado para envío` };
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
  await admin
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  revalidatePath("/inbox");
}