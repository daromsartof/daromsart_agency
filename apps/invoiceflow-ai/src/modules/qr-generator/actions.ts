"use server";

import { revalidatePath } from "next/cache";
import type { QrContentType } from "@daromsart/qr";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import {
  createQrCode,
  deleteQrCode,
  type CreateQrCodeResult,
  type MutationResult,
  type SaveQrCodeInput,
} from "./mutations";
import { getQrCodeById, type QrCodeRow } from "./queries";
import type { QrDesignJson, QrFormValuesJson } from "@/db/schema/qr-codes";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function createQrCodeAction(
  input: SaveQrCodeInput,
): Promise<CreateQrCodeResult> {
  const organizationId = await requireOrganizationId();
  const result = await createQrCode(db, organizationId, input);
  if (result.ok) revalidatePath("/qrcode");
  return result;
}

export async function deleteQrCodeAction(id: string): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await deleteQrCode(db, organizationId, id);
  if (result.ok) {
    revalidatePath("/qrcode");
    revalidatePath(`/qrcode/${id}`);
  }
  return result;
}

export async function getQrCodeAction(id: string): Promise<QrCodeRow | null> {
  const organizationId = await requireOrganizationId();
  return getQrCodeById(db, organizationId, id);
}

export type { SaveQrCodeInput, QrContentType, QrDesignJson, QrFormValuesJson };
