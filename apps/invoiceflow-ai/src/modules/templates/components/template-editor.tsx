"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, toast } from "@daromsart/ui";
import type { TemplateData, TemplateInput } from "@daromsart/core";
import {
  TemplateForm,
  type TemplateFormSubmitResult,
} from "./template-form";

export interface TemplateEditorProps {
  defaultValues: TemplateInput;
  onSubmit: (input: TemplateInput) => Promise<TemplateFormSubmitResult>;
  /**
   * Id du modèle en édition (page `/modeles/[id]`) : `onSubmit` (update) ne
   * renvoie pas d'id, contrairement à la création. Une chaîne simple plutôt
   * qu'une fonction — un Server Component ne peut pas passer de closure à un
   * Client Component (« Functions cannot be passed directly... »).
   */
  redirectId?: string;
  submitLabel?: string;
}

/** Éditeur split : formulaire à gauche, aperçu PDF live à droite (E-19). */
export function TemplateEditor({
  defaultValues,
  onSubmit,
  redirectId,
  submitLabel,
}: TemplateEditorProps) {
  const router = useRouter();
  const [previewOptions, setPreviewOptions] = useState<TemplateData["options"] | null>(
    defaultValues.options ? (defaultValues.options as TemplateData["options"]) : null,
  );

  const previewUrl = useMemo(() => {
    if (!previewOptions) return null;
    // btoa (pas Buffer, indisponible côté navigateur) puis base64 → base64url.
    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(previewOptions))));
    const encoded = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `/api/templates/preview?options=${encoded}`;
  }, [previewOptions]);

  async function handleSubmit(input: TemplateInput): Promise<TemplateFormSubmitResult> {
    const result = await onSubmit(input);
    if (result.ok) {
      toast.success("Modèle enregistré.");
    }
    return result;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TemplateForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        onOptionsChange={setPreviewOptions}
        onSuccess={(id) => router.push(`/modeles/${id ?? redirectId}`)}
        submitLabel={submitLabel}
      />
      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader>
          <CardTitle>Aperçu (données factices)</CardTitle>
        </CardHeader>
        <CardContent>
          {previewUrl ? (
            <iframe
              title="Aperçu du modèle"
              src={previewUrl}
              className="h-[700px] w-full rounded border"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
