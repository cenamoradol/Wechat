"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { markAsReadAction } from "@/app/(workspace)/inbox/actions";

type Message = {
  id: string;
  direction: "in" | "out";
  type: string;
  text: string | null;
  status: string | null;
  created_at: string;
  external_id?: string | null;
  read_at?: string | null;
  sent_by?: string | null;
  // Profile of the agent who sent the message (only present for outbound)
  profiles?: { full_name: string | null; email: string | null } | null;
};

function OutStatus({ status, isRead }: { status: string | null | undefined; isRead: boolean }) {
  if (isRead) return <span className="text-sky-300">✓✓</span>;
  if (status === "failed") return <span className="text-red-300">✕</span>;
  if (status === "delivered") return <span>✓✓</span>;
  return <span>✓</span>;
}

function getSenderLabel(m: Message): string | null {
  if (m.direction !== "out") return null;
  if (m.profiles?.full_name) return m.profiles.full_name;
  if (m.profiles?.email) return m.profiles.email.split("@")[0];
  return null;
}

function MessageBubble({ message }: { message: Message }) {
  const isOut = message.direction === "out";
  const isRead = isOut && !!message.read_at;
  const isUnread = !isOut && !message.read_at;
  const senderLabel = getSenderLabel(message);
  const senderInitial = senderLabel?.trim().charAt(0).toUpperCase();
  return (
    <div className={`flex gap-2 ${isOut ? "justify-end" : "justify-start"}`}>
      {!isOut && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {message.profiles?.full_name?.charAt(0).toUpperCase() ?? "?"}
        </div>
      )}
      <div className="max-w-[70%]">
        {isOut && senderLabel && (
          <div className="mb-0.5 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-medium">{senderLabel}</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
              {senderInitial}
            </span>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm shadow-sm transition-colors",
            isOut
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-background",
            isUnread && "ring-2 ring-blue-400/70 font-medium",
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
            {isOut && <OutStatus status={message.status} isRead={isRead} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const POLL_INTERVAL_MS = 5000;

function dedupeAndMerge(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev;
  const map = new Map<string, Message>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function MessagesList({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [liveMode, setLiveMode] = useState<"realtime" | "polling" | "off">("realtime");
  const scrollRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  // Reset messages + scroll when active conversation changes
  useEffect(() => {
    setMessages(initialMessages);
    markedRef.current = conversationId;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark messages as read whenever the thread is shown or new inbound messages arrive
  useEffect(() => {
    const hasUnread = messages.some((m) => m.direction === "in" && !m.read_at);
    if (!hasUnread) return;
    void markAsReadAction(conversationId).then(() => {
      // Local state: mark inbound messages as read so the UI updates without waiting for refresh
      setMessages((prev) =>
        prev.map((m) =>
          m.direction === "in" && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m,
        ),
      );
    });
  }, [conversationId, messages]);

  // Polling fallback (always runs as a safety net)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const last = messages[messages.length - 1]?.created_at;
        const res = await fetch("/api/inbox/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, sinceISO: last }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { messages: Message[] };
        if (cancelled) return;
        if (json.messages.length > 0) {
          setMessages((prev) => dedupeAndMerge(prev, json.messages));
        }
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
  }, [conversationId, messages.length]);

  // Realtime subscription (best-effort)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // INSERT: new message arrived; UPDATE: e.g. read_at was set externally
          const next = { ...(payload.new as Message) };

          // Realtime doesn't include joined tables. If the message has
          // sent_by but no profile, fetch it so we can show who sent it.
          if (next.direction === "out" && next.sent_by && !next.profiles) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", next.sent_by)
              .maybeSingle();
            if (profile) next.profiles = profile;
          }

          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === next.id);
            if (idx === -1) return dedupeAndMerge(prev, [next]);
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveMode("realtime");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLiveMode("polling");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length, messages[messages.length - 1]?.id]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No hay mensajes aún.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-4 space-y-2 bg-muted/20"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-2 bottom-2 text-[10px] text-muted-foreground">
        {liveMode === "realtime" ? "● en vivo" : liveMode === "polling" ? "↻ polling 5s" : "○"}
      </div>
    </div>
  );
}