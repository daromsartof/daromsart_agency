import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Card, CardContent } from "./ui/card";

export type StatCardTone =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "info";

const toneClasses: Record<StatCardTone, string> = {
  default: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
};

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
  trend?: { label: React.ReactNode; positive?: boolean };
  className?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon ? (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              toneClasses[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {trend ? (
            <p
              className={cn(
                "text-xs",
                trend.positive ? "text-success" : "text-destructive",
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export { StatCard };
