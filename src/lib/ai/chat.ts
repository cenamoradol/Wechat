// src/lib/ai/chat.ts
// Main chat function. Sends a conversation to the configured provider.

import { getApiKey, touchApiKey, PROVIDER_CONFIG } from "./providers";
import { searchKnowledge } from "./knowledge";
import { extractFirstJsonObject } from "@/lib/automations/steps";
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
  /**
   * ponytail: when true, sets OpenAI's `response_format: json_object`
   * for providers that support it (openai, gemini, openrouter). MiniMax
   * rejects the field, so it's skipped there. Used by ai_extract to
   * force valid JSON output — without it, smaller models often respond
   * in markdown ("- Brand: Toyota") and the downstream JSON.parse fails.
   */
  forceJson?: boolean;
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

  if (args.agent.provider !== "anthropic") {
    const cfg = PROVIDER_CONFIG[args.agent.provider];
    const path = args.agent.provider === "minimax" ? "/v1/chat/completions" : "/chat/completions";
    // ponytail: response_format: json_object is OpenAI-compat. OpenAI,
    // Gemini's OpenAI endpoint, and OpenRouter all honor it. MiniMax
    // rejects it, Anthropic doesn't apply, so we gate on provider.
    const supportsJsonMode = args.forceJson && args.agent.provider !== "minimax";
    const body: Record<string, unknown> = {
      model: args.agent.model,
      temperature: args.agent.temperature,
      max_tokens: args.agent.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...args.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };
    if (supportsJsonMode) body.response_format = { type: "json_object" };
    // TEMP DEBUG (to remove after we diagnose) — print exactly what we send
    // and what the recent-window looks like, so we can verify whether the
    // last inbound message is inside the chat history the model sees.
    console.log("[ai-debug] outbound", args.agent.provider, args.agent.model, "messages_sent=", args.messages.length, "last_user=", args.messages.filter((m) => m.role === "user").slice(-2));
    console.log("[ai-debug] body", JSON.stringify(body).slice(0, 4000));
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${args.agent.provider} ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
      base_resp?: { status_code: number; status_msg: string };
    };
    if (args.agent.provider === "minimax" && json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(`minimax ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
    }
    reply = json.choices[0]?.message?.content ?? "";
    // ponytail: reasoning models (deepseek-v3.1/v4, o-series) put their
    // thinking in `reasoning_content` and the answer in `content`. When
    // max_tokens is too small the budget is burned on thinking, the reply
    // comes back cut off and content is "" — which used to surface as a
    // bare "produced empty text" with no clue why.
    if (!reply.trim()) {
      const choice = json.choices[0] as {
        finish_reason?: string;
        message?: { reasoning_content?: string; reasoning?: string };
      };
      const reasoning =
        choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? "";
      console.error("[ai] empty completion", {
        provider: args.agent.provider,
        model: args.agent.model,
        finish_reason: choice?.finish_reason,
        maxTokens: args.agent.maxTokens,
        tokensOut: json.usage?.completion_tokens ?? 0,
        reasoningChars: reasoning.length,
        reasoningTail: reasoning.slice(-300),
      });
    }
    usage = {
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  } else {
    // Anthropic
    const cfg = PROVIDER_CONFIG.anthropic;
    const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
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
      throw new Error(`anthropic ${res.status}: ${txt.slice(0, 200)}`);
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

  void touchApiKey(args.agent.workspaceId, args.agent.provider);
  return { content: reply, usage, sources };
}

/**
 * Build the message list the LLM sees.
 *
 * `limit = 0` means NO memory: only the message that just arrived. That's the
 * default everywhere in this app because the catalog is volatile — a reply the
 * AI wrote 3 messages ago lists prices that are now stale, and mixing them with
 * the fresh webhook payload makes the model quote dead inventory. Each message
 * is answered from (system prompt + current message + current vars) only.
 *
 * `limit > 0` keeps the LAST N messages (not the first N — taking the first N
 * silently drops the newest question in long threads). Only used if someone
 * explicitly opts back into conversation memory.
 */
export function buildChatHistory(
  rawMsgs: Array<{ direction: "in" | "out"; text: string | null; sent_by?: string | null }>,
  limit: number,
  currentInbound?: string | null,
): AIMessage[] {
  const inbound = currentInbound?.trim() ? currentInbound : null;
  // ponytail: no-memory mode. The system prompt already occupies slot 0 of the
  // provider request (see generateAgentReply), so returning [] here still sends
  // a valid messages array — we never end up with an empty one.
  if (limit <= 0) return inbound ? [{ role: "user", content: inbound }] : [];

  const tail = rawMsgs.length > limit ? rawMsgs.slice(-limit) : rawMsgs.slice();
  const out: AIMessage[] = tail.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text ?? "",
  }));
  if (inbound) {
    const last = tail[tail.length - 1];
    const alreadyLastInbound =
      last && last.direction === "in" && (last.text ?? "") === inbound;
    if (!alreadyLastInbound) out.push({ role: "user", content: inbound });
  }
  return out;
}

/**
 * AI classifier for the `ai_classify` trigger. Returns true if the
 * message matches the given criteria according to the LLM.
 */
export async function classifyMessage(args: {
  agent: { id: string; workspaceId: string; provider: AIAgent["provider"]; model: string; temperature?: number; maxTokens?: number };
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
  if (args.agent.provider !== "anthropic") {
    const cfg = PROVIDER_CONFIG[args.agent.provider];
    const path = args.agent.provider === "minimax" ? "/v1/chat/completions" : "/chat/completions";
    const body: Record<string, unknown> = {
      model: args.agent.model,
      temperature: args.agent.temperature ?? 0,
      max_tokens: args.agent.maxTokens ?? 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    // ponytail: response_format: json_object is OpenAI-specific. MiniMax rejects it.
    if (args.agent.provider === "openai") body.response_format = { type: "json_object" };
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${args.agent.provider} ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      base_resp?: { status_code: number; status_msg: string };
    };
    if (args.agent.provider === "minimax" && json.base_resp?.status_code && json.base_resp.status_code !== 0) {
      throw new Error(`minimax ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
    }
    text = json.choices[0]?.message?.content ?? "";
  } else {
    // Anthropic
    const cfg = PROVIDER_CONFIG.anthropic;
    const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
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
      throw new Error(`anthropic ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = json.content.find((b) => b.type === "text");
    text = textBlock?.text ?? "";
  }

  // TEMP DEBUG (remove once ai_classify is confirmed) — every classification
  // decision, so we can see which automation matched which inbound and why
  // the handoff one didn't fire.
  console.log(
    "[ai-debug] classify",
    JSON.stringify({
      criteria: args.criteria.slice(0, 90),
      message: args.messageText.slice(0, 90),
      raw: text.slice(0, 200),
    }),
  );

  // ponytail: reuse the tolerant extractor from steps.ts. The old greedy
  // regex /\{[\s\S]*\}/ matched from the first "{" to the LAST "}", so any
  // trailing text containing "}" made JSON.parse throw and the caller
  // silently read the classification as matches:false — a lost handoff with
  // no error anywhere.
  const candidate = extractFirstJsonObject(text);
  if (!candidate.includes("{")) {
    return { matches: false, reasoning: `no JSON: ${text.slice(0, 100)}` };
  }
  try {
    const j = JSON.parse(candidate) as { matches?: boolean; reasoning?: string };
    return {
      matches: j.matches === true,
      reasoning: j.reasoning ?? "",
    };
  } catch {
    return { matches: false, reasoning: `parse failed: ${text.slice(0, 100)}` };
  }
}
