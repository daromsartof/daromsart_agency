import {
  type AnyPgColumn,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { InvoiceStatus } from "@daromsart/core";
import { clients } from "./clients";
import { organizations } from "./organization";
import { documentTemplates } from "./templates";
import { quotes } from "./quotes";

export interface InvoiceOrgSnapshot {
  legalName: string;
  tradeName: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  vatNumber: string | null;
  legalForm: string | null;
  capital: string | null;
  iban: string | null;
  bic: string | null;
  logoKey: string | null;
}

export interface InvoiceClientSnapshot {
  displayName: string;
  legalName: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
  siret: string | null;
  vatNumber: string | null;
  email: string | null;
}

/**
 * Facture (et avoir, `kind = "credit_note"`, story 18). Immuable après
 * émission (H7) : `organizationSnapshot`/`clientSnapshot` figent l'émetteur
 * et le client au moment de l'émission — modifier le client ou l'org APRÈS
 * ne change jamais un PDF déjà émis (test dédié en intégration).
 * `parentInvoiceId` : facture d'origine d'un avoir (story 18, self-ref).
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => documentTemplates.id, {
      onDelete: "set null",
    }),
    /** Devis d'origine si issue d'une conversion (story 17). */
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    kind: text("kind").$type<"invoice" | "credit_note">().notNull().default("invoice"),
    parentInvoiceId: uuid("parent_invoice_id").references((): AnyPgColumn => invoices.id, {
      onDelete: "set null",
    }),

    status: text("status").$type<InvoiceStatus>().notNull().default("draft"),
    number: text("number"),
    shareToken: text("share_token"),

    issueDate: timestamp("issue_date"),
    dueDate: timestamp("due_date"),
    notes: text("notes"),

    sentAt: timestamp("sent_at"),
    viewedAt: timestamp("viewed_at"),
    paidAt: timestamp("paid_at"),
    cancelledAt: timestamp("cancelled_at"),
    lastReminderAt: timestamp("last_reminder_at"),

    globalDiscountType: text("global_discount_type").$type<"percent" | "amount">(),
    globalDiscountValue: numeric("global_discount_value", { precision: 12, scale: 2 }),

    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    vatByRate: jsonb("vat_by_rate").$type<Record<string, number>>().notNull().default({}),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),

    organizationSnapshot: jsonb("organization_snapshot").$type<InvoiceOrgSnapshot>(),
    clientSnapshot: jsonb("client_snapshot").$type<InvoiceClientSnapshot>(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    shareTokenUnique: uniqueIndex("invoices_share_token_unique").on(t.shareToken),
  }),
);

/** Lignes de facture — même forme que `quote_lines`. */
export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),

  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull(),

  discountType: text("discount_type").$type<"percent" | "amount">(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }),

  position: integer("position").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Structure créée ici (story 12), utilisée à partir de la story 15. */
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),

  paidAt: timestamp("paid_at").notNull().defaultNow(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").$type<"transfer" | "card" | "cash" | "check" | "other">().notNull(),
  reference: text("reference"),
  note: text("note"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});
