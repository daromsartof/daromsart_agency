import { and, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { numberSequences } from "../../db/schema";

export type SequenceStatus = Record<"quote" | "invoice" | "credit_note", number>;

/** Dernier numéro attribué (année civile courante) pour chaque type de
 * document — aperçu "prochain numéro" + avertissement "séquence démarrée"
 * de `/parametres/facturation` (story 22). 0 si aucune émission cette année.
 * Pas de `server-only` (contrairement à `queries.ts`) : `db` injecté, testable
 * en intégration sans contexte de requête, même pattern que
 * `invoices/queries.ts`. */
export async function getCurrentSequenceStatus(
  db: AppDb,
  organizationId: string,
): Promise<SequenceStatus> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ documentType: numberSequences.documentType, lastNumber: numberSequences.lastNumber })
    .from(numberSequences)
    .where(and(eq(numberSequences.organizationId, organizationId), eq(numberSequences.year, year)));

  const status: SequenceStatus = { quote: 0, invoice: 0, credit_note: 0 };
  for (const row of rows) status[row.documentType] = row.lastNumber;
  return status;
}
