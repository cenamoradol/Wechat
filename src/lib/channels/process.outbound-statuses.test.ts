// ponytail: regression — processOutboundStatuses used to throw RangeError
// when Meta sent a "read" status with timestamp as an unparseable string
// or undefined. The webhooks log surfaced the crash on every WhatsApp
// delivery event for the past N weeks.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capturedUpdates: Array<{ match: { external_id: string; direction: string }; patch: Record<string, unknown> }> = [];
const adminMock = {
  from: (table: string) => {
    const query: Record<string, unknown> & { then?: unknown } = {};
    for (const m of ["select", "eq", "update"]) {
      query[m] = vi.fn((arg: unknown) => {
        if (m === "update") {
          return {
            eq: vi.fn((_col: string, val: unknown) => ({
              eq: vi.fn((_col2: string, dir: string) => {
                capturedUpdates.push({
                  match: { external_id: String(val), direction: dir },
                  patch: arg as Record<string, unknown>,
                });
                return { select: vi.fn(() => Promise.resolve({ data: [{ id: "m1" }], error: null })) };
              }),
            })),
          };
        }
        return query;
      });
    }
    query.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);
    return query;
  },
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminMock }));

import { processOutboundStatuses } from "./process";

beforeEach(() => capturedUpdates.length = 0);
afterEach(() => vi.restoreAllMocks());

describe("processOutboundStatuses — invalid timestamp", () => {
  it("does NOT crash when read status has undefined timestamp; falls back to status=read only", async () => {
    await expect(
      processOutboundStatuses("whatsapp", {
        statuses: [{ id: "wamid.ABC", status: "read" }],
      }),
    ).resolves.toBeUndefined();
    expect(capturedUpdates).toHaveLength(1);
    // No read_at was set because the timestamp wasn't trustworthy.
    expect(capturedUpdates[0].patch.status).toBe("read");
    expect(capturedUpdates[0].patch).not.toHaveProperty("read_at");
  });

  it("handles unparseable string timestamps without throwing", async () => {
    await expect(
      processOutboundStatuses("whatsapp", {
        statuses: [{ id: "wamid.X", status: "read", timestamp: "not-a-date-at-all" }],
      }),
    ).resolves.toBeUndefined();
    expect(capturedUpdates).toHaveLength(1);
    expect(capturedUpdates[0].patch.status).toBe("read");
  });

  it("treats epoch seconds < 1e12 as seconds (not ms) — common Meta shape", async () => {
    // 1_700_000_000 (Nov 2023) as seconds.
    await processOutboundStatuses("whatsapp", {
      statuses: [{ id: "wamid.Y", status: "read", timestamp: 1_700_000_000 }],
    });
    expect(capturedUpdates[0].patch.read_at).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("treats epoch ms (>= 1e12) as ms directly", async () => {
    const ms = 1_700_000_000_000; // already in ms
    await processOutboundStatuses("whatsapp", {
      statuses: [{ id: "wamid.Z", status: "read", timestamp: ms }],
    });
    expect(capturedUpdates[0].patch.read_at).toBe(new Date(ms).toISOString());
  });

  it("still updates status=delivered without needing a timestamp", async () => {
    await processOutboundStatuses("facebook", {
      statuses: [{ id: "mid.X", status: "delivered" }],
    });
    expect(capturedUpdates).toHaveLength(1);
    expect(capturedUpdates[0].patch).toEqual({ status: "delivered" });
  });

  it("skips status rows missing id or status entirely", async () => {
    await processOutboundStatuses("instagram", {
      statuses: [
        { status: "read" }, // no id
        { id: "mid.1" }, // no status
      ],
    });
    expect(capturedUpdates).toHaveLength(0);
  });
});