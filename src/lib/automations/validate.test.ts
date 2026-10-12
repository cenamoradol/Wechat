import { describe, expect, it } from "vitest";
import { validateStepsForActivation, validateTriggerForActivation } from "@/lib/automations/validate";
import type { Step, Trigger } from "@/lib/automations/types";

describe("validateStepsForActivation", () => {
  it("rejects empty step list", () => {
    const issues = validateStepsForActivation([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("steps");
  });

  it("accepts a valid send_text", () => {
    const issues = validateStepsForActivation([{ type: "send_text", text: "Hola" }]);
    expect(issues).toEqual([]);
  });

  it("flags empty send_text", () => {
    const issues = validateStepsForActivation([{ type: "send_text", text: "  " }]);
    expect(issues.some((i) => i.path === "steps[0].text")).toBe(true);
  });

  it("flags add_tag without tagId", () => {
    const issues = validateStepsForActivation([{ type: "add_tag", tagId: "" }]);
    expect(issues.some((i) => i.path === "steps[0].tagId")).toBe(true);
  });

  it("validates wait duration format", () => {
    const good: Step[] = [{ type: "wait", duration: "5m" }];
    expect(validateStepsForActivation(good)).toEqual([]);
    const bad: Step[] = [{ type: "wait", duration: "five" }];
    expect(validateStepsForActivation(bad).some((i) => i.path === "steps[0].duration")).toBe(true);
  });

  it("validates webhook URL", () => {
    const bad: Step[] = [{ type: "webhook", url: "not a url", method: "GET" }];
    const issues = validateStepsForActivation(bad);
    expect(issues.some((i) => i.path === "steps[0].url")).toBe(true);
  });

  it("validates ai_extract fields", () => {
    const noFields: Step[] = [
      { type: "ai_extract", agentId: "a", instruction: "extract", fields: [] },
    ];
    const issues = validateStepsForActivation(noFields);
    expect(issues.some((i) => i.path === "steps[0].fields")).toBe(true);
  });

  it("flags oversized referencePath", () => {
    const big = "a".repeat(250);
    const step: Step = {
      type: "ai_extract",
      agentId: "a",
      instruction: "x",
      fields: [{ name: "x", type: "string" }],
      referencePath: big,
    };
    const issues = validateStepsForActivation([step]);
    expect(issues.some((i) => i.path === "steps[0].referencePath")).toBe(true);
  });

  it("flags send_images without [*] wildcard", () => {
    const step: Step = {
      type: "send_images",
      agentId: "a",
      imagePath: "vars.results",
    };
    const issues = validateStepsForActivation([step]);
    expect(issues.some((i) => i.path === "steps[0].imagePath")).toBe(true);
  });

  it("walks into branch then/else sub-steps", () => {
    const step: Step = {
      type: "branch",
      if: { field: "channel", operator: "equals", value: "whatsapp" },
      then: [{ type: "send_text", text: "" }],
      else: [{ type: "add_tag", tagId: "" }],
    };
    const issues = validateStepsForActivation([step]);
    expect(issues.some((i) => i.path.startsWith("steps[0].then."))).toBe(true);
    expect(issues.some((i) => i.path.startsWith("steps[0].else."))).toBe(true);
  });

  it("walks into condition yes/no sub-steps", () => {
    const step: Step = {
      type: "condition",
      subject: "vars_value",
      operand: "vars.response",
      yes: [{ type: "send_text", text: "" }],
      no: [],
    };
    const issues = validateStepsForActivation([step]);
    expect(issues.some((i) => i.path.startsWith("steps[0].yes."))).toBe(true);
  });
});

describe("validateTriggerForActivation", () => {
  it("rejects keyword_match with empty value", () => {
    const trigger: Trigger = {
      type: "message_received",
      channel: "any",
      match: "contains",
      value: "",
    };
    const issues = validateTriggerForActivation(trigger);
    expect(issues.some((i) => i.path === "trigger.value")).toBe(true);
  });

  it("accepts message_received with match: any", () => {
    const trigger: Trigger = {
      type: "message_received",
      channel: "any",
      match: "any",
      value: "",
    };
    expect(validateTriggerForActivation(trigger)).toEqual([]);
  });

  it("rejects tag_added with empty tagId", () => {
    const trigger: Trigger = { type: "tag_added", tagId: "" };
    const issues = validateTriggerForActivation(trigger);
    expect(issues.some((i) => i.path === "trigger.tagId")).toBe(true);
  });

  it("rejects ai_classify with empty criteria", () => {
    const trigger: Trigger = { type: "ai_classify", agentId: "a", criteria: "" };
    const issues = validateTriggerForActivation(trigger);
    expect(issues.some((i) => i.path === "trigger.criteria")).toBe(true);
  });

  it("rejects llm_condition with empty conditionPrompt", () => {
    const trigger: Trigger = { type: "llm_condition", agentId: "a", conditionPrompt: "  " };
    const issues = validateTriggerForActivation(trigger);
    expect(issues.some((i) => i.path === "trigger.conditionPrompt")).toBe(true);
  });
});
