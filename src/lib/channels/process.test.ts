import { expect, it, vi } from "vitest";

const { evaluateTriggers, createAdminClient } = vi.hoisted(() => ({
  evaluateTriggers: vi.fn().mockResolvedValue(1),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/automations/engine", () => ({ evaluateTriggers }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { processInbound } from "./process";

it("runs automations once when a message arrives twice via polling/webhook", async () => {
  let insertCount = 0;
  const upsertMessage = vi.fn();
  const from = (table: string) => {
    const result = table === "channels" ? { data: { id: "channel", workspace_id: "workspace" } }
      : table === "contacts" ? { data: { id: "contact" } }
      : table === "contact_channels" ? { data: { id: "contact-channel" } }
      : table === "conversations" ? { data: { id: "conversation", archived_at: null } }
      : { data: null };
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "upsert", "insert", "update", "order"])
      query[method] = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => result);
    query.single = vi.fn(async () => result);
    if (table === "messages") {
      query.upsert = vi.fn((...args: unknown[]) => { upsertMessage(...args); return query; });
      query.select = vi.fn(async () => ({ data: ++insertCount === 1 ? [{ id: "message" }] : [], error: null }));
    }
    return query;
  };
  createAdminClient.mockReturnValue({ from, rpc: vi.fn().mockResolvedValue({}) });
  const message = {
    channelType: "facebook" as const,
    channelExternalId: "page",
    contactExternalId: "sender",
    messageExternalId: "same-mid",
    direction: "in" as const,
    type: "text" as const,
    text: "Hola",
    timestamp: new Date(),
    raw: {},
  };
  await processInbound(message);
  await processInbound(message);
  expect(upsertMessage).toHaveBeenCalledWith(expect.objectContaining({ external_id: "same-mid" }), {
    onConflict: "conversation_id,external_id",
    ignoreDuplicates: true,
  });
  expect(evaluateTriggers).toHaveBeenCalledTimes(1);
});
