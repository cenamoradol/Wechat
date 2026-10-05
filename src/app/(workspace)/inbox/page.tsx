import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { MessageSquare, Hash, AtSign, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReplyBox } from "@/components/inbox/reply-box";

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  contact_channels: {
    id: string;
    external_user_id: string;
    contacts: { id: string; full_name: string | null; phone_e164: string | null; email: string | null } | null;
    channels: { id: string; type: string } | null;
  } | null;
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  facebook: "f",
  instagram: "📷",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Messenger",
  instagram: "Instagram",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  unstable_noStore();
  const { conversation: activeId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get user's workspace
  const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();
  const { data: member } = await adminSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/onboarding");

  // List conversations
  const { data: conversations } = await adminSupabase
    .from("conversations")
    .select(
      "id, status, last_message_at, last_message_preview, unread_count, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type))",
    )
    .eq("workspace_id", member.workspace_id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  const convList = (conversations as unknown as Conversation[]) ?? [];
  const activeConv = activeId ? convList.find((c) => c.id === activeId) : convList[0];
  const activeIdToUse = activeConv?.id;

  return (
    <div className="flex h-full">
      {/* Left column: conversation list */}
      <aside className="hidden w-80 shrink-0 border-r md:flex md:flex-col">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {convList.length} conversación{convList.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convList.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
              No hay conversaciones todavía.
              <br />
              Envía un mensaje a tu número de WhatsApp para probar.
            </div>
          ) : (
            <ul className="divide-y">
              {convList.map((c) => {
                const contact = c.contact_channels?.contacts;
                const channelType = c.contact_channels?.channels?.type ?? "whatsapp";
                const isActive = c.id === activeIdToUse;
                const name =
                  contact?.full_name ||
                  contact?.phone_e164 ||
                  contact?.email ||
                  c.contact_channels?.external_user_id ||
                  "Sin nombre";
                return (
                  <li key={c.id}>
                    <Link
                      href={`/inbox?conversation=${c.id}`}
                      className={cn(
                        "flex items-start gap-2 p-3 transition-colors hover:bg-muted/50",
                        isActive && "bg-muted",
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                        {CHANNEL_ICONS[channelType] ?? "💬"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last_message_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                        {c.last_message_preview && (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.last_message_preview}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {CHANNEL_LABELS[channelType] ?? channelType}
                          </span>
                          {(c.unread_count ?? 0) > 0 && (
                            <Badge variant="default" className="h-4 px-1 text-[10px]">
                              {c.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Center column: active thread */}
      <main className="flex min-w-0 flex-1 flex-col">
        {activeConv ? (
          <ActiveThread conversationId={activeConv.id} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p className="text-sm">Selecciona una conversación para empezar</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

async function ActiveThread({ conversationId }: { conversationId: string }) {
  const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();

  // Get conversation detail with contact info
  const { data: conv, error: convErr } = await adminSupabase
    .from("conversations")
    .select(
      "id, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type, display_name))",
    )
    .eq("id", conversationId)
    .single();

  const { data: messages, error: msgErr } = await adminSupabase
    .from("messages")
    .select("id, direction, type, text, status, created_at, sent_by")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  // Diagnostic strip — always visible during debugging
  const debug = {
    convId: conversationId,
    convFound: !!conv,
    convErr: convErr?.message ?? null,
    msgCount: messages?.length ?? 0,
    msgErr: msgErr?.message ?? null,
    firstMsg: messages?.[0]?.text?.slice(0, 50) ?? null,
    lastMsg: messages?.[messages.length - 1]?.text?.slice(0, 50) ?? null,
  };

  const contact = (conv as any)?.contact_channels?.contacts;
  const channel = (conv as any)?.contact_channels?.channels;
  const channelType = channel?.type ?? "whatsapp";
  const name =
    contact?.full_name ||
    contact?.phone_e164 ||
    contact?.email ||
    "Sin nombre";

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            {CHANNEL_ICONS[channelType]}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{name}</h2>
            <p className="text-xs text-muted-foreground">
              {CHANNEL_LABELS[channelType]} ·{" "}
              {contact?.phone_e164 ?? contact?.email ?? (conv as any)?.contact_channels?.external_user_id}
            </p>
          </div>
        </div>
        <Badge variant="outline">{channel?.display_name ?? channelType}</Badge>
      </header>
      {debug && (
        <div className="border-b bg-yellow-50 px-4 py-2 text-xs text-yellow-900">
          <strong>Debug:</strong> {JSON.stringify(debug)} · conv_id={conversationId} · messages count={messages?.length ?? 0}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {(messages ?? []).length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No hay mensajes aún.
          </div>
        ) : (
          (messages ?? []).map((m: any) => (
            <MessageBubble key={m.id} message={m} />
          ))
        )}
      </div>
      <ReplyBox conversationId={conversationId} />
    </>
  );
}

function MessageBubble({ message }: { message: any }) {
  const isOut = message.direction === "out";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isOut
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-background",
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.text ?? <em className="opacity-60">[{message.type}]</em>}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            isOut ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <time>
            {new Date(message.created_at).toLocaleTimeString("es", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {isOut && <span>{statusIcon(message.status)}</span>}
        </div>
      </div>
    </div>
  );
}

function statusIcon(status: string | null) {
  switch (status) {
    case "sent":
      return "✓";
    case "delivered":
      return "✓✓";
    case "read":
      return "✓✓";
    case "failed":
      return "✕";
    default:
      return "";
  }
}