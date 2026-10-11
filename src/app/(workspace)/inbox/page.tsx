import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MessageSquare } from "lucide-react";
import { ReplyBox } from "@/components/inbox/reply-box";
import { resolveMediaUrl } from "@/lib/media/resolve";
import { MessagesList } from "@/components/inbox/messages-list";
import { ConversationsSidebar } from "@/components/inbox/conversations-sidebar";
import { ThreadHeader } from "@/components/inbox/thread-header";

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  archived_at: string | null;
  contact_channels: {
    id: string;
    external_user_id: string;
    contacts: { id: string; full_name: string | null; phone_e164: string | null; email: string | null } | null;
    channels: { id: string; type: string } | null;
  } | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Messenger",
  instagram: "Instagram",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; showArchived?: string }>;
}) {
  unstable_noStore();
  const { conversation: activeId, showArchived } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get user's active workspace (set by topbar dropdown)
  const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();
  const { getActiveWorkspaceIdAction } = await import("@/app/(workspace)/actions");
  const activeWorkspaceId = await getActiveWorkspaceIdAction();
  if (!activeWorkspaceId) redirect("/onboarding");
  const member = { workspace_id: activeWorkspaceId };

  // Get user's role in this workspace (for permission gates in the UI)
  const { data: memberData } = await adminSupabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const userRole = (memberData?.role as "owner" | "admin" | "agent" | "viewer") ?? "viewer";

  // List conversations — filter archived by default unless showArchived=1
  let conversationsQuery = adminSupabase
    .from("conversations")
    .select(
      "id, status, last_message_at, last_message_preview, unread_count, archived_at, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type))",
    )
    .eq("workspace_id", member.workspace_id)
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (showArchived !== "1") {
    conversationsQuery = conversationsQuery.is("archived_at", null);
  }
  const { data: conversations } = await conversationsQuery;

  const convList = (conversations as unknown as Conversation[]) ?? [];

  // When showing archived, allow viewing archived conversation by direct id even if not in top 50
  let activeConv = activeId ? convList.find((c) => c.id === activeId) : convList[0];
  if (!activeConv && activeId) {
    const { data: singleConv } = await adminSupabase
      .from("conversations")
      .select(
        "id, status, last_message_at, last_message_preview, unread_count, archived_at, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type))",
      )
      .eq("id", activeId)
      .maybeSingle();
    activeConv = singleConv as unknown as Conversation | undefined;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left column: conversation list (client component, polls + realtime) */}
      <aside className="hidden w-80 shrink-0 border-r md:flex md:flex-col min-h-0">
        <ConversationsSidebar
          initialConversations={convList as any}
          activeId={activeConv?.id}
          showArchived={showArchived === "1"}
        />
      </aside>

      {/* Center column: active thread */}
      <main className="flex min-w-0 flex-1 flex-col min-h-0">
        {activeConv ? (
          <ActiveThread
            conversationId={activeConv.id}
            isArchived={!!activeConv.archived_at}
            userRole={userRole}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p className="text-sm">
                {showArchived === "1"
                  ? "No hay conversaciones archivadas."
                  : "Selecciona una conversación para empezar"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

async function ActiveThread({
  conversationId,
  isArchived,
  userRole,
}: {
  conversationId: string;
  isArchived: boolean;
  userRole: "owner" | "admin" | "agent" | "viewer";
}) {
  const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();

  // Get conversation detail with contact info
  const { data: conv, error: convErr } = await adminSupabase
    .from("conversations")
    .select(
      "id, contact_channels(id, external_user_id, contacts(id, full_name, phone_e164, email), channels(id, type, display_name))",
    )
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        <p>No se pudo cargar la conversación.</p>
      </div>
    );
  }

  const { data: messages, error: msgErr } = await adminSupabase
    .from("messages")
    .select("id, direction, type, text, status, created_at, sent_by, read_at, external_id, media_url, media_mime, media_filename, media_size_bytes, profiles:profiles!messages_sent_by_fkey(full_name, email)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (msgErr) console.error("messages query failed", msgErr);

  // ponytail: storage is private — rewrite any Supabase storage URLs to
  // the auth-checked /api/media proxy.
  const messagesForClient = (messages ?? []).map((m) => ({
    ...m,
    media_url: resolveMediaUrl(m.media_url),
  }));

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
      <ThreadHeader
        conversationId={conversationId}
        contactDisplay={name}
        channelLabel={`${CHANNEL_LABELS[channelType] ?? channelType} · ${
          contact?.phone_e164 ?? contact?.email ?? (conv as any)?.contact_channels?.external_user_id
        }`}
        isArchived={isArchived}
        userRole={userRole}
      />
      {isArchived && (
        <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
          📦 Esta conversación está archivada. No aparece en el inbox principal. Los
          archivos multimedia fueron eliminados para ahorrar espacio.
        </div>
      )}
      <MessagesList
        conversationId={conversationId}
        initialMessages={messagesForClient as any}
      />
      <ReplyBox conversationId={conversationId} />
    </>
  );
}