"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@daromsart/ui";

const OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Laptop },
] as const;

export function ThemeCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Apparence</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Thème" className="grid grid-cols-3 gap-3">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-muted",
                  selected ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
