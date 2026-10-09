"use client";

import { useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { sendMessageAction } from "@/app/(workspace)/inbox/actions";
import { toast } from "sonner";

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [conversationId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await sendMessageAction({
        conversationId,
        text: trimmed,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        setText("");
        // Soft refresh — fetches new server data without full page reload
        // The realtime subscription will also pick this up almost instantly
        router.refresh();
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2 border-t bg-background p-3"
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
        rows={1}
        disabled={isPending}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[40px] flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Button type="submit" disabled={isPending || !text.trim()}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="sr-only">Enviar</span>
      </Button>
    </form>
  );
}