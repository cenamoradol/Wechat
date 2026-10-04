"use client";

import { useState, useTransition } from "react";
import { Trash2, RefreshCw, KeyRound, Webhook, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import {
  deleteChannelAction,
  reVerifyChannelAction,
  subscribeWebhooksAction,
  updateChannelTokenAction,
} from "@/app/(workspace)/settings/channels/actions";

export function ChannelRowActions({
  channelId,
  type,
}: {
  channelId: string;
  type: "whatsapp" | "facebook" | "instagram";
}) {
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm(`¿Desconectar este canal de ${type}?`)) return;
    startTransition(async () => {
      const res = await deleteChannelAction(channelId);
      if (res?.error) toast.error(res.error);
      else toast.success("Canal desconectado");
    });
  };

  const onReVerify = () => {
    startTransition(async () => {
      const res = await reVerifyChannelAction(channelId);
      if (res?.error) toast.error(res.error);
      else toast.success("Canal verificado");
    });
  };

  const onSubscribe = () => {
    startTransition(async () => {
      const res = await subscribeWebhooksAction(channelId);
      if (res?.error) {
        toast.error(res.error, { duration: 8000 });
      } else {
        toast.success(res.success ?? "Webhooks suscritos", { duration: 6000 });
      }
    });
  };

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onSubscribe}
        disabled={isPending}
        title="Re-suscribir webhooks"
      >
        <Webhook className="h-4 w-4" />
      </Button>
      <UpdateTokenDialog channelId={channelId} />
      <Button variant="ghost" size="icon" onClick={onReVerify} disabled={isPending} title="Re-verificar">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending} title="Desconectar">
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

function UpdateTokenDialog({ channelId }: { channelId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState("");

  const onSubmit = () => {
    startTransition(async () => {
      const res = await updateChannelTokenAction(channelId, token.trim());
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Token actualizado. Refresca el panel de diagnóstico.");
        setOpen(false);
        setToken("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Actualizar token">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar access token</DialogTitle>
          <DialogDescription>
            Pega aquí el nuevo token del System User. El sistema verificará contra Meta antes de
            guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new_token">Access Token</Label>
          <Input
            id="new_token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAxxxxxx..."
          />
          <p className="text-xs text-muted-foreground">
            Si tu token no tiene los 7 scopes requeridos, regenera el System User token con
            business_management, pages_show_list, pages_messaging, instagram_basic,
            instagram_manage_messages, whatsapp_business_management, whatsapp_business_messaging.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !token}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}