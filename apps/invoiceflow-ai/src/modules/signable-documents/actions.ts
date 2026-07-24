"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../db";
import { storage } from "../../lib/storage";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  signSignableDocument,
  uploadSignableDocument,
  type MutationResult,
  type SignatureAnchor,
} from "./mutations";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function uploadSignableDocumentAction(
  formData: FormData,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, errors: { file: "Aucun fichier reçu." } };
  }
  const result = await uploadSignableDocument(db, storage, organizationId, {
    filename: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  if (result.ok) revalidatePath("/signatures");
  return result;
}

export async function signSignableDocumentAction(
  id: string,
  input: { signerName: string; pngDataUrl: string; page: number; anchor: SignatureAnchor },
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await signSignableDocument(db, storage, organizationId, id, input);
  if (result.ok) {
    revalidatePath("/signatures");
    revalidatePath(`/signatures/${id}`);
  }
  return result;
}
