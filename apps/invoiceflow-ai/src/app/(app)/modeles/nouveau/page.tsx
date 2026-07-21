"use client";

import { PageHeader } from "@daromsart/ui";
import { DEFAULT_TEMPLATE_OPTIONS, type TemplateInput } from "@daromsart/core";
import { createTemplateAction } from "@/modules/templates/actions";
import { TemplateEditor } from "@/modules/templates/components/template-editor";

const DEFAULT_VALUES: TemplateInput = {
  name: "",
  type: "both",
  options: DEFAULT_TEMPLATE_OPTIONS,
};

export default function NouveauModelePage() {
  return (
    <>
      <PageHeader title="Nouveau modèle" description="Options de rendu appliquées au PDF." />
      <TemplateEditor
        defaultValues={DEFAULT_VALUES}
        onSubmit={createTemplateAction}
        submitLabel="Créer le modèle"
      />
    </>
  );
}
