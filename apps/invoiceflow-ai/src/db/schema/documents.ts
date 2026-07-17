import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organization";

/**
 * Journal d'événements générique, partagé par devis/factures/avoirs (H6, H14,
 * H15). `documentId` n'a pas de clé étrangère (polymorphe selon `documentType`)
 * — l'intégrité référentielle est garantie côté application (le document est
 * toujours créé avant son premier événement). Utilisé dès la story 07 pour
 * `created`/`updated` sur les devis ; les statuts et l'émission arrivent aux
 * stories suivantes.
 */
export const documentEvents = pgTable("document_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  documentType: text("document_type")
    .$type<"quote" | "invoice" | "credit_note">()
    .notNull(),
  documentId: uuid("document_id").notNull(),
  eventType: text("event_type").notNull(),
  /** Métadonnées libres selon l'événement (ex. ancien/nouveau statut). */
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  /** Nul pour un événement déclenché côté public (ex. consultation par le client). */
  actorUserId: text("actor_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Compteurs de numérotation séquentielle sans trou, par organisation, type de
 * document et année civile (H6). Structure créée en story 07 ; utilisée à
 * partir de la story 08 (l'attribution du numéro se fait à l'émission, jamais
 * au brouillon, via verrou transactionnel `SELECT ... FOR UPDATE`).
 */
export const numberSequences = pgTable(
  "number_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentType: text("document_type")
      .$type<"quote" | "invoice" | "credit_note">()
      .notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    perOrgTypeYear: uniqueIndex("number_sequences_org_type_year_unique").on(
      t.organizationId,
      t.documentType,
      t.year,
    ),
  }),
);
