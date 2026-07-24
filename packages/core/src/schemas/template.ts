import { z } from "zod";

/**
 * Options de rendu d'un modèle de document (story 09). Parsé avec ses
 * defaults à CHAQUE lecture (jamais un cast direct du JSON stocké) : un futur
 * champ ajouté au schéma doit rester tolérant à un JSON existant qui ne le
 * contient pas encore (parade « options non versionnées »).
 */
export const templateColumnsSchema = z.object({
  unit: z.boolean().default(true),
  vatPerLine: z.boolean().default(true),
  discountPerLine: z.boolean().default(true),
});

export const templateOptionsSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).")
    .default("#185FA5"),
  showLogo: z.boolean().default(true),
  logoPosition: z.enum(["left", "right"]).default("left"),
  font: z.enum(["sans", "serif"]).default("sans"),
  columns: templateColumnsSchema.default({}),
  headerNote: z.string().trim().default(""),
  footerNote: z.string().trim().default(""),
  paymentTermsText: z.string().trim().default(""),
  showPaymentQr: z.boolean().default(false),
  showPublicLinkQr: z.boolean().default(false),
});

export type TemplateOptionsInput = z.input<typeof templateOptionsSchema>;
export type TemplateOptions = z.output<typeof templateOptionsSchema>;

/** Défauts explicites (utilisés hors contexte zod, ex. valeur initiale d'un formulaire). */
export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = templateOptionsSchema.parse({});

export const TEMPLATE_TYPES = ["quote", "invoice", "both"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** `true` si un modèle de type `templateType` s'applique au document `kind`. */
export function templateAppliesToKind(
  templateType: TemplateType,
  kind: "quote" | "invoice",
): boolean {
  return templateType === "both" || templateType === kind;
}

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  type: z.enum(TEMPLATE_TYPES),
  options: templateOptionsSchema,
});
export type TemplateInput = z.input<typeof templateSchema>;
export type TemplateData = z.output<typeof templateSchema>;
