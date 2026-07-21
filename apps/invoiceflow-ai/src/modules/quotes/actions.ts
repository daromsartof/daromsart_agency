"use server";

import { revalidatePath } from "next/cache";
import type { DocumentDraftInput } from "@daromsart/core";
import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  convertToInvoice,
  createDraft,
  deleteDraft,
  duplicate,
  issueQuote,
  markRefused,
  updateDraft,
  type ConvertToInvoiceResult,
  type CreateQuoteResult,
  type IssueQuoteResult,
  type MutationResult,
} from "./mutations";
import { getQuoteById, type QuoteDetail } from "./queries";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function createQuoteAction(
  input: DocumentDraftInput,
): Promise<CreateQuoteResult> {
  const organizationId = await requireOrganizationId();
  const result = await createDraft(db, organizationId, input);
  if (result.ok) revalidatePath("/devis");
  return result;
}

export async function updateQuoteAction(
  quoteId: string,
  input: DocumentDraftInput,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await updateDraft(db, organizationId, quoteId, input);
  if (result.ok) {
    revalidatePath("/devis");
    revalidatePath(`/devis/${quoteId}`);
  }
  return result;
}

export async function deleteQuoteAction(
  quoteId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await deleteDraft(db, organizationId, quoteId);
  if (result.ok) revalidatePath("/devis");
  return result;
}

export async function duplicateQuoteAction(
  quoteId: string,
): Promise<CreateQuoteResult> {
  const organizationId = await requireOrganizationId();
  const result = await duplicate(db, organizationId, quoteId);
  if (result.ok) revalidatePath("/devis");
  return result;
}

export async function getQuoteForEditAction(
  quoteId: string,
): Promise<QuoteDetail | null> {
  const organizationId = await requireOrganizationId();
  return getQuoteById(db, organizationId, quoteId);
}

export async function issueQuoteAction(quoteId: string): Promise<IssueQuoteResult> {
  const organizationId = await requireOrganizationId();
  const result = await issueQuote(db, organizationId, quoteId);
  if (result.ok) {
    revalidatePath("/devis");
    revalidatePath(`/devis/${quoteId}`);
  }
  return result;
}

export async function markRefusedAction(
  quoteId: string,
  reason?: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await markRefused(db, organizationId, quoteId, reason);
  if (result.ok) {
    revalidatePath("/devis");
    revalidatePath(`/devis/${quoteId}`);
  }
  return result;
}

export async function convertToInvoiceAction(
  quoteId: string,
  options: { force?: boolean } = {},
): Promise<ConvertToInvoiceResult> {
  const organizationId = await requireOrganizationId();
  const result = await convertToInvoice(db, organizationId, quoteId, options);
  if (result.ok) {
    revalidatePath("/devis");
    revalidatePath(`/devis/${quoteId}`);
    revalidatePath("/factures");
  }
  return result;
}
