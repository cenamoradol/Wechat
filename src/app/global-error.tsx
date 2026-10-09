"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <h1 className="mb-2 text-lg font-semibold text-destructive">
              Algo salió mal
            </h1>
            <p className="mb-4 text-sm text-muted-foreground">
              {error.message || "Ha ocurrido un error inesperado."}
            </p>
            {error.digest && (
              <p className="mb-4 text-xs text-muted-foreground">
                ID de error: <code className="rounded bg-muted px-1">{error.digest}</code>
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => reset()}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reintentar
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                Ir al dashboard
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}