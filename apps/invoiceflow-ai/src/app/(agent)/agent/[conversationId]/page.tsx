import { notFound, redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import {
  getConversation,
  getConversationMessages,
  listConversations,
} from "@/modules/agent/queries";
import { isAgentModel, type AgentModelId } from "@/modules/agent/models";
import { AgentChat } from "@/modules/agent/components/agent-chat";
import {
  availableAgentModels,
  defaultAgentModel,
  isModelConfigured,
} from "@/modules/agent/provider";

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

  const preferred =
    isAgentModel(conversation.model) && isModelConfigured(conversation.model)
      ? conversation.model
      : defaultAgentModel();

  const available = availableAgentModels();

  return (
    <AgentChat
      conversationId={conversation.id}
      initialMessages={messages as unknown as UIMessage[]}
      conversations={conversations}
      defaultModel={preferred}
      availableModelIds={available.map((m) => m.id as AgentModelId)}
    />
  );
}
