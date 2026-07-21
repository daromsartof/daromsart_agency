import { z } from "zod";

export const discountSchema = z.object({
  type: z.enum(["percent", "amount"]),
  value: z.number().min(0),
});
export type DiscountInput = z.infer<typeof discountSchema>;

export const documentLineSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (data.discount?.type === "percent" && data.discount.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount", "value"],
        message: "La remise ne peut pas dépasser 100 %.",
      });
    }
  });
export type DocumentLineInput = z.input<typeof documentLineSchema>;
export type DocumentLineData = z.output<typeof documentLineSchema>;

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
