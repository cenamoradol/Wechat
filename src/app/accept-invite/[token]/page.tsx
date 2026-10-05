import { acceptInviteAction } from "@/app/(workspace)/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
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

  if (!user) {
    // Show a choice: existing users log in, new users sign up. Both preserve `next`.
    const nextParam = encodeURIComponent(`/accept-invite/${token}`);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Has sido invitado</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            Para unirte al workspace, inicia sesión o crea una cuenta nueva.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href={`/login?next=${nextParam}`}>Ya tengo cuenta</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/signup?next=${nextParam}`}>Crear cuenta nueva</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const result = await acceptInviteAction(token);

  if (result.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Invitación inválida</h1>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">¡Listo!</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Te uniste a <strong>{result.workspaceName}</strong>.
        </p>
        <Button asChild>
          <Link href="/inbox">Ir al inbox</Link>
        </Button>
      </div>
    </div>
  );
}