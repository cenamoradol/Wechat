"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Mic, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendMessageAction, sendMediaMessageAction } from "@/app/(workspace)/inbox/actions";
import {
  MediaDropZone,
  MediaPreviewList,
  MediaUploadButton,
  ensureDataUrl,
  type UploadedFile,
} from "./media/media-upload";
import { VoiceRecorder } from "./media/voice-recorder";
import { suggestReplyAction } from "@/app/(workspace)/inbox/ai-suggest-action";
import { cn } from "@/lib/utils";

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [showRecorder, setShowRecorder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [aiSuggest, setAiSuggest] = useState<{ text: string; sources: Array<{ id: string; title: string; snippet: string }> } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const onSuggest = () => {
    setIsSuggesting(true);
    setAiSuggest(null);
    void (async () => {
      const res = await suggestReplyAction({ conversationId });
      if (res.error) {
        toast.error(res.error);
      } else if (res.content) {
        setAiSuggest({ text: res.content, sources: res.sources ?? [] });
      }
      setIsSuggesting(false);
    })();
  };

  const useAiSuggestion = () => {
    if (aiSuggest) {
      setText(aiSuggest.text);
      setAiSuggest(null);
      ref.current?.focus();
    }
  };

  useEffect(() => {
    ref.current?.focus();
  }, [conversationId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (rawFiles: File[]) => {
    const newFiles: UploadedFile[] = rawFiles.map((f) => {
      // ponytail: FileReader/our data-URL regex can't handle MIME params
      // like `audio/webm;codecs=opus` — strip them so uploads work.
      const cleanMime = (f.type || "application/octet-stream").split(";")[0].trim();
      const mediaType = (cleanMime.startsWith("image/")
        ? "image"
        : cleanMime.startsWith("video/")
        ? "video"
        : cleanMime.startsWith("audio/")
        ? "audio"
        : "document") as UploadedFile["mediaType"];
      return {
        id: `f-${++fileIdCounter}-${Date.now()}`,
        file: f,
        dataUrl: "",
        mimeType: cleanMime,
        fileName: f.name,
        sizeBytes: f.size,
        previewUrl: URL.createObjectURL(f),
        mediaType,
      };
    });
    setFiles((prev) => [...prev, ...newFiles]);
    setShowRecorder(false);
  };

  const onVoiceRecorded = (file: File) => {
    addFiles([file]);
    setShowRecorder(false);
  };

  const onRemoveFile = (id: string) => {
    setFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
    setCaptions((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const send = async () => {
    const trimmedText = text.trim();
    const hasText = trimmedText.length > 0;
    const hasFiles = files.length > 0;
    if (!hasText && !hasFiles) return;

    startTransition(async () => {
      // 1. Send each file first (with optional caption).
      //    dataUrl is read here so we never have a stale empty string.
      let failed = 0;
      for (const f of files) {
        try {
          const dataUrl = await ensureDataUrl(f);
          const res = await sendMediaMessageAction({
            conversationId,
            fileDataUrl: dataUrl,
            fileName: f.fileName,
            mimeType: f.mimeType,
            caption: captions[f.id] || undefined,
          });
          if (res.error) {
            failed++;
            toast.error(`${f.fileName}: ${res.error}`);
          }
        } catch (e) {
          failed++;
          toast.error(`${f.fileName}: ${e instanceof Error ? e.message : "Error"}`);
        }
      }
      // 2. Then send text (if any)
      if (hasText) {
        const res = await sendMessageAction({ conversationId, text: trimmedText });
        if (res.error) toast.error(res.error);
      }
      if (failed === 0) {
        setText("");
        files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setFiles([]);
        setCaptions({});
        setShowRecorder(false);
        router.refresh();
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    addFiles(imageFiles);
  };

  const canSend = !isPending && (text.trim().length > 0 || files.length > 0);

  return (
    <MediaDropZone
      onFiles={addFiles}
      isDragging={isDragging}
      setIsDragging={setIsDragging}
    >
      <div className="border-t bg-background">
        {files.length > 0 && (
          <MediaPreviewList
            files={files}
            onRemove={onRemoveFile}
            isUploading={isPending}
            onCaptionChange={(id, cap) =>
              setCaptions((prev) => ({ ...prev, [id]: cap }))
            }
            captions={captions}
          />
        )}
        {showRecorder && (
          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 p-2">
            <VoiceRecorder onRecorded={onVoiceRecorded} onCancel={() => setShowRecorder(false)} />
            <span className="text-xs text-muted-foreground">
              Toca ■ para detener
            </span>
          </div>
        )}
        {isDragging && (
          <div className="border-2 border-dashed border-primary bg-primary/5 p-4 text-center text-xs font-medium text-primary">
            Suelta el archivo aquí para adjuntarlo
          </div>
        )}
        {aiSuggest && (
          <div className="border-t bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Sugerencia de IA
              </p>
              <button
                type="button"
                onClick={() => setAiSuggest(null)}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{aiSuggest.text}</p>
            {aiSuggest.sources.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                📚 {aiSuggest.sources.map((s) => s.title).join(", ")}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={useAiSuggestion} type="button">
                Usar
              </Button>
              <Button size="sm" variant="ghost" onClick={onSuggest} type="button">
                Regenerar
              </Button>
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 p-3"
        >
          <MediaUploadButton onFilesAdded={addFiles} isDisabled={isPending} />
          <Button
            type="button"
            variant={showRecorder ? "default" : "ghost"}
            size="icon"
            title="Grabar nota de voz"
            onClick={() => setShowRecorder((v) => !v)}
            disabled={isPending}
          >
            <Mic className={cn("h-4 w-4", showRecorder && "text-red-500")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Sugerir respuesta con IA"
            onClick={onSuggest}
            disabled={isPending || isSuggesting}
          >
            {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
          </Button>
          <Textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter nueva línea)"
            rows={1}
            disabled={isPending}
            className="min-h-[40px] flex-1 resize-none"
          />
          <Button type="submit" disabled={!canSend}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Enviar</span>
          </Button>
        </form>
      </div>
    </MediaDropZone>
  );
}
let fileIdCounter = 0;
