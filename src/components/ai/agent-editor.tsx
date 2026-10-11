"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  createAgentAction,
  updateAgentAction,
  deleteAgentAction,
  testChatAction,
  type AgentFormData,
} from "@/app/(workspace)/ai-agents/actions";

const MODELS: Record<"openai" | "anthropic" | "minimax", Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (rápido, barato)" },
    { value: "gpt-4o", label: "GPT-4o (potente)" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (legacy)" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (recomendado)" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (rápido)" },
    { value: "claude-3-opus-latest", label: "Claude 3 Opus" },
  ],
  minimax: [
    { value: "MiniMax-M3", label: "MiniMax-M3 (recomendado)" },
    { value: "MiniMax-Text-01", label: "MiniMax-Text-01" },
    { value: "abab6.5s-chat", label: "abab6.5s-chat" },
    { value: "abab6.5-chat", label: "abab6.5-chat" },
  ],
};

type Props = {
  initial?: AgentFormData & { id?: string };
  mode: "create" | "edit";
};

export function AgentEditor({ initial, mode }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [data, setData] = useState<AgentFormData>(
    initial ?? {
      name: "",
      description: "",
      provider: "openai",
      model: "gpt-4o-mini",
      system_prompt: "Eres un asistente de atención al cliente amable y conciso. Responde en español. Si no sabes la respuesta, ofrece escalar a un humano.",
      temperature: 0.7,
      max_tokens: 1024,
      kb_enabled: false,
      auto_reply_enabled: false,
      max_replies_per_conversation: 5,
      handoff_keywords: [],
      is_default: false,
    },
  );
  const [kwInput, setKwInput] = useState("");

  const save = () => {
    if (!data.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    if (!data.system_prompt.trim()) {
      toast.error("System prompt requerido");
      return;
    }
    start(async () => {
      const res = mode === "create"
        ? await createAgentAction(data)
        : await updateAgentAction(initial!.id!, data);
      if (res.error) toast.error(res.error);
      else {
        toast.success(mode === "create" ? "Agente creado" : "Actualizado");
        if (mode === "create" && "id" in res && res.id) router.push(`/ai-agents/${res.id}`);
        else router.refresh();
      }
    });
  };

  const remove = () => {
    if (!confirm("¿Eliminar este agente?")) return;
    start(async () => {
      const res = await deleteAgentAction(initial!.id!);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Eliminado");
        router.push("/ai-agents");
      }
    });
  };

  const set = <K extends keyof AgentFormData>(k: K, v: AgentFormData[K]) => setData((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mode === "create" ? "Nuevo agente" : data.name || "Editar agente"}</h1>
          <p className="text-sm text-muted-foreground">Configura el modelo, prompt y comportamiento.</p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <Button variant="ghost" size="icon" onClick={remove} title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save} disabled={pending}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="behavior">Comportamiento</TabsTrigger>
          {mode === "edit" && <TabsTrigger value="test">Probar</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="Asistente de Ventas" />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={data.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  rows={2}
                  placeholder="¿Para qué sirve este agente?"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modelo</CardTitle>
              <CardDescription>Elige el provider y modelo. Usará la API key configurada en Configuración → IA.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider</Label>
                <Select
                  value={data.provider}
                  onValueChange={(v) => {
                    const provider = v as "openai" | "anthropic" | "minimax";
                    set("provider", provider);
                    set("model", MODELS[provider][0].value);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="minimax">Minimax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo</Label>
                <Select value={data.model} onValueChange={(v) => set("model", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS[data.provider].map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperatura: {data.temperature.toFixed(2)}</Label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={data.temperature}
                  onChange={(e) => set("temperature", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">0 = determinista, 1 = balanceado, 2 = creativo</p>
              </div>
              <div>
                <Label>Max tokens</Label>
                <Input
                  type="number"
                  min={50}
                  max={8192}
                  value={data.max_tokens}
                  onChange={(e) => set("max_tokens", Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System prompt</CardTitle>
              <CardDescription>Define la personalidad y reglas del agente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={data.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                rows={16}
                className="font-mono text-sm"
                placeholder="Eres un asistente..."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Variables: <code className="rounded bg-muted px-1">{"{{contact.name}}"}</code> <code className="rounded bg-muted px-1">{"{{contact.phone}}"}</code> <code className="rounded bg-muted px-1">{"{{contact.email}}"}</code>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-respuesta</CardTitle>
              <CardDescription>Si está activo, el agente responde automáticamente a mensajes entrantes de la conversación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-respuesta</Label>
                  <p className="text-xs text-muted-foreground">El agente responde sin intervención humana</p>
                </div>
                <Switch checked={data.auto_reply_enabled} onCheckedChange={(v: boolean) => set("auto_reply_enabled", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Por defecto del workspace</Label>
                  <p className="text-xs text-muted-foreground">Asignar a conversaciones nuevas automáticamente</p>
                </div>
                <Switch checked={data.is_default} onCheckedChange={(v: boolean) => set("is_default", v)} />
              </div>
              <div>
                <Label>Knowledge base (próximamente)</Label>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Usar documentos del agente en las respuestas</p>
                  <Switch checked={data.kb_enabled} onCheckedChange={(v: boolean) => set("kb_enabled", v)} />
                </div>
              </div>
              <div>
                <Label>Max respuestas por conversación: {data.max_replies_per_conversation}</Label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={data.max_replies_per_conversation}
                  onChange={(e) => set("max_replies_per_conversation", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Después de N respuestas, el agente hace handoff a un humano</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Handoff keywords</CardTitle>
              <CardDescription>Si el cliente escribe alguna de estas palabras, se hace handoff a un humano.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {data.handoff_keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {k}
                    <button
                      type="button"
                      onClick={() => set("handoff_keywords", data.handoff_keywords.filter((x) => x !== k))}
                      className="hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  placeholder="humano, agente, queja..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && kwInput.trim()) {
                      e.preventDefault();
                      if (!data.handoff_keywords.includes(kwInput.trim())) {
                        set("handoff_keywords", [...data.handoff_keywords, kwInput.trim().toLowerCase()]);
                      }
                      setKwInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (kwInput.trim() && !data.handoff_keywords.includes(kwInput.trim())) {
                      set("handoff_keywords", [...data.handoff_keywords, kwInput.trim().toLowerCase()]);
                      setKwInput("");
                    }
                  }}
                >
                  Añadir
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {mode === "edit" && (
          <TabsContent value="test">
            <TestChat agentId={initial!.id!} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TestChat({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "user", content: "Hola, ¿cuánto cuesta el plan pro?" },
  ]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    start(async () => {
      const res = await testChatAction({ agentId, messages: next });
      if (res.error) setError(res.error);
      else if (res.content) {
        setMessages((m) => [...m, { role: "assistant", content: res.content! }]);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test chat</CardTitle>
        <CardDescription>Prueba el agente antes de activarlo. No afecta conversaciones reales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-96 space-y-2 overflow-y-auto rounded border bg-muted/20 p-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn2(
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user" ? "ml-auto max-w-[80%] bg-primary text-primary-foreground" : "max-w-[80%] bg-background",
              )}
            >
              {m.content}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> pensando...
            </div>
          )}
          {error && <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribe un mensaje..."
            disabled={pending}
          />
          <Button onClick={send} disabled={pending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function cn2(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(" ");
}