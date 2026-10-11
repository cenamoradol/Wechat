import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Sparkles, Bot, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export default async function AIAgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return <div className="p-8 text-muted-foreground">No workspace.</div>;

  const { data: agents } = await supabase
    .from("ai_agents")
    .select("id, name, description, provider, model, auto_reply_enabled, is_default, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const { data: keys } = await supabase
    .from("ai_provider_keys")
    .select("provider, last_used_at, label")
    .eq("workspace_id", workspaceId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes de IA</h1>
          <p className="text-sm text-muted-foreground">
            Crea agentes que responden en tu nombre. Usa OpenAI o Anthropic con tu propia API key.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/ai">
              <KeyRound className="h-4 w-4" />
              API Keys
            </Link>
          </Button>
          <Button asChild>
            <Link href="/ai-agents/new">
              <Plus className="h-4 w-4" />
              Nuevo agente
            </Link>
          </Button>
        </div>
      </div>

      {keys && keys.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-50">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">No has configurado ninguna API key aún</p>
                <p className="text-xs text-muted-foreground">Necesitas al menos una (OpenAI o Anthropic) para usar los agentes.</p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/settings/ai">Configurar</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!agents || agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Bot className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">Sin agentes</h3>
            <p className="text-sm text-muted-foreground">
              Crea tu primer agente para empezar a auto-responder o usar el botón ✨ Sugerir.
            </p>
            <Button asChild className="mt-2">
              <Link href="/ai-agents/new">
                <Plus className="h-4 w-4" />
                Crear agente
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {agents.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/ai-agents/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {a.description ?? "—"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {a.is_default && <Badge className="bg-blue-500/15 text-blue-700">Por defecto</Badge>}
                  {a.auto_reply_enabled && <Badge className="bg-green-500/15 text-green-700">Auto-reply</Badge>}
                  <Badge variant="outline">{a.provider}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Modelo: <code className="rounded bg-muted px-1">{a.model}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}