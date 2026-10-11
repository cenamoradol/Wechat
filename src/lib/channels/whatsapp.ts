import { graphGet, graphPost } from "../meta/oauth";
import type {
  ChannelAdapter,
  ContactProfile,
  NormalizedMessage,
  SendMediaArgs,
  SendTemplateArgs,
  SendTextArgs,
  Template,
} from "./types";

// WhatsApp Business Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
// Webhook payload shape: { object: "whatsapp_business_account", entry: [{ changes: [{ value: {...} }] }] }
// Or older shape: { entry: [{ changes: [{ value: { messages, statuses, metadata } }] }] }

export const whatsappAdapter: ChannelAdapter = {
  type: "whatsapp",

  verifyWebhookGet(searchParams, verifyToken) {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  },

  parseInbound(payload) {
    const out: NormalizedMessage[] = [];
    const p = payload as any;
    const entries = p?.entry ?? [];
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = value?.messages ?? [];
        for (const m of messages) {
          const ts = m?.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
          const ext = m?.from;
          const id = m?.id;
          const type = (m?.type ?? "text") as NormalizedMessage["type"];
          const msg: NormalizedMessage = {
            channelType: "whatsapp",
            channelExternalId: phoneNumberId,
            contactExternalId: ext,
            messageExternalId: id,
            type,
            direction: "in",
            timestamp: ts,
            raw: m,
          };
          const t = m?.text?.body;
          if (type === "text" && t) msg.text = t;
          if (type === "image" || type === "video" || type === "audio" || type === "document") {
            const media = m?.[type];
            if (media) {
              msg.mediaUrl = media.url ?? media.id;
              msg.mediaMime = media.mime_type;
              if (media.caption) msg.text = media.caption;
            }
          }
          if (type === "reaction") msg.text = m?.reaction?.emoji;
          if (type === "interactive") {
            msg.text = m?.interactive?.button_reply?.title ?? m?.interactive?.list_reply?.title;
          }
          out.push(msg);
        }
      }
    }
    return out;
  },

  async sendText(args: SendTextArgs) {
    const res = await graphPost<{ messages: Array<{ id: string }> }>(
      `/${args.fromExternalId}/messages`,
      args.accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: args.toExternalId,
        type: "text",
        text: { body: args.text, preview_url: false },
      },
    );
    return { externalId: res.messages[0].id };
  },

  async sendMedia(args: SendMediaArgs): Promise<{ externalId: string; metaMediaId: string }> {
    if (!args.file) {
      throw new Error("WhatsApp sendMedia requires `file` (multipart upload). Messenger/IG use `mediaUrl`.");
    }

    // Step 1: upload the file to Meta to get a media_id
    // ponytail: WA rejects uploads without a filename (the file part must
    // include a name with the right extension). Wrap the blob in a File
    // and use FormData's third arg to set the filename.
    const fileName = args.filename ?? `audio.${args.mediaType === "audio" ? "mp3" : args.mediaType === "image" ? "jpg" : "mp4"}`;
    const filePart = args.file instanceof File
      ? args.file
      : new File([args.file], fileName, { type: args.file.type });
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", args.mediaType);
    form.append("file", filePart, fileName);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v22.0/${args.fromExternalId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${args.accessToken}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`WhatsApp media upload failed (${uploadRes.status}): ${err.slice(0, 300)}`);
    }
    const { id: metaMediaId } = (await uploadRes.json()) as { id: string };
    console.log(`[wa] uploaded media_id=${metaMediaId} type=${args.mediaType} mime=${args.file.type} name=${fileName}`);

    // Step 2: send the message with the media_id
    const mediaPayload: Record<string, unknown> = { id: metaMediaId };
    // ponytail: WA rejects `caption` on audio type with 400. Only
    // image/video/document accept captions.
    if (args.caption && args.mediaType !== "audio") {
      mediaPayload.caption = args.caption;
    }
    // ponytail: Meta only accepts `filename` for `document` type;
    // image/video/audio/sticker reject it with 400.
    if (args.mediaType === "document" && args.filename) {
      mediaPayload.filename = args.filename;
    }

    const sendRes = await graphPost<{ messages: Array<{ id: string }> }>(
      `/${args.fromExternalId}/messages`,
      args.accessToken,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: args.toExternalId,
        type: args.mediaType, // "image" | "video" | "audio" | "document"
        [args.mediaType]: mediaPayload,
      },
    );
    return { externalId: sendRes.messages[0].id, metaMediaId };
  },

  async sendTemplate(args: SendTemplateArgs) {
    const res = await graphPost<{ messages: Array<{ id: string }> }>(
      `/${args.fromExternalId}/messages`,
      args.accessToken,
      {
        messaging_product: "whatsapp",
        to: args.toExternalId,
        type: "template",
        template: {
          name: args.templateName,
          language: { code: args.language },
          components: [
            {
              type: "body",
              parameters: Object.values(args.variables).map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      },
    );
    return { externalId: res.messages[0].id };
  },

  async fetchContactProfile({ accessToken, externalUserId }) {
    // WA contacts: name comes from contacts sync or user push. Try the simpler
    // contacts lookup, fallback to nothing.
    try {
      const res = await graphGet<{ profile?: { name?: string } }>(
        `/${externalUserId}`,
        accessToken,
      );
      return { name: res.profile?.name };
    } catch {
      return {};
    }
  },

  async fetchTemplates({ accessToken, externalId }) {
    // externalId here is the WhatsApp Business Account ID (WABA ID)
    try {
      const res = await graphGet<{
        data: Array<{ id: string; name: string; language: string; status: string; category: string; components: unknown[] }>;
      }>(`/${externalId}/message_templates`, accessToken);
      return res.data.map((t) => ({
        externalId: t.id,
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        components: t.components,
      }));
    } catch {
      return [];
    }
  },
};

export type Profile = ContactProfile;