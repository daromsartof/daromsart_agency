"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import type { ClientInput } from "@daromsart/core";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@daromsart/ui";

/**
 * Schéma de saisie propre au formulaire : le contact utilise `contactId`
 * (et non `id`) car `useFieldArray` génère lui-même une clé `id` qui
 * écraserait un champ du même nom dans les données (piège documenté RHF).
 * La conversion vers `ClientInput` (contacts[].id) se fait à la soumission.
 */
const contactFormSchema = z.object({
  contactId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Le nom du contact est requis."),
  email: z.string().trim().email("Email invalide.").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  role: z.string().trim().optional().or(z.literal("")),
});

const FR_ZIP_REGEX = /^\d{5}$/;

const clientFormSchema = z
  .object({
    type: z.enum(["company", "individual"]),
    displayName: z.string().trim().min(1, "Le nom est requis."),
    legalName: z.string().trim().optional().or(z.literal("")),
    siret: z.string().trim().optional().or(z.literal("")),
    vatNumber: z.string().trim().optional().or(z.literal("")),
    email: z.string().trim().email("Email invalide.").optional().or(z.literal("")),
    phone: z.string().trim().optional().or(z.literal("")),
    addressStreet: z.string().trim().optional().or(z.literal("")),
    addressZip: z.string().trim().optional().or(z.literal("")),
    addressCity: z.string().trim().optional().or(z.literal("")),
    addressCountry: z.string().trim().min(1, "Le pays est requis."),
    notes: z.string().trim().optional().or(z.literal("")),
    paymentTermsDays: z.string().trim().optional().or(z.literal("")),
    contacts: z.array(contactFormSchema),
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

export type ClientFormValues = z.infer<typeof clientFormSchema>;

const EMPTY_VALUES: ClientFormValues = {
  type: "company",
  displayName: "",
  legalName: "",
  siret: "",
  vatNumber: "",
  email: "",
  phone: "",
  addressStreet: "",
  addressZip: "",
  addressCity: "",
  addressCountry: "France",
  notes: "",
  paymentTermsDays: "",
  contacts: [],
};

export interface ClientFormSubmitResult {
  ok: boolean;
  errors?: Record<string, string>;
}

export interface ClientFormProps {
  defaultValues?: ClientFormValues;
  onSubmit: (input: ClientInput) => Promise<ClientFormSubmitResult>;
  onSuccess?: () => void;
  submitLabel?: string;
}

function toClientInput(values: ClientFormValues): ClientInput {
  return {
    type: values.type,
    displayName: values.displayName,
    legalName: values.legalName || undefined,
    siret: values.siret || undefined,
    vatNumber: values.vatNumber || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    addressStreet: values.addressStreet || undefined,
    addressZip: values.addressZip || undefined,
    addressCity: values.addressCity || undefined,
    addressCountry: values.addressCountry,
    notes: values.notes || undefined,
    paymentTermsDays: values.paymentTermsDays
      ? Number.parseInt(values.paymentTermsDays, 10)
      : undefined,
    contacts: values.contacts.map((c) => ({
      id: c.contactId,
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      role: c.role || undefined,
    })),
  };
}

export function ClientForm({
  defaultValues,
  onSubmit,
  onSuccess,
  submitLabel = "Enregistrer",
}: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultValues ?? EMPTY_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  async function handleSubmit(values: ClientFormValues) {
    const result = await onSubmit(toClientInput(values));
    if (!result.ok) {
      for (const [path, message] of Object.entries(result.errors ?? {})) {
        const field = path.replace(/^_root$/, "root") as keyof ClientFormValues;
        form.setError(field, { message });
      }
      return;
    }
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(handleSubmit)}
        id="client-form"
      >
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Identité</h3>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="company">Société</SelectItem>
                    <SelectItem value="individual">Particulier</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom légal</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="siret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SIRET</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Adresse</h3>
          <FormField
            control={form.control}
            name="addressStreet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rue</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="addressZip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code postal</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="addressCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Contacts additionnels
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ name: "", email: "", phone: "", role: "" })
              }
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun contact additionnel.</p>
          ) : null}
          {fields.map((fieldItem, index) => (
            <div key={fieldItem.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <FormField
                  control={form.control}
                  name={`contacts.${index}.name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Nom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer le contact"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name={`contacts.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Email" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`contacts.${index}.role`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Rôle" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Conditions</h3>
          <FormField
            control={form.control}
            name="paymentTermsDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai de paiement (jours, optionnel)</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="Défaut de l'organisation" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes internes</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.formState.errors.root ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Enregistrement…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

export { EMPTY_VALUES as CLIENT_FORM_EMPTY_VALUES };
