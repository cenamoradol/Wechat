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
  DialogTrigger,
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

  // Close dropdown on outside click
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
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
      {/* Workspace switcher */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          disabled={switchPending}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
            {active?.name?.slice(0, 1)?.toUpperCase() ?? "W"}
          </div>
          <span className="hidden sm:inline">{active?.name ?? "Sin workspace"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-md border bg-card shadow-lg">
            <div className="p-2">
              <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                Tus workspaces
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {workspaces.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onSwitch(w.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent ${
                        w.id === activeWorkspaceId ? "bg-accent" : ""
                      }`}
                    >
                      <span className="truncate">{w.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
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
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Nuevo workspace para cliente
              </button>
              <Link
                href="/team"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
              >
                <Users className="h-4 w-4" />
                Equipo e invitaciones
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
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
                placeholder="ACME Corp"
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
        <div className="text-right text-sm leading-tight hidden sm:block">
          <div className="font-medium">{userName ?? "Usuario"}</div>
          {userEmail && <div className="text-xs text-muted-foreground">{userEmail}</div>}
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
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}