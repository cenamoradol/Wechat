"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  direction: "in" | "out";
  type: string;
  text: string | null;
  status: string | null;
  created_at: string;
  external_id?: string | null;
};

function statusIcon(status: string | null | undefined) {
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

function MessageBubble({ message }: { message: Message }) {
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

const POLL_INTERVAL_MS = 5000;

function dedupeAndMerge(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev;
  const map = new Map<string, Message>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  // Keep array sorted by created_at ASC for chronological order
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

  // Reset messages when the active conversation changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        /* swallow — keep polling */
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [conversationId, messages.length]); // re-arm when conversation changes or when new messages arrive (so sinceISO stays correct)

  // Realtime subscription (best-effort; polling is the source of truth)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => dedupeAndMerge(prev, [newMsg]));
        },
      )
      .subscribe((status) => {
        // Fall back to polling-only if WebSocket fails
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