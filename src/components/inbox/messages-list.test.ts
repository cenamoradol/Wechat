import { describe, expect, it } from "vitest";
import { getSenderLabel } from "./messages-list";

// Who the bubble claims to be. Precedence matters: a human profile always wins
// over sent_by_label, and an unlabeled non-human sender stays anonymous rather
// than falling back to something misleading.
describe("getSenderLabel", () => {
  const base = {
    id: "m1",
    direction: "out" as const,
    type: "text",
    text: "hola",
    status: "sent",
    created_at: "2026-10-18T12:00:00Z",
  };

  it("returns nothing for inbound messages", () => {
    expect(
      getSenderLabel({
        ...base,
        direction: "in",
        profiles: { full_name: "Ana", email: "ana@x.com" },
      }),
    ).toBeNull();
  });

  it("prefers the human profile full name", () => {
    expect(
      getSenderLabel({
        ...base,
        sent_by: "u1",
        sent_by_label: "Asistente IA",
        profiles: { full_name: "Ana", email: "ana@x.com" },
      }),
    ).toBe("Ana");
  });

  it("falls back to the email local part when the profile has no name", () => {
    expect(
      getSenderLabel({
        ...base,
        sent_by: "u1",
        profiles: { full_name: null, email: "carlos@x.com" },
      }),
    ).toBe("carlos");
  });

  it("uses sent_by_label when nobody human pressed send", () => {
    expect(getSenderLabel({ ...base, sent_by: null, sent_by_label: "Agente de Ventas" })).toBe(
      "Agente de Ventas",
    );
  });

  it("returns null for legacy rows with no sender at all", () => {
    expect(getSenderLabel({ ...base, sent_by: null, sent_by_label: null })).toBeNull();
  });
});
