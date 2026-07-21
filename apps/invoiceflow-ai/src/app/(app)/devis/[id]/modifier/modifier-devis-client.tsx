"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import { DocumentForm, type DocumentTemplateOption } from "@/modules/documents/document-form";
import { updateQuoteAction } from "@/modules/quotes/actions";
import { quoteToFormValues } from "@/modules/quotes/quote-to-form-values";
import type { QuoteDetail } from "@/modules/quotes/queries";

export interface ModifierDevisClientProps {
  quote: QuoteDetail;
  vatRateOptions: number[];
  templateOptions: DocumentTemplateOption[];
}

export function ModifierDevisClient({
  quote,
  vatRateOptions,
  templateOptions,
}: ModifierDevisClientProps) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title={`Modifier le devis${quote.clientName ? ` — ${quote.clientName}` : ""}`}
        description="Brouillon : les modifications ne sont visibles que par vous jusqu'à l'envoi."
      />
      <DocumentForm
        defaultValues={quoteToFormValues(quote)}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
        submitLabel="Enregistrer"
        onSubmit={(input) => updateQuoteAction(quote.id, input)}
        onSuccess={() => {
          toast.success("Devis mis à jour.");
          router.push("/devis");
        }}
      />
    </>
  );
}
