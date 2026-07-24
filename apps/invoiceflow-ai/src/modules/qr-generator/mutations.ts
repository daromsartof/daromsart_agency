import { and, eq } from "drizzle-orm";
import type { QrContentType } from "@daromsart/qr";
import type { AppDb } from "../../db/types";
import { qrCodes, type QrDesignJson, type QrFormValuesJson } from "../../db/schema";
import { getQrCodeById } from "./queries";

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export type CreateQrCodeResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export interface SaveQrCodeInput {
  name: string;
  contentType: QrContentType;
  formValues: QrFormValuesJson;
  design: QrDesignJson;
  payload: string;
}

function validate(input: SaveQrCodeInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) errors.name = "Le nom est requis.";
  if (!input.payload.trim()) errors.payload = "Le contenu du QR est invalide.";
  if (!input.contentType) errors.contentType = "Type requis.";
  return Object.keys(errors).length ? errors : null;
}

export async function createQrCode(
  db: AppDb,
  organizationId: string,
  input: SaveQrCodeInput,
): Promise<CreateQrCodeResult> {
  const errors = validate(input);
  if (errors) return { ok: false, errors };

  const [created] = await db
    .insert(qrCodes)
    .values({
      organizationId,
      name: input.name.trim(),
      contentType: input.contentType,
      formValues: input.formValues,
      design: input.design,
      payload: input.payload,
    })
    .returning({ id: qrCodes.id });

  return { ok: true, id: created.id };
}

export async function updateQrCode(
  db: AppDb,
  organizationId: string,
  id: string,
  input: SaveQrCodeInput,
): Promise<MutationResult> {
  const errors = validate(input);
  if (errors) return { ok: false, errors };

  const existing = await getQrCodeById(db, organizationId, id);
  if (!existing) {
    return { ok: false, errors: { _root: "QR code introuvable." } };
  }

  await db
    .update(qrCodes)
    .set({
      name: input.name.trim(),
      contentType: input.contentType,
      formValues: input.formValues,
      design: input.design,
      payload: input.payload,
      updatedAt: new Date(),
    })
    .where(and(eq(qrCodes.organizationId, organizationId), eq(qrCodes.id, id)));

  return { ok: true };
}

export async function deleteQrCode(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<MutationResult> {
  const existing = await getQrCodeById(db, organizationId, id);
  if (!existing) {
    return { ok: false, errors: { _root: "QR code introuvable." } };
  }

  await db
    .delete(qrCodes)
    .where(and(eq(qrCodes.organizationId, organizationId), eq(qrCodes.id, id)));

  return { ok: true };
}
