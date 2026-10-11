"use client";

import { useState } from "react";
import { Download, FileText, Film, Music, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSizeBytes: number | null;
  type: string;
  isOut: boolean;
};

/**
 * Renders the media part of a message. Falls back to a "Media no disponible"
 * placeholder when the URL is missing (e.g. cleaned up after 7 days).
 */
export function MediaBubble({
  mediaUrl,
  mediaMime,
  mediaFilename,
  mediaSizeBytes,
  type,
  isOut,
}: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!mediaUrl) {
    return <MissingMedia type={type} filename={mediaFilename} isOut={isOut} />;
  }

  if (type === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxUrl(mediaUrl)}
          className="block max-w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          title="Click para agrandar"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={mediaFilename ?? "imagen"}
            className="max-h-72 max-w-full cursor-zoom-in object-cover"
            loading="lazy"
          />
        </button>
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 text-white hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
            >
              <X className="h-5 w-5" />
            </Button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt={mediaFilename ?? "imagen"}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  if (type === "video") {
    return (
      <video
        src={mediaUrl}
        controls
        preload="metadata"
        className="max-h-72 max-w-full rounded-lg"
      />
    );
  }

  if (type === "audio") {
    return (
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 opacity-60" />
        <audio src={mediaUrl} controls preload="metadata" className="h-8" />
      </div>
    );
  }

  // document / fallback
  return <DocumentLink url={mediaUrl} filename={mediaFilename} sizeBytes={mediaSizeBytes} mime={mediaMime} isOut={isOut} />;
}

function MissingMedia({
  type,
  filename,
  isOut,
}: {
  type: string;
  filename: string | null;
  isOut: boolean;
}) {
  const icon = type === "image" ? (
    <ImageIcon className="h-5 w-5" />
  ) : type === "video" ? (
    <Film className="h-5 w-5" />
  ) : type === "audio" ? (
    <Music className="h-5 w-5" />
  ) : (
    <FileText className="h-5 w-5" />
  );
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs italic opacity-70",
        isOut ? "border-primary-foreground/40" : "border-muted-foreground/30",
      )}
    >
      {icon}
      <span>
        {filename ?? `[${type}]`} —{" "}
        <span className="not-italic font-medium">Media no disponible</span>
      </span>
    </div>
  );
}

function DocumentLink({
  url,
  filename,
  sizeBytes,
  mime,
  isOut,
}: {
  url: string;
  filename: string | null;
  sizeBytes: number | null;
  mime: string | null;
  isOut: boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={filename ?? true}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:underline",
        isOut
          ? "border-primary-foreground/30 text-primary-foreground"
          : "border-border text-foreground",
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={filename ?? mime ?? "archivo"}>
          {filename ?? mime ?? "archivo"}
        </p>
        {sizeBytes != null && (
          <p className="text-[10px] opacity-70">{formatBytes(sizeBytes)}</p>
        )}
      </div>
      <Download className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}