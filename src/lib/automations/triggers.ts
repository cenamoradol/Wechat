// src/lib/automations/triggers.ts
// Pure functions: given a Trigger JSON and an event, return true if it matches.

import type { Trigger, TriggerEvent } from "./types";

export function matchesTrigger(trigger: Trigger, event: TriggerEvent): boolean {
  // ponytail: TS doesn't narrow the discriminator across the function
  // boundary. Use event.kind to dispatch and assert the trigger type.
  // Schedule triggers are not event-driven (cron evaluates them) so
  // they don't appear in TriggerEvent.
  if (event.kind === "message_received" && trigger.type === "message_received") {
    return matchesMessageReceived(trigger, event.messageText, event.channelType);
  }
  if (event.kind === "message_unanswered" && trigger.type === "message_unanswered") {
    return matchesChannel(trigger.channel, event.channelType);
  }
  if (event.kind === "contact_created" && trigger.type === "contact_created") {
    return matchesChannel(trigger.channel, event.channelType);
  }
  if (event.kind === "tag_added" && trigger.type === "tag_added") {
    return trigger.tagId === event.tagId;
  }
  if (event.kind === "ai_classify" && trigger.type === "ai_classify") {
    return trigger.agentId === event.agentId && trigger.criteria === event.criteria;
  }
  return false;
}

function matchesMessageReceived(
  trigger: Extract<Trigger, { type: "message_received" }>,
  text: string | null,
  channelType: "whatsapp" | "facebook" | "instagram",
): boolean {
  if (!matchesChannel(trigger.channel, channelType)) return false;
  if (trigger.match === "any") return true;
  const t = text ?? "";
  const v = trigger.caseSensitive ? trigger.value : trigger.value.toLowerCase();
  const haystack = trigger.caseSensitive ? t : t.toLowerCase();
  if (trigger.match === "exact") return haystack === v;
  if (trigger.match === "contains") return haystack.includes(v);
  if (trigger.match === "regex") {
    try {
      return new RegExp(trigger.value, trigger.caseSensitive ? "" : "i").test(t);
    } catch {
      return false;
    }
  }
  return false;
}

function matchesChannel(
  filter: "whatsapp" | "facebook" | "instagram" | "any",
  channelType: "whatsapp" | "facebook" | "instagram",
): boolean {
  return filter === "any" || filter === channelType;
}