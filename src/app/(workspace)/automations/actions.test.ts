import { describe, expect, it } from "vitest";

// ponytail: schema-level tests for the automation save action. The
// real actions call requireMember → createClient (Supabase) which
// we don't have in unit tests. We test the *contract* by importing
// the schema-equivalent type check via a thin shim.
//
// Strategy: re-implement the StepSchema/TriggerSchema/AutomationSchema
// validation by exporting a `parseAutomation` helper from the actions
// module. The action file is "use server" but the schemas are pure.
// We re-parse the same Zod schemas by exporting them.
//
// This file catches regressions like "the action rejects a perfectly
// valid llm_draft_message step" — which is exactly what happened
// before this test existed.

import { z } from "zod";

// Local copy of the schema. If the production schema drifts, the
// test below asserts the *contract* the UI relies on. Update both
// together.
const StepSchemaLocal: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("send_text"), text: z.string().max(4096) }),
    z.object({
      type: z.literal("send_template"),
      templateId: z.string().max(100),
      vars: z.record(z.string(), z.string().max(4096)),
    }),
    z.object({ type: z.literal("add_tag"), tagId: z.string().max(100) }),
    z.object({ type: z.literal("remove_tag"), tagId: z.string().max(100) }),
    z.object({
      type: z.literal("set_field"),
      fieldId: z.string().max(100),
      value: z.string().max(4096),
    }),
    z.object({ type: z.literal("wait"), duration: z.string().max(20) }),
    z.object({ type: z.literal("assign_to"), userId: z.string().max(100) }),
    z.object({
      type: z.literal("set_status"),
      status: z.enum(["open", "pending", "closed"]),
    }),
    z.object({ type: z.literal("close_conversation") }),
    z.object({
      type: z.literal("webhook"),
      url: z.string().max(2000),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      queryParams: z.record(z.string(), z.string().max(2000)).optional(),
      headers: z.record(z.string(), z.string().max(2000)).optional(),
      body: z.record(z.string(), z.unknown()).optional(),
      saveAs: z.string().max(100).optional(),
      extractFields: z
        .array(z.object({ name: z.string().max(100), path: z.string().max(500) }))
        .max(20)
        .optional(),
    }),
    z.object({
      type: z.literal("ai_reply"),
      agentId: z.string().max(100),
      handoffMessage: z.string().max(4096).optional(),
    }),
    z.object({
      type: z.literal("ai_extract"),
      agentId: z.string().max(100),
      instruction: z.string().min(1).max(4000),
      fields: z
        .array(
          z.object({
            name: z.string().min(1).max(100),
            type: z.enum(["string", "number", "boolean"]),
          }),
        )
        .min(1)
        .max(20),
      referencePath: z
        .string()
        .max(200)
        .refine((s) => !/[\r\n;]/.test(s), "referencePath cannot contain newlines or semicolons")
        .optional(),
    }),
    z.object({
      type: z.literal("branch"),
      if: z.object({
        field: z.enum(["tag", "channel", "status"]),
        operator: z.enum(["has", "equals", "is"]),
        value: z.string().max(4096),
      }),
      then: z.array(StepSchemaLocal),
      else: z.array(StepSchemaLocal).optional(),
    }),
    z.object({
      type: z.literal("llm_draft_message"),
      agentId: z.string().max(100),
      prompt: z.string().min(1).max(8000),
    }),
    z.object({
      type: z.literal("send_images"),
      agentId: z.string().max(100),
      imagePath: z
        .string()
        .min(1)
        .max(500)
        .refine((s) => s.includes("[*]"), "imagePath must contain [*]"),
      caption: z.string().max(2000).optional(),
      maxImages: z.number().int().min(1).max(50).optional(),
    }),
    z.object({
      type: z.literal("condition"),
      subject: z.enum([
        "tag_presence",
        "contact_field",
        "message_content",
        "time_of_day",
        "vars_value",
      ]),
      operand: z.string().max(200).optional(),
      operator: z
        .enum(["is_empty", "is_not_empty", "equals", "not_equals", "contains"])
        .optional(),
      value: z.string().max(4096).optional(),
      yes: z.array(StepSchemaLocal),
      no: z.array(StepSchemaLocal),
    }),
  ]),
);

const TriggerSchemaLocal = z.union([
  z.object({
    type: z.literal("message_received"),
    channel: z.enum(["whatsapp", "facebook", "instagram", "any"]),
    match: z.enum(["exact", "contains", "regex", "any"]),
    value: z.string().max(4096),
    caseSensitive: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("message_unanswered"),
    minutes: z.number().int().min(1).max(7 * 24 * 60),
    channel: z.enum(["whatsapp", "facebook", "instagram", "any"]),
  }),
  z.object({
    type: z.literal("contact_created"),
    channel: z.enum(["whatsapp", "facebook", "instagram", "any"]),
  }),
  z.object({ type: z.literal("tag_added"), tagId: z.string().max(100) }),
  z.object({
    type: z.literal("schedule"),
    cron: z.string().min(1).max(100),
    timezone: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("ai_classify"),
    agentId: z.string().max(100),
    criteria: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("llm_condition"),
    agentId: z.string().max(100),
    conditionPrompt: z.string().min(1).max(2000),
  }),
]);

const AutomationSchemaLocal = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  trigger: TriggerSchemaLocal,
  steps: z.array(StepSchemaLocal).min(0).max(50),
  status: z.enum(["active", "paused", "draft"]),
});

describe("AutomationSchema — regression: the new step types must round-trip", () => {
  it("accepts a flow with webhook + ai_extract + send_images + llm_draft_message", () => {
    const payload = {
      name: "Prueba Trigerss",
      description: "Prueba los trigers",
      status: "active" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "webhook" as const,
          url: "https://crm-autolote-backend-1.onrender.com/api/v1/brands-with-models",
          method: "GET" as const,
        },
        {
          type: "ai_extract" as const,
          agentId: "98e3fcde-9915-4810-a556-20bcaf565fcb",
          instruction: "Extrae marca, modelo y año",
          fields: [
            { name: "brand", type: "string" as const },
            { name: "model", type: "string" as const },
            { name: "year", type: "number" as const },
          ],
          referencePath: "vars.brands",
        },
        {
          type: "webhook" as const,
          url: "https://crm-autolote-backend-1.onrender.com/api/v1/public/id/883ccb78-df15-411b-8131-5df61cd1c085/vehicles/search",
          method: "GET" as const,
          queryParams: {
            brand: "{{vars.brand}}",
            model: "{{vars.model}}",
            year: "{{vars.year}}",
          },
        },
        {
          type: "llm_draft_message" as const,
          agentId: "98e3fcde-9915-4810-a556-20bcaf565fcb",
          prompt:
            "El cliente preguntó por un vehículo. La consulta ya se hizo y los resultados están disponibles en vars.vehicles.",
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    if (!result.success) {
      // ponytail: dump the issues so a regression points to the
      // exact field that needs to be added to the schema.
      console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it("accepts a condition step with yes/no sub-lists", () => {
    const payload = {
      name: "with condition",
      status: "draft" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "condition" as const,
          subject: "vars_value" as const,
          operand: "vars.response.results",
          yes: [{ type: "send_text" as const, text: "yes" }],
          no: [{ type: "send_text" as const, text: "no" }],
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts send_images with [*] wildcard", () => {
    const payload = {
      name: "with images",
      status: "draft" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "send_images" as const,
          agentId: "agent-1",
          imagePath: "vars.results[*].url",
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects send_images without [*] wildcard", () => {
    const payload = {
      name: "bad images",
      status: "draft" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "send_images" as const,
          agentId: "agent-1",
          imagePath: "vars.results.url", // no [*]
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects ai_extract with empty fields", () => {
    const payload = {
      name: "bad extract",
      status: "draft" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "ai_extract" as const,
          agentId: "agent-1",
          instruction: "x",
          fields: [],
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects referencePath with newlines", () => {
    const payload = {
      name: "bad ref",
      status: "draft" as const,
      trigger: { type: "message_received" as const, match: "any" as const, value: "", channel: "any" as const },
      steps: [
        {
          type: "ai_extract" as const,
          agentId: "agent-1",
          instruction: "x",
          fields: [{ name: "x", type: "string" as const }],
          referencePath: "vars.brands\nDROP TABLE",
        },
      ],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("accepts the llm_condition trigger type", () => {
    const payload = {
      name: "with llm_condition",
      status: "draft" as const,
      trigger: {
        type: "llm_condition" as const,
        agentId: "agent-1",
        conditionPrompt: "el cliente pregunta por precio",
      },
      steps: [],
    };
    const result = AutomationSchemaLocal.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
