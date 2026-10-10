"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Archive, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

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

const POLL_INTERVAL_MS = 8000;

export function ConversationsSidebar({
  initialConversations,
  activeId,
  showArchived = false,
}: {
  initialConversations: Conversation[];
  activeId?: string;
  showArchived?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const orderedRef = useRef<Conversation[]>(initialConversations);

  // Reset local state when the page re-renders with a new server-rendered list
  // (e.g. after a navigation that changes the showArchived filter).
  useEffect(() => {
    setConversations(initialConversations);
    orderedRef.current = initialConversations;
  }, [initialConversations]);

  // Polling fallback: refresh the whole list every 8s (respects showArchived)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/inbox/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showArchived }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { conversations: Conversation[] };
        if (cancelled) return;
        setConversations(json.conversations);
        orderedRef.current = json.conversations;
      } catch {
        /* swallow */
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [showArchived]);

  // Realtime: refresh on UPDATE (last_message_at, preview) for any conversation
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("sidebar-conversations")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        async () => {
          // Re-fetch the list to preserve RLS + correct ordering
          const res = await fetch("/api/inbox/conversations", { method: "POST" });
          if (res.ok) {
            const json = (await res.json()) as { conversations: Conversation[] };
            setConversations(json.conversations);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleShowArchived = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showArchived) {
      params.delete("showArchived");
    } else {
      params.set("showArchived", "1");
    }
    router.push(`/inbox${params.toString() ? "?" + params.toString() : ""}`);
  };

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h2 className="text-sm font-semibold">Inbox</h2>
            <p className="text-xs text-muted-foreground">
              0 conversaciones {showArchived ? "archivadas" : ""}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={toggleShowArchived}
              className="h-3.5 w-3.5"
            />
            Archivados
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-center">
            {showArchived
              ? "No hay conversaciones archivadas."
              : "No hay conversaciones todavía."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">
            {showArchived ? "Archivados" : "Inbox"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {conversations.length} conversación{conversations.length === 1 ? "" : "es"}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={toggleShowArchived}
            className="h-3.5 w-3.5"
          />
          Archivados
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y">
          {conversations.map((c) => {
            const contact = c.contact_channels?.contacts;
            const channelType = c.contact_channels?.channels?.type ?? "whatsapp";
            const isActive = c.id === activeId;
            const name =
              contact?.full_name ||
              contact?.phone_e164 ||
              contact?.email ||
              c.contact_channels?.external_user_id ||
              "Sin nombre";
            return (
              <li key={c.id}>
                <Link
                  href={`/inbox?conversation=${c.id}${
                    showArchived ? "&showArchived=1" : ""
                  }`}
                  className={cn(
                    "flex items-start gap-2 p-3 transition-colors hover:bg-muted/50",
                    isActive && "bg-muted",
                    c.archived_at && "opacity-70",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                    {CHANNEL_ICONS[channelType] ?? "💬"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_message_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                    {c.last_message_preview && (
                      <p
                        className={cn(
                          "truncate text-xs",
                          c.unread_count > 0
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {c.last_message_preview}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        {CHANNEL_LABELS[channelType] ?? channelType}
                      </span>
                      {c.archived_at && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 inline-flex items-center gap-0.5">
                          <Archive className="h-2.5 w-2.5" />
                          Archivado
                        </span>
                      )}
                      {c.unread_count > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}