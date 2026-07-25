"use server";

import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import { DEFAULT_AGENT_MODEL, isAgentModel } from "./models";
import { createConversation, deleteConversation } from "./mutations";

async function requireOrgAndUser(): Promise<{ organizationId: string; userId: string }> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return { organizationId, userId: session.user.id };
}

export async function createConversationAction(model?: string): Promise<{ id: string }> {
  const { organizationId, userId } = await requireOrgAndUser();
  const resolved = model && isAgentModel(model) ? model : DEFAULT_AGENT_MODEL;
  const id = await createConversation(db, organizationId, userId, resolved);
  return { id };
}

export async function deleteConversationAction(id: string): Promise<{ ok: true }> {
  const { organizationId, userId } = await requireOrgAndUser();
  await deleteConversation(db, organizationId, userId, id);
  return { ok: true };
}
