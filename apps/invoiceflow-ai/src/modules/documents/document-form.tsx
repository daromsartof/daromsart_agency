"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Button,
  DatePicker,
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
  Textarea,
} from "@daromsart/ui";
import type { DocumentDraftInput } from "@daromsart/core";
import { ClientPicker } from "./client-picker";
import { LineEditor } from "./line-editor/line-editor";
import { TotalsPanel } from "./totals-panel";
import {
  documentFormSchema,
  documentFormToDraftInput,
  type DocumentFormValues,
} from "./document-form-schema";

// Radix Select interdit `<SelectItem value="">` (réservée au clear interne) :
// sentinels dédiés, traduits en "" au niveau du champ RHF.
const NO_DISCOUNT_VALUE = "none";
const NO_TEMPLATE_VALUE = "default";

export type DocumentFormSubmitResult =
  | { ok: true; id?: string }
  | { ok: false; errors?: Record<string, string> };

export interface DocumentTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface DocumentFormProps {
  defaultValues: DocumentFormValues;
  vatRateOptions: number[];
  templateOptions?: DocumentTemplateOption[];
  /** "Valide jusqu'au" (devis) ou "Date d'échéance" (facture) — même champ, sens différent. */
  secondDateLabel?: string;
  onSubmit: (input: DocumentDraftInput) => Promise<DocumentFormSubmitResult>;
  onSuccess?: (id?: string) => void;
  submitLabel?: string;
}

/**
 * Formulaire partagé de document (devis, factures — story 12). V1 : pas
 * d'autosave (parade story-07) — bouton « Enregistrer » explicite + garde
 * `beforeunload` si le formulaire est modifié (dirty).
 */
export function DocumentForm({
  defaultValues,
  vatRateOptions,
  templateOptions = [],
  secondDateLabel = "Valide jusqu'au",
  onSubmit,
  onSuccess,
  submitLabel = "Enregistrer",
}: DocumentFormProps) {
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues,
  });
  const { isDirty, isSubmitting, isSubmitSuccessful } = form.formState;

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty && !isSubmitSuccessful) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitSuccessful]);

  async function handleSubmit(values: DocumentFormValues) {
    const result = await onSubmit(documentFormToDraftInput(values));
    if (!result.ok) {
      for (const [path, message] of Object.entries(result.errors ?? {})) {
        const field = path.replace(/^_root$/, "root") as keyof DocumentFormValues;
        form.setError(field, { message });
      }
      return;
    }
    onSuccess?.(result.id);
  }

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Client</FormLabel>
                <FormControl>
                  <ClientPicker
                    value={field.value || null}
                    initialLabel={form.getValues("clientLabel")}
                    onChange={(clientId, label) => {
                      field.onChange(clientId);
                      form.setValue("clientLabel", label);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="issueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date d'émission</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{secondDateLabel}</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modèle</FormLabel>
                <Select
                  value={field.value || NO_TEMPLATE_VALUE}
                  onValueChange={(value) =>
                    field.onChange(value === NO_TEMPLATE_VALUE ? "" : value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Modèle par défaut de l'organisation" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* Radix interdit une SelectItem `value=""` (réservé au clear) : sentinel dédié. */}
                    <SelectItem value={NO_TEMPLATE_VALUE}>Modèle par défaut</SelectItem>
                    {templateOptions.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault ? " (défaut)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Lignes</h3>
          <LineEditor control={form.control} vatRateOptions={vatRateOptions} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="globalDiscountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remise globale</FormLabel>
                  <Select
                    value={field.value || NO_DISCOUNT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === NO_DISCOUNT_VALUE ? "" : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DISCOUNT_VALUE}>Aucune remise</SelectItem>
                      <SelectItem value="percent">Pourcentage</SelectItem>
                      <SelectItem value="amount">Montant fixe</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="globalDiscountValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>&nbsp;</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="Valeur" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <TotalsPanel control={form.control} />
        </div>

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

        {form.formState.errors.root ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          {isDirty ? (
            <span className="text-sm text-muted-foreground">
              Modifications non enregistrées
            </span>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
