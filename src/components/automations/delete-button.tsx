"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAutomationAction } from "@/app/(workspace)/automations/actions";
import { toast } from "sonner";

export function DeleteAutomationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Eliminar"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Eliminar esta automatización?")) return;
        start(async () => {
          const res = await deleteAutomationAction(id);
          if (res.error) toast.error(res.error);
          else {
            toast.success("Eliminada");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}