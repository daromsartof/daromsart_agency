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
import { previewNextNumber, validateNumberFormat } from "@daromsart/core";
import { updateNumberFormats } from "@/modules/organization/actions";
import type { NumberFormats } from "@/db/schema";
import type { SequenceStatus } from "@/modules/organization/sequence-status";

const FIELDS: { key: keyof NumberFormats; label: string }[] = [
  { key: "quote", label: "Devis" },
  { key: "invoice", label: "Facture" },
  { key: "creditNote", label: "Avoir" },
];

export interface NumberFormatsCardProps {
  formats: NumberFormats;
  sequenceStatus: SequenceStatus;
}

const KIND_BY_FIELD: Record<keyof NumberFormats, keyof SequenceStatus> = {
  quote: "quote",
  invoice: "invoice",
  creditNote: "credit_note",
};

export function NumberFormatsCard({ formats, sequenceStatus }: NumberFormatsCardProps) {
  const [values, setValues] = useState<NumberFormats>(formats);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateNumberFormats(values);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les formats en erreur.");
        return;
      }
      toast.success("Formats de numérotation mis à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Numérotation</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {FIELDS.map(({ key, label }) => {
            const value = values[key];
            const clientCheck = validateNumberFormat(value);
            const seqKind = KIND_BY_FIELD[key];
            const started = sequenceStatus[seqKind] > 0;
            const preview = clientCheck.valid
              ? previewNextNumber(value, sequenceStatus[seqKind] + 1)
              : null;
            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={`format-${key}`}>{label}</Label>
                <Input
                  id={`format-${key}`}
                  value={value}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {preview ? (
                    <>Prochain numéro : <span className="font-medium">{preview}</span></>
                  ) : (
                    "Format invalide"
                  )}
                </p>
                {!clientCheck.valid ? (
                  <p className="text-xs text-destructive">{clientCheck.error}</p>
                ) : null}
                {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}
                {started ? (
                  <p className="text-xs text-warning">
                    La séquence {label.toLowerCase()} de cette année a déjà démarré — le nouveau
                    format s'appliquera aux prochaines émissions, sans interrompre la numérotation.
                  </p>
                ) : null}
              </div>
            );
          })}
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
