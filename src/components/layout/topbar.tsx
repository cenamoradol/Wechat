"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(workspace)/actions";

export function Topbar({ userName, userEmail }: { userName?: string; userEmail?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">Workspace</div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm leading-tight">
          <div className="font-medium">{userName ?? "Usuario"}</div>
          {userEmail && <div className="text-xs text-muted-foreground">{userEmail}</div>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          onClick={() => startTransition(() => signOutAction())}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}