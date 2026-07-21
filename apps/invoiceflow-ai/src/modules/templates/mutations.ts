import { and, eq, ne, or } from "drizzle-orm";
import { templateSchema, type TemplateInput } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { documentTemplates } from "../../db/schema";
import { countTemplateReferences, getTemplateById } from "./queries";

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export type CreateTemplateResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function zodErrorsToRecord(
  issues: { path: (string | number)[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createTemplate(
  db: AppDb,
  organizationId: string,
  input: TemplateInput,
): Promise<CreateTemplateResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  const [created] = await db
    .insert(documentTemplates)
    .values({
      organizationId,
      name: data.name,
      type: data.type,
      options: data.options,
    })
    .returning({ id: documentTemplates.id });

  return { ok: true, id: created.id };
}

export async function updateTemplate(
  db: AppDb,
  organizationId: string,
  templateId: string,
  input: TemplateInput,
): Promise<MutationResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;

  const existing = await getTemplateById(db, organizationId, templateId);
  if (!existing) {
    return { ok: false, errors: { _root: "Modèle introuvable." } };
  }

  await db
    .update(documentTemplates)
    .set({
      name: data.name,
      type: data.type,
      options: data.options,
      updatedAt: new Date(),
    })
    .where(eq(documentTemplates.id, templateId));

  return { ok: true };
}

export async function duplicateTemplate(
  db: AppDb,
  organizationId: string,
  templateId: string,
): Promise<CreateTemplateResult> {
  const source = await getTemplateById(db, organizationId, templateId);
  if (!source) {
    return { ok: false, errors: { _root: "Modèle introuvable." } };
  }

  const [created] = await db
    .insert(documentTemplates)
    .values({
      organizationId,
      name: `${source.name} (copie)`,
      type: source.type,
      isDefault: false,
      options: source.options,
    })
    .returning({ id: documentTemplates.id });

  return { ok: true, id: created.id };
}

/**
 * Définit un modèle comme défaut (transaction) : dé-défaut tout autre
 * modèle dont le type "chevauche" celui de la cible (ex. un modèle `both`
 * devenant défaut dé-défaut à la fois l'ancien défaut `quote` et l'ancien
 * défaut `invoice`), puis marque la cible — jamais deux défauts effectifs
 * pour un même type de document (parade « setDefault en course »).
 */
export async function setDefaultTemplate(
  db: AppDb,
  organizationId: string,
  templateId: string,
): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: documentTemplates.id, type: documentTemplates.type })
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.id, templateId),
          eq(documentTemplates.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!target) {
      return { ok: false, errors: { _root: "Modèle introuvable." } };
    }

    const overlappingTypes =
      target.type === "both" ? ["quote", "invoice", "both"] : [target.type, "both"];

    await tx
      .update(documentTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(documentTemplates.organizationId, organizationId),
          ne(documentTemplates.id, templateId),
          or(...overlappingTypes.map((t) => eq(documentTemplates.type, t as "quote" | "invoice" | "both"))),
        ),
      );

    await tx
      .update(documentTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(documentTemplates.id, templateId));

    return { ok: true };
  });
}

export async function deleteTemplate(
  db: AppDb,
  organizationId: string,
  templateId: string,
): Promise<MutationResult> {
  const existing = await getTemplateById(db, organizationId, templateId);
  if (!existing) {
    return { ok: false, errors: { _root: "Modèle introuvable." } };
  }

  const references = await countTemplateReferences(db, templateId);
  if (references > 0) {
    return {
      ok: false,
      errors: { _root: "Ce modèle est utilisé par au moins un document et ne peut pas être supprimé." },
    };
  }

  await db.delete(documentTemplates).where(eq(documentTemplates.id, templateId));
  return { ok: true };
}
