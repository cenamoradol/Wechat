"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, X, ImageIcon, Film, FileText, Music, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_FILE_BYTES = 16 * 1024 * 1024; // 16 MB (WhatsApp hard limit)

export type UploadedFile = {
  id: string;
  file: File;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  /** Object URL for local preview (revoked on unmount) */
  previewUrl: string;
  /** Detected media type for Meta */
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

export function MediaUpload({
  onFilesAdded,
  compact = false,
}: {
  onFilesAdded: (files: UploadedFile[]) => void;
  compact?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (rawFiles: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
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
      try {
        const dataUrl = await readAsDataUrl(file);
        newFiles.push({
          id: `f-${++fileIdCounter}`,
          file,
          dataUrl,
          mimeType: file.type,
          fileName: file.name,
          sizeBytes: file.size,
          previewUrl: URL.createObjectURL(file),
          mediaType,
        });
      } catch (e) {
        toast.error(`Error leyendo ${file.name}`);
      }
    }
    if (newFiles.length > 0) onFilesAdded(newFiles);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative",
        isDragging && "ring-2 ring-primary",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          // Reset so the same file can be picked again
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Adjuntar archivo"
        onClick={() => fileInputRef.current?.click()}
        className={cn(compact && "h-8 w-8")}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Compact preview row for already-attached files, with X to remove. */
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
    // Revoke object URLs on unmount
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