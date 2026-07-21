import { z } from "zod";

export const discountSchema = z.object({
  type: z.enum(["percent", "amount"]),
  value: z.number().min(0),
});
export type DiscountInput = z.infer<typeof discountSchema>;

function checkDiscountRefine(
  data: { discount?: { type: "percent" | "amount"; value: number } | null },
  ctx: z.RefinementCtx,
) {
  if (data.discount?.type === "percent" && data.discount.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discount", "value"],
      message: "La remise ne peut pas dépasser 100 %.",
    });
  }
}

const documentLineBaseSchema = z.object({
  /** Présent pour une ligne existante (édition) ; absent pour une création. */
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1, "La description est requise."),
  quantity: z.number().positive("La quantité doit être positive."),
  unitPriceCents: z
    .number()
    .int("Le prix unitaire doit être un nombre entier de centimes.")
    .min(0, "Le prix unitaire ne peut pas être négatif."),
  vatRate: z.number().min(0).max(100, "Taux de TVA invalide."),
  discount: discountSchema.nullable().optional(),
});

export const documentLineSchema = documentLineBaseSchema.superRefine(checkDiscountRefine);
export type DocumentLineInput = z.input<typeof documentLineSchema>;
export type DocumentLineData = z.output<typeof documentLineSchema>;

/**
 * Ligne d'avoir (story 18) : seule différence avec `documentLineSchema`, la
 * quantité est négative (jamais nulle) — un avoir crédite, il ne facture
 * jamais. Le reste (prix unitaire, TVA, remise) suit les mêmes règles.
 */
export const creditNoteLineSchema = documentLineBaseSchema
  .extend({
    quantity: z.number().negative("La quantité d'une ligne d'avoir doit être négative."),
  })
  .superRefine(checkDiscountRefine);
export type CreditNoteLineInput = z.input<typeof creditNoteLineSchema>;
export type CreditNoteLineData = z.output<typeof creditNoteLineSchema>;

export const documentDraftSchema = z.object({
  clientId: z.string().uuid("Le client est requis."),
  templateId: z.string().uuid().nullable().optional(),
  issueDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  globalDiscount: discountSchema.nullable().optional(),
  lines: z
    .array(documentLineSchema)
    .min(1, "Au moins une ligne est requise."),
});
export type DocumentDraftInput = z.input<typeof documentDraftSchema>;
export type DocumentDraftData = z.output<typeof documentDraftSchema>;

/** Brouillon d'avoir (story 18) : mêmes champs, lignes à quantité négative. */
export const creditNoteDraftSchema = documentDraftSchema.extend({
  lines: z.array(creditNoteLineSchema).min(1, "Au moins une ligne est requise."),
});
export type CreditNoteDraftInput = z.input<typeof creditNoteDraftSchema>;
export type CreditNoteDraftData = z.output<typeof creditNoteDraftSchema>;
