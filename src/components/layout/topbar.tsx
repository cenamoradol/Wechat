"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, LogOut, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAction } from "@/app/(workspace)/actions";
import {
  createWorkspaceAction,
  switchWorkspaceAction,
  type WorkspaceListItem,
} from "@/app/(workspace)/actions";
import { toast } from "sonner";

export function Topbar({
  userName,
  userEmail,
  workspaces,
  activeWorkspaceId,
}: {
  userName?: string;
  userEmail?: string;
  workspaces: WorkspaceListItem[];
  activeWorkspaceId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchPending, startSwitch] = useTransition();
  const [signoutPending, startSignout] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  // Creating a workspace mints a tenant with you as owner — owner/admin only,
  // matching createWorkspaceAction. Hide it so agents don't discover it by
  // clicking and bouncing off a toast.
  const canCreateWorkspace = active?.role === "owner" || active?.role === "admin";

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onSwitch = (id: string) => {
    setOpen(false);
    startSwitch(async () => {
      const res = await switchWorkspaceAction(id);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  };

  const onCreate = () => {
    if (!newName.trim()) return;
    setCreating(true);
    createWorkspaceAction({ name: newName.trim() }).then((res) => {
      setCreating(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Workspace creado");
      setNewName("");
      setShowCreate(false);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-container-low px-4 sm:px-6">
      {/* Workspace switcher — terminal underline style */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex min-h-11 items-center gap-2 rounded-sm border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:border-primary hover:text-foreground"
          disabled={switchPending}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            {active?.name?.slice(0, 1)?.toUpperCase() ?? "H"}
          </span>
          <span className="font-mono text-xs uppercase tracking-wider">
            {active?.name ?? "sin_workspace"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-sm border border-border bg-popover">
            <div className="p-2">
              <div className="px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                // tus_workspaces
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {workspaces.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onSwitch(w.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-surface-container ${
                        w.id === activeWorkspaceId ? "bg-primary/10 text-foreground" : ""
                      }`}
                    >
                      <span className="truncate">{w.name}</span>
                      <span className="rounded-sm border border-border bg-surface-container px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {w.role}
                      </span>
                    </button>
                  </li>
                ))}
                {workspaces.length === 0 && (
                  <li className="px-2 py-3 text-sm text-muted-foreground">
                    Aún no tienes workspaces.
                  </li>
                )}
              </ul>
              <div className="my-1 h-px bg-border" />
              {canCreateWorkspace && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(true);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-surface-container"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo workspace para cliente
                </button>
              )}
              {canCreateWorkspace && (
                <Link
                  href="/team"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-surface-container"
                >
                  <Users className="h-4 w-4" />
                  Equipo e invitaciones
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-surface-container"
              >
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
            </div>
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nuevo workspace</DialogTitle>
              <DialogDescription>
                Crea un espacio aislado para un nuevo cliente. Tú serás el owner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Nombre del cliente / empresa</Label>
              <Input
                id="workspace-name"
                placeholder="acme_corp"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreate();
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={onCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creando…" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* User menu */}
      <div className="flex items-center gap-3">
        <div className="hidden text-right text-sm leading-tight sm:block">
          <div className="font-medium">{userName ?? "Usuario"}</div>
          {userEmail && (
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {userEmail}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={signoutPending}
          onClick={() =>
            startSignout(async () => {
              await signOutAction();
            })
          }
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="min-h-11 min-w-11"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}