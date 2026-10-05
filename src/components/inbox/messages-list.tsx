"use client";

import { useEffect, useRef, useState } from "react";
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

export function MessagesList({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Reset messages when the conversation changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to new messages for this conversation
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
          setMessages((prev) => {
            // Avoid duplicates if the row was already in initial data
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Avoid duplicates by external_id too
            if (
              newMsg.external_id &&
              prev.some((m) => m.external_id === newMsg.external_id)
            ) {
              return prev;
            }
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

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
    <div
      ref={scrollRef}
      className="h-full min-h-0 flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}