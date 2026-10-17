import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, MessageSquare, Users, Settings, TrendingUp } from "lucide-react";
import { MessagesChart } from "@/components/dashboard/messages-chart";
import { getMessagesPerDay } from "./queries";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) redirect("/onboarding");

  const admin = createAdminClient();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [conversations, channels, todaysMessages, unreadCount, members, messagesPerDay] = await Promise.all([
    admin
      .from("conversations")
      .select("id, status, last_message_at", { count: "exact" })
      .eq("workspace_id", workspaceId),
    admin
      .from("channels")
      .select("id, type, status", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", "") // we'll use a join in a separate query below
      .gte("created_at", startOfDay),
    admin
      .from("conversations")
      .select("unread_count")
      .eq("workspace_id", workspaceId),
    admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    getMessagesPerDay(workspaceId, 14),
  ]);

  // Count today's messages via a real join
  const { count: todayCount } = await admin
    .from("messages")
    .select("id, conversations!inner(workspace_id)", { count: "exact", head: true })
    .eq("conversations.workspace_id", workspaceId)
    .gte("created_at", startOfDay);

  const openConvs = (conversations.data ?? []).filter((c) => c.status === "open").length;
  const totalUnread = (unreadCount.data ?? []).reduce((acc, r) => acc + (r.unread_count ?? 0), 0);
  const lastConv = (conversations.data ?? []).sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  )[0];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Conversaciones abiertas"
          value={openConvs.toString()}
          icon={Inbox}
        />
        <KpiCard label="Mensajes hoy" value={(todayCount ?? 0).toString()} icon={MessageSquare} />
        <KpiCard
          label="Sin leer"
          value={totalUnread.toString()}
          icon={Inbox}
          highlight={totalUnread > 0}
        />
        <KpiCard label="Canales conectados" value={(channels.count ?? 0).toString()} icon={Settings} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />
              Mensajes recibidos · últimos 14 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MessagesChart data={messagesPerDay} />
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Acciones rápidas</h2>
          <div className="grid gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/inbox">
                <Inbox className="mr-2 h-4 w-4" />
                Abrir el inbox
                {totalUnread > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {totalUnread}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/settings/channels">
                <Settings className="mr-2 h-4 w-4" />
                Conectar un canal
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/team">
                <Users className="mr-2 h-4 w-4" />
                Invitar al equipo
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Actividad reciente</h2>
          {lastConv ? (
            <div className="text-sm">
              <p className="text-muted-foreground">Último mensaje hace</p>
              <p className="mt-1 text-lg font-medium">
                {new Date(lastConv.last_message_at).toLocaleString("es", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay conversaciones. Conecta un canal para empezar.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {(conversations.count ?? 0)} conversaciones · {(channels.count ?? 0)} canales · {members.count ?? 0}{" "}
            miembros
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div
        className={`mt-2 text-3xl font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}