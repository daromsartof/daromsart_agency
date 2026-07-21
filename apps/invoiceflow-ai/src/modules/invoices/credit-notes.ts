import { randomBytes } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  canTransition,
  creditNoteDraftSchema,
  type CreditNoteDraftInput,
  type InvoiceStatus,
} from "@daromsart/core";
import type { AppDb } from "../../db/types";
import {
  clients,
  documentTemplates,
  invoiceLines,
  invoices,
  organizations,
  type InvoiceClientSnapshot,
  type InvoiceOrgSnapshot,
} from "../../db/schema";
import { addDocumentEvent } from "../documents/events";
import { issueNumber } from "../documents/numbering";
import { recalculateDocumentTotals } from "../documents/recalculate";

/**
 * Avoirs (story 18) — `kind = "credit_note"` sur la même table `invoices`
 * (structure posée story 12). Un avoir crédite (jamais ne facture) : lignes
 * à quantité NÉGATIVE, totaux négatifs (`@daromsart/core#computeDocumentTotals`
 * accepte les quantités négatives depuis cette story). Jamais de QR de
 * paiement (`buildQrCodes` ne les génère que pour `kind === "invoice"`,
 * story 13 — déjà correct sans changement).
 */

export type MutationResult = { ok: true } | { ok: false; errors: Record<string, string> };

export type CreateCreditNoteResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function zodErrorsToRecord(issues: { path: (string | number)[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function discountForDb(discount: CreditNoteDraftInput["globalDiscount"]) {
  if (!discount) return { type: null, value: null };
  return { type: discount.type, value: String(discount.value) };
}

/**
 * Crée un avoir brouillon intégral pour une facture émise : copie du
 * client/modèle/lignes (quantités NÉGATIVES — avoir total par défaut,
 * éditable ensuite en brouillon pour un avoir partiel), `kind =
 * "credit_note"`, `parent_invoice_id` posé. Totaux copiés DIRECTEMENT
 * (négation terme à terme des totaux déjà calculés du parent), pas
 * recalculés depuis les lignes : garantit un avoir total = exactement
 * -(total parent) au centime dès la création, sans dépendre du
 * comportement de `computeDocumentTotals` sur les remises (qui ne
 * s'appliquent jamais à une base négative, cf. story 18/totals.ts).
 */
export async function createCreditNoteDraft(
  db: AppDb,
  organizationId: string,
  parentInvoiceId: string,
): Promise<CreateCreditNoteResult> {
  const [parent] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, parentInvoiceId), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!parent) {
    return { ok: false, errors: { _root: "Facture introuvable." } };
  }
  if (parent.kind !== "invoice") {
    return { ok: false, errors: { _root: "Un avoir ne peut être créé que sur une facture." } };
  }
  if (parent.status === "draft" || parent.status === "cancelled") {
    return {
      ok: false,
      errors: { _root: "Cette facture ne peut pas recevoir d'avoir (brouillon ou déjà annulée)." },
    };
  }

  const parentLines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, parentInvoiceId))
    .orderBy(invoiceLines.position);

  const negatedVatByRate = Object.fromEntries(
    Object.entries(parent.vatByRate).map(([rate, cents]) => [rate, -cents]),
  );

  const [created] = await db
    .insert(invoices)
    .values({
      organizationId,
      clientId: parent.clientId,
      templateId: parent.templateId,
      kind: "credit_note",
      parentInvoiceId: parent.id,
      status: "draft",
      issueDate: null,
      dueDate: null,
      notes: parent.notes,
      globalDiscountType: parent.globalDiscountType,
      globalDiscountValue: parent.globalDiscountValue,
      subtotalCents: -parent.subtotalCents,
      discountCents: -parent.discountCents,
      vatByRate: negatedVatByRate,
      totalCents: -parent.totalCents,
    })
    .returning({ id: invoices.id });

  if (parentLines.length) {
    await db.insert(invoiceLines).values(
      parentLines.map((line, index) => ({
        invoiceId: created.id,
        description: line.description,
        quantity: String(-Number(line.quantity)),
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
    payload: { creditNoteForInvoiceId: parentInvoiceId },
  });

  return { ok: true, id: created.id };
}

async function assertClientInOrg(db: AppDb, organizationId: string, clientId: string) {
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
) {
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

async function writeLines(db: AppDb, invoiceId: string, lines: CreditNoteDraftInput["lines"]) {
  await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  await db.insert(invoiceLines).values(
    lines.map((line, index) => ({
      invoiceId,
      description: line.description,
      quantity: String(line.quantity),
      unitPriceCents: line.unitPriceCents,
      vatRate: String(line.vatRate),
      discountType: line.discount?.type ?? null,
      discountValue: line.discount?.value != null ? String(line.discount.value) : null,
      position: index,
    })),
  );
}

/** Reste créditable du parent : total parent − Σ|totaux| des avoirs déjà ÉMIS (hors `excludeId`). */
async function creditableRemainingCents(
  db: AppDb,
  parentInvoiceId: string,
  parentTotalCents: number,
  excludeId?: string,
): Promise<number> {
  const conditions = [
    eq(invoices.parentInvoiceId, parentInvoiceId),
    eq(invoices.kind, "credit_note"),
    ne(invoices.status, "draft"),
    ne(invoices.status, "cancelled"),
  ];
  if (excludeId) conditions.push(ne(invoices.id, excludeId));

  const [{ sum }] = await db
    .select({ sum: sql<number>`coalesce(sum(abs(${invoices.totalCents})), 0)::int` })
    .from(invoices)
    .where(and(...conditions));

  return parentTotalCents - sum;
}

/**
 * Modifie un avoir brouillon (avoir partiel : ajuster/supprimer des
 * lignes). Validation via `creditNoteDraftSchema` (quantités négatives).
 * Garde d'édition (plans/story-18.md) : le total absolu du brouillon
 * modifié ne doit jamais dépasser le reste créditable du parent (avoirs
 * déjà émis exclus de ce calcul, ce brouillon n'étant pas encore émis).
 */
export async function updateCreditNoteDraft(
  db: AppDb,
  organizationId: string,
  creditNoteId: string,
  input: CreditNoteDraftInput,
): Promise<MutationResult> {
  const parsed = creditNoteDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: invoices.id, status: invoices.status, kind: invoices.kind, parentInvoiceId: invoices.parentInvoiceId })
    .from(invoices)
    .where(and(eq(invoices.id, creditNoteId), eq(invoices.organizationId, organizationId)))
    .limit(1);
  if (!existing || existing.kind !== "credit_note") {
    return { ok: false, errors: { _root: "Avoir introuvable." } };
  }
  if (existing.status !== "draft") {
    return { ok: false, errors: { _root: "Seul un avoir brouillon peut être modifié." } };
  }

  if (!(await assertClientInOrg(db, organizationId, data.clientId))) {
    return { ok: false, errors: { clientId: "Client introuvable." } };
  }
  if (!(await assertTemplateInOrg(db, organizationId, data.templateId))) {
    return { ok: false, errors: { templateId: "Modèle introuvable." } };
  }

  const totals = recalculateDocumentTotals(data.lines, data.globalDiscount);
  const discount = discountForDb(data.globalDiscount);

  if (existing.parentInvoiceId) {
    const [parent] = await db
      .select({ totalCents: invoices.totalCents })
      .from(invoices)
      .where(eq(invoices.id, existing.parentInvoiceId))
      .limit(1);
    if (parent) {
      const remaining = await creditableRemainingCents(
        db,
        existing.parentInvoiceId,
        parent.totalCents,
      );
      if (Math.abs(totals.totalCents) > remaining) {
        return {
          ok: false,
          errors: { _root: "Le montant de l'avoir dépasse le reste créditable de la facture." },
        };
      }
    }
  }

  await db
    .update(invoices)
    .set({
      clientId: data.clientId,
      templateId: data.templateId || null,
      notes: data.notes,
      globalDiscountType: discount.type,
      globalDiscountValue: discount.value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatByRate: totals.vatByRate,
      totalCents: totals.totalCents,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, creditNoteId));

  await writeLines(db, creditNoteId, data.lines);
  await addDocumentEvent(db, {
    organizationId,
    documentType: "invoice",
    documentId: creditNoteId,
    eventType: "updated",
  });

  return { ok: true };
}

export type IssueCreditNoteResult =
  | { ok: true; number: string; parentCancelled: boolean }
  | { ok: false; errors: Record<string, string> };

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Émission d'un avoir (H6, H7, H15/H18) : transaction — vérifs (brouillon,
 * kind credit_note, ≥1 ligne, parent toujours valide) → garde du cumul
 * REVÉRIFIÉE ici (dernière ligne de défense contre 2 émissions concurrentes
 * dépassant le parent — verrou `FOR UPDATE` sur le PARENT, pas l'avoir : la
 * garde compare contre tous les avoirs émis, quel que soit celui en cours
 * d'émission) → snapshot figé → numéro de séquence `credit_note` (format AV)
 * → statut `issued`. Si le cumul (avoirs émis, celui-ci inclus) égale
 * exactement le total du parent → parent `cancelled` + event.
 */
export async function issueCreditNote(
  db: AppDb,
  organizationId: string,
  creditNoteId: string,
): Promise<IssueCreditNoteResult> {
  return db.transaction(async (tx): Promise<IssueCreditNoteResult> => {
    const [creditNote] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, creditNoteId), eq(invoices.organizationId, organizationId)))
      .limit(1);
    if (!creditNote || creditNote.kind !== "credit_note") {
      return { ok: false, errors: { _root: "Avoir introuvable." } };
    }
    if (!canTransition("invoice", creditNote.status as InvoiceStatus, "issued")) {
      return { ok: false, errors: { _root: "Seul un avoir brouillon peut être émis." } };
    }
    if (!creditNote.parentInvoiceId) {
      return { ok: false, errors: { _root: "Avoir sans facture d'origine." } };
    }

    const lines = await tx
      .select({ id: invoiceLines.id })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, creditNoteId));
    if (lines.length === 0) {
      return { ok: false, errors: { _root: "L'avoir doit contenir au moins une ligne." } };
    }

    // Verrou sur la ligne PARENT : sérialise les émissions concurrentes de
    // plusieurs avoirs pour la même facture (parade « cumul dépassant le
    // parent », plans/story-18.md).
    const [parent] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, creditNote.parentInvoiceId))
      .for("update");
    if (!parent || parent.kind !== "invoice" || parent.status === "cancelled") {
      return { ok: false, errors: { _root: "Facture d'origine introuvable ou déjà annulée." } };
    }

    const remaining = await creditableRemainingCents(
      tx,
      parent.id,
      parent.totalCents,
      creditNoteId,
    );
    if (Math.abs(creditNote.totalCents) > remaining) {
      return {
        ok: false,
        errors: { _root: "Le montant de l'avoir dépasse le reste créditable de la facture." },
      };
    }

    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, creditNote.clientId), eq(clients.organizationId, organizationId)))
      .limit(1);
    if (!client) {
      return { ok: false, errors: { _root: "Client introuvable." } };
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
      kind: "credit_note",
      year: now.getFullYear(),
      format: org.numberFormats.creditNote,
    });

    await tx
      .update(invoices)
      .set({
        status: "issued",
        number,
        issueDate: now,
        shareToken: generateShareToken(),
        organizationSnapshot,
        clientSnapshot,
        updatedAt: now,
      })
      .where(eq(invoices.id, creditNoteId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "invoice",
      documentId: creditNoteId,
      eventType: "issued",
      payload: { number },
    });

    const remainingAfter = remaining - Math.abs(creditNote.totalCents);
    let parentCancelled = false;
    if (remainingAfter <= 0 && canTransition("invoice", parent.status as InvoiceStatus, "cancelled")) {
      await tx
        .update(invoices)
        .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
        .where(eq(invoices.id, parent.id));
      await addDocumentEvent(tx, {
        organizationId,
        documentType: "invoice",
        documentId: parent.id,
        eventType: "cancelled",
        payload: { creditNoteId, creditNoteNumber: number },
      });
      parentCancelled = true;
    }

    return { ok: true, number, parentCancelled };
  });
}

export interface CreditNoteRow {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  issueDate: Date | null;
  totalCents: number;
}

/** Avoirs d'une facture parent (card "Avoirs", E-16), du plus récent au plus ancien. */
export async function listCreditNotesForParent(
  db: AppDb,
  organizationId: string,
  parentInvoiceId: string,
): Promise<CreditNoteRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.parentInvoiceId, parentInvoiceId),
        eq(invoices.kind, "credit_note"),
      ),
    )
    .orderBy(desc(invoices.createdAt));
  return rows.map((row) => ({ ...row, status: row.status as InvoiceStatus }));
}
