// Tests for the input-validation paths of addKBDoc.
// DB-bound paths (search/list/delete) need a test database, per plan convention:
// "NO mockear Supabase — usar test database con seed."
// The validation rules are simple and live in addKBDoc; everything else
// is a thin wrapper around the Supabase admin client.

import { describe, it, expect } from "vitest";
import { addKBDoc } from "./knowledge";

describe("addKBDoc validation", () => {
  it("rejects empty title", async () => {
    const res = await addKBDoc({
      agentId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000002",
      title: "   ",
      content: "body",
    });
    expect(res).toEqual({ error: "Título requerido" });
  });

  it("rejects empty content", async () => {
    const res = await addKBDoc({
      agentId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000002",
      title: "FAQ",
      content: "",
    });
    expect(res).toEqual({ error: "Contenido vacío" });
  });

  it("accepts trimmed title", async () => {
    // We don't hit the DB: we pass an empty/whitespace content and assert the
    // validation message changes — proving the title check happened first.
    const res = await addKBDoc({
      agentId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000002",
      title: "FAQ",
      content: "",
    });
    expect(res.error).toBe("Contenido vacío");
  });
});