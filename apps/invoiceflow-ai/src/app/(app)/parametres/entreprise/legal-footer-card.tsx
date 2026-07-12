"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
  toast,
} from "@daromsart/ui";
import { updateLegalFooter } from "@/modules/organization/actions";
import type { Organization } from "./types";

export function LegalFooterCard({ org }: { org: Organization }) {
  const [legalFooter, setLegalFooter] = useState(org.legalFooter ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateLegalFooter({ legalFooter });
      if (!result.ok) {
        toast.error("Erreur lors de l'enregistrement.");
        return;
      }
      toast.success("Mentions légales mises à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mentions légales</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="legalFooter">
              Texte affiché en pied de facture et de devis
            </Label>
            <Textarea
              id="legalFooter"
              rows={4}
              value={legalFooter}
              onChange={(e) => setLegalFooter(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
