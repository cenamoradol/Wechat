"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { transcodeToMp3 } from "@/lib/audio/transcode";
import { toast } from "sonner";

type State = "idle" | "recording" | "transcoding" | "error";

export function VoiceRecorder({
  onRecorded,
  onCancel,
}: {
  onRecorded: (file: File) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setState("error");
      }
    }
    return () => {
      stopTimer();
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const start = async () => {
    if (state === "error") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // ponytail: prefer audio/mp4 (Safari + WhatsApp friendly).
      // Chrome records webm; we transcode to mp3 after recording.
      const mime = MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")
        ? "audio/mp4;codecs=mp4a.40.2"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mpeg";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const isAlreadyMp3 = mime.startsWith("audio/mp4") || mime.startsWith("audio/mpeg");
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
        const rawName = `voice-${Date.now()}.${ext}`;

        if (isAlreadyMp3) {
          const file = new File([blob], rawName, { type: mime.split(";")[0] });
          onRecorded(file);
          setState("idle");
          return;
        }

        // Chrome (or other webm/ogg) — transcode to mp3 for WhatsApp.
        setState("transcoding");
        try {
          const mp3 = await transcodeToMp3(blob);
          const file = new File([mp3], rawName.replace(/\.[a-z0-9]+$/i, ".mp3"), { type: "audio/mpeg" });
          onRecorded(file);
          setState("idle");
        } catch (e) {
          console.error("transcode failed", e);
          toast.error("No se pudo procesar el audio. Intenta de nuevo o sube un mp3/m4a.");
          setState("error");
        }
      };
      recorder.start();
      startTsRef.current = Date.now();
      setState("recording");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
      }, 250);
    } catch (e) {
      console.error("voiceRecorder: getUserMedia failed", e);
      toast.error("No se pudo acceder al micrófono");
      setState("error");
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    stopTimer();
  };

  const cancel = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopTimer();
    setState("idle");
    onCancel();
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
        <Mic className="h-3.5 w-3.5" />
        <span>Micrófono no disponible. Sube un mp3 o m4a.</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-red-50 px-2 py-1",
        state === "recording" && "ring-2 ring-red-400",
        state === "transcoding" && "ring-2 ring-amber-400",
      )}
    >
      {state === "idle" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Grabar nota de voz"
          onClick={start}
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      {state === "recording" && (
        <>
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-mono tabular-nums">
            {formatTime(elapsed)}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={stop} title="Detener">
            <Square className="h-4 w-4 fill-red-500 text-red-500" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={cancel} title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      {state === "transcoding" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
          <span className="text-xs">Convirtiendo a MP3 (primera vez puede tardar ~10s)…</span>
        </>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}