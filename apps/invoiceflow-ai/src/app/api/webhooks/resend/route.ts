import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { env } from "@/lib/env";
import { applyResendWebhookEvent, verifyResendWebhook } from "@/modules/emails/webhook";

/**
 * Webhook Resend (story 20) : signature svix vérifiée sur le body BRUT
 * (`req.text()`, jamais `req.json()` qui re-sérialiserait et casserait la
 * signature). 401 si signature invalide, 200 dans tous les autres cas (event
 * non géré ou `resend_id` inconnu inclus) — ne jamais faire échouer un
 * webhook légitime signé, Resend le désactiverait après trop d'échecs.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = verifyResendWebhook(env.RESEND_WEBHOOK_SECRET, rawBody, {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  await applyResendWebhookEvent(db, result.event);

  return NextResponse.json({ received: true });
}
