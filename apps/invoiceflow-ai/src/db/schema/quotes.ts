import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { QuoteStatus } from "@daromsart/core";
import { clients } from "./clients";
import { organizations } from "./organization";

/**
 * Devis. Les totaux (`subtotalCents`/`discountCents`/`vatByRate`/`totalCents`)
 * sont TOUJOURS recalculés et persistés côté serveur via
 * `modules/documents/recalculate.ts` — jamais acceptés tels quels depuis le
 * client (parade « Recalcul client ≠ serveur », plans/story-07.md).
 * `number` reste nul tant que le devis est un brouillon : l'attribution se
 * fait à l'émission (H6, story 08+).
 */
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),

  status: text("status").$type<QuoteStatus>().notNull().default("draft"),
  number: text("number"),

  issueDate: timestamp("issue_date"),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),

  globalDiscountType: text("global_discount_type").$type<"percent" | "amount">(),
  /** Pourcentage (ex. 12.50) si `globalDiscountType = "percent"`, sinon centimes. */
  globalDiscountValue: numeric("global_discount_value", {
    precision: 12,
    scale: 2,
  }),

  subtotalCents: integer("subtotal_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  vatByRate: jsonb("vat_by_rate").$type<Record<string, number>>().notNull().default({}),
  totalCents: integer("total_cents").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Lignes de devis. `position` = ordre d'affichage, persisté explicitement
 * (réordonnancement via `move()` de `useFieldArray`, pas de tri implicite). */
export const quoteLines = pgTable("quote_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),

  description: text("description").notNull(),
  /** Jusqu'à 3 décimales (ex. 0,333) — voir `mulQty` (@daromsart/core). */
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull(),

  discountType: text("discount_type").$type<"percent" | "amount">(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }),

  position: integer("position").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
