import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Hash, AtSign, Mail } from "lucide-react";
import { ReplyBox } from "@/components/inbox/reply-box";
import { MessagesList } from "@/components/inbox/messages-list";
import { ConversationsSidebar } from "@/components/inbox/conversations-sidebar";

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
    <div className="flex h-full min-h-0">
      {/* Left column: conversation list (client component, polls + realtime) */}
      <aside className="hidden w-80 shrink-0 border-r md:flex md:flex-col min-h-0">
        <ConversationsSidebar initialConversations={convList as any} activeId={activeConv?.id} />
      </aside>

      {/* Center column: active thread */}
      <main className="flex min-w-0 flex-1 flex-col min-h-0">
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

  if (msgErr) console.error("messages query failed", msgErr);

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
      <MessagesList
        conversationId={conversationId}
        initialMessages={(messages ?? []) as any}
      />
      <ReplyBox conversationId={conversationId} />
    </>
  );
}