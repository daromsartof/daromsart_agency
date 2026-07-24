"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../../db";
import { storage } from "../../lib/storage";
import { mailer } from "../../lib/mailer";
import { checkRateLimit } from "./rate-limit";
import {
  refuseQuote,
  signInvoice,
  signQuote,
  type RefuseQuoteResult,
  type SignInvoiceResult,
  type SignQuoteResult,
} from "./mutations";

function clientIp(): string {
  const forwardedFor = headers().get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

const RATE_LIMIT_ERROR = {
  ok: false as const,
  errors: { _root: "Trop de requêtes — merci de réessayer dans une minute." },
};

export async function signQuoteAction(
  token: string,
  input: { name: string; email?: string; pngDataUrl: string },
): Promise<SignQuoteResult> {
  const ip = clientIp();
  if (!checkRateLimit(ip)) {
    return RATE_LIMIT_ERROR;
  }

  const result = await signQuote(db, storage, mailer, token, {
    ...input,
    ip,
    userAgent: headers().get("user-agent"),
  });
  if (result.ok) {
    revalidatePath(`/p/devis/${token}`);
  }
  return result;
}

export async function signInvoiceAction(
  token: string,
  input: { name: string; email?: string; pngDataUrl: string },
): Promise<SignInvoiceResult> {
  const ip = clientIp();
  if (!checkRateLimit(ip)) {
    return RATE_LIMIT_ERROR;
  }

  const result = await signInvoice(db, storage, mailer, token, {
    ...input,
    ip,
    userAgent: headers().get("user-agent"),
  });
  if (result.ok) {
    revalidatePath(`/p/factures/${token}`);
  }
  return result;
}

export async function refuseQuoteAction(
  token: string,
  reason?: string,
): Promise<RefuseQuoteResult> {
  const ip = clientIp();
  if (!checkRateLimit(ip)) {
    return RATE_LIMIT_ERROR;
  }

  const result = await refuseQuote(db, token, reason);
  if (result.ok) {
    revalidatePath(`/p/devis/${token}`);
  }
  return result;
}
