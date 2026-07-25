import { and, desc, eq, exists } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { agentConversations, agentMessages } from "../../db/schema";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

/**
 * Conversations de l'utilisateur dans son organisation, les plus récentes
 * d'abord. Filtre les conversations vides (aucun message) — celles-ci sont
 * créées à l'ouverture du mode agent et n'ont pas vocation à polluer
 * l'historique tant que rien n'y a été échangé.
 */
export async function listConversations(
  db: AppDb,
  organizationId: string,
  userId: string,
): Promise<ConversationSummary[]> {
  return db
    .select({
      id: agentConversations.id,
      title: agentConversations.title,
      updatedAt: agentConversations.updatedAt,
    })
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.organizationId, organizationId),
        eq(agentConversations.userId, userId),
        exists(
          db
            .select({ one: agentMessages.id })
            .from(agentMessages)
            .where(eq(agentMessages.conversationId, agentConversations.id)),
        ),
      ),
    )
    .orderBy(desc(agentConversations.updatedAt));
}

export interface ConversationRow {
  id: string;
  title: string;
  model: string;
}

/** Conversation org+user-scopée, ou `null` (accès d'une autre org/user refusé). */
export async function getConversation(
  db: AppDb,
  organizationId: string,
  userId: string,
  id: string,
): Promise<ConversationRow | null> {
  const [row] = await db
    .select({
      id: agentConversations.id,
      title: agentConversations.title,
      model: agentConversations.model,
    })
    .from(agentConversations)
    .where(
      and(
        eq(agentConversations.id, id),
        eq(agentConversations.organizationId, organizationId),
        eq(agentConversations.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Message tel que l'attend l'AI SDK (UIMessage minimal : id/role/parts). */
export interface StoredUiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
}

export async function getConversationMessages(
  db: AppDb,
  conversationId: string,
): Promise<StoredUiMessage[]> {
  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      parts: agentMessages.parts,
    })
    .from(agentMessages)
    .where(eq(agentMessages.conversationId, conversationId))
    .orderBy(agentMessages.createdAt);
  return rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts }));
}
