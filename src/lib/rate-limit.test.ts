import { describe, it, expect, vi } from "vitest";
import { rateLimit, getClientIp, limits } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const r = rateLimit("k1", 3, 60_000);
    expect(r).toEqual({ ok: true, remaining: 2, resetIn: 60_000 });
  });

  it("decrements remaining on each call within the window", () => {
    rateLimit("k2", 3, 60_000);
    rateLimit("k2", 3, 60_000);
    const third = rateLimit("k2", 3, 60_000);
    expect(third.remaining).toBe(0);
  });

  it("blocks once the limit is reached", () => {
    rateLimit("k3", 1, 60_000);
    const blocked = rateLimit("k3", 1, 60_000);
    expect(blocked).toEqual({ ok: false, remaining: 0, resetIn: expect.any(Number) });
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      rateLimit("k4", 1, 1000);
      expect(rateLimit("k4", 1, 1000).ok).toBe(false);
      vi.advanceTimersByTime(1500);
      const after = rateLimit("k4", 1, 1000);
      expect(after.ok).toBe(true);
      expect(after.remaining).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("isolates buckets by key", () => {
    rateLimit("k5", 1, 60_000);
    // Different key — fresh bucket
    expect(rateLimit("k6", 1, 60_000).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const h = new Headers({
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
      "x-real-ip": "5.6.7.8",
    });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "5.6.7.8" });
    expect(getClientIp(h)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("limits presets", () => {
  it("login limit is 5 per 15 min", () => {
    const r = limits.login("test-ip-login");
    expect(r.remaining).toBe(4);
  });

  it("signup limit is 3 per hour", () => {
    const r = limits.signup("test-ip-signup");
    expect(r.remaining).toBe(2);
  });

  it("forgot limit is 3 per hour", () => {
    const r = limits.forgot("test-ip-forgot");
    expect(r.remaining).toBe(2);
  });
});