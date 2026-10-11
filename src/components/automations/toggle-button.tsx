"use client";

import { useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleAutomationAction } from "@/app/(workspace)/automations/actions";
import { toast } from "sonner";

export function ToggleAutomationButton({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [pending, start] = useTransition();
  const isActive = currentStatus === "active";
  return (
    <Button
      variant="ghost"
      size="icon"
      title={isActive ? "Pausar" : "Activar"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = isActive ? "paused" : "active";
          const res = await toggleAutomationAction(id, next);
          if (res.error) toast.error(res.error);
        })
      }
    >
      {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </Button>
  );
}