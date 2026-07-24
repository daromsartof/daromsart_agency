"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  toast,
} from "@daromsart/ui";
import { renderEmailVariables, type EmailVariableName } from "@daromsart/core";
import { resetEmailDefaultAction } from "@/modules/organization/actions";
import { VariableTextarea } from "./variable-textarea";

const SAMPLE_VARS = {
  client: "Nova Digital",
  numero: "FAC-2026-0012",
  total: "1 200,00 €",
  lien: "https://app.exemple.fr/p/factures/xyz",
  echeance: "31/12/2026",
  jours_retard: "5",
};

const QUOTE_VARS: EmailVariableName[] = ["client", "numero", "total", "lien", "echeance"];
const INVOICE_VARS: EmailVariableName[] = ["client", "numero", "total", "lien", "echeance"];
const REMINDER_VARS: EmailVariableName[] = ["client", "numero", "total", "lien", "echeance", "jours_retard"];

const VARS_BY_KIND: Record<"quote" | "invoice" | "reminder", EmailVariableName[]> = {
  quote: QUOTE_VARS,
  invoice: INVOICE_VARS,
  reminder: REMINDER_VARS,
};

const TITLE_BY_KIND: Record<"quote" | "invoice" | "reminder", string> = {
  quote: "Envoi de devis",
  invoice: "Envoi de facture",
  reminder: "Relance",
};

export interface EmailTemplateCardProps {
  kind: "quote" | "invoice" | "reminder";
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}

export function EmailTemplateCard({
  kind,
  subject,
  body,
  defaultSubject,
  defaultBody,
  onSubjectChange,
  onBodyChange,
}: EmailTemplateCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const result = await resetEmailDefaultAction(kind);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la réinitialisation.");
        return;
      }
      onSubjectChange(defaultSubject);
      onBodyChange(defaultBody);
      toast.success("Texte réinitialisé au défaut.");
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{TITLE_BY_KIND[kind]}</CardTitle>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleReset}>
          Réinitialiser au défaut
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${kind}-subject`}>Objet</Label>
          <Input id={`${kind}-subject`} value={subject} onChange={(e) => onSubjectChange(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${kind}-body`}>Corps</Label>
          <VariableTextarea
            id={`${kind}-body`}
            value={body}
            onChange={onBodyChange}
            variables={VARS_BY_KIND[kind]}
          />
        </div>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? "Masquer l'aperçu" : "Voir l'aperçu"}
        </button>
        {showPreview ? (
          <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{renderEmailVariables(subject, SAMPLE_VARS)}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {renderEmailVariables(body, SAMPLE_VARS)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
