import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invite, error } = await supabase
    .from("invitations")
    .select("email, role, expires_at, accepted_at, workspace_id")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitación no encontrada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">El enlace no es válido o ya expiró.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Ir al inicio
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (new Date(invite.expires_at) < new Date() || invite.accepted_at) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitación expirada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta invitación ya no es válida. Pide a tu administrador que te envíe una nueva.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    redirect(`/login?next=/accept-invite/${token}`);
  }

  if (user.email !== invite.email) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email no coincide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta invitación fue enviada a <strong>{invite.email}</strong>, pero tu sesión está
            autenticada con otro email.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ponytail: auto-accept is wired in Fase 5 with proper transaction
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Aceptar invitación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Te han invitado a unirte al workspace con rol <strong>{invite.role}</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          La aceptación automática se implementará en Fase 5.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}