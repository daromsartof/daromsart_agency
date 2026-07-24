import { isValidBic, isValidIban, normalizeIban, validateNumberFormat } from "@daromsart/core";
import { z } from "zod";

export const identitySchema = z.object({
  legalName: z.string().trim().min(1, "Le nom légal est requis."),
  tradeName: z.string().trim().optional(),
  siret: z.string().trim().optional(),
  vatNumber: z.string().trim().optional(),
  legalForm: z.string().trim().optional(),
  capital: z.string().trim().optional(),
  email: z.string().trim().email("Email invalide.").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
});
export type IdentityInput = z.infer<typeof identitySchema>;

export const addressSchema = z.object({
  addressStreet: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressCountry: z.string().trim().min(1, "Le pays est requis."),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const bankSchema = z.object({
  iban: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidIban(v), "IBAN invalide (contrôle échoué)."),
  bic: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidBic(v), "BIC invalide."),
});
export type BankInput = z.infer<typeof bankSchema>;

/** Normalise l'IBAN (majuscules, sans espaces) avant écriture en base. */
export function normalizeBankInput(input: BankInput): BankInput {
  return {
    iban: input.iban ? normalizeIban(input.iban) : input.iban,
    bic: input.bic ? input.bic.trim().toUpperCase() : input.bic,
  };
}

export const legalFooterSchema = z.object({
  legalFooter: z.string().trim().optional(),
});
export type LegalFooterInput = z.infer<typeof legalFooterSchema>;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];

/** Les 4 taux de TVA officiels français (H5) — univers fixe des cases à cocher. */
export const STANDARD_VAT_RATES = [0, 5.5, 10, 20] as const;

const numberFormatField = z.string().superRefine((value, ctx) => {
  const result = validateNumberFormat(value);
  if (!result.valid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
  }
});

export const numberFormatsSchema = z.object({
  quote: numberFormatField,
  invoice: numberFormatField,
  creditNote: numberFormatField,
});
export type NumberFormatsInput = z.infer<typeof numberFormatsSchema>;

export const vatSettingsSchema = z
  .object({
    activeRates: z
      .array(z.number().refine((r) => (STANDARD_VAT_RATES as readonly number[]).includes(r)))
      .min(1, "Au moins un taux de TVA doit être actif."),
    defaultRate: z.number(),
    franchiseEnabled: z.boolean(),
  })
  .refine((data) => data.activeRates.includes(data.defaultRate), {
    message: "Le taux par défaut doit faire partie des taux actifs.",
    path: ["defaultRate"],
  });
export type VatSettingsInput = z.infer<typeof vatSettingsSchema>;

export const delaysSchema = z.object({
  paymentTermsDays: z.number().int().positive("Le délai de paiement doit être positif."),
  quoteValidityDays: z.number().int().positive("La durée de validité doit être positive."),
});
export type DelaysInput = z.infer<typeof delaysSchema>;

const emailTemplateSchema = z.object({
  subject: z.string().trim().min(1, "L'objet est requis."),
  body: z.string().trim().min(1, "Le corps est requis."),
});

export const emailDefaultsSchema = z.object({
  replyTo: z.string().trim().email("Email invalide.").optional().or(z.literal("")),
  quote: emailTemplateSchema,
  invoice: emailTemplateSchema,
  reminder: emailTemplateSchema,
});
export type EmailDefaultsInput = z.infer<typeof emailDefaultsSchema>;
