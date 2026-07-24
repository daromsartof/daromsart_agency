import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { quotes } from "./quotes";
import { invoices } from "./invoices";

/**
 * Signature électronique simple (H9 — pas eIDAS avancée), partagée entre
 * devis et factures (story 24) : exactement une des deux clés (`quoteId` ou
 * `invoiceId`) est renseignée, jamais les deux ni aucune (contrainte CHECK
 * `exactlyOneParent` ci-dessous). Une seule signature par devis/facture :
 * refusée applicativement (devis : transition de statut impossible depuis
 * `signed` ; facture : `signedAt` déjà posé) et par les index uniques en
 * filet de sécurité (course concurrente) — plusieurs lignes avec `quoteId`
 * NULL (signatures de facture) ou `invoiceId` NULL (signatures de devis)
 * restent autorisées par un index unique Postgres classique (NULL ≠ NULL).
 */
export const signatures = pgTable(
  "signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),

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
    invoiceUnique: uniqueIndex("signatures_invoice_id_unique").on(t.invoiceId),
    exactlyOneParent: check(
      "signatures_exactly_one_parent",
      sql`((${t.quoteId} IS NOT NULL)::int + (${t.invoiceId} IS NOT NULL)::int) = 1`,
    ),
  }),
);
