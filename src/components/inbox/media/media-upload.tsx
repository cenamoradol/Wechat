"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X, ImageIcon, Film, FileText, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_FILE_BYTES = 16 * 1024 * 1024; // 16 MB (WhatsApp hard limit)

export type UploadedFile = {
  id: string;
  file: File;
  dataUrl: string; // populated on demand
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  previewUrl: string;
  mediaType: "image" | "video" | "audio" | "document";
};

function detectMediaType(mime: string): UploadedFile["mediaType"] | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime === "application/pdf" ||
    mime.includes("msword") ||
    mime.includes("officedocument") ||
    mime.includes("ms-excel") ||
    mime.includes("spreadsheetml") ||
    mime === "text/plain"
  ) {
    return "document";
  }
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

let fileIdCounter = 0;

/**
 * Read dataUrl for a file, lazy-encoding. Returns the dataUrl string.
 * Used right before sending so we don't have stale dataUrl in state.
 */
export async function ensureDataUrl(f: UploadedFile): Promise<string> {
  if (f.dataUrl) return f.dataUrl;
  const url = await readAsDataUrl(f.file);
  // Mutate to cache (same reference is in state)
  f.dataUrl = url;
  return url;
}

let _dragCounter = 0;

/**
 * Wraps the ReplyBox area and provides a large drop zone. Renders the
 * paperclip button that opens the file picker. Calls onFiles when files
 * are added (from picker, drag, paste, or voice).
 */
export function MediaDropZone({
  onFiles,
  children,
  isDragging,
  setIsDragging,
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  isDragging: boolean;
  setIsDragging: (b: boolean) => void;
}) {
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        _dragCounter++;
        if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        _dragCounter--;
        if (_dragCounter <= 0) {
          _dragCounter = 0;
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        _dragCounter = 0;
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn("relative", isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-md")}
    >
      {children}
    </div>
  );
}

export function MediaUploadButton({
  onFilesAdded,
  isDisabled,
}: {
  onFilesAdded: (files: File[]) => void;
  isDisabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (rawFiles: FileList | File[]) => {
    const valid: File[] = [];
    for (const file of Array.from(rawFiles)) {
      const mediaType = detectMediaType(file.type);
      if (!mediaType) {
        toast.error(`Tipo no soportado: ${file.type || "desconocido"}`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} excede 16 MB`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) onFilesAdded(valid);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Adjuntar archivo"
        onClick={() => fileInputRef.current?.click()}
        disabled={isDisabled}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
}

export function MediaPreviewList({
  files,
  onRemove,
  isUploading,
  uploadProgress,
  onCaptionChange,
  captions,
}: {
  files: UploadedFile[];
  onRemove: (id: string) => void;
  isUploading: boolean;
  uploadProgress?: Record<string, number>;
  onCaptionChange?: (id: string, caption: string) => void;
  captions?: Record<string, string>;
}) {
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t bg-muted/30 p-2">
      {files.map((f) => {
        const progress = uploadProgress?.[f.id];
        const caption = captions?.[f.id] ?? "";
        return (
          <div
            key={f.id}
            className="relative flex w-48 flex-col gap-1 rounded-md border bg-background p-2 text-xs"
          >
            <div className="flex items-start gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {f.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.previewUrl}
                    alt={f.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MediaTypeIcon type={f.mediaType} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={f.fileName}>
                  {f.fileName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(f.sizeBytes)} · {f.mediaType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                disabled={isUploading}
                className="rounded-full p-0.5 hover:bg-muted"
                title="Quitar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {onCaptionChange && (
              <input
                type="text"
                value={caption}
                onChange={(e) => onCaptionChange(f.id, e.target.value)}
                placeholder="Caption (opcional)"
                disabled={isUploading}
                className="w-full rounded border bg-background px-1.5 py-1 text-xs"
              />
            )}
            {isUploading && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MediaTypeIcon({ type }: { type: UploadedFile["mediaType"] }) {
  const cls = "h-4 w-4 text-muted-foreground";
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "video") return <Film className={cls} />;
  if (type === "audio") return <Music className={cls} />;
  return <FileText className={cls} />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}