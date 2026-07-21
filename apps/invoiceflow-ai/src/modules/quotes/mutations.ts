import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  canTransition,
  documentDraftSchema,
  type DocumentDraftInput,
  type QuoteStatus,
} from "@daromsart/core";
import type { AppDb } from "../../db/types";
import {
  clients,
  documentTemplates,
  invoiceLines,
  invoices,
  organizations,
  quoteLines,
  quotes,
} from "../../db/schema";
import { addDocumentEvent } from "../documents/events";
import { issueNumber } from "../documents/numbering";
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

/** `undefined` = valeur non fournie (ne rien vérifier), `null` = "aucun modèle". */
async function assertTemplateInOrg(
  db: AppDb,
  organizationId: string,
  templateId: string | null | undefined,
): Promise<boolean> {
  if (!templateId) return true;
  const [found] = await db
    .select({ id: documentTemplates.id, type: documentTemplates.type })
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.id, templateId),
        eq(documentTemplates.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(found) && (found.type === "quote" || found.type === "both");
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
  if (!(await assertTemplateInOrg(db, organizationId, data.templateId))) {
    return { ok: false, errors: { templateId: "Modèle introuvable." } };
  }

  const totals = recalculateDocumentTotals(data.lines, data.globalDiscount);
  const discount = discountForDb(data.globalDiscount);

  const [created] = await db
    .insert(quotes)
    .values({
      organizationId,
      clientId: data.clientId,
      templateId: data.templateId || null,
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
  if (!(await assertTemplateInOrg(db, organizationId, data.templateId))) {
    return { ok: false, errors: { templateId: "Modèle introuvable." } };
  }

  const totals = recalculateDocumentTotals(data.lines, data.globalDiscount);
  const discount = discountForDb(data.globalDiscount);

  await db
    .update(quotes)
    .set({
      clientId: data.clientId,
      templateId: data.templateId || null,
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
      templateId: source.templateId,
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

export type IssueQuoteResult =
  | { ok: true; number: string }
  | { ok: false; errors: Record<string, string> };

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Émission (H6, H14) : dans une seule transaction — vérifs (brouillon, ≥1
 * ligne, client non archivé) → numéro de séquence (verrou `FOR UPDATE`) →
 * statut `sent` + `share_token` + `sent_at`. Toute erreur (ex. client
 * archivé) annule la transaction : le compteur de séquence n'est jamais
 * consommé pour une émission qui échoue (parade « trou de numérotation »,
 * plans/story-08.md).
 *
 * Interprétation H14 (documentée ici faute d'état `issued` dédié pour les
 * devis) : émettre un devis le fait passer directement à `sent`, avec
 * `sent_at` = date d'émission — l'émission "prête à transmettre" et l'envoi
 * effectif (story 10) ne sont pas distingués dans la machine à états.
 */
export async function issueQuote(
  db: AppDb,
  organizationId: string,
  quoteId: string,
): Promise<IssueQuoteResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: quotes.id, status: quotes.status, clientId: quotes.clientId })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
      .limit(1);
    if (!existing) {
      return { ok: false, errors: { _root: "Devis introuvable." } };
    }
    if (!canTransition("quote", existing.status as QuoteStatus, "sent")) {
      return { ok: false, errors: { _root: "Seul un devis brouillon peut être émis." } };
    }

    const lines = await tx
      .select({ id: quoteLines.id })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId));
    if (lines.length === 0) {
      return { ok: false, errors: { _root: "Le devis doit contenir au moins une ligne." } };
    }

    const [client] = await tx
      .select({ id: clients.id, archivedAt: clients.archivedAt })
      .from(clients)
      .where(
        and(eq(clients.id, existing.clientId), eq(clients.organizationId, organizationId)),
      )
      .limit(1);
    if (!client || client.archivedAt) {
      return { ok: false, errors: { _root: "Client introuvable ou archivé." } };
    }

    const [org] = await tx
      .select({ numberFormats: organizations.numberFormats })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) {
      return { ok: false, errors: { _root: "Organisation introuvable." } };
    }

    const now = new Date();
    const number = await issueNumber(tx, {
      organizationId,
      kind: "quote",
      year: now.getFullYear(),
      format: org.numberFormats.quote,
    });

    await tx
      .update(quotes)
      .set({
        status: "sent",
        number,
        shareToken: generateShareToken(),
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(quotes.id, quoteId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "quote",
      documentId: quoteId,
      eventType: "issued",
      payload: { number },
    });

    return { ok: true, number };
  });
}

/**
 * Refus manuel côté interne (motif optionnel) — ex. le client a refusé par
 * un autre canal (téléphone, email hors app). Le refus déclenché par le
 * client lui-même sur la page publique arrive en story 11.
 */
export async function markRefused(
  db: AppDb,
  organizationId: string,
  quoteId: string,
  reason?: string,
): Promise<MutationResult> {
  const [existing] = await db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _root: "Devis introuvable." } };
  }
  if (!canTransition("quote", existing.status as QuoteStatus, "refused")) {
    return { ok: false, errors: { _root: "Transition de statut invalide." } };
  }

  await db
    .update(quotes)
    .set({
      status: "refused",
      refusedAt: new Date(),
      refusalReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  await addDocumentEvent(db, {
    organizationId,
    documentType: "quote",
    documentId: quoteId,
    eventType: "refused",
    payload: reason ? { reason } : undefined,
  });

  return { ok: true };
}

export type ConvertToInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; errors: Record<string, string> };

/**
 * Conversion devis → facture (story 17). Statut du devis INCHANGÉ ici — le
 * devis ne passe à `invoiced` que plus tard, quand la facture issue de la
 * conversion est réellement émise (`issueInvoice`, story 12). Éligibilité :
 * `signed` toujours autorisé ; `sent`/`viewed` uniquement avec
 * `options.force` (confirmation utilisateur côté UI — le devis n'a pas
 * formellement été signé). Verrou `FOR UPDATE` sur la ligne devis : une
 * double conversion concurrente ne peut pas passer deux fois (la seconde
 * relit `invoiceId` déjà posé par la première et refuse).
 */
export async function convertToInvoice(
  db: AppDb,
  organizationId: string,
  quoteId: string,
  options: { force?: boolean } = {},
): Promise<ConvertToInvoiceResult> {
  return db.transaction(async (tx): Promise<ConvertToInvoiceResult> => {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, organizationId)))
      .for("update");
    if (!quote) {
      return { ok: false, errors: { _root: "Devis introuvable." } };
    }
    if (quote.invoiceId) {
      return { ok: false, errors: { _root: "Ce devis a déjà été converti en facture." } };
    }
    const eligible =
      quote.status === "signed" ||
      ((quote.status === "sent" || quote.status === "viewed") && options.force);
    if (!eligible) {
      return {
        ok: false,
        errors: { _root: "Ce devis doit être signé (ou la conversion confirmée) pour être converti." },
      };
    }

    const sourceLines = await tx
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId));

    const [client] = await tx
      .select({ paymentTermsDays: clients.paymentTermsDays })
      .from(clients)
      .where(eq(clients.id, quote.clientId))
      .limit(1);
    const [org] = await tx
      .select({ paymentTermsDays: organizations.paymentTermsDays })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const paymentTermsDays = client?.paymentTermsDays ?? org?.paymentTermsDays ?? 30;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    const [createdInvoice] = await tx
      .insert(invoices)
      .values({
        organizationId,
        clientId: quote.clientId,
        templateId: quote.templateId,
        quoteId: quote.id,
        status: "draft",
        issueDate,
        dueDate,
        notes: quote.notes,
        globalDiscountType: quote.globalDiscountType,
        globalDiscountValue: quote.globalDiscountValue,
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        vatByRate: quote.vatByRate,
        totalCents: quote.totalCents,
      })
      .returning({ id: invoices.id });

    if (sourceLines.length) {
      await tx.insert(invoiceLines).values(
        sourceLines
          .sort((a, b) => a.position - b.position)
          .map((line, index) => ({
            invoiceId: createdInvoice.id,
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

    await tx
      .update(quotes)
      .set({ invoiceId: createdInvoice.id, updatedAt: issueDate })
      .where(eq(quotes.id, quoteId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "quote",
      documentId: quoteId,
      eventType: "converted",
      payload: { invoiceId: createdInvoice.id },
    });
    await addDocumentEvent(tx, {
      organizationId,
      documentType: "invoice",
      documentId: createdInvoice.id,
      eventType: "converted",
      payload: { quoteId },
    });

    return { ok: true, invoiceId: createdInvoice.id };
  });
}
