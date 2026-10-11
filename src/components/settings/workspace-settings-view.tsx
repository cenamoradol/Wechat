"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, HardDrive, AlertTriangle, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateStorageLimitAction } from "@/app/(workspace)/settings/workspace/actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const MIN_GB = 0.1;
const MAX_GB = 1024;
const DEFAULT_GB = 1;

export function WorkspaceSettingsView({
  workspaceName,
  limitGB,
  usageBytes,
  unlimited: initialUnlimited,
  isOwner,
}: {
  workspaceName: string;
  limitGB: number;
  usageBytes: number;
  unlimited: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unlimited, setUnlimited] = useState(initialUnlimited);
  const [draftLimitGB, setDraftLimitGB] = useState(limitGB);

  const limitBytes = unlimited ? Number.POSITIVE_INFINITY : Math.round(draftLimitGB * 1024 * 1024 * 1024);
  const wouldExceed = !unlimited && usageBytes >= limitBytes;
  const usagePct = unlimited ? 0 : limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0;

  const onSave = () => {
    if (draftLimitGB < MIN_GB || draftLimitGB > MAX_GB) {
      toast.error(`El límite debe estar entre ${MIN_GB} GB y ${MAX_GB} GB`);
      return;
    }
    startTransition(async () => {
      const res = await updateStorageLimitAction({ limitGB: draftLimitGB, unlimited });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Límite de almacenamiento actualizado");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración del workspace</h1>
        <p className="text-sm text-muted-foreground">
          {workspaceName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Almacenamiento de medios
          </CardTitle>
          <CardDescription>
            Los archivos multimedia (imágenes, videos, audios, documentos) se guardan
            en Supabase Storage. Después de 7 días se eliminan automáticamente. Las
            conversaciones archivadas eliminan sus medios inmediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso actual</span>
              <span className="font-medium tabular-nums">
                {formatBytes(usageBytes)}
                {!unlimited && (
                  <span className="text-muted-foreground">
                    {" "}/ {formatBytes(limitBytes)} ({usagePct.toFixed(0)}%)
                  </span>
                )}
                {unlimited && (
                  <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    Sin límite
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${
                  wouldExceed ? "bg-red-500" : usagePct > 80 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: unlimited ? "100%" : `${usagePct}%` }}
              />
            </div>
            {wouldExceed && (
              <p className="mt-2 flex items-start gap-1 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                Tu uso actual ({formatBytes(usageBytes)}) excede el límite actual
                ({formatBytes(limitBytes)}). Los nuevos archivos se bloquearán hasta
                que liberes espacio o aumentes el límite.
              </p>
            )}
          </div>

          {/* Owner controls */}
          {isOwner ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="limitGB">Límite de almacenamiento (GB)</Label>
                <div className="flex items-center gap-2">
                <Input
                  id="limitGB"
                  type="number"
                  step="0.1"
                  min={MIN_GB}
                  max={MAX_GB}
                  value={draftLimitGB}
                  onChange={(e) => setDraftLimitGB(parseFloat(e.target.value) || DEFAULT_GB)}
                  disabled={unlimited}
                  className="max-w-[10rem]"
                />
                  <span className="text-sm text-muted-foreground">GB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mín: {MIN_GB} GB · Máx: {MAX_GB} GB · Default: {DEFAULT_GB} GB
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Sin límite (solo owner — usar con cuidado)</span>
              </label>

              <div className="flex justify-end">
                <Button onClick={onSave} disabled={isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {isPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </>
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Solo el owner puede cambiar el límite de almacenamiento. Contacta al
              owner de este workspace si necesitas más espacio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}