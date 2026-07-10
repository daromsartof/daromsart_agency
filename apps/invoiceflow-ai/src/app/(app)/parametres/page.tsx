import { Settings } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export const metadata = { title: "Paramètres" };

export default function ParametresPage() {
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Configurez votre entreprise, la facturation et l'équipe."
      />
      <EmptyState
        icon={Settings}
        title="Bientôt disponible"
        description="Les paramètres arriveront avec les stories 04 et 22."
      />
    </>
  );
}
