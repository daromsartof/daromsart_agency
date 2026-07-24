"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCentsEUR } from "@daromsart/ui";
import type { CaVsEncaissePoint } from "../queries";

export interface CaChartProps {
  data: CaVsEncaissePoint[];
}

function CaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 text-muted-foreground">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2 tabular-nums">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium">{formatCentsEUR(entry.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chart CA émis (barres) vs encaissé (ligne), tokens thème uniquement. */
export function CaChart({ data }: CaChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
          <Bar
            dataKey="emisCents"
            name="CA émis"
            fill="hsl(var(--chart-1))"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Line
            type="monotone"
            dataKey="encaisseCents"
            name="Encaissé"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--chart-2))" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
