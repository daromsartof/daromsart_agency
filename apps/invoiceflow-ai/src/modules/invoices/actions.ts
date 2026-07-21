"use server";

import { revalidatePath } from "next/cache";
import type { DocumentDraftInput } from "@daromsart/core";
import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
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
