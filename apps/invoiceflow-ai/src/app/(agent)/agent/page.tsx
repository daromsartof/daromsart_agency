import { redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listConversations } from "@/modules/agent/queries";
import { DEFAULT_AGENT_MODEL } from "@/modules/agent/models";
import { AgentChat } from "@/modules/agent/components/agent-chat";

export const metadata = { title: "Mode agent" };

/** Nouvelle conversation (aucune ligne créée tant qu'aucun message n'est envoyé). */
export default async function AgentNewPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const conversations = await listConversations(db, organizationId, session.user.id);

  return (
    <AgentChat
      initialMessages={[] as UIMessage[]}
      conversations={conversations}
      defaultModel={DEFAULT_AGENT_MODEL}
    />
  );
}
