"use client";

import { useState, useTransition, forwardRef, type InputHTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/app/(auth)/actions";

const Schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
});

type FormValues = z.infer<typeof Schema>;

/* === Terminal underline input — only here, on the portada === */
const TerminalInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TerminalInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={
          "h-12 w-full border-0 border-b border-border bg-transparent px-0 font-sans text-base text-foreground " +
          "placeholder:font-mono placeholder:text-xs placeholder:uppercase placeholder:tracking-[0.2em] placeholder:text-muted-foreground/60 " +
          "focus:border-primary focus:outline-none focus-visible:ring-0 disabled:opacity-50 " +
          (className ?? "")
        }
      />
    );
  },
);

export function LoginForm({ next }: { next?: string }) {
  const [isPending, startTransition] = useTransition();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const res = await loginAction({ ...values, next });
        if (res?.error) toast.error(res.error);
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error("Error inesperado al iniciar sesión");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      {/* Email — terminal underline */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="text-primary">$</span> email
        </label>
        <TerminalInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@empresa.com"
          aria-invalid={errors.email ? "true" : "false"}
          {...register("email")}
          disabled={isPending}
        />
        {errors.email && (
          <p
            role="alert"
            className="font-mono text-xs uppercase tracking-wider text-destructive"
          >
            ! {errors.email.message}
          </p>
        )}
      </div>

      {/* Password — terminal underline with reveal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span className="text-primary">$</span> contraseña
          </label>
          <a
            href="/forgot-password"
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            // olvidar
          </a>
        </div>
        <div className="relative">
          <TerminalInput
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? "true" : "false"}
            {...register("password")}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-0 top-0 grid min-h-12 min-w-12 place-items-center text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p
            role="alert"
            className="font-mono text-xs uppercase tracking-wider text-destructive"
          >
            ! {errors.password.message}
          </p>
        )}
      </div>

      {/* CTA — full width amber, mobile-safe 48px */}
      <button
        type="submit"
        disabled={isPending}
        className="group flex h-12 w-full items-center justify-center gap-2 bg-primary font-mono text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>autenticando...</span>
          </>
        ) : (
          <>
            <span>entrar</span>
            <span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </>
        )}
      </button>
    </form>
  );
}