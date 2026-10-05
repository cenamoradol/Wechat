import { acceptInviteAction } from "@/app/(workspace)/actions";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    // Bounce to login with a redirect back here
    redirect(`/login?next=/accept-invite/${token}`);
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
          <a href="/inbox">Ir al inbox</a>
        </Button>
      </div>
    </div>
  );
}