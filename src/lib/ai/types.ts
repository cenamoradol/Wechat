// src/lib/ai/types.ts

export type AIProvider = "openai" | "anthropic" | "minimax";

export type AIAgent = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  kbEnabled: boolean;
  autoReplyEnabled: boolean;
  maxRepliesPerConversation: number;
  handoffKeywords: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatUsage = {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
};

export type ChatResult = {
  content: string;
  usage: ChatUsage;
  sources: Array<{ id: string; title: string; snippet: string }>;
};

export type KBDoc = {
  id: string;
  title: string;
  content: string;
  sourceUrl: string | null;
  createdAt: string;
};