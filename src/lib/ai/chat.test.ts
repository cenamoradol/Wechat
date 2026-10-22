// ponytail: buildChatHistory replaces 4 copies of the same buggy history
// fetch — taking the FIRST 20 messages silenced the customer's last
// question in long threads, causing the model to freestyle ("haha", "ok").
// These tests lock the new contract: always the LAST N, and the inbound
// we want to reply to is appended if the window excluded it.

import { describe, expect, it, vi, afterEach } from "vitest";
import { buildChatHistory, classifyMessage } from "./chat";
import type { AIAgent } from "./types";

const { getApiKey, touchApiKey } = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  touchApiKey: vi.fn(),
}));
vi.mock("./providers", async (orig) => ({
  ...(await orig<typeof import("./providers")>()),
  getApiKey,
  touchApiKey,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const clsAgent = {
  id: "a",
  workspaceId: "w",
  provider: "openai",
  model: "gpt-4o-mini",
} as unknown as AIAgent;

function stubFetchReturning(text: string) {
  getApiKey.mockResolvedValue("k");
  touchApiKey.mockResolvedValue(undefined);
  const m = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => ({
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    headers: { get: () => "application/json" },
  });
  vi.stubGlobal("fetch", m);
  return m;
}

describe("classifyMessage — JSON extraction", () => {
  // Regression: the old greedy /\{[\s\S]*\}/ swallowed trailing prose, so
  // JSON.parse threw and the handoff automation was silently treated as
  // "no match" — the customer asking for a human got an inventory answer.
  it("parses plain JSON", async () => {
    stubFetchReturning('{"matches":true,"reasoning":"pide humano"}');
    const r = await classifyMessage({
      agent: clsAgent,
      messageText: "pasame un agente",
      criteria: "quiere hablar con un vendedor",
    });
    expect(r.matches).toBe(true);
  });

  it("survives trailing prose after the JSON object", async () => {
    stubFetchReturning('{"matches":true,"reasoning":"ok"} — espero que te sirva {saludos}');
    const r = await classifyMessage({
      agent: clsAgent,
      messageText: "pasame un agente",
      criteria: "quiere hablar con un vendedor",
    });
    expect(r.matches).toBe(true);
  });

  it("survives ```json fences", async () => {
    stubFetchReturning('```json\n{"matches":false,"reasoning":"no"}\n```');
    const r = await classifyMessage({
      agent: clsAgent,
      messageText: "hola",
      criteria: "quiere hablar con un vendedor",
    });
    expect(r.matches).toBe(false);
  });

  it("reads matches:false as a real negative, not a parse failure", async () => {
    stubFetchReturning('{"matches":false,"reasoning":"solo pregunta precio"}');
    const r = await classifyMessage({
      agent: clsAgent,
      messageText: "cuanto vale?",
      criteria: "quiere hablar con un vendedor",
    });
    expect(r.matches).toBe(false);
    expect(r.reasoning).toBe("solo pregunta precio");
  });

  it("returns no-match (not a throw) when the model emits no JSON at all", async () => {
    stubFetchReturning("no puedo clasificar esto");
    const r = await classifyMessage({
      agent: clsAgent,
      messageText: "pasame un agente",
      criteria: "quiere hablar con un vendedor",
    });
    expect(r.matches).toBe(false);
    expect(r.reasoning).toMatch(/no JSON/);
  });
});

function inbound(text: string) {
  return { direction: "in" as const, text };
}
function outbound(text: string) {
  return { direction: "out" as const, text };
}

describe("buildChatHistory", () => {
  describe("no-memory mode (limit = 0)", () => {
    // This is how every call site uses it: the catalog is volatile, so a
    // reply the AI wrote 3 messages ago carries prices that are now stale.
    const longThread: Array<{ direction: "in" | "out"; text: string }> = [
      { direction: "in", text: "tenés honda crv?" },
      { direction: "out", text: "Sí, tengo 3. La más barata: $279.000" },
      { direction: "in", text: "tenés honda crv?" },
    ];

    it("returns ONLY the current message, ignoring any history passed in", () => {
      const out = buildChatHistory(longThread, 0, "cuál es el precio?");
      expect(out).toEqual([{ role: "user", content: "cuál es el precio?" }]);
    });

    it("does not leak stale prices from earlier AI replies", () => {
      const out = buildChatHistory(longThread, 0, "cuál es el precio?");
      expect(JSON.stringify(out)).not.toContain("279.000");
    });

    it("returns an empty list when there is no current message (tag_added, schedule…)", () => {
      // Safe: generateAgentReply puts the system prompt at index 0 of the
      // provider request, so the outgoing messages array is never empty.
      expect(buildChatHistory(longThread, 0, null)).toEqual([]);
      expect(buildChatHistory(longThread, 0, undefined)).toEqual([]);
      expect(buildChatHistory(longThread, 0, "   ")).toEqual([]);
    });

    it("treats a negative limit as no-memory rather than slicing weirdly", () => {
      expect(buildChatHistory(longThread, -5, "hola")).toEqual([
        { role: "user", content: "hola" },
      ]);
    });
  });

  describe("memory mode (limit > 0)", () => {
    it("returns messages in the order received (oldest -> newest)", () => {
      const msgs = [inbound("hola"), outbound("buenas"), inbound("precio?")];
      const out = buildChatHistory(msgs, 20);
      expect(out).toEqual([
        { role: "user", content: "hola" },
        { role: "assistant", content: "buenas" },
        { role: "user", content: "precio?" },
      ]);
    });

    it("keeps the LAST N messages when there are more than N total", () => {
      const msgs: Array<ReturnType<typeof inbound>> = [];
      for (let i = 0; i < 50; i++) msgs.push(inbound(`msg ${i}`));
      const out = buildChatHistory(msgs, 20);
      expect(out).toHaveLength(20);
      expect(out[0]!.content).toBe("msg 30");
      expect(out[out.length - 1]!.content).toBe("msg 49");
    });

    it("appends currentInbound when the window excluded it", () => {
      const msgs: Array<ReturnType<typeof inbound>> = [];
      for (let i = 0; i < 50; i++) msgs.push(inbound(`msg ${i}`));
      const out = buildChatHistory(msgs, 20, "msg 49");
      expect(out[out.length - 1]).toEqual({ role: "user", content: "msg 49" });
      expect(out.filter((m) => m.content === "msg 49")).toHaveLength(1);
    });

    it("appends currentInbound when it is NOT in the returned window", () => {
      const msgs: Array<{ direction: "in" | "out"; text: string }> = [];
      for (let i = 0; i < 50; i++) msgs.push(outbound(`bot ${i}`));
      const out = buildChatHistory(msgs, 20, "¿Y en cuotas?");
      expect(out[out.length - 1]).toEqual({ role: "user", content: "¿Y en cuotas?" });
    });

    it("does NOT append when currentInbound is null or empty", () => {
      const msgs = [inbound("hola"), outbound("buenas")];
      expect(buildChatHistory(msgs, 20, null)).toHaveLength(2);
      expect(buildChatHistory(msgs, 20, "")).toHaveLength(2);
      expect(buildChatHistory(msgs, 20, "   ")).toHaveLength(2);
    });

    it("defaults to inbound->user, outbound->assistant regardless of who sent it", () => {
      // We intentionally do NOT distinguish a human agent from the AI on the
      // wire — both are direction=out for the recipient. This is the project's
      // existing simplification (matches the pre-refactor behavior).
      const msgs = [inbound("a"), outbound("b")];
      expect(buildChatHistory(msgs, 20)).toEqual([
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ]);
    });

    it("coerces null text to empty string so the LLM never sees 'null'", () => {
      const msgs = [{ direction: "in" as const, text: null }, outbound("hola")];
      expect(buildChatHistory(msgs, 20)).toEqual([
        { role: "user", content: "" },
        { role: "assistant", content: "hola" },
      ]);
    });
  });
});