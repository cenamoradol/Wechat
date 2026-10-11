// src/lib/ai/handoff.ts
// Logic to decide when the AI should hand the conversation to a human.

import type { AIAgent } from "./types";

type RecentMessage = { direction: "in" | "out"; text: string | null; sent_by: string | null };

export function shouldHandoff(
  agent: AIAgent,
  recentMessages: RecentMessage[],
): { handoff: boolean; reason: string } {
  const lastUser = [...recentMessages].reverse().find((m) => m.direction === "in");
  if (!lastUser) return { handoff: true, reason: "no_inbound" };

  const text = (lastUser.text ?? "").toLowerCase();
  for (const kw of agent.handoffKeywords) {
    if (kw && text.includes(kw.toLowerCase())) {
      return { handoff: true, reason: `keyword: ${kw}` };
    }
  }
  const aiReplies = recentMessages.filter(
    (m) => m.direction === "out" && m.sent_by === null,
  ).length;
  if (aiReplies >= agent.maxRepliesPerConversation) {
    return { handoff: true, reason: "max_replies_reached" };
  }
  return { handoff: false, reason: "" };
}