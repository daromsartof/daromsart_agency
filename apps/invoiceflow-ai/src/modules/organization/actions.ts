"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../db";
import { storage } from "../../lib/storage";
import { requireAdmin } from "../auth/session";
import { getOrg } from "./queries";
import {
  applyAddress,
  applyBank,
  applyDeleteLogo,
  applyDelays,
  applyEmailDefaults,
  applyIdentity,
  applyLegalFooter,
  applyNumberFormats,
  applyUploadLogo,
  applyVatSettings,
  resetEmailDefault,
  type MutationResult,
} from "./mutations";
import type {
  AddressInput,
  BankInput,
  DelaysInput,
  EmailDefaultsInput,
  IdentityInput,
  LegalFooterInput,
  NumberFormatsInput,
  VatSettingsInput,
} from "./schemas";
import type { EmailDefaults } from "../../db/schema";

export type ActionResult = MutationResult;

export async function updateIdentity(input: IdentityInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyIdentity(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function updateAddress(input: AddressInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyAddress(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function updateBank(input: BankInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyBank(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function updateLegalFooter(
  input: LegalFooterInput,
): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyLegalFooter(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, errors: { file: "Aucun fichier reçu." } };
  }
  const org = await getOrg();
  const result = await applyUploadLogo(db, storage, org, {
    buffer: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    size: file.size,
  });
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function deleteLogo(): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyDeleteLogo(db, storage, org);
  if (result.ok) revalidatePath("/parametres/entreprise");
  return result;
}

export async function updateNumberFormats(input: NumberFormatsInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyNumberFormats(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/facturation");
  return result;
}

export async function updateVatSettings(input: VatSettingsInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyVatSettings(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/facturation");
  return result;
}

export async function updateDelays(input: DelaysInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyDelays(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/facturation");
  return result;
}

export async function updateEmailDefaults(input: EmailDefaultsInput): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await applyEmailDefaults(db, org.id, input);
  if (result.ok) revalidatePath("/parametres/emails");
  return result;
}

export async function resetEmailDefaultAction(
  kind: keyof EmailDefaults,
): Promise<ActionResult> {
  await requireAdmin();
  const org = await getOrg();
  const result = await resetEmailDefault(db, org.id, kind);
  if (result.ok) revalidatePath("/parametres/emails");
  return result;
}
