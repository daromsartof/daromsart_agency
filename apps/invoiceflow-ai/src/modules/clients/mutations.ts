import { and, eq, inArray } from "drizzle-orm";
import { clientSchema, type ClientContactData, type ClientInput } from "@daromsart/core";
import type { AppDb } from "../../db/types";
import { clientContacts, clients } from "../../db/schema";

/**
 * Mutations pures (validation zod + écriture DB), sans dépendance à Next.js.
 * Toujours filtrées par `organizationId` : une opération ciblant un client
 * d'une autre organisation ne trouve aucune ligne et échoue proprement,
 * sans révéler l'existence du client (isolation multi-tenant, H4).
 */

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export type CreateClientResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function zodErrorsToRecord(
  issues: { path: (string | number)[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

async function replaceContacts(
  db: AppDb,
  clientId: string,
  contacts: ClientContactData[],
) {
  const existing = await db
    .select({ id: clientContacts.id })
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId));
  const existingIds = existing.map((c) => c.id);

  const keptIds = contacts
    .map((c) => c.id)
    .filter((id): id is string => Boolean(id));

  const toDelete = existingIds.filter((id) => !keptIds.includes(id));
  if (toDelete.length) {
    await db
      .delete(clientContacts)
      .where(
        and(
          eq(clientContacts.clientId, clientId),
          inArray(clientContacts.id, toDelete),
        ),
      );
  }

  for (const contact of contacts) {
    if (contact.id && existingIds.includes(contact.id)) {
      await db
        .update(clientContacts)
        .set({
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          role: contact.role || null,
          isDefaultRecipient: contact.isDefaultRecipient ?? false,
          updatedAt: new Date(),
        })
        .where(eq(clientContacts.id, contact.id));
    } else {
      await db.insert(clientContacts).values({
        clientId,
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        role: contact.role || null,
        isDefaultRecipient: contact.isDefaultRecipient ?? false,
      });
    }
  }
}

export async function createClient(
  db: AppDb,
  organizationId: string,
  input: ClientInput,
): Promise<CreateClientResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }

  const { contacts, ...clientData } = parsed.data;
  const [created] = await db
    .insert(clients)
    .values({
      ...clientData,
      email: clientData.email || null,
      organizationId,
    })
    .returning({ id: clients.id });

  if (contacts.length) {
    await replaceContacts(db, created.id, contacts);
  }

  return { ok: true, id: created.id };
}

export async function updateClient(
  db: AppDb,
  organizationId: string,
  clientId: string,
  input: ClientInput,
): Promise<MutationResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }

  const { contacts, ...clientData } = parsed.data;
  const updated = await db
    .update(clients)
    .set({ ...clientData, email: clientData.email || null, updatedAt: new Date() })
    .where(
      and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)),
    )
    .returning({ id: clients.id });

  if (!updated.length) {
    return { ok: false, errors: { _root: "Client introuvable." } };
  }

  await replaceContacts(db, clientId, contacts);
  return { ok: true };
}

async function setArchived(
  db: AppDb,
  organizationId: string,
  clientId: string,
  archivedAt: Date | null,
): Promise<MutationResult> {
  const updated = await db
    .update(clients)
    .set({ archivedAt, updatedAt: new Date() })
    .where(
      and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)),
    )
    .returning({ id: clients.id });

  if (!updated.length) {
    return { ok: false, errors: { _root: "Client introuvable." } };
  }
  return { ok: true };
}

export async function archiveClient(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<MutationResult> {
  return setArchived(db, organizationId, clientId, new Date());
}

export async function unarchiveClient(
  db: AppDb,
  organizationId: string,
  clientId: string,
): Promise<MutationResult> {
  return setArchived(db, organizationId, clientId, null);
}
