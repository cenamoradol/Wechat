// ponytail: authorization regression suite. Every hole here was a real one —
// a signed-in agent could overwrite another tenant's Meta token by id, evict
// the workspace owner, and mint a brand-new tenant. The admin client bypasses
// RLS, so this gate is the ONLY thing standing between an agent and someone
// else's business.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { getUserMock, activeWorkspaceIdMock, roleState, rowState, rowChecks } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  activeWorkspaceIdMock: vi.fn(),
  roleState: { value: "owner" as string | null },
  rowState: { value: null as { workspace_id: string } | null },
  rowChecks: { count: 0 as number },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      // Real chain: .select(...).eq(c,v).eq(c,v).maybeSingle(). Build a chain
      // that tolerates any number of .eq() calls before maybeSingle().
      const rowFor = () =>
        table === "workspace_members"
          ? roleState.value
            ? { role: roleState.value }
            : null
          : (() => {
              rowChecks.count++;
              return rowState.value;
            })();
      const node: Record<string, unknown> = {};
      node.select = () => node;
      node.eq = () => node;
      node.maybeSingle = () => Promise.resolve({ data: rowFor(), error: null });
      return node;
    },
  }),
}));
vi.mock("@/app/(workspace)/actions", () => ({
  getActiveWorkspaceIdAction: activeWorkspaceIdMock,
}));

import { requireWorkspaceRole, requireRowOwnership } from "./roles";

beforeEach(() => {
  vi.clearAllMocks();
  roleState.value = "owner";
  rowState.value = { workspace_id: "ws-1" };
  rowChecks.count = 0;
  getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.c" } } });
  activeWorkspaceIdMock.mockResolvedValue("ws-1");
});

describe("requireWorkspaceRole", () => {
  it("returns the context for an allowed role", async () => {
    roleState.value = "admin";
    const ctx = await requireWorkspaceRole(["owner", "admin"]);
    expect("error" in ctx).toBe(false);
    if (!("error" in ctx)) {
      expect(ctx.role).toBe("admin");
      expect(ctx.workspaceId).toBe("ws-1");
      expect(ctx.userId).toBe("u1");
    }
  });

  it("rejects an unauthenticated caller", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const ctx = await requireWorkspaceRole(["owner", "admin"]);
    expect(ctx).toEqual({ error: "No has iniciado sesión" });
  });

  it("rejects a caller with no active workspace", async () => {
    activeWorkspaceIdMock.mockResolvedValue(null);
    const ctx = await requireWorkspaceRole(["owner", "admin"]);
    expect("error" in ctx && ctx.error).toMatch(/workspace activo/i);
  });

  it("rejects a non-member (would otherwise slip through as viewer)", async () => {
    roleState.value = null;
    const ctx = await requireWorkspaceRole(["owner", "admin"]);
    expect("error" in ctx && ctx.error).toMatch(/No perteneces/);
  });

  it.each([
    ["agent", ["owner", "admin"]],
    ["viewer", ["owner", "admin"]],
    ["agent", ["owner"]],
    ["admin", ["owner"]],
    ["viewer", ["owner", "admin", "agent"]],
  ])("blocks %s from %j", async (role, allowed) => {
    roleState.value = role;
    const ctx = await requireWorkspaceRole(allowed as never);
    expect(ctx).toHaveProperty("error");
    expect((ctx as { error: string }).error).toContain(role);
  });

  it("admits an agent where agents are allowed (inbox actions)", async () => {
    roleState.value = "agent";
    const ctx = await requireWorkspaceRole(["owner", "admin", "agent"]);
    expect("error" in ctx).toBe(false);
  });

  it("fails closed on an unrecognised role when it is not in the list", async () => {
    roleState.value = "superadmin";
    const ctx = await requireWorkspaceRole(["owner", "admin"]);
    expect(ctx).toHaveProperty("error");
  });
});

describe("requireRowOwnership", () => {
  it("passes when the row belongs to the active workspace", async () => {
    const ctx = await requireRowOwnership(["owner", "admin"], "channels", "ch-1");
    expect("error" in ctx).toBe(false);
  });

  it("blocks a row that belongs to ANOTHER workspace", async () => {
    // The bug this closes: any signed-in user could pass an arbitrary
    // channel id and overwrite that tenant's Meta token.
    rowState.value = { workspace_id: "ws-OTRO" };
    const ctx = await requireRowOwnership(["owner", "admin"], "channels", "ch-ajeno");
    expect(ctx).toHaveProperty("error");
    expect((ctx as { error: string }).error).toMatch(/no pertenece a tu workspace/);
  });

  it("reports a missing row instead of crashing", async () => {
    rowState.value = null;
    const ctx = await requireRowOwnership(["owner", "admin"], "channels", "no-existe");
    expect(ctx).toHaveProperty("error");
    expect((ctx as { error: string }).error).toMatch(/no encontrado/);
  });

  it("checks the role BEFORE touching the row (no data leak on denial)", async () => {
    roleState.value = "agent";
    const ctx = await requireRowOwnership(["owner", "admin"], "channels", "ch-1");
    expect(ctx).toHaveProperty("error");
    expect(rowChecks.count).toBe(0);
  });
});