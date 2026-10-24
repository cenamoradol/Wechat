"use client";

import { useState, useTransition } from "react";
import { Mail, Trash2, Copy, Check, UserPlus, Pencil, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInviteAction,
  revokeInviteAction,
  removeMemberAction,
} from "@/app/(workspace)/actions";
import {
  createUserAction,
  updateMemberCredentialsAction,
} from "@/app/(workspace)/team/actions";
import { toast } from "sonner";

type Member = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "agent" | "viewer";
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Invite = {
  id: string;
  token: string;
  email: string | null;
  role: "owner" | "admin" | "agent" | "viewer";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function TeamView({
  workspace,
  currentUserId,
  currentUserRole,
  members,
  invites,
}: {
  workspace: { id: string; name: string; slug: string };
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "agent" | "viewer";
  members: Member[];
  invites: Invite[];
}) {
  const isManager = ["owner", "admin"].includes(currentUserRole);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [creating, setCreating] = useState(false);
  const [latestInvite, setLatestInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  const onCreateInvite = () => {
    if (creating) return;
    setCreating(true);
    createInviteAction({
      workspaceId: workspace.id,
      email: inviteEmail.trim() || undefined,
      role: inviteRole,
    }).then((res) => {
      setCreating(false);
      if (res.error || !res.url) {
        toast.error(res.error ?? "No se pudo crear la invitación");
        return;
      }
      setLatestInvite({ url: res.url, expiresAt: res.expiresAt! });
      setInviteEmail("");
      setShowInvite(false);
      toast.success("Invitación creada");
    });
  };

  const onCopy = async () => {
    if (!latestInvite) return;
    await navigator.clipboard.writeText(latestInvite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Nuevo usuario con acceso directo (sin confirmación por email) ---
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserResult, setNewUserResult] = useState<{ email: string; password: string; created: boolean } | null>(null);
  const [credsCopied, setCredsCopied] = useState(false);

  const onGeneratePassword = () => {
    // Client-side generation is fine here: it never leaves the browser until
    // the admin submits the form, and it's shown back for them to hand over.
    const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    let out = "";
    for (const b of buf) out += alphabet[b % alphabet.length];
    if (!/[A-Z]/.test(out)) out = "A" + out.slice(0, 15);
    if (!/[0-9]/.test(out)) out = out.slice(0, 15) + "7";
    setNewPassword(out);
  };

  const onCreateUser = () => {
    if (creatingUser) return;
    setCreatingUser(true);
    createUserAction({
      email: newEmail.trim(),
      password: newPassword,
      fullName: newName.trim() || undefined,
      role: newRole,
    }).then((res) => {
      setCreatingUser(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Keep the credentials on screen so the admin can copy them before
      // closing — we never store the password.
      setNewUserResult({ email: res.email ?? newEmail.trim(), password: newPassword, created: res.created ?? true });
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setShowCreate(false);
      toast.success(res.created ? "Usuario creado" : "Ya existía; agregado al workspace");
    });
  };

  const onCopyCreds = async () => {
    if (!newUserResult) return;
    await navigator.clipboard.writeText(
      `Email: ${newUserResult.email}\nContraseña: ${newUserResult.password}`,
    );
    setCredsCopied(true);
    setTimeout(() => setCredsCopied(false), 2000);
  };

  // --- Editar credenciales de un miembro ---
  const [editing, setEditing] = useState<Member | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const onOpenEdit = (m: Member) => {
    setEditing(m);
    setEditEmail(m.email);
    setEditPassword("");
  };

  const onSaveEdit = () => {
    if (!editing) return;
    setSavingEdit(true);
    const emailChanged = editEmail.trim().toLowerCase() !== editing.email.toLowerCase();
    updateMemberCredentialsAction({
      userId: editing.user_id,
      ...(emailChanged ? { email: editEmail.trim() } : {}),
      ...(editPassword ? { password: editPassword } : {}),
    }).then((res) => {
      setSavingEdit(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Credenciales actualizadas");
      setEditing(null);
    });
  };

  const onRevoke = (inviteId: string) => {
    startTransition(async () => {
      const res = await revokeInviteAction(inviteId);
      if (res.error) toast.error(res.error);
      else toast.success("Invitación revocada");
    });
  };

  const onRemove = (memberId: string, isSelf: boolean) => {
    const msg = isSelf
      ? "¿Salir de este workspace?"
      : "¿Eliminar este miembro del workspace?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await removeMemberAction(memberId);
      if (res.error) toast.error(res.error);
      else toast.success(isSelf ? "Saliste del workspace" : "Miembro eliminado");
    });
  };

  const pendingInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const expiredInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) <= new Date());
  const acceptedInvites = invites.filter((i) => i.accepted_at);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-sm text-muted-foreground">
          Workspace <strong>{workspace.name}</strong>
        </p>
      </div>

      {/* Miembros */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Miembros ({members.length})
          </h2>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Persona</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {(m.full_name ?? m.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{m.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{m.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isManager && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar email y contraseña"
                          onClick={() => onOpenEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={m.user_id === currentUserId ? "Salir" : "Eliminar"}
                          onClick={() => onRemove(m.id, m.user_id === currentUserId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invitaciones */}
      {isManager && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Invitaciones ({pendingInvites.length} activas)
            </h2>
            <Dialog open={showInvite} onOpenChange={setShowInvite}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="mr-2 h-4 w-4" />
                  Invitar miembro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar miembro</DialogTitle>
                  <DialogDescription>
                    Genera un enlace único que puedes compartir. La persona que lo abra se unirá a este workspace con el rol seleccionado.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email (opcional, solo tracking)</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colaborador@empresa.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={inviteRole} onValueChange={(v: string) => setInviteRole(v as typeof inviteRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="viewer">Viewer (solo lectura)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowInvite(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={onCreateInvite} disabled={creating}>
                    {creating ? "Creando…" : "Crear enlace"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {latestInvite && (
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
              <p className="mb-2 font-medium text-accent">Invitación creada. Comparte este enlace:</p>
              <div className="flex gap-2">
                <Input value={latestInvite.url} readOnly className="bg-background font-mono text-xs" />
                <Button onClick={onCopy} variant="outline" className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Expira: {new Date(latestInvite.expiresAt).toLocaleString()}
              </p>
            </div>
          )}

          {/* Credenciales del usuario recién creado — se muestran una sola vez */}
          {newUserResult && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
              <p className="mb-2 font-medium text-success">
                {newUserResult.created ? "Usuario creado" : "Usuario ya existía y fue agregado"}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Compartí estas credenciales. La contraseña no se vuelve a mostrar.
              </p>
              <div className="space-y-1 rounded bg-background p-2 font-mono text-xs">
                <div>Email: {newUserResult.email}</div>
                <div>Contraseña: {newUserResult.password}</div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button onClick={onCopyCreds} variant="outline" size="sm">
                  {credsCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copiar credenciales
                </Button>
                <Button onClick={() => setNewUserResult(null)} variant="ghost" size="sm">
                  Ya las copié
                </Button>
              </div>
            </div>
          )}

          {/* Crear acceso directo, sin confirmación por email */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Añadir usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir usuario con acceso directo</DialogTitle>
                <DialogDescription>
                  Crea la cuenta ya activada — sin email de confirmación. Ideal cuando la
                  persona no tiene acceso a su correo. Le das las credenciales en mano.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Nombre</Label>
                  <Input
                    id="new-name"
                    placeholder="Nombre y apellido"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="vendedor@empresa.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newRole} onValueChange={(v: string) => setNewRole(v as typeof newRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="viewer">Viewer (solo lectura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Contraseña temporal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-password"
                      value={newPassword}
                      placeholder="Mínimo 8, 1 mayúscula y 1 número"
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="font-mono"
                    />
                    <Button type="button" variant="outline" onClick={onGeneratePassword}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Generar
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={onCreateUser}
                  disabled={creatingUser || !newEmail.trim() || !newPassword}
                >
                  {creatingUser ? "Creando…" : "Crear y activar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Editar credenciales de un miembro */}
          <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar acceso</DialogTitle>
                <DialogDescription>
                  Corregí el email o restablecé la contraseña de {editing?.full_name ?? editing?.email}.
                  Deja la contraseña vacía para no cambiarla.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
                  <Input
                    id="edit-password"
                    placeholder="Vacío = mantener la actual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button onClick={onSaveEdit} disabled={savingEdit}>
                  {savingEdit ? "Guardando…" : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="overflow-hidden rounded-lg border bg-card">
            {pendingInvites.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay invitaciones pendientes.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Rol</th>
                    <th className="px-4 py-2.5">Expira</th>
                    <th className="px-4 py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingInvites.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3">{inv.email ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{inv.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRevoke(inv.id)}
                          title="Revocar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* Aceptadas + Expiradas — solo visible si hay */}
      {isManager && (acceptedInvites.length > 0 || expiredInvites.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Historial de invitaciones
          </h2>
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {acceptedInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-muted-foreground">{inv.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-success/15 text-success">Aceptada</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.accepted_at ? new Date(inv.accepted_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRevoke(inv.id)} title="Eliminar del historial">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {expiredInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-muted-foreground">{inv.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">Expirada</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRevoke(inv.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}