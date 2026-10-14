"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  changePasswordAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/app/(workspace)/settings/profile/actions";

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function ProfileForm({
  fullName,
  email,
  avatarUrl,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profilePending, startProfile] = useTransition();
  const [passwordPending, startPassword] = useTransition();
  const [avatarPending, startAvatar] = useTransition();

  const onProfile = (formData: FormData) => {
    const full_name = String(formData.get("full_name") ?? "");
    startProfile(() => {
      updateProfileAction({ full_name }).then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success("Perfil actualizado");
          router.refresh();
        }
      });
    });
  };

  const onPassword = (formData: FormData) => {
    const payload = {
      current: String(formData.get("current") ?? ""),
      next: String(formData.get("next") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    };
    startPassword(() => {
      changePasswordAction(payload).then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success("Contraseña cambiada");
          (document.getElementById("password-form") as HTMLFormElement | null)?.reset();
        }
      });
    });
  };

  const onAvatar = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    startAvatar(() => {
      uploadAvatarAction(fd).then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success("Avatar actualizado");
          router.refresh();
        }
      });
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tu perfil</h1>
        <p className="text-sm text-muted-foreground">Cómo te ven los demás miembros del workspace.</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto</CardTitle>
          <CardDescription>PNG, JPG o WEBP. Máximo 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? email ?? ""} />}
            <AvatarFallback>{initials(fullName, email)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAvatar(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarPending}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {avatarPending ? "Subiendo…" : "Cambiar foto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Datos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={fullName ?? ""}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email ?? ""} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">
                El email no se puede cambiar desde aquí (pendiente).
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profilePending}>
                <Save className="mr-2 h-4 w-4" />
                {profilePending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Contraseña */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Cambiar contraseña
          </CardTitle>
          <CardDescription>Mínimo 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="password-form" action={onPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Contraseña actual</Label>
              <Input id="current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="next">Nueva contraseña</Label>
              <Input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Repetir nueva contraseña</Label>
              <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={passwordPending}>
                <KeyRound className="mr-2 h-4 w-4" />
                {passwordPending ? "Cambiando…" : "Cambiar contraseña"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}