import { describe, expect, it, vi, beforeEach } from "vitest";

const { evaluateTriggers, createAdminClient, generateAgentReply, getAdapter } = vi.hoisted(() => ({
  evaluateTriggers: vi.fn().mockResolvedValue({ matched: 1, messagesSent: 0 }),
  createAdminClient: vi.fn(),
  generateAgentReply: vi.fn(),
  getAdapter: vi.fn(),
}));
vi.mock("@/lib/automations/engine", () => ({ evaluateTriggers }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/ai/chat", () => ({ generateAgentReply }));
vi.mock("@/lib/channels", () => ({ getAdapter }));

import { processInbound } from "./process";

function makeAdminMock(): {
  from: (table: string) => Record<string, unknown>;
  rpc: ReturnType<typeof vi.fn>;
} {
  const from = (table: string) => {
    const result =
      table === "channels"
        ? { data: { id: "channel", workspace_id: "workspace", access_token_enc: null } }
        : table === "contacts"
          ? { data: { id: "contact" } }
          : table === "contact_channels"
            ? { data: { id: "contact-channel" } }
            : table === "conversations"
              ? { data: { id: "conversation", archived_at: null } }
              : { data: null };
    const query: Record<string, unknown> = {};
    for (const m of [
      "select", "eq", "upsert", "insert", "update", "order",
      "is", "gte", "lte", "limit",
    ]) {
      query[m] = vi.fn(() => query);
    }
    query.maybeSingle = vi.fn(async () => result);
    query.single = vi.fn(async () => result);
    return query;
  };
  return { from, rpc: vi.fn().mockResolvedValue({}) };
}

const MESSAGE = {
  channelType: "facebook" as const,
  channelExternalId: "page",
  contactExternalId: "sender",
  messageExternalId: "mid",
  direction: "in" as const,
  type: "text" as const,
  text: "Hola",
  timestamp: new Date(),
  raw: {},
};

describe("processInbound — loop guard", () => {
  it("runs automations once when the same message arrives twice", async () => {
    let insertCount = 0;
    const upsertMessage = vi.fn();
    const from = (table: string) => {
      const result = table === "channels" ? { data: { id: "channel", workspace_id: "workspace", access_token_enc: null } }
        : table === "contacts" ? { data: { id: "contact" } }
        : table === "contact_channels" ? { data: { id: "contact-channel" } }
        : table === "conversations" ? { data: { id: "conversation", archived_at: null } }
        : { data: null };
      const query: Record<string, unknown> = {};
      for (const m of ["select", "eq", "upsert", "insert", "update", "order", "is", "gte", "lte", "limit"]) {
        query[m] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn(async () => result);
      query.single = vi.fn(async () => result);
      if (table === "messages") {
        query.upsert = vi.fn((...args: unknown[]) => { upsertMessage(...args); return query; });
        query.select = vi.fn(async () => ({ data: ++insertCount === 1 ? [{ id: "message" }] : [], error: null }));
      }
      return query;
    };
    createAdminClient.mockReturnValue({ from, rpc: vi.fn().mockResolvedValue({}) });
    evaluateTriggers.mockResolvedValue({ matched: 1, messagesSent: 0 });

    await processInbound(MESSAGE);
    await processInbound(MESSAGE);
    expect(upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ external_id: "mid" }),
      { onConflict: "conversation_id,external_id", ignoreDuplicates: true },
    );
    expect(evaluateTriggers).toHaveBeenCalledTimes(1);
  });
});

describe("processInbound — AI auto-reply suppression", () => {
  beforeEach(() => {
    createAdminClient.mockReturnValue(makeAdminMock());
    generateAgentReply.mockReset();
    getAdapter.mockReset();
  });

  it("skips the auto-reply when an automation matched (matched > 0)", async () => {
    evaluateTriggers.mockResolvedValue({ matched: 1, messagesSent: 0 });
    await processInbound(MESSAGE);
    // give the fire-and-forget a tick to schedule
    await new Promise((r) => setTimeout(r, 10));
    expect(generateAgentReply).not.toHaveBeenCalled();
  });

  it("skips the auto-reply when no agent is configured (no is_default row)", async () => {
    evaluateTriggers.mockResolvedValue({ matched: 0, messagesSent: 0 });
    // The default mock returns null for ai_agents. The auto-reply
    // path checks is_default and bails.
    const sendText = vi.fn();
    getAdapter.mockReturnValue({ sendText });
    await processInbound(MESSAGE);
    await new Promise((r) => setTimeout(r, 10));
    expect(sendText).not.toHaveBeenCalled();
    expect(generateAgentReply).not.toHaveBeenCalled();
  });

  // Regression: a human assigned to the conversation must silence the bot.
  // The auto-reply used to only look at handoff keywords and the reply
  // cap, never at conversations.assigned_to, so a seller handling a lead
  // still got the AI answering over the top.
  it("skips the auto-reply when a human is assigned to the conversation", async () => {
    evaluateTriggers.mockResolvedValue({ matched: 0, messagesSent: 0 });
    const sendText = vi.fn();
    getAdapter.mockReturnValue({ sendText });

    const from = (table: string) => {
      const result =
        table === "channels"
          ? { data: { id: "channel", workspace_id: "workspace", access_token_enc: "dG9rZW4=" } }
          : table === "contacts"
            ? { data: { id: "contact" } }
            : table === "contact_channels"
              ? { data: { id: "contact-channel" } }
              : table === "conversations"
                ? { data: { id: "conversation", archived_at: null, assigned_to: "human-1", assigned_at: new Date().toISOString() } }
                : table === "ai_agents"
                  ? {
                      data: {
                        id: "agent-1",
                        workspace_id: "workspace",
                        auto_reply_enabled: true,
                        handoff_keywords: [],
                        max_replies_per_conversation: 5,
                        provider: "openai",
                        model: "gpt-4o-mini",
                      },
                    }
                  : { data: null };
      const query: Record<string, unknown> = {};
      for (const m of ["select", "eq", "upsert", "insert", "update", "order", "is", "gte", "lte", "limit"]) {
        query[m] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn(async () => result);
      query.single = vi.fn(async () => result);
      if (table === "messages") {
        query.select = vi.fn(async () => ({ data: [{ id: "message" }], error: null }));
      }
      return query;
    };
    createAdminClient.mockReturnValue({ from, rpc: vi.fn().mockResolvedValue({}) });

    await processInbound(MESSAGE);
    await new Promise((r) => setTimeout(r, 10));

    expect(generateAgentReply).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });

  it("still auto-replies when assigned_to is null", async () => {
    evaluateTriggers.mockResolvedValue({ matched: 0, messagesSent: 0 });
    // conversations.assigned_to absent ⇒ unassigned ⇒ the AI still answers.
    const from = (table: string) => {
      const result =
        table === "channels"
          ? { data: { id: "channel", workspace_id: "workspace", access_token_enc: null } }
          : table === "contacts"
            ? { data: { id: "contact" } }
            : table === "contact_channels"
              ? { data: { id: "contact-channel" } }
              : table === "conversations"
                ? { data: { id: "conversation", archived_at: null, assigned_to: null, assigned_at: null } }
                : { data: null };
      const query: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "upsert", "insert", "update", "order", "is", "gte", "lte", "limit"]) {
        query[m] = vi.fn(() => query);
      }
      query.maybeSingle = vi.fn(async () => result);
      query.single = vi.fn(async () => result);
      if (table === "messages") {
        query.select = vi.fn(async () => ({ data: [{ id: "message" }], error: null }));
      }
      return query;
    };
    createAdminClient.mockReturnValue({ from, rpc: vi.fn().mockResolvedValue({}) });

    // No ai_agents row ⇒ we bail after the assignment check. The point is
    // that we got PAST the assignment guard, so the ai_agents lookup ran.
    let aiAgentsQueried = false;
    const wrapped = (table: string) => {
      if (table === "ai_agents") aiAgentsQueried = true;
      return from(table);
    };
    createAdminClient.mockReturnValue({ from: wrapped, rpc: vi.fn().mockResolvedValue({}) });

    await processInbound(MESSAGE);
    await new Promise((r) => setTimeout(r, 10));

    expect(aiAgentsQueried).toBe(true);
  });
});
