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
});
