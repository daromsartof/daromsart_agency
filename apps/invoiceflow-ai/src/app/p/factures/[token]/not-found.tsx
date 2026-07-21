import { FileX } from "lucide-react";
import { EmptyState } from "@daromsart/ui";

/** E-27 : lien invalide — jamais de détail sur la raison (token inexistant vs autre). */
export default function PublicInvoiceNotFound() {
  return (
    <EmptyState
      icon={FileX}
      title="Lien invalide"
      description="Ce lien n'est plus valide. Contactez l'émetteur de la facture pour en obtenir un nouveau."
    />
  );
}
