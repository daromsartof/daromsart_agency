import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

/**
 * Outil générique de signature de PDF (story 25) : un membre de l'org
 * uploade un PDF quelconque (pas forcément un devis/facture généré par
 * l'app) et y appose sa signature manuscrite. Indépendant des devis/
 * factures — pas de lien public, usage interne uniquement.
 */
export const signableDocuments = pgTable("signable_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  /** Nom de fichier d'origine, affiché dans la liste. */
  title: text("title").notNull(),
  originalKey: text("original_key").notNull(),
  pageCount: integer("page_count").notNull(),

  /** Posés ensemble à la signature — jamais l'un sans l'autre. */
  signedKey: text("signed_key"),
  signerName: text("signer_name"),
  signedAt: timestamp("signed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});
