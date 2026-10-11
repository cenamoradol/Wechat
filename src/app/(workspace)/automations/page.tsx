import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Zap, Pause, Play, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleAutomationButton } from "@/components/automations/toggle-button";
import { DeleteAutomationButton } from "@/components/automations/delete-button";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) {
    return (
      <div className="p-8 text-muted-foreground">No hay workspace activo.</div>
    );
  }

  const { data: automations } = await supabase
    .from("automations")
    .select("id, name, description, status, run_count, last_run_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Triggers + steps no-code para responder, etiquetar, asignar, esperar y más.
          </p>
        </div>
        <Button asChild>
          <Link href="/automations/new">
            <Plus className="h-4 w-4" />
            Nueva
          </Link>
        </Button>
      </div>

      {!automations || automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Zap className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">Sin automatizaciones</h3>
            <p className="text-sm text-muted-foreground">
              Crea tu primera para responder automáticamente cuando un cliente escriba una palabra clave.
            </p>
            <Button asChild className="mt-2">
              <Link href="/automations/new">
                <Plus className="h-4 w-4" />
                Crear automatización
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {automations.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/automations/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {a.description ?? "—"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <ToggleAutomationButton id={a.id} currentStatus={a.status} />
                  <DeleteAutomationButton id={a.id} />
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{a.run_count} ejecuciones</span>
                {a.last_run_at && (
                  <span>última: {new Date(a.last_run_at).toLocaleString("es")}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-500/15 text-green-700">Activa</Badge>;
  if (status === "paused") return <Badge variant="secondary">Pausada</Badge>;
  return <Badge variant="outline">Borrador</Badge>;
}