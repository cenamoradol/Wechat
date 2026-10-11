// src/lib/ai/chat.ts
// Main chat function. Sends a conversation to OpenAI / Anthropic /
// Minimax (OpenAI-compatible) and returns the generated reply + usage.

import { getApiKey, touchApiKey, PROVIDER_CONFIG } from "./providers";
import { searchKnowledge } from "./knowledge";
import type { AIAgent, AIMessage, ChatResult, ChatUsage } from "./types";

export function substituteVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export async function generateAgentReply(args: {
  agent: AIAgent;
  messages: AIMessage[];
  contactVars?: Record<string, string>;
}): Promise<ChatResult> {
  const apiKey = await getApiKey(args.agent.workspaceId, args.agent.provider);
  if (!apiKey) throw new Error(`No API key for ${args.agent.provider} in this workspace`);

  let systemPrompt = substituteVars(args.agent.systemPrompt, args.contactVars ?? {});
  let sources: ChatResult["sources"] = [];

  if (args.agent.kbEnabled) {
    const lastUser = [...args.messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      const docs = await searchKnowledge(args.agent.id, lastUser.content, 3);
      sources = docs;
      if (docs.length > 0) {
        systemPrompt += "\n\nKnowledge base (use only if relevant):\n" +
          docs.map((d) => `- ${d.title}: ${d.snippet}`).join("\n");
      }
    }
  }

  const start = Date.now();
  let reply = "";
  let usage: ChatUsage;

  if (args.agent.provider === "openai" || args.agent.provider === "minimax") {
    const cfg = PROVIDER_CONFIG[args.agent.provider];
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: args.agent.model,
        temperature: args.agent.temperature,
        max_tokens: args.agent.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          ...args.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${args.agent.provider} ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    reply = json.choices[0]?.message?.content ?? "";
    usage = {
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  } else {
    // Anthropic
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.agent.model,
        max_tokens: args.agent.maxTokens,
        temperature: args.agent.temperature,
        system: systemPrompt,
        messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const textBlock = json.content.find((b) => b.type === "text");
    reply = textBlock?.text ?? "";
    usage = {
      tokensIn: json.usage?.input_tokens ?? 0,
      tokensOut: json.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  }

  // ponytail: fire-and-forget update of last_used_at
  void touchApiKey(args.agent.workspaceId, args.agent.provider);

  return { content: reply, usage, sources };
}

/**
 * AI classifier for the `ai_classify` trigger. Returns true if the
 * message matches the given criteria according to the LLM.
 */
export async function classifyMessage(args: {
  agent: { id: string; workspaceId: string; provider: "openai" | "anthropic" | "minimax"; model: string; temperature?: number; maxTokens?: number };
  messageText: string;
  criteria: string;
}): Promise<{ matches: boolean; reasoning: string }> {
  const apiKey = await getApiKey(args.agent.workspaceId, args.agent.provider);
  if (!apiKey) throw new Error(`No API key for ${args.agent.provider}`);

  const systemPrompt = `Eres un clasificador de mensajes. Tu único trabajo es decidir si el mensaje del usuario cumple con el criterio dado.

Responde SOLO con un JSON válido con este shape:
{"matches": true|false, "reasoning": "explicación breve en español"}`;

  const userPrompt = `Criterio: ${args.criteria}

Mensaje del usuario: """${args.messageText}"""

¿Cumple el criterio?`;

  let text = "";
  if (args.agent.provider === "openai" || args.agent.provider === "minimax") {
    const cfg = PROVIDER_CONFIG[args.agent.provider];
    const body: Record<string, unknown> = {
      model: args.agent.model,
      temperature: args.agent.temperature ?? 0,
      max_tokens: args.agent.maxTokens ?? 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    // ponytail: response_format is OpenAI-specific. Minimax supports it
    // but if it fails we'll retry without it.
    if (args.agent.provider === "openai") {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${args.agent.provider} ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    text = json.choices[0]?.message?.content ?? "";
  } else {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.agent.model,
        max_tokens: args.agent.maxTokens ?? 200,
        temperature: args.agent.temperature ?? 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = json.content.find((b) => b.type === "text");
    text = textBlock?.text ?? "";
  }

  // Extract JSON from text (handle code fences if any)
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { matches: false, reasoning: `no JSON: ${text.slice(0, 100)}` };
  try {
    const j = JSON.parse(m[0]) as { matches?: boolean; reasoning?: string };
    return {
      matches: j.matches === true,
      reasoning: j.reasoning ?? "",
    };
  } catch {
    return { matches: false, reasoning: `parse failed: ${text.slice(0, 100)}` };
  }
}