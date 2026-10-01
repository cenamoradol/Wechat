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

// Facebook Messenger Platform: https://developers.facebook.com/docs/messenger-platform
// Webhook payload: { object: "page", entry: [{ messaging: [{ sender, recipient, message, ... }] }] }

export const facebookAdapter: ChannelAdapter = {
  type: "facebook",

  verifyWebhookGet() {
    // FB uses POST verification only; we still respond to GET as 405
    return new Response("Method Not Allowed", { status: 405 });
  },

  parseInbound(payload) {
    const out: NormalizedMessage[] = [];
    const p = payload as any;
    const entries = p?.entry ?? [];
    for (const entry of entries) {
      const events = entry?.messaging ?? [];
      for (const evt of events) {
        const senderId = evt?.sender?.id;
        const recipientId = evt?.recipient?.id; // page id
        const msg = evt?.message;
        if (!msg) continue;
        const ts = evt?.timestamp ? new Date(Number(evt.timestamp)) : new Date();
        const id = msg?.mid ?? `fb-${ts.getTime()}`;
        const norm: NormalizedMessage = {
          channelType: "facebook",
          channelExternalId: recipientId,
          contactExternalId: senderId,
          messageExternalId: id,
          type: mapFbType(msg),
          direction: "in",
          text: msg?.text,
          timestamp: ts,
          raw: evt,
        };
        // Attachments
        const att = msg?.attachments?.[0];
        if (att) {
          norm.mediaUrl = att.payload?.url;
          norm.mediaMime = att.mime_type;
          if (!norm.type || norm.type === "text") norm.type = (att.type as NormalizedMessage["type"]) ?? "document";
        }
        if (msg?.quick_reply) norm.type = "interactive";
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
    throw new Error("Facebook Messenger templates require a different payload — implement in Fase 3");
  },

  async sendMedia(args: SendMediaArgs) {
    const fbType = (["image", "video", "audio"].includes(args.mediaType)
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
            type: fbType,
            payload: { url: args.mediaUrl, is_reusable: true },
          },
        },
      },
    );
    return { externalId: res.message_id };
  },

  async fetchContactProfile({ accessToken, externalUserId }) {
    try {
      const res = await graphGet<{ first_name?: string; last_name?: string; profile_pic?: string }>(
        `/${externalUserId}?fields=first_name,last_name,profile_pic`,
        accessToken,
      );
      const name = [res.first_name, res.last_name].filter(Boolean).join(" ");
      return { name, avatar: res.profile_pic };
    } catch {
      return {};
    }
  },

  async fetchTemplates(): Promise<Template[]> {
    // FB doesn't have templates in the same way as WA; return empty.
    return [];
  },
};

function mapFbType(msg: any): NormalizedMessage["type"] {
  if (msg?.text) return "text";
  if (msg?.attachments?.length) return (msg.attachments[0].type as NormalizedMessage["type"]) ?? "document";
  if (msg?.sticker_id) return "image";
  return "text";
}

export type Profile = ContactProfile;