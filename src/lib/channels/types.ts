// Normalized inbound message — common shape for all 3 channels.
// Channel adapters translate platform-specific payloads into NormalizedMessage[].
export type NormalizedMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "template"
  | "interactive"
  | "reaction"
  | "story_reply"
  | "system";

export type NormalizedMessage = {
  channelType: "whatsapp" | "facebook" | "instagram";
  // For WA: phone_number_id; for FB/IG: page_id
  channelExternalId: string;
  // For WA: wa_id; for FB/IG: psid (sender's Page-Scoped ID)
  contactExternalId: string;
  messageExternalId: string;
  type: NormalizedMessageType;
  direction: "in";
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
  raw: unknown;
  timestamp: Date;
};

export type SendTextArgs = {
  accessToken: string;
  fromExternalId: string; // phone_number_id | page_id
  toExternalId: string; // wa_id | psid
  text: string;
};

export type SendTemplateArgs = SendTextArgs & {
  templateName: string;
  language: string;
  variables: Record<string, string>;
};

export type SendMediaArgs = SendTextArgs & {
  /**
   * Public URL of the media file (used by Messenger/IG attachment API).
   * For WhatsApp, prefer passing `file` directly via multipart upload.
   */
  mediaUrl?: string;
  /**
   * Raw file blob (used by WhatsApp multipart upload).
   * If `file` is provided, WhatsApp uploads it directly.
   */
  file?: File | Blob;
  mediaType: "image" | "video" | "audio" | "document";
  caption?: string;
  /** For documents, the original filename. */
  filename?: string;
};

export type ContactProfile = {
  name?: string;
  avatar?: string;
};

export interface ChannelAdapter {
  type: "whatsapp" | "facebook" | "instagram";
  verifyWebhookGet(searchParams: URLSearchParams, verifyToken: string | undefined): Response | null;
  parseInbound(payload: unknown): NormalizedMessage[];
  sendText(args: SendTextArgs): Promise<{ externalId: string }>;
  sendTemplate(args: SendTemplateArgs): Promise<{ externalId: string }>;
  sendMedia(args: SendMediaArgs): Promise<{ externalId: string; metaMediaId?: string }>;
  fetchContactProfile(args: { accessToken: string; externalUserId: string }): Promise<ContactProfile>;
  fetchTemplates(args: { accessToken: string; externalId: string }): Promise<Template[]>;
}

export type Template = {
  externalId: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  components: unknown[];
};