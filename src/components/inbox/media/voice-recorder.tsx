"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = "idle" | "recording" | "stopped" | "unsupported";

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
    // Check browser support
    if (typeof window !== "undefined") {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setState("unsupported");
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
    if (state === "unsupported") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // ponytail: prefer audio/mp4 (Safari + WhatsApp friendly). Chrome
      // records webm; for those we fall back, and the server action will
      // reject the upload with a clear error telling the user to use
      // Safari or upload an audio file.
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
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        // Use a sensible filename. Browsers don't expose the original mic name.
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
        onRecorded(file);
        setState("idle");
      };
      recorder.start();
      startTsRef.current = Date.now();
      setState("recording");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
      }, 250);
    } catch (e) {
      console.error("voiceRecorder: getUserMedia failed", e);
      setState("idle");
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
      // Discard the recording by stopping and overriding onstop
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

  if (state === "unsupported") return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-red-50 px-2 py-1",
        state === "recording" && "ring-2 ring-red-400",
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
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}