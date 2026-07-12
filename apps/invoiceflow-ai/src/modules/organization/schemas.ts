import { isValidBic, isValidIban, normalizeIban } from "@daromsart/core";
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
