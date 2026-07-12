import { PageHeader } from "@daromsart/ui";
import { requireAdmin } from "@/modules/auth/session";
import { SettingsNav } from "./settings-nav";

export default async function ParametresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Configurez votre entreprise, la facturation et l'équipe."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <SettingsNav />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  );
}
