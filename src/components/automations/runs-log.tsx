"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Run = {
  id: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
  log: Array<{
    step: number;
    type: string;
    status: string;
    duration_ms: number;
    output?: unknown;
    error?: string;
  }> | null;
};

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function RunsLog({ runs }: { runs: Run[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ejecuciones recientes ({runs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ejecuciones todavía.</p>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => <RunRow key={r.id} run={r} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={run.status} />
          <span className="font-mono text-xs">{run.id.slice(0, 8)}</span>
          <span className="text-xs text-muted-foreground">
            step {run.current_step} · {new Date(run.started_at).toLocaleString("es")}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t bg-muted/10 p-3">
          {!run.log || run.log.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin pasos ejecutados.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {run.log.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-muted-foreground">#{l.step}</span>
                  <span className="font-medium">{l.type}</span>
                  <span className="text-muted-foreground">{l.duration_ms}ms</span>
                  {l.status === "failed" ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle className="h-3 w-3" /> {l.error}
                    </span>
                  ) : l.output ? (
                    <span className="font-mono text-muted-foreground">
                      {JSON.stringify(l.output)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}