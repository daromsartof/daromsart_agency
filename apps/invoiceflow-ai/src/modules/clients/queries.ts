import { and, asc, eq, isNull, or, ilike, sql } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { clientContacts, clients } from "../../db/schema";

/**
 * Requêtes pures (sans `server-only`/Next), injectables avec n'importe quelle
 * connexion Drizzle — testables en intégration contre la base de test.
 */

export interface ListClientsParams {
  organizationId: string;
  /** Recherche sur nom affiché / nom légal / email. `ilike` simple (V1) :
   * insensible à la casse mais PAS aux accents (pas d'extension `unaccent`
   * activée). "Dupont" trouve "dupont" mais pas "Dupônt". */
  q?: string;
  /** Si `true`, inclut aussi les clients archivés (par défaut : exclus). */
  includeArchived?: boolean;
  /** 1-indexée. */
  page: number;
  pageSize: number;
}

export type ClientRow = typeof clients.$inferSelect;

export interface ListClientsResult {
  items: ClientRow[];
  total: number;
  page: number;
  pageCount: number;
}

export async function listClients(
  db: AppDb,
  params: ListClientsParams,
): Promise<ListClientsResult> {
  const page = Math.max(1, params.page);
  const pageSize = params.pageSize;

  const conditions = [eq(clients.organizationId, params.organizationId)];
  if (!params.includeArchived) {
    conditions.push(isNull(clients.archivedAt));
  }
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(clients.displayName, term),
        ilike(clients.legalName, term),
        ilike(clients.email, term),
      )!,
    );
  }
  const where = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(where);

  const items = await db
    .select()
    .from(clients)
    .where(where)
    .orderBy(asc(clients.displayName))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return { items, total: count, page, pageCount };
}

export interface ClientWithContacts extends ClientRow {
  contacts: (typeof clientContacts.$inferSelect)[];
}

export async function getClientById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<ClientWithContacts | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)))
    .limit(1);
  if (!client) return null;

  const contacts = await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientId, id))
    .orderBy(asc(clientContacts.name));

  return { ...client, contacts };
}
