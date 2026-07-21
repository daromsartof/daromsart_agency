"use server";

import { revalidatePath } from "next/cache";
import type { CreditNoteDraftInput, DocumentDraftInput } from "@daromsart/core";
import { db } from "../../db";
import { storage } from "../../lib/storage";
import { mailer } from "../../lib/mailer";
import { getCurrentOrganizationId, requireAdmin, requireSession } from "../auth/session";
import {
  createDraft,
  deleteDraft,
  duplicate,
  issueInvoice,
  updateDraft,
  type CreateInvoiceResult,
  type IssueInvoiceResult,
  type MutationResult,
} from "./mutations";
import { getInvoiceById, type InvoiceDetail } from "./queries";
import {
  deletePayment,
  recordPayment,
  type DeletePaymentResult,
  type RecordPaymentInput,
  type RecordPaymentResult,
} from "./payments";
import { remindInvoice, type RemindInvoiceInput, type RemindInvoiceResult } from "./reminders";
import {
  createCreditNoteDraft,
  issueCreditNote,
  updateCreditNoteDraft,
  type CreateCreditNoteResult,
  type IssueCreditNoteResult,
} from "./credit-notes";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function createInvoiceAction(
  input: DocumentDraftInput,
): Promise<CreateInvoiceResult> {
  const organizationId = await requireOrganizationId();
  const result = await createDraft(db, organizationId, input);
  if (result.ok) revalidatePath("/factures");
  return result;
}

export async function updateInvoiceAction(
  invoiceId: string,
  input: DocumentDraftInput,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await updateDraft(db, organizationId, invoiceId, input);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}

export async function deleteInvoiceAction(
  invoiceId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await deleteDraft(db, organizationId, invoiceId);
  if (result.ok) revalidatePath("/factures");
  return result;
}

export async function duplicateInvoiceAction(
  invoiceId: string,
): Promise<CreateInvoiceResult> {
  const organizationId = await requireOrganizationId();
  const result = await duplicate(db, organizationId, invoiceId);
  if (result.ok) revalidatePath("/factures");
  return result;
}

export async function getInvoiceForEditAction(
  invoiceId: string,
): Promise<InvoiceDetail | null> {
  const organizationId = await requireOrganizationId();
  return getInvoiceById(db, organizationId, invoiceId);
}

export async function issueInvoiceAction(invoiceId: string): Promise<IssueInvoiceResult> {
  const organizationId = await requireOrganizationId();
  const result = await issueInvoice(db, organizationId, invoiceId);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}

export async function recordPaymentAction(
  invoiceId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const organizationId = await requireOrganizationId();
  const result = await recordPayment(db, organizationId, invoiceId, input);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}

/** Suppression admin uniquement (E-16) : re-vérifiée ici, pas seulement masquée côté UI. */
export async function deletePaymentAction(
  invoiceId: string,
  paymentId: string,
): Promise<DeletePaymentResult> {
  const session = await requireAdmin();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  const result = await deletePayment(db, organizationId, invoiceId, paymentId);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}

export async function remindInvoiceAction(
  invoiceId: string,
  input: RemindInvoiceInput,
): Promise<RemindInvoiceResult> {
  const organizationId = await requireOrganizationId();
  const result = await remindInvoice(db, storage, mailer, organizationId, invoiceId, input);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}

export async function createCreditNoteAction(
  parentInvoiceId: string,
): Promise<CreateCreditNoteResult> {
  const organizationId = await requireOrganizationId();
  const result = await createCreditNoteDraft(db, organizationId, parentInvoiceId);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${parentInvoiceId}`);
  }
  return result;
}

export async function updateCreditNoteAction(
  creditNoteId: string,
  input: CreditNoteDraftInput,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await updateCreditNoteDraft(db, organizationId, creditNoteId, input);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${creditNoteId}`);
  }
  return result;
}

export async function issueCreditNoteAction(
  creditNoteId: string,
): Promise<IssueCreditNoteResult> {
  const organizationId = await requireOrganizationId();
  const result = await issueCreditNote(db, organizationId, creditNoteId);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${creditNoteId}`);
  }
  return result;
}
