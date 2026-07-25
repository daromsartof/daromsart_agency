import { notFound, redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import {
  getConversation,
  getConversationMessages,
  listConversations,
} from "@/modules/agent/queries";
import { DEFAULT_AGENT_MODEL, isAgentModel } from "@/modules/agent/models";
import { AgentChat } from "@/modules/agent/components/agent-chat";

export const metadata = { title: "Mode agent" };

/** Reprise d'une conversation existante (org+user-scopée). */
export default async function AgentConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const conversation = await getConversation(
    db,
    organizationId,
    session.user.id,
    params.conversationId,
  );
  if (!conversation) {
    notFound();
  }

  const [messages, conversations] = await Promise.all([
    getConversationMessages(db, conversation.id),
    listConversations(db, organizationId, session.user.id),
  ]);

  const defaultModel = isAgentModel(conversation.model) ? conversation.model : DEFAULT_AGENT_MODEL;

  return (
    <AgentChat
      conversationId={conversation.id}
      initialMessages={messages as unknown as UIMessage[]}
      conversations={conversations}
      defaultModel={defaultModel}
    />
  );
}
