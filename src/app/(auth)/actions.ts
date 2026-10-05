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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  return { success: "Si el email existe, te hemos enviado un enlace para restablecer tu contraseña." };
}

const UpdatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Al menos una mayúscula")
      .regex(/[0-9]/, "Al menos un número"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

export async function updatePasswordAction(
  input: z.infer<typeof UpdatePasswordSchema>,
): Promise<ActionResult> {
  const parsed = UpdatePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "La sesión expiró. Solicita un nuevo enlace de recuperación." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  // Sign out so the user logs in fresh with the new password
  await supabase.auth.signOut();
  redirect("/login?reset=ok");
}