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
import { forgotPasswordAction } from "@/app/(auth)/actions";

const Schema = z.object({
  email: z.string().email("Email inválido"),
});

type FormValues = z.infer<typeof Schema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await forgotPasswordAction(values);
      if (res?.error) toast.error(res.error);
      if (res?.success) {
        toast.success(res.success);
        setDone(true);
      }
    });
  };

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        Revisa tu bandeja de entrada. Si el email está registrado, recibirás un enlace en unos minutos.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} disabled={isPending} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enviar enlace
      </Button>
    </form>
  );
}