import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { signableDocuments } from "../../db/schema";

export type SignableDocumentRow = typeof signableDocuments.$inferSelect;

export async function listSignableDocuments(
  db: AppDb,
  organizationId: string,
): Promise<SignableDocumentRow[]> {
  return db
    .select()
    .from(signableDocuments)
    .where(eq(signableDocuments.organizationId, organizationId))
    .orderBy(desc(signableDocuments.createdAt));
}

export async function getSignableDocumentById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<SignableDocumentRow | null> {
  const [row] = await db
    .select()
    .from(signableDocuments)
    .where(
      and(eq(signableDocuments.id, id), eq(signableDocuments.organizationId, organizationId)),
    )
    .limit(1);
  return row ?? null;
}
