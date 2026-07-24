import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCurrentOrganizationId, requireAdmin } from "@/modules/auth/session";
import { listMembers, listPendingInvitations } from "@/modules/auth/invitations";
import { EquipeClient } from "./equipe-client";

export const metadata = { title: "Équipe" };

export default async function EquipePage() {
  const session = await requireAdmin();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const [members, pendingInvitations] = await Promise.all([
    listMembers(db, organizationId),
    listPendingInvitations(db, organizationId),
  ]);

  return (
    <EquipeClient
      members={members}
      pendingInvitations={pendingInvitations}
      currentUserId={session.user.id}
    />
  );
}
