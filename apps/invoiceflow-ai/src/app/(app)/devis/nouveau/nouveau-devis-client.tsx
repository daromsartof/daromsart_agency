"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, PageHeader, toast } from "@daromsart/ui";
import { DocumentForm, type DocumentTemplateOption } from "@/modules/documents/document-form";
import { createQuoteAction } from "@/modules/quotes/actions";
import { emptyDocumentFormValues, type DocumentFormValues } from "@/modules/documents/document-form-schema";

export interface NouveauDevisClientProps {
  vatRateOptions: number[];
  vatRateDefault: number;
  quoteValidityDays: number;
  preselectedClient?: { id: string; displayName: string };
  templateOptions: DocumentTemplateOption[];
  defaultTemplateId: string;
}

export function NouveauDevisClient({
  vatRateOptions,
  vatRateDefault,
  quoteValidityDays,
  preselectedClient,
  templateOptions,
  defaultTemplateId,
}: NouveauDevisClientProps) {
  const router = useRouter();

  const defaultValues: DocumentFormValues = {
    ...emptyDocumentFormValues(vatRateDefault, quoteValidityDays, defaultTemplateId),
    clientId: preselectedClient?.id ?? "",
    clientLabel: preselectedClient?.displayName ?? "",
  };

  return (
    <>
      <PageHeader
        back={
          <Button asChild variant="ghost" size="icon" aria-label="Retour aux devis">
            <Link href="/devis">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
        title="Nouveau devis"
        description="Composez les lignes, la remise et les conditions du devis."
      />
      <DocumentForm
        defaultValues={defaultValues}
        vatRateOptions={vatRateOptions}
        templateOptions={templateOptions}
        submitLabel="Créer le devis"
        onSubmit={(input) => createQuoteAction(input)}
        onSuccess={(id) => {
          toast.success("Devis créé.");
          if (id) router.push(`/devis/${id}`);
        }}
      />
    </>
  );
}
