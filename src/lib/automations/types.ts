// src/lib/automations/types.ts
// JSON shapes for triggers and steps. See plan.md §11.1, §11.2.

export type ChannelFilter = "whatsapp" | "facebook" | "instagram" | "any";

export type Trigger =
  | {
      type: "message_received";
      channel: ChannelFilter;
      match: "exact" | "contains" | "regex" | "any";
      value: string;
      caseSensitive?: boolean;
    }
  | { type: "message_unanswered"; minutes: number; channel: ChannelFilter }
  | { type: "contact_created"; channel: ChannelFilter }
  | { type: "tag_added"; tagId: string }
  | { type: "schedule"; cron: string; timezone: string }
  | {
      // ponytail: AI-powered trigger. The criteria is a natural language
      // description. The LLM decides if the message matches. Uses the
      // agent's provider/model but ignores its system prompt.
      type: "ai_classify";
      agentId: string;
      criteria: string;
    };

export type Step =
  | { type: "send_text"; text: string }
  | { type: "send_template"; templateId: string; vars: Record<string, string> }
  | { type: "add_tag"; tagId: string }
  | { type: "remove_tag"; tagId: string }
  | { type: "set_field"; fieldId: string; value: string }
  | { type: "wait"; duration: string } // "5m" | "30m" | "1h" | "1d"
  | { type: "assign_to"; userId: string }
  | { type: "set_status"; status: "open" | "pending" | "closed" }
  | { type: "close_conversation" }
  | {
      type: "webhook";
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    }
  | {
      type: "ai_reply";
      agentId: string;
      handoffMessage?: string;
    }
  | {
      type: "branch";
      if: { field: "tag" | "channel" | "status"; operator: "has" | "equals" | "is"; value: string };
      then: Step[];
      else?: Step[];
    };

export type RunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export type StepLogEntry = {
  step: number;
  type: Step["type"];
  status: "ok" | "failed";
  duration_ms: number;
  output?: unknown;
  error?: string;
};

export type TriggerEvent =
  | {
      kind: "message_received";
      workspaceId: string;
      conversationId: string;
      contactId: string;
      contactChannelId: string;
      channelId: string;
      channelType: "whatsapp" | "facebook" | "instagram";
      messageText: string | null;
      messageId: string;
    }
  | {
      kind: "contact_created";
      workspaceId: string;
      contactId: string;
      contactChannelId: string;
      channelId: string;
      channelType: "whatsapp" | "facebook" | "instagram";
    }
  | {
      kind: "message_unanswered";
      workspaceId: string;
      conversationId: string;
      contactId: string;
      contactChannelId: string;
      channelId: string;
      channelType: "whatsapp" | "facebook" | "instagram";
    }
  | {
      kind: "tag_added";
      workspaceId: string;
      contactId: string;
      contactChannelId: string;
      channelId: string;
      channelType: "whatsapp" | "facebook" | "instagram";
      tagId: string;
    }
  | {
      kind: "ai_classify";
      workspaceId: string;
      conversationId: string;
      contactId: string;
      contactChannelId: string;
      channelId: string;
      channelType: "whatsapp" | "facebook" | "instagram";
      messageText: string | null;
      messageId: string;
      agentId: string;
      criteria: string;
    };

export type RunContext = {
  automation: {
    id: string;
    name: string;
    workspaceId: string;
    steps: Step[];
  };
  conversation: {
    id: string;
    status: "open" | "pending" | "closed";
    assignedTo: string | null;
  };
  contact: { id: string; name: string | null; phone: string | null; email: string | null };
  contactChannel: { id: string; externalUserId: string };
  channel: { id: string; type: "whatsapp" | "facebook" | "instagram"; externalId: string; accessToken: string };
  triggerData: Record<string, unknown>;
  vars: Record<string, unknown>;
};

export function parseDuration(d: string): number {
  // Returns duration in milliseconds. Supports "5m" | "30m" | "1h" | "1d".
  const m = /^(\d+)\s*([smhd])$/i.exec(d.trim());
  if (!m) throw new Error(`Invalid duration: ${d}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * factor;
}