import type { ReactNode } from "react";

/**
 * Auth route-group layout.
 *
 * Intentionally minimal — each auth page renders its own layout
 * so login (the portada) and signup can have distinct compositions
 * without fighting the shared shell.
 *
 * Provides the dark canvas and prevents inherited chrome from the
 * workspace layout from leaking in (e.g. the sidebar/topbar).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-background text-foreground">{children}</div>;
}