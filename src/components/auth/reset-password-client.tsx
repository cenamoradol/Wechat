"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "ready" | "expired" | "no-token";

export function ResetPasswordClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleSession = (sessionEmail: string | null | undefined) => {
      if (cancelled) return;
      if (sessionEmail) {
        setEmail(sessionEmail);
        setStatus("ready");
      } else {
        setStatus("expired");
      }
    };

    // 1) Check for an existing session first (in case user is already mid-recovery)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (session?.user) {
        handleSession(session.user.email);
        return;
      }
      // 2) No session yet — Supabase should pick up the URL fragment tokens
      //    via detectSessionInUrl. Listen for the PASSWORD_RECOVERY event.
      if (subscribedRef.current) return;
      subscribedRef.current = true;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === "PASSWORD_RECOVERY" && session?.user) {
            handleSession(session.user.email);
            subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
          }
        },
      );

      // 3) Fallback: if 8s pass and still no session, treat as expired
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setStatus((s) => (s === "loading" ? "expired" : s));
          subscription.unsubscribe();
        }
      }, 8000);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando enlace…
          </CardTitle>
          <CardDescription>
            Estamos validando tu enlace de recuperación.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enlace inválido o expirado</CardTitle>
          <CardDescription>
            El enlace de recuperación ya no es válido (los enlaces expiran en 1 hora).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Solicitar uno nuevo</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  // status === "ready"
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Restablecer contraseña</CardTitle>
        <CardDescription>
          Hola <strong>{email}</strong>, ingresa tu nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm onSuccess={() => router.push("/login?reset=ok")} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}