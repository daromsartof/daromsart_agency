import {
  FileSignature,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  QrCode,
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
      { label: "QR Code", href: "/qrcode", icon: QrCode },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Paramètres", href: "/parametres", icon: Settings }],
  },
];
