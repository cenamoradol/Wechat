// src/lib/auth/admin-users.ts
// Server-side helpers for managing a member's LOGIN credentials.
//
// Why this exists: agents join via an invite link, which requires them to
// receive an email (Supabase confirmation + our invite). In practice the
// agent often has no access to their own mailbox — the dealership owner
// hands them a login over the phone. So owner/admin can provision the
// account directly (already confirmed, no email needed) and later correct
// the email or reset the password.
//
// Invariant enforced by callers (see team/actions.ts): only owner/admin may
// call these, and only an owner may touch another owner's credentials.

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Password that satisfies the app's own policy (>=8 chars, one uppercase,
 * one digit) without ambiguous glyphs. Returns it in plain text ONCE for the
 * admin to hand over — we never store it.
 */
export function generatePassword(): string {
  // No i/l/1/0/O/I/o — these get misread over the phone.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  if (!/[A-Z]/.test(out)) out = "A" + out.slice(0, 15);
  if (!/[0-9]/.test(out)) out = out.slice(0, 15) + "7";
  return out;
}

export type CreateUserResult =
  | { error: string }
  | { userId: string; email: string; created: boolean };

/**
 * Create (or reuse) a confirmed auth user. `email_confirm: true` is the whole
 * point: no confirmation email, the account can log in right away.
 *
 * The handle_new_user trigger creates the matching profiles row on INSERT,
 * so we don't create it by hand.
 */
export async function createConfirmedUser(args: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<CreateUserResult> {
  const admin = createAdminClient();
  const email = args.email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name: args.fullName ?? "" },
  });

  if (!error && data?.user) {
    return { userId: data.user.id, email, created: true };
  }

  // The account may already exist (they signed up on their own, or on another
  // workspace). Reuse it instead of failing — we only need the id to attach
  // the membership.
  if (error && /already|registered|exists/i.test(error.message)) {
    const existing = await findUserByEmail(email);
    if (existing) {
      return { userId: existing.id, email: existing.email ?? email, created: false };
    }
    return { error: "Ya existe una cuenta con ese email" };
  }

  return { error: `No se pudo crear el usuario: ${error?.message ?? "error desconocido"}` };
}

/**
 * Look up an auth user by email.
 *
 * ponytail: supabase-js does NOT expose from("auth.users") — the auth schema
 * isn't in the PostgREST API — so the only way is auth.admin.listUsers(),
 * which paginates. We scan the pages until we find them; the cost only
 * matters on the "user already exists" path, which is rare.
 */
async function findUserByEmail(
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const admin = createAdminClient();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers failed", { page, error: error.message });
      return null;
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return { id: hit.id, email: hit.email };
    if (users.length < perPage) break; // last page
  }
  return null;
}

/**
 * Update a user's login credentials.
 *
 * ponytail: the handle_new_user trigger is AFTER INSERT only, so changing
 * auth.users.email does NOT propagate to profiles.email — we update it
 * explicitly or the inbox would keep showing the old address.
 */
export async function updateUserCredentials(args: {
  userId: string;
  email?: string;
  password?: string;
}): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const patch: Parameters<typeof admin.auth.admin.updateUserById>[1] = {};

  if (args.email) {
    patch.email = args.email.trim().toLowerCase();
    // Changing the address must not re-introduce a confirmation step.
    patch.email_confirm = true;
  }
  if (args.password) patch.password = args.password;

  if (Object.keys(patch).length === 0) return { error: "No hay nada que actualizar" };

  const { error } = await admin.auth.admin.updateUserById(args.userId, patch);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  if (patch.email) {
    const { error: pErr } = await admin
      .from("profiles")
      .update({ email: patch.email })
      .eq("id", args.userId);
    if (pErr) {
      console.error("profiles.email sync failed", { userId: args.userId, error: pErr.message });
    }
  }

  return {};
}
