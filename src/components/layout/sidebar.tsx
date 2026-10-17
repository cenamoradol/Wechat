"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Settings,
  Contact,
  Zap,
  Bot,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/contacts", label: "Contactos", icon: Contact },
  { href: "/automations", label: "Automatizaciones", icon: Zap },
  { href: "/ai-agents", label: "Agentes IA", icon: Bot },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/settings/profile", label: "Mi perfil", icon: Settings },
  { href: "/settings/notifications", label: "Notificaciones", icon: Bell },
  { href: "/settings/workspace", label: "Workspace", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-container-low md:flex md:flex-col">
      {/* Brand row — terminal header style */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary font-mono text-sm font-bold text-primary-foreground">
          H
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Hibox</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            agentes.ia.responden
          </span>
        </div>
      </div>

      {/* Nav — left rail of amber for active item, no card fill */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface-container hover:text-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-7 w-0.5 bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — system status */}
      <div className="border-t border-border p-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          <span>sistema · en línea</span>
        </div>
      </div>
    </aside>
  );
}