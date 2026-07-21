import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { quotes } from "./quotes";

/**
 * Signature électronique simple (H9 — pas eIDAS avancée). Une seule par
 * devis (`quoteId` unique) : la re-signature est refusée applicativement
 * (transition de statut impossible depuis `signed`) et par la contrainte
 * unique en filet de sécurité (course concurrente).
 */
export const signatures = pgTable(
  "signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),

    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email"),
    /** Data URL PNG du tracé, uploadée telle quelle (clé storage). */
    imageKey: text("image_key").notNull(),

    ip: text("ip"),
    userAgent: text("user_agent"),

    signedAt: timestamp("signed_at").notNull().defaultNow(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    quoteUnique: uniqueIndex("signatures_quote_id_unique").on(t.quoteId),
  }),
);
