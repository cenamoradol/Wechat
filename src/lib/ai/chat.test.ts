// ponytail: buildChatHistory replaces 4 copies of the same buggy history
// fetch — taking the FIRST 20 messages silenced the customer's last
// question in long threads, causing the model to freestyle ("haha", "ok").
// These tests lock the new contract: always the LAST N, and the inbound
// we want to reply to is appended if the window excluded it.

import { describe, expect, it } from "vitest";
import { buildChatHistory } from "./chat";

function inbound(text: string) {
  return { direction: "in" as const, text };
}
function outbound(text: string) {
  return { direction: "out" as const, text };
}

describe("buildChatHistory", () => {
  it("returns messages in the order received (oldest -> newest)", () => {
    const msgs = [inbound("hola"), outbound("buenas"), inbound("precio?")];
    const out = buildChatHistory(msgs, 20);
    expect(out).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "buenas" },
      { role: "user", content: "precio?" },
    ]);
  });

  it("keeps the LAST N messages when there are more than N total", () => {
    const msgs: Array<ReturnType<typeof inbound>> = [];
    for (let i = 0; i < 50; i++) msgs.push(inbound(`msg ${i}`));
    const out = buildChatHistory(msgs, 20);
    expect(out).toHaveLength(20);
    expect(out[0]!.content).toBe("msg 30");
    expect(out[out.length - 1]!.content).toBe("msg 49");
  });

  it("appends currentInbound when the window excluded it", () => {
    // 50 messages, the last is the customer's question. With limit 20 we
    // get msgs[30..49]; the LAST inbound in the window is msg 49 (the
    // current one), so the helper must NOT duplicate it.
    const msgs: Array<ReturnType<typeof inbound>> = [];
    for (let i = 0; i < 50; i++) msgs.push(inbound(`msg ${i}`));
    const out = buildChatHistory(msgs, 20, "msg 49");
    expect(out[out.length - 1]).toEqual({ role: "user", content: "msg 49" });
    expect(out.filter((m) => m.content === "msg 49")).toHaveLength(1);
  });

  it("appends currentInbound when it is NOT in the returned window", () => {
    // Outbound burst in the middle: window takes msgs 30..49, but the
    // customer's actual question ("¿Y en cuotas?") arrived AFTER the last
    // message we have on file — e.g. the webhook wrote it after the snapshot.
    const msgs: Array<{ direction: "in" | "out"; text: string }> = [];
    for (let i = 0; i < 50; i++) msgs.push(outbound(`bot ${i}`));
    const out = buildChatHistory(msgs, 20, "¿Y en cuotas?");
    expect(out[out.length - 1]).toEqual({ role: "user", content: "¿Y en cuotas?" });
  });

  it("does NOT append when currentInbound is null or empty", () => {
    const msgs = [inbound("hola"), outbound("buenas")];
    expect(buildChatHistory(msgs, 20, null)).toHaveLength(2);
    expect(buildChatHistory(msgs, 20, "")).toHaveLength(2);
    expect(buildChatHistory(msgs, 20, "   ")).toHaveLength(2);
  });

  it("defaults to inbound->user, outbound->assistant regardless of who sent it", () => {
    // We intentionally do NOT distinguish a human agent from the AI on the
    // wire — both are direction=out for the recipient. This is the project's
    // existing simplification (matches the pre-refactor behavior).
    const msgs = [inbound("a"), outbound("b")];
    expect(buildChatHistory(msgs, 20)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });

  it("coerces null text to empty string so the LLM never sees 'null'", () => {
    const msgs = [{ direction: "in" as const, text: null }, outbound("hola")];
    expect(buildChatHistory(msgs, 20)).toEqual([
      { role: "user", content: "" },
      { role: "assistant", content: "hola" },
    ]);
  });
});