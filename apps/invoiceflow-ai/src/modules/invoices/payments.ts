import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { canTransition, type InvoiceStatus } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { invoices, payments } from "../../db/schema";
import { addDocumentEvent } from "../documents/events";

/**
 * Paiements (story 15) — la structure `payments` existe depuis la story 12
 * mais n'était pas encore alimentée. `amount_paid_cents` sur `invoices`
 * n'est JAMAIS incrémenté à l'aveugle : toujours recalculé par SOMME SQL sur
 * `payments` dans la même transaction, pour ne jamais dériver (parade «
 * incrément dénormalisé qui dérive », plans/story-15.md). La ligne facture
 * est verrouillée (`SELECT ... FOR UPDATE`, même pattern que `numbering.ts`,
 * story 08) le temps de lire-recalculer-écrire : deux paiements concurrents
 * qui soldent tous les deux la facture ne peuvent pas passer ensemble.
 */

export const PAYMENT_METHODS = ["transfer", "card", "cash", "check", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const recordPaymentSchema = z.object({
  amountCents: z.number().int("Montant invalide.").positive("Le montant doit être positif."),
  paidAt: z.date().optional(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

function zodErrorsToRecord(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** `paid` si le cumul solde (ou dépasse — ne devrait jamais arriver, garde en amont) le total, sinon `partially_paid`. */
function statusForAmountPaid(amountPaidCents: number, totalCents: number): "partially_paid" | "paid" {
  return amountPaidCents >= totalCents ? "paid" : "partially_paid";
}

export type RecordPaymentResult =
  | { ok: true; paymentId: string; status: InvoiceStatus; amountPaidCents: number }
  | { ok: false; errors: Record<string, string> };

export async function recordPayment(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  return db.transaction(async (tx): Promise<RecordPaymentResult> => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
      .for("update");
    if (!invoice) {
      return { ok: false, errors: { _root: "Facture introuvable." } };
    }
    if (invoice.kind === "credit_note") {
      // Décision V1 (story 18, plans/ledger.md) : les remboursements liés à
      // un avoir se suivent hors outil, jamais via `recordPayment`.
      return { ok: false, errors: { _root: "Impossible d'enregistrer un paiement sur un avoir." } };
    }
    if (invoice.status === "draft" || invoice.status === "cancelled") {
      return {
        ok: false,
        errors: { _root: "Impossible d'enregistrer un paiement sur une facture brouillon ou annulée." },
      };
    }

    const remainingCents = invoice.totalCents - invoice.amountPaidCents;
    if (data.amountCents > remainingCents) {
      return {
        ok: false,
        errors: { amountCents: "Le montant dépasse le reste dû." },
      };
    }

    const [created] = await tx
      .insert(payments)
      .values({
        invoiceId,
        paidAt: data.paidAt ?? new Date(),
        amountCents: data.amountCents,
        method: data.method,
        reference: data.reference || null,
        note: data.note || null,
      })
      .returning({ id: payments.id });

    const [{ sum: amountPaidCents }] = await tx
      .select({ sum: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const newStatus = statusForAmountPaid(amountPaidCents, invoice.totalCents);
    // `canTransition` refuse `from === to` (règle générale : une transition
    // change toujours d'état) — mais un second paiement partiel qui reste
    // `partially_paid` n'est pas une "transition", juste une continuation du
    // même statut : on ne vérifie `canTransition` que si le statut change
    // réellement (même garde que `deletePayment`).
    if (
      newStatus !== invoice.status &&
      !canTransition("invoice", invoice.status as InvoiceStatus, newStatus)
    ) {
      return { ok: false, errors: { _root: "Transition de statut refusée." } };
    }

    const now = new Date();
    await tx
      .update(invoices)
      .set({
        amountPaidCents,
        status: newStatus,
        paidAt: newStatus === "paid" ? now : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "invoice",
      documentId: invoiceId,
      eventType: "payment_recorded",
      payload: { amountCents: data.amountCents, method: data.method, newStatus },
    });

    return { ok: true, paymentId: created.id, status: newStatus, amountPaidCents };
  });
}

export type DeletePaymentResult =
  | { ok: true; status: InvoiceStatus; amountPaidCents: number }
  | { ok: false; errors: Record<string, string> };

/**
 * Suppression admin d'un paiement : recalcul complet (jamais un décrément
 * aveugle) puis, si le nouveau statut diffère de l'actuel, seule la
 * transition explicitement autorisée `paid → partially_paid` (core, story 15)
 * peut s'appliquer — voir le commentaire sur `INVOICE_TRANSITIONS`.
 */
export async function deletePayment(
  db: AppDb,
  organizationId: string,
  invoiceId: string,
  paymentId: string,
): Promise<DeletePaymentResult> {
  return db.transaction(async (tx): Promise<DeletePaymentResult> => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
      .for("update");
    if (!invoice) {
      return { ok: false, errors: { _root: "Facture introuvable." } };
    }

    const [payment] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)));
    if (!payment) {
      return { ok: false, errors: { _root: "Paiement introuvable." } };
    }

    await tx.delete(payments).where(eq(payments.id, paymentId));

    const [{ sum: amountPaidCents }] = await tx
      .select({ sum: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const newStatus = statusForAmountPaid(amountPaidCents, invoice.totalCents);
    if (newStatus !== invoice.status) {
      if (!canTransition("invoice", invoice.status as InvoiceStatus, newStatus)) {
        return { ok: false, errors: { _root: "Transition de statut refusée." } };
      }
    }

    const now = new Date();
    await tx
      .update(invoices)
      .set({
        amountPaidCents,
        status: newStatus,
        paidAt: newStatus === "paid" ? (invoice.paidAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId));

    await addDocumentEvent(tx, {
      organizationId,
      documentType: "invoice",
      documentId: invoiceId,
      eventType: "payment_deleted",
      payload: { paymentId, newStatus },
    });

    return { ok: true, status: newStatus, amountPaidCents };
  });
}

export interface PaymentRow {
  id: string;
  paidAt: Date;
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
}

/** Liste des paiements d'une facture (E-16, du plus récent au plus ancien). */
export async function listPaymentsForInvoice(
  db: AppDb,
  invoiceId: string,
): Promise<PaymentRow[]> {
  return db
    .select({
      id: payments.id,
      paidAt: payments.paidAt,
      amountCents: payments.amountCents,
      method: payments.method,
      reference: payments.reference,
      note: payments.note,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.paidAt));
}
