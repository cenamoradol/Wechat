"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * Mounts a Supabase Realtime subscription for the inbox.
 *
 * Listens for INSERT on `messages` (filtered by conversation_id when provided)
 * and UPDATE on `conversations` (sidebar previews + last_message_at),
 * then calls router.refresh() with a small debounce so multiple changes in
 * rapid succession result in a single re-render.
 *
 * Renders nothing. Drop into any page that should stay in sync.
 */
export function InboxRealtimeSync({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  // Keep router in a ref so the channel effect doesn't re-run on every render
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => routerRef.current.refresh(), 400);
    };

    const channel = supabase
      .channel(`inbox:${conversationId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(conversationId
            ? { filter: `conversation_id=eq.${conversationId}` }
            : {}),
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        refresh,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return null;
}