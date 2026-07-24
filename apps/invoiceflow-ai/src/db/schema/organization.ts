import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export interface NumberFormats {
  invoice: string;
  quote: string;
  creditNote: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailDefaults {
  quote: EmailTemplate;
  invoice: EmailTemplate;
  reminder: EmailTemplate;
}

/** Mentions légales par défaut (H21), configurables dans Paramètres. */
export const DEFAULT_LEGAL_FOOTER =
  "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal est exigible, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé. TVA non applicable, art. 293 B du CGI, le cas échéant.";

/** Mention composée (jamais écrasée dans `legalFooter`) quand la franchise
 * en base (art. 293 B) est activée depuis les paramètres (story 22). */
export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI.";

/**
 * Textes d'email par défaut (H12), configurables dans Paramètres (story 22).
 * Variables résolues à l'envoi par `renderEmailVariables` (@daromsart/core) :
 * `{client}/{numero}/{total}/{lien}/{echeance}`, `{jours_retard}` (relance
 * uniquement, story 16).
 */
export const DEFAULT_EMAIL_DEFAULTS: EmailDefaults = {
  quote: {
    subject: "Votre devis {numero}",
    body: "Bonjour {client},\n\nVeuillez trouver ci-joint notre devis {numero} d'un montant de {total}.\n\nVous pouvez le consulter et le signer en ligne : {lien}\n\nCe devis est valable jusqu'au {echeance}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement.",
  },
  invoice: {
    subject: "Votre facture {numero}",
    body: "Bonjour {client},\n\nVeuillez trouver ci-joint notre facture {numero} d'un montant de {total}, à régler avant le {echeance}.\n\nVous pouvez la consulter en ligne : {lien}\n\nCordialement.",
  },
  reminder: {
    subject: "Rappel — facture {numero} en attente de règlement",
    body: "Bonjour {client},\n\nSauf erreur de notre part, notre facture {numero} d'un montant de {total}, échue le {echeance} (en retard de {jours_retard} jours), demeure impayée à ce jour.\n\nVous pouvez la consulter et procéder au règlement ici : {lien}\n\nMerci de bien vouloir régulariser dans les meilleurs délais.\n\nCordialement.",
  },
};

/** L'entreprise émettrice (unique en pratique — multi-tenant prêt, H4). */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),

  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name"),

  addressStreet: text("address_street"),
  addressZip: text("address_zip"),
  addressCity: text("address_city"),
  addressCountry: text("address_country").notNull().default("France"),

  email: text("email"),
  phone: text("phone"),

  siret: text("siret"),
  vatNumber: text("vat_number"),
  legalForm: text("legal_form"),
  capital: text("capital"),

  iban: text("iban"),
  bic: text("bic"),

  logoKey: text("logo_key"),

  currency: text("currency").notNull().default("EUR"),
  vatRatesActive: jsonb("vat_rates_active")
    .$type<number[]>()
    .notNull()
    .default([0, 5.5, 10, 20]),
  vatRateDefault: numeric("vat_rate_default", { precision: 5, scale: 2 })
    .notNull()
    .default("20"),
  /** Franchise en base de TVA (art. 293 B) — force le taux par défaut à 0 %
   * et compose la mention légale (story 22), sans écraser le texte custom. */
  franchiseEnabled: boolean("franchise_enabled").notNull().default(false),

  // H21 : mentions légales par défaut (pénalités de retard, indemnité de
  // recouvrement, escompte, TVA art. 293 B) — configurables dans Paramètres.
  legalFooter: text("legal_footer").notNull().default(DEFAULT_LEGAL_FOOTER),

  paymentTermsDays: integer("payment_terms_days").notNull().default(30),
  quoteValidityDays: integer("quote_validity_days").notNull().default(30),

  numberFormats: jsonb("number_formats").$type<NumberFormats>().notNull()
    .default({
      invoice: "FAC-{YYYY}-{seq:4}",
      quote: "DEV-{YYYY}-{seq:4}",
      creditNote: "AV-{YYYY}-{seq:4}",
    }),

  emailReplyTo: text("email_reply_to"),
  emailDefaults: jsonb("email_defaults")
    .$type<EmailDefaults>()
    .notNull()
    .default(DEFAULT_EMAIL_DEFAULTS),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Lien User ↔ Organization + rôle applicatif. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role")
      .$type<"admin" | "member">()
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userOrgUnique: uniqueIndex("memberships_user_org_unique").on(
      t.userId,
      t.organizationId,
    ),
  }),
);

/** Invitations d'équipe (flux complet en story 21 — structure ici). */
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").$type<"admin" | "member">().notNull().default("member"),
  tokenHash: text("token_hash").notNull(),
  invitedBy: text("invited_by").references(() => user.id, {
    onDelete: "set null",
  }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
