"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Settings,
  Contact,
  Zap,
  Bot,
  Plus,
  UserPlus,
  Sparkles,
  KeyRound,
} from "lucide-react";

type Item = {
  id: string;
  label: string;
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  keywords?: string[];
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Toggle with Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items: Item[] = [
    // Navigation
    { id: "nav-dashboard", label: "Ir a Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Navegación" },
    { id: "nav-inbox", label: "Ir a Inbox", href: "/inbox", icon: Inbox, group: "Navegación" },
    { id: "nav-contacts", label: "Ir a Contactos", href: "/contacts", icon: Contact, group: "Navegación" },
    { id: "nav-automations", label: "Ir a Automatizaciones", href: "/automations", icon: Zap, group: "Navegación" },
    { id: "nav-ai", label: "Ir a Agentes IA", href: "/ai-agents", icon: Bot, group: "Navegación" },
    { id: "nav-team", label: "Ir a Equipo", href: "/team", icon: Users, group: "Navegación" },
    { id: "nav-settings", label: "Ir a Mi perfil", href: "/settings/profile", icon: Settings, group: "Navegación" },
    { id: "nav-workspace", label: "Ir a Configuración del workspace", href: "/settings/workspace", icon: Settings, group: "Navegación" },
    { id: "nav-channels", label: "Ir a Canales", href: "/settings/channels", icon: Settings, group: "Navegación" },
    { id: "nav-ai-settings", label: "Ir a Configuración IA", href: "/settings/ai", icon: Sparkles, group: "Navegación" },
    { id: "nav-notifications", label: "Ir a Notificaciones", href: "/settings/notifications", icon: KeyRound, group: "Navegación" },

    // Acciones rápidas (placeholder — wired via href since we don't have dialog API yet)
    { id: "act-new-contact", label: "Nuevo contacto", href: "/contacts", icon: Plus, group: "Acciones", keywords: ["crear"] },
    { id: "act-invite", label: "Invitar al equipo", href: "/team", icon: UserPlus, group: "Acciones", keywords: ["invitar"] },
    { id: "act-new-automation", label: "Nueva automatización", href: "/automations/new", icon: Zap, group: "Acciones" },
    { id: "act-new-agent", label: "Nuevo agente IA", href: "/ai-agents/new", icon: Bot, group: "Acciones" },
  ];

  const run = (item: Item) => {
    setOpen(false);
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  };

  if (!open) return null;

  // group items
  const groups = items.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Hibox command palette" className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar una página o acción…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="ml-2 hidden rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sin resultados.
            </Command.Empty>
            {Object.entries(groups).map(([group, list]) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {list.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Command.Item
                      key={it.id}
                      value={`${it.label} ${(it.keywords ?? []).join(" ")}`}
                      onSelect={() => run(it)}
                      className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{it.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              <kbd className="rounded border bg-background px-1.5 py-0.5">↑↓</kbd> navegar
              <span className="mx-2">·</span>
              <kbd className="rounded border bg-background px-1.5 py-0.5">↵</kbd> abrir
            </span>
            <span>
              <kbd className="rounded border bg-background px-1.5 py-0.5">⌘K</kbd>
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}