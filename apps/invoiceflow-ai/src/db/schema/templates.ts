import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { TemplateOptions, TemplateType } from "@daromsart/core";
import { organizations } from "./organization";

/**
 * Modèle de document (devis/facture/les deux) — options de rendu appliquées
 * par `@daromsart/pdf` (story 09). `options` est toujours reparsé via
 * `templateOptionsSchema` à la lecture (tolérance aux champs manquants d'un
 * schéma futur, cf. plans/story-09.md). Un seul défaut par type effectif
 * (`isDefault`) — un modèle `both` défaut compte comme défaut pour devis ET
 * facture (voir `templateAppliesToKind`) : appliqué via
 * `modules/templates/mutations.ts#setDefaultTemplate` (transaction), pas une
 * contrainte DB (chevauchement `both`/`quote`/`invoice` impossible à exprimer
 * proprement en index partiel).
 */
export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  type: text("type").$type<TemplateType>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  options: jsonb("options").$type<TemplateOptions>().notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
