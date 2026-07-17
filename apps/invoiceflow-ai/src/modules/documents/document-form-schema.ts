import { z } from "zod";
import type { DocumentDraftInput, Discount, TotalsLineInput } from "@daromsart/core";

/**
 * Schéma de saisie RHF (formulaire) : les nombres transitent en `string`
 * (contrôlés par des `Input`) et sont convertis vers `DocumentDraftInput`
 * (types stricts, validés par `@daromsart/core`) à la soumission — même
 * approche que `client-form.tsx` (story 05/06).
 */
export const documentLineFormSchema = z.object({
  /** Présent pour une ligne existante (édition). */
  lineId: z.string().uuid().optional(),
  description: z.string().trim().min(1, "La description est requise."),
  quantity: z.string().trim().min(1, "La quantité est requise."),
  unitPriceCents: z.number({ invalid_type_error: "Le prix est requis." }).min(0),
  vatRate: z.string().min(1, "Le taux de TVA est requis."),
  discountType: z.enum(["", "percent", "amount"]),
  discountValue: z.string().trim(),
});
export type DocumentLineFormValues = z.infer<typeof documentLineFormSchema>;

export const documentFormSchema = z.object({
  clientId: z.string().uuid("Le client est requis."),
  clientLabel: z.string().optional(),
  issueDate: z.date().optional(),
  validUntil: z.date().optional(),
  notes: z.string().trim().optional(),
  globalDiscountType: z.enum(["", "percent", "amount"]),
  globalDiscountValue: z.string().trim(),
  lines: z.array(documentLineFormSchema).min(1, "Au moins une ligne est requise."),
});
export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export const EMPTY_LINE: DocumentLineFormValues = {
  description: "",
  quantity: "1",
  unitPriceCents: 0,
  vatRate: "20",
  discountType: "",
  discountValue: "",
};

export function emptyDocumentFormValues(
  defaultVatRate: number,
  validityDays: number,
): DocumentFormValues {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validityDays);
  return {
    clientId: "",
    clientLabel: "",
    issueDate: new Date(),
    validUntil,
    notes: "",
    globalDiscountType: "",
    globalDiscountValue: "",
    lines: [{ ...EMPTY_LINE, vatRate: String(defaultVatRate) }],
  };
}

export function parseLocaleNumber(value: string): number {
  return Number.parseFloat(value.replace(",", "."));
}

/** Conversion partagée avec le panneau de totaux (prévisualisation client). */
export function toTotalsInput(values: DocumentFormValues): {
  lines: TotalsLineInput[];
  globalDiscount: Discount | null;
} {
  return {
    lines: values.lines.map((line) => ({
      quantity: parseLocaleNumber(line.quantity) || 0,
      unitPriceCents: line.unitPriceCents || 0,
      vatRate: parseLocaleNumber(line.vatRate) || 0,
      discount: line.discountType
        ? {
            type: line.discountType,
            value: parseLocaleNumber(line.discountValue || "0") || 0,
          }
        : null,
    })),
    globalDiscount: values.globalDiscountType
      ? {
          type: values.globalDiscountType,
          value: parseLocaleNumber(values.globalDiscountValue || "0") || 0,
        }
      : null,
  };
}

export function documentFormToDraftInput(
  values: DocumentFormValues,
): DocumentDraftInput {
  return {
    clientId: values.clientId,
    issueDate: values.issueDate,
    validUntil: values.validUntil,
    notes: values.notes || undefined,
    globalDiscount: values.globalDiscountType
      ? {
          type: values.globalDiscountType,
          value: parseLocaleNumber(values.globalDiscountValue || "0"),
        }
      : null,
    lines: values.lines.map((line) => ({
      id: line.lineId,
      description: line.description,
      quantity: parseLocaleNumber(line.quantity),
      unitPriceCents: line.unitPriceCents,
      vatRate: parseLocaleNumber(line.vatRate),
      discount: line.discountType
        ? {
            type: line.discountType,
            value: parseLocaleNumber(line.discountValue || "0"),
          }
        : null,
    })),
  };
}
