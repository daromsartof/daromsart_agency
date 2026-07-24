"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@daromsart/ui";

interface SettingsNavItem {
  label: string;
  href: string;
  adminOnly: boolean;
}

const ITEMS: SettingsNavItem[] = [
  { label: "Entreprise", href: "/parametres/entreprise", adminOnly: true },
  { label: "Facturation", href: "/parametres/facturation", adminOnly: true },
  { label: "Emails", href: "/parametres/emails", adminOnly: true },
  { label: "Équipe", href: "/parametres/equipe", adminOnly: true },
  { label: "Mon compte", href: "/parametres/compte", adminOnly: false },
];

export interface SettingsNavProps {
  /** Un membre (non-admin) ne voit que "Mon compte" (story 22). */
  isAdmin: boolean;
}

export function SettingsNav({ isAdmin }: SettingsNavProps) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav className="flex flex-col gap-1" aria-label="Paramètres">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
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
