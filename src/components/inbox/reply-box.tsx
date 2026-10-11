"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendMessageAction, sendMediaMessageAction } from "@/app/(workspace)/inbox/actions";
import { MediaUpload, MediaPreviewList, type UploadedFile } from "./media/media-upload";
import { VoiceRecorder } from "./media/voice-recorder";
import { cn } from "@/lib/utils";

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [showRecorder, setShowRecorder] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [conversationId]);

  const onFilesAdded = (newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setShowRecorder(false); // Hide recorder if files are added
  };

  const onVoiceRecorded = (file: File) => {
    // Synthesize an UploadedFile from the recorded blob
    const previewUrl = URL.createObjectURL(file);
    const id = `vr-${Date.now()}`;
    const uploaded: UploadedFile = {
      id,
      file,
      dataUrl: "", // Filled lazily on submit
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
      previewUrl,
      mediaType: "audio",
    };
    // Read the data URL in advance
    const reader = new FileReader();
    reader.onload = () => {
      uploaded.dataUrl = reader.result as string;
      setFiles((prev) => [...prev, uploaded]);
    };
    reader.readAsDataURL(file);
    setShowRecorder(false);
  };

  const onRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setCaptions((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const onCancel = () => {
    setShowRecorder(false);
  };

  const send = async () => {
    const trimmedText = text.trim();
    const hasText = trimmedText.length > 0;
    const hasFiles = files.length > 0;
    if (!hasText && !hasFiles) return;

    startTransition(async () => {
      // 1. Send each file first (with optional caption)
      let failed = 0;
      for (const f of files) {
        const res = await sendMediaMessageAction({
          conversationId,
          fileDataUrl: f.dataUrl,
          fileName: f.fileName,
          mimeType: f.mimeType,
          caption: captions[f.id] || undefined,
        });
        if (res.error) {
          failed++;
          toast.error(`${f.fileName}: ${res.error}`);
        }
      }
      // 2. If there's also text, send it last
      if (hasText) {
        const res = await sendMessageAction({ conversationId, text: trimmedText });
        if (res.error) {
          toast.error(res.error);
        }
      }
      if (failed === 0) {
        setText("");
        setFiles([]);
        setCaptions({});
        setShowRecorder(false);
        router.refresh();
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    const dt = new DataTransfer();
    imageFiles.forEach((f) => dt.items.add(f));
    onFilesAdded(
      imageFiles.map((f) => ({
        id: `paste-${Date.now()}-${Math.random()}`,
        file: f,
        dataUrl: "",
        mimeType: f.type,
        fileName: f.name || `paste-${Date.now()}.${f.type.split("/")[1] ?? "png"}`,
        sizeBytes: f.size,
        previewUrl: URL.createObjectURL(f),
        mediaType: "image" as const,
      })),
    );
    // We need dataUrl; load asynchronously per file
    imageFiles.forEach((f, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles((prev) =>
          prev.map((p) =>
            p.id.startsWith("paste-") && p.fileName === f.name
              ? { ...p, dataUrl: reader.result as string }
              : p,
          ),
        );
      };
      reader.readAsDataURL(f);
    });
  };

  const canSend = !isPending && (text.trim().length > 0 || files.length > 0);

  return (
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
          <VoiceRecorder onRecorded={onVoiceRecorded} onCancel={onCancel} />
          <span className="text-xs text-muted-foreground">
            Toca ■ para detener
          </span>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 p-3"
      >
        <MediaUpload onFilesAdded={onFilesAdded} />
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
  );
}