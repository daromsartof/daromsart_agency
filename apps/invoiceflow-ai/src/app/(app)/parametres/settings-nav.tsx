"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, cn } from "@daromsart/ui";

interface SettingsNavItem {
  label: string;
  href: string;
  enabled: boolean;
}

const ITEMS: SettingsNavItem[] = [
  { label: "Entreprise", href: "/parametres/entreprise", enabled: true },
  { label: "Facturation", href: "/parametres/facturation", enabled: false },
  { label: "Emails", href: "/parametres/emails", enabled: false },
  { label: "Équipe", href: "/parametres/equipe", enabled: false },
  { label: "Mon compte", href: "/parametres/compte", enabled: false },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Paramètres">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        if (!item.enabled) {
          return (
            <span
              key={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              aria-disabled="true"
            >
              {item.label}
              <Badge variant="outline" className="text-[10px]">
                Bientôt
              </Badge>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              active ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
