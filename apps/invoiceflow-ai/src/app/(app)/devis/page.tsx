import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export const metadata = { title: "Devis" };

export default function DevisPage() {
  return (
    <>
      <PageHeader
        title="Devis"
        description="Créez, envoyez et faites signer vos devis."
      />
      <EmptyState
        icon={FileText}
        title="Bientôt disponible"
        description="L'éditeur de devis arrivera avec la story 07."
      />
    </>
  );
}
