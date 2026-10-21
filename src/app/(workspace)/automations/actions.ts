"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { hardValidate } from "@/lib/automations/validate-step";

// ponytail: relax the schema so users can save steps with empty fields
// during editing. Runtime engine validates shape per step. We only check
// the broad shape here.

const StepSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("send_text"), text: z.string().max(4096) }),
    z.object({
      type: z.literal("send_template"),
      templateId: z.string().max(100),
      vars: z.record(z.string(), z.string().max(4096)),
    }),
    z.object({ type: z.literal("add_tag"), tagId: z.string().max(100) }),
    z.object({ type: z.literal("remove_tag"), tagId: z.string().max(100) }),
    z.object({ type: z.literal("set_field"), fieldId: z.string().max(100), value: z.string().max(4096) }),
    z.object({ type: z.literal("wait"), duration: z.string().max(20) }),
    z.object({ type: z.literal("assign_to"), userId: z.string().max(100) }),
    z.object({ type: z.literal("set_status"), status: z.enum(["open", "pending", "closed"]) }),
    z.object({ type: z.literal("close_conversation") }),
    z.object({
      type: z.literal("auto_assign"),
      userIds: z.array(z.string().min(1).max(100)).min(1).max(50),
      maxLoadPerAgent: z.number().int().min(0).max(10000).optional(),
      messageTemplate: z.string().max(1024).optional(),
    }),
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
    z.object({ type: z.literal("ai_reply"), agentId: z.string().max(100), handoffMessage: z.string().max(4096).optional() }),
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
      // ponytail: optional reference vocabulary path (e.g. "vars.brands").
      // The same length / char-class rules as the validator use.
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
      then: z.array(StepSchema),
      else: z.array(StepSchema).optional(),
    }),
    z.object({
      // ponytail: LLM composes the outbound message from ctx.vars +
      // conversation history, then sends via the channel. Same shape
      // as wacrm's llm_draft_message.
      type: z.literal("llm_draft_message"),
      agentId: z.string().max(100),
      prompt: z.string().min(1).max(8000),
    }),
    z.object({
      // ponytail: send one WhatsApp image per item in vars.X[*].Y.
      type: z.literal("send_images"),
      agentId: z.string().max(100),
      imagePath: z.string().min(1).max(500).refine((s) => s.includes("[*]"), "imagePath must contain [*]"),
      caption: z.string().max(2000).optional(),
      maxImages: z.number().int().min(1).max(50).optional(),
    }),
    z.object({
      // ponytail: condition step with 5 subjects + recursive yes/no
      // sub-lists. Mirrors wacrm's condition.
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
      yes: z.array(StepSchema),
      no: z.array(StepSchema),
    }),
  ]),
);

const TriggerSchema = z.union([
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
  z.object({ type: z.literal("schedule"), cron: z.string().min(1).max(100), timezone: z.string().min(1).max(100) }),
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

const AutomationSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  trigger: TriggerSchema,
  steps: z.array(StepSchema).min(0).max(50),
  status: z.enum(["active", "paused", "draft"]),
});

export type AutomationFormData = z.infer<typeof AutomationSchema>;

async function requireMember(role: ("owner" | "admin" | "agent" | "viewer")[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No workspace" as const };
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !role.includes(member.role as "owner" | "admin" | "agent" | "viewer")) {
    return { error: "No tienes permisos" as const };
  }
  return { supabase, user, workspaceId };
}

export async function listAutomationsAction(): Promise<{
  data?: Array<{ id: string; name: string; status: string; run_count: number; last_run_at: string | null; created_at: string }>;
  error?: string;
}> {
  const ctx = await requireMember(["owner", "admin", "agent", "viewer"]);
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("automations")
    .select("id, name, status, run_count, last_run_at, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { data: data ?? [] };
}

export async function getAutomationAction(id: string): Promise<{
  data?: {
    id: string;
    name: string;
    description: string | null;
    trigger: unknown;
    steps: unknown[];
    status: string;
    run_count: number;
    last_run_at: string | null;
    canvas_positions: Record<string, { x: number; y: number }> | null;
  };
  error?: string;
}> {
  const ctx = await requireMember(["owner", "admin", "agent", "viewer"]);
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("automations")
    .select("id, name, description, trigger, steps, status, run_count, last_run_at, canvas_positions")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No encontrada" };
  return { data };
}

export async function listRunsAction(automationId: string, limit = 25): Promise<{
  data?: Array<{
    id: string;
    status: string;
    current_step: number;
    started_at: string;
    completed_at: string | null;
    log: unknown;
  }>;
  error?: string;
}> {
  const ctx = await requireMember(["owner", "admin", "agent", "viewer"]);
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("automation_runs")
    .select("id, status, current_step, started_at, completed_at, log")
    .eq("automation_id", automationId)
    .eq("workspace_id", ctx.workspaceId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message };
  return { data: data ?? [] };
}

export async function createAutomationAction(input: AutomationFormData): Promise<{ id?: string; error?: string }> {
  const parsed = AutomationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const hardErr = hardValidate(parsed.data);
  if (hardErr) return { error: hardErr };
  const ctx = await requireMember(["owner", "admin", "agent"]);
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase
    .from("automations")
    .insert({
      workspace_id: ctx.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      trigger: parsed.data.trigger,
      steps: parsed.data.steps,
      status: parsed.data.status,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/automations");
  return { id: data.id };
}

export async function updateAutomationAction(
  id: string,
  input: AutomationFormData,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = AutomationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const hardErr = hardValidate(parsed.data);
  if (hardErr) return { error: hardErr };
  const ctx = await requireMember(["owner", "admin", "agent"]);
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("automations")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      trigger: parsed.data.trigger,
      steps: parsed.data.steps,
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return { ok: true };
}

export async function saveCanvasPositionsAction(
  id: string,
  positions: Record<string, { x: number; y: number }>,
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireMember(["owner", "admin", "agent"]);
  if ("error" in ctx) return { error: ctx.error };
  // ponytail: server-side clamp + cap to keep a malicious payload from
  // blowing the row. Keys are step types ("send_text" etc.) so 200
  // distinct positions is more than enough.
  const clean: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(positions).slice(0, 200)) {
    if (typeof v?.x === "number" && typeof v?.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y)) {
      clean[k] = { x: Math.round(v.x), y: Math.round(v.y) };
    }
  }
  const { error } = await ctx.supabase
    .from("automations")
    .update({ canvas_positions: clean, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteAutomationAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireMember(["owner", "admin", "agent"]);
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("automations").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/automations");
  return { ok: true };
}

export async function toggleAutomationAction(id: string, status: "active" | "paused" | "draft"): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireMember(["owner", "admin", "agent"]);
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("automations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return { ok: true };
}