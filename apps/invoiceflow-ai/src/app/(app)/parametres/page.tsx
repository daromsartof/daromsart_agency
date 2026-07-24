import { redirect } from "next/navigation";
import { getCurrentOrganizationId, getMembershipRole, requireSession } from "@/modules/auth/session";

export default async function ParametresPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  const role = organizationId ? await getMembershipRole(session.user.id, organizationId) : null;
  redirect(role === "admin" ? "/parametres/entreprise" : "/parametres/compte");
}
