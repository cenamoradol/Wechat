"use client";

import { useState, useTransition } from "react";
import { Mail, Trash2, Copy, Check } from "lucide-react";
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
                      <Button
                        variant="ghost"
                        size="icon"
                        title={m.user_id === currentUserId ? "Salir" : "Eliminar"}
                        onClick={() => onRemove(m.id, m.user_id === currentUserId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
              <p className="mb-2 font-medium text-blue-900">¡Invitación creada! Comparte este enlace:</p>
              <div className="flex gap-2">
                <Input value={latestInvite.url} readOnly className="bg-white font-mono text-xs" />
                <Button onClick={onCopy} variant="outline" className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-blue-700">
                Expira: {new Date(latestInvite.expiresAt).toLocaleString()}
              </p>
            </div>
          )}

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
                      <Badge className="bg-green-100 text-green-800">Aceptada</Badge>
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