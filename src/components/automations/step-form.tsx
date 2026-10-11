"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, AlertCircle, Plus, X, GripVertical, MessageSquare, Tag, Clock, Send, GitBranch, UserCheck, Webhook, Sparkles, FileText, Hash, XCircle, CheckSquare } from "lucide-react";
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

type Options = {
  tags: Array<{ id: string; name: string; color: string }>;
  templates: Array<{ id: string; name: string; language: string }>;
  members: Array<{ id: string; full_name: string | null; email: string }>;
  customFields: Array<{ id: string; name: string; type: string }>;
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
  branch: GitBranch,
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
  branch: "Condición",
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
  branch: "Bifurcación if/else",
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

function StepFields({ step, options, onChange }: { step: Step; options: Options; onChange: (s: Step) => void }) {
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
          <div>
            <Label>Headers (opcional)</Label>
            <KeyValueEditor
              value={(step.headers ?? {}) as Record<string, string>}
              onChange={(v) => onChange({ ...step, headers: v })}
              keyPlaceholder="Header"
              valuePlaceholder="Valor"
            />
          </div>
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
        </div>
      );

    case "ai_reply":
      return (
        <div className="space-y-2">
          <div>
            <Label>AI Agent ID</Label>
            <Input
              value={step.agentId}
              onChange={(e) => onChange({ ...step, agentId: e.target.value })}
              placeholder="UUID del agente IA"
            />
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ AI Agents es Fase 7. Este step fallará hasta entonces.
            </p>
          </div>
          <div>
            <Label>Mensaje de handoff (opcional)</Label>
            <Input
              value={step.handoffMessage ?? ""}
              onChange={(e) => onChange({ ...step, handoffMessage: e.target.value })}
              placeholder="Te paso con un humano..."
            />
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

function KeyValueEditor({
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
    case "branch": return { type: "branch", if: { field: "channel", operator: "is", value: "whatsapp" }, then: [] };
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
    case "branch":
      return s.if.value ? null : "valor de condición requerido";
    case "set_status":
    case "close_conversation":
      return null;
  }
}