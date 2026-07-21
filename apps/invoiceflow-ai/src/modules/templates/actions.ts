"use server";

import { revalidatePath } from "next/cache";
import type { TemplateInput } from "@daromsart/core";
import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  updateTemplate,
  type CreateTemplateResult,
  type MutationResult,
} from "./mutations";
import { getTemplateById, type TemplateRow } from "./queries";

/**
 * Outil interne : les modèles sont accessibles à tous les membres (pas
 * seulement admin) — seuls les paramètres d'organisation restent admin-only
 * (décision story 09, `plans/story-09.md`).
 */
async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function createTemplateAction(
  input: TemplateInput,
): Promise<CreateTemplateResult> {
  const organizationId = await requireOrganizationId();
  const result = await createTemplate(db, organizationId, input);
  if (result.ok) revalidatePath("/modeles");
  return result;
}

export async function updateTemplateAction(
  templateId: string,
  input: TemplateInput,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await updateTemplate(db, organizationId, templateId, input);
  if (result.ok) {
    revalidatePath("/modeles");
    revalidatePath(`/modeles/${templateId}`);
  }
  return result;
}

export async function duplicateTemplateAction(
  templateId: string,
): Promise<CreateTemplateResult> {
  const organizationId = await requireOrganizationId();
  const result = await duplicateTemplate(db, organizationId, templateId);
  if (result.ok) revalidatePath("/modeles");
  return result;
}

export async function setDefaultTemplateAction(
  templateId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await setDefaultTemplate(db, organizationId, templateId);
  if (result.ok) revalidatePath("/modeles");
  return result;
}

export async function deleteTemplateAction(
  templateId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await deleteTemplate(db, organizationId, templateId);
  if (result.ok) revalidatePath("/modeles");
  return result;
}

export async function getTemplateForEditAction(
  templateId: string,
): Promise<TemplateRow | null> {
  const organizationId = await requireOrganizationId();
  return getTemplateById(db, organizationId, templateId);
}
