import { z } from "zod";

export const clientContactSchema = z.object({
  /** Présent pour un contact existant (édition) ; absent pour une création. */
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Le nom du contact est requis."),
  email: z
    .string()
    .trim()
    .email("Email invalide.")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional(),
  role: z.string().trim().optional(),
  isDefaultRecipient: z.boolean().optional().default(false),
});
export type ClientContactInput = z.input<typeof clientContactSchema>;
/** Forme validée (post-parse : defaults appliqués). */
export type ClientContactData = z.output<typeof clientContactSchema>;

const FR_ZIP_REGEX = /^\d{5}$/;

export const clientSchema = z
  .object({
    type: z.enum(["company", "individual"]),
    displayName: z.string().trim().min(1, "Le nom est requis."),
    legalName: z.string().trim().optional(),
    siret: z.string().trim().optional(),
    vatNumber: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email("Email invalide.")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().optional(),
    addressStreet: z.string().trim().optional(),
    addressZip: z.string().trim().optional(),
    addressCity: z.string().trim().optional(),
    addressCountry: z.string().trim().min(1, "Le pays est requis.").default("France"),
    notes: z.string().trim().optional(),
    paymentTermsDays: z.number().int().positive().optional(),
    contacts: z.array(clientContactSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.addressCountry === "France" &&
      data.addressZip &&
      !FR_ZIP_REGEX.test(data.addressZip)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addressZip"],
        message: "Code postal français invalide (5 chiffres).",
      });
    }
  });
export type ClientInput = z.input<typeof clientSchema>;
/** Forme validée (post-parse : defaults appliqués). */
export type ClientData = z.output<typeof clientSchema>;
