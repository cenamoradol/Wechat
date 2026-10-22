// ponytail: the AI hold is the rule that keeps a human's conversation from
// being answered by the bot — and, just as important, the rule that makes it
// expire so a returning customer isn't met with silence.

import { describe, expect, it } from "vitest";
import { AI_HOLD_MS, isHoldActive } from "./assignment";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-10-22T12:00:00.000Z");

describe("isHoldActive", () => {
  it("is false when nobody is assigned", () => {
    expect(isHoldActive({ assigned_to: null, assigned_at: null }, NOW)).toBe(false);
  });

  it("is false when the conversation row is missing", () => {
    expect(isHoldActive(null, NOW)).toBe(false);
    expect(isHoldActive(undefined, NOW)).toBe(false);
  });

  it("holds right after the assignment", () => {
    const assigned_at = new Date(NOW - 60_000).toISOString();
    expect(isHoldActive({ assigned_to: "human-1", assigned_at }, NOW)).toBe(true);
  });

  it("holds just under two hours", () => {
    const assigned_at = new Date(NOW - (AI_HOLD_MS - 1000)).toISOString();
    expect(isHoldActive({ assigned_to: "human-1", assigned_at }, NOW)).toBe(true);
  });

  it("releases exactly at two hours", () => {
    const assigned_at = new Date(NOW - AI_HOLD_MS).toISOString();
    expect(isHoldActive({ assigned_to: "human-1", assigned_at }, NOW)).toBe(false);
  });

  it("releases well after two hours", () => {
    const assigned_at = new Date(NOW - 5 * HOUR).toISOString();
    expect(isHoldActive({ assigned_to: "human-1", assigned_at }, NOW)).toBe(false);
  });

  // The dangerous case: an assignment with no timestamp must not be able to
  // mute the business forever.
  it("treats a legacy row with no assigned_at as expired", () => {
    expect(isHoldActive({ assigned_to: "human-1", assigned_at: null }, NOW)).toBe(false);
  });

  it("treats an unparsable assigned_at as expired", () => {
    expect(isHoldActive({ assigned_to: "human-1", assigned_at: "not-a-date" }, NOW)).toBe(
      false,
    );
  });

  it("holds on a re-assignment (fresh timestamp wins over the old owner)", () => {
    const assigned_at = new Date(NOW - 5 * 60_000).toISOString();
    expect(
      isHoldActive({ assigned_to: "human-2", assigned_at }, NOW),
    ).toBe(true);
  });

  it("uses a two-hour window", () => {
    expect(AI_HOLD_MS).toBe(2 * HOUR);
  });
});