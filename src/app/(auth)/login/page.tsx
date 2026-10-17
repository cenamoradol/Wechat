import { LoginForm } from "@/components/auth/login-form";
import { TerminalWindow } from "@/components/auth/terminal-window";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <main className="grid min-h-svh w-full grid-cols-1 bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* === Left: form === */}
      <section className="flex flex-col justify-between px-6 py-10 sm:px-10 lg:px-14 lg:py-16">
        {/* Wordmark — terminal-style */}
        <header className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary font-mono text-base font-bold text-primary-foreground">
            H
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            hibox // agentes.ia.responden
          </span>
        </header>

        {/* Form block — centered vertically on desktop */}
        <div className="mx-auto w-full max-w-md py-12 lg:py-0">
          {reset === "ok" && (
            <div
              role="status"
              className="mb-6 border-l-2 border-success bg-success/10 px-4 py-3 font-mono text-xs uppercase tracking-wider text-success"
            >
              // contraseña_actualizada — inicia_sesion
            </div>
          )}

          <h1 className="font-mono text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            <span className="text-primary">$</span> agentes.responden
            <span className="animate-pulse text-primary">_</span>
          </h1>

          <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
            whatsapp · instagram · facebook · un inbox
          </p>

          <div className="mt-10">
            <LoginForm next={next} />
          </div>

          <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="opacity-50">// nuevo_aquí · </span>
            <Link
              href={`/signup${nextParam}`}
              className="text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
            >
              crear_workspace
            </Link>
          </p>
        </div>

        {/* Footer — terminal status line */}
        <footer className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground lg:block">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span>v0.1 · sistema_en_línea</span>
            <span aria-hidden>·</span>
            <span>3_canales_conectados</span>
          </div>
        </footer>
      </section>

      {/* === Right: terminal window === */}
      <aside className="hidden bg-surface-container-low lg:flex lg:items-center lg:justify-center lg:p-10">
        <TerminalWindow />
      </aside>
    </main>
  );
}