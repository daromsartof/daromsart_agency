import { Percent, ShoppingCart, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, formatCentsEUR } from "@daromsart/ui";
import type { ConversionStats } from "../queries";

export interface SecondaryKpisProps {
  stats: ConversionStats;
}

function KpiRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Percent;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** KPIs secondaires : conversion devis, panier moyen, DSO. */
export function SecondaryKpis({ stats }: SecondaryKpisProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Indicateurs commerciaux</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-around gap-6">
        <KpiRow
          icon={Percent}
          label="Taux de conversion devis"
          value={
            stats.conversionPercent !== null ? `${stats.conversionPercent} %` : "—"
          }
          hint={
            stats.pipelineCount > 0
              ? `${stats.signedOrInvoicedCount} signés / facturés sur ${stats.pipelineCount}`
              : "Aucun devis sorti"
          }
        />
        <KpiRow
          icon={ShoppingCart}
          label="Panier moyen"
          value={
            stats.panierMoyenCents !== null
              ? formatCentsEUR(stats.panierMoyenCents)
              : "—"
          }
          hint="Moyenne des factures émises"
        />
        <KpiRow
          icon={Timer}
          label="Délai moyen d'encaissement"
          value={stats.dsoJours !== null ? `${stats.dsoJours} j` : "—"}
          hint="Émission → paiement complet"
        />
      </CardContent>
    </Card>
  );
}
