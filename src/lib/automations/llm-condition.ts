// src/lib/automations/llm-condition.ts
// ponytail: LLM-evaluated natural-language condition trigger. The user
// writes the condition ("precio", "hablar con humano", "frustrado") and
// the LLM returns YES/NO. Mirrors wacrm's llm-condition trigger.

import { loadAiConfig } from "./ai-helpers";

export interface EvaluateLlmConditionArgs {
  workspaceId: string;
  agentId: string;
  conditionPrompt: string;
  recentMessage: string;
  conversationSnippet?: string;
}

export interface LlmConditionResult {
  boolean: boolean;
  reasoning?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

export async function evaluateLlmCondition(
  args: EvaluateLlmConditionArgs,
): Promise<LlmConditionResult> {
  const config = await loadAiConfig(args.workspaceId);
  if (!config) {
    throw new Error(
      "LLM condition trigger requires an active AI configuration. Set one up in /settings/ai.",
    );
  }

  const userContent =
    `CONDITION:\n${args.conditionPrompt.trim()}\n\n` +
    (args.conversationSnippet
      ? `RECENT CONVERSATION:\n${args.conversationSnippet.trim()}\n\n`
      : "") +
    `LATEST CUSTOMER MESSAGE:\n${args.recentMessage.trim()}\n\n` +
    `Does the customer's message satisfy the condition? Reply YES or NO on the first line, then optionally a brief one-line explanation. Nothing else.`;

  const { text } = await callLlm(config, {
    systemPrompt:
      "You are a precise condition evaluator. Read the condition and the customer message(s), then decide if the condition is satisfied. Output exactly one line starting with YES or NO, followed optionally by a single short line of reasoning. No preamble, no labels, no quotes.",
    userContent,
  });

  const firstLine = text.trim().split("\n")[0] ?? "";
  const verdict = firstLine.trim().toUpperCase();
  const boolean = verdict.startsWith("YES");
  const rest = text.split("\n").slice(1).join(" ").trim();

  return { boolean, reasoning: rest || undefined };
}

async function callLlm(
  config: Awaited<ReturnType<typeof loadAiConfig>>,
  args: { systemPrompt: string; userContent: string },
): Promise<{ text: string }> {
  if (!config) throw new Error("AI config missing");
  const path = config.provider === "minimax" ? "/v1/chat/completions" : "/chat/completions";
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userContent },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${config.provider} ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    base_resp?: { status_code: number; status_msg: string };
  };
  if (config.provider === "minimax" && json.base_resp?.status_code && json.base_resp.status_code !== 0) {
    throw new Error(`minimax ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  return { text: json.choices[0]?.message?.content ?? "" };
}
