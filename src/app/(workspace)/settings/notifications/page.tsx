import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsForm } from "@/components/settings/notifications-form";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NotificationsForm />;
}