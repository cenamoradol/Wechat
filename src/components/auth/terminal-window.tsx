"use client";

import { useEffect, useState } from "react";

/**
 * TerminalWindow — a static mock of an incoming-message stream.
 * Pure CSS + inline SVG; no animation required for it to feel right.
 * Uses JetBrains Mono for the data feel; no border, just a tone-step window.
 */
export function TerminalWindow() {
  const [now, setNow] = useState<string>("");

  // Light "live" tick — only the timestamp, not the content.
  // Renders nothing on first paint to avoid hydration drift.
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  const lines: Array<{ tag: "WA" | "FB" | "IG" | "SYS"; text: string; name: string }> = [
    { tag: "SYS", name: "—", text: "bandeja.iniciada  canales=3  agentes=2" },
    { tag: "WA", name: "marta_perez", text: "Hola, quería consultar disponibilidad" },
    { tag: "IG", name: "@tienda_cafe", text: "¿Tienen el lote de la semana?" },
    { tag: "FB", name: "daniela.mtz", text: "Buenas tardes, vengo del anuncio" },
    { tag: "WA", name: "+504 9999..", text: "Confirmo para mañana a las 3pm" },
    { tag: "SYS", name: "—", text: "5 mensajes_en_cola · 1 asignado" },
  ];

  const tagColor: Record<typeof lines[number]["tag"], string> = {
    WA: "text-[hsl(var(--channel-whatsapp))]",
    FB: "text-[hsl(var(--channel-facebook))]",
    IG: "text-[hsl(var(--channel-instagram))]",
    SYS: "text-muted-foreground",
  };

  return (
    <div className="w-full max-w-xl">
      {/* Window chrome */}
      <div className="overflow-hidden border border-border bg-card">
        {/* Title bar — three dots + path */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--channel-whatsapp))]" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
            <span
              className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40"
              aria-hidden
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            hibox@agentes ~ live
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {now || "00:00:00"}
          </span>
        </div>

        {/* Body — message stream */}
        <div className="space-y-2 px-5 py-5 font-mono text-[13px] leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`shrink-0 font-bold ${tagColor[line.tag]}`}>
                [{line.tag}]
              </span>
              <span className="shrink-0 text-muted-foreground">{line.name}</span>
              <span className="text-foreground">› {line.text}</span>
            </div>
          ))}

          {/* Cursor line — input affordance */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-primary">›</span>
            <span className="text-foreground">respuesta_pendiente</span>
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-primary" aria-hidden />
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-border bg-surface-container px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>wa · 2 sin leer</span>
          <span>fb · 1</span>
          <span>ig · 2</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            sincronizado
          </span>
        </div>
      </div>

      {/* Caption under the terminal — what it actually is */}
      <p className="mt-4 px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        // inbox en tiempo real · whatsapp + messenger + igdm
      </p>
    </div>
  );
}