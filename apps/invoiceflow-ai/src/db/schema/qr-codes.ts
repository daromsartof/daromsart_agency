import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { QrContentType } from "@daromsart/qr";
import { organizations } from "./organization";

/** État formulaire du générateur QR (régénérable). */
export type QrFormValuesJson = {
  url: string;
  text: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiEncryption: "WPA" | "WEP" | "nopass";
  wifiHidden: boolean;
  vcardFirstName: string;
  vcardLastName: string;
  vcardOrganization: string;
  vcardPhone: string;
  vcardEmail: string;
  vcardUrl: string;
  socialPlatform: "linkedin" | "instagram" | "x" | "youtube" | "tiktok";
  socialHandle: string;
  facebook: string;
  appIosUrl: string;
  appAndroidUrl: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  businessAddress: string;
};

export type QrDesignJson = {
  dotsColor: string;
  backgroundColor: string;
  margin: number;
  /** Data URL du logo (petit) — null si absent. */
  logoDataUrl: string | null;
};

/**
 * QR codes sauvegardés par organisation — payload régénéré à la lecture
 * (même approche que `document_templates.options`).
 */
export const qrCodes = pgTable("qr_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  contentType: text("content_type").$type<QrContentType>().notNull(),
  formValues: jsonb("form_values").$type<QrFormValuesJson>().notNull(),
  design: jsonb("design").$type<QrDesignJson>().notNull(),
  /** Payload scannable dénormalisé (liste / recherche). */
  payload: text("payload").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
