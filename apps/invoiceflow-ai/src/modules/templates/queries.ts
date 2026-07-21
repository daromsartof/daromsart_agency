import { and, asc, count, eq, or } from "drizzle-orm";
import { templateOptionsSchema, type TemplateOptions, type TemplateType } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { documentTemplates, quotes } from "../../db/schema";

export interface TemplateRow {
  id: string;
  name: string;
  type: TemplateType;
  isDefault: boolean;
  options: TemplateOptions;
  createdAt: Date;
  updatedAt: Date;
}

function toTemplateRow(row: {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  options: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TemplateRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TemplateType,
    isDefault: row.isDefault,
    // Reparsé avec defaults à chaque lecture (tolérance schéma futur).
    options: templateOptionsSchema.parse(row.options ?? {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listTemplates(
  db: AppDb,
  organizationId: string,
): Promise<TemplateRow[]> {
  const rows = await db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.organizationId, organizationId))
    .orderBy(asc(documentTemplates.name));
  return rows.map(toTemplateRow);
}

export async function getTemplateById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<TemplateRow | null> {
  const [row] = await db
    .select()
    .from(documentTemplates)
    .where(
      and(eq(documentTemplates.id, id), eq(documentTemplates.organizationId, organizationId)),
    )
    .limit(1);
  return row ? toTemplateRow(row) : null;
}

/** Modèle par défaut pour un type de document donné (`quote`/`invoice`), `null` si aucun. */
export async function getDefaultTemplate(
  db: AppDb,
  organizationId: string,
  kind: "quote" | "invoice",
): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.organizationId, organizationId),
        eq(documentTemplates.isDefault, true),
        or(eq(documentTemplates.type, kind), eq(documentTemplates.type, "both")),
      ),
    )
    .limit(1);
  return rows[0] ? toTemplateRow(rows[0]) : null;
}

/**
 * Nombre de documents référençant ce modèle (garde anti-suppression).
 * V1 : devis uniquement — les factures (story 12) devront s'ajouter ici dès
 * que `invoices.template_id` existera.
 */
export async function countTemplateReferences(
  db: AppDb,
  templateId: string,
): Promise<number> {
  const [quoteCount] = await db
    .select({ value: count() })
    .from(quotes)
    .where(eq(quotes.templateId, templateId));
  return quoteCount?.value ?? 0;
}
