import {
  FileSignature,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";
import type { NavSection } from "@daromsart/ui";

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Devis", href: "/devis", icon: FileText },
      { label: "Factures", href: "/factures", icon: ReceiptText },
      { label: "Modèles", href: "/modeles", icon: LayoutTemplate },
      { label: "Signatures", href: "/signatures", icon: FileSignature },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Paramètres", href: "/parametres", icon: Settings }],
  },
];

const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/clients", title: "Clients" },
  { prefix: "/devis", title: "Devis" },
  { prefix: "/factures", title: "Factures" },
  { prefix: "/modeles", title: "Modèles" },
  { prefix: "/signatures", title: "Signatures" },
  { prefix: "/parametres", title: "Paramètres" },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = PAGE_TITLES.find((t) => pathname.startsWith(t.prefix));
  return match?.title ?? "Daromsart Système";
}
