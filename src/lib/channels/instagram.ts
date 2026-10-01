import { graphPost, graphGet } from "../meta/oauth";
import type {
  ChannelAdapter,
  ContactProfile,
  NormalizedMessage,
  SendMediaArgs,
  SendTemplateArgs,
  SendTextArgs,
  Template,
} from "./types";

// Instagram Direct: same Messenger Platform Send API but with instagram-scoped user IDs
// Webhook payload: { object: "instagram", entry: [{ messaging: [{ sender, recipient, message }] }] }

export const instagramAdapter: ChannelAdapter = {
  type: "instagram",

  verifyWebhookGet() {
    return new Response("Method Not Allowed", { status: 405 });
  },

  parseInbound(payload) {
    // Same shape as FB Messenger
    const out: NormalizedMessage[] = [];
    const p = payload as any;
    const entries = p?.entry ?? [];
    for (const entry of entries) {
      const events = entry?.messaging ?? [];
      for (const evt of events) {
        const senderId = evt?.sender?.id;
        const recipientId = evt?.recipient?.id; // ig_business_account_id
        const msg = evt?.message;
        if (!msg) continue;
        const ts = evt?.timestamp ? new Date(Number(evt.timestamp)) : new Date();
        const id = msg?.mid ?? `ig-${ts.getTime()}`;
        const norm: NormalizedMessage = {
          channelType: "instagram",
          channelExternalId: recipientId,
          contactExternalId: senderId,
          messageExternalId: id,
          type: mapIgType(msg),
          direction: "in",
          text: msg?.text,
          timestamp: ts,
          raw: evt,
        };
        const att = msg?.attachments?.[0];
        if (att) {
          norm.mediaUrl = att.payload?.url;
          norm.mediaMime = att.mime_type;
          if (!norm.type || norm.type === "text") norm.type = (att.type as NormalizedMessage["type"]) ?? "document";
        }
        if (msg?.story_reply) {
          norm.type = "story_reply";
          norm.text = msg.story_reply.text;
        }
        out.push(norm);
      }
    }
    return out;
  },

  async sendText(args: SendTextArgs) {
    const res = await graphPost<{ message_id: string }>(
      `/${args.fromExternalId}/messages`,
      args.accessToken,
      {
        messaging_type: "RESPONSE",
        recipient: { id: args.toExternalId },
        message: { text: args.text },
      },
    );
    return { externalId: res.message_id };
  },

  async sendTemplate(_args: SendTemplateArgs) {
    throw new Error("Instagram templates not yet supported in Fase 2");
  },

  async sendMedia(args: SendMediaArgs) {
    const igType = (["image", "video", "audio"].includes(args.mediaType)
      ? args.mediaType
      : "file") as "image" | "video" | "audio" | "file";
    const res = await graphPost<{ message_id: string }>(
      `/${args.fromExternalId}/messages`,
      args.accessToken,
      {
        messaging_type: "RESPONSE",
        recipient: { id: args.toExternalId },
        message: {
          attachment: {
            type: igType,
            payload: { url: args.mediaUrl, is_reusable: true },
          },
        },
      },
    );
    return { externalId: res.message_id };
  },

  async fetchContactProfile({ accessToken, externalUserId }) {
    try {
      const res = await graphGet<{ name?: string; profile_picture_url?: string }>(
        `/${externalUserId}?fields=name,profile_picture_url`,
        accessToken,
      );
      return { name: res.name, avatar: res.profile_picture_url };
    } catch {
      return {};
    }
  },

  async fetchTemplates(): Promise<Template[]> {
    return [];
  },
};

function mapIgType(msg: any): NormalizedMessage["type"] {
  if (msg?.text) return "text";
  if (msg?.attachments?.length) return (msg.attachments[0].type as NormalizedMessage["type"]) ?? "document";
  return "text";
}

export type Profile = ContactProfile;