// ponytail: extracted from src/app/(workspace)/automations/actions.ts so
// it's testable without "use server" gymnastics. The server action still
// calls hardValidate(formData) before saving; this module just owns the
// per-step rules.

export function validateStep(s: { type: string; [k: string]: unknown }): string | null {
  switch (s.type) {
    case "send_text": {
      if (!String(s.text ?? "").trim()) return "texto vacío";
      return null;
    }
    case "send_template":
      if (!String(s.templateId ?? "").trim()) return "templateId requerido";
      return null;
    case "add_tag":
    case "remove_tag":
      if (!String(s.tagId ?? "").trim()) return "tagId requerido";
      return null;
    case "set_field":
      if (!String(s.fieldId ?? "").trim()) return "fieldId requerido";
      if (!String(s.value ?? "").trim()) return "value requerido";
      return null;
    case "wait":
      if (!/^\d+\s*[smhd]$/i.test(String(s.duration ?? ""))) {
        return "duration inválida (usa 5m, 30m, 1h, 1d)";
      }
      return null;
    case "assign_to":
      if (!String(s.userId ?? "").trim()) return "userId requerido";
      return null;
    case "auto_assign": {
      const ids = Array.isArray(s.userIds) ? (s.userIds as unknown[]) : [];
      const valid = ids.filter((id) => typeof id === "string" && (id as string).trim() !== "");
      if (valid.length === 0) return "selecciona al menos un agente";
      if (valid.length > 50) return "máximo 50 agentes en el pool";
      const tpl = s.messageTemplate;
      if (typeof tpl === "string" && tpl.length > 1024) {
        return "messageTemplate debe tener 1024 caracteres o menos";
      }
      return null;
    }
    case "webhook":
      if (!String(s.url ?? "").trim()) return "url requerida";
      if (!/^https?:\/\//.test(String(s.url))) return "url debe empezar con http(s)://";
      return null;
    case "ai_reply":
      if (!String(s.agentId ?? "").trim()) return "agentId requerido";
      return null;
    case "ai_extract": {
      if (!String(s.agentId ?? "").trim()) return "agentId requerido";
      if (!String(s.instruction ?? "").trim()) return "instrucción requerida";
      const fields = (s.fields as Array<{ name?: string }> | undefined) ?? [];
      if (fields.length === 0) return "al menos un campo a extraer";
      if (fields.some((f) => !String(f.name ?? "").trim())) {
        return "todos los campos necesitan nombre";
      }
      return null;
    }
    case "branch":
      if (!String((s.if as { value?: string })?.value ?? "").trim()) {
        return "if.value requerido";
      }
      return null;
    case "llm_draft_message":
      if (!String(s.agentId ?? "").trim()) return "agentId requerido";
      if (!String(s.prompt ?? "").trim()) return "prompt requerido";
      return null;
    case "send_images":
      if (!String(s.agentId ?? "").trim()) return "agentId requerido";
      if (!String(s.imagePath ?? "").trim()) return "imagePath requerido";
      if (!String(s.imagePath).includes("[*]")) return "imagePath debe contener [*]";
      return null;
    case "condition":
      if (!String(s.subject ?? "").trim()) return "subject requerido";
      if (s.subject === "vars_value" && !String(s.operand ?? "").trim()) {
        return "operand requerido para vars_value";
      }
      return null;
    case "set_status":
    case "close_conversation":
      return null;
    default:
      return `tipo desconocido: ${s.type}`;
  }
}

export interface AutomationFormData {
  name: string;
  steps: readonly unknown[];
}

export function hardValidate(input: AutomationFormData): string | null {
  if (!input.name.trim()) return "El nombre es obligatorio";
  for (let i = 0; i < input.steps.length; i++) {
    const s = input.steps[i] as { type: string };
    const err = validateStep(s);
    if (err) return `Step #${i + 1} (${s.type}): ${err}`;
  }
  return null;
}