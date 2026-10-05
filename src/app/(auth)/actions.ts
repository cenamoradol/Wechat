"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { limits, getClientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

const SignupSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, "Debe tener al menos una mayúscula").regex(/[0-9]/, "Debe tener al menos un número"),
  next: z.string().optional(),
});

function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

const ForgotSchema = z.object({
  email: z.string().email(),
});

export type ActionResult = { error?: string; success?: string };

export async function loginAction(input: z.infer<typeof LoginSchema>): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const ip = getClientIp(await headers());
  const limit = limits.login(ip);
  if (!limit.ok) return { error: `Demasiados intentos, espera ${Math.ceil(limit.resetIn / 1000)}s` };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Credenciales inválidas" };

  redirect(parsed.data.next || "/dashboard");
}

export async function signupAction(input: z.infer<typeof SignupSchema>): Promise<ActionResult> {
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ip = getClientIp(await headers());
  const limit = limits.signup(ip);
  if (!limit.ok) return { error: `Demasiados intentos, espera ${Math.ceil(limit.resetIn / 1000)}s` };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      // Use the production domain so the verification email link works
      // correctly. Fall back to /onboarding for fresh accounts.
      emailRedirectTo: parsed.data.next
        ? absoluteUrl(parsed.data.next)
        : absoluteUrl("/onboarding"),
    },
  });
  if (error) return { error: error.message };

  // Email confirmation required: no session yet. User must click the link.
  if (!data.session) {
    return {
      success:
        "Te hemos enviado un email de confirmación. Haz click en el enlace para activar tu cuenta y continuar con la configuración.",
    };
  }

  // No email confirmation: session exists. Honor `next` (e.g., coming from invite link)
  // — fall back to onboarding for fresh accounts.
  const safeNext = parsed.data.next?.startsWith("/") ? parsed.data.next : "/onboarding";
  redirect(safeNext);
}

export async function forgotPasswordAction(input: z.infer<typeof ForgotSchema>): Promise<ActionResult> {
  const parsed = ForgotSchema.safeParse(input);
  if (!parsed.success) return { error: "Email inválido" };

  const ip = getClientIp(await headers());
  const limit = limits.forgot(ip);
  if (!limit.ok) return { error: `Demasiados intentos, espera ${Math.ceil(limit.resetIn / 1000)}s` };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  });

  return { success: "Si el email existe, te hemos enviado un enlace para restablecer tu contraseña." };
}