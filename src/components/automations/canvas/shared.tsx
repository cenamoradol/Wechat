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
// 2026-10-16: removed all violet/indigo family to honor
// "no purple gradients, no typical AI design". Replaced with the Hibox
// amber-primary / pink-secondary / teal-tertiary / status palette.
export const NODE_COLORS: Record<AutomationNodeType, NodeColor> = {
  send_text: { solid: "#F59E0B", soft: "#3A2A0E", ring: "#FCD34D", text: "#FCD34D" },
  send_template: { solid: "#14B8A6", soft: "#0E3D38", ring: "#5EEAD4", text: "#CCFBF1" },
  add_tag: { solid: "#22C55E", soft: "#0F2818", ring: "#86EFAC", text: "#86EFAC" },
  remove_tag: { solid: "#F8B22B", soft: "#3A2A0E", ring: "#FDE68A", text: "#FDE68A" },
  set_field: { solid: "#5EA6F7", soft: "#0F1E33", ring: "#93C5FD", text: "#93C5FD" },
  wait: { solid: "#A8A29E", soft: "#1F1C19", ring: "#D6D3D1", text: "#D6D3D1" },
  assign_to: { solid: "#38BDF8", soft: "#0E2E3D", ring: "#7DD3FC", text: "#7DD3FC" },
  set_status: { solid: "#A8A29E", soft: "#1F1C19", ring: "#D6D3D1", text: "#D6D3D1" },
  close_conversation: { solid: "#78716C", soft: "#1F1C19", ring: "#A8A29E", text: "#A8A29E" },
  webhook: { solid: "#F59E0B", soft: "#3A2A0E", ring: "#FCD34D", text: "#FCD34D" },
  ai_reply: { solid: "#EC4899", soft: "#3F1428", ring: "#F9A8D4", text: "#FCE7F3" },
  ai_extract: { solid: "#EC4899", soft: "#3F1428", ring: "#F9A8D4", text: "#FCE7F3" },
  branch: { solid: "#14B8A6", soft: "#0E3D38", ring: "#5EEAD4", text: "#CCFBF1" },
  llm_draft_message: { solid: "#EC4899", soft: "#3F1428", ring: "#F9A8D4", text: "#FCE7F3" },
  send_images: { solid: "#F246B7", soft: "#2E0F22", ring: "#F9A8D4", text: "#FCE7F3" },
  condition: { solid: "#22C55E", soft: "#0F2818", ring: "#86EFAC", text: "#86EFAC" },
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
