import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido a Wechat. Fase 1: autenticación funcionando.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Conversaciones abiertas", value: "0" },
          { label: "Mensajes hoy", value: "0" },
          { label: "Tiempo medio respuesta", value: "—" },
          { label: "Contactos", value: "0" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Próximas fases: canales Meta (Fase 2), inbox unificado (Fase 3), automatizaciones (Fase 6),
        AI agents (Fase 7). Por ahora el dashboard es placeholder.
      </div>
    </div>
  );
}