"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, AlertCircle, Plus, X, GripVertical, MessageSquare, Tag, Clock, Send, GitBranch, UserCheck, Webhook, Sparkles, FileText, Hash, XCircle, CheckSquare, Image as ImageIcon, Filter, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/automations/types";

export type Options = {
  tags: Array<{ id: string; name: string; color: string }>;
  templates: Array<{ id: string; name: string; language: string }>;
  members: Array<{ id: string; full_name: string | null; email: string }>;
  customFields: Array<{ id: string; name: string; type: string }>;
  aiAgents?: Array<{ id: string; name: string; provider: string; model: string }>;
};

const STEP_ICONS: Record<Step["type"], React.ComponentType<{ className?: string }>> = {
  send_text: MessageSquare,
  send_template: Send,
  add_tag: Tag,
  remove_tag: Tag,
  set_field: Hash,
  wait: Clock,
  assign_to: UserCheck,
  set_status: CheckSquare,
  close_conversation: XCircle,
  webhook: Webhook,
  ai_reply: Sparkles,
  ai_extract: Sparkles,
  branch: GitBranch,
  llm_draft_message: Bot,
  send_images: ImageIcon,
  condition: Filter,
};

const STEP_LABELS: Record<Step["type"], string> = {
  send_text: "Enviar texto",
  send_template: "Enviar plantilla",
  add_tag: "Añadir etiqueta",
  remove_tag: "Quitar etiqueta",
  set_field: "Establecer campo",
  wait: "Esperar",
  assign_to: "Asignar a",
  set_status: "Cambiar estado",
  close_conversation: "Cerrar conversación",
  webhook: "Webhook",
  ai_reply: "Respuesta IA",
  ai_extract: "Extraer variables con IA",
  branch: "Condición",
  llm_draft_message: "Redactar con IA",
  send_images: "Enviar imágenes",
  condition: "Condición (avanzada)",
};

const STEP_DESCRIPTIONS: Record<Step["type"], string> = {
  send_text: "Mensaje libre al cliente",
  send_template: "Plantilla aprobada de Meta",
  add_tag: "Etiqueta al contacto",
  remove_tag: "Etiqueta del contacto",
  set_field: "Campo personalizado",
  wait: "Pausa antes del siguiente step",
  assign_to: "Agente específico",
  set_status: "open / pending / closed",
  close_conversation: "Cerrar la conversación",
  webhook: "Llamada HTTP a URL externa",
  ai_reply: "Generar respuesta con IA",
  ai_extract: "Extraer datos estructurados del mensaje",
  branch: "Bifurcación if/else",
  llm_draft_message: "El LLM redacta la respuesta usando los datos del run",
  send_images: "Enviar varias imágenes iterando vars.X[*].Y",
  condition: "Bifurcación recursiva yes/no con múltiples subjects",
};

type Props = {
  step: Step;
  index: number;
  options: Options;
  onChange: (s: Step) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function StepForm({ step, index, options, onChange, onRemove, onMoveUp, onMoveDown }: Props) {
  const [open, setOpen] = useState(true);
  const Icon = STEP_ICONS[step.type];
  const err = validateStep(step);

  return (
    <div className={cn("rounded-md border bg-card", err && "border-destructive")}>
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {index + 1}. {STEP_LABELS[step.type]}
          </p>
          <p className="text-xs text-muted-foreground">
            {STEP_DESCRIPTIONS[step.type]}
          </p>
        </div>
        {err && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {err}
          </span>
        )}
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button variant="ghost" size="icon" onClick={onMoveUp} title="Subir">
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="icon" onClick={onMoveDown} title="Bajar">
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} title={open ? "Cerrar" : "Abrir"}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} title="Quitar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t bg-muted/20 p-3">
          <StepFields step={step} options={options} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function StepFields({ step, options, onChange }: { step: Step; options: Options; onChange: (s: Step) => void }) {
  switch (step.type) {
    case "send_text":
      return (
        <div>
          <Label>Mensaje</Label>
          <Textarea
            value={step.text}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
            placeholder="Hola {{contact.name}}, ..."
            rows={4}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variables: <code className="rounded bg-muted px-1">{"{{contact.name}}"}</code> <code className="rounded bg-muted px-1">{"{{contact.phone}}"}</code>
          </p>
        </div>
      );

    case "send_template":
      return (
        <div className="space-y-3">
          <div>
            <Label>Plantilla</Label>
            <Select value={step.templateId} onValueChange={(v) => onChange({ ...step, templateId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona plantilla" />
              </SelectTrigger>
              <SelectContent>
                {options.templates.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">Sin plantillas. Crea una en Meta Business Suite primero.</div>
                ) : (
                  options.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variables</Label>
            <KeyValueEditor
              value={step.vars}
              onChange={(v) => onChange({ ...step, vars: v })}
              keyPlaceholder='Clave (ej: "1")'
              valuePlaceholder='Valor (ej: "{{contact.name}}")'
            />
          </div>
        </div>
      );

    case "add_tag":
    case "remove_tag":
      return (
        <div>
          <Label>Etiqueta</Label>
          <EntitySelect
            value={step.tagId}
            onChange={(v) => onChange({ ...step, tagId: v })}
            options={options.tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
            placeholder="Selecciona etiqueta"
            allowFreeText
            emptyText="Sin etiquetas. Crea una en /contacts."
          />
        </div>
      );

    case "set_field":
      return (
        <div className="space-y-3">
          <div>
            <Label>Campo personalizado</Label>
            <EntitySelect
              value={step.fieldId}
              onChange={(v) => onChange({ ...step, fieldId: v })}
              options={options.customFields.map((f) => ({ value: f.id, label: `${f.name} (${f.type})` }))}
              placeholder="Selecciona campo"
              allowFreeText
              emptyText="Sin campos personalizados."
            />
          </div>
          <div>
            <Label>Valor</Label>
            <Input
              value={step.value}
              onChange={(e) => onChange({ ...step, value: e.target.value })}
              placeholder="VIP, pendiente, etc."
            />
          </div>
        </div>
      );

    case "wait":
      return (
        <div>
          <Label>Duración</Label>
          <Select value={step.duration} onValueChange={(v) => onChange({ ...step, duration: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 minutos</SelectItem>
              <SelectItem value="30m">30 minutos</SelectItem>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="1d">1 día</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "assign_to":
      return (
        <div>
          <Label>Agente</Label>
          <Select value={step.userId} onValueChange={(v) => onChange({ ...step, userId: v })}>
            <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
            <SelectContent>
              {options.members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "set_status":
      return (
        <div>
          <Label>Estado</Label>
          <Select value={step.status} onValueChange={(v) => onChange({ ...step, status: v as "open" | "pending" | "closed" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abierta</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="closed">Cerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "close_conversation":
      return <p className="text-sm text-muted-foreground">Esta acción cierra la conversación actual. No requiere configuración.</p>;

    case "webhook":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>URL</Label>
              <Input
                value={step.url}
                onChange={(e) => onChange({ ...step, url: e.target.value })}
                placeholder="https://example.com/hook"
              />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={step.method} onValueChange={(v) => onChange({ ...step, method: v as "GET" | "POST" | "PUT" | "DELETE" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Variables: <code className="bg-muted px-1 rounded">{"{{contact.name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{vars.orderId}}"}</code>, <code className="bg-muted px-1 rounded">{"{{vars.response.data.id}}"}</code>
          </p>
          {step.method === "GET" || step.method === "DELETE" ? (
            <div>
              <Label>Query params (opcional)</Label>
              <KeyValueEditor
                value={(step.queryParams ?? {}) as Record<string, string>}
                onChange={(v) => onChange({ ...step, queryParams: v })}
                keyPlaceholder="param"
                valuePlaceholder="valor o {{vars.X}}"
              />
            </div>
          ) : null}
          <div>
            <Label>Headers (opcional)</Label>
            <KeyValueEditor
              value={(step.headers ?? {}) as Record<string, string>}
              onChange={(v) => onChange({ ...step, headers: v })}
              keyPlaceholder="Header"
              valuePlaceholder="Valor"
            />
          </div>
          {step.method === "POST" || step.method === "PUT" ? (
            <div>
              <Label>Body (JSON, opcional)</Label>
              <Textarea
                value={JSON.stringify(step.body ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    onChange({ ...step, body: JSON.parse(e.target.value) });
                  } catch {
                    /* ignore parse error while typing */
                  }
                }}
                rows={3}
                placeholder='{"contact": "{{contact.id}}"}'
              />
            </div>
          ) : null}
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium">Extraer variables del response</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Guardar response como</Label>
                <Input
                  value={step.saveAs ?? ""}
                  onChange={(e) => onChange({ ...step, saveAs: e.target.value || undefined })}
                  placeholder="response"
                />
              </div>
            </div>
            <ExtractFieldsEditor
              value={step.extractFields ?? []}
              onChange={(v) => onChange({ ...step, extractFields: v })}
            />
          </div>
        </div>
      );

    case "ai_reply":
      return (
        <div className="space-y-2">
          <div>
            <Label>Agente IA</Label>
            <Select value={step.agentId} onValueChange={(v) => onChange({ ...step, agentId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
              <SelectContent>
                {(options.aiAgents ?? []).length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Crea un agente en /ai-agents primero
                  </SelectItem>
                ) : (
                  options.aiAgents!.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — <span className="text-muted-foreground">{a.provider}/{a.model}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mensaje de handoff (opcional)</Label>
            <Input
              value={step.handoffMessage ?? ""}
              onChange={(e) => onChange({ ...step, handoffMessage: e.target.value })}
              placeholder="Te paso con un humano..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se envía al contacto si el agente decide transferir a un humano.
            </p>
          </div>
        </div>
      );

    case "ai_extract":
      return (
        <div className="space-y-2">
          <div>
            <Label>Agente IA</Label>
            <Select value={step.agentId} onValueChange={(v) => onChange({ ...step, agentId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
              <SelectContent>
                {(options.aiAgents ?? []).length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Crea un agente en /ai-agents primero
                  </SelectItem>
                ) : (
                  options.aiAgents!.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — <span className="text-muted-foreground">{a.provider}/{a.model}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instrucción</Label>
            <Textarea
              value={step.instruction}
              onChange={(e) => onChange({ ...step, instruction: e.target.value })}
              placeholder='Extrae la marca, modelo y año del vehículo que el cliente menciona. Usa {{vars.brands}} como vocabulario.'
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              El LLM recibe el último mensaje del cliente (<code>{"{{vars.messageText}}"}</code>) más esta instrucción.
            </p>
          </div>
          <div>
            <Label>Campos a extraer</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Cada campo se guarda en <code>vars.&lt;nombre&gt;</code> para usar en los siguientes steps.
            </p>
            {step.fields.map((f, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <Input
                  value={f.name}
                  onChange={(e) => {
                    const next = [...step.fields];
                    next[i] = { ...f, name: e.target.value };
                    onChange({ ...step, fields: next });
                  }}
                  placeholder="nombre (ej. marca)"
                  className="flex-1"
                />
                <Select
                  value={f.type}
                  onValueChange={(v) => {
                    const next = [...step.fields];
                    next[i] = { ...f, type: v as "string" | "number" | "boolean" };
                    onChange({ ...step, fields: next });
                  }}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange({ ...step, fields: step.fields.filter((_, j) => j !== i) })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...step, fields: [...step.fields, { name: "", type: "string" }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Añadir campo
            </Button>
          </div>
          <div>
            <Label>Vocabulario de referencia (opcional)</Label>
            <Input
              value={step.referencePath ?? ""}
              onChange={(e) => onChange({ ...step, referencePath: e.target.value || undefined })}
              placeholder="vars.brands"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Path a un <code>vars.X</code> definido en un step anterior (típicamente un webhook con
              <code> saveAs</code>). El valor se inyecta en el prompt como bloque de referencia para que el
              LLM matchee el mensaje del cliente contra datos canónicos — útil para catálogos, listas de
              SKUs, marcas, etc. Cap 8 KB.
            </p>
          </div>
        </div>
      );

    case "branch":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Campo</Label>
              <Select value={step.if.field} onValueChange={(v) => onChange({ ...step, if: { ...step.if, field: v as "tag" | "channel" | "status" } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel">Canal</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                  <SelectItem value="tag">Etiqueta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operador</Label>
              <Select value={step.if.operator} onValueChange={(v) => onChange({ ...step, if: { ...step.if, operator: v as "has" | "equals" | "is" } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="is">es</SelectItem>
                  <SelectItem value="equals">igual a</SelectItem>
                  <SelectItem value="has">tiene</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              {step.if.field === "channel" ? (
                <Select value={step.if.value} onValueChange={(v) => onChange({ ...step, if: { ...step.if, value: v } })}>
                  <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              ) : step.if.field === "status" ? (
                <Select value={step.if.value} onValueChange={(v) => onChange({ ...step, if: { ...step.if, value: v } })}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abierta</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="closed">Cerrada</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={step.if.value}
                  onChange={(e) => onChange({ ...step, if: { ...step.if, value: e.target.value } })}
                  placeholder="tagId"
                />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Las sub-ramas (then/else) no son editables en esta versión. La rama `then` se ejecuta si la condición se cumple, `else` (si existe) si no.
          </p>
        </div>
      );

    case "llm_draft_message":
      return (
        <div className="space-y-2">
          <EntitySelect
            value={step.agentId}
            onChange={(v) => onChange({ ...step, agentId: v })}
            options={(options.aiAgents ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.provider}/${a.model})` }))}
            placeholder="Agente IA"
            emptyText="Crea un agente en /ai-agents primero"
          />
          <div>
            <Label>Prompt</Label>
            <Textarea
              value={step.prompt}
              onChange={(e) => onChange({ ...step, prompt: e.target.value })}
              rows={4}
              placeholder="El cliente preguntó por X. Los datos están en vars.X. Respondé conciso, en español."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              El LLM recibe el historial de la conversación + todos los <code>vars.X</code> acumulados
              (incluyendo responses de webhooks previos). Compone y envía por el canal.
            </p>
          </div>
        </div>
      );

    case "send_images":
      return (
        <div className="space-y-2">
          <EntitySelect
            value={step.agentId}
            onChange={(v) => onChange({ ...step, agentId: v })}
            options={(options.aiAgents ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.provider}/${a.model})` }))}
            placeholder="Agente IA (opcional, para caption)"
            emptyText="Crea un agente en /ai-agents primero"
          />
          <div>
            <Label>imagePath (vars.X[*].Y)</Label>
            <Input
              value={step.imagePath}
              onChange={(e) => onChange({ ...step, imagePath: e.target.value })}
              placeholder="vars.results[*].url"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Path a un array en vars. El motor itera con <code>[*]</code> y envía una imagen por
              elemento. Soporta wildcards anidados (ej: <code>vars.data[*].media[0].url</code>).
            </p>
          </div>
          <div>
            <Label>Caption (opcional)</Label>
            <Textarea
              value={step.caption ?? ""}
              onChange={(e) => onChange({ ...step, caption: e.target.value })}
              rows={2}
              placeholder="{{ loop.index }}. {{ loop.title }}"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              <code>{"{{ loop.index }}"}</code> = 1-based index. <code>{"{{ loop.X }}"}</code> = campo del
              item actual. Ej: <code>{"{{ loop.title }}"}</code> lee <code>currentItem.title</code>.
            </p>
          </div>
          <div>
            <Label>maxImages (cap)</Label>
            <Input
              type="number"
              min={1}
              value={step.maxImages ?? 5}
              onChange={(e) => onChange({ ...step, maxImages: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Cuántas imágenes enviar como máximo en un solo run. Default 5.
            </p>
          </div>
        </div>
      );

    case "condition":
      return (
        <div className="space-y-2">
          <div>
            <Label>Subject</Label>
            <Select
              value={step.subject}
              onValueChange={(v) => onChange({ ...step, subject: v as typeof step.subject })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tag_presence">tag_presence (¿tiene esta etiqueta?)</SelectItem>
                <SelectItem value="contact_field">contact_field (campo del contacto)</SelectItem>
                <SelectItem value="message_content">message_content (texto del mensaje)</SelectItem>
                <SelectItem value="time_of_day">time_of_day (HH:mm-HH:mm)</SelectItem>
                <SelectItem value="vars_value">vars_value (valor en ctx.vars)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operando</Label>
            <Input
              value={step.operand ?? ""}
              onChange={(e) => onChange({ ...step, operand: e.target.value })}
              placeholder={
                step.subject === "vars_value"
                  ? "vars.response.results"
                  : step.subject === "time_of_day"
                    ? "09:00-18:00"
                    : "ID, path o texto"
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {step.subject === "vars_value"
                ? "Path a un valor en vars (soporta wildcards vars.X[*].Y y vars.X[0].Y)."
                : step.subject === "time_of_day"
                  ? "Rango HH:mm-HH:mm. Soporta rangos que cruzan medianoche (ej: 18:00-09:00)."
                  : step.subject === "tag_presence"
                    ? "ID de la etiqueta a verificar."
                    : step.subject === "contact_field"
                      ? "Nombre de la columna del contacto (name, email, phone, etc)."
                      : "Texto a buscar en el mensaje del cliente."}
            </p>
          </div>
          {step.subject === "vars_value" && (
            <>
              <div>
                <Label>Operador</Label>
                <Select
                  value={step.operator ?? "is_empty"}
                  onValueChange={(v) => onChange({ ...step, operator: v as typeof step.operator })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_empty">is_empty (default)</SelectItem>
                    <SelectItem value="is_not_empty">is_not_empty</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="not_equals">not_equals</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Default <code>is_empty</code> cuando no se especifica — útil para "¿el webhook encontró algo?".
                </p>
              </div>
              <div>
                <Label>Valor (para equals/not_equals/contains)</Label>
                <Input
                  value={step.value ?? ""}
                  onChange={(e) => onChange({ ...step, value: e.target.value })}
                  placeholder="texto a comparar"
                />
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Las sub-ramas <code>yes</code>/<code>no</code> se editan en el <strong>Canvas</strong> (no en lista).
            Cambiá a la vista Canvas para arrastrar steps a cada rama.
          </p>
        </div>
      );
  }
}

function EntitySelect({
  value,
  onChange,
  options,
  placeholder,
  allowFreeText,
  emptyText,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; color?: string }>;
  placeholder: string;
  allowFreeText?: boolean;
  emptyText?: string;
}) {
  const found = options.find((o) => o.value === value);
  if (allowFreeText && value && !found) {
    // Free-text UUID mode
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID" />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>Elegir</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">{emptyText ?? "Sin opciones"}</div>
          ) : (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.color && <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />}
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {allowFreeText && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="O pega un UUID"
          className="text-xs"
        />
      )}
    </div>
  );
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const entries = Object.entries(value);
  const add = () => onChange({ ...value, "": "" });
  const update = (oldKey: string, newKey: string, newVal: string) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldKey) out[newKey] = newVal;
      else out[k] = v;
    }
    onChange(out);
  };
  const remove = (k: string) => {
    const out = { ...value };
    delete out[k];
    onChange(out);
  };
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <Input value={k} placeholder={keyPlaceholder} onChange={(e) => update(k, e.target.value, v)} className="flex-1" />
          <Input value={v} placeholder={valuePlaceholder} onChange={(e) => update(k, k, e.target.value)} className="flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(k)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Añadir
      </Button>
    </div>
  );
}

function ExtractFieldsEditor({
  value,
  onChange,
}: {
  value: Array<{ name: string; path: string }>;
  onChange: (v: Array<{ name: string; path: string }>) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Extraer fields del JSON response</Label>
      {value.map((ef, i) => (
        <div key={i} className="flex gap-1">
          <Input
            value={ef.name}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...ef, name: e.target.value };
              onChange(next);
            }}
            placeholder="nombre de la var"
            className="flex-1"
          />
          <Input
            value={ef.path}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...ef, path: e.target.value };
              onChange(next);
            }}
            placeholder="data.user.id"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { name: "", path: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Añadir field
      </Button>
    </div>
  );
}

// Add step menu
export function AddStepMenu({ onAdd }: { onAdd: (type: Step["type"]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Añadir step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {(Object.keys(STEP_LABELS) as Step["type"][]).map((t) => {
          const Icon = STEP_ICONS[t];
          return (
            <DropdownMenuItem key={t} onClick={() => onAdd(t)}>
              <Icon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{STEP_LABELS[t]}</span>
                <span className="text-xs text-muted-foreground">{STEP_DESCRIPTIONS[t]}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function defaultStepFor(t: Step["type"]): Step {
  switch (t) {
    case "send_text": return { type: "send_text", text: "" };
    case "send_template": return { type: "send_template", templateId: "", vars: {} };
    case "add_tag": return { type: "add_tag", tagId: "" };
    case "remove_tag": return { type: "remove_tag", tagId: "" };
    case "set_field": return { type: "set_field", fieldId: "", value: "" };
    case "wait": return { type: "wait", duration: "5m" };
    case "assign_to": return { type: "assign_to", userId: "" };
    case "set_status": return { type: "set_status", status: "open" };
    case "close_conversation": return { type: "close_conversation" };
    case "webhook": return { type: "webhook", url: "", method: "POST" };
    case "ai_reply": return { type: "ai_reply", agentId: "" };
    case "ai_extract": return { type: "ai_extract", agentId: "", instruction: "", fields: [] };
    case "branch": return { type: "branch", if: { field: "channel", operator: "is", value: "whatsapp" }, then: [] };
    case "llm_draft_message": return { type: "llm_draft_message", agentId: "", prompt: "" };
    case "send_images": return { type: "send_images", agentId: "", imagePath: "" };
    case "condition": return { type: "condition", subject: "vars_value", operand: "", yes: [], no: [] };
  }
}

export function validateStep(s: Step): string | null {
  switch (s.type) {
    case "send_text":
      return s.text.trim() ? null : "texto vacío";
    case "send_template":
      return s.templateId ? null : "selecciona plantilla";
    case "add_tag":
    case "remove_tag":
      return s.tagId ? null : "selecciona etiqueta";
    case "set_field":
      if (!s.fieldId) return "selecciona campo";
      if (!s.value.trim()) return "valor vacío";
      return null;
    case "wait":
      return /^\d+\s*[smhd]$/i.test(s.duration) ? null : "duración inválida";
    case "assign_to":
      return s.userId ? null : "selecciona agente";
    case "webhook":
      if (!s.url.trim()) return "URL vacía";
      if (!/^https?:\/\//.test(s.url)) return "URL debe empezar con http(s)://";
      return null;
    case "ai_reply":
      return s.agentId ? null : "agentId requerido";
    case "ai_extract": {
      if (!s.agentId) return "agente requerido";
      if (!s.instruction.trim()) return "instrucción requerida";
      if (s.fields.length === 0) return "al menos un campo a extraer";
      if (s.fields.some((f) => !f.name.trim())) return "todos los campos necesitan nombre";
      return null;
    }
    case "branch":
      return s.if.value ? null : "valor de condición requerido";
    case "llm_draft_message":
      if (!s.agentId) return "agente requerido";
      if (!s.prompt.trim()) return "prompt requerido";
      return null;
    case "send_images":
      if (!s.imagePath.trim()) return "imagePath requerido (ej: vars.results[*].url)";
      if (!s.imagePath.includes("[*]")) return "imagePath debe contener [*]";
      return null;
    case "condition":
      if (!s.subject) return "subject requerido";
      if (s.subject === "vars_value" && !s.operand) return "operand requerido para vars_value";
      return null;
    case "set_status":
    case "close_conversation":
      return null;
  }
}