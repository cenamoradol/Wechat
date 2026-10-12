"use client";

/**
 * Side-panel form for editing a single node in the canvas.
 *
 * Reuses the existing per-type fields from `step-form.tsx`
 * (`StepFields`). For nested types (`branch` / `condition`) we
 * recursively render the sub-step list as an inline editor so the
 * user can edit both the condition and its child steps from one
 * panel without going back to the canvas.
 *
 * ponytail: this is intentionally v1-simple. The recursive editor
 * doesn't support drag/drop; users add/remove sub-steps via the
 * same `AddStepMenu` shape used at the top level. Good enough
 * for the common 1–2 level deep flows.
 */

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepFields, defaultStepFor, type Options } from "@/components/automations/step-form";
import { NODE_META } from "./shared";
import type { Step } from "@/lib/automations/types";

type Props = {
  step: Step;
  onChange: (s: Step) => void;
  options: Options;
};

export function NodeConfigForm({ step, onChange, options }: Props) {
  switch (step.type) {
    case "branch":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Campo</Label>
              <Select
                value={step.if.field}
                onValueChange={(v) => onChange({ ...step, if: { ...step.if, field: v as "tag" | "channel" | "status" } })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="channel">Canal</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operador</Label>
              <Select
                value={step.if.operator}
                onValueChange={(v) => onChange({ ...step, if: { ...step.if, operator: v as "has" | "equals" | "is" } })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="has">has</SelectItem>
                  <SelectItem value="equals">equals</SelectItem>
                  <SelectItem value="is">is</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Valor</Label>
            <Input
              value={step.if.value}
              onChange={(e) => onChange({ ...step, if: { ...step.if, value: e.target.value } })}
            />
          </div>
          <SubStepList
            label="Then"
            steps={step.then}
            options={options}
            onChange={(then) => onChange({ ...step, then })}
          />
          <SubStepList
            label="Else"
            steps={step.else ?? []}
            options={options}
            onChange={(els) => onChange({ ...step, else: els.length === 0 ? undefined : els })}
            allowEmpty
          />
        </div>
      );

    case "condition":
      return (
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Select
              value={step.subject}
              onValueChange={(v) =>
                onChange({ ...step, subject: v as typeof step.subject })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tag_presence">Tag presente</SelectItem>
                <SelectItem value="contact_field">Campo de contacto</SelectItem>
                <SelectItem value="message_content">Contenido del mensaje</SelectItem>
                <SelectItem value="time_of_day">Hora del día</SelectItem>
                <SelectItem value="vars_value">Valor en vars</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {step.subject === "vars_value" && (
            <>
              <div>
                <Label>Operando (ruta vars.X.Y)</Label>
                <Input
                  value={step.operand ?? ""}
                  onChange={(e) => onChange({ ...step, operand: e.target.value })}
                  placeholder="vars.response.results"
                />
              </div>
              <div>
                <Label>Operador</Label>
                <Select
                  value={step.operator ?? "is_empty"}
                  onValueChange={(v) =>
                    onChange({ ...step, operator: v as typeof step.operator })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_empty">is_empty</SelectItem>
                    <SelectItem value="is_not_empty">is_not_empty</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="not_equals">not_equals</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  value={step.value ?? ""}
                  onChange={(e) => onChange({ ...step, value: e.target.value })}
                />
              </div>
            </>
          )}
          {step.subject !== "vars_value" && (
            <div>
              <Label>Operando</Label>
              <Input
                value={step.operand ?? ""}
                onChange={(e) => onChange({ ...step, operand: e.target.value })}
                placeholder={
                  step.subject === "time_of_day" ? "HH:mm-HH:mm" : "ID o path"
                }
              />
            </div>
          )}
          <SubStepList
            label="Yes"
            steps={step.yes}
            options={options}
            onChange={(yes) => onChange({ ...step, yes })}
          />
          <SubStepList
            label="No"
            steps={step.no}
            options={options}
            onChange={(no) => onChange({ ...step, no })}
          />
        </div>
      );

    case "send_text":
      return (
        <div>
          <Label>Mensaje</Label>
          <Textarea
            value={step.text}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
            rows={6}
            placeholder="Hola {{contact.name}}..."
          />
        </div>
      );

    case "send_images":
      return (
        <div className="space-y-3">
          <div>
            <Label>Agente IA (provee el modelo)</Label>
            <Select
              value={step.agentId}
              onValueChange={(v) => onChange({ ...step, agentId: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
              <SelectContent>
                {options.aiAgents?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.provider} · {a.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>imagePath (vars.X[*].Y)</Label>
            <Input
              value={step.imagePath}
              onChange={(e) => onChange({ ...step, imagePath: e.target.value })}
              placeholder="vars.response.results[*].url"
            />
          </div>
          <div>
            <Label>Caption (opcional, soporta {"{{ loop.X }}"})</Label>
            <Textarea
              value={step.caption ?? ""}
              onChange={(e) => onChange({ ...step, caption: e.target.value })}
              rows={2}
              placeholder="{{ loop.index }}. {{ loop.title }}"
            />
          </div>
          <div>
            <Label>maxImages</Label>
            <Input
              type="number"
              min={1}
              value={step.maxImages ?? 5}
              onChange={(e) => onChange({ ...step, maxImages: Number(e.target.value) })}
            />
          </div>
        </div>
      );

    case "llm_draft_message":
      return (
        <div className="space-y-3">
          <div>
            <Label>Agente IA</Label>
            <Select
              value={step.agentId}
              onValueChange={(v) => onChange({ ...step, agentId: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
              <SelectContent>
                {options.aiAgents?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.provider} · {a.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prompt (instrucción para el LLM)</Label>
            <Textarea
              value={step.prompt}
              onChange={(e) => onChange({ ...step, prompt: e.target.value })}
              rows={4}
            />
          </div>
        </div>
      );

    case "ai_extract":
      return (
        <div className="space-y-3">
          <div>
            <Label>Agente IA</Label>
            <Select
              value={step.agentId}
              onValueChange={(v) => onChange({ ...step, agentId: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona agente" /></SelectTrigger>
              <SelectContent>
                {options.aiAgents?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.provider} · {a.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instrucción</Label>
            <Textarea
              value={step.instruction}
              onChange={(e) => onChange({ ...step, instruction: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <Label>referencePath (opcional)</Label>
            <Input
              value={step.referencePath ?? ""}
              onChange={(e) => onChange({ ...step, referencePath: e.target.value || undefined })}
              placeholder="vars.response.brands"
            />
          </div>
          <div>
            <Label>Campos</Label>
            <div className="space-y-2">
              {step.fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={f.name}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        fields: step.fields.map((g, j) => (j === i ? { ...g, name: e.target.value } : g)),
                      })
                    }
                    placeholder="nombre"
                  />
                  <Select
                    value={f.type}
                    onValueChange={(v) =>
                      onChange({
                        ...step,
                        fields: step.fields.map((g, j) => (j === i ? { ...g, type: v as typeof f.type } : g)),
                      })
                    }
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onChange({ ...step, fields: step.fields.filter((_, j) => j !== i) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...step,
                    fields: [...step.fields, { name: "", type: "string" }],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Añadir campo
              </Button>
            </div>
          </div>
        </div>
      );

    default:
      // ponytail: reuse the existing per-type fields from the list view.
      return <StepFields step={step} options={options} onChange={onChange} />;
  }
}

function SubStepList({
  label,
  steps,
  options,
  onChange,
  allowEmpty,
}: {
  label: string;
  steps: Step[];
  options: Options;
  onChange: (s: Step[]) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {label} ({steps.length})
        </Label>
        <div className="flex flex-wrap gap-1">
          {(["send_text", "ai_reply", "ai_extract", "llm_draft_message", "wait", "webhook", "add_tag"] as const).map((t) => (
            <Button
              key={t}
              variant="outline"
              size="sm"
              onClick={() => onChange([...steps, defaultStepFor(t)])}
              title={NODE_META[t].label}
            >
              <Plus className="h-3 w-3" />
              <span className="ml-1 text-xs">{NODE_META[t].label}</span>
            </Button>
          ))}
        </div>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {allowEmpty ? "Sin steps (opcional)." : "Añade al menos un step."}
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="rounded-md border bg-card p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">{NODE_META[s.type].label}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onChange(steps.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <NodeConfigForm
                step={s}
                options={options}
                onChange={(next) =>
                  onChange(steps.map((x, j) => (j === i ? next : x)))
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
