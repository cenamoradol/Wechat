import { afterEach, expect, it, vi } from "vitest";

const { getApiKey, touchApiKey } = vi.hoisted(() => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  touchApiKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./providers", async (importOriginal) => ({
  ...await importOriginal<typeof import("./providers")>(),
  getApiKey,
  touchApiKey,
}));

import { classifyMessage, generateAgentReply } from "./chat";
import { pingProvider } from "./providers";
import type { AIAgent } from "./types";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["gemini", "gemini-2.5-flash-lite", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"],
  ["openrouter", "openai/gpt-4o-mini", "https://openrouter.ai/api/v1/chat/completions"],
] as const)("uses the OpenAI-compatible endpoint for %s verification, replies and classification", async (provider, model, endpoint) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => "{}",
    json: async () => ({
      choices: [{ message: { content: '{"matches":true,"reasoning":"sí"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  expect(await pingProvider(provider, "test-key", model)).toEqual({ ok: true });
  const agent = {
    id: "agent", workspaceId: "workspace", provider, model,
    systemPrompt: "Responde en español", temperature: 0.7, maxTokens: 1024, kbEnabled: false,
  } as AIAgent;
  expect((await generateAgentReply({ agent, messages: [{ role: "user", content: "Hola" }] })).usage.tokensIn).toBe(10);
  expect((await classifyMessage({ agent, messageText: "Hola", criteria: "Saludo" })).matches).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  for (const [url, options] of fetchMock.mock.calls) {
    expect(url).toBe(endpoint);
    expect(options.headers.Authorization).toBe("Bearer test-key");
  }
});
