import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Gérez vos clients et leurs contacts."
      />
      <EmptyState
        icon={Users}
        title="Bientôt disponible"
        description="La gestion des clients arrivera avec la story 05."
      />
    </>
  );
}
