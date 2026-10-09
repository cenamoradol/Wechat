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
  const redirectTo = `${appUrl}/reset-password`;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });
    if (error) {
      console.error("resetPasswordForEmail error:", error.message, "for email:", parsed.data.email);
      return { error: `No se pudo enviar el email: ${error.message}` };
    }
    console.log("resetPasswordForEmail sent to", parsed.data.email, "redirectTo:", redirectTo);
  } catch (e) {
    console.error("resetPasswordForEmail threw:", e);
    return { error: `Error inesperado: ${e instanceof Error ? e.message : "desconocido"}` };
  }

  return { success: `Si el email existe, te hemos enviado un enlace para restablecer tu contraseña a ${redirectTo}.` };
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

  let signOutAttempted = false;
  const safeSignOut = async () => {
    if (signOutAttempted) return;
    signOutAttempted = true;
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("signOut failed:", e);
    }
  };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("updatePasswordAction: no user in session");
      await safeSignOut();
      return { error: "La sesión expiró. Solicita un nuevo enlace de recuperación." };
    }

    console.log("updatePasswordAction: attempting update for user", user.id, user.email);

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.error("updatePasswordAction failed:", error.message, "code:", error.status);
      await safeSignOut();
      return {
        error: `No se pudo cambiar la contraseña: ${error.message}. ¿Estás usando la misma contraseña que la actual?`,
      };
    }

    console.log("updatePasswordAction: success for user", user.id);
    await safeSignOut();
  } catch (e) {
    // Catch anything unexpected so the form gets a normal return value
    // (and we don't leak the recovery session).
    console.error("updatePasswordAction unexpected throw:", e);
    await safeSignOut();
    return {
      error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // If we got here, the update succeeded. Try to redirect.
  try {
    redirect("/login?reset=ok");
  } catch (e) {
    // redirect() always throws — this is the expected path in server actions.
    // The framework catches NEXT_REDIRECT and handles it.
    throw e;
  }
}