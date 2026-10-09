import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { ContactDetailView } from "@/components/contacts/contact-detail-view";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: contact, error } = await admin
    .from("contacts")
    .select(
      "id, full_name, email, phone_e164, tags, notes, created_at, contact_channels(id, external_user_id, last_seen_at, channels(id, type, display_name))"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !contact) notFound();

  // Find conversations tied to this contact's contact_channels
  const ccIds = ((contact as any).contact_channels ?? []).map((cc: any) => cc.id);
  const { data: conversations } = ccIds.length
    ? await admin
        .from("conversations")
        .select("id, status, last_message_at, last_message_preview, contact_channel_id")
        .in("contact_channel_id", ccIds)
        .order("last_message_at", { ascending: false })
        .limit(20)
    : { data: [] };

  return (
      <ContactDetailView
        contact={{
          id: contact.id,
          full_name: contact.full_name,
          email: contact.email,
          phone_e164: contact.phone_e164,
          notes: contact.notes,
          tags: contact.tags ?? [],
          channels: ((contact as any).contact_channels ?? []).map((cc: any) => ({
            id: cc.id,
            external_user_id: cc.external_user_id,
            last_seen_at: cc.last_seen_at,
            type: cc.channels?.type,
            display_name: cc.channels?.display_name,
          })),
          created_at: contact.created_at,
        }}
        conversations={(conversations ?? []).map((c: any) => ({
          id: c.id,
          status: c.status,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
        }))}
      />
  );
}