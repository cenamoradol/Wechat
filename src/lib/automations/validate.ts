// src/lib/automations/validate.ts
// ponytail: pre-flight validation for automations about to be activated.
// Activating a broken automation (e.g. an add_tag step with tag_id="")
// used to succeed silently — every trigger then produced a failed log row
// with a cryptic "add_tag needs contact + tag_id" message. This module
// lets the action refuse activation with a useful 400 response instead.
// Mirrors wacrm's validate.ts.

import type { Step, Trigger } from "./types";

export interface ValidationIssue {
  /** Dot-path for the UI to highlight; stable enough to build a table. */
  path: string;
  message: string;
}

export function validateStepsForActivation(steps: Step[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(steps) || steps.length === 0) {
    issues.push({
      path: "steps",
      message: "active automations need at least one step",
    });
    return issues;
  }
  walk(steps, "", issues);
  return issues;
}

function walk(steps: Step[], prefix: string, issues: ValidationIssue[]): void {
  steps.forEach((s, i) => {
    const path = `${prefix}steps[${i}]`;
    validateOne(s, path, issues);
    if (s.type === "branch") {
      walk(s.then, `${path}.then.`, issues);
      if (s.else) walk(s.else, `${path}.else.`, issues);
    } else if (s.type === "condition") {
      walk(s.yes, `${path}.yes.`, issues);
      walk(s.no, `${path}.no.`, issues);
    }
  });
}

function validateOne(step: Step, path: string, issues: ValidationIssue[]): void {
  switch (step.type) {
    case "send_text":
      if (!nonEmpty(step.text)) {
        issues.push({ path: `${path}.text`, message: "message text is required" });
      }
      break;
    case "send_template":
      if (!nonEmpty(step.templateId)) {
        issues.push({ path: `${path}.templateId`, message: "template is required" });
      }
      break;
    case "add_tag":
    case "remove_tag":
      if (!nonEmpty(step.tagId)) {
        issues.push({ path: `${path}.tagId`, message: "tag is required" });
      }
      break;
    case "set_field":
      if (!nonEmpty(step.fieldId)) {
        issues.push({ path: `${path}.fieldId`, message: "field is required" });
      }
      if (step.value === undefined || step.value === null || step.value === "") {
        issues.push({ path: `${path}.value`, message: "field value is required" });
      }
      break;
    case "wait":
      if (!/^\d+\s*[smhd]$/i.test(step.duration)) {
        issues.push({ path: `${path}.duration`, message: "duration must be like 5m, 30m, 1h, 1d" });
      }
      break;
    case "assign_to":
      if (!nonEmpty(step.userId)) {
        issues.push({ path: `${path}.userId`, message: "user is required" });
      }
      break;
    case "set_status":
    case "close_conversation":
      break;
    case "webhook":
      if (!nonEmpty(step.url)) {
        issues.push({ path: `${path}.url`, message: "webhook URL is required" });
        break;
      }
      try {
        const u = new URL(step.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          issues.push({ path: `${path}.url`, message: "webhook URL must use http or https" });
        }
      } catch {
        issues.push({ path: `${path}.url`, message: "webhook URL is not valid" });
      }
      break;
    case "ai_reply":
      if (!nonEmpty(step.agentId)) {
        issues.push({ path: `${path}.agentId`, message: "AI agent is required" });
      }
      break;
    case "ai_extract":
      if (!nonEmpty(step.agentId)) {
        issues.push({ path: `${path}.agentId`, message: "AI agent is required" });
      }
      if (!nonEmpty(step.instruction)) {
        issues.push({ path: `${path}.instruction`, message: "instruction is required" });
      }
      if (!Array.isArray(step.fields) || step.fields.length === 0) {
        issues.push({ path: `${path}.fields`, message: "at least one field is required" });
      } else {
        const allowed = new Set(["string", "number", "boolean"]);
        for (const f of step.fields) {
          if (!nonEmpty(f.name)) {
            issues.push({ path: `${path}.fields`, message: "field name is required" });
            break;
          }
          if (!allowed.has(f.type)) {
            issues.push({
              path: `${path}.fields.${f.name}`,
              message: `field type must be one of: ${[...allowed].join(", ")}`,
            });
          }
        }
      }
      if (nonEmpty(step.referencePath)) {
        const rp = step.referencePath as string;
        if (rp.length > 200) {
          issues.push({
            path: `${path}.referencePath`,
            message: "referencePath must be 200 characters or less",
          });
        } else if (/[\r\n;]/.test(rp)) {
          issues.push({
            path: `${path}.referencePath`,
            message: "referencePath cannot contain newlines or semicolons",
          });
        }
      }
      break;
    case "branch":
      // branch.if is the legacy shape; we just check the value field is present
      if (!step.if.value) {
        issues.push({ path: `${path}.if.value`, message: "branch condition value is required" });
      }
      break;
    case "llm_draft_message":
      if (!nonEmpty(step.agentId)) {
        issues.push({ path: `${path}.agentId`, message: "AI agent is required" });
      }
      if (!nonEmpty(step.prompt)) {
        issues.push({ path: `${path}.prompt`, message: "LLM prompt is required" });
      }
      break;
    case "send_images":
      if (!nonEmpty(step.imagePath)) {
        issues.push({
          path: `${path}.imagePath`,
          message: "imagePath is required (use vars.X[*].Y to iterate)",
        });
      } else if (!step.imagePath.includes("[*]")) {
        issues.push({
          path: `${path}.imagePath`,
          message: "imagePath must contain a [*] wildcard",
        });
      }
      if (step.maxImages !== undefined && (typeof step.maxImages !== "number" || step.maxImages < 1)) {
        issues.push({
          path: `${path}.maxImages`,
          message: "maxImages must be a positive number",
        });
      }
      break;
    case "condition":
      if (!nonEmpty(step.subject)) {
        issues.push({ path: `${path}.subject`, message: "condition subject is required" });
      }
      if (step.subject === "vars_value") {
        const validOps = [
          "is_empty",
          "is_not_empty",
          "equals",
          "not_equals",
          "contains",
        ];
        if (step.operator != null && !validOps.includes(step.operator)) {
          issues.push({
            path: `${path}.operator`,
            message: `vars_value operator must be one of: ${validOps.join(", ")}`,
          });
        }
        if (
          step.operator != null &&
          ["equals", "not_equals", "contains"].includes(step.operator) &&
          !nonEmpty(step.value)
        ) {
          issues.push({
            path: `${path}.value`,
            message: `vars_value "${step.operator}" requires a non-empty value`,
          });
        }
      }
      if (nonEmpty(step.operand) && (step.operand as string).length > 200) {
        issues.push({
          path: `${path}.operand`,
          message: "operand must be 200 characters or less",
        });
      }
      break;
    case "auto_assign": {
      const ids = Array.isArray(step.userIds) ? step.userIds : [];
      const valid = ids.filter((id) => typeof id === "string" && (id as string).trim() !== "");
      if (valid.length === 0) {
        issues.push({ path: `${path}.userIds`, message: "select at least one agent" });
      }
      const tpl = step.messageTemplate;
      if (tpl != null && (typeof tpl !== "string" || tpl.length > 1024)) {
        issues.push({
          path: `${path}.messageTemplate`,
          message: "messageTemplate must be 1024 characters or less",
        });
      }
      break;
    }
  }
}

export function validateTriggerForActivation(
  trigger: Trigger,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  switch (trigger.type) {
    case "message_received":
      if (trigger.match !== "any" && !nonEmpty(trigger.value)) {
        issues.push({
          path: "trigger.value",
          message: "value is required unless match is 'any'",
        });
      }
      break;
    case "message_unanswered":
      if (!Number.isFinite(trigger.minutes) || trigger.minutes <= 0) {
        issues.push({
          path: "trigger.minutes",
          message: "minutes must be a positive number",
        });
      }
      break;
    case "tag_added":
      if (!nonEmpty(trigger.tagId)) {
        issues.push({ path: "trigger.tagId", message: "tag is required" });
      }
      break;
    case "schedule":
      if (!nonEmpty(trigger.cron) || !nonEmpty(trigger.timezone)) {
        issues.push({
          path: "trigger",
          message: "cron and timezone are required",
        });
      }
      break;
    case "ai_classify":
      if (!nonEmpty(trigger.agentId)) {
        issues.push({ path: "trigger.agentId", message: "AI agent is required" });
      }
      if (!nonEmpty(trigger.criteria)) {
        issues.push({ path: "trigger.criteria", message: "criteria is required" });
      }
      break;
    case "llm_condition":
      if (!nonEmpty(trigger.agentId)) {
        issues.push({ path: "trigger.agentId", message: "AI agent is required" });
      }
      if (!nonEmpty(trigger.conditionPrompt)) {
        issues.push({
          path: "trigger.conditionPrompt",
          message: "condition prompt is required",
        });
      }
      break;
    case "contact_created":
      break;
  }
  return issues;
}

function nonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
