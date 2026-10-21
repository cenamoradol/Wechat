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
      type: "ai_classify";
      agentId: string;
      criteria: string;
    }
  | {
      // ponytail: LLM-evaluated natural-language condition. Universal
      // trigger: the user writes the condition ("precio", "hablar con
      // humano") and the LLM decides if the message matches. Reuses the
      // workspace's AI provider. Matches wacrm's `llm_condition` trigger.
      type: "llm_condition";
      agentId: string;
      conditionPrompt: string;
    };

export type ExtractFieldType = "string" | "number" | "boolean";

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
      // ponytail: pick one assignee from a pool, weighted toward whoever has
      // the fewest open/pending conversations. Optional threshold on per-agent
      // load — if every candidate is at/over it, skip the step and leave the
      // conversation unassigned. Picker lives in steps.ts so it's pure + testable.
      // Optional messageTemplate sends a one-off text right after the
      // assignment resolves, with {{agent.name}} interpolated to the
      // winning assignee's profile name (or email local-part).
      type: "auto_assign";
      userIds: string[];
      maxLoadPerAgent?: number;
      messageTemplate?: string;
    }
  | {
      type: "webhook";
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      queryParams?: Record<string, string>;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      saveAs?: string;
      extractFields?: Array<{ name: string; path: string }>;
    }
  | {
      type: "ai_reply";
      agentId: string;
      handoffMessage?: string;
    }
  | {
      type: "ai_extract";
      agentId: string;
      instruction: string;
      fields: Array<{ name: string; type: ExtractFieldType }>;
      // ponytail: optional reference vocabulary path. Resolved against
      // ctx.vars at runtime; the rendered text is injected into the
      // prompt so the LLM can match the customer's mention against
      // canonical values from a prior webhook (e.g. catalog brands).
      referencePath?: string;
    }
  | {
      type: "branch";
      if: { field: "tag" | "channel" | "status"; operator: "has" | "equals" | "is"; value: string };
      then: Step[];
      else?: Step[];
    }
  | {
      // ponytail: LLM composes the outbound message using current vars
      // (webhook responses, extracted fields) and the conversation
      // history, then sends via the channel. Use after data-fetching
      // steps to turn structured data into a natural reply without
      // baking a fixed template. Mirrors wacrm's `llm_draft_message`.
      type: "llm_draft_message";
      agentId: string;
      prompt: string;
    }
  | {
      // ponytail: send WhatsApp image messages by iterating a
      // `vars.X[*].Y` array. Each iteration sends one image with an
      // optional caption rendered against `loop.*` scope. Mirrors
      // wacrm's `send_images` step. Limit caps how many are sent in
      // one run (default 5).
      type: "send_images";
      agentId: string;
      imagePath: string;
      caption?: string;
      maxImages?: number;
    }
  | {
      // ponytail: condition step (yes/no branching) with five subjects.
      // Mirrors wacrm's `condition` step with `subject` discriminator.
      // Vars-value operator lets you branch on any value in ctx.vars
      // (including wildcard paths to webhook responses).
      type: "condition";
      subject: "tag_presence" | "contact_field" | "message_content" | "time_of_day" | "vars_value";
      operand?: string;
      operator?: "is_empty" | "is_not_empty" | "equals" | "not_equals" | "contains";
      value?: string;
      yes: Step[];
      no: Step[];
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
  const m = /^(\d+)\s*([smhd])$/i.exec(d.trim());
  if (!m) throw new Error(`Invalid duration: ${d}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * factor;
}
