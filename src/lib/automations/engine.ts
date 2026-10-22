// src/lib/automations/engine.ts
// executeRun(runId): runs all steps in a run, persisting progress to automation_runs.
// evaluateTriggers(event): finds matching automations and enqueues new runs.
//
// ponytail: refactored to a recursive `executeStepsFrom` so `branch` and
// `condition` can contain their own sub-step lists. Each call returns the
// number of channel messages it sent, so the webhook can suppress the AI
// auto-reply when an automation already replied. Mirrors wacrm's
// runAutomationsForTrigger + executeStepsFrom shape, adapted to wechat's
// JSON-step schema (no automation_steps table) and the existing
// automation_runs.scheduled_at field for `wait`.

import { createAdminClient } from "@/lib/supabase/admin";
import { runStep, decryptChannelToken, getPath } from "./steps";
import { triggerMatches } from "./triggers";
import { evaluateLlmCondition } from "./llm-condition";
import type { RunContext, Step, StepLogEntry, TriggerEvent } from "./types";
import { classifyMessage } from "@/lib/ai/chat";

export type TriggerDispatchResult = {
  /** Runs created and started for this event. */
  matched: number;
  /**
   * Channel messages sent by the synchronously-visible portion of the
   * dispatch. We can't know the full number without running the engine
   * in-band, so this is currently always 0; callers (process.ts) use
   * `matched > 0` to short-circuit the AI agent. The full count is
   * written into the run log asynchronously by `executeRun`.
   */
  messagesSent: number;
};

/**
 * Evaluate all active automations for the workspace and create new runs
 * for those whose trigger matches the event. Called from the webhook
 * handler when a new message arrives, a contact is created, etc.
 *
 * Must never throw — callers are fire-and-forget from the webhook.
 */
export async function evaluateTriggers(event: TriggerEvent): Promise<TriggerDispatchResult> {
  const admin = createAdminClient();

  // A conversation handed to a human is on-hold: no automation runs. The hold
  // expires after AI_HOLD_MS so a customer who writes again later still gets
  // an answer. Checked before the (paid) listing query so we don't even load
  // the automations. Only conversation-scoped events can be on-hold — a
  // tag_added/contact_created event has no conversation to check.
  const scopedConversationId =
    event.kind === "message_received" || event.kind === "message_unanswered"
      ? event.conversationId
      : null;
  if (scopedConversationId) {
    const { isAiOnHold } = await import("@/lib/channels/assignment");
    if (await isAiOnHold(scopedConversationId)) {
      console.log(
        `[evaluateTriggers] conversation=${scopedConversationId} on hold (human assigned) — no automations run`,
      );
      return { matched: 0, messagesSent: 0 };
    }
  }

  const { data: automations, error } = await admin
    .from("automations")
    .select("id, name, workspace_id, trigger, steps")
    .eq("workspace_id", event.workspaceId)
    .eq("status", "active");
  if (error || !automations) {
    console.error("evaluateTriggers: list failed", error);
    return { matched: 0, messagesSent: 0 };
  }

  let matched = 0;
  for (const a of automations) {
    const trigger = a.trigger as { type: string; [k: string]: unknown };

    let triggers = false;
    if (trigger.type === "ai_classify") {
      if (event.kind !== "message_received" || !event.messageText) continue;
      const t = trigger as { type: "ai_classify"; agentId: string; criteria: string };
      if (!t.agentId || !t.criteria) continue;
      const { data: agent } = await admin
        .from("ai_agents")
        .select("id, provider, model, workspace_id")
        .eq("id", t.agentId)
        .maybeSingle();
      if (!agent) continue;
      try {
        const cls = await classifyMessage({
          agent: { id: agent.id, workspaceId: agent.workspace_id, provider: agent.provider, model: agent.model },
          messageText: event.messageText,
          criteria: t.criteria,
        });
        if (!cls.matches) continue;
        triggers = true;
      } catch (e) {
        console.error("ai_classify failed", e);
        continue;
      }
    } else if (trigger.type === "llm_condition") {
      if (event.kind !== "message_received" || !event.messageText) continue;
      const t = trigger as { type: "llm_condition"; agentId: string; conditionPrompt: string };
      if (!t.agentId || !t.conditionPrompt?.trim()) continue;
      try {
        const verdict = await evaluateLlmCondition({
          workspaceId: event.workspaceId,
          agentId: t.agentId,
          conditionPrompt: t.conditionPrompt,
          recentMessage: event.messageText,
        });
        if (!verdict.boolean) continue;
        triggers = true;
      } catch (e) {
        console.error("llm_condition failed", e);
        continue;
      }
    } else {
      if (!triggerMatches(trigger as never, event)) continue;
      triggers = true;
    }

    if (!triggers) continue;

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
    matched++;
    void executeRun(run.id).catch((e) => console.error("executeRun crashed", e));
  }

  return { matched, messagesSent: 0 };
}

type RunLog = StepLogEntry[];

/**
 * Run all steps of an automation, updating the run row with progress and
 * a log of per-step results. If a `wait` step is hit, the run is paused
 * (status=pending, scheduled_at set) and will be resumed by the cron.
 */
export async function executeRun(runId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: run, error: rErr } = await admin
    .from("automation_runs")
    .select("id, status, current_step, automation_id, conversation_id, contact_id, trigger_data")
    .eq("id", runId)
    .maybeSingle();
  if (rErr || !run) return;
  if (run.status !== "pending") return;

  const ctx = await loadContext(
    run.automation_id,
    run.conversation_id,
    run.contact_id,
    (run.trigger_data ?? {}) as Record<string, unknown>,
  );
  if (!ctx) {
    await markFailed(runId, "Could not load run context");
    return;
  }

  await admin
    .from("automation_runs")
    .update({ status: "running" })
    .eq("id", runId);

  try {
    await executeStepsFrom({
      ctx,
      steps: ctx.automation.steps,
      startIndex: run.current_step,
      runId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("automation_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", runId);
    console.error("executeRun crashed", runId, msg);
  }
}

interface ExecuteArgs {
  ctx: RunContext & { _log?: RunLog };
  steps: Step[];
  startIndex?: number;
  runId: string;
}

/**
 * Execute a sequence of steps. `branch` and `condition` recurse into
 * this with a sub-list; the outer call writes the final log + status
 * for the top-level run, and nested calls just append their results
 * to the shared `ctx._log`.
 */
export async function executeStepsFrom(args: ExecuteArgs): Promise<{ messagesSent: number }> {
  const { ctx, steps, runId } = args;
  const startIndex = args.startIndex ?? 0;
  let messagesSent = 0;
  const isTopLevel = steps === ctx.automation.steps;

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];
    const stepStart = Date.now();
    try {
      const output = await runStep(step, ctx);

      if (step.type === "webhook" && output && typeof output === "object") {
        const o = output as { body?: unknown; status?: number };
        const saveAs = (step as { saveAs?: string }).saveAs ?? "response";
        ctx.vars[saveAs] = o;
        for (const ef of (step as { extractFields?: Array<{ name: string; path: string }> }).extractFields ?? []) {
          const v = getPath(o.body, ef.path);
          if (v !== undefined) ctx.vars[ef.name] = v;
        }
      } else if (step.type === "ai_extract" && output && typeof output === "object") {
        const o = output as { messagesSent?: number; [k: string]: unknown };
        if (typeof o.messagesSent === "number") {
          messagesSent += o.messagesSent;
          delete o.messagesSent;
        }
        for (const [k, v] of Object.entries(o)) {
          if (k === "extracted" || k === "message") continue;
          ctx.vars[k] = v;
        }
      } else if (output && typeof output === "object" && "messagesSent" in (output as Record<string, unknown>)) {
        const ms = Number((output as { messagesSent?: number }).messagesSent ?? 0);
        if (!Number.isNaN(ms)) messagesSent += ms;
      }

      ctx._log = [
        ...(ctx._log ?? []),
        { step: i, type: step.type, status: "ok" as const, duration_ms: Date.now() - stepStart, output },
      ];

      if (step.type === "wait") {
        const ms = (output as { ms: number }).ms;
        const admin = createAdminClient();
        await admin
          .from("automation_runs")
          .update({
            current_step: i + 1,
            status: "pending",
            scheduled_at: new Date(Date.now() + ms).toISOString(),
            log: ctx._log,
          })
          .eq("id", runId);
        return { messagesSent };
      }
    } catch (e) {
      ctx._log = [
        ...(ctx._log ?? []),
        {
          step: i,
          type: step.type,
          status: "failed" as const,
          duration_ms: Date.now() - stepStart,
          error: e instanceof Error ? e.message : String(e),
        },
      ];
      if (isTopLevel) {
        const admin = createAdminClient();
        await admin
          .from("automation_runs")
          .update({ status: "failed", completed_at: new Date().toISOString(), log: ctx._log })
          .eq("id", runId);
      }
      return { messagesSent };
    }
  }

  if (isTopLevel) {
    const admin = createAdminClient();
    await admin
      .from("automation_runs")
      .update({ status: "succeeded", completed_at: new Date().toISOString(), log: ctx._log ?? [] })
      .eq("id", runId);
  }
  return { messagesSent };
}

async function loadContext(
  automationId: string,
  conversationId: string | null,
  contactId: string | null,
  triggerData: Record<string, unknown> = {},
): Promise<(RunContext & { _log?: RunLog }) | null> {
  const admin = createAdminClient();
  const { data: auto } = await admin
    .from("automations")
    .select("id, name, workspace_id, steps")
    .eq("id", automationId)
    .maybeSingle();
  if (!auto) return null;
  if (!conversationId || !contactId) return null;

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
    triggerData,
    vars: {
      messageText: triggerData.messageText ?? "",
      messageId: triggerData.messageId ?? "",
    },
    _log: [],
  };
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
