"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  archiveConversationAction,
  unarchiveConversationAction,
  deleteConversationAction,
} from "@/app/(workspace)/inbox/actions";

export function ThreadHeader({
  conversationId,
  contactDisplay,
  channelLabel,
  isArchived,
  userRole,
}: {
  conversationId: string;
  contactDisplay: string;
  channelLabel: string;
  isArchived: boolean;
  userRole: "owner" | "admin" | "agent" | "viewer";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Owner, admin, AND agent can archive/unarchive. Only owner can delete.
  const canArchive = userRole === "owner" || userRole === "admin" || userRole === "agent";
  const canDelete = userRole === "owner";

  const onArchiveToggle = () => {
    startTransition(async () => {
      const res = isArchived
        ? await unarchiveConversationAction(conversationId)
        : await archiveConversationAction(conversationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isArchived ? "Conversación desarchivada" : "Conversación archivada");
      // Stay on the same conversation; revalidate refreshes the data.
    });
  };

  const onDelete = () => {
    if (confirmText.trim() !== contactDisplay.trim()) {
      toast.error("El texto no coincide con el nombre del contacto");
      return;
    }
    startTransition(async () => {
      const res = await deleteConversationAction(conversationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Conversación eliminada");
      setShowDelete(false);
      router.push("/inbox");
    });
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{contactDisplay}</h2>
          <p className="text-xs text-muted-foreground">{channelLabel}</p>
        </div>
        {canArchive && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onArchiveToggle}
            disabled={isPending}
            title={isArchived ? "Desarchivar" : "Archivar"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </Button>
        )}
        {(canArchive || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isPending}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canArchive && (
                <DropdownMenuItem onClick={onArchiveToggle}>
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Desarchivar
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archivar
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => setShowDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar conversación
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar conversación</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán todos los
              mensajes, archivos multimedia y el historial con{" "}
              <strong>{contactDisplay}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Para confirmar, escribe el nombre del contacto:{" "}
              <code className="rounded bg-muted px-1">{contactDisplay}</code>
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={contactDisplay}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isPending || confirmText.trim() !== contactDisplay.trim()}
            >
              {isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}