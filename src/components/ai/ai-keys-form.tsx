"use client";

import { useState, useTransition } from "react";
import { KeyRound, Eye, EyeOff, Trash2, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  saveApiKeyAction,
  deleteApiKeyAction,
  pingProvider,
} from "@/app/(workspace)/ai-agents/actions";

type Provider = "openai" | "anthropic" | "minimax";

const PROVIDERS: Array<{ id: Provider; name: string; helpUrl: string; placeholder: string; testModel: string }> = [
  { id: "openai", name: "OpenAI", helpUrl: "https://platform.openai.com/api-keys", placeholder: "sk-...", testModel: "gpt-4o-mini" },
  { id: "anthropic", name: "Anthropic", helpUrl: "https://console.anthropic.com/settings/keys", placeholder: "sk-ant-...", testModel: "claude-3-5-haiku-latest" },
  { id: "minimax", name: "Minimax", helpUrl: "https://api.minimaxi.com/", placeholder: "sk-cp-...", testModel: "MiniMax-M3" },
];

type Props = {
  initial: Array<{ provider: Provider; configured: boolean; last_used_at: string | null }>;
};

export function AIKeysForm({ initial }: Props) {
  return (
    <div className="space-y-3">
      {PROVIDERS.map((p) => {
        const found = initial.find((i) => i.provider === p.id);
        return <ProviderCard key={p.id} provider={p} configured={found?.configured ?? false} lastUsed={found?.last_used_at ?? null} />;
      })}
    </div>
  );
}

function ProviderCard({ provider, configured, lastUsed }: { provider: typeof PROVIDERS[number]; configured: boolean; lastUsed: string | null }) {
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(!configured);
  const [pending, start] = useTransition();

  const save = () => {
    if (!draft.trim()) return;
    start(async () => {
      // 1) Ping first to fail fast on invalid keys
      const ping = await pingProvider(provider.id, draft.trim(), provider.testModel);
      if (!ping.ok) {
        toast.error(`API key inválida: ${ping.error}`);
        return;
      }
      const res = await saveApiKeyAction(provider.id, draft.trim());
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${provider.name} guardada y verificada`);
      setDraft("");
      setEditing(false);
    });
  };

  const remove = () => {
    if (!confirm(`¿Eliminar la API key de ${provider.name}?`)) return;
    start(async () => {
      const res = await deleteApiKeyAction(provider.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Eliminada");
        setEditing(true);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {provider.name}
        </CardTitle>
        <CardDescription>
          Obtén tu API key en <a href={provider.helpUrl} target="_blank" rel="noreferrer" className="text-primary underline">{provider.helpUrl}</a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!editing && configured ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
              <span className="font-medium text-green-700">Configurada</span>
              {lastUsed && <span className="text-xs text-muted-foreground">· usada {new Date(lastUsed).toLocaleString("es")}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Cambiar</Button>
              <Button variant="ghost" size="icon" onClick={remove} title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? "text" : "password"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={provider.placeholder}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={save} disabled={pending || !draft.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar y probar
              </Button>
              {configured && (
                <Button variant="ghost" onClick={() => { setEditing(false); setDraft(""); }}>
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se prueba con un ping antes de guardar. Si falla, no se guarda.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}