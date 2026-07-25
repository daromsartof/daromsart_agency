"use client";

import { useState } from "react";
import { Check, ShieldQuestion, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@daromsart/ui";
import type { RenderableToolPart } from "./tool-parts";

/**
 * Carte de confirmation d'une action ÉCRITE (story 28, pattern
 * propose → confirmer → exécuter). Le modèle PROPOSE (outil sans `execute`) ;
 * l'écriture n'a lieu qu'au clic « Confirmer » (via `onConfirm`, qui appelle
 * l'action serveur avec auth + validation), jamais automatiquement.
 */

const FIELD_LABELS: Record<string, string> = {
  type: "Type",
  displayName: "Nom",
  legalName: "Raison sociale",
  email: "Email",
  phone: "Téléphone",
  siret: "SIRET",
  vatNumber: "N° TVA",
  addressStreet: "Adresse",
  addressZip: "Code postal",
  addressCity: "Ville",
};
const TYPE_LABELS: Record<string, string> = {
  company: "Entreprise",
  individual: "Particulier",
};
const FIELD_ORDER = Object.keys(FIELD_LABELS);

const ACTION_TITLES: Record<string, string> = {
  proposeCreateClient: "Créer un client",
};

interface ConfirmResult {
  confirmed?: boolean;
  ok?: boolean;
  error?: string;
}

export interface ConfirmActionCardProps {
  part: RenderableToolPart;
  onConfirm?: (part: RenderableToolPart, confirmed: boolean) => Promise<void> | void;
  answerable: boolean;
}

export function ConfirmActionCard({ part, onConfirm, answerable }: ConfirmActionCardProps) {
  const [pending, setPending] = useState(false);
  const actionName = part.type.startsWith("tool-") ? part.type.slice("tool-".length) : part.type;
  const input = (part.input ?? {}) as Record<string, unknown>;
  const result = part.state === "output-available" ? (part.output as ConfirmResult) : null;

  const fields = FIELD_ORDER.filter((k) => {
    const v = input[k];
    return typeof v === "string" && v.trim().length > 0;
  });

  async function act(confirmed: boolean) {
    if (!onConfirm || pending) return;
    setPending(true);
    try {
      await onConfirm(part, confirmed);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-xl border-primary/30">
      <CardHeader className="flex flex-row items-start gap-2 py-3">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <CardTitle className="text-sm font-medium">
          {ACTION_TITLES[actionName] ?? "Confirmer l'action"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <dl className="space-y-1 text-sm">
          {fields.map((k) => {
            const raw = String(input[k]);
            const value = k === "type" ? (TYPE_LABELS[raw] ?? raw) : raw;
            return (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{FIELD_LABELS[k]}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            );
          })}
        </dl>

        {result ? (
          result.confirmed === false ? (
            <p className="text-sm text-muted-foreground">Action annulée.</p>
          ) : result.ok ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Client créé.
            </p>
          ) : (
            <p className="text-sm text-destructive">
              Échec : {result.error ?? "création impossible."}
            </p>
          )
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={!answerable || pending} onClick={() => act(true)}>
              <Check className="mr-1.5 h-4 w-4" />
              {pending ? "Création…" : "Confirmer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!answerable || pending}
              onClick={() => act(false)}
            >
              <X className="mr-1.5 h-4 w-4" />
              Annuler
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
