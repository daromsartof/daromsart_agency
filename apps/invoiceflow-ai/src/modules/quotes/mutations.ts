import { and, eq } from "drizzle-orm";
import {
  documentDraftSchema,
  type DocumentDraftInput,
} from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { clients, quoteLines, quotes } from "../../db/schema";
import { addDocumentEvent } from "../documents/events";
import { recalculateDocumentTotals } from "../documents/recalculate";

/**
 * Mutations pures (validation zod + écriture DB), sans dépendance à Next.js.
 * Toujours filtrées par `organizationId` (isolation multi-tenant, H4).
 * Le recalcul des totaux est TOUJOURS effectué côté serveur avant
 * persistance — un payload client falsifié n'a aucune incidence sur les
 * valeurs stockées (parade « Recalcul client ≠ serveur », story 07).
 */

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export type CreateQuoteResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function zodErrorsToRecord(
  issues: { path: (string | number)[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

async function assertClientInOrg(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<boolean> {
  const [found] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  return Boolean(found);
}

function discountForDb(discount: DocumentDraftInput["globalDiscount"]) {
  if (!discount) return { type: null, value: null };
  return { type: discount.type, value: String(discount.value) };
}

async function writeLines(
  db: AppDb,
  quoteId: string,
  lines: DocumentDraftInput["lines"],
) {
  await db.delete(quoteLines).where(eq(quoteLines.quoteId, quoteId));
  if (!lines.length) return;
  await db.insert(quoteLines).values(
    lines.map((line, index) => ({
      quoteId,
      description: line.description,
      quantity: String(line.quantity),
      unitPriceCents: line.unitPriceCents,
      vatRate: String(line.vatRate),
      discountType: line.discount?.type ?? null,
      discountValue:
        line.discount?.value != null ? String(line.discount.value) : null,
      position: index,
    })),
  );
}

export async function createDraft(
  db: AppDb,
  organizationId: string,
  input: DocumentDraftInput,
): Promise<CreateQuoteResult> {
  const parsed = documentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  if (!(await assertClientInOrg(db, organizationId, data.clientId))) {
    return { ok: false, errors: { clientId: "Client introuvable." } };
  }

  const totals = recalculateDocumentTotals(data.lines, data.globalDiscount);
  const discount = discountForDb(data.globalDiscount);

  const [created] = await db
    .insert(quotes)
    .values({
      organizationId,
      clientId: data.clientId,
      status: "draft",
      issueDate: data.issueDate,
      validUntil: data.validUntil,
      notes: data.notes,
      globalDiscountType: discount.type,
      globalDiscountValue: discount.value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatByRate: totals.vatByRate,
      totalCents: totals.totalCents,
    })
    .returning({ id: quotes.id });

  await writeLines(db, created.id, data.lines);
  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: created.id,
    eventType: "created",
  });

  return { ok: true, id: created.id };
}

export async function updateDraft(
  db: AppDb,
  organizationId: string,
  quoteId: string,
  input: DocumentDraftInput,
): Promise<MutationResult> {
  const parsed = documentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }
  if (existing.status !== "draft") {
    return {
      ok: false,
      errors: { _root: "Seul un devis brouillon peut être modifié." },
    };
  }

  if (!(await assertClientInOrg(db, organizationId, data.clientId))) {
    return { ok: false, errors: { clientId: "Client introuvable." } };
  }

  const totals = recalculateDocumentTotals(data.lines, data.globalDiscount);
  const discount = discountForDb(data.globalDiscount);

  await db
    .update(quotes)
    .set({
      clientId: data.clientId,
      issueDate: data.issueDate,
      validUntil: data.validUntil,
      notes: data.notes,
      globalDiscountType: discount.type,
      globalDiscountValue: discount.value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatByRate: totals.vatByRate,
      totalCents: totals.totalCents,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  await writeLines(db, quoteId, data.lines);
  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: quoteId,
    eventType: "updated",
  });

  return { ok: true };
}

export async function deleteDraft(
  db: AppDb,
  organizationId: string,
  quoteId: string,
): Promise<MutationResult> {
  const [existing] = await db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }
  if (existing.status !== "draft") {
    return {
      ok: false,
      errors: { _root: "Seul un devis brouillon peut être supprimé." },
    };
  }

  await db.delete(quotes).where(eq(quotes.id, quoteId));
  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: quoteId,
    eventType: "deleted",
  });

  return { ok: true };
}

export async function duplicate(
  db: AppDb,
  organizationId: string,
  quoteId: string,
): Promise<CreateQuoteResult> {
  const [source] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
    .limit(1);
  if (!source) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }

  const sourceLines = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId));

  const [created] = await db
    .insert(quotes)
    .values({
      organizationId,
      clientId: source.clientId,
      status: "draft",
      issueDate: null,
      validUntil: source.validUntil,
      notes: source.notes,
      globalDiscountType: source.globalDiscountType,
      globalDiscountValue: source.globalDiscountValue,
      subtotalCents: source.subtotalCents,
      discountCents: source.discountCents,
      vatByRate: source.vatByRate,
      totalCents: source.totalCents,
    })
    .returning({ id: quotes.id });

  if (sourceLines.length) {
    await db.insert(quoteLines).values(
      sourceLines
        .sort((a, b) => a.position - b.position)
        .map((line, index) => ({
          quoteId: created.id,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          vatRate: line.vatRate,
          discountType: line.discountType,
          discountValue: line.discountValue,
          position: index,
        })),
    );
  }

  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: created.id,
    eventType: "created",
    payload: { duplicatedFrom: quoteId },
  });

  return { ok: true, id: created.id };
}
