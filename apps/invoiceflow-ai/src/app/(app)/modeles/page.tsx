import { LayoutTemplate } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export const metadata = { title: "Modèles" };

export default function ModelesPage() {
  return (
    <>
      <PageHeader
        title="Modèles"
        description="Personnalisez la mise en page de vos documents."
      />
      <EmptyState
        icon={LayoutTemplate}
        title="Bientôt disponible"
        description="Les modèles de documents arriveront avec la story 09."
      />
    </>
  );
}
