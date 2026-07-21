"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  templateSchema,
  type TemplateData,
  type TemplateInput,
} from "@daromsart/core";
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
  Switch,
  Textarea,
} from "@daromsart/ui";

export type TemplateFormSubmitResult =
  | { ok: true; id?: string }
  | { ok: false; errors?: Record<string, string> };

export interface TemplateFormProps {
  defaultValues: TemplateInput;
  onSubmit: (input: TemplateInput) => Promise<TemplateFormSubmitResult>;
  /** Débounce 500 ms côté appelant si besoin (l'aperçu re-fetch un PDF). */
  onOptionsChange?: (options: TemplateData["options"], name: string) => void;
  onSuccess?: (id?: string) => void;
  submitLabel?: string;
}

export function TemplateForm({
  defaultValues,
  onSubmit,
  onOptionsChange,
  onSuccess,
  submitLabel = "Enregistrer",
}: TemplateFormProps) {
  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateSchema),
    defaultValues,
  });
  const { isSubmitting } = form.formState;
  const watched = form.watch();
  const watchedKey = JSON.stringify(watched);

  useEffect(() => {
    if (!onOptionsChange) return;
    const timeout = setTimeout(() => {
      const parsed = templateSchema.safeParse(watched);
      if (parsed.success) onOptionsChange(parsed.data.options, parsed.data.name);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce sur un instantané JSON
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKey, onOptionsChange]);

  async function handleSubmit(values: TemplateInput) {
    const result = await onSubmit(values);
    if (!result.ok) {
      for (const [path, message] of Object.entries(result.errors ?? {})) {
        const field = path.replace(/^_root$/, "root") as keyof TemplateInput;
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du modèle</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de document</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="quote">Devis</SelectItem>
                    <SelectItem value="invoice">Facture</SelectItem>
                    <SelectItem value="both">Les deux</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="options.accentColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Couleur d'accent</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="color"
                      className="h-9 w-12 rounded border"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="w-28"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="options.font"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Police</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sans">Sans-serif (Inter)</SelectItem>
                    <SelectItem value="serif">Serif (Lora)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="options.showLogo"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel className="!mt-0">Afficher le logo</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="options.logoPosition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position du logo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="left">Gauche</SelectItem>
                    <SelectItem value="right">Droite</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Colonnes du tableau de lignes
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="options.columns.unit"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">Unité</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="options.columns.vatPerLine"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">TVA par ligne</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="options.columns.discountPerLine"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">Remise par ligne</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="options.headerNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note d'introduction par défaut</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="options.footerNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note de pied (affichée sur le PDF)</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="options.paymentTermsText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conditions de paiement</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            QR codes
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="options.showPaymentQr"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">QR de paiement (IBAN)</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="options.showPublicLinkQr"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">QR du lien public</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        {form.formState.errors.root ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
