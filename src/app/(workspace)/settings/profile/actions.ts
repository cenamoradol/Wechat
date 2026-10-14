"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ProfileSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
});

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Contraseña actual requerida"),
    next: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export type ProfileResult = { error?: string; ok?: boolean };

export async function updateProfileAction(
  input: z.infer<typeof ProfileSchema>,
): Promise<ProfileResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  // auth.users metadata (display name)
  await supabase.auth.updateUser({ data: { full_name: parsed.data.full_name } });

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.full_name, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(
  input: z.infer<typeof PasswordSchema>,
): Promise<ProfileResult> {
  const parsed = PasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "No has iniciado sesión" };

  // Re-authenticate with current credentials. signInWithPassword fails fast on wrong password.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (signInErr) return { error: "La contraseña actual es incorrecta" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) return { error: error.message };

  return { ok: true };
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ProfileResult & { url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No has iniciado sesión" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Archivo inválido" };
  if (file.size > 2 * 1024 * 1024) return { error: "Máximo 2 MB" };
  if (!file.type.startsWith("image/")) return { error: "Solo imágenes" };

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const path = `${user.id}/avatar.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  // cache-bust so updated avatars appear immediately
  const url = `${publicUrl}?t=${Date.now()}`;

  const { error: profErr } = await admin
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  await supabase.auth.updateUser({ data: { avatar_url: url } });

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true, url };
}