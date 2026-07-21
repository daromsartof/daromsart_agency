import { and, eq } from "drizzle-orm";
import { formatDocumentNumber } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { numberSequences } from "../../db/schema";

export type NumberDocumentKind = "quote" | "invoice" | "credit_note";

export interface IssueNumberParams {
  organizationId: string;
  kind: NumberDocumentKind;
  year: number;
  format: string;
}

/**
 * Attribue le numéro suivant (H6). DOIT être appelée à l'intérieur d'une
 * transaction ouverte par l'appelant (l'action d'émission) : la ligne de
 * séquence est verrouillée (`SELECT ... FOR UPDATE`) le temps de
 * lire-incrémenter-écrire, ce qui sérialise les émissions concurrentes de la
 * même organisation/type/année — jamais de trou ni de doublon (invariant #3
 * de `plans/architecture.md`). `INSERT ... ON CONFLICT DO NOTHING` amorce la
 * ligne si c'est la première émission de l'année pour ce type.
 */
export async function issueNumber(
  tx: AppDb,
  params: IssueNumberParams,
): Promise<string> {
  await tx
    .insert(numberSequences)
    .values({
      organizationId: params.organizationId,
      documentType: params.kind,
      year: params.year,
      lastNumber: 0,
    })
    .onConflictDoNothing({
      target: [
        numberSequences.organizationId,
        numberSequences.documentType,
        numberSequences.year,
      ],
    });

  const [row] = await tx
    .select({ id: numberSequences.id, lastNumber: numberSequences.lastNumber })
    .from(numberSequences)
    .where(
      and(
        eq(numberSequences.organizationId, params.organizationId),
        eq(numberSequences.documentType, params.kind),
        eq(numberSequences.year, params.year),
      ),
    )
    .for("update");

  const nextSeq = row.lastNumber + 1;

  await tx
    .update(numberSequences)
    .set({ lastNumber: nextSeq, updatedAt: new Date() })
    .where(eq(numberSequences.id, row.id));

  return formatDocumentNumber(params.format, { year: params.year, seq: nextSeq });
}
