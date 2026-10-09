"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";

const ContactSchema = z.object({
  full_name: z.string().min(1).max(200).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone_e164: z.string().regex(/^\+[1-9]\d{1,14}$/, "Formato: +50433330274").optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export type ContactInput = z.infer<typeof ContactSchema>;
export type ContactActionResult = { error?: string; id?: string };

async function requireActiveWorkspace(): Promise<
  { error: string } | { workspaceId: string }
> {
  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) return { error: "No tienes workspace activo" };
  return { workspaceId };
}

export async function createContactAction(
  input: ContactInput,
): Promise<ContactActionResult> {
  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  if (!parsed.data.full_name && !parsed.data.email && !parsed.data.phone_e164) {
    return { error: "Proporciona al menos nombre, email o teléfono" };
  }
  const ws = await requireActiveWorkspace();
  if ("error" in ws) return { error: ws.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .insert({
      workspace_id: ws.workspaceId,
      full_name: parsed.data.full_name || null,
      email: parsed.data.email || null,
      phone_e164: parsed.data.phone_e164 || null,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags ?? [],
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return { id: data.id };
}

export async function updateContactAction(
  id: string,
  input: ContactInput,
): Promise<ContactActionResult> {
  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const ws = await requireActiveWorkspace();
  if ("error" in ws) return { error: ws.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("contacts")
    .update({
      full_name: parsed.data.full_name || null,
      email: parsed.data.email || null,
      phone_e164: parsed.data.phone_e164 || null,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags ?? [],
    })
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { id };
}

export async function deleteContactAction(id: string): Promise<{ error?: string }> {
  const ws = await requireActiveWorkspace();
  if ("error" in ws) return { error: ws.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return {};
}

const BulkTagSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(500),
  tagsToAdd: z.array(z.string().min(1).max(40)).max(20).default([]),
  tagsToRemove: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export async function bulkTagContactsAction(
  input: z.infer<typeof BulkTagSchema>,
): Promise<{ error?: string; updated?: number }> {
  const parsed = BulkTagSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  if (parsed.data.tagsToAdd.length === 0 && parsed.data.tagsToRemove.length === 0) {
    return { error: "No hay tags para aplicar" };
  }
  const ws = await requireActiveWorkspace();
  if ("error" in ws) return { error: ws.error };

  const admin = createAdminClient();
  let updated = 0;
  // Use individual updates so we can do per-contact diff (add/remove different tags).
  for (const id of parsed.data.contactIds) {
    const { data: current } = await admin
      .from("contacts")
      .select("tags")
      .eq("id", id)
      .eq("workspace_id", ws.workspaceId)
      .maybeSingle();
    if (!current) continue;
    const set = new Set<string>((current.tags ?? []).map((t) => t.toLowerCase()));
    for (const t of parsed.data.tagsToAdd) set.add(t.toLowerCase());
    for (const t of parsed.data.tagsToRemove) set.delete(t.toLowerCase());
    const next = Array.from(set);
    const { error } = await admin
      .from("contacts")
      .update({ tags: next })
      .eq("id", id)
      .eq("workspace_id", ws.workspaceId);
    if (!error) updated++;
  }
  revalidatePath("/contacts");
  return { updated };
}

const ImportRowSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone_e164: z.string().regex(/^\+[1-9]\d{1,14}$/).optional().or(z.literal("")),
  tags: z.string().optional(), // comma-separated
  notes: z.string().max(2000).optional(),
});

const ImportPayloadSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(1000),
});

export async function importContactsAction(
  input: z.infer<typeof ImportPayloadSchema>,
): Promise<{ error?: string; imported?: number; skipped?: number }> {
  const parsed = ImportPayloadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const ws = await requireActiveWorkspace();
  if ("error" in ws) return { error: ws.error };
  const admin = createAdminClient();

  let imported = 0;
  let skipped = 0;
  for (const row of parsed.data.rows) {
    if (!row.full_name && !row.email && !row.phone_e164) {
      skipped++;
      continue;
    }
    const tags = (row.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 40);
    // Skip if email or phone_e164 already exists in workspace
    if (row.email) {
      const { data: exists } = await admin
        .from("contacts")
        .select("id")
        .eq("workspace_id", ws.workspaceId)
        .eq("email", row.email)
        .maybeSingle();
      if (exists) {
        skipped++;
        continue;
      }
    }
    if (row.phone_e164) {
      const { data: exists } = await admin
        .from("contacts")
        .select("id")
        .eq("workspace_id", ws.workspaceId)
        .eq("phone_e164", row.phone_e164)
        .maybeSingle();
      if (exists) {
        skipped++;
        continue;
      }
    }
    const { error } = await admin.from("contacts").insert({
      workspace_id: ws.workspaceId,
      full_name: row.full_name || null,
      email: row.email || null,
      phone_e164: row.phone_e164 || null,
      notes: row.notes || null,
      tags,
    });
    if (error) {
      skipped++;
    } else {
      imported++;
    }
  }
  revalidatePath("/contacts");
  return { imported, skipped };
}