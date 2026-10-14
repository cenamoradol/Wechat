import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ProfileForm
      fullName={profile?.full_name ?? user.user_metadata?.full_name ?? null}
      email={user.email ?? null}
      avatarUrl={profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null}
    />
  );
}