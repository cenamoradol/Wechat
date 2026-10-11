"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  createAutomationAction,
  updateAutomationAction,
  type AutomationFormData,
} from "@/app/(workspace)/automations/actions";
import type { Step, Trigger } from "@/lib/automations/types";

type Props = {
  initial?: AutomationFormData & { id?: string };
};

const TRIGGER_TYPES: Array<{ value: Trigger["type"]; label: string; description: string }> = [
  { value: "message_received", label: "Mensaje recibido", description: "Cuando un cliente escribe algo" },
  { value: "message_unanswered", label: "Mensaje sin responder", description: "Pasado un tiempo sin respuesta de un agente" },
  { value: "contact_created", label: "Contacto nuevo", description: "Cuando un nuevo contacto es creado" },
  { value: "tag_added", label: "Etiqueta añadida", description: "Cuando se añade una etiqueta al contacto" },
  { value: "schedule", label: "Programado (cron)", description: "Corre según un horario" },
];

const STEP_TYPES: Array<{ value: Step["type"]; label: string; description: string }> = [
  { value: "send_text", label: "Enviar texto", description: "Mensaje libre" },
  { value: "send_template", label: "Enviar plantilla", description: "Plantilla aprobada de Meta" },
  { value: "add_tag", label: "Añadir etiqueta", description: "Etiqueta al contacto" },
  { value: "remove_tag", label: "Quitar etiqueta", description: "Etiqueta del contacto" },
  { value: "set_field", label: "Establecer campo", description: "Campo personalizado" },
  { value: "wait", label: "Esperar", description: "5m / 30m / 1h / 1d" },
  { value: "assign_to", label: "Asignar a", description: "Agente específico" },
  { value: "set_status", label: "Cambiar estado", description: "open / pending / closed" },
  { value: "close_conversation", label: "Cerrar conversación", description: "" },
  { value: "webhook", label: "Webhook", description: "Llamar URL externa" },
  { value: "ai_reply", label: "Respuesta IA", description: "(requiere Fase 7)" },
  { value: "branch", label: "Condición (if/else)", description: "Bifurcación" },
];

export function AutomationEditor({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"active" | "paused" | "draft">(initial?.status ?? "draft");
  const [trigger, setTrigger] = useState<Trigger>(
    (initial?.trigger as Trigger) ?? { type: "message_received", channel: "any", match: "any", value: "" },
  );
  const [steps, setSteps] = useState<Step[]>((initial?.steps as Step[] | undefined) ?? []);
  const [pending, start] = useTransition();

  const save = () => {
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    const payload: AutomationFormData = { name, description: description || undefined, trigger, steps, status };
    start(async () => {
      const res = initial?.id
        ? await updateAutomationAction(initial.id, payload)
        : await createAutomationAction(payload);
      if (res.error) toast.error(res.error);
      else {
        toast.success(initial?.id ? "Actualizada" : "Creada");
        if (!initial?.id && "id" in res && res.id) router.push(`/automations/${res.id}`);
        else router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{initial?.id ? "Editar automatización" : "Nueva automatización"}</h1>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activa</SelectItem>
              <SelectItem value="paused">Pausada</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={pending}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Responder 'precio'" />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Qué hace?" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select
              value={trigger.type}
              onValueChange={(v) => {
                const next = v as Trigger["type"];
                setTrigger(defaultTriggerFor(next) as Trigger);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — <span className="text-muted-foreground">{t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TriggerFields trigger={trigger} onChange={setTrigger} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Steps ({steps.length})</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = prompt(`Tipo de step (uno de: ${STEP_TYPES.map((s) => s.value).join(", ")})`);
              if (!next) return;
              if (!STEP_TYPES.find((s) => s.value === next)) {
                toast.error("Tipo inválido");
                return;
              }
              setSteps([...steps, defaultStepFor(next as Step["type"])]);
            }}
          >
            <Plus className="h-4 w-4" />
            Añadir step
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin steps. Añade al menos uno.</p>
          ) : (
            steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 rounded border bg-muted/30 p-3">
                <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {i + 1}. {step.type}
                  </p>
                  <pre className="mt-1 text-xs text-muted-foreground">
                    {JSON.stringify(step, null, 2)}
                  </pre>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  title="Quitar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function defaultTriggerFor(t: Trigger["type"]): Trigger {
  switch (t) {
    case "message_received":
      return { type: "message_received", channel: "any", match: "any", value: "" };
    case "message_unanswered":
      return { type: "message_unanswered", minutes: 30, channel: "any" };
    case "contact_created":
      return { type: "contact_created", channel: "any" };
    case "tag_added":
      return { type: "tag_added", tagId: "" };
    case "schedule":
      return { type: "schedule", cron: "0 9 * * *", timezone: "America/Tegucigalpa" };
  }
}

function defaultStepFor(t: Step["type"]): Step {
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

function TriggerFields({ trigger, onChange }: { trigger: Trigger; onChange: (t: Trigger) => void }) {
  // ponytail: minimal fields per trigger type. Validation is server-side.
  if (trigger.type === "message_received") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Canal</Label>
          <Select value={trigger.channel} onValueChange={(v) => onChange({ ...trigger, channel: v as typeof trigger.channel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Cualquiera</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Coincidencia</Label>
          <Select value={trigger.match} onValueChange={(v) => onChange({ ...trigger, match: v as typeof trigger.match })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Cualquier mensaje</SelectItem>
              <SelectItem value="contains">Contiene</SelectItem>
              <SelectItem value="exact">Exacto</SelectItem>
              <SelectItem value="regex">Regex</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {trigger.match !== "any" && (
          <div className="col-span-2">
            <Label>Valor</Label>
            <Input value={trigger.value} onChange={(e) => onChange({ ...trigger, value: e.target.value })} />
          </div>
        )}
      </div>
    );
  }
  if (trigger.type === "message_unanswered") {
    return (
      <div>
        <Label>Minutos sin responder</Label>
        <Input
          type="number"
          min={1}
          value={trigger.minutes}
          onChange={(e) => onChange({ ...trigger, minutes: Number(e.target.value) })}
        />
      </div>
    );
  }
  if (trigger.type === "tag_added") {
    return (
      <div>
        <Label>Tag ID (UUID)</Label>
        <Input value={trigger.tagId} onChange={(e) => onChange({ ...trigger, tagId: e.target.value })} />
      </div>
    );
  }
  if (trigger.type === "schedule") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Cron</Label>
          <Input value={trigger.cron} onChange={(e) => onChange({ ...trigger, cron: e.target.value })} placeholder="0 9 * * *" />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input value={trigger.timezone} onChange={(e) => onChange({ ...trigger, timezone: e.target.value })} />
        </div>
      </div>
    );
  }
  return null;
}