"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from "@daromsart/ui";
import type { CaVsEncaissePoint } from "../queries";
import { CaChart } from "./ca-chart";

export interface SalesChartCardProps {
  data: CaVsEncaissePoint[];
}

/** Carte CA émis vs encaissé avec sélecteur 6 / 12 mois (tranche côté client). */
export function SalesChartCard({ data }: SalesChartCardProps) {
  const [period, setPeriod] = React.useState<"6" | "12">("12");

  const sliced = React.useMemo(() => {
    const n = period === "6" ? 6 : 12;
    return data.slice(-n);
  }, [data, period]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>CA émis vs encaissé</CardTitle>
        <Tabs
          value={period}
          onValueChange={(value) => setPeriod(value === "6" ? "6" : "12")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="6" className="px-2.5 text-xs">
              6 mois
            </TabsTrigger>
            <TabsTrigger value="12" className="px-2.5 text-xs">
              12 mois
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <CaChart data={sliced} />
      </CardContent>
    </Card>
  );
}
