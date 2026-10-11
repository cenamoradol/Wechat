// src/lib/automations/engine.ts
// executeRun(runId): runs all steps in a run, persisting progress to automation_runs.
// evaluateTriggers(event): finds matching automations and enqueues new runs.

import { createAdminClient } from "@/lib/supabase/admin";
import { runStep, decryptChannelToken } from "./steps";
import { matchesTrigger } from "./triggers";
import { parseDuration } from "./types";
import type { RunContext, Step, StepLogEntry, TriggerEvent } from "./types";
import { classifyMessage } from "@/lib/ai/chat";

/**
 * Evaluate all active automations for the workspace and create new runs
 * for those whose trigger matches the event. Called from the webhook
 * handler when a new message arrives, a contact is created, etc.
 */
export async function evaluateTriggers(event: TriggerEvent): Promise<number> {
  // ponytail: For ai_classify triggers, evaluate the LLM first. If the
  // message doesn't match, we skip. We emit a synthetic ai_classify
  // event for each active ai_classify trigger and let matchesTrigger do
  // the rest.
  const admin = createAdminClient();
  const { data: automations, error } = await admin
    .from("automations")
    .select("id, name, workspace_id, trigger")
    .eq("workspace_id", event.workspaceId)
    .eq("status", "active");
  if (error || !automations) {
    console.error("evaluateTriggers: list failed", error);
    return 0;
  }

  let created = 0;
  for (const a of automations) {
    const trigger = a.trigger as { type: string; [k: string]: unknown };

    // For ai_classify, evaluate the LLM first
    if (trigger.type === "ai_classify") {
      if (event.kind !== "message_received" || !event.messageText) continue;
      const t = trigger as { type: "ai_classify"; agentId: string; criteria: string };
      if (!t.agentId || !t.criteria) continue;
      // Look up the agent (we need provider + model)
      const { data: agent } = await admin
        .from("ai_agents")
        .select("id, provider, model, workspace_id")
        .eq("id", t.agentId)
        .maybeSingle();
      if (!agent) continue;
      try {
        const cls = await classifyMessage({
          agent: { id: agent.id, workspaceId: agent.workspace_id, provider: agent.provider as "openai" | "anthropic", model: agent.model },
          messageText: event.messageText,
          criteria: t.criteria,
        });
        if (!cls.matches) continue;
      } catch (e) {
        console.error("ai_classify failed", e);
        continue;
      }
      if (!matchesTrigger(trigger as never, event)) continue;
    } else {
      if (!matchesTrigger(trigger as never, event)) continue;
    }

    const conversationId =
      event.kind === "message_received" || event.kind === "message_unanswered"
        ? event.conversationId
        : null;
    const contactId = event.contactId;
    const triggerData =
      event.kind === "message_received"
        ? { messageText: event.messageText, messageId: event.messageId }
        : {};
    const { data: run, error: rErr } = await admin
      .from("automation_runs")
      .insert({
        automation_id: a.id,
        workspace_id: event.workspaceId,
        conversation_id: conversationId,
        contact_id: contactId,
        status: "pending",
        trigger_data: triggerData,
      })
      .select("id")
      .single();
    if (rErr || !run) {
      console.error("evaluateTriggers: run create failed", rErr);
      continue;
    }
    // Fire-and-forget: the run executes immediately.
    void executeRun(run.id).catch((e) => console.error("executeRun crashed", e));
    created++;
  }
  return created;
}

/**
 * Run all steps of an automation, updating the run row with progress and
 * a log of per-step results. If a `wait` step is hit, the run is paused
 * (status=pending, scheduled_at set) and will be resumed by the cron.
 */
export async function executeRun(runId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: run, error: rErr } = await admin
    .from("automation_runs")
    .select("id, status, current_step, automation_id, conversation_id, contact_id")
    .eq("id", runId)
    .maybeSingle();
  if (rErr || !run) return;
  if (run.status !== "pending") return;

  const ctx = await loadContext(run.automation_id, run.conversation_id, run.contact_id);
  if (!ctx) {
    await markFailed(runId, "Could not load run context");
    return;
  }

  await admin
    .from("automation_runs")
    .update({ status: "running" })
    .eq("id", runId);

  for (let i = run.current_step; i < ctx.automation.steps.length; i++) {
    const step = ctx.automation.steps[i];
    const stepStart = Date.now();
    try {
      const output = await runStep(step, ctx);
      await appendLog(runId, {
        step: i,
        type: step.type,
        status: "ok",
        duration_ms: Date.now() - stepStart,
        output,
      });
      if (step.type === "wait") {
        const ms = (output as { ms: number }).ms;
        await admin
          .from("automation_runs")
          .update({
            current_step: i + 1,
            status: "pending",
            scheduled_at: new Date(Date.now() + ms).toISOString(),
          })
          .eq("id", runId);
        return;
      }
    } catch (e) {
      await appendLog(runId, {
        step: i,
        type: step.type,
        status: "failed",
        duration_ms: Date.now() - stepStart,
        error: e instanceof Error ? e.message : String(e),
      });
      await admin
        .from("automation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      return;
    }
  }
  await admin
    .from("automation_runs")
    .update({ status: "succeeded", completed_at: new Date().toISOString() })
    .eq("id", runId);
}

async function loadContext(
  automationId: string,
  conversationId: string | null,
  contactId: string | null,
): Promise<RunContext | null> {
  const admin = createAdminClient();
  const { data: auto } = await admin
    .from("automations")
    .select("id, name, workspace_id, steps")
    .eq("id", automationId)
    .maybeSingle();
  if (!auto) return null;

  if (!conversationId || !contactId) {
    // Schedule-only automation: not enough context to run.
    return null;
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id, status, assigned_to, contact_channel_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;

  const { data: cc } = await admin
    .from("contact_channels")
    .select("id, external_user_id, contact_id, channel_id, contacts(id, full_name, phone_e164, email), channels(id, type, external_id, access_token_enc)")
    .eq("id", conv.contact_channel_id)
    .maybeSingle();
  if (!cc) return null;

  const channelInfo = (cc as unknown as { channels: { id: string; type: "whatsapp" | "facebook" | "instagram"; external_id: string; access_token_enc: string } | null }).channels;
  const contactInfo = (cc as unknown as { contacts: { id: string; full_name: string | null; phone_e164: string | null; email: string | null } | null }).contacts;
  if (!channelInfo || !contactInfo) return null;

  return {
    automation: {
      id: auto.id,
      name: auto.name,
      workspaceId: auto.workspace_id,
      steps: auto.steps as Step[],
    },
    conversation: {
      id: conv.id,
      status: conv.status,
      assignedTo: conv.assigned_to,
    },
    contact: {
      id: contactInfo.id,
      name: contactInfo.full_name,
      phone: contactInfo.phone_e164,
      email: contactInfo.email,
    },
    contactChannel: {
      id: cc.id,
      externalUserId: cc.external_user_id,
    },
    channel: {
      id: channelInfo.id,
      type: channelInfo.type,
      externalId: channelInfo.external_id,
      accessToken: decryptChannelToken(channelInfo.access_token_enc),
    },
    triggerData: {},
    vars: {},
  };
}

async function appendLog(runId: string, entry: StepLogEntry): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("automation_runs")
    .select("log")
    .eq("id", runId)
    .maybeSingle();
  const current = (row?.log as StepLogEntry[] | null) ?? [];
  await admin
    .from("automation_runs")
    .update({ log: [...current, entry] })
    .eq("id", runId);
}

async function markFailed(runId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("automation_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      log: [{ step: -1, type: "send_text" as Step["type"], status: "failed", duration_ms: 0, error: reason }],
    })
    .eq("id", runId);
}

/**
 * Resume runs whose scheduled_at has passed. Called by the cron.
 */
export async function resumeScheduledRuns(): Promise<number> {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("automation_runs")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(50);
  if (!due || due.length === 0) return 0;
  for (const r of due) {
    void executeRun(r.id).catch((e) => console.error("resumeScheduledRuns crashed", e));
  }
  return due.length;
}