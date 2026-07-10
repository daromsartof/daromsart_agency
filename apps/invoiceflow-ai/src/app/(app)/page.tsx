import { LayoutDashboard } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble de votre activité de facturation."
      />
      <EmptyState
        icon={LayoutDashboard}
        title="Bientôt disponible"
        description="Les indicateurs et graphiques arriveront avec la story 19."
      />
    </>
  );
}
