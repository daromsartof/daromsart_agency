"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCentsEUR } from "@daromsart/ui";
import type { CaParMoisPoint } from "../queries";

export interface CaChartProps {
  data: CaParMoisPoint[];
}

function CaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{formatCentsEUR(payload[0].value)}</p>
    </div>
  );
}

/** Bar chart CA net d'avoirs, 12 derniers mois (E-06). Couleurs = tokens
 * thème (`--chart-1`, clair/sombre déjà définis dans `@daromsart/theme`) —
 * jamais de couleur en dur, pour rester cohérent avec le theme switch. */
export function CaChart({ data }: CaChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value: number) => formatCentsEUR(value)}
            width={80}
          />
          <Tooltip content={<CaTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="totalCents" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
