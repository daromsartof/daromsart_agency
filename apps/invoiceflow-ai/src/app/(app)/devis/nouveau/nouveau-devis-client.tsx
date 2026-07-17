"use client";

import { useRouter } from "next/navigation";
import { PageHeader, toast } from "@daromsart/ui";
import { DocumentForm } from "@/modules/documents/document-form";
import { createQuoteAction } from "@/modules/quotes/actions";
import { emptyDocumentFormValues, type DocumentFormValues } from "@/modules/documents/document-form-schema";

export interface NouveauDevisClientProps {
  vatRateOptions: number[];
  vatRateDefault: number;
  quoteValidityDays: number;
  preselectedClient?: { id: string; displayName: string };
}

export function NouveauDevisClient({
  vatRateOptions,
  vatRateDefault,
  quoteValidityDays,
  preselectedClient,
}: NouveauDevisClientProps) {
  const router = useRouter();

  const defaultValues: DocumentFormValues = {
    ...emptyDocumentFormValues(vatRateDefault, quoteValidityDays),
    clientId: preselectedClient?.id ?? "",
    clientLabel: preselectedClient?.displayName ?? "",
  };

  return (
    <>
      <PageHeader
        title="Nouveau devis"
        description="Composez les lignes, la remise et les conditions du devis."
      />
      <DocumentForm
        defaultValues={defaultValues}
        vatRateOptions={vatRateOptions}
        submitLabel="Créer le devis"
        onSubmit={(input) => createQuoteAction(input)}
        onSuccess={(id) => {
          toast.success("Devis créé.");
          if (id) router.push(`/devis/${id}/modifier`);
        }}
      />
    </>
  );
}
