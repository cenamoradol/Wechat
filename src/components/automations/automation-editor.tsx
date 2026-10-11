"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  createAutomationAction,
  updateAutomationAction,
  type AutomationFormData,
} from "@/app/(workspace)/automations/actions";
import { listAutomationOptionsAction } from "@/app/(workspace)/automations/options-action";
import type { Step, Trigger } from "@/lib/automations/types";
import { AddStepMenu, StepForm, defaultStepFor, validateStep } from "@/components/automations/step-form";

type Props = {
  initial?: AutomationFormData & { id?: string };
};

const TRIGGER_LABELS: Array<{ value: Trigger["type"]; label: string; description: string }> = [
  { value: "message_received", label: "Mensaje recibido", description: "Cuando un cliente escribe" },
  { value: "message_unanswered", label: "Mensaje sin responder", description: "Pasado X minutos sin respuesta" },
  { value: "contact_created", label: "Contacto nuevo", description: "Cuando llega un contacto nuevo" },
  { value: "tag_added", label: "Etiqueta añadida", description: "Cuando se etiqueta al contacto" },
  { value: "schedule", label: "Programado (cron)", description: "Corre según horario" },
  { value: "ai_classify", label: "🤖 Clasificar con IA", description: "El LLM decide según un criterio en lenguaje natural" },
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
  const [options, setOptions] = useState<{
    tags: Array<{ id: string; name: string; color: string }>;
    templates: Array<{ id: string; name: string; language: string }>;
    members: Array<{ id: string; full_name: string | null; email: string }>;
    customFields: Array<{ id: string; name: string; type: string }>;
    aiAgents: Array<{ id: string; name: string; provider: string; model: string }>;
  }>({ tags: [], templates: [], members: [], customFields: [], aiAgents: [] });

  useEffect(() => {
    listAutomationOptionsAction()
      .then((res) => {
        if (res.error) return;
        setOptions({
          tags: res.tags ?? [],
          templates: res.templates ?? [],
          members: res.members ?? [],
          customFields: res.customFields ?? [],
          aiAgents: res.aiAgents ?? [],
        });
      })
      .catch((e) => console.error(e));
  }, []);

  const save = () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      const err = validateStep(steps[i]);
      if (err) {
        toast.error(`Step #${i + 1}: ${err}`);
        return;
      }
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

  const addStep = (type: Step["type"]) => {
    setSteps((prev) => [...prev, defaultStepFor(type)]);
  };
  const updateStep = (i: number, s: Step) => {
    setSteps((prev) => prev.map((x, j) => (j === i ? s : x)));
  };
  const removeStep = (i: number) => {
    setSteps((prev) => prev.filter((_, j) => j !== i));
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = prev.slice();
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{initial?.id ? "Editar automatización" : "Nueva automatización"}</h1>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
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
        <CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader>
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
        <CardHeader><CardTitle className="text-base">Trigger</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select
              value={trigger.type}
              onValueChange={(v) => setTrigger(defaultTriggerFor(v as Trigger["type"]))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_LABELS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — <span className="text-muted-foreground">{t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TriggerFields trigger={trigger} onChange={setTrigger} options={options} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Steps ({steps.length})</CardTitle>
          <AddStepMenu onAdd={addStep} />
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 ? (
            <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay steps. Haz click en "Añadir step" para empezar.
            </p>
          ) : (
            steps.map((step, i) => (
              <StepForm
                key={i}
                step={step}
                index={i}
                options={options}
                onChange={(s) => updateStep(i, s)}
                onRemove={() => removeStep(i)}
                onMoveUp={i > 0 ? () => moveStep(i, -1) : undefined}
                onMoveDown={i < steps.length - 1 ? () => moveStep(i, 1) : undefined}
              />
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
    case "ai_classify":
      return { type: "ai_classify", agentId: "", criteria: "" };
  }
}

function TriggerFields({
  trigger,
  onChange,
  options,
}: {
  trigger: Trigger;
  onChange: (t: Trigger) => void;
  options: {
    tags: Array<{ id: string; name: string; color: string }>;
    aiAgents: Array<{ id: string; name: string; provider: string; model: string }>;
  };
}) {
  if (trigger.type === "ai_classify") {
    return (
      <div className="space-y-3">
        <div>
          <Label>Agente (provee el modelo)</Label>
          <Select
            value={trigger.agentId}
            onValueChange={(v) => onChange({ ...trigger, agentId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona agente IA" />
            </SelectTrigger>
            <SelectContent>
              {options.aiAgents && options.aiAgents.length > 0 ? (
                options.aiAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.provider} · {a.model})
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-xs text-muted-foreground">
                  Sin agentes. Crea uno en /ai-agents.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Criterio (en lenguaje natural)</Label>
          <Textarea
            value={trigger.criteria}
            onChange={(e) => onChange({ ...trigger, criteria: e.target.value })}
            rows={3}
            placeholder='Ej: "El cliente quiere hablar con un humano o está frustrado"'
          />
          <p className="mt-1 text-xs text-muted-foreground">
            El LLM recibe el último mensaje y responde con {"{matches: true/false, reasoning: '...'}"} según si cumple el criterio.
          </p>
        </div>
      </div>
    );
  }
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
            <Input value={trigger.value} onChange={(e) => onChange({ ...trigger, value: e.target.value })} placeholder="palabra clave, regex, etc." />
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
        <Label>Etiqueta</Label>
        <Select value={trigger.tagId} onValueChange={(v) => onChange({ ...trigger, tagId: v })}>
          <SelectTrigger><SelectValue placeholder="Selecciona etiqueta" /></SelectTrigger>
          <SelectContent>
            {options.tags.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">Sin etiquetas.</div>
            ) : (
              options.tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">O pega el UUID: {trigger.tagId}</p>
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