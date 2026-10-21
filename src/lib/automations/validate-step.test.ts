// ponytail: regression for the bug a user hit — the server-side switch in
// actions.ts had a `default` branch that rejected "auto_assign" with
// "tipo desconocido". The fix moved the switch to this module so it can
// be unit-tested AND so adding a new step type is one place instead of
// two (zod schema + the runtime validateStep).

import { describe, expect, it } from "vitest";
import { hardValidate, validateStep } from "./validate-step";

describe("validateStep — auto_assign", () => {
  it("accepts a step with a non-empty pool", () => {
    expect(
      validateStep({ type: "auto_assign", userIds: ["u1"] }),
    ).toBeNull();
  });

  it("rejects an empty pool", () => {
    expect(validateStep({ type: "auto_assign", userIds: [] })).toBe(
      "selecciona al menos un agente",
    );
  });

  it("rejects when userIds is missing", () => {
    expect(validateStep({ type: "auto_assign" })).toBe(
      "selecciona al menos un agente",
    );
  });

  it("accepts a missing optional messageTemplate", () => {
    expect(
      validateStep({ type: "auto_assign", userIds: ["u1"] }),
    ).toBeNull();
  });

  it("accepts a templated message under the size cap", () => {
    expect(
      validateStep({
        type: "auto_assign",
        userIds: ["u1"],
        messageTemplate: "Hola {{agent.name}}",
      }),
    ).toBeNull();
  });

  it("rejects a messageTemplate over 1024 chars", () => {
    expect(
      validateStep({
        type: "auto_assign",
        userIds: ["u1"],
        messageTemplate: "x".repeat(1025),
      }),
    ).toBe("messageTemplate debe tener 1024 caracteres o menos");
  });

  it("returns the legacy 'tipo desconocido' message for a truly unknown step", () => {
    // ponytail: keeps the explicit default-arm behavior so the UI can show
    // a recognizable message if a saved automation loses a step type after
    // an unsynced deploy.
    expect(validateStep({ type: "hyper_send" })).toBe(
      "tipo desconocido: hyper_send",
    );
  });
});

describe("hardValidate", () => {
  it("stamps each step with its index when it fails", () => {
    const err = hardValidate({
      name: "Test",
      steps: [
        { type: "send_text", text: "ok" },
        { type: "auto_assign", userIds: [] }, // empty pool
      ],
    });
    expect(err).toBe("Step #2 (auto_assign): selecciona al menos un agente");
  });

  it("returns null when every step passes", () => {
    expect(
      hardValidate({
        name: "Test",
        steps: [
          { type: "send_text", text: "hola" },
          { type: "auto_assign", userIds: ["u1"], messageTemplate: "Hola {{agent.name}}" },
        ],
      }),
    ).toBeNull();
  });

  it("returns null for an empty step list", () => {
    expect(hardValidate({ name: "Test", steps: [] })).toBeNull();
  });

  it("rejects empty automation name", () => {
    expect(
      hardValidate({
        name: "   ",
        steps: [{ type: "auto_assign", userIds: ["u1"] }],
      }),
    ).toBe("El nombre es obligatorio");
  });
});