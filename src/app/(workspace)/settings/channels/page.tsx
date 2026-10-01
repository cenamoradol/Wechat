import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChannelConnectDialog } from "@/components/settings/channel-connect-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ChannelRowActions } from "@/components/settings/channel-row-actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: channels } = await supabase
    .from("channels")
    .select("id, type, external_id, display_name, status, last_verified_at, created_at, meta")
    .order("created_at", { ascending: false });

  const byType = {
    whatsapp: channels?.filter((c) => c.type === "whatsapp") ?? [],
    facebook: channels?.filter((c) => c.type === "facebook") ?? [],
    instagram: channels?.filter((c) => c.type === "instagram") ?? [],
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Canales</h1>
          <p className="text-sm text-muted-foreground">
            Conecta WhatsApp, Facebook Messenger e Instagram para empezar a recibir mensajes.
          </p>
        </div>
        <ChannelConnectDialog />
      </div>

      {connected && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✅ Conectados {connected} canal(es). Si falta WhatsApp, configúralo en la pestaña WhatsApp.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          ❌ Error: {error}
        </div>
      )}

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp ({byType.whatsapp.length})</TabsTrigger>
          <TabsTrigger value="facebook">Facebook ({byType.facebook.length})</TabsTrigger>
          <TabsTrigger value="instagram">Instagram ({byType.instagram.length})</TabsTrigger>
        </TabsList>

        {(["whatsapp", "facebook", "instagram"] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-3">
            {byType[t].length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No hay canales de {labelFor(t)} conectados.
                </CardContent>
              </Card>
            ) : (
              byType[t].map((c) => (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{c.display_name}</CardTitle>
                      <CardDescription className="font-mono text-xs">{c.external_id}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === "connected" ? "default" : "destructive"}>
                        {c.status}
                      </Badge>
                      <ChannelRowActions channelId={c.id} type={c.type} />
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Verificado{" "}
                    {c.last_verified_at
                      ? formatDistanceToNow(new Date(c.last_verified_at), { addSuffix: true, locale: es })
                      : "nunca"}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Debug · últimos eventos webhook</CardTitle>
          <CardDescription>
            Para verificar que Meta está enviando webhooks a tu app. Solo service_role puede leerlo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookEventsDebug userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

async function WebhookEventsDebug({ userId }: { userId: string }) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("webhook_events")
    .select("id, type, received_at, processed, error")
    .order("received_at", { ascending: false })
    .limit(10);
  if (!events || events.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin eventos aún.</p>;
  }
  return (
    <ul className="space-y-1 text-xs">
      {events.map((e) => (
        <li key={e.id} className="flex items-center justify-between font-mono">
          <span>{new Date(e.received_at).toLocaleString()}</span>
          <span>{e.type}</span>
          <span>{e.processed ? "✅" : "❌"}</span>
          {e.error && <span className="text-red-600">{e.error}</span>}
        </li>
      ))}
    </ul>
  );
}

function labelFor(t: "whatsapp" | "facebook" | "instagram") {
  return { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram" }[t];
}