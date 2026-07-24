import { redirect } from "next/navigation";
import { PageHeader } from "@daromsart/ui";
import { getCurrentOrganizationId, getMembershipRole, requireSession } from "@/modules/auth/session";
import { SettingsNav } from "./settings-nav";

/**
 * Garde de session seulement (pas admin) : "Mon compte" (story 22) doit
 * rester accessible aux membres. Chaque page admin-only (entreprise,
 * facturation, emails, équipe) appelle `requireAdmin()` elle-même — jamais
 * une simple redirection UI (le nav masque les entrées pour un membre, mais
 * une navigation directe par URL doit être bloquée côté serveur aussi).
 */
export default async function ParametresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }
  const role = await getMembershipRole(session.user.id, organizationId);

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Configurez votre entreprise, la facturation et l'équipe."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <SettingsNav isAdmin={role === "admin"} />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  );
}
