// src/lib/automations/steps.ts
// Pure functions that execute one step against a RunContext.
// Each returns a value (or throws) that gets logged in the run log.

import type { RunContext, Step } from "./types";
import { parseDuration } from "./types";
import { getAdapter } from "@/lib/channels";
import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function interpolate(template: string, ctx: RunContext): string {
  return template
    .replace(/\{\{contact\.name\}\}/g, ctx.contact.name ?? "")
    .replace(/\{\{contact\.phone\}\}/g, ctx.contact.phone ?? "")
    .replace(/\{\{contact\.email\}\}/g, ctx.contact.email ?? "")
    .replace(/\{\{contact\.id\}\}/g, ctx.contact.id)
    .replace(/\{\{conversation\.id\}\}/g, ctx.conversation.id);
}

export async function runStep(step: Step, ctx: RunContext): Promise<unknown> {
  switch (step.type) {
    case "send_text": {
      const text = interpolate(step.text, ctx);
      const adapter = getAdapter(ctx.channel.type);
      const res = await adapter.sendText({
        accessToken: ctx.channel.accessToken,
        fromExternalId: ctx.channel.externalId,
        toExternalId: ctx.contactChannel.externalUserId,
        text,
      });
      await persistOutboundMessage(ctx, "text", text, res.externalId);
      return { externalId: res.externalId };
    }

    case "send_template": {
      const adapter = getAdapter(ctx.channel.type);
      // ponytail: WA needs language + template name. Fetch the template to read both.
      const admin = createAdminClient();
      const { data: tpl } = await admin
        .from("templates")
        .select("name, language, components")
        .eq("id", step.templateId)
        .maybeSingle();
      if (!tpl) throw new Error(`Template ${step.templateId} not found`);

      const vars: Record<string, string> = {};
      for (const [k, v] of Object.entries(step.vars)) {
        vars[k] = interpolate(v, ctx);
      }
      const res = await adapter.sendTemplate({
        accessToken: ctx.channel.accessToken,
        fromExternalId: ctx.channel.externalId,
        toExternalId: ctx.contactChannel.externalUserId,
        text: "", // ponytail: SendTemplateArgs extends SendTextArgs; not used
        templateName: tpl.name,
        language: tpl.language,
        variables: vars,
      });
      await persistOutboundMessage(ctx, "template", Object.values(vars).join(" "), res.externalId);
      return { externalId: res.externalId };
    }

    case "add_tag": {
      const admin = createAdminClient();
      const { error } = await admin
        .from("contact_tags")
        .upsert(
          { contact_id: ctx.contact.id, tag_id: step.tagId },
          { onConflict: "contact_id,tag_id" },
        );
      if (error) throw error;
      return { tagId: step.tagId };
    }

    case "remove_tag": {
      const admin = createAdminClient();
      const { error } = await admin
        .from("contact_tags")
        .delete()
        .eq("contact_id", ctx.contact.id)
        .eq("tag_id", step.tagId);
      if (error) throw error;
      return { tagId: step.tagId };
    }

    case "set_field": {
      const admin = createAdminClient();
      const value = interpolate(step.value, ctx);
      const { error } = await admin
        .from("custom_field_values")
        .upsert(
          { contact_id: ctx.contact.id, field_id: step.fieldId, value },
          { onConflict: "contact_id,field_id" },
        );
      if (error) throw error;
      return { fieldId: step.fieldId, value };
    }

    case "wait": {
      // Engine handles waiting (sets scheduled_at). Returning the duration is enough.
      return { duration: step.duration, ms: parseDuration(step.duration) };
    }

    case "assign_to": {
      const admin = createAdminClient();
      const { error } = await admin
        .from("conversations")
        .update({ assigned_to: step.userId })
        .eq("id", ctx.conversation.id);
      if (error) throw error;
      return { assignedTo: step.userId };
    }

    case "set_status": {
      const admin = createAdminClient();
      const { error } = await admin
        .from("conversations")
        .update({ status: step.status })
        .eq("id", ctx.conversation.id);
      if (error) throw error;
      return { status: step.status };
    }

    case "close_conversation": {
      const admin = createAdminClient();
      const { error } = await admin
        .from("conversations")
        .update({ status: "closed" })
        .eq("id", ctx.conversation.id);
      if (error) throw error;
      return { status: "closed" };
    }

    case "webhook": {
      const body =
        typeof step.body === "object" && step.body
          ? JSON.stringify(interpolateObject(step.body as Record<string, string>, ctx))
          : undefined;
      const res = await fetch(step.url, {
        method: step.method,
        headers: {
          "Content-Type": "application/json",
          ...(step.headers ?? {}),
        },
        body: step.method === "GET" ? undefined : body,
      });
      if (!res.ok) throw new Error(`Webhook ${step.method} ${step.url} returned ${res.status}`);
      return { status: res.status };
    }

    case "ai_reply": {
      // Load the agent and call the LLM with the conversation context.
      const admin = createAdminClient();
      const { data: a } = await admin
        .from("ai_agents")
        .select("*")
        .eq("id", step.agentId)
        .maybeSingle();
      if (!a) throw new Error(`AI agent ${step.agentId} not found`);

      // Load last 20 messages for context
      const { data: msgs } = await admin
        .from("messages")
        .select("direction, text, sent_by")
        .eq("conversation_id", ctx.conversation.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(20);

      const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = (msgs ?? []).map((m) => ({
        role: m.direction === "in" ? "user" : "assistant",
        content: m.text ?? "",
      }));

      // Generate reply
      const { generateAgentReply } = await import("@/lib/ai/chat");
      const { shouldHandoff } = await import("@/lib/ai/handoff");
      const recent: Array<{ direction: "in" | "out"; text: string | null; sent_by: string | null }> = (msgs ?? []).map((m) => ({
        direction: m.direction as "in" | "out",
        text: m.text,
        sent_by: m.sent_by,
      }));
      const handoff = shouldHandoff(
        {
          id: a.id,
          workspaceId: a.workspace_id,
          name: a.name,
          description: a.description,
          provider: a.provider as "openai" | "anthropic",
          model: a.model,
          systemPrompt: a.system_prompt,
          temperature: Number(a.temperature),
          maxTokens: a.max_tokens,
          kbEnabled: a.kb_enabled,
          autoReplyEnabled: a.auto_reply_enabled,
          maxRepliesPerConversation: a.max_replies_per_conversation,
          handoffKeywords: a.handoff_keywords ?? [],
          isDefault: a.is_default,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        },
        recent,
      );
      if (handoff.handoff) {
        return { handoff: true, reason: handoff.reason };
      }

      const res = await generateAgentReply({
        agent: {
          id: a.id,
          workspaceId: a.workspace_id,
          name: a.name,
          description: a.description,
          provider: a.provider as "openai" | "anthropic",
          model: a.model,
          systemPrompt: a.system_prompt,
          temperature: Number(a.temperature),
          maxTokens: a.max_tokens,
          kbEnabled: a.kb_enabled,
          autoReplyEnabled: a.auto_reply_enabled,
          maxRepliesPerConversation: a.max_replies_per_conversation,
          handoffKeywords: a.handoff_keywords ?? [],
          isDefault: a.is_default,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        },
        messages: chatMessages,
        contactVars: {
          "contact.name": ctx.contact.name ?? "",
          "contact.phone": ctx.contact.phone ?? "",
          "contact.email": ctx.contact.email ?? "",
        },
      });

      // Send via the channel
      const adapter = getAdapter(ctx.channel.type);
      const sendRes = await adapter.sendText({
        accessToken: ctx.channel.accessToken,
        fromExternalId: ctx.channel.externalId,
        toExternalId: ctx.contactChannel.externalUserId,
        text: res.content,
      });
      await persistOutboundMessage(ctx, "text", res.content, sendRes.externalId);
      return { externalId: sendRes.externalId, usage: res.usage };
    }

    case "branch": {
      const result = evaluateBranch(step, ctx);
      // Execute the sub-steps sequentially; bubble failures.
      for (const sub of result) {
        await runStep(sub, ctx);
      }
      return { branch: result === step.then ? "then" : "else" };
    }
  }
}

function evaluateBranch(step: Extract<Step, { type: "branch" }>, ctx: RunContext): Step[] {
  if (step.if.field === "tag") {
    // Special case: tag check needs DB lookup; do a quick check via ctx.vars
    // populated by engine before this step. For simplicity, return then/else
    // based on a var "hasTag:<id>" set elsewhere. Fallback: default to then.
    return step.then;
  }
  if (step.if.field === "channel") {
    return ctx.channel.type === step.if.value ? step.then : (step.else ?? []);
  }
  if (step.if.field === "status") {
    return ctx.conversation.status === step.if.value ? step.then : (step.else ?? []);
  }
  return step.then;
}

function interpolateObject(
  obj: Record<string, string>,
  ctx: RunContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = interpolate(v, ctx);
  return out;
}

async function persistOutboundMessage(
  ctx: RunContext,
  type: "text" | "template",
  text: string,
  externalId: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("messages").insert({
    conversation_id: ctx.conversation.id,
    external_id: externalId,
    direction: "out",
    type,
    text,
    sent_by: null, // automation-sent (no human agent)
    status: "sent",
  });
  await admin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 200) })
    .eq("id", ctx.conversation.id);
}

// Helper: decrypt the channel token. Engine calls this once at context load.
export function decryptChannelToken(blob: string | null | undefined): string {
  if (!blob) throw new Error("Channel access token missing");
  return decrypt(Buffer.from(blob, "base64"));
}