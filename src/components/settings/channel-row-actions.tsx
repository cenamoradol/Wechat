"use client";

import { useTransition } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteChannelAction, reVerifyChannelAction } from "@/app/(workspace)/settings/channels/actions";

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

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" onClick={onReVerify} disabled={isPending} title="Re-verificar">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending} title="Desconectar">
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}