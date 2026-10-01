"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboardingAction } from "./actions";

const Schema = z.object({
  workspace_name: z.string().min(1, "Requerido").max(100),
  timezone: z.string(),
});

type FormValues = z.infer<typeof Schema>;

const TIMEZONES = [
  { value: "America/Tegucigalpa", label: "Tegucigalpa (Honduras, CST UTC-6)" },
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/Guatemala", label: "Guatemala (UTC-6)" },
  { value: "America/Costa_Rica", label: "Costa Rica (UTC-6)" },
  { value: "America/El_Salvador", label: "El Salvador (UTC-6)" },
  { value: "America/Managua", label: "Managua, Nicaragua (UTC-6)" },
  { value: "America/Bogota", label: "Bogotá, Colombia (UTC-5)" },
  { value: "America/Lima", label: "Lima, Perú (UTC-5)" },
  { value: "America/Panama", label: "Panamá (UTC-5)" },
  { value: "America/Guayaquil", label: "Quito, Ecuador (UTC-5)" },
  { value: "America/Caracas", label: "Caracas, Venezuela (UTC-4)" },
  { value: "America/Santiago", label: "Santiago, Chile (UTC-4/-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires, Argentina (UTC-3)" },
  { value: "America/Sao_Paulo", label: "São Paulo, Brasil (UTC-3)" },
  { value: "America/Montevideo", label: "Montevideo, Uruguay (UTC-3)" },
  { value: "America/Halifax", label: "Atlantic (UTC-4)" },
  { value: "America/New_York", label: "New York, EST (UTC-5/-4)" },
  { value: "Europe/Madrid", label: "Madrid, España (UTC+1/+2)" },
  { value: "UTC", label: "UTC" },
];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { workspace_name: defaultName, timezone: "America/Tegucigalpa" },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await completeOnboardingAction(values);
        if (res?.error) {
          setError(res.error);
          toast.error(res.error);
        }
      } catch (e) {
        // redirect throws NEXT_REDIRECT — ignore it
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        const msg = e instanceof Error ? e.message : "Error inesperado";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="workspace_name">Nombre del workspace</Label>
        <Input id="workspace_name" {...register("workspace_name")} disabled={isPending} />
        {errors.workspace_name && (
          <p className="text-xs text-destructive">{errors.workspace_name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Zona horaria</Label>
        <select
          id="timezone"
          {...register("timezone")}
          disabled={isPending}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continuar
      </Button>
    </form>
  );
}