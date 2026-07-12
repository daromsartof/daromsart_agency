"use server";

import { revalidatePath } from "next/cache";
import type { ClientInput } from "@daromsart/core";
import { db } from "../../db";
import { getCurrentOrganizationId, requireSession } from "../auth/session";
import {
  archiveClient,
  createClient,
  unarchiveClient,
  updateClient,
  type CreateClientResult,
  type MutationResult,
} from "./mutations";
import { getClientById, type ClientWithContacts } from "./queries";

async function requireOrganizationId(): Promise<string> {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    throw new Error("Utilisateur sans organisation.");
  }
  return organizationId;
}

export async function createClientAction(
  input: ClientInput,
): Promise<CreateClientResult> {
  const organizationId = await requireOrganizationId();
  const result = await createClient(db, organizationId, input);
  if (result.ok) revalidatePath("/clients");
  return result;
}

export async function updateClientAction(
  clientId: string,
  input: ClientInput,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await updateClient(db, organizationId, clientId, input);
  if (result.ok) revalidatePath("/clients");
  return result;
}

export async function archiveClientAction(
  clientId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await archiveClient(db, organizationId, clientId);
  if (result.ok) revalidatePath("/clients");
  return result;
}

export async function unarchiveClientAction(
  clientId: string,
): Promise<MutationResult> {
  const organizationId = await requireOrganizationId();
  const result = await unarchiveClient(db, organizationId, clientId);
  if (result.ok) revalidatePath("/clients");
  return result;
}

export async function getClientForEditAction(
  clientId: string,
): Promise<ClientWithContacts | null> {
  const organizationId = await requireOrganizationId();
  return getClientById(db, organizationId, clientId);
}
