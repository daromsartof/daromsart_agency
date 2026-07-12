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
import { updateBank } from "@/modules/organization/actions";
import type { Organization } from "./types";

export function BankCard({ org }: { org: Organization }) {
  const [values, setValues] = useState({
    iban: org.iban ?? "",
    bic: org.bic ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateBank(values);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Coordonnées bancaires mises à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banque</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={values.iban}
                onChange={(e) =>
                  setValues((v) => ({ ...v, iban: e.target.value }))
                }
              />
              {errors.iban ? (
                <p className="text-xs text-destructive">{errors.iban}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic">BIC</Label>
              <Input
                id="bic"
                value={values.bic}
                onChange={(e) =>
                  setValues((v) => ({ ...v, bic: e.target.value }))
                }
              />
              {errors.bic ? (
                <p className="text-xs text-destructive">{errors.bic}</p>
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
