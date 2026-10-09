import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkspaceIdAction } from "@/app/(workspace)/actions";
import { ContactsView } from "@/components/contacts/contacts-view";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; channel?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceIdAction();
  if (!workspaceId) redirect("/onboarding");

  const { q, tag, channel } = await searchParams;
  const admin = createAdminClient();

  // Fetch contacts (with their channel count + last message) + all channels (for filter)
  const baseQuery = admin
    .from("contacts")
    .select(
      `id, full_name, email, phone_e164, tags, notes, created_at, contact_channels(id, channels(id, type, display_name))`
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(500);

  // Apply filters
  let contactsQuery = baseQuery;
  if (q && q.trim().length > 0) {
    const term = `%${q.trim()}%`;
    contactsQuery = contactsQuery.or(
      `full_name.ilike.${term},email.ilike.${term},phone_e164.ilike.${term}`,
    );
  }
  if (tag) {
    contactsQuery = contactsQuery.contains("tags", [tag.toLowerCase()]);
  }
  if (channel) {
    contactsQuery = contactsQuery.contains("contact_channels.channels.type", [channel]);
  }

  const [{ data: contacts }, { data: channels }, { data: convs }] = await Promise.all([
    contactsQuery,
    admin
      .from("channels")
      .select("id, type, display_name")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .order("display_name"),
    admin
      .from("conversations")
      .select("id, contact_channel_id, last_message_at")
      .eq("workspace_id", workspaceId)
      .order("last_message_at", { ascending: false })
      .limit(500),
  ]);

  // Build a map of contact_channel_id -> last conversation time
  const lastConvByCC: Record<string, string> = {};
  for (const c of convs ?? []) {
    if (c.contact_channel_id && !lastConvByCC[c.contact_channel_id]) {
      lastConvByCC[c.contact_channel_id] = c.last_message_at;
    }
  }

  // Derive all unique tags for the filter
  const tagSet = new Set<string>();
  for (const c of contacts ?? []) {
    for (const t of c.tags ?? []) tagSet.add(t);
  }

  return (
    <ContactsView
      contacts={(contacts ?? []).map((c: any) => {
        // Get the most recent activity across all linked channels
        const channelList = (c.contact_channels ?? [])
          .map((cc: any) => ({
            type: cc.channels?.type,
            display_name: cc.channels?.display_name,
            last_seen: cc.last_seen_at,
          }))
          .filter((x: any) => x.type);
        const lastActivity =
          channelList
            .map((x: any) => x.last_seen)
            .filter(Boolean)
            .sort()
            .pop() ?? c.created_at;
        return {
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          phone_e164: c.phone_e164,
          tags: c.tags ?? [],
          notes: c.notes,
          channels: channelList,
          lastActivity,
        };
      })}
      channels={channels ?? []}
      allTags={Array.from(tagSet).sort()}
      currentFilters={{ q: q ?? "", tag: tag ?? "", channel: channel ?? "" }}
    />
  );
}