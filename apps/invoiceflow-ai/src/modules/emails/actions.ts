"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../db";
import { storage } from "../../lib/storage";
import { mailer } from "../../lib/mailer";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  sendInvoiceEmail,
  sendQuoteEmail,
  type SendInvoiceEmailInput,
  type SendInvoiceEmailResult,
  type SendQuoteEmailInput,
  type SendQuoteEmailResult,
} from "./send-document";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function sendQuoteEmailAction(
  quoteId: string,
  input: SendQuoteEmailInput,
): Promise<SendQuoteEmailResult> {
  const organizationId = await requireOrganizationId();
  const result = await sendQuoteEmail(db, storage, mailer, organizationId, quoteId, input);
  if (result.ok) {
    revalidatePath("/devis");
    revalidatePath(`/devis/${quoteId}`);
  }
  return result;
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  const organizationId = await requireOrganizationId();
  const result = await sendInvoiceEmail(db, storage, mailer, organizationId, invoiceId, input);
  if (result.ok) {
    revalidatePath("/factures");
    revalidatePath(`/factures/${invoiceId}`);
  }
  return result;
}
