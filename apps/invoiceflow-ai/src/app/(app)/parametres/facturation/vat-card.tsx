"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from "@daromsart/ui";
import { updateVatSettings } from "@/modules/organization/actions";

const STANDARD_VAT_RATES = [0, 5.5, 10, 20] as const;

export interface VatCardProps {
  activeRates: number[];
  defaultRate: number;
  franchiseEnabled: boolean;
}

export function VatCard({ activeRates, defaultRate, franchiseEnabled }: VatCardProps) {
  const [active, setActive] = useState<number[]>(activeRates);
  const [selectedDefault, setSelectedDefault] = useState(defaultRate);
  const [franchise, setFranchise] = useState(franchiseEnabled);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function toggleRate(rate: number, checked: boolean) {
    setActive((prev) => (checked ? [...prev, rate].sort((a, b) => a - b) : prev.filter((r) => r !== rate)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateVatSettings({
        activeRates: active,
        defaultRate: franchise ? 0 : selectedDefault,
        franchiseEnabled: franchise,
      });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors._root ?? "Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Paramètres de TVA mis à jour.");
      if (franchise) setSelectedDefault(0);
    });
  }

  const effectiveDefault = franchise ? 0 : selectedDefault;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">TVA</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Taux actifs</Label>
            <div className="flex flex-wrap gap-4">
              {STANDARD_VAT_RATES.map((rate) => (
                <label key={rate} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={active.includes(rate)}
                    onCheckedChange={(checked) => toggleRate(rate, checked)}
                  />
                  {rate} %
                </label>
              ))}
            </div>
            {errors.activeRates ? (
              <p className="text-xs text-destructive">{errors.activeRates}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-rate">Taux par défaut</Label>
            <Select
              value={String(effectiveDefault)}
              disabled={franchise}
              onValueChange={(v) => setSelectedDefault(Number(v))}
            >
              <SelectTrigger id="default-rate" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate} %
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.defaultRate ? (
              <p className="text-xs text-destructive">{errors.defaultRate}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Franchise en base (art. 293 B)</p>
              <p className="text-xs text-muted-foreground">
                Force le taux par défaut à 0 % et ajoute la mention légale.
              </p>
            </div>
            <Switch checked={franchise} onCheckedChange={setFranchise} />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
