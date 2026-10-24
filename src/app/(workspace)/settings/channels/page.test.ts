// Regression guard for the cross-workspace channel leak.
//
// The channels RLS policy is `workspace_id in (user_workspace_ids())` — i.e.
// "every workspace I belong to", not "the active workspace". So a read that
// forgets the explicit filter silently returns another tenant's channels:
// switching workspaces looked like it changed nothing.
//
// The page is a Server Component, so calling it runs the data fetching and
// returns the element tree — no rendering needed to assert on the query.

import { describe, expect, it, vi, beforeEach } from "vitest";

const eqCalls: Array<{ table: string; col: string; val: unknown }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => makeBuilder(table),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));

vi.mock("@/app/(workspace)/actions", () => ({
  getActiveWorkspaceIdAction: async () => "ws-active",
}));

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = (col: string, val: unknown) => {
    eqCalls.push({ table, col, val });
    return b;
  };
  b.order = () => b;
  b.limit = () => b;
  b.maybeSingle = async () => ({
    data: table === "workspace_members" ? { role: "owner" } : null,
    error: null,
  });
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(res, rej);
  return b;
}

import ChannelsPage from "./page";

beforeEach(() => {
  eqCalls.length = 0;
});

describe("settings/channels page scoping", () => {
  it("filters the channel list by the active workspace", async () => {
    await ChannelsPage({ searchParams: Promise.resolve({}) });

    const filter = eqCalls.find((c) => c.table === "channels" && c.col === "workspace_id");
    expect(filter).toBeDefined();
    expect(filter!.val).toBe("ws-active");
  });

  it("never queries channels without a workspace filter", async () => {
    await ChannelsPage({ searchParams: Promise.resolve({}) });

    const channelEqs = eqCalls.filter((c) => c.table === "channels");
    expect(channelEqs.length).toBeGreaterThan(0);
    // Exactly one filter, and it is the workspace one — a stray
    // `.select()` without `.eq("workspace_id")` leaks every tenant.
    expect(channelEqs).toHaveLength(1);
  });
});
