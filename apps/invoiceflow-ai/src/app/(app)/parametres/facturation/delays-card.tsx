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
import { updateDelays } from "@/modules/organization/actions";

export interface DelaysCardProps {
  paymentTermsDays: number;
  quoteValidityDays: number;
}

export function DelaysCard({ paymentTermsDays, quoteValidityDays }: DelaysCardProps) {
  const [values, setValues] = useState({
    paymentTermsDays: String(paymentTermsDays),
    quoteValidityDays: String(quoteValidityDays),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateDelays({
        paymentTermsDays: Number.parseInt(values.paymentTermsDays, 10),
        quoteValidityDays: Number.parseInt(values.quoteValidityDays, 10),
      });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Délais par défaut mis à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Délais par défaut</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentTermsDays">Délai de paiement (jours)</Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min={1}
                value={values.paymentTermsDays}
                onChange={(e) => setValues((v) => ({ ...v, paymentTermsDays: e.target.value }))}
              />
              {errors.paymentTermsDays ? (
                <p className="text-xs text-destructive">{errors.paymentTermsDays}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteValidityDays">Validité des devis (jours)</Label>
              <Input
                id="quoteValidityDays"
                type="number"
                min={1}
                value={values.quoteValidityDays}
                onChange={(e) => setValues((v) => ({ ...v, quoteValidityDays: e.target.value }))}
              />
              {errors.quoteValidityDays ? (
                <p className="text-xs text-destructive">{errors.quoteValidityDays}</p>
              ) : null}
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
