import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export type EmailLogStatus = "queued" | "sent" | "delivered" | "opened" | "bounced" | "failed";
export type EmailLogKind = "document" | "reminder";

/**
 * Journal des emails envoyés (H12) : un envoi = une ligne. `status` évolue
 * `queued → sent|failed` à l'envoi (story 10), puis `delivered|opened|bounced`
 * via le webhook Resend (story 20 — colonnes prêtes dès maintenant).
 */
export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  documentType: text("document_type").$type<"quote" | "invoice">().notNull(),
  documentId: uuid("document_id").notNull(),
  kind: text("kind").$type<EmailLogKind>().notNull().default("document"),

  to: jsonb("to").$type<string[]>().notNull(),
  cc: jsonb("cc").$type<string[]>(),
  subject: text("subject").notNull(),

  status: text("status").$type<EmailLogStatus>().notNull().default("queued"),
  resendId: text("resend_id"),
  errorMessage: text("error_message"),

  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  bouncedAt: timestamp("bounced_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
