import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  canTransition,
  documentDraftSchema,
  type DocumentDraftInput,
  type InvoiceStatus,
  type QuoteStatus,
} from "@daromsart/core";
import type { AppDb } from "../../db/types";
import {
  clients,
  documentTemplates,
  invoiceLines,
  invoices,
  organizations,
  quotes,
  type InvoiceClientSnapshot,
  type InvoiceOrgSnapshot,
} from "../../db/schema";
import { addDocumentEvent } from "../documents/events";
import { issueNumber } from "../documents/numbering";
import { recalculateDocumentTotals } from "../documents/recalculate";

/**
 * Mutations pures (validation zod + écriture DB), sans dépendance à Next.js.
 * Miroir de `modules/quotes/mutations.ts` (story 07/08) — réutilise le même
 * `documentDraftSchema` (le champ `validUntil` porte l'échéance côté
 * facture ; seul le libellé affiché change, cf. `document-form.tsx`).
 */

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export type CreateInvoiceResult =
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
  return Boolean(found) && (found.type === "invoice" || found.type === "both");
}

function discountForDb(discount: DocumentDraftInput["globalDiscount"]) {
  if (!discount) return { type: null, value: null };
  return { type: discount.type, value: String(discount.value) };
}

async function writeLines(
  db: AppDb,
  invoiceId: string,
  lines: DocumentDraftInput["lines"],
) {
  await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  if (!lines.length) return;
  await db.insert(invoiceLines).values(
    lines.map((line, index) => ({
      invoiceId,
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
): Promise<CreateInvoiceResult> {
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
    .insert(invoices)
    .values({
      organizationId,
      clientId: data.clientId,
      templateId: data.templateId || null,
      status: "draft",
      issueDate: data.issueDate,
      dueDate: data.validUntil,
      notes: data.notes,
      globalDiscountType: discount.type,
      globalDiscountValue: discount.value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatByRate: totals.vatByRate,
      totalCents: totals.totalCents,
    })
    .returning({ id: invoices.id });

  await writeLines(db, created.id, data.lines);
  await addDocumentEvent(db, {
    organizationId,
    documentType: "invoice",
    documentId: created.id,
    eventType: "created",
  });

  return { ok: true, id: created.id };
}

export async function updateDraft(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
  input: DocumentDraftInput,
): Promise<MutationResult> {
  const parsed = documentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: invoices.id, status: invoices.status, kind: invoices.kind })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _root: "Facture introuvable." } };
  }
  if (existing.kind === "credit_note") {
    // Un avoir se modifie via `updateCreditNoteDraft` (story 18, quantités
    // négatives, garde du cumul créditable) — jamais via ce chemin.
    return { ok: false, errors: { _root: "Utilisez l'édition d'avoir pour ce document." } };
  }
  if (existing.status !== "draft") {
    return {
      ok: false,
      errors: { _root: "Seule une facture brouillon peut être modifiée." },
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
    .update(invoices)
    .set({
      clientId: data.clientId,
      templateId: data.templateId || null,
      issueDate: data.issueDate,
      dueDate: data.validUntil,
      notes: data.notes,
      globalDiscountType: discount.type,
      globalDiscountValue: discount.value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatByRate: totals.vatByRate,
      totalCents: totals.totalCents,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await writeLines(db, invoiceId, data.lines);
  await addDocumentEvent(db, {
    organizationId,
    documentType: "invoice",
    documentId: invoiceId,
    eventType: "updated",
  });

  return { ok: true };
}

export async function deleteDraft(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
): Promise<MutationResult> {
  const [existing] = await db
    .select({ id: invoices.id, status: invoices.status, quoteId: invoices.quoteId })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _root: "Facture introuvable." } };
  }
  if (existing.status !== "draft") {
    return {
      ok: false,
      errors: { _root: "Seule une facture brouillon peut être supprimée." },
    };
  }

  await db.delete(invoices).where(eq(invoices.id, invoiceId));
  await addDocumentEvent(db, {
    organizationId,
    documentType: "invoice",
    documentId: invoiceId,
    eventType: "deleted",
  });

  // Story 17 : supprimer un brouillon issu d'une conversion dé-lie le devis
  // d'origine (`invoice_id = null`) pour permettre une nouvelle conversion.
  if (existing.quoteId) {
    await db
      .update(quotes)
      .set({ invoiceId: null, updatedAt: new Date() })
      .where(eq(quotes.id, existing.quoteId));
    await addDocumentEvent(db, {
      organizationId,
      documentType: "quote",
      documentId: existing.quoteId,
      eventType: "unlinked",
      payload: { invoiceId },
    });
  }

  return { ok: true };
}

export async function duplicate(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
): Promise<CreateInvoiceResult> {
  const [source] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!source) {
    return { ok: false, errors: { _root: "Facture introuvable." } };
  }
  if (source.kind === "credit_note") {
    // Pas de refacturation automatique après annulation (plans/story-18.md,
    // « Quand s'arrêter ») : dupliquer un avoir n'est pas supporté.
    return { ok: false, errors: { _root: "Un avoir ne peut pas être dupliqué." } };
  }

  const sourceLines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));

  const [created] = await db
    .insert(invoices)
    .values({
      organizationId,
      clientId: source.clientId,
      templateId: source.templateId,
      status: "draft",
      issueDate: null,
      dueDate: source.dueDate,
      notes: source.notes,
      globalDiscountType: source.globalDiscountType,
      globalDiscountValue: source.globalDiscountValue,
      subtotalCents: source.subtotalCents,
      discountCents: source.discountCents,
      vatByRate: source.vatByRate,
      totalCents: source.totalCents,
    })
    .returning({ id: invoices.id });

  if (sourceLines.length) {
    await db.insert(invoiceLines).values(
      sourceLines
        .sort((a, b) => a.position - b.position)
        .map((line, index) => ({
          invoiceId: created.id,
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
    documentType: "invoice",
    documentId: created.id,
    eventType: "created",
    payload: { duplicatedFrom: invoiceId },
  });

  return { ok: true, id: created.id };
}

export type IssueInvoiceResult =
  | { ok: true; number: string }
  | { ok: false; errors: Record<string, string> };

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Émission (H6, H7, H15) : transaction — vérifs (statut, ≥1 ligne, client
 * non archivé) → **snapshot** émetteur+client figé en JSON (immuabilité :
 * modifier le client/l'org APRÈS n'affecte jamais un PDF déjà émis, testé
 * en intégration) → numéro de séquence "invoice" → statut `issued` →
 * `share_token` → event. Toute erreur annule tout (numéro non consommé).
 */
export async function issueInvoice(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
): Promise<IssueInvoiceResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: invoices.id,
        status: invoices.status,
        clientId: invoices.clientId,
        quoteId: invoices.quoteId,
        kind: invoices.kind,
      })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
      .limit(1);
    if (!existing) {
      return { ok: false, errors: { _root: "Facture introuvable." } };
    }
    if (existing.kind === "credit_note") {
      // Un avoir s'émet via `issueCreditNote` (story 18, séquence AV, verrou
      // + annulation éventuelle du parent) — jamais via ce chemin.
      return { ok: false, errors: { _root: "Utilisez l'émission d'avoir pour ce document." } };
    }
    if (!canTransition("invoice", existing.status as InvoiceStatus, "issued")) {
      return { ok: false, errors: { _root: "Seule une facture brouillon peut être émise." } };
    }

    const lines = await tx
      .select({ id: invoiceLines.id })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId));
    if (lines.length === 0) {
      return { ok: false, errors: { _root: "La facture doit contenir au moins une ligne." } };
    }

    const [client] = await tx.select().from(clients).where(
      and(eq(clients.id, existing.clientId), eq(clients.organizationId, organizationId)),
    ).limit(1);
    if (!client || client.archivedAt) {
      return { ok: false, errors: { _root: "Client introuvable ou archivé." } };
    }

    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) {
      return { ok: false, errors: { _root: "Organisation introuvable." } };
    }

    const organizationSnapshot: InvoiceOrgSnapshot = {
      legalName: org.legalName,
      tradeName: org.tradeName,
      addressStreet: org.addressStreet,
      addressZip: org.addressZip,
      addressCity: org.addressCity,
      addressCountry: org.addressCountry,
      email: org.email,
      phone: org.phone,
      siret: org.siret,
      vatNumber: org.vatNumber,
      legalForm: org.legalForm,
      capital: org.capital,
      iban: org.iban,
      bic: org.bic,
      logoKey: org.logoKey,
    };
    const clientSnapshot: InvoiceClientSnapshot = {
      displayName: client.displayName,
      legalName: client.legalName,
      addressStreet: client.addressStreet,
      addressZip: client.addressZip,
      addressCity: client.addressCity,
      addressCountry: client.addressCountry,
      siret: client.siret,
      vatNumber: client.vatNumber,
      email: client.email,
    };

    const now = new Date();
    const number = await issueNumber(tx, {
      organizationId,
      kind: "invoice",
      year: now.getFullYear(),
      format: org.numberFormats.invoice,
    });

    await tx
      .update(invoices)
      .set({
        status: "issued",
        number,
        shareToken: generateShareToken(),
        organizationSnapshot,
        clientSnapshot,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "invoice",
      documentId: invoiceId,
      eventType: "issued",
      payload: { number },
    });

    // Story 17 : une facture issue d'une conversion fait passer le devis
    // d'origine à `invoiced` UNIQUEMENT à ce moment (jamais à la conversion
    // elle-même) — `canTransition` autorise ce passage depuis `signed` (le
    // chemin nominal) mais aussi `sent`/`viewed` (conversion forcée avant
    // signature formelle).
    if (existing.quoteId) {
      const [quote] = await tx
        .select({ status: quotes.status })
        .from(quotes)
        .where(eq(quotes.id, existing.quoteId))
        .limit(1);
      if (quote && canTransition("quote", quote.status as QuoteStatus, "invoiced")) {
        await tx
          .update(quotes)
          .set({ status: "invoiced", updatedAt: now })
          .where(eq(quotes.id, existing.quoteId));
        await addDocumentEvent(tx, {
          organizationId,
          documentType: "quote",
          documentId: existing.quoteId,
          eventType: "invoiced",
          payload: { invoiceId },
        });
      }
    }

    return { ok: true, number };
  });
}
