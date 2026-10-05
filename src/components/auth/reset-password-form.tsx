"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { updatePasswordAction } from "@/app/(auth)/actions";

const Schema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Al menos una mayúscula")
      .regex(/[0-9]/, "Al menos un número"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof Schema>;

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { password: "", confirm_password: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const res = await updatePasswordAction({
          password: values.password,
          confirm_password: values.confirm_password,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        // The action does a redirect on success.
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error("Error inesperado al cambiar la contraseña");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <PasswordInput id="password" autoComplete="new-password" {...register("password")} disabled={isPending} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Repite la contraseña</Label>
        <PasswordInput
          id="confirm_password"
          autoComplete="new-password"
          {...register("confirm_password")}
          disabled={isPending}
        />
        {errors.confirm_password && (
          <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Cambiar contraseña
      </Button>
    </form>
  );
}