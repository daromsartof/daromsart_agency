"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@daromsart/auth";
import { db } from "../../db";
import { mailer } from "../../lib/mailer";
import { getCurrentOrganizationId, requireAdmin } from "./session";
import { inviteAuth } from "./invite-auth";
import {
  acceptInvite,
  inviteMember,
  removeMember,
  resendInvite,
  revokeInvite,
  updateRole,
  type AcceptInviteInput,
  type AcceptInviteResult,
  type InviteMemberResult,
  type MutationResult,
  type RemoveMemberResult,
  type UpdateRoleResult,
} from "./invitations";

async function requireAdminSession() {
  const session = await requireAdmin();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return { session, organizationId };
}

export async function inviteMemberAction(input: {
  email: string;
  role: Role;
}): Promise<InviteMemberResult> {
  const { session, organizationId } = await requireAdminSession();
  const result = await inviteMember(db, mailer, organizationId, session.user.id, input);
  if (result.ok) revalidatePath("/parametres/equipe");
  return result;
}

export async function resendInviteAction(invitationId: string): Promise<InviteMemberResult> {
  const { organizationId } = await requireAdminSession();
  const result = await resendInvite(db, mailer, organizationId, invitationId);
  if (result.ok) revalidatePath("/parametres/equipe");
  return result;
}

export async function revokeInviteAction(invitationId: string): Promise<MutationResult> {
  const { organizationId } = await requireAdminSession();
  const result = await revokeInvite(db, organizationId, invitationId);
  if (result.ok) revalidatePath("/parametres/equipe");
  return result;
}

export async function updateRoleAction(
  membershipId: string,
  newRole: Role,
): Promise<UpdateRoleResult> {
  const { organizationId } = await requireAdminSession();
  const result = await updateRole(db, organizationId, membershipId, newRole);
  if (result.ok) revalidatePath("/parametres/equipe");
  return result;
}

export async function removeMemberAction(membershipId: string): Promise<RemoveMemberResult> {
  const { session, organizationId } = await requireAdminSession();
  const result = await removeMember(db, organizationId, membershipId, session.user.id);
  if (result.ok) revalidatePath("/parametres/equipe");
  return result;
}

/** Pas de garde de session ici : c'est PRÉCISÉMENT ce qui permet à un
 * visiteur anonyme (le lien d'invitation dans sa boîte mail) de créer son
 * compte. La validité du token est vérifiée dans `acceptInvite` lui-même. */
export async function acceptInviteAction(
  token: string,
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  return acceptInvite(db, inviteAuth, token, input);
}
