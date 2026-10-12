import { describe, expect, it, vi, beforeEach } from "vitest";

const { generateAgentReplyMock, getAdapterMock, createAdminClientMock } = vi.hoisted(() => ({
  generateAgentReplyMock: vi.fn(),
  getAdapterMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/ai/chat", () => ({
  generateAgentReply: generateAgentReplyMock,
  classifyMessage: vi.fn(),
}));
vi.mock("@/lib/channels", () => ({
  getAdapter: getAdapterMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { runStep } from "@/lib/automations/steps";
import type { RunContext, Step } from "@/lib/automations/types";

const AGENT_ROW = {
  id: "agent-1",
  workspace_id: "ws-1",
  name: "a",
  description: null,
  provider: "openai",
  model: "gpt-4o-mini",
  system_prompt: "",
  temperature: 0.7,
  max_tokens: 1000,
  kb_enabled: false,
  auto_reply_enabled: true,
  max_replies_per_conversation: 5,
  handoff_keywords: ["humano"],
  is_default: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    automation: {
      id: "auto-1",
      name: "test",
      workspaceId: "ws-1",
      steps: [],
    },
    conversation: { id: "conv-1", status: "open", assignedTo: null },
    contact: { id: "contact-1", name: "Test", phone: "+50499999999", email: null },
    contactChannel: { id: "cc-1", externalUserId: "ext-1" },
    channel: {
      id: "ch-1",
      type: "whatsapp",
      externalId: "phone-1",
      accessToken: "fake-token",
    },
    triggerData: { messageText: "Tengo un corolla 2023" },
    vars: { messageText: "Tengo un corolla 2023" },
    ...overrides,
  };
}

function makeAdminMockWithAgent(overrides: { inboundText?: string } = {}) {
  const inboundText = overrides.inboundText ?? "tengo un corolla 2023";
  const from = (table: string) => {
    // ponytail: the query chain is awaited as a Promise, so the
    // returned object must be thenable. We make every method return
    // the query itself, but the query itself is a thenable that
    // resolves to { data, error }. `maybeSingle`/`single` override
    // the resolved value to the single-row form Supabase uses.
    let resolvedData: unknown[] | null = null;
    let resolvedError: unknown = null;
    if (table === "ai_agents") {
      resolvedData = [AGENT_ROW];
    } else if (table === "messages") {
      resolvedData = [{ direction: "in", text: inboundText, sent_by: null }];
    }
    const query: Record<string, unknown> & { then?: unknown } = {};
    for (const m of [
      "select", "eq", "upsert", "insert", "update", "order", "is",
      "gte", "lte", "limit",
    ]) {
      query[m] = vi.fn((..._a: unknown[]) => query);
    }
    query.maybeSingle = vi.fn(() => {
      const item = Array.isArray(resolvedData) ? resolvedData[0] : resolvedData;
      return Promise.resolve({ data: item, error: null });
    });
    query.single = vi.fn().mockResolvedValue({ data: null, error: null });
    query.then = (onFulfilled: (v: unknown) => unknown) => {
      return Promise.resolve({ data: resolvedData, error: resolvedError }).then(onFulfilled);
    };
    return query;
  };
  return { from, rpc: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdapterMock.mockReturnValue({
    sendText: vi.fn().mockResolvedValue({ externalId: "wamid.1" }),
    sendMedia: vi.fn().mockResolvedValue({ externalId: "wamid.2" }),
  });
});

describe("runStep — send_text", () => {
  it("sends via the channel adapter and reports messagesSent: 1", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
    const ctx = makeCtx();
    const step: Step = { type: "send_text", text: "Hola {{contact.name}}" };
    const out = (await runStep(step, ctx)) as { externalId: string; messagesSent: number };
    expect(out.messagesSent).toBe(1);
    expect(out.externalId).toBe("wamid.1");
    expect(getAdapterMock().sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Hola Test", toExternalId: "ext-1" }),
    );
  });
});

describe("runStep — webhook (SSRF guard)", () => {
  it("rejects private IPv4 destinations", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
    const ctx = makeCtx();
    const step: Step = { type: "webhook", url: "http://10.0.0.1/admin", method: "GET" };
    await expect(runStep(step, ctx)).rejects.toThrow(/not allowed/);
  });

  it("rejects loopback", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
    const ctx = makeCtx();
    const step: Step = { type: "webhook", url: "http://127.0.0.1:8080/secret", method: "GET" };
    await expect(runStep(step, ctx)).rejects.toThrow(/not allowed/);
  });

  it("rejects non-http(s) protocols", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
    const ctx = makeCtx();
    const step: Step = { type: "webhook", url: "file:///etc/passwd", method: "GET" };
    await expect(runStep(step, ctx)).rejects.toThrow();
  });
});

describe("runStep — ai_extract", () => {
  beforeEach(() => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
  });

  it("extracts typed fields and reports them in the output", async () => {
    generateAgentReplyMock.mockResolvedValue({
      content: '{"brand":"Toyota","year":2023,"isNew":false}',
      usage: { tokensIn: 10, tokensOut: 20, latencyMs: 100 },
      sources: [],
    });
    const ctx = makeCtx();
    const step: Step = {
      type: "ai_extract",
      agentId: "agent-1",
      instruction: "Extrae marca y año",
      fields: [
        { name: "brand", type: "string" },
        { name: "year", type: "number" },
        { name: "isNew", type: "boolean" },
      ],
    };
    const out = (await runStep(step, ctx)) as Record<string, unknown>;
    expect(out.brand).toBe("Toyota");
    expect(out.year).toBe(2023);
    expect(out.isNew).toBe(false);
  });

  it("omits fields the LLM did not return", async () => {
    generateAgentReplyMock.mockResolvedValue({
      content: '{"brand":"Honda"}',
      usage: { tokensIn: 1, tokensOut: 1, latencyMs: 1 },
      sources: [],
    });
    const ctx = makeCtx();
    const step: Step = {
      type: "ai_extract",
      agentId: "agent-1",
      instruction: "x",
      fields: [
        { name: "brand", type: "string" },
        { name: "year", type: "number" },
      ],
    };
    const out = (await runStep(step, ctx)) as Record<string, unknown>;
    expect(out.brand).toBe("Honda");
    expect("year" in out).toBe(false);
  });

  it("tolerates a one-line preamble from the LLM", async () => {
    generateAgentReplyMock.mockResolvedValue({
      content: 'Here you go:\n{"brand":"Toyota"}',
      usage: { tokensIn: 1, tokensOut: 1, latencyMs: 1 },
      sources: [],
    });
    const ctx = makeCtx();
    const step: Step = {
      type: "ai_extract",
      agentId: "agent-1",
      instruction: "x",
      fields: [{ name: "brand", type: "string" }],
    };
    const out = (await runStep(step, ctx)) as Record<string, unknown>;
    expect(out.brand).toBe("Toyota");
  });

  it("throws when the LLM returns non-JSON", async () => {
    generateAgentReplyMock.mockResolvedValue({
      content: "no JSON here",
      usage: { tokensIn: 1, tokensOut: 1, latencyMs: 1 },
      sources: [],
    });
    const ctx = makeCtx();
    const step: Step = {
      type: "ai_extract",
      agentId: "agent-1",
      instruction: "x",
      fields: [{ name: "brand", type: "string" }],
    };
    await expect(runStep(step, ctx)).rejects.toThrow(/ai_extract/);
  });
});

describe("runStep — ai_reply (handoff path)", () => {
  it("returns handoff result and skips the LLM call when keyword matches", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMockWithAgent());
    const ctx = makeCtx({
      triggerData: { messageText: "quiero hablar con un humano" },
      vars: { messageText: "quiero hablar con un humano" },
    });
    // override the per-test admin mock so the messages query returns
    // a row with the keyword text (default mock returns corolla text)
    createAdminClientMock.mockReturnValue(
      makeAdminMockWithAgent({ inboundText: "quiero hablar con un humano" }),
    );

    const step: Step = { type: "ai_reply", agentId: "agent-1" };
    const out = (await runStep(step, ctx)) as { handoff: boolean; reason: string };
    expect(out.handoff).toBe(true);
    expect(out.reason).toMatch(/keyword: humano/);
    expect(generateAgentReplyMock).not.toHaveBeenCalled();
  });
});
