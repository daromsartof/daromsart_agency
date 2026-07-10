import { ReceiptText } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export const metadata = { title: "Factures" };

export default function FacturesPage() {
  return (
    <>
      <PageHeader
        title="Factures"
        description="Émettez vos factures et suivez les paiements."
      />
      <EmptyState
        icon={ReceiptText}
        title="Bientôt disponible"
        description="La facturation arrivera avec la story 12."
      />
    </>
  );
}
