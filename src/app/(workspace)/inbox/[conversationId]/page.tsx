import InboxPage from "@/app/(workspace)/inbox/page";

// Deep-link route to a specific conversation.
// /inbox/[conversationId] is equivalent to /inbox?conversation=[conversationId]
export default async function InboxConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <InboxPage searchParams={Promise.resolve({ conversation: conversationId })} />;
}