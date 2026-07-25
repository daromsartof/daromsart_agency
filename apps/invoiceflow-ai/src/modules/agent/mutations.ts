import { and, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { agentConversations, agentMessages } from "../../db/schema";

/** Message minimal accepté par la persistance — structurellement compatible
 * avec les `UIMessage` de l'AI SDK, sans coupler la couche DB à ses types. */
export interface PersistableMessage {
  role: "user" | "assistant" | "system";
  parts: unknown[];
}

export async function createConversation(
  db: AppDb,
  organizationId: string,
  userId: string,
  model: string,
): Promise<string> {
  const [row] = await db
    .insert(agentConversations)
    .values({ organizationId, userId, model })
    .returning({ id: agentConversations.id });
  return row.id;
}

function firstUserText(messages: PersistableMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return null;
  const textPart = firstUser.parts.find(
    (p): p is { type: "text"; text: string } =>
      typeof p === "object" &&
      p !== null &&
      (p as { type?: unknown }).type === "text" &&
      typeof (p as { text?: unknown }).text === "string",
  );
  if (!textPart) return null;
  const text = textPart.text.trim().replace(/\s+/g, " ");
  return text.length > 80 ? `${text.slice(0, 77)}…` : text || null;
}

/**
 * Remplace intégralement les messages d'une conversation (delete + insert en
 * transaction) — idempotent et toujours cohérent avec l'état client envoyé.
 * L'ordre est garanti par un `createdAt` incrémenté par index (les inserts en
 * lot ne garantissent pas l'ordre des timestamps `now()` autrement). Met à
 * jour `updatedAt` et le titre (premier message utilisateur, tronqué).
 */
export async function replaceMessages(
  db: AppDb,
  conversationId: string,
  messages: PersistableMessage[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(agentMessages).where(eq(agentMessages.conversationId, conversationId));
    if (messages.length > 0) {
      const base = Date.now();
      await tx.insert(agentMessages).values(
        messages.map((m, i) => ({
          conversationId,
          role: m.role,
          parts: m.parts,
          createdAt: new Date(base + i),
        })),
      );
    }
    const title = firstUserText(messages);
    await tx
      .update(agentConversations)
      .set({ updatedAt: new Date(), ...(title ? { title } : {}) })
      .where(eq(agentConversations.id, conversationId));
  });
}

export async function deleteConversation(
  db: AppDb,
  organizationId: string,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(agentConversations)
    .where(
      and(
        eq(agentConversations.id, id),
        eq(agentConversations.organizationId, organizationId),
        eq(agentConversations.userId, userId),
      ),
    );
}
