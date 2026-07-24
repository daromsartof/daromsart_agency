import { cn, formatCentsEUR } from "@daromsart/ui";
import type { AgingBucket } from "../queries";

export interface AgingChartProps {
  buckets: AgingBucket[];
}

const toneByBucket: Record<string, string> = {
  "0-30": "bg-info",
  "31-60": "bg-warning",
  "61-90": "bg-warning",
  "90+": "bg-destructive",
};

/** Barres d'ancienneté des retards (0-30 / 31-60 / 61-90 / 90+). */
export function AgingChart({ buckets }: AgingChartProps) {
  const maxCents = Math.max(...buckets.map((b) => b.totalCents), 1);
  const totalCents = buckets.reduce((sum, b) => sum + b.totalCents, 0);
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

  if (totalCents === 0) {
    return <p className="text-sm text-muted-foreground">Aucun encours en retard.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {totalCount} facture{totalCount > 1 ? "s" : ""} · {formatCentsEUR(totalCents)}
      </p>
      <ul className="space-y-3">
        {buckets.map((bucket) => {
          const pct = Math.round((bucket.totalCents / maxCents) * 100);
          return (
            <li key={bucket.bucket} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{bucket.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {bucket.count > 0
                    ? `${formatCentsEUR(bucket.totalCents)} · ${bucket.count}`
                    : "—"}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    toneByBucket[bucket.bucket] ?? "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
