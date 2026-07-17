"use server";

import { revalidatePath } from "next/cache";
import type { DocumentDraftInput } from "@daromsart/core";
import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  createDraft,
  deleteDraft,
  duplicate,
  updateDraft,
  type CreateQuoteResult,
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
