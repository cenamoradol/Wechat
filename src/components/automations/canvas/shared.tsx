"use client";

/**
 * Single source of truth for the automation canvas:
 * - Node type union (mirrors Step["type"])
 * - Per-type metadata: icon, label, color, blurb
 * - Position persistence helper
 *
 * Why .tsx and not .ts: NODE_META holds lucide icon components, which
 * are typed as React components. Keeping the file .tsx future-proofs
 * it for inline JSX in node renderers.
 */

import {
  Bot,
  CheckSquare,
  Clock,
  Filter,
  GitBranch,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Sparkles,
  Tag,
  UserCheck,
  Webhook,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Step } from "@/lib/automations/types";

export type AutomationNodeType = Step["type"];

export type Position = { x: number; y: number };

export type AutomationNodeData = {
  step: Step;
  index: number;
  hasError: boolean;
};

export type NodeColor = {
  solid: string;
  soft: string;
  ring: string;
  text: string;
};

// ponytail: per-type palette. Single source — a tweak here updates every
// node + the +Add menu legend. Inspired by wacrm's nodeColors().
export const NODE_COLORS: Record<AutomationNodeType, NodeColor> = {
  send_text: { solid: "#2563eb", soft: "#dbeafe", ring: "#93c5fd", text: "#1e3a8a" },
  send_template: { solid: "#0891b2", soft: "#cffafe", ring: "#67e8f9", text: "#164e63" },
  add_tag: { solid: "#16a34a", soft: "#dcfce7", ring: "#86efac", text: "#14532d" },
  remove_tag: { solid: "#ca8a04", soft: "#fef9c3", ring: "#fde047", text: "#713f12" },
  set_field: { solid: "#9333ea", soft: "#f3e8ff", ring: "#d8b4fe", text: "#581c87" },
  wait: { solid: "#475569", soft: "#f1f5f9", ring: "#cbd5e1", text: "#0f172a" },
  assign_to: { solid: "#0ea5e9", soft: "#e0f2fe", ring: "#7dd3fc", text: "#0c4a6e" },
  set_status: { solid: "#64748b", soft: "#f1f5f9", ring: "#cbd5e1", text: "#0f172a" },
  close_conversation: { solid: "#374151", soft: "#f3f4f6", ring: "#d1d5db", text: "#111827" },
  webhook: { solid: "#ea580c", soft: "#ffedd5", ring: "#fdba74", text: "#7c2d12" },
  ai_reply: { solid: "#7c3aed", soft: "#ede9fe", ring: "#c4b5fd", text: "#4c1d95" },
  ai_extract: { solid: "#db2777", soft: "#fce7f3", ring: "#f9a8d4", text: "#831843" },
  branch: { solid: "#0d9488", soft: "#ccfbf1", ring: "#5eead4", text: "#134e4a" },
  llm_draft_message: { solid: "#a855f7", soft: "#f3e8ff", ring: "#d8b4fe", text: "#581c87" },
  send_images: { solid: "#e11d48", soft: "#ffe4e6", ring: "#fda4af", text: "#881337" },
  condition: { solid: "#059669", soft: "#d1fae5", ring: "#6ee7b7", text: "#064e3b" },
};

export const NODE_META: Record<
  AutomationNodeType,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  send_text: { label: "Enviar texto", icon: MessageSquare, blurb: "Mensaje libre" },
  send_template: { label: "Plantilla", icon: Send, blurb: "Plantilla Meta" },
  add_tag: { label: "Añadir etiqueta", icon: Tag, blurb: "Etiqueta al contacto" },
  remove_tag: { label: "Quitar etiqueta", icon: Tag, blurb: "Etiqueta del contacto" },
  set_field: { label: "Campo", icon: Hash, blurb: "Campo personalizado" },
  wait: { label: "Esperar", icon: Clock, blurb: "Pausa antes del siguiente step" },
  assign_to: { label: "Asignar a", icon: UserCheck, blurb: "Agente específico" },
  set_status: { label: "Estado", icon: CheckSquare, blurb: "open / pending / closed" },
  close_conversation: { label: "Cerrar", icon: XCircle, blurb: "Cerrar conversación" },
  webhook: { label: "Webhook", icon: Webhook, blurb: "Llamada HTTP" },
  ai_reply: { label: "Respuesta IA", icon: Sparkles, blurb: "IA redacta y envía" },
  ai_extract: { label: "Extraer", icon: Sparkles, blurb: "Extraer datos estructurados" },
  branch: { label: "Condición", icon: GitBranch, blurb: "Bifurcación if/else" },
  llm_draft_message: { label: "Redactar IA", icon: Bot, blurb: "LLM redacta con vars" },
  send_images: { label: "Imágenes", icon: ImageIcon, blurb: "Iterar vars[*]" },
  condition: { label: "Condición", icon: Filter, blurb: "Bifurcación yes/no" },
};

export type NodeCategory = "messaging" | "logic" | "ai" | "flow";

export const NODE_CATEGORIES: { id: NodeCategory; label: string }[] = [
  { id: "messaging", label: "Mensajería" },
  { id: "logic", label: "Lógica" },
  { id: "ai", label: "IA" },
  { id: "flow", label: "Control" },
];

const TYPE_CATEGORY: Record<AutomationNodeType, NodeCategory> = {
  send_text: "messaging",
  send_template: "messaging",
  add_tag: "flow",
  remove_tag: "flow",
  set_field: "flow",
  wait: "flow",
  assign_to: "flow",
  set_status: "flow",
  close_conversation: "flow",
  webhook: "messaging",
  ai_reply: "ai",
  ai_extract: "ai",
  llm_draft_message: "ai",
  send_images: "messaging",
  branch: "logic",
  condition: "logic",
};

export function categoryOf(t: AutomationNodeType): NodeCategory {
  return TYPE_CATEGORY[t];
}

export function summarizeStep(step: Step): string {
  switch (step.type) {
    case "send_text":
      return step.text ? truncate(step.text) : "(vacío)";
    case "send_template":
      return step.templateId ? `Template: ${truncate(step.templateId)}` : "(sin template)";
    case "add_tag":
    case "remove_tag":
      return step.tagId ? `Tag: ${truncate(step.tagId)}` : "(sin tag)";
    case "set_field":
      return step.fieldId ? `Field: ${truncate(step.fieldId)}` : "(sin field)";
    case "wait":
      return step.duration;
    case "assign_to":
      return step.userId ? `User: ${truncate(step.userId)}` : "(sin user)";
    case "set_status":
      return step.status;
    case "close_conversation":
      return "Cerrar conversación";
    case "webhook":
      return step.url ? `${step.method} ${truncate(step.url, 30)}` : "(sin URL)";
    case "ai_reply":
      return step.agentId ? `Agent: ${truncate(step.agentId)}` : "(sin agent)";
    case "ai_extract":
      return step.agentId
        ? `${step.fields.length} campo(s) · ${truncate(step.instruction, 24)}`
        : "(sin agent)";
    case "branch":
      return `${step.if.field} ${step.if.operator} ${truncate(step.if.value, 16)}`;
    case "llm_draft_message":
      return step.agentId ? `Prompt: ${truncate(step.prompt, 24)}` : "(sin agent)";
    case "send_images":
      return step.imagePath ? truncate(step.imagePath, 32) : "(sin path)";
    case "condition":
      return `${step.subject}${step.operand ? ` · ${truncate(step.operand, 16)}` : ""}`;
  }
}

function truncate(s: string, n = 40): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
