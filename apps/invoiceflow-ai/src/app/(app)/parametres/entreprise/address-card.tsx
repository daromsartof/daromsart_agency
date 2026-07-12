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
import { updateAddress } from "@/modules/organization/actions";
import type { Organization } from "./types";

export function AddressCard({ org }: { org: Organization }) {
  const [values, setValues] = useState({
    addressStreet: org.addressStreet ?? "",
    addressZip: org.addressZip ?? "",
    addressCity: org.addressCity ?? "",
    addressCountry: org.addressCountry,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateAddress(values);
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Adresse mise à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adresse</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressStreet">Rue</Label>
              <Input
                id="addressStreet"
                value={values.addressStreet}
                onChange={(e) =>
                  setValues((v) => ({ ...v, addressStreet: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressZip">Code postal</Label>
              <Input
                id="addressZip"
                value={values.addressZip}
                onChange={(e) =>
                  setValues((v) => ({ ...v, addressZip: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCity">Ville</Label>
              <Input
                id="addressCity"
                value={values.addressCity}
                onChange={(e) =>
                  setValues((v) => ({ ...v, addressCity: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCountry">Pays</Label>
              <Input
                id="addressCountry"
                value={values.addressCountry}
                onChange={(e) =>
                  setValues((v) => ({ ...v, addressCountry: e.target.value }))
                }
                required
              />
              {errors.addressCountry ? (
                <p className="text-xs text-destructive">
                  {errors.addressCountry}
                </p>
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
