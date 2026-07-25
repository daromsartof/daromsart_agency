import { redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listConversations } from "@/modules/agent/queries";
import { AgentChat } from "@/modules/agent/components/agent-chat";
import { availableAgentModels, defaultAgentModel } from "@/modules/agent/provider";
import type { AgentModelId } from "@/modules/agent/models";

export const metadata = { title: "Mode agent" };

/** Nouvelle conversation (aucune ligne créée tant qu'aucun message n'est envoyé). */
export default async function AgentNewPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const conversations = await listConversations(db, organizationId, session.user.id);
  const available = availableAgentModels();

  return (
    <AgentChat
      initialMessages={[] as UIMessage[]}
      conversations={conversations}
      defaultModel={defaultAgentModel()}
      availableModelIds={available.map((m) => m.id as AgentModelId)}
    />
  );
}
