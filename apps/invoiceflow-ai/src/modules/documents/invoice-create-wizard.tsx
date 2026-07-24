"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
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
  Stepper,
  Textarea,
  formatCentsEUR,
} from "@daromsart/ui";
import {
  computeDocumentTotals,
  type DocumentDraftInput,
  type TemplateOptions,
} from "@daromsart/core";
import { ClientPicker } from "./client-picker";
import { LineEditor } from "./line-editor/line-editor";
import { TotalsPanel } from "./totals-panel";
import { TemplatePickerSlider } from "./template-picker-slider";
import {
  documentFormSchema,
  documentFormToDraftInput,
  toTotalsInput,
  type DocumentFormValues,
} from "./document-form-schema";
import type { DocumentFormSubmitResult } from "./document-form";

const NO_DISCOUNT_VALUE = "none";
const NO_TEMPLATE_VALUE = "default";

const STEPS = [
  { id: "client", label: "Client" },
  { id: "items", label: "Lignes" },
  { id: "template", label: "Modèle" },
  { id: "review", label: "Vérification" },
] as const;

export interface InvoiceWizardTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
  options: TemplateOptions;
}

export interface InvoiceCreateWizardProps {
  defaultValues: DocumentFormValues;
  vatRateOptions: number[];
  templateOptions: InvoiceWizardTemplateOption[];
  onSubmit: (input: DocumentDraftInput) => Promise<DocumentFormSubmitResult>;
  onSuccess?: (id?: string) => void;
  submitLabel?: string;
}

/**
 * Wizard de création de facture en 4 étapes (Client → Lignes → Modèle → Vérification).
 * Réutilise le même schéma / mutations que `DocumentForm` (brouillon uniquement).
 */
export function InvoiceCreateWizard({
  defaultValues,
  vatRateOptions,
  templateOptions,
  onSubmit,
  onSuccess,
  submitLabel = "Créer la facture",
}: InvoiceCreateWizardProps) {
  const [step, setStep] = useState(0);
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues,
    mode: "onSubmit",
  });
  const { isDirty, isSubmitting, isSubmitSuccessful } = form.formState;
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty && !isSubmitSuccessful) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitSuccessful]);

  const totals = useMemo(() => {
    const values = watched as DocumentFormValues;
    if (!values?.lines?.length) return computeDocumentTotals([], null);
    const { lines, globalDiscount } = toTotalsInput(values);
    return computeDocumentTotals(lines, globalDiscount);
  }, [watched]);

  const vatTotal = useMemo(
    () => Object.values(totals.vatByRate).reduce((a, b) => a + b, 0),
    [totals.vatByRate],
  );

  const selectedTemplate = useMemo(() => {
    const id = (watched as DocumentFormValues)?.templateId;
    if (!id) return templateOptions.find((t) => t.isDefault) ?? null;
    return templateOptions.find((t) => t.id === id) ?? null;
  }, [watched, templateOptions]);

  async function goNext() {
    if (step === 0) {
      const ok = await form.trigger(["clientId"]);
      if (!ok) return;
    } else if (step === 1) {
      const ok = await form.trigger(["lines", "globalDiscountType", "globalDiscountValue"]);
      if (!ok) return;
    } else if (step === 2) {
      const ok = await form.trigger(["templateId"]);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(values: DocumentFormValues) {
    const result = await onSubmit(documentFormToDraftInput(values));
    if (!result.ok) {
      for (const [path, message] of Object.entries(result.errors ?? {})) {
        const field = path.replace(/^_root$/, "root") as keyof DocumentFormValues;
        form.setError(field, { message });
      }
      setStep(0);
      return;
    }
    onSuccess?.(result.id);
  }

  const nextLabels = ["Suivant", "Suivant : Modèle", "Suivant : Vérification"] as const;

  return (
    <div className="flex w-full min-w-0 flex-col space-y-6">
      <Stepper
        steps={[...STEPS]}
        current={step}
        className="mx-auto w-full max-w-4xl"
        onStepClick={(index) => {
          if (index < step) setStep(index);
        }}
      />

      <Form {...form}>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(handleSubmit)}
          onKeyDown={(e) => {
            // Empêche Enter dans un input d'envoyer le form avant la dernière étape.
            if (e.key === "Enter" && step < STEPS.length - 1) {
              const tag = (e.target as HTMLElement).tagName;
              if (tag === "INPUT" || tag === "TEXTAREA") {
                e.preventDefault();
              }
            }
          }}
        >
          <Card className="flex min-h-[calc(100vh-14rem)] flex-col">
            <CardHeader>
              <CardTitle className="text-xl">
                {step === 0 && "Sélectionner le client"}
                {step === 1 && "Lignes de facture"}
                {step === 2 && "Choisir le modèle"}
                {step === 3 && "Vérification & création"}
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 space-y-6">
              {step === 0 ? (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <ClientPicker
                            value={field.value || null}
                            initialLabel={form.getValues("clientLabel")}
                            onChange={(clientId, label) => {
                              field.onChange(clientId);
                              form.setValue("clientLabel", label, { shouldDirty: true });
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d&apos;émission</FormLabel>
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
                          <FormLabel>Date d&apos;échéance</FormLabel>
                          <FormControl>
                            <DatePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <LineEditor control={form.control} vatRateOptions={vatRateOptions} />
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
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Conditions de paiement, notes…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormMessage />
                      <TemplatePickerSlider
                        templates={templateOptions}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Client</dt>
                      <dd className="font-medium text-right">
                        {(watched as DocumentFormValues)?.clientLabel || "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Lignes</dt>
                      <dd className="font-medium text-right">
                        {(watched as DocumentFormValues)?.lines?.length ?? 0} article(s)
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Modèle</dt>
                      <dd className="font-medium text-right">
                        {selectedTemplate?.name ?? "Modèle par défaut"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Sous-total HT</dt>
                      <dd className="tabular-nums text-right">
                        {formatCentsEUR(totals.subtotal)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">TVA</dt>
                      <dd className="tabular-nums text-right">
                        {formatCentsEUR(vatTotal)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
                      <dt>Total TTC</dt>
                      <dd className="tabular-nums">{formatCentsEUR(totals.total)}</dd>
                    </div>
                  </dl>
                  {form.formState.errors.root ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t pt-6">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={goBack}>
                  Retour
                </Button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  {nextLabels[step]}
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Création…" : submitLabel}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
