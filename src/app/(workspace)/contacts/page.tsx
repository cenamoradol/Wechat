import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getActiveWorkspaceIdAction,
  listUserWorkspacesAction,
} from "@/app/(workspace)/actions";
import { ContactsView } from "@/components/contacts/contacts-view";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; channel?: string; workspace?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeWorkspaceId = await getActiveWorkspaceIdAction();
  if (!activeWorkspaceId) redirect("/onboarding");

  const { q, tag, channel, workspace: workspaceFilter } = await searchParams;
  const admin = createAdminClient();

  // All workspaces the user is a member of (for the workspace switcher chip)
  const allWorkspaces = await listUserWorkspacesAction();
  if (allWorkspaces.length === 0) redirect("/onboarding");

  // Default to active workspace when no ?workspace filter
  const targetWorkspaceId = workspaceFilter || activeWorkspaceId;
  const targetWorkspace =
    allWorkspaces.find((w) => w.id === targetWorkspaceId) ?? allWorkspaces[0];

  const baseQuery = admin
    .from("contacts")
    .select(
      `id, full_name, email, phone_e164, tags, notes, created_at, contact_channels(id, external_user_id, last_seen_at, channels(id, type, display_name))`
    )
    .eq("workspace_id", targetWorkspace.id)
    .order("created_at", { ascending: false })
    .limit(500);

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

  const [{ data: contacts }, { data: channels }] = await Promise.all([
    contactsQuery,
    admin
      .from("channels")
      .select("id, type, display_name")
      .eq("workspace_id", targetWorkspace.id)
      .eq("status", "connected")
      .order("display_name"),
  ]);

  const tagSet = new Set<string>();
  for (const c of contacts ?? []) {
    for (const t of c.tags ?? []) tagSet.add(t);
  }

  return (
    <ContactsView
      contacts={(contacts ?? []).map((c: any) => {
        const channelList = ((c.contact_channels ?? []) as any[])
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
      workspaces={allWorkspaces}
      activeWorkspaceId={activeWorkspaceId}
      targetWorkspaceId={targetWorkspace.id}
    />
  );
}