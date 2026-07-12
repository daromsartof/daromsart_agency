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
import { updateIdentity } from "@/modules/organization/actions";
import type { Organization } from "./types";

export function IdentityCard({ org }: { org: Organization }) {
  const [values, setValues] = useState({
    legalName: org.legalName,
    tradeName: org.tradeName ?? "",
    siret: org.siret ?? "",
    vatNumber: org.vatNumber ?? "",
    legalForm: org.legalForm ?? "",
    capital: org.capital ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateIdentity(values);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Identité mise à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identité</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">Nom légal</Label>
              <Input
                id="legalName"
                value={values.legalName}
                onChange={(e) =>
                  setValues((v) => ({ ...v, legalName: e.target.value }))
                }
                required
              />
              {errors.legalName ? (
                <p className="text-xs text-destructive">{errors.legalName}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nom commercial</Label>
              <Input
                id="tradeName"
                value={values.tradeName}
                onChange={(e) =>
                  setValues((v) => ({ ...v, tradeName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={values.siret}
                onChange={(e) =>
                  setValues((v) => ({ ...v, siret: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
              <Input
                id="vatNumber"
                value={values.vatNumber}
                onChange={(e) =>
                  setValues((v) => ({ ...v, vatNumber: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalForm">Forme juridique</Label>
              <Input
                id="legalForm"
                value={values.legalForm}
                onChange={(e) =>
                  setValues((v) => ({ ...v, legalForm: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capital">Capital social</Label>
              <Input
                id="capital"
                value={values.capital}
                onChange={(e) =>
                  setValues((v) => ({ ...v, capital: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) =>
                  setValues((v) => ({ ...v, email: e.target.value }))
                }
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={values.phone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: e.target.value }))
                }
              />
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
