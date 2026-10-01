import { OnboardingForm } from "./onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { skipOnboardingAction } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already onboarded? Skip straight to dashboard
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberships) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("onboarding_step")
      .eq("id", memberships.workspace_id)
      .maybeSingle();
    if (ws && ws.onboarding_step >= 1) redirect("/dashboard");
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Bienvenido a Wechat</CardTitle>
        <CardDescription>Configura tu workspace para empezar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OnboardingForm defaultName={`Workspace de ${user.email?.split("@")[0] ?? ""}`} />
        <form action={skipOnboardingAction}>
          <button type="submit" className="text-xs text-muted-foreground hover:underline">
            Saltar por ahora
          </button>
        </form>
      </CardContent>
    </Card>
  );
}