import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";

/** Le client facturé. Soft-delete uniquement (archivage) : jamais de suppression. */
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  type: text("type").$type<"company" | "individual">().notNull(),
  displayName: text("display_name").notNull(),
  legalName: text("legal_name"),
  siret: text("siret"),
  vatNumber: text("vat_number"),

  email: text("email"),
  phone: text("phone"),

  addressStreet: text("address_street"),
  addressZip: text("address_zip"),
  addressCity: text("address_city"),
  addressCountry: text("address_country").notNull().default("France"),

  notes: text("notes"),
  /** Conditions de paiement spécifiques (jours) ; nul → défaut de l'organisation. */
  paymentTermsDays: integer("payment_terms_days"),

  archivedAt: timestamp("archived_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Contacts additionnels d'un client (destinataires possibles des envois). */
export const clientContacts = pgTable("client_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  isDefaultRecipient: boolean("is_default_recipient").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
